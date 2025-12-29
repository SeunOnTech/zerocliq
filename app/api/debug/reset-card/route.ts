import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        console.log('[Debug] Deleting all TRADING Smart Cards to reset state...')

        // Delete all TRADING cards to force re-creation
        const { count } = await prisma.smartCard.deleteMany({
            where: { type: 'TRADING' }
        })

        console.log(`[Debug] Deleted ${count} cards`)

        return NextResponse.json({
            success: true,
            message: `Deleted ${count} Trade Cards. You can now refresh the app to re-create them.`,
            deleted: count
        })
    } catch (error) {
        console.error('[Debug] Reset failed:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
