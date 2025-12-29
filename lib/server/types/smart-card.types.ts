/**
 * Smart Card Type Definitions
 * ===========================
 * TypeScript interfaces for Smart Card operations.
 */

import type { Address } from "viem";
import type { SmartCardType } from "@/lib/server/config/smart-card-types";

// Local enum definitions (matching Prisma)
export type SmartCardStatus = "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";
export type TransactionType = "SWAP" | "TRANSFER" | "APPROVAL" | "WRAP" | "UNWRAP";

// ============================================
// CREATION PARAMS
// ============================================

/**
 * Parameters for creating a new Smart Card (Type-Based)
 * The type determines the delegation scope automatically.
 */
export interface CreateSmartCardParams {
    /** User's database ID */
    userId: string;

    /** Chain ID for the delegation */
    chainId: number;

    /** Smart Card type - determines capabilities */
    type: SmartCardType;

    /** User's Smart Account address (delegator) */
    delegatorAddress: Address;

    /** Agent's Smart Account address (delegate) */
    delegateAddress: Address;

    /** Optional custom name override (auto-generated if not provided) */
    name?: string;

    /** Optional expiration date */
    expiresAt?: Date;
}

/**
 * Legacy params (deprecated - for backwards compatibility)
 * @deprecated Use CreateSmartCardParams with type instead
 */
export interface CreateSmartCardParamsLegacy {
    userId: string;
    chainId: number;
    name: string;
    delegatorAddress: Address;
    delegateAddress: Address;
    tokenLimits?: TokenLimitConfig[];
    expiresAt?: Date;
}

/**
 * Token limit configuration (metadata only, not enforced on-chain)
 */
export interface TokenLimitConfig {
    tokenAddress: Address;
    limitAmount: bigint | string;
}

// ============================================
// TRANSACTION PARAMS
// ============================================

/**
 * Parameters for recording a transaction
 */
export interface RecordTransactionParams {
    smartCardId: string;
    transactionHash: string;
    tokenAddress: Address;
    amount: bigint;
    transactionType: TransactionType;
    dexId?: string;
    routerAddress?: Address;
    blockNumber?: number;
    timestamp?: Date;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Result of a spending capability check
 */
export interface CanSpendResult {
    allowed: boolean;
    reason?: string;
    remainingDaily?: bigint;
    remainingTotal?: bigint;
}

/**
 * Result of Smart Card creation
 */
export interface CreateSmartCardResult {
    success: boolean;
    smartCardId: string;
    delegation: any;
    type: SmartCardType;
    chainId: number;
    autoName: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Smart Card type info for API response
 */
export interface SmartCardTypeInfo {
    type: SmartCardType;
    displayName: string;
    shortDescription: string;
    longDescription: string;
    icon: string;
    enabled: boolean;
    capabilities: {
        title: string;
        description: string;
        icon: string;
        isPremium?: boolean;
    }[];
}

/**
 * Response for GET /smart-cards/types
 */
export interface GetSmartCardTypesResponse {
    success: boolean;
    types: SmartCardTypeInfo[];
}

/**
 * Response for POST /smart-cards/create
 */
export interface CreateSmartCardResponse {
    success: boolean;
    smartCardId: string;
    type: SmartCardType;
    delegation: any;
    chainId: number;
    name: string;
    message: string;
}
