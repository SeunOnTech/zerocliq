import { NextRequest, NextResponse } from "next/server"
import { swapService } from "@/lib/server/services/swap.service"
import { getChainById } from "@/lib/server/config/chains"
import { createPublicClient, http } from "viem"
import { dexPlugins } from "@/lib/server/dexes/index"

/**
 * POST /api/swap/build
 * 
 * Build swap execution calldata from a quote.
 * Returns the transaction data needed to execute the swap.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            chainId,
            quote, // The full quote response from /api/swap/quote
            recipient,
            slippageBps = 50,
        } = body

        // Validation
        if (!chainId || !quote || !quote.bestRoute) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required parameters: chainId, quote (with bestRoute)"
                },
                { status: 400 }
            )
        }

        const chain = getChainById(chainId)
        if (!chain) {
            return NextResponse.json(
                { success: false, error: `Unsupported chainId: ${chainId}` },
                { status: 400 }
            )
        }

        // Find the token info
        const tokenIn = chain.tokens.find(
            t => t.address.toLowerCase() === quote.request.tokenIn.toLowerCase()
        )
        if (!tokenIn) {
            return NextResponse.json(
                { success: false, error: `TokenIn not found: ${quote.request.tokenIn}` },
                { status: 400 }
            )
        }

        // Find the plugin
        const bestRoute = quote.bestRoute
        const plugin = dexPlugins.find(p => p.id === bestRoute.dexId) as any
        if (!plugin) {
            return NextResponse.json(
                { success: false, error: `Plugin not found: ${bestRoute.dexId}` },
                { status: 400 }
            )
        }

        if (!plugin.buildSwapCalldata) {
            return NextResponse.json(
                { success: false, error: `Plugin ${plugin.name} doesn't support execution` },
                { status: 400 }
            )
        }

        // Build the swap calldata
        const lastHop = bestRoute.hops[bestRoute.hops.length - 1]
        const minAmountOut = BigInt(bestRoute.minAmountOut)

        const swapCalldata = await plugin.buildSwapCalldata({
            chainId,
            tokenIn: tokenIn.address as `0x${string}`,
            tokenOut: lastHop.path[lastHop.path.length - 1] as `0x${string}`,
            amountIn: BigInt(bestRoute.hops[0]?.amountIn || quote.request.amountIn),
            minAmountOut,
            recipient: recipient as `0x${string}`,
            deadline: Math.floor(Date.now() / 1000) + 1800, // 30 min
            hops: bestRoute.hops,
        })

        console.log(`[API/swap/build] ✓ Built calldata for ${plugin.name}`)

        return NextResponse.json({
            success: true,
            calldata: {
                to: swapCalldata.to,
                data: swapCalldata.data,
                value: swapCalldata.value.toString(),
            },
            dex: plugin.name,
        })

    } catch (error) {
        console.error("[API/swap/build] Error:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        )
    }
}
