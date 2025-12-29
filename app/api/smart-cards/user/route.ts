import { NextRequest, NextResponse } from 'next/server'
import { smartCardService } from '@/lib/server/services/smart-card.service'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/smart-cards/user
 * Get all Smart Cards for a user
 * 
 * NOTE: userId can be either:
 * - A wallet address (from frontend - needs lookup)
 * - A database user ID
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const chainIdStr = searchParams.get('chainId')
        const type = searchParams.get('type')

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            )
        }

        const chainId = chainIdStr ? parseInt(chainIdStr, 10) : undefined

        console.log('[/api/smart-cards/user] Query params:', { userId, chainId, type })

        // Check if userId is a wallet address (starts with 0x)
        let actualUserId = userId
        if (userId.startsWith('0x')) {
            console.log('[/api/smart-cards/user] userId is wallet address, looking up user...')

            // Find user by wallet address and chainId
            const user = await prisma.user.findFirst({
                where: {
                    walletAddress: { equals: userId, mode: 'insensitive' },
                    ...(chainId && { chainId }),
                },
            })

            if (user) {
                console.log('[/api/smart-cards/user] Found user:', {
                    id: user.id,
                    walletAddress: user.walletAddress,
                    chainId: user.chainId
                })
                actualUserId = user.id
            } else {
                console.log('[/api/smart-cards/user] No user found for wallet:', userId)

                // Debug: List all users in database
                const allUsers = await prisma.user.findMany({
                    select: { id: true, walletAddress: true, chainId: true },
                    take: 10
                })
                console.log('[/api/smart-cards/user] DEBUG - All users in DB:', allUsers)

                return NextResponse.json({
                    success: true,
                    smartCards: [],
                })
            }
        }

        console.log('[/api/smart-cards/user] Fetching cards for userId:', actualUserId, 'chainId:', chainId)

        const smartCards = await smartCardService.getUserSmartCards(actualUserId, chainId)

        console.log('[/api/smart-cards/user] Found:', smartCards.length, 'cards')

        if (smartCards.length > 0) {
            console.log('[/api/smart-cards/user] Cards:', smartCards.map(c => ({
                id: c.id,
                type: c.type,
                status: c.status,
                userId: c.userId
            })))
        } else {
            // Debug: List all smart cards in database
            const allCards = await prisma.smartCard.findMany({
                select: { id: true, userId: true, chainId: true, type: true, status: true },
                take: 10
            })
            console.log('[/api/smart-cards/user] DEBUG - All cards in DB:', allCards)
        }

        // Filter by type if specified
        const filteredCards = type
            ? smartCards.filter((card: any) => card.type === type)
            : smartCards

        return NextResponse.json({
            success: true,
            smartCards: filteredCards,
        })
    } catch (error: any) {
        console.error('[/api/smart-cards/user] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to get smart cards' },
            { status: 500 }
        )
    }
}
