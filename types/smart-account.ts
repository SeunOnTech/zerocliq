import type { Address, Hex } from 'viem'

/**
 * Smart Account deployment status (matches backend enum)
 */
export type SmartAccountStatus = 'NONE' | 'COUNTERFACTUAL' | 'DEPLOYED'

/**
 * Smart Account deployment flow states
 */
export type SmartAccountFlow =
    | 'idle'           // No action in progress
    | 'computing'      // Computing counterfactual address
    | 'signing'        // Waiting for user signature
    | 'deploying'      // Deploying to chain via bundler
    | 'success'        // Successfully deployed
    | 'error'          // Error occurred

/**
 * Smart Account data structure
 */
export interface SmartAccountData {
    address: Address
    status: SmartAccountStatus
    deploymentTxHash?: Hex
    chainId: number
}

/**
 * Request to create a counterfactual smart account
 */
export interface CreateSmartAccountRequest {
    walletAddress: Address
    chainId: number
}

/**
 * Request to deploy a smart account
 */
export interface DeploySmartAccountRequest {
    walletAddress: Address
    chainId: number
    smartAccountAddress: Address
}

/**
 * Response from smart account operations
 */
export interface SmartAccountResponse {
    success: boolean
    smartAccountAddress?: Address
    deploymentTxHash?: Hex
    error?: string
}
