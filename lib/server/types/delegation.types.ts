/**
 * Delegation Type Definitions
 * 
 * Types for building and managing ERC-7715 delegations.
 */

import type { Address, Hex } from "viem";
import type { Caveat } from "@metamask/smart-accounts-kit";
import type { SmartCardType } from "@/lib/server/config/smart-card-types";

/**
 * Parameters for building a delegation (legacy)
 * @deprecated Use BuildDelegationForTypeParams instead
 */
export interface BuildDelegationParams {
    chainId: number;
    delegatorAddress: Address; // User's Smart Account
    delegateAddress: Address;  // Agent's address
    tokenLimits?: TokenLimitConfig[]; // Optional spending limits
}

/**
 * Parameters for building a type-based delegation
 */
export interface BuildDelegationForTypeParams {
    chainId: number;
    delegatorAddress: Address; // User's Smart Account
    delegateAddress: Address;  // Agent's Smart Account
    type: SmartCardType;       // Card type determines scope
}

/**
 * Configuration for a single token's spending limit
 */
export interface TokenLimitConfig {
    tokenAddress: Address;
    limitAmount: bigint; // Daily limit in atomic units
    periodDuration?: number; // Defaults to 1 day (86400s)
}

/**
 * The raw delegation struct to be signed by the user
 * Matches the structure expected by the Delegation Framework
 */
export interface DelegationStruct {
    delegate: Address;
    delegator: Address;
    authority: Hex;
    caveats: Caveat[];
    salt: bigint | Hex;
    signature?: Hex;
}

/**
 * Result of the build process
 * Note: typedData removed - frontend uses SDK's signDelegation method
 */
export interface BuildDelegationResult {
    delegation: DelegationStruct;
    chainId: number;
    whitelistedRouters: Address[];
}
