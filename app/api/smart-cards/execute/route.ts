import { NextRequest, NextResponse } from 'next/server'
import { smartCardService } from '@/lib/server/services/smart-card.service'

// Extend timeout for Vercel (swap execution can take 30-60 seconds)
export const maxDuration = 60

/**
 * POST /api/smart-cards/execute
 * Execute a swap using a Smart Card (gasless via Pimlico)
 * 
 * Body: { smartCardId: string, quote: SwapQuote }
 * Returns: { success: boolean, transactionHash?: string, error?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Validate required fields
        if (!body.smartCardId) {
            return NextResponse.json(
                { success: false, error: 'smartCardId is required' },
                { status: 400 }
            )
        }

        if (!body.quote) {
            return NextResponse.json(
                { success: false, error: 'quote is required' },
                { status: 400 }
            )
        }

        console.log('[/api/smart-cards/execute] Executing swap:', {
            smartCardId: body.smartCardId,
            tokenIn: body.quote?.request?.tokenIn,
            tokenOut: body.quote?.request?.tokenOut,
            amountIn: body.quote?.request?.amountIn,
        })

        const result = await smartCardService.executeSwap(
            body.smartCardId,
            body.quote
        )

        console.log('[/api/smart-cards/execute] Success:', result.transactionHash)

        return NextResponse.json({
            success: true,
            transactionHash: result.transactionHash,
            approvalHash: result.approvalHash,
            gasSponsored: result.gasSponsored ?? true,
        })

    } catch (error: any) {
        console.error('[/api/smart-cards/execute] Error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Swap execution failed',
            },
            { status: 500 }
        )
    }
}
