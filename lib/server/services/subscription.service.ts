/**
 * Subscription Service
 * 
 * Handles recurring payment execution:
 * 1. Transfer source token from User → Agent (via ERC-7715 permission)
 * 2. Transfer source token from Agent → Recipient
 * 
 * This is a dedicated service for SUBSCRIPTION strategy type.
 * It does NOT perform swaps - tokens are forwarded as-is.
 */

import { prisma } from "@/lib/prisma"
import { getChainById, getViemChain } from "@/lib/server/config/chains"
import { getPaymasterUrl, AGENT_SMART_ACCOUNT_DEPLOY_SALT } from "@/lib/server/config/pimlico"
import { createPublicClient, http, encodeFunctionData, parseAbi, type Address, type Hex, formatUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { toMetaMaskSmartAccount, Implementation, getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit"
import { createBundlerClient, entryPoint07Address } from "viem/account-abstraction"
import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions"
import { notifySubscriptionPaid } from "@/lib/server/services/notification.service"
import { logDCAExecutionActivity } from "@/lib/server/services/activity.service"
import { ActivityStatus } from "@prisma/client"

// ERC20 ABI
const ERC20_ABI = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)"
])

export interface SubscriptionExecutionResult {
    success: boolean
    transferTxHash?: string
    paymentTxHash?: string
    amountIn: string
    sourceToken: string
    recipient?: string
    label?: string
    error?: string
}

export interface SubscriptionExecutionParams {
    cardStackId: string
    subCardId: string
    amount: string
    recipientAddress: string
}

class SubscriptionService {
    /**
     * Execute a full Subscription payment cycle:
     * 1. Transfer source token from User EOA → Agent SA (via ERC-7715)
     * 2. Transfer source token from Agent SA → Recipient
     */
    async executeSubscription(params: SubscriptionExecutionParams): Promise<SubscriptionExecutionResult> {
        console.log(`[Subscription] --- STARTING PAYMENT for stack ${params.cardStackId} ---`)
        console.log(`[Subscription] Recipient: ${params.recipientAddress}`)
        console.log(`[Subscription] Amount: ${params.amount}`)

        // 1. Pull funds from User to Agent
        const pullResult = await this.pullFundsFromUser(params)
        if (!pullResult.success) {
            console.error(`[Subscription] Pull failed. Aborting.`)
            return pullResult
        }

        console.log(`[Subscription] Funds pulled to Agent. TX: ${pullResult.transferTxHash}`)

        // 2. Forward funds from Agent to Recipient
        const paymentResult = await this.forwardToRecipient(params, pullResult)
        return paymentResult
    }

    /**
     * STEP 1: Pull funds from User → Agent (via ERC-7715 Permission)
     */
    async pullFundsFromUser(params: SubscriptionExecutionParams): Promise<SubscriptionExecutionResult> {
        const { cardStackId, subCardId, amount } = params
        console.log(`[Subscription Pull] Starting pull for ${amount} tokens...`)

        try {
            const cardStack = await prisma.cardStack.findUnique({
                where: { id: cardStackId },
                include: { user: true, subCards: true }
            })
            if (!cardStack) throw new Error("Stack not found")

            const subCard = subCardId ? cardStack.subCards.find(sc => sc.id === subCardId) : undefined

            // Chain Setup - use user's chainId from the user record, fallback to Sepolia
            const chainId = (cardStack as any).chainId || cardStack.user.chainId || 11155111
            const viemChain = getViemChain(chainId)
            const paymasterUrl = getPaymasterUrl(chainId)
            const chainConfig = getChainById(chainId)
            if (!chainConfig) throw new Error("Chain not supported")

            // Agent Account Setup
            const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex
            if (!agentPrivateKey) throw new Error("Agent private key not configured")

            const agentEOA = privateKeyToAccount(agentPrivateKey)
            const publicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig.rpcUrl!) })

            const agentSmartAccount = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [agentEOA.address, [], [], []],
                deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
                signer: { account: agentEOA },
            })
            console.log(`[Subscription Pull] Agent SA: ${agentSmartAccount.address}`)

            // Load Permission from User (Hex string stored in DB)
            const storedPermission = (cardStack as any).permissionContext || (cardStack as any).permissionsContext
            if (!storedPermission) throw new Error("No permission stored for this stack")
            console.log(`[Subscription Pull] Permission Context loaded (length: ${storedPermission?.length})`)

            // Calculate amount in smallest units
            const transferAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, cardStack.tokenDecimals)))
            console.log(`[Subscription Pull] Amount (raw): ${transferAmount}`)

            // Build Transfer Call (User -> Agent)
            const transferCalldata = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [agentSmartAccount.address, transferAmount],
            })

            // Bundler Client with Permission
            const bundlerClient = createBundlerClient({
                client: publicClient,
                transport: http(paymasterUrl),
                paymaster: true,
            }).extend(erc7710BundlerActions())

            console.log(`[Subscription Pull] Sending Pull UserOp...`)

            // Get environment for DelegationManager
            const environment = getSmartAccountsEnvironment(chainId)

            const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
                account: agentSmartAccount,
                calls: [{
                    to: cardStack.tokenAddress as Address,
                    data: transferCalldata,
                    permissionsContext: storedPermission as Hex,
                    delegationManager: ((cardStack as any).delegationManager || environment.DelegationManager) as Address,
                }],
                entryPointAddress: entryPoint07Address,
                publicClient,
            })
            console.log(`[Subscription Pull] UserOp Hash: ${userOpHash}`)

            const receipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
                timeout: 60000,
            })
            console.log(`[Subscription Pull] Success! TX: ${receipt.receipt.transactionHash}`)

            // Update spent tracking - use raw units (wei) to match dca.service.ts
            const config = subCard?.config as any
            const currentSpentWei = BigInt(subCard?.currentSpent || "0")
            const newSpentWei = currentSpentWei + transferAmount

            if (subCard) {
                await prisma.subCard.update({
                    where: { id: subCard.id },
                    data: {
                        currentSpent: newSpentWei.toString(),
                        totalSpent: (BigInt(subCard.totalSpent || "0") + transferAmount).toString(),
                        lastSpentDate: new Date()
                    } as any
                })
                console.log(`[Subscription Pull] Updated SubCard ${subCard.id} spent: ${newSpentWei}`)
            }

            return {
                success: true,
                transferTxHash: receipt.receipt.transactionHash,
                amountIn: transferAmount.toString(),
                sourceToken: cardStack.tokenSymbol,
                label: config?.label
            }

        } catch (error: any) {
            console.error(`[Subscription Pull] Error:`, error)
            return {
                success: false,
                amountIn: "0",
                sourceToken: "",
                error: error.message || "Pull failed"
            }
        }
    }

    /**
     * STEP 2: Forward funds from Agent → Recipient
     */
    async forwardToRecipient(
        params: SubscriptionExecutionParams,
        pullResult: SubscriptionExecutionResult
    ): Promise<SubscriptionExecutionResult> {
        console.log(`[Subscription Payment] --- FORWARDING TO RECIPIENT ---`)
        const { cardStackId, recipientAddress, subCardId } = params

        try {
            const cardStack = await prisma.cardStack.findUnique({
                where: { id: cardStackId },
                include: { user: true, subCards: true }
            })
            if (!cardStack) throw new Error("Stack not found")

            // Chain Setup - use user's chainId from the user record, fallback to Sepolia
            const chainId = (cardStack as any).chainId || cardStack.user.chainId || 11155111
            const viemChain = getViemChain(chainId)
            const paymasterUrl = getPaymasterUrl(chainId)
            const chainConfig = getChainById(chainId)
            if (!chainConfig) throw new Error("Chain not supported")

            // Agent Account Setup
            const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex
            const agentEOA = privateKeyToAccount(agentPrivateKey)
            const publicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig.rpcUrl!) })

            const agentSmartAccount = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [agentEOA.address, [], [], []],
                deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
                signer: { account: agentEOA },
            })
            console.log(`[Subscription Payment] Agent SA: ${agentSmartAccount.address}`)
            console.log(`[Subscription Payment] Recipient: ${recipientAddress}`)
            console.log(`[Subscription Payment] Amount: ${pullResult.amountIn}`)

            // Build Transfer Call (Agent -> Recipient)
            const transferCalldata = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [recipientAddress as Address, BigInt(pullResult.amountIn)],
            })

            // Bundler Client (no permission needed - Agent owns these funds)
            const bundlerClient = createBundlerClient({
                client: publicClient,
                transport: http(paymasterUrl),
                paymaster: true,
            }).extend(erc7710BundlerActions())

            console.log(`[Subscription Payment] Sending Payment UserOp...`)
            const userOpHash = await bundlerClient.sendUserOperation({
                account: agentSmartAccount,
                calls: [{
                    to: cardStack.tokenAddress as Address,
                    data: transferCalldata,
                    value: 0n
                }],
            })
            console.log(`[Subscription Payment] UserOp Hash: ${userOpHash}`)

            const receipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
                timeout: 60000,
            })
            console.log(`[Subscription Payment] Success! TX: ${receipt.receipt.transactionHash}`)

            // Log Activity & Notify
            const subCard = cardStack.subCards.find(sc => sc.id === subCardId)
            const config = subCard?.config as any
            const label = config?.label || "Subscription"
            const formattedAmount = formatUnits(BigInt(pullResult.amountIn), cardStack.tokenDecimals)

            await Promise.all([
                logDCAExecutionActivity(cardStack.user.walletAddress, chainId, {
                    status: ActivityStatus.SUCCESS,
                    stackName: `Paid: ${label}`,
                    amount: formattedAmount,
                    token: cardStack.tokenSymbol,
                    txHash: receipt.receipt.transactionHash
                }),
                notifySubscriptionPaid(cardStack.user.walletAddress, chainId, {
                    label,
                    amount: formattedAmount,
                    token: cardStack.tokenSymbol,
                    recipient: recipientAddress,
                    txHash: receipt.receipt.transactionHash
                })
            ]).catch(err => console.error("[Subscription Payment] Failed to log activity/notification:", err))

            return {
                ...pullResult,
                success: true,
                paymentTxHash: receipt.receipt.transactionHash,
                recipient: recipientAddress,
                label
            }

        } catch (error: any) {
            console.error(`[Subscription Payment] Error:`, error)
            return {
                ...pullResult,
                success: false,
                error: `Payment failed: ${error.message}`
            }
        }
    }
}

export const subscriptionService = new SubscriptionService()
