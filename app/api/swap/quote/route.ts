import { NextRequest, NextResponse } from "next/server"
import { swapService } from "@/lib/server/services/swap.service"

/**
 * POST /api/swap/quote
 * 
 * Get swap quote using the multi-DEX aggregator.
 * Handles routing, price impact calculation, and execution data generation.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            chainId,
            tokenIn,
            tokenOut,
            amountIn,
            amountInRaw = true,
            userAddress,
            slippageBps = 50,
            deadline
        } = body

        // Validation
        if (!chainId || !tokenIn || !tokenOut || !amountIn) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required parameters: chainId, tokenIn, tokenOut, amountIn"
                },
                { status: 400 }
            )
        }

        const quote = await swapService.getQuote({
            chainId,
            tokenIn,
            tokenOut,
            amountIn,
            amountInRaw,
            slippageBps,
            userAddress,
            deadline,
        })

        // Log successful quote for monitoring
        if (quote.success && quote.bestRoute) {
            console.log(`[API/swap/quote] ✓ ${quote.bestRoute.dexName} | ${quote.bestRoute.amountOut} out`)
        }

        return NextResponse.json(quote)

    } catch (error) {
        console.error("[API/swap/quote] Error:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        )
    }
}
