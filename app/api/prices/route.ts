import { NextRequest, NextResponse } from 'next/server'
import { dexScreenerService } from '@/lib/server/services/dexscreener.service'
import { defillamaService } from '@/lib/server/services/defillama.service'

// Chains that should use DexScreener for pricing (more accurate for newer chains)
const USE_DEXSCREENER_CHAINS = [143] // Monad

/**
 * POST /api/prices
 * Bulk fetch token prices
 * 
 * Body: { tokens: string[], chainId: number }
 * Response: { success: boolean, prices: Record<string, number> }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { tokens, chainId } = body as { tokens: string[], chainId: number }

        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No tokens provided' },
                { status: 400 }
            )
        }

        if (!chainId) {
            return NextResponse.json(
                { success: false, error: 'No chainId provided' },
                { status: 400 }
            )
        }

        // Choose price provider based on chain
        const useDexScreener = USE_DEXSCREENER_CHAINS.includes(chainId)

        let prices: Record<string, number>

        if (useDexScreener) {
            prices = await dexScreenerService.getPrices(tokens, chainId)
        } else {
            prices = await defillamaService.getBatchPrices(tokens, chainId)
        }

        return NextResponse.json({
            success: true,
            prices,
            source: useDexScreener ? 'dexscreener' : 'defillama',
        })

    } catch (error) {
        console.error('[API/prices] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch prices' },
            { status: 500 }
        )
    }
}
