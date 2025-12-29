
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CardStackService } from "@/lib/server/services/card-stack.service"

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
            totalBudget,
            periodDuration,
            expiresAt,
            subCards
        } = body

        if (!walletAddress || !permissionsContext || !chainId) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
        }

        // Handle both string (ERC-7710) and object (Signature Fallback) contexts
        const safePermissionsContext = typeof permissionsContext === 'string'
            ? permissionsContext
            : JSON.stringify(permissionsContext)

        // 1. Get User ID from wallet address AND chainId
        const user = await prisma.user.findUnique({
            where: {
                walletAddress_chainId: {
                    walletAddress: walletAddress,
                    chainId: chainId
                }
            }
        })

        if (!user) {
            return NextResponse.json({ success: false, error: "User not found for this chain" }, { status: 404 })
        }

        // 2. Create Stack
        const stack = await CardStackService.createStack({
            userId: user.id,
            permissionsContext: safePermissionsContext,
            delegationManager,
            tokenAddress,
            tokenSymbol,
            tokenDecimals,
            totalBudget,
            periodDuration,
            expiresAt,
            subCards
        })

        return NextResponse.json({ success: true, stack })

    } catch (error) {
        console.error("[API] Failed to create stack:", error)
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const walletAddress = searchParams.get('walletAddress')
        const chainId = parseInt(searchParams.get('chainId') || "0")

        if (!walletAddress || !chainId) {
            return NextResponse.json({ success: false, error: "Missing walletAddress or chainId" }, { status: 400 })
        }

        const user = await prisma.user.findUnique({
            where: {
                walletAddress_chainId: {
                    walletAddress: walletAddress,
                    chainId: chainId
                }
            }
        })

        if (!user) {
            return NextResponse.json({ success: false, stacks: [] })
        }

        const stacks = await CardStackService.getStacks(user.id)
        return NextResponse.json({ success: true, stacks })

    } catch (error) {
        console.error("[API] Failed to fetch stacks:", error)
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
    }
}

// DELETE - Delete all card stacks for cleanup/testing
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const walletAddress = searchParams.get('walletAddress')
        const deleteAll = searchParams.get('all') === 'true'

        // If deleteAll flag is set, delete ALL card stacks
        if (deleteAll) {
            const deleted = await prisma.cardStack.deleteMany({})
            console.log(`[API] Deleted ALL ${deleted.count} card stacks`)
            return NextResponse.json({ success: true, deletedCount: deleted.count })
        }

        // Otherwise require wallet address
        const chainId = parseInt(searchParams.get('chainId') || "0")
        if (!walletAddress || !chainId) {
            return NextResponse.json({ success: false, error: "Missing walletAddress or chainId (or use ?all=true)" }, { status: 400 })
        }

        const user = await prisma.user.findUnique({
            where: {
                walletAddress_chainId: {
                    walletAddress: walletAddress,
                    chainId: chainId
                }
            }
        })

        if (!user) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
        }

        // Delete all card stacks for this user (cascade deletes subCards)
        const deleted = await prisma.cardStack.deleteMany({
            where: { userId: user.id }
        })

        console.log(`[API] Deleted ${deleted.count} card stacks for user ${walletAddress}`)
        return NextResponse.json({ success: true, deletedCount: deleted.count })

    } catch (error) {
        console.error("[API] Failed to delete stacks:", error)
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
    }
}
