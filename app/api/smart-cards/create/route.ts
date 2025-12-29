import { NextRequest, NextResponse } from 'next/server'
import { smartCardService } from '@/lib/server/services/smart-card.service'

/**
 * POST /api/smart-cards/create
 * Create a new Smart Card with type-based delegation
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        console.log('[/api/smart-cards/create] Creating card:', {
            userId: body.userId,
            chainId: body.chainId,
            type: body.type,
        })

        // Validate required fields
        if (!body.userId || !body.chainId || !body.type) {
            return NextResponse.json(
                { success: false, error: 'userId, chainId, and type are required' },
                { status: 400 }
            )
        }

        if (!body.delegatorAddress || !body.delegateAddress) {
            return NextResponse.json(
                { success: false, error: 'delegatorAddress and delegateAddress are required' },
                { status: 400 }
            )
        }

        const result = await smartCardService.createSmartCard({
            userId: body.userId,
            chainId: body.chainId,
            type: body.type,
            delegatorAddress: body.delegatorAddress,
            delegateAddress: body.delegateAddress,
            name: body.name,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        })

        console.log('[/api/smart-cards/create] Created:', result.smartCard.id)

        return NextResponse.json({
            success: true,
            smartCardId: result.smartCard.id,
            smartCard: result.smartCard,
            delegation: result.delegation,
            type: result.type,
            name: result.name,
        })
    } catch (error: any) {
        console.error('[/api/smart-cards/create] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to create Smart Card' },
            { status: 500 }
        )
    }
}
