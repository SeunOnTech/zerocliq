import { NextResponse } from 'next/server'
import { getOrComputeSmartAccount } from '@/lib/server/services/smart-account.service'

/**
 * POST /api/smart-account/create
 * 
 * Computes the counterfactual smart account address for a user.
 * This does NOT deploy, just calculates the deterministic address.
 */
export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json()
        const { walletAddress, chainId } = body

        if (!walletAddress || !chainId) {
            return NextResponse.json(
                { success: false, error: 'walletAddress and chainId are required' },
                { status: 400 }
            )
        }

        // Compute or retrieve cached smart account
        const result = await getOrComputeSmartAccount(
            walletAddress,
            chainId,
            `Chain ${chainId}`
        )

        return NextResponse.json({
            success: true,
            smartAccountAddress: result.address,
            status: result.isDeployed ? 'deployed' : 'not_deployed',
            isDeployed: result.isDeployed,
            cached: result.cached,
        })
    } catch (error) {
        console.error('[/api/smart-account/create] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
