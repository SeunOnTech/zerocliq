import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/card-stacks/update
 * 
 * Update an existing CardStack's budget and permissions
 */
export async function POST(req: NextRequest) {
    console.log("[API] /card-stacks/update called")

    try {
        const body = await req.json()
        const { stackId, totalBudget, periodDuration, permissionsContext } = body

        if (!stackId || !totalBudget || !periodDuration || !permissionsContext) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
        }

        // Determine Period Enum
        let period = 'DAILY'
        if (periodDuration === 604800) period = 'WEEKLY'
        if (periodDuration === 2592000) period = 'MONTHLY'

        // Update the Stack
        const stack = await prisma.cardStack.update({
            where: { id: stackId },
            data: {
                totalBudget: totalBudget.toString(),
                periodDuration: parseInt(periodDuration.toString()),

                permissionsContext, // The new signed permission
                // We might want to update updatedAt too

            }
        })

        console.log(`[API] ✓ CardStack ${stackId} updated with new budget: ${totalBudget}`)

        return NextResponse.json({
            success: true,
            message: "Stack updated successfully",
            stack
        })

    } catch (error: any) {
        console.error("[API] Update Stack Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to update stack"
        }, { status: 500 })
    }
}
