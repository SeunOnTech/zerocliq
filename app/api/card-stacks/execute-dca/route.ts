
import { NextRequest, NextResponse } from "next/server"
import { dcaService } from "@/lib/server/services/dca.service"

/**
 * POST /api/card-stacks/execute-dca
 * 
 * Orchestrates the full DCA flow:
 * 1. Transfer (User -> Agent)
 * 2. Swap (Agent -> Target Token)
 */
export async function POST(req: NextRequest) {
    console.log("[API] /execute-dca called")

    try {
        const body = await req.json()
        const { cardStackId, subCardId, amount, recipientAddress } = body

        if (!cardStackId) {
            return NextResponse.json({ success: false, error: "cardStackId required" }, { status: 400 })
        }

        // Call the new orchestration method
        const result = await dcaService.executeFullDCA({
            cardStackId,
            subCardId,
            amount: amount?.toString(), // Ensure string
            recipientAddress
        })

        if (!result.success && !result.transferTxHash) {
            // Failed before transfer complete
            return NextResponse.json({ success: false, error: result.error }, { status: 500 })
        }

        // Return combined result (transfer + potentially swap)
        return NextResponse.json({
            success: result.success, // True if at least transfer worked? No, strict success
            ...result
        })

    } catch (error: any) {
        console.error("[API] DCA Execution Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Internal server error"
        }, { status: 500 })
    }
}
