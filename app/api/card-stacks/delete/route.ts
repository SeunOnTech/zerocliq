import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/card-stacks/delete
 * 
 * Delete a CardStack and all its strategies
 */
export async function POST(req: NextRequest) {
    console.log("[API] /card-stacks/delete called")

    try {
        const body = await req.json()
        const { stackId } = body

        if (!stackId) {
            return NextResponse.json({ success: false, error: "stackId required" }, { status: 400 })
        }

        // Use transaction to ensure everything is deleted cleanly
        await prisma.$transaction([
            // 1. Delete all strategies (SubCards)
            prisma.subCard.deleteMany({
                where: { cardStackId: stackId }
            }),
            // 2. Delete the Stack itself
            prisma.cardStack.delete({
                where: { id: stackId }
            })
        ])

        console.log(`[API] ✓ CardStack ${stackId} deleted`)

        return NextResponse.json({
            success: true,
            message: "Stack deleted successfully"
        })

    } catch (error: any) {
        console.error("[API] Delete Stack Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to delete stack"
        }, { status: 500 })
    }
}
