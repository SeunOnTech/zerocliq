import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Delete ALL card stacks (for testing/cleanup)
export async function GET() {
    try {
        // Delete all SubCards first (due to foreign key)
        await prisma.subCard.deleteMany({})

        // Then delete all CardStacks
        const deleted = await prisma.cardStack.deleteMany({})

        console.log(`[API] Deleted ALL ${deleted.count} card stacks`)
        return NextResponse.json({
            success: true,
            message: `Deleted ${deleted.count} card stacks and all sub-cards`,
            deletedCount: deleted.count
        })

    } catch (error) {
        console.error("[API] Failed to delete all stacks:", error)
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
    }
}
