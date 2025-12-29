import { NextRequest, NextResponse } from 'next/server'
import { getAgentSmartAccountAddress } from '@/lib/server/services/smart-card.service'

/**
 * GET /api/smart-cards/agent-address
 * Get Agent Smart Account address for gasless delegation
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const chainIdStr = searchParams.get('chainId')

        if (!chainIdStr) {
            return NextResponse.json(
                { success: false, error: 'chainId is required' },
                { status: 400 }
            )
        }

        const chainId = parseInt(chainIdStr, 10)
        if (isNaN(chainId)) {
            return NextResponse.json(
                { success: false, error: 'chainId must be a valid number' },
                { status: 400 }
            )
        }

        const agentAddress = await getAgentSmartAccountAddress(chainId)

        return NextResponse.json({
            success: true,
            agentSmartAccountAddress: agentAddress,
            agentAddress, // Also include for backwards compatibility
            chainId,
        })
    } catch (error: any) {
        console.error('[/api/smart-cards/agent-address] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to get agent address' },
            { status: 500 }
        )
    }
}
