/**
 * GET /api/notifications
 * POST /api/notifications
 * 
 * Fetch notifications for a user or create a new notification.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
    getNotifications,
    getUnreadCount,
    createNotification,
} from '@/lib/server/services/notification.service'
import { NotificationType } from '@prisma/client'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const walletAddress = searchParams.get('walletAddress')
        const chainId = searchParams.get('chainId')
        const limit = searchParams.get('limit')
        const cursor = searchParams.get('cursor')
        const unreadOnly = searchParams.get('unreadOnly') === 'true'
        const countOnly = searchParams.get('countOnly') === 'true'

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

        // If only count is requested, return just the count
        if (countOnly) {
            const count = await getUnreadCount(walletAddress, chainIdNum)
            return NextResponse.json({ success: true, unreadCount: count })
        }

        // Fetch paginated notifications
        const result = await getNotifications(walletAddress, chainIdNum, {
            limit: limit ? parseInt(limit, 10) : 50,
            cursor: cursor || undefined,
            unreadOnly,
        })

        // Also get unread count for badge
        const unreadCount = await getUnreadCount(walletAddress, chainIdNum)

        return NextResponse.json({
            success: true,
            notifications: result.notifications,
            nextCursor: result.nextCursor,
            unreadCount,
        })
    } catch (error) {
        console.error('[API/notifications] GET Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch notifications' },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { walletAddress, chainId, type, title, message, metadata } = body

        if (!walletAddress || !chainId || !type || !title || !message) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: walletAddress, chainId, type, title, message' },
                { status: 400 }
            )
        }

        // Validate notification type
        const validTypes: NotificationType[] = [
            'TRANSFER_SUCCESS', 'TRANSFER_FAILED',
            'SMART_ACCOUNT_FUNDED', 'SMART_ACCOUNT_DEPLOYED',
            'SWAP_SUCCESS', 'SWAP_FAILED', 'SWAP_PENDING',
            'BRIDGE_SUCCESS', 'BRIDGE_FAILED',
            'CARD_STACK_CREATED', 'CARD_STACK_EXPIRED',
            'DCA_EXECUTED', 'DCA_FAILED',
            'PERMISSION_EXPIRING', 'PERMISSION_EXPIRED',
            'SYSTEM_ALERT', 'SYSTEM_INFO'
        ]

        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            )
        }

        const notification = await createNotification({
            walletAddress,
            chainId: parseInt(chainId, 10),
            type,
            title,
            message,
            metadata: metadata || {},
        })

        return NextResponse.json({
            success: true,
            notification,
        })
    } catch (error) {
        console.error('[API/notifications] POST Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create notification' },
            { status: 500 }
        )
    }
}
