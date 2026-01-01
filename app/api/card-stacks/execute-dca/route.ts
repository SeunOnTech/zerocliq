
import { NextRequest, NextResponse } from "next/server"
import { dcaService } from "@/lib/server/services/dca.service"
import { prisma } from "@/lib/prisma"
import { logLimitOrderExecuteActivity, logDCAExecutionActivity } from "@/lib/server/services/activity.service"
import { notifyLimitOrderExecuted, notifyDCAExecuted } from "@/lib/server/services/notification.service"

/**
 * POST /api/card-stacks/execute-dca
 * 
 * Orchestrates the full DCA/Limit Order execution flow:
 * 1. Transfer (User -> Agent)
 * 2. Swap (Agent -> Target Token)
 */
export async function POST(req: NextRequest) {
    console.log("[API] /execute-dca called")

    try {
        const body = await req.json()
        const { cardStackId, subCardId, amount, recipientAddress, isLimitOrder } = body

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

        // Track activity and create notification on success
        if (result.success) {
            try {
                // Get stack info for activity tracking
                const stack = await prisma.cardStack.findUnique({
                    where: { id: cardStackId },
                    include: { user: true, subCards: { where: { id: subCardId } } }
                })

                if (stack) {
                    const walletAddress = stack.user.walletAddress
                    const chainId = stack.user.chainId
                    const subCard = stack.subCards[0]
                    const targetToken = (subCard?.config as any)?.targetTokenSymbol || result.targetToken
                    const amountIn = result.amountIn ? (Number(result.amountIn) / Math.pow(10, stack.tokenDecimals)).toFixed(6) : amount
                    const amountOut = result.amountOut ? (Number(result.amountOut) / Math.pow(10, 18)).toFixed(6) : '0'

                    if (isLimitOrder) {
                        // Track limit order execution
                        await logLimitOrderExecuteActivity(walletAddress, chainId, {
                            status: 'SUCCESS',
                            targetToken,
                            amountIn,
                            amountOut,
                            sourceToken: stack.tokenSymbol,
                            txHash: result.swapTxHash
                        })

                        await notifyLimitOrderExecuted(walletAddress, chainId, {
                            targetToken,
                            amountIn,
                            amountOut,
                            sourceToken: stack.tokenSymbol,
                            txHash: result.swapTxHash || result.transferTxHash || ''
                        })

                        console.log("[API] ✓ Logged limit order execution activity and notification")
                    } else {
                        // Track DCA execution
                        await logDCAExecutionActivity(walletAddress, chainId, {
                            status: 'SUCCESS',
                            stackName: `${stack.tokenSymbol} Stack`,
                            amount: amountIn,
                            token: targetToken,
                            txHash: result.swapTxHash
                        })

                        await notifyDCAExecuted(walletAddress, chainId, {
                            stackName: `${stack.tokenSymbol} Stack`,
                            amount: amountIn,
                            token: targetToken,
                            txHash: result.swapTxHash || result.transferTxHash || ''
                        })

                        console.log("[API] ✓ Logged DCA execution activity and notification")
                    }
                }
            } catch (activityError) {
                // Don't fail the request if activity logging fails
                console.error("[API] Failed to log activity/notification:", activityError)
            }
        }

        // Return combined result (transfer + potentially swap)
        const { success: _, ...resultWithoutSuccess } = result
        return NextResponse.json({
            success: result.success,
            ...resultWithoutSuccess
        })

    } catch (error: any) {
        console.error("[API] DCA Execution Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Internal server error"
        }, { status: 500 })
    }
}
