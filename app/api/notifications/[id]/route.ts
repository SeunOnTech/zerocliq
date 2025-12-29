/**
 * PATCH /api/notifications/[id]
 * 
 * Mark a single notification as read.
 */

import { NextRequest, NextResponse } from 'next/server'
import { markAsRead } from '@/lib/server/services/notification.service'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Notification ID is required' },
                { status: 400 }
            )
        }

        await markAsRead(id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API/notifications/[id]] PATCH Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to mark notification as read' },
            { status: 500 }
        )
    }
}
