import type { Address, Hex } from 'viem'

/**
 * Smart Account deployment status
 */
export type SmartAccountStatus = 'NONE' | 'COUNTERFACTUAL' | 'DEPLOYED'

/**
 * Smart Account info returned from backend
 */
export interface SmartAccountInfo {
    address: Address | null
    status: SmartAccountStatus
    isDeployed: boolean
    deploymentTxHash?: Hex | null
}

/**
 * User profile as stored in the database
 */
export interface UserProfile {
    id: string
    walletAddress: Address
    chainId: number
    chainName: string | null
    avatarUrl: string | null
    smartAccountAddress: Address | null
    smartAccountStatus: SmartAccountStatus
    onboardingStep: number
    hasCompletedOnboarding: boolean
    createdAt: string
    updatedAt: string
}

/**
 * Request body for syncing user to database
 */
export interface SyncUserRequest {
    walletAddress: Address
    chainId: number
    chainName?: string
}

/**
 * Response from user sync API - now includes smart account!
 */
export interface SyncUserResponse {
    success: boolean
    user?: UserProfile
    smartAccount?: SmartAccountInfo
    error?: string
}

/**
 * State for user sync operations
 */
export type UserSyncState = 'idle' | 'syncing' | 'synced' | 'error'

