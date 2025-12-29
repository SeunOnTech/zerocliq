import { NextResponse } from 'next/server'
import {
    getOrComputeSmartAccount,
    refreshSmartAccountStatus,
} from '@/lib/server/services/smart-account.service'

/**
 * POST /api/smart-account/compute
 * 
 * Computes (or refreshes) the smart account address and status.
 * 
 * This endpoint:
 * 1. Computes the deterministic smart account address
 * 2. Checks on-chain if it's deployed
 * 3. Caches the result in the database
 * 4. Returns the current status
 */
export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json()
        const { walletAddress, chainId, forceRefresh = false } = body

        // Validate required fields
        if (!walletAddress || !chainId) {
            return NextResponse.json(
                { success: false, error: 'walletAddress and chainId are required' },
                { status: 400 }
            )
        }

        // If forceRefresh, recompute on-chain status
        if (forceRefresh) {
            console.log('[/api/smart-account/compute] Force refreshing status...')
            try {
                await refreshSmartAccountStatus(walletAddress, chainId)
            } catch (refreshError) {
                console.warn('[/api/smart-account/compute] Refresh failed:', refreshError)
            }
        }

        // Compute or retrieve cached smart account
        const result = await getOrComputeSmartAccount(
            walletAddress,
            chainId,
            `Chain ${chainId}`
        )

        return NextResponse.json({
            success: true,
            smartAccount: {
                address: result.address,
                isDeployed: result.isDeployed,
                status: result.isDeployed ? 'deployed' : 'not_deployed',
            },
            cached: result.cached,
        })
    } catch (error) {
        console.error('[/api/smart-account/compute] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
