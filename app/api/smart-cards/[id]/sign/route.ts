import { NextRequest, NextResponse } from 'next/server'
import { smartCardService } from '@/lib/server/services/smart-card.service'

/**
 * POST /api/smart-cards/[id]/sign
 * Submit signature to activate a Smart Card
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        if (!body.signature) {
            return NextResponse.json(
                { success: false, error: 'signature is required' },
                { status: 400 }
            )
        }

        console.log('[/api/smart-cards/sign] Activating card:', id)

        const updatedCard = await smartCardService.updateSignature(id, body.signature)

        console.log('[/api/smart-cards/sign] Activated:', id)

        return NextResponse.json({
            success: true,
            smartCard: updatedCard,
        })
    } catch (error: any) {
        console.error('[/api/smart-cards/sign] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to activate Smart Card' },
            { status: 500 }
        )
    }
}
