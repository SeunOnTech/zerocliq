import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPublicClient, http, type Hex, type Address } from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit"

// Deploy salt - must match what's used in the app
const DEPLOY_SALT = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex

/**
 * GET /api/debug/permissions
 * List all saved debug permissions for a wallet
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const walletAddress = searchParams.get("walletAddress")

        if (!walletAddress) {
            return NextResponse.json({ success: false, error: "walletAddress required" }, { status: 400 })
        }

        // Find or create user
        let user = await prisma.user.findFirst({
            where: { walletAddress: walletAddress.toLowerCase() }
        })

        if (!user) {
            return NextResponse.json({ success: true, permissions: [] })
        }

        // Get permissions from CardStacks (using them as storage)
        const stacks = await prisma.cardStack.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                tokenAddress: true,
                tokenSymbol: true,
                tokenDecimals: true,
                totalBudget: true,
                periodDuration: true,
                permissionsContext: true,
                delegationManager: true,
                status: true,
                expiresAt: true,
                createdAt: true,
            }
        })

        return NextResponse.json({ success: true, permissions: stacks })
    } catch (error: any) {
        console.error("[Debug Permissions GET] Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

/**
 * POST /api/debug/permissions
 * Save a new permission to DB
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            walletAddress,
            chainId,
            permissionsContext,
            delegationManager,
            tokenAddress,
            tokenSymbol,
            tokenDecimals,
            periodAmount,
            periodDuration,
            expiresAt,
        } = body

        if (!walletAddress || !permissionsContext || !delegationManager) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: walletAddress, permissionsContext, delegationManager"
            }, { status: 400 })
        }

        // Get agent smart account address
        const agentPrivateKey = process.env.AGENT_EOA_PRIVATE_KEY as Hex
        if (!agentPrivateKey) throw new Error("AGENT_EOA_PRIVATE_KEY not configured")

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

        // Find or create user
        let user = await prisma.user.findFirst({
            where: { walletAddress: walletAddress.toLowerCase() }
        })

        if (!user) {
            // Get user's smart account address (we'll store it as blank for now)
            user = await prisma.user.create({
                data: {
                    walletAddress: walletAddress.toLowerCase(),
                    chainId: chainId || 11155111,
                    smartAccountAddress: "", // Will be updated later
                }
            })
        }

        // Create CardStack to store the permission
        const stack = await prisma.cardStack.create({
            data: {
                userId: user.id,
                tokenAddress: tokenAddress || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
                tokenSymbol: tokenSymbol || "USDC",
                tokenDecimals: tokenDecimals || 6,
                totalBudget: periodAmount || "10000000",
                periodDuration: periodDuration || 86400,
                permissionsContext: permissionsContext,
                delegationManager: delegationManager,
                status: "ACTIVE",
                expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 86400000),
            }
        })

        console.log(`[Debug Permissions] Saved permission for ${walletAddress}`)
        console.log(`   Permission ID: ${stack.id}`)
        console.log(`   Agent SA: ${agentSmartAccount.address}`)

        return NextResponse.json({
            success: true,
            permission: {
                id: stack.id,
                agentSmartAccount: agentSmartAccount.address,
            }
        })
    } catch (error: any) {
        console.error("[Debug Permissions POST] Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
