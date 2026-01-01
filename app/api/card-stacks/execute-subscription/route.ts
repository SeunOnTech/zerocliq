
import { NextRequest, NextResponse } from "next/server"
import { subscriptionService } from "@/lib/server/services/subscription.service"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/card-stacks/execute-subscription
 * 
 * Dedicated endpoint for Subscription/Recurring Payment execution:
 * 1. Transfer (User -> Agent) via ERC-7715 permission
 * 2. Forward Transfer (Agent -> Recipient)
 */
export async function POST(req: NextRequest) {
    console.log("[API] /execute-subscription called")

    try {
        const body = await req.json()
        const { cardStackId, subCardId, amount, recipientAddress } = body

        // Validate required fields
        if (!cardStackId) {
            return NextResponse.json({ success: false, error: "cardStackId required" }, { status: 400 })
        }
        if (!subCardId) {
            return NextResponse.json({ success: false, error: "subCardId required" }, { status: 400 })
        }
        if (!recipientAddress) {
            return NextResponse.json({ success: false, error: "recipientAddress required" }, { status: 400 })
        }
        if (!amount) {
            return NextResponse.json({ success: false, error: "amount required" }, { status: 400 })
        }

        console.log(`[API] Executing subscription: ${amount} to ${recipientAddress}`)

        // Call the subscription service (trim address to handle copy/paste whitespace)
        const result = await subscriptionService.executeSubscription({
            cardStackId,
            subCardId,
            amount: amount.toString(),
            recipientAddress: recipientAddress.trim()
        })

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error,
                transferTxHash: result.transferTxHash // Return if pull succeeded but payment failed
            }, { status: 500 })
        }

        console.log(`[API] ✓ Subscription payment complete!`)
        console.log(`[API] Pull TX: ${result.transferTxHash}`)
        console.log(`[API] Payment TX: ${result.paymentTxHash}`)

        return NextResponse.json({
            success: true,
            transferTxHash: result.transferTxHash,
            paymentTxHash: result.paymentTxHash,
            amountIn: result.amountIn,
            sourceToken: result.sourceToken,
            recipient: result.recipient,
            label: result.label
        })

    } catch (error: any) {
        console.error("[API] Subscription Execution Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Internal server error"
        }, { status: 500 })
    }
}
