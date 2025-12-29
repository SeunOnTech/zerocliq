/**
 * GET /api/activity
 * POST /api/activity
 * 
 * Fetch activities for a user or log a new activity.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
    getActivities,
    logActivity,
    getActivityStats,
} from '@/lib/server/services/activity.service'
import { ActivityType, ActivityStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const walletAddress = searchParams.get('walletAddress')
        const chainId = searchParams.get('chainId')
        const limit = searchParams.get('limit')
        const cursor = searchParams.get('cursor')
        const type = searchParams.get('type') as ActivityType | null
        const status = searchParams.get('status') as ActivityStatus | null
        const statsOnly = searchParams.get('statsOnly') === 'true'

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

        // If only stats are requested
        if (statsOnly) {
            const stats = await getActivityStats(walletAddress, chainIdNum)
            return NextResponse.json({ success: true, stats })
        }

        // Fetch paginated activities
        const result = await getActivities(walletAddress, chainIdNum, {
            limit: limit ? parseInt(limit, 10) : 50,
            cursor: cursor || undefined,
            type: type || undefined,
            status: status || undefined,
        })

        return NextResponse.json({
            success: true,
            activities: result.activities,
            nextCursor: result.nextCursor,
        })
    } catch (error) {
        console.error('[API/activity] GET Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch activities' },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { walletAddress, chainId, type, status, title, description, metadata, txHash } = body

        if (!walletAddress || !chainId || !type || !status || !title || !description) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: walletAddress, chainId, type, status, title, description' },
                { status: 400 }
            )
        }

        // Validate activity type
        const validTypes: ActivityType[] = [
            'SWAP', 'TRANSFER', 'SMART_ACCOUNT_DEPLOY', 'SMART_ACCOUNT_FUND',
            'CARD_STACK_CREATE', 'CARD_STACK_PAUSE', 'CARD_STACK_RESUME',
            'DCA_EXECUTION', 'APPROVAL', 'BRIDGE'
        ]

        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            )
        }

        // Validate activity status
        const validStatuses: ActivityStatus[] = ['PENDING', 'SUCCESS', 'FAILED']
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            )
        }

        const activity = await logActivity({
            walletAddress,
            chainId: parseInt(chainId, 10),
            type,
            status,
            title,
            description,
            metadata: metadata || {},
            txHash: txHash || undefined,
        })

        return NextResponse.json({
            success: true,
            activity,
        })
    } catch (error) {
        console.error('[API/activity] POST Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to log activity' },
            { status: 500 }
        )
    }
}
