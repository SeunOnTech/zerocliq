import { NextResponse } from 'next/server'
import type { SyncUserRequest, SyncUserResponse, SmartAccountInfo } from '@/types/user'
import {
    createOrUpdateUserSmartAccount,
    getUserSmartAccount,
} from '@/lib/server/services/user.service'
import {
    getOrComputeSmartAccount,
    refreshSmartAccountStatus,
} from '@/lib/server/services/smart-account.service'

/**
 * POST /api/users/sync
 * 
 * Sync user with database and compute smart account.
 * Replaces proxy to backend /users/upsert endpoint.
 */
export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json()
        const { walletAddress, chainId, chainName, forceRefresh } = body as SyncUserRequest & { forceRefresh?: boolean }

        // Validate required fields
        if (!walletAddress || !chainId) {
            return NextResponse.json(
                { success: false, error: 'walletAddress and chainId are required' },
                { status: 400 }
            )
        }

        console.log('[/api/users/sync] Syncing user:', walletAddress, chainId)

        // 1. Create or update user (without smart account initially)
        const user = await createOrUpdateUserSmartAccount({
            walletAddress,
            chainId,
            chainName: chainName || `Chain ${chainId}`,
        })

        // 2. If forceRefresh, recompute smart account status
        if (forceRefresh) {
            console.log('[/api/users/sync] Force refreshing smart account status...')
            try {
                await refreshSmartAccountStatus(walletAddress, chainId)
            } catch (refreshError) {
                console.warn('[/api/users/sync] Force refresh failed:', refreshError)
                // Continue anyway
            }
        }

        // 3. Get or compute smart account
        const smartAccountResult = await getOrComputeSmartAccount(
            walletAddress,
            chainId,
            { forceRefresh }
        )

        // 4. Build smart account info for response
        let smartAccount: SmartAccountInfo | undefined = undefined
        let smartAccountAddress: `0x${string}` | null = user.smartAccountAddress as `0x${string}` | null
        let smartAccountStatus: 'NONE' | 'COUNTERFACTUAL' | 'DEPLOYED' = (user.smartAccountStatus || 'NONE') as 'NONE' | 'COUNTERFACTUAL' | 'DEPLOYED'

        if (smartAccountResult.success && smartAccountResult.smartAccount) {
            smartAccount = {
                address: smartAccountResult.smartAccount.address,
                status: smartAccountResult.smartAccount.status,
                isDeployed: smartAccountResult.smartAccount.isDeployed,
                deploymentTxHash: smartAccountResult.smartAccount.deploymentTxHash,
            }
            // Use the freshest data from smartAccountResult
            smartAccountAddress = smartAccountResult.smartAccount.address
            smartAccountStatus = smartAccountResult.smartAccount.status
        }

        const response: SyncUserResponse = {
            success: true,
            user: {
                id: user.id,
                walletAddress: user.walletAddress as `0x${string}`,
                chainId: user.chainId,
                chainName: user.chainName,
                avatarUrl: user.avatarUrl,
                smartAccountAddress,
                smartAccountStatus,
                onboardingStep: user.onboardingStep || 1,
                hasCompletedOnboarding: user.hasCompletedOnboarding || false,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
            },
            smartAccount,
        }

        console.log('[/api/users/sync] Synced:', {
            userId: user.id,
            smartAccount: smartAccount?.address,
            isDeployed: smartAccount?.isDeployed,
        })

        return NextResponse.json(response)
    } catch (error) {
        console.error('[/api/users/sync] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
