import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPublicClient, http, encodeFunctionData, parseAbi, type Hex, type Address } from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { createBundlerClient } from "viem/account-abstraction"
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit"
import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions"

// Deploy salt - must match what's used in permission request
const DEPLOY_SALT = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex

const ERC20_TRANSFER_ABI = parseAbi([
    "function transfer(address to, uint256 amount) external returns (bool)"
])

/**
 * POST /api/card-stacks/execute-transfer
 * 
 * Execute a token transfer using stored ERC-7715 permission.
 * This is the EXACT same logic as the working /api/debug/permissions/redeem route.
 */
export async function POST(req: NextRequest) {
    console.log("[CardStack Transfer] Request received")

    try {
        const body = await req.json()
        const { cardStackId, recipientAddress, amount, subCardId } = body

        if (!cardStackId) {
            return NextResponse.json({ success: false, error: "cardStackId required" }, { status: 400 })
        }

        // Fetch the Card Stack with subCards for budget checking
        const cardStack = await prisma.cardStack.findUnique({
            where: { id: cardStackId },
            include: { user: true, subCards: true }
        })

        if (!cardStack) {
            return NextResponse.json({ success: false, error: "Card Stack not found" }, { status: 404 })
        }

        if (!cardStack.permissionsContext || cardStack.permissionsContext === "pending") {
            return NextResponse.json({
                success: false,
                error: "No valid permissionsContext saved for this Card Stack"
            }, { status: 400 })
        }

        // Setup clients - EXACT same as working debug flow
        const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex
        const pimlicoKey = process.env.PIMLICO_API_KEY || "pim_gpv8uAY4a3SK7ioMf6Y7nh"

        if (!agentPrivateKey) {
            throw new Error("AGENT_EOA_PRIVATE_KEY not configured")
        }

        const publicClient = createPublicClient({
            chain: sepolia,
            transport: http("https://1rpc.io/sepolia")
        })

        const agentEOA = privateKeyToAccount(agentPrivateKey)

        const agentSmartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [agentEOA.address, [], [], []],
            deploySalt: DEPLOY_SALT,
            signer: { account: agentEOA },
        })

        console.log(`[CardStack Transfer] Agent SA: ${agentSmartAccount.address}`)
        console.log(`[CardStack Transfer] Card Stack ID: ${cardStackId}`)

        // Setup bundler
        const bundlerUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoKey}`

        const bundlerClient = createBundlerClient({
            client: publicClient,
            transport: http(bundlerUrl),
            paymaster: true,
        }).extend(erc7710BundlerActions())

        // Prepare transfer
        const tokenAddress = cardStack.tokenAddress as Address
        const recipient = (recipientAddress || agentSmartAccount.address) as Address

        // Handle amount - if it contains a decimal, treat as token amount, otherwise as wei
        let transferAmount: bigint
        const amountStr = String(amount || "10000")
        if (amountStr.includes(".")) {
            // Decimal amount - convert using token decimals
            const parsed = parseFloat(amountStr)
            transferAmount = BigInt(Math.round(parsed * Math.pow(10, cardStack.tokenDecimals)))
        } else {
            // Already in wei
            transferAmount = BigInt(amountStr)
        }

        console.log(`[CardStack Transfer] Token: ${cardStack.tokenSymbol} (${tokenAddress})`)
        console.log(`[CardStack Transfer] Amount: ${transferAmount}`)
        console.log(`[CardStack Transfer] Recipient: ${recipient}`)

        // Check User EOA balance BEFORE execution
        // Note: With EIP-7702, the EOA is upgraded in-place to act as a smart account
        // So funds are held in the EOA, not a separate smart account address
        const userWalletAddress = cardStack.user.walletAddress as Address
        if (userWalletAddress) {
            const balance = await publicClient.readContract({
                address: tokenAddress,
                abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
                functionName: "balanceOf",
                args: [userWalletAddress],
            })

            console.log(`[CardStack Transfer] User EOA Balance: ${balance}`)

            if (balance < transferAmount) {
                return NextResponse.json({
                    success: false,
                    error: "Insufficient balance",
                    details: {
                        userWallet: userWalletAddress,
                        balance: balance.toString(),
                        required: transferAmount.toString(),
                        token: cardStack.tokenSymbol,
                        message: `User wallet has ${Number(balance) / Math.pow(10, cardStack.tokenDecimals)} ${cardStack.tokenSymbol}, but needs ${Number(transferAmount) / Math.pow(10, cardStack.tokenDecimals)} ${cardStack.tokenSymbol}`
                    }
                }, { status: 400 })
            }
        }

        // Check DCA Budget Limit BEFORE execution
        const transferAmountInTokens = Number(transferAmount) / Math.pow(10, cardStack.tokenDecimals)

        // Find DCA SubCard to check budget
        let targetSubCard = subCardId
            ? cardStack.subCards.find(sc => sc.id === subCardId)
            : cardStack.subCards.find(sc => sc.type === 'DCA_BOT')

        if (targetSubCard) {
            const currentSpent = parseFloat(targetSubCard.currentSpent || "0")
            const allocatedBudget = (parseFloat(cardStack.totalBudget) * targetSubCard.allocationPercent) / 100
            const remainingBudget = allocatedBudget - currentSpent

            if (transferAmountInTokens > remainingBudget) {
                console.log(`[CardStack Transfer] Budget exceeded: ${currentSpent} + ${transferAmountInTokens} > ${allocatedBudget}`)
                return NextResponse.json({
                    success: false,
                    error: "DCA budget limit exceeded",
                    details: {
                        currentSpent,
                        transferAmount: transferAmountInTokens,
                        allocatedBudget,
                        remainingBudget,
                        message: `DCA budget limit reached. Remaining: ${remainingBudget.toFixed(4)} ${cardStack.tokenSymbol}, but trying to transfer ${transferAmountInTokens} ${cardStack.tokenSymbol}`
                    }
                }, { status: 400 })
            }
        }

        const calldata = encodeFunctionData({
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [recipient, transferAmount],
        })

        // Extract permission context
        const permissionsContext = cardStack.permissionsContext as Hex
        const delegationManager = cardStack.delegationManager as Address

        console.log(`[CardStack Transfer] Sending UserOperation...`)

        // Execute - EXACT same as working debug flow
        const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
            publicClient,
            account: agentSmartAccount as any,
            calls: [{
                to: tokenAddress,
                data: calldata,
                value: 0n,
                permissionsContext,
                delegationManager,
            }],
            maxFeePerGas: 10000000000n,
            maxPriorityFeePerGas: 1000000000n,
        })

        console.log(`[CardStack Transfer] UserOp Hash: ${userOpHash}`)

        // Wait for receipt
        const receipt = await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
            timeout: 60000,
        })

        console.log(`[CardStack Transfer] SUCCESS! TX: ${receipt.receipt.transactionHash}`)

        // Update SubCard spent amount
        const spentAmount = Number(transferAmount) / Math.pow(10, cardStack.tokenDecimals)
        console.log(`[CardStack Transfer] Updating spent: ${spentAmount} ${cardStack.tokenSymbol}`)
        console.log(`[CardStack Transfer] SubCardId from request: ${subCardId || 'NOT PROVIDED'}`)

        // Find the target subCard - use provided ID or auto-find DCA subCard
        let targetSubCardId = subCardId
        if (!targetSubCardId) {
            console.log(`[CardStack Transfer] Auto-finding DCA subCard for stack ${cardStackId}`)
            const dcaSubCard = await prisma.subCard.findFirst({
                where: {
                    stackId: cardStackId,
                    type: 'DCA_BOT'
                }
            })
            if (dcaSubCard) {
                targetSubCardId = dcaSubCard.id
                console.log(`[CardStack Transfer] Found DCA subCard: ${dcaSubCard.id} (${dcaSubCard.name})`)
            } else {
                console.log(`[CardStack Transfer] No DCA subCard found for this stack`)
            }
        }

        if (targetSubCardId) {
            const subCard = await prisma.subCard.findUnique({ where: { id: targetSubCardId } })
            if (subCard) {
                const newCurrentSpent = (parseFloat(subCard.currentSpent) + spentAmount).toString()
                const newTotalSpent = (parseFloat(subCard.totalSpent) + spentAmount).toString()

                await prisma.subCard.update({
                    where: { id: targetSubCardId },
                    data: {
                        currentSpent: newCurrentSpent,
                        totalSpent: newTotalSpent
                    }
                })
                console.log(`[CardStack Transfer] Updated SubCard: ${subCard.currentSpent} -> ${newCurrentSpent}`)
            }
        } else {
            console.log(`[CardStack Transfer] WARNING: No subCard to update!`)
        }

        // Log Activity
        await prisma.activity.create({
            data: {
                id: crypto.randomUUID(),
                walletAddress: cardStack.user.walletAddress,
                chainId: 11155111,
                type: "DCA_EXECUTION",
                status: "SUCCESS",
                title: `Executed DCA: ${cardStack.tokenSymbol}`,
                description: `Transferred ${Number(transferAmount) / Math.pow(10, cardStack.tokenDecimals)} ${cardStack.tokenSymbol}`,
                metadata: {
                    txHash: receipt.receipt.transactionHash,
                    userOpHash,
                    amount: transferAmount.toString(),
                    token: cardStack.tokenSymbol
                }
            }
        })

        return NextResponse.json({
            success: true,
            userOpHash,
            transactionHash: receipt.receipt.transactionHash,
        })

    } catch (error: any) {
        console.error("[CardStack Transfer] Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Execution failed",
            details: error.stack?.slice(0, 500)
        }, { status: 500 })
    }
}
