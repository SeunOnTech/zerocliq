import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/smart-cards/[id]
 * Delete a Smart Card by ID
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Smart Card ID is required' },
                { status: 400 }
            )
        }

        // Check if card exists
        const existingCard = await prisma.smartCard.findUnique({
            where: { id }
        })

        if (!existingCard) {
            return NextResponse.json(
                { success: false, error: 'Smart Card not found' },
                { status: 404 }
            )
        }

        // Delete the card
        await prisma.smartCard.delete({
            where: { id }
        })

        console.log(`[/api/smart-cards/${id}] Deleted Smart Card`)

        return NextResponse.json({
            success: true,
            message: 'Smart Card deleted successfully',
            deletedId: id,
        })
    } catch (error: any) {
        console.error('[/api/smart-cards/[id]] Delete error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to delete Smart Card' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/smart-cards/[id]
 * Get a Smart Card by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Smart Card ID is required' },
                { status: 400 }
            )
        }

        const smartCard = await prisma.smartCard.findUnique({
            where: { id }
        })

        if (!smartCard) {
            return NextResponse.json(
                { success: false, error: 'Smart Card not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            smartCard,
        })
    } catch (error: any) {
        console.error('[/api/smart-cards/[id]] Get error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to get Smart Card' },
            { status: 500 }
        )
    }
}
