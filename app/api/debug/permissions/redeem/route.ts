import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPublicClient, http, encodeFunctionData, parseAbi, type Hex, type Address } from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { createBundlerClient } from "viem/account-abstraction"
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit"
import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions"

// Deploy salt - must match what's used in the app
const DEPLOY_SALT = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex

const ERC20_TRANSFER_ABI = parseAbi([
    "function transfer(address to, uint256 amount) external returns (bool)"
])

/**
 * POST /api/debug/permissions/redeem
 * Redeem a saved permission (execute transfer via backend)
 */
export async function POST(req: NextRequest) {
    console.log("[Debug Redeem] Request received")

    try {
        const body = await req.json()
        const { permissionId, recipientAddress, amount } = body

        if (!permissionId) {
            return NextResponse.json({ success: false, error: "permissionId required" }, { status: 400 })
        }

        // Fetch the permission (stored as CardStack)
        const stack = await prisma.cardStack.findUnique({
            where: { id: permissionId },
            include: { user: true }
        })

        if (!stack) {
            return NextResponse.json({ success: false, error: "Permission not found" }, { status: 404 })
        }

        if (!stack.permissionsContext || stack.permissionsContext === "pending") {
            return NextResponse.json({
                success: false,
                error: "No valid permissionsContext saved"
            }, { status: 400 })
        }

        // Setup clients
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

        console.log(`[Debug Redeem] Agent SA: ${agentSmartAccount.address}`)
        console.log(`[Debug Redeem] Permission ID: ${permissionId}`)

        // Setup bundler
        const bundlerUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoKey}`

        const bundlerClient = createBundlerClient({
            client: publicClient,
            transport: http(bundlerUrl),
            paymaster: true,
        }).extend(erc7710BundlerActions())

        // Prepare transfer
        const tokenAddress = stack.tokenAddress as Address
        const recipient = (recipientAddress || "0x5153d9734b24715943036527279cbff18a4493ea") as Address

        // Handle amount - if it contains a decimal, treat as USDC amount, otherwise as wei
        let transferAmount: bigint
        const amountStr = String(amount || "10000")
        if (amountStr.includes(".")) {
            // Decimal amount like "0.01" - convert to wei (6 decimals for USDC)
            const parsed = parseFloat(amountStr)
            transferAmount = BigInt(Math.round(parsed * 1000000))
        } else {
            // Already in wei
            transferAmount = BigInt(amountStr)
        }

        console.log(`[Debug Redeem] Token: ${tokenAddress}`)
        console.log(`[Debug Redeem] Amount: ${transferAmount}`)
        console.log(`[Debug Redeem] Recipient: ${recipient}`)

        const calldata = encodeFunctionData({
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [recipient, transferAmount],
        })

        // Extract permission context
        const permissionsContext = stack.permissionsContext as Hex
        const delegationManager = stack.delegationManager as Address

        console.log(`[Debug Redeem] Sending UserOperation...`)

        // Execute
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

        console.log(`[Debug Redeem] UserOp Hash: ${userOpHash}`)

        // Wait for receipt
        const receipt = await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
            timeout: 60000,
        })

        console.log(`[Debug Redeem] SUCCESS! TX: ${receipt.receipt.transactionHash}`)

        return NextResponse.json({
            success: true,
            userOpHash,
            transactionHash: receipt.receipt.transactionHash,
        })

    } catch (error: any) {
        console.error("[Debug Redeem] Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Redeem failed",
            details: error.stack?.slice(0, 500)
        }, { status: 500 })
    }
}
