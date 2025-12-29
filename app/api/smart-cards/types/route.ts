import { NextResponse } from 'next/server'
import { getSerializedSmartCardTypes } from '@/lib/server/config/smart-card-types'

/**
 * GET /api/smart-cards/types
 * Returns available Smart Card types
 */
export async function GET() {
    try {
        const types = getSerializedSmartCardTypes()

        return NextResponse.json({
            success: true,
            types,
        })
    } catch (error: any) {
        console.error('[/api/smart-cards/types] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch types' },
            { status: 500 }
        )
    }
}
