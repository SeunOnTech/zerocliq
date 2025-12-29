import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Helper function to delete all stacks
async function cleanupAllStacks() {
    // Delete SubCards first (foreign key constraint)
    const subCardResult = await prisma.subCard.deleteMany({})
    // Then delete CardStacks
    const stackResult = await prisma.cardStack.deleteMany({})

    return {
        subCards: subCardResult.count,
        cardStacks: stackResult.count
    }
}

// GET /api/debug/cleanup-stacks - Delete all CardStacks (DEV ONLY) - Browser accessible
export async function GET() {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
    }

    try {
        const deleted = await cleanupAllStacks()
        return NextResponse.json({ success: true, deleted })
    } catch (error) {
        console.error("Cleanup failed:", error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// DELETE /api/debug/cleanup-stacks - Delete all CardStacks (DEV ONLY)
export async function DELETE() {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
    }

    try {
        const deleted = await cleanupAllStacks()
        return NextResponse.json({ success: true, deleted })
    } catch (error) {
        console.error("Cleanup failed:", error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
