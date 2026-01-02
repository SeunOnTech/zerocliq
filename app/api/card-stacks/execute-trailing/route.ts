import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { dcaService } from "@/lib/server/services/dca.service"
import { logTrailingStopActivity } from "@/lib/server/services/activity.service"
import { notifyTrailingStopExecuted } from "@/lib/server/services/notification.service"

/**
 * POST /api/card-stacks/execute-trailing
 * 
 * Orchestrates Trailing Stop execution (Sell Token -> Stablecoin)
 */
export async function POST(req: NextRequest) {
    console.log("[API] /execute-trailing called")

    try {
        const { cardStackId, subCardId, amount } = await req.json()

        if (!cardStackId) {
            return NextResponse.json({ success: false, error: "cardStackId required" }, { status: 400 })
        }

        // Needs full stack with subcards
        const stack = await prisma.cardStack.findUnique({
            where: { id: cardStackId },
            include: {
                user: true,
                subCards: true, // Required for subCard lookup
            }
        })

        if (!stack || !stack.user) return NextResponse.json({ success: false, error: "Stack or User not found" }, { status: 404 })

        // Call the orchestration method (Reusing DCA service which handles Transfer -> Swap)
        // For Trailing Stop: Source = Stack Token, Target = Configured Target (Stable)
        const result = await dcaService.executeFullDCA({
            cardStackId,
            subCardId,
            amount: amount?.toString(),
            recipientAddress: stack.user.walletAddress, // Send USDC back to user
            suppressLogs: true // We handle specific logging for Trailing Stop below
        })

        if (!result.success && !result.transferTxHash) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 })
        }

        if (result.success || result.transferTxHash) {
            try {
                // Fix: Access chainId from user relation, CardStack lacks it directly
                const chainId = stack.user.chainId
                const walletAddress = stack.user.walletAddress

                // Match SubCard to get correct target decimals (usually 6 for USDC)
                const subCard = stack.subCards.find((s: any) => s.id === subCardId)
                const targetDecimals = (subCard?.config as any)?.targetTokenDecimals || 18

                const amountIn = result.amountIn ? (Number(result.amountIn) / Math.pow(10, stack.tokenDecimals)).toFixed(4) : amount.toString()
                const amountOut = result.amountOut ? (Number(result.amountOut) / Math.pow(10, targetDecimals)).toFixed(2) : '0.00'
                const targetToken = result.targetToken || (subCard?.config as any)?.targetTokenSymbol || 'USDC'

                // Fix: CardStack has no 'name' field, construct it
                const stackName = `Trailing Stop ${stack.tokenSymbol}`

                // Log using dedicated Trailing Stop helper
                await logTrailingStopActivity(walletAddress, chainId, {
                    status: 'SUCCESS',
                    stackName: stackName,
                    amountIn,
                    amountOut,
                    tokenIn: stack.tokenSymbol,
                    tokenOut: targetToken,
                    txHash: result.swapTxHash || result.transferTxHash
                })

                // Verify and notify
                await notifyTrailingStopExecuted(walletAddress, chainId, {
                    stackName: stackName, // Use constructed name
                    amountIn,
                    amountOut,
                    tokenIn: stack.tokenSymbol,
                    tokenOut: targetToken,
                    txHash: result.swapTxHash || result.transferTxHash || ''
                })

                console.log("[API] ✓ Logged Trailing Stop execution activity")
            } catch (activityError) {
                console.error("[API] Failed to log activity:", activityError)
            }
        }

        return NextResponse.json({
            ...result,
            success: result.success
        })

    } catch (error: any) {
        console.error("[API] Trailing Stop Execution Error:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Internal server error"
        }, { status: 500 })
    }
}
