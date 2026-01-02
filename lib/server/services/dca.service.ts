/**
 * DCA Service
 * 
 * Orchestrates Dollar-Cost Averaging execution:
 * 1. Transfer source token from User → Agent (via ERC-7715 permission)
 * 2. Swap source token → target token via DEX
 * 3. Output tokens go directly to user (swap recipient)
 * 
 * All operations are gas-sponsored via Pimlico paymaster.
 */

import { prisma } from "@/lib/prisma"
import { swapService } from "@/lib/server/services/swap.service"
// Config imports
import { getChainById, getViemChain } from "@/lib/server/config/chains"
import { getPaymasterUrl, AGENT_SMART_ACCOUNT_DEPLOY_SALT } from "@/lib/server/config/pimlico"
import { createPublicClient, http, encodeFunctionData, parseAbi, type Address, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { toMetaMaskSmartAccount, Implementation, getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit"
import { createSmartAccountClient } from "permissionless"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { entryPoint07Address } from "viem/account-abstraction"
import { createBundlerClient } from "viem/account-abstraction"
import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions"
import { formatUnits } from "viem"
import { notifyDCAExecuted } from "@/lib/server/services/notification.service"
import { logDCAExecutionActivity } from "@/lib/server/services/activity.service"
import { ActivityStatus } from "@prisma/client"

// ERC20 ABI for approve
const ERC20_ABI = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)"
])

export interface DCAExecutionResult {
    success: boolean
    transferTxHash?: string
    swapTxHash?: string
    amountIn: string
    amountOut?: string
    sourceToken: string
    targetToken?: string
    rate?: string
    error?: string
}

export interface DCAExecutionParams {
    cardStackId: string
    subCardId?: string
    amount?: string
    recipientAddress?: string // Optional override for recipient (e.g. for subscription payments)
    suppressLogs?: boolean // If true, skips default DCA activity/notification logging
}

class DCAService {
    /**
     * Execute a full DCA cycle:
     * 1. Transfer source token from User EOA → Agent SA (via ERC-7715)
     * 2. Swap source token → target token (Agent executes)
     * 3. Output goes directly to User EOA
     */
    /**
     * ORCHESTRATOR: Execute complete DCA
     */
    async executeFullDCA(params: DCAExecutionParams): Promise<DCAExecutionResult> {
        console.log(`[DCA] --- STARTING DCA/LIMIT EXECUTION for stack ${params.cardStackId} ---`)

        // 1. Execute Transfer (User -> Agent)
        const transferResult = await this.executeTransfer(params)

        if (!transferResult.success) {
            console.error(`[DCA] Transfer failed. Aborting execution.`)
            return transferResult
        }

        console.log(`[DCA] Transfer successful. Proceeding to swap...`)

        // 2. Execute Swap (Agent -> Target Token -> User)
        // NOTE: Subscription payments are handled by subscription.service.ts
        return this.executeSwap(params, transferResult)
    }


    /**
     * STEP 1: Transfer from User → Agent (ERC-7715)
     * This logic mimics the working /execute-transfer endpoint
     */
    async executeTransfer(params: DCAExecutionParams): Promise<DCAExecutionResult> {
        const { cardStackId, amount } = params

        console.log(`[DCA Transfer] Initializing for stack ${cardStackId}`)

        const cardStack = await prisma.cardStack.findUnique({
            where: { id: cardStackId },
            include: { user: true, subCards: true } // Include subCards to find DCA one
        })

        if (!cardStack) throw new Error("Card Stack not found")
        if (!cardStack.permissionsContext || cardStack.permissionsContext === "pending") {
            throw new Error("No valid permissionsContext for this Card Stack")
        }

        const chainId = 11155111
        const viemChain = getViemChain(chainId)
        const environment = getSmartAccountsEnvironment(chainId)
        const paymasterUrl = getPaymasterUrl(chainId)
        const chainConfig = getChainById(chainId)
        if (!chainConfig) throw new Error("Chain not supported")

        // Setup Agent
        const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex
        const agentEOA = privateKeyToAccount(agentPrivateKey)

        const publicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig!.rpcUrl) })

        const agentSmartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [agentEOA.address, [], [], []],
            deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
            signer: { account: agentEOA },
        })

        console.log(`[DCA Transfer] Agent SA: ${agentSmartAccount.address}`)

        // Calculate amount
        // Calculate amount (Assume input is ALWAYS human-readable string, e.g. "1.5" or "10")
        const amountStr = amount || cardStack.amountPerExecution || "1"
        let transferAmount: bigint

        try {
            // Safe conversion for both integers ("10") and floats ("0.5")
            // We use standard math if parseUnits isn't imported, or simple multiplication
            // Since we might not have parseUnits imported, let's stick to the math logic but applied to ALL
            const parsed = parseFloat(amountStr)
            if (isNaN(parsed)) throw new Error("Invalid amount")
            transferAmount = BigInt(Math.round(parsed * Math.pow(10, cardStack.tokenDecimals)))
        } catch (e) {
            console.error("Failed to parse amount:", amountStr, e)
            transferAmount = BigInt(0)
        }

        console.log(`[DCA Transfer] Transferring ${amountStr} ${cardStack.tokenSymbol} (${transferAmount} wei)`)

        // --- VALIDATION: Check Daily Limit ---
        const dcaSubCardForLimit = params.subCardId
            ? cardStack.subCards.find(sc => sc.id === params.subCardId)
            : cardStack.subCards.find(sc => sc.type === "DCA_BOT")

        if (dcaSubCardForLimit && dcaSubCardForLimit.config) {
            const config = dcaSubCardForLimit.config as any
            if (config.dailyLimit) {
                // Parse Limit (stored as string like "12")
                const dailyLimitBase = parseFloat(config.dailyLimit)
                // Convert to Wei
                const dailyLimitWei = BigInt(Math.round(dailyLimitBase * Math.pow(10, cardStack.tokenDecimals)))

                // Check if we need to reset daily limit
                const lastSpentDate = new Date((dcaSubCardForLimit as any).lastSpentDate)
                const today = new Date()
                const isSameDay = lastSpentDate.getDate() === today.getDate() &&
                    lastSpentDate.getMonth() === today.getMonth() &&
                    lastSpentDate.getFullYear() === today.getFullYear()

                // If not same day, reset currentSpent to 0 for this check
                const currentSpent = isSameDay ? BigInt(dcaSubCardForLimit.currentSpent || "0") : BigInt(0)

                console.log(`[DCA Limit Check] Limit: ${dailyLimitWei}, Spent Today: ${currentSpent}, Request: ${transferAmount}, Reset: ${!isSameDay}`)

                if (currentSpent + transferAmount > dailyLimitWei) {
                    throw new Error(`Daily limit exceeded. Limit: ${config.dailyLimit} ${cardStack.tokenSymbol}, Spent Today: ${formatUnits(currentSpent, cardStack.tokenDecimals)}`)
                }
            }
        }

        // Setup Bundler
        const bundlerClient = createBundlerClient({
            client: publicClient,
            transport: http(paymasterUrl),
            paymaster: true,
        }).extend(erc7710BundlerActions())

        // Build Calldata for Transfer
        const transferCalldata = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [agentSmartAccount.address, transferAmount],
        })

        // Execute UserOp
        console.log(`[DCA Transfer] Sending UserOp...`)
        try {
            const transferUserOpHash = await bundlerClient.sendUserOperationWithDelegation({
                account: agentSmartAccount,
                calls: [{
                    to: cardStack.tokenAddress as Address,
                    data: transferCalldata,
                    permissionsContext: cardStack.permissionsContext as Hex,
                    delegationManager: (cardStack.delegationManager || environment.DelegationManager) as Address,
                }],
                entryPointAddress: entryPoint07Address,
                publicClient,
            })

            console.log(`[DCA Transfer] UserOp sent: ${transferUserOpHash}`)

            const receipt = await bundlerClient.waitForUserOperationReceipt({
                hash: transferUserOpHash,
                timeout: 60000,
            })

            console.log(`[DCA Transfer] Success! TX: ${receipt.receipt.transactionHash}`)

            // --- PERSISTENCE: Update Spent Amounts ---
            // 1. Find the correct SubCard (DCA)
            // If subCardId is provided, use it. Otherwise find first DCA_BOT subcard.
            let subCardToUpdate = params.subCardId
                ? cardStack.subCards.find(sc => sc.id === params.subCardId)
                : cardStack.subCards.find(sc => sc.type === "DCA_BOT")

            // Fallback: If no DCA subcard found, use the first one (shouldn't happen in valid stack)
            if (!subCardToUpdate && cardStack.subCards.length > 0) {
                subCardToUpdate = cardStack.subCards[0]
            }

            let updatedSubCardSpent = "0"

            if (subCardToUpdate) {
                // Re-calculate spent based on daily reset (same logic as above)
                const lastSpentDate = new Date((subCardToUpdate as any).lastSpentDate)
                const today = new Date()
                const isSameDay = lastSpentDate.getDate() === today.getDate() &&
                    lastSpentDate.getMonth() === today.getMonth() &&
                    lastSpentDate.getFullYear() === today.getFullYear()

                const currentSpent = isSameDay ? BigInt(subCardToUpdate.currentSpent || "0") : BigInt(0)
                const newSpent = currentSpent + transferAmount

                // Update SubCard
                await prisma.subCard.update({
                    where: { id: subCardToUpdate.id },
                    data: {
                        currentSpent: newSpent.toString(),
                        totalSpent: (BigInt(subCardToUpdate.totalSpent || "0") + transferAmount).toString(),
                        lastSpentDate: new Date() // Always update timestamp to now
                    } as any
                })
                updatedSubCardSpent = newSpent.toString()
                console.log(`[DCA Transfer] Updated SubCard ${subCardToUpdate.id} spent: ${newSpent} (Reset: ${!isSameDay})`)
            } else {
                console.warn(`[DCA Transfer] No SubCard found to update spent amount for stack ${cardStackId}`)
            }

            return {
                success: true,
                transferTxHash: receipt.receipt.transactionHash,
                amountIn: transferAmount.toString(),
                sourceToken: cardStack.tokenSymbol,
                targetToken: cardStack.targetTokenSymbol || undefined // pass this along
            }

        } catch (error: any) {
            console.error(`[DCA Transfer] Error:`, error)
            return {
                success: false,
                amountIn: "0",
                sourceToken: cardStack.tokenSymbol,
                error: error.message || "Transfer failed"
            }
        }
    }
    // NOTE: Subscription forward transfer logic has been moved to subscription.service.ts
    /**
     * STEP 2b: Swap (Agent -> Target Token)
     * Only called if Transfer succeeds.
     */
    async executeSwap(params: DCAExecutionParams, transferResult: DCAExecutionResult): Promise<DCAExecutionResult> {
        console.log(`[DCA Swap] --- STARTING SWAP PHASE ---`)

        const { cardStackId } = params
        const cardStack = await prisma.cardStack.findUnique({
            where: { id: cardStackId },
            include: {
                user: true,
                subCards: true
            }
        })

        if (!cardStack) throw new Error("Card Stack not found during swap phase") // Should be impossible if transfer worked

        // Find SubCard Config to Determine Target
        let targetAddress = cardStack.targetTokenAddress
        let targetSymbol = cardStack.targetTokenSymbol
        let targetDecimals = cardStack.targetTokenDecimals

        if (params.subCardId) {
            const sc = cardStack.subCards.find(s => s.id === params.subCardId)
            const cfg = sc?.config as any
            if (cfg?.targetTokenAddress) {
                targetAddress = cfg.targetTokenAddress
                targetSymbol = cfg.targetTokenSymbol
                targetDecimals = cfg.targetTokenDecimals
                console.log(`[DCA Swap] Using Strategy-Specific Target: ${targetSymbol} (${targetAddress})`)
            }
        }

        // Validation: Do we have a target token?
        if (!targetAddress || !targetSymbol) {
            console.log(`[DCA Swap] No target token configured. Ending execution.`)
            return {
                ...transferResult,
                error: "No target token configured - Transfer only"
            }
        }

        console.log(`[DCA Swap] Target: ${targetSymbol} (${targetAddress})`)
        console.log(`[DCA Swap] Amount to swap: ${transferResult.amountIn}`)

        const chainId = 11155111
        const viemChain = getViemChain(chainId)
        const paymasterUrl = getPaymasterUrl(chainId)
        const chainConfig = getChainById(chainId)
        if (!chainConfig) throw new Error("Chain not supported")

        const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex
        const agentEOA = privateKeyToAccount(agentPrivateKey)
        const publicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig!.rpcUrl) })

        // Re-init Agent Smart Account for swap context
        const agentSmartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [agentEOA.address, [], [], []],
            deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
            signer: { account: agentEOA },
        })

        const agentAddress = agentSmartAccount.address
        console.log(`[DCA Swap] 🤖 Agent Smart Account: ${agentAddress}`)

        // 1. Get Quote
        console.log(`[DCA Swap] Fetching quote...`)
        const quote = await swapService.getQuote({
            chainId,
            tokenIn: cardStack.tokenAddress,
            tokenOut: targetAddress, // Use dynamic target
            amountIn: transferResult.amountIn,
            amountInRaw: true,
            userAddress: agentSmartAccount.address,
            slippageBps: 200,
        })

        if (!quote.success || !quote.bestRoute) {
            console.error(`[DCA Swap] Quote failed: ${quote.error}`)
            return {
                ...transferResult,
                success: false,
                error: `Swap quote failed: ${quote.error}`
            }
        }

        console.log(`[DCA Swap] Quote received: ${quote.bestRoute.amountOut} ${targetSymbol}`)
        console.log(`[DCA Swap] Route: via ${quote.bestRoute.dexName}`)

        // 2. Build Execution
        const tokenIn = chainConfig?.tokens.find(t => t.address.toLowerCase() === cardStack.tokenAddress.toLowerCase())
        if (!tokenIn) throw new Error("Unknown source token in config")

        const execution = await swapService.buildExecution({
            route: {
                ...quote.bestRoute,
                dexId: quote.bestRoute.dexId as any,
                chainId,
                amountIn: BigInt(transferResult.amountIn),
                amountOut: BigInt(quote.bestRoute.amountOut),
                minAmountOut: BigInt(quote.bestRoute.minAmountOut),
            },
            userAddress: agentSmartAccount.address,
            recipient: cardStack.user.walletAddress as Address,
            deadline: Math.floor(Date.now() / 1000) + 300,
            client: publicClient,
            tokenIn,
        })

        if (!execution) throw new Error("Failed to build swap execution")

        console.log(`[DCA Swap] Execution built. Contains ${execution.approvals.length} approvals + 1 swap.`)

        const bundlerClient = createBundlerClient({
            client: publicClient,
            transport: http(paymasterUrl),
            paymaster: true,
        }).extend(erc7710BundlerActions())

        // 4. Build Calls
        const swapCalls: { to: Address; data: Hex; value?: bigint }[] = []

        for (const approval of execution.approvals) {
            swapCalls.push({
                to: approval.to,
                data: approval.data,
                value: approval.value ? BigInt(approval.value) : 0n,
            })
        }

        swapCalls.push({
            to: execution.swap.to,
            data: execution.swap.data,
            value: execution.swap.value ? BigInt(execution.swap.value) : 0n,
        })

        // 5. Execute
        console.log(`[DCA Swap] Submitting Swap UserOp via BundlerClient...`)
        try {
            const swapTxHash = await bundlerClient.sendUserOperation({
                account: agentSmartAccount,
                calls: swapCalls,
            })
            console.log(`[DCA Swap] UserOp Hash: ${swapTxHash}`)

            const receipt = await bundlerClient.waitForUserOperationReceipt({
                hash: swapTxHash,
                timeout: 60000,
            })

            console.log(`[DCA Swap] Success! TX: ${receipt.receipt.transactionHash}`)

            // Calculate rate
            const amountInNum = Number(transferResult.amountIn) / Math.pow(10, cardStack.tokenDecimals)
            const amountOutNum = Number(quote.bestRoute.amountOut) / Math.pow(10, targetDecimals || 18) // use targetDecimals
            const rate = (amountOutNum / amountInNum).toFixed(8)

            // Log Activity & Notify (ONLY if not suppressed)
            if (!params.suppressLogs) {
                const dcaSubCard = cardStack.subCards.find(sc => sc.type === "DCA_BOT")
                const stackName = dcaSubCard?.name || "DCA Stack"
                const formattedAmountOut = formatUnits(BigInt(quote.bestRoute.amountOut), targetDecimals || 18)

                await Promise.all([
                    logDCAExecutionActivity(cardStack.user.walletAddress, chainId, {
                        status: ActivityStatus.SUCCESS,
                        stackName,
                        amount: formattedAmountOut,
                        token: targetSymbol, // use targetSymbol
                        txHash: receipt.receipt.transactionHash
                    }),
                    notifyDCAExecuted(cardStack.user.walletAddress, chainId, {
                        stackName,
                        amount: formattedAmountOut,
                        token: targetSymbol, // use targetSymbol
                        txHash: receipt.receipt.transactionHash
                    })
                ]).catch(err => console.error("[DCA Swap] Failed to log activity/notification:", err))
            }

            return {
                ...transferResult,
                success: true,
                swapTxHash: receipt.receipt.transactionHash,
                amountOut: quote.bestRoute.amountOut,
                targetToken: targetSymbol,
                rate
            }

        } catch (e: any) {
            console.error(`[DCA Swap] Execution Failed:`, e)
            return {
                ...transferResult,
                error: `Swap execution failed: ${e.message}`,
                // Note: success is still true for transfer part? 
                // We'll mark overall success as false if swap fails, but keep transfer hash
                success: false
            }
        }
    }
    /**
     * DEMO MODE: Execute DCA without DB persistence
     * Used for AI Chat "Run Demo" flow
     */
    async executeDemoDCA(params: {
        userAddress: string
        sourceTokenAddress: string
        sourceTokenSymbol: string
        sourceTokenDecimals: number
        targetTokenAddress: string
        targetTokenSymbol: string
        amount: string
        permissionsContext: string
    }): Promise<DCAExecutionResult> {
        console.log(`[DCA Demo] Starting Demo Execution for ${params.userAddress}`)

        const chainId = 11155111
        const viemChain = getViemChain(chainId)
        const environment = getSmartAccountsEnvironment(chainId)
        const paymasterUrl = getPaymasterUrl(chainId)
        const chainConfig = getChainById(chainId)

        if (!chainConfig) throw new Error("Chain not supported")

        try {
            // 1. Setup Agent
            const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex
            const agentEOA = privateKeyToAccount(agentPrivateKey)
            const publicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig.rpcUrl) })

            const agentSmartAccount = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [agentEOA.address, [], [], []],
                deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
                signer: { account: agentEOA },
            })

            // 2. Execute Transfer (User -> Agent)
            console.log(`[DCA Demo] 1. Transferring ${params.amount} ${params.sourceTokenSymbol}`)

            // Calculate amount in wei
            let transferAmount: bigint
            try {
                const parsed = parseFloat(params.amount)
                transferAmount = BigInt(Math.round(parsed * Math.pow(10, params.sourceTokenDecimals)))
            } catch (e) {
                console.error("Invalid amount", e)
                return { success: false, amountIn: "0", sourceToken: params.sourceTokenSymbol, error: "Invalid amount" }
            }

            const bundlerClient = createBundlerClient({
                client: publicClient,
                transport: http(paymasterUrl),
                paymaster: true,
            }).extend(erc7710BundlerActions())

            const transferCalldata = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [agentSmartAccount.address, transferAmount],
            })

            // 3. Get Swap Quote
            console.log(`[DCA Demo] Getting quote for ${transferAmount} ${params.sourceTokenSymbol} -> ${params.targetTokenSymbol}`)
            const quote = await swapService.getQuote({
                chainId,
                tokenIn: params.sourceTokenAddress,
                tokenOut: params.targetTokenAddress,
                amountIn: transferAmount.toString(),
                amountInRaw: true,
                userAddress: agentSmartAccount.address,
                slippageBps: 200,
            })

            if (!quote.success || !quote.bestRoute) {
                throw new Error(`Swap quote failed: ${quote.error}`)
            }

            // 4. Build Swap Execution
            const tokenIn = chainConfig.tokens.find(t => t.address.toLowerCase() === params.sourceTokenAddress.toLowerCase())
            if (!tokenIn) throw new Error("Unknown source token config")

            const execution = await swapService.buildExecution({
                route: {
                    ...quote.bestRoute,
                    dexId: quote.bestRoute.dexId as any,
                    chainId,
                    amountIn: transferAmount,
                    amountOut: BigInt(quote.bestRoute.amountOut),
                    minAmountOut: BigInt(quote.bestRoute.minAmountOut),
                },
                userAddress: agentSmartAccount.address,
                recipient: params.userAddress as Address,
                deadline: Math.floor(Date.now() / 1000) + 300,
                client: publicClient,
                tokenIn,
            })

            if (!execution) throw new Error("Failed to build swap execution")

            // 5. Execute ATOMIC Batch (Transfer -> Approve -> Swap)
            // We combine all calls into one UserOperationWithDelegation to avoid nonce conditions

            // Construct Batch Calls
            const calls = [
                // 1. Transfer (Redeem Delegation)
                {
                    to: params.sourceTokenAddress as Address,
                    data: transferCalldata,
                    permissionsContext: params.permissionsContext as Hex,
                    delegationManager: environment.DelegationManager as Address,
                },
                // 2. Approvals
                ...execution.approvals.map(approval => ({
                    to: approval.to,
                    data: approval.data,
                    value: BigInt(approval.value || 0)
                })),
                // 3. Swap
                {
                    to: execution.swap.to,
                    data: execution.swap.data,
                    value: BigInt(execution.swap.value || 0)
                }
            ]

            console.log(`[DCA Demo] Executing Atomic Batch (${calls.length} calls)`)

            const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
                account: agentSmartAccount,
                calls,
                entryPointAddress: entryPoint07Address,
                publicClient,
            })

            console.log(`[DCA Demo] Atomic UserOp sent: ${userOpHash}`)
            const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash, timeout: 60000 })
            const txHash = receipt.receipt.transactionHash
            console.log(`[DCA Demo] Execution confirmed: ${txHash}`)

            return {
                success: true,
                transferTxHash: txHash,
                swapTxHash: txHash, // Same TX
                amountIn: transferAmount.toString(),
                amountOut: quote.bestRoute.amountOut,
                sourceToken: params.sourceTokenSymbol,
                targetToken: params.targetTokenSymbol
            }

        } catch (error: any) {
            console.error(`[DCA Demo] Execution failed:`, error)
            return {
                success: false,
                amountIn: "0",
                sourceToken: params.sourceTokenSymbol,
                error: error.message || "Execution failed"
            }
        }


    }
}

export const dcaService = new DCAService()
