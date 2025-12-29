import { NextResponse } from 'next/server'
import { getActiveChains } from '@/lib/server/config/chains'

/**
 * GET /api/chains
 * Returns all active chain configurations with their tokens
 */
export async function GET() {
    try {
        const chains = getActiveChains()

        // Map to the expected format
        const formattedChains = chains.map((chain) => ({
            key: chain.key,
            id: chain.id,
            name: chain.name,
            rpcUrl: chain.rpcUrl,
            bundlerUrl: chain.bundlerUrl,
            nativeCurrency: chain.nativeCurrency,
            explorerUrl: chain.explorerUrl,
            logoUrl: chain.logourl,
            tokens: chain.tokens,
        }))

        return NextResponse.json({
            success: true,
            chains: formattedChains,
        })
    } catch (error) {
        console.error('[API/chains] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch chains' },
            { status: 500 }
        )
    }
}
