import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getChainById, getViemChain } from "@/lib/server/config/chains"
import { getPaymasterUrl, AGENT_SMART_ACCOUNT_DEPLOY_SALT } from "@/lib/server/config/pimlico"
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData, type Hex, type Address, publicActions } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { toMetaMaskSmartAccount, Implementation, getSmartAccountsEnvironment, createExecution, ExecutionMode } from "@metamask/smart-accounts-kit"
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts"
import { createSmartAccountClient } from "permissionless"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { entryPoint07Address } from "viem/account-abstraction"

const ERC20_TRANSFER_ABI = parseAbi([
    "function transfer(address to, uint256 amount) external returns (bool)"
])

/**
 * POST /api/card-stacks/execute-transfer
 * 
 * Execute a token transfer using a Card Stack's permission context.
 * This uses the stored delegation to transfer tokens from the user's Smart Account.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { stackId, recipientAddress, amount } = body

        if (!stackId || !recipientAddress || !amount) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: stackId, recipientAddress, amount"
            }, { status: 400 })
        }

        console.log(`[CardStack Transfer] Starting transfer from stack ${stackId}`)

        // 1. Get the Card Stack
        const cardStack = await prisma.cardStack.findUnique({
            where: { id: stackId },
            include: { user: true }
        })

        if (!cardStack) {
            return NextResponse.json({
                success: false,
                error: "Card Stack not found"
            }, { status: 404 })
        }

        if (cardStack.status !== "ACTIVE") {
            return NextResponse.json({
                success: false,
                error: `Card Stack is ${cardStack.status}, not ACTIVE`
            }, { status: 400 })
        }

        console.log(`[CardStack Transfer] Stack token: ${cardStack.tokenSymbol}`)
        console.log(`[CardStack Transfer] Permissions Context exists: ${!!cardStack.permissionsContext}`)
        console.log(`[CardStack Transfer] Delegation Manager: ${cardStack.delegationManager}`)

        // 2. Validate permissions context
        if (!cardStack.permissionsContext || cardStack.permissionsContext.length < 10) {
            return NextResponse.json({
                success: false,
                error: "Card Stack has no valid permissions context. The permission was never properly granted.",
                debug: {
                    permissionsContext: cardStack.permissionsContext?.slice(0, 50),
                    delegationManager: cardStack.delegationManager
                }
            }, { status: 400 })
        }

        // 3. Get chain config
        // For now, assume Sepolia (chainId 11155111) - need to store chainId in CardStack
        const chainId = 11155111 // TODO: Get from CardStack
        const chainConfig = getChainById(chainId)
        if (!chainConfig) {
            return NextResponse.json({
                success: false,
                error: `Chain ${chainId} not supported`
            }, { status: 400 })
        }

        const viemChain = getViemChain(chainId)
        const environment = getSmartAccountsEnvironment(chainId)

        // 4. Setup Agent EOA (the executor)
        const agentPrivateKey = process.env.AGENT_PRIVATE_KEY || process.env.AGENT_EOA_PRIVATE_KEY as Hex
        if (!agentPrivateKey) {
            return NextResponse.json({
                success: false,
                error: "AGENT_PRIVATE_KEY not configured on server"
            }, { status: 500 })
        }

        const agentEOA = privateKeyToAccount(agentPrivateKey as Hex)
        console.log(`[CardStack Transfer] Agent EOA: ${agentEOA.address}`)

        // 5. Create Public Client
        const publicClient = createPublicClient({
            chain: viemChain,
            transport: http(chainConfig.rpcUrl),
        })

        // 6. Create Agent Smart Account
        const agentSmartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [agentEOA.address, [], [], []],
            deploySalt: AGENT_SMART_ACCOUNT_DEPLOY_SALT,
            signer: { account: agentEOA },
        })

        console.log(`[CardStack Transfer] Agent Smart Account: ${agentSmartAccount.address}`)

        // 7. Get user's Smart Account address
        const userSmartAccountAddress = cardStack.user.smartAccountAddress as Address
        if (!userSmartAccountAddress) {
            return NextResponse.json({
                success: false,
                error: "User has no Smart Account deployed"
            }, { status: 400 })
        }

        console.log(`[CardStack Transfer] User Smart Account: ${userSmartAccountAddress}`)

        // 8. Setup Pimlico Paymaster
        const paymasterUrl = getPaymasterUrl(chainId)

        const pimlicoClient = createPimlicoClient({
            transport: http(paymasterUrl),
            entryPoint: {
                address: entryPoint07Address,
                version: "0.7",
            },
        })

        // 9. Create SmartAccountClient
        const smartAccountClient = createSmartAccountClient({
            account: agentSmartAccount as any,
            chain: viemChain,
            bundlerTransport: http(paymasterUrl),
            paymaster: pimlicoClient,
            userOperation: {
                estimateFeesPerGas: async () => {
                    return (await pimlicoClient.getUserOperationGasPrice()).fast
                },
            },
        })

        // 10. Build ERC-20 Transfer calldata
        const transferAmount = BigInt(amount)
        const transferCalldata = encodeFunctionData({
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [recipientAddress as Address, transferAmount],
        })

        console.log(`[CardStack Transfer] Transfer: ${amount} to ${recipientAddress}`)

        // 11. The permissionsContext from ERC-7715 IS the encoded redemption calldata
        // We need to call the DelegationManager with this context
        // The context includes the delegation and execution data

        // For ERC-7715 permissions, the flow is:
        // - User granted permission via requestExecutionPermissions()
        // - We got back permissionsContext which is pre-encoded
        // - We use sendTransactionWithDelegation or call DelegationManager directly

        // Try using the permissionsContext directly
        const delegationManager = cardStack.delegationManager as Address
        const permissionsContext = cardStack.permissionsContext as Hex

        // Method 1: If permissionsContext is the full redemption calldata
        // We can call DelegationManager directly with it

        // BUT... for ERC-7715, the permissionsContext needs to be combined with our execution
        // The SDK's sendUserOperationWithDelegation does this

        // For now, let's try a simpler approach: simulate what the transfer would look like
        // and return diagnostic info

        return NextResponse.json({
            success: true,
            message: "Transfer simulation complete",
            debug: {
                stackId: cardStack.id,
                tokenAddress: cardStack.tokenAddress,
                tokenSymbol: cardStack.tokenSymbol,
                recipientAddress,
                transferAmount: amount,
                agentAddress: agentSmartAccount.address,
                userSmartAccount: userSmartAccountAddress,
                delegationManager,
                permissionsContextLength: permissionsContext.length,
                paymasterUrl,
                note: "To actually execute, we need to use erc7710BundlerActions with the permissionsContext"
            }
        })

    } catch (error: any) {
        console.error("[CardStack Transfer] Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Internal server error"
        }, { status: 500 })
    }
}
