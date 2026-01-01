import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/card-stacks/delete-subcard
 * 
 * Delete a SubCard (strategy) from a CardStack
 */
export async function POST(req: NextRequest) {
    console.log("[API] /delete-subcard called")

    try {
        const body = await req.json()
        const { subCardId } = body

        if (!subCardId) {
            return NextResponse.json({ success: false, error: "subCardId required" }, { status: 400 })
        }

        // Delete the SubCard
        await prisma.subCard.delete({
            where: { id: subCardId }
        })

        console.log(`[API] ✓ SubCard ${subCardId} deleted`)

        return NextResponse.json({
            success: true,
            message: "Subscription deleted successfully"
        })

    } catch (error: any) {
        console.error("[API] Delete SubCard Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to delete subscription"
        }, { status: 500 })
    }
}
