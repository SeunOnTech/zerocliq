import { NextRequest, NextResponse } from 'next/server'
import { balancesService } from '@/lib/server/services/balances.service'

/**
 * GET /api/balances/[wallet]/[chainId]
 * 
 * Get token balances with USD values for a wallet on a specific chain.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ wallet: string; chainId: string }> }
) {
    try {
        const { wallet, chainId: chainIdStr } = await params

        if (!wallet || !chainIdStr) {
            return NextResponse.json(
                { success: false, error: 'Missing wallet or chainId' },
                { status: 400 }
            )
        }

        const chainId = parseInt(chainIdStr, 10)
        if (isNaN(chainId)) {
            return NextResponse.json(
                { success: false, error: 'chainId must be a valid number' },
                { status: 400 }
            )
        }

        const { searchParams } = new URL(request.url)
        const force = searchParams.get('force') === 'true'

        const tokens = await balancesService.getWalletBalances(wallet, chainId, force)

        // Calculate total USD value
        const totalUsdValue = tokens.reduce(
            (sum: number, token: any) => sum + (token.usdValue || 0),
            0
        )

        return NextResponse.json({
            success: true,
            wallet,
            chainId,
            totalUsdValue,
            tokens,
        })

    } catch (error) {
        console.error('[Balances API] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch balances' },
            { status: 500 }
        )
    }
}
