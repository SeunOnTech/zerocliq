/**
 * PATCH /api/notifications/mark-all
 * 
 * Mark all notifications as read for a user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { markAllAsRead } from '@/lib/server/services/notification.service'

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json()
        const { walletAddress, chainId } = body

        if (!walletAddress || !chainId) {
            return NextResponse.json(
                { success: false, error: 'walletAddress and chainId are required' },
                { status: 400 }
            )
        }

        const chainIdNum = parseInt(chainId, 10)
        if (isNaN(chainIdNum)) {
            return NextResponse.json(
                { success: false, error: 'Invalid chainId' },
                { status: 400 }
            )
        }

        const count = await markAllAsRead(walletAddress, chainIdNum)

        return NextResponse.json({
            success: true,
            markedCount: count,
        })
    } catch (error) {
        console.error('[API/notifications/mark-all] PATCH Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to mark all notifications as read' },
            { status: 500 }
        )
    }
}
