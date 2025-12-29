/**
 * Spending Limit Type Definitions
 * 
 * Types for tracking and enforcing spending limits on Smart Cards.
 */

import type { Address } from "viem";

/**
 * Status of spending for a specific token
 */
export interface SpendingStatus {
    tokenAddress: Address;
    dailySpent: bigint;
    totalSpent: bigint;
    dailyLimit: bigint;
    remainingDaily: bigint;
    lastResetDate: Date;
}

/**
 * Result of a limit check
 */
export interface LimitCheckResult {
    allowed: boolean;
    reason?: string;
    currentSpent?: bigint;
    limit?: bigint;
}
