import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/card-stacks/update-subcard
 * 
 * Update a SubCard (strategy) - status, skipNext, etc.
 */
export async function POST(req: NextRequest) {
    console.log("[API] /update-subcard called")

    try {
        const body = await req.json()
        const { subCardId, status, skipNext } = body

        if (!subCardId) {
            return NextResponse.json({ success: false, error: "subCardId required" }, { status: 400 })
        }

        // Build update data
        const updateData: any = {}

        if (status) {
            updateData.status = status
        }

        if (skipNext) {
            // Get current config and update nextPaymentDate
            const subCard = await prisma.subCard.findUnique({
                where: { id: subCardId }
            })

            if (subCard) {
                const config = subCard.config as any
                const frequency = config?.frequency || 'MONTHLY'
                const currentNextDate = config?.nextPaymentDate ? new Date(config.nextPaymentDate) : new Date()

                // Advance to next payment date
                const newNextDate = new Date(currentNextDate)
                if (frequency === 'WEEKLY') {
                    newNextDate.setDate(newNextDate.getDate() + 7)
                } else {
                    newNextDate.setMonth(newNextDate.getMonth() + 1)
                }

                updateData.config = {
                    ...config,
                    nextPaymentDate: newNextDate.toISOString(),
                    lastSkipped: currentNextDate.toISOString()
                }
            }
        }

        // Update the SubCard
        const updatedSubCard = await prisma.subCard.update({
            where: { id: subCardId },
            data: updateData
        })

        console.log(`[API] ✓ SubCard ${subCardId} updated:`, updateData)

        return NextResponse.json({
            success: true,
            subCard: updatedSubCard,
            message: status === 'PAUSED'
                ? "Subscription paused"
                : status === 'ACTIVE'
                    ? "Subscription resumed"
                    : skipNext
                        ? "Next payment skipped"
                        : "Subscription updated"
        })

    } catch (error: any) {
        console.error("[API] Update SubCard Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to update subscription"
        }, { status: 500 })
    }
}
