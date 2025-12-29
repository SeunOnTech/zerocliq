/**
 * Smart Card Type Registry
 * ========================
 * Central configuration for all Smart Card types and their capabilities.
 * 
 * Architecture:
 * - Each type defines its scope (targets + selectors)
 * - Scopes are chain-agnostic (resolved at delegation time)
 * - Types can be enabled/disabled for gradual rollout
 * - Frontend uses this config for UI and type selection
 */

import type { Address } from "viem";
import { getSmartCardChainConfig } from "./smart-card-chains";
import { STANDARD_DELEGATION_SELECTORS } from "./delegation-constants";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Smart Card Type enum (normally from Prisma, but defined here for portability)
 */
export type SmartCardType = "TRADING" | "REBALANCING" | "STAKING" | "GOVERNANCE";

/**
 * Configuration for a Smart Card type
 */
export interface SmartCardTypeConfig {
    /** Prisma enum value */
    type: SmartCardType;

    /** Display name shown to users */
    displayName: string;

    /** Short description for cards/buttons */
    shortDescription: string;

    /** Detailed description for info panels */
    longDescription: string;

    /** Icon identifier for frontend */
    icon: "trading" | "rebalancing" | "staking" | "governance";

    /** Whether this type is currently available */
    enabled: boolean;

    /** Human-readable list of capabilities */
    capabilities: SmartCardCapability[];

    /** Returns delegation scope for a given chain */
    getDelegationScope: (chainId: number) => DelegationScope;

    /** Auto-generated name template */
    getAutoName: (chainName?: string) => string;
}

/**
 * A capability that a Smart Card type provides
 */
export interface SmartCardCapability {
    /** Short title */
    title: string;

    /** Description */
    description: string;

    /** Icon for this capability */
    icon: "swap" | "transfer" | "limit" | "dex" | "vault" | "stake" | "vote";

    /** Is this a premium feature? */
    isPremium?: boolean;
}

/**
 * Delegation scope defining what contracts and functions are allowed
 */
export interface DelegationScope {
    /** Allowed contract addresses (routers, tokens, protocols) */
    targets: Address[];

    /** Allowed function selectors */
    selectors: string[];
}

// ============================================
// TRADING CARD SELECTORS
// ============================================

/**
 * Function selectors allowed for Trading Smart Cards.
 * Covers ERC-20 operations, wrapping, and DEX swaps.
 */
export const TRADING_SELECTORS = STANDARD_DELEGATION_SELECTORS;

// ============================================
// REBALANCING CARD SELECTORS (Future)
// ============================================

export const REBALANCING_SELECTORS = [
    // ERC-20 basics
    "approve(address,uint256)",
    "transfer(address,uint256)",

    // Wrapped tokens
    "deposit()",
    "withdraw(uint256)",

    // Vault operations
    "deposit(uint256,address)",
    "withdraw(uint256,address,address)",
    "redeem(uint256,address,address)",

    // Swap (for rebalancing)
    ...STANDARD_DELEGATION_SELECTORS,
];

// ============================================
// STAKING CARD SELECTORS (Future)
// ============================================

export const STAKING_SELECTORS = [
    // ERC-20 basics
    "approve(address,uint256)",

    // Staking operations
    "stake(uint256)",
    "unstake(uint256)",
    "claim()",
    "claimRewards()",
    "delegate(address)",
];

// ============================================
// GOVERNANCE CARD SELECTORS (Future)
// ============================================

export const GOVERNANCE_SELECTORS = [
    // Voting
    "castVote(uint256,uint8)",
    "castVoteWithReason(uint256,uint8,string)",
    "delegate(address)",
];

// ============================================
// TYPE REGISTRY
// ============================================

/**
 * Central registry of all Smart Card types.
 * This is the single source of truth for type configurations.
 */
export const SMART_CARD_TYPE_REGISTRY: Record<SmartCardType, SmartCardTypeConfig> = {
    TRADING: {
        type: "TRADING",
        displayName: "Trade Smart Card",
        shortDescription: "Gasless DeFi operations",
        longDescription: "Enable zero-gas swaps, limit orders, and token transfers across multiple DEXes. Perfect for active traders who want seamless execution without gas fees.",
        icon: "trading",
        enabled: true,
        capabilities: [
            {
                title: "Gasless Swaps",
                description: "Execute token swaps without paying gas fees",
                icon: "swap",
            },
            {
                title: "DEX Aggregation",
                description: "Access best rates across multiple DEXes",
                icon: "dex",
            },
            {
                title: "Token Transfers",
                description: "Send tokens without gas costs",
                icon: "transfer",
            },
            {
                title: "Limit Orders",
                description: "Set price targets and execute automatically",
                icon: "limit",
            },
        ],
        getDelegationScope: (chainId: number): DelegationScope => {
            const chainConfig = getSmartCardChainConfig(chainId);
            return {
                targets: [
                    ...chainConfig.getWhitelistedRouters(),
                    ...chainConfig.getSupportedTokens().map(t => t.address as Address),
                ],
                selectors: TRADING_SELECTORS,
            };
        },
        getAutoName: (chainName?: string) =>
            chainName ? `Trade Card - ${chainName}` : "Trade Smart Card",
    },

    REBALANCING: {
        type: "REBALANCING",
        displayName: "Rebalancing Card",
        shortDescription: "Automated portfolio management",
        longDescription: "Automatically rebalance your portfolio to maintain target allocations. Set it and forget it - the AI keeps your portfolio on track.",
        icon: "rebalancing",
        enabled: false, // Coming soon
        capabilities: [
            {
                title: "Auto Rebalance",
                description: "Maintain target portfolio allocations",
                icon: "vault",
            },
            {
                title: "DCA Execution",
                description: "Dollar-cost average into positions",
                icon: "swap",
            },
        ],
        getDelegationScope: (chainId: number): DelegationScope => {
            const chainConfig = getSmartCardChainConfig(chainId);
            return {
                targets: [
                    ...chainConfig.getWhitelistedRouters(),
                    ...chainConfig.getSupportedTokens().map(t => t.address as Address),
                ],
                selectors: REBALANCING_SELECTORS,
            };
        },
        getAutoName: (chainName?: string) =>
            chainName ? `Rebalance Card - ${chainName}` : "Rebalancing Card",
    },

    STAKING: {
        type: "STAKING",
        displayName: "Staking Card",
        shortDescription: "Stake and earn rewards",
        longDescription: "Delegate staking operations to earn rewards automatically. Compound, claim, and restake without lifting a finger.",
        icon: "staking",
        enabled: false, // Coming soon
        capabilities: [
            {
                title: "Auto Stake",
                description: "Stake tokens automatically",
                icon: "stake",
            },
            {
                title: "Claim Rewards",
                description: "Automatically claim and compound",
                icon: "swap",
            },
        ],
        getDelegationScope: (_chainId: number): DelegationScope => {
            return {
                targets: [], // Add staking protocol addresses
                selectors: STAKING_SELECTORS,
            };
        },
        getAutoName: (chainName?: string) =>
            chainName ? `Staking Card - ${chainName}` : "Staking Card",
    },

    GOVERNANCE: {
        type: "GOVERNANCE",
        displayName: "Governance Card",
        shortDescription: "Vote on proposals",
        longDescription: "Delegate DAO voting to an AI agent. Never miss a vote while maintaining full control over your delegation.",
        icon: "governance",
        enabled: false, // Coming soon
        capabilities: [
            {
                title: "Auto Voting",
                description: "Cast votes based on preferences",
                icon: "vote",
            },
            {
                title: "Delegation",
                description: "Delegate voting power",
                icon: "transfer",
            },
        ],
        getDelegationScope: (_chainId: number): DelegationScope => {
            return {
                targets: [], // Add governance contract addresses
                selectors: GOVERNANCE_SELECTORS,
            };
        },
        getAutoName: (chainName?: string) =>
            chainName ? `Governance Card - ${chainName}` : "Governance Card",
    },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get configuration for a specific Smart Card type
 */
export function getSmartCardTypeConfig(type: SmartCardType): SmartCardTypeConfig {
    const config = SMART_CARD_TYPE_REGISTRY[type];
    if (!config) {
        throw new Error(`Unknown Smart Card type: ${type}`);
    }
    return config;
}

/**
 * Get all enabled Smart Card types
 */
export function getEnabledSmartCardTypes(): SmartCardTypeConfig[] {
    return Object.values(SMART_CARD_TYPE_REGISTRY).filter(config => config.enabled);
}

/**
 * Get all Smart Card types (for admin/preview purposes)
 */
export function getAllSmartCardTypes(): SmartCardTypeConfig[] {
    return Object.values(SMART_CARD_TYPE_REGISTRY);
}

/**
 * Check if a Smart Card type is enabled
 */
export function isSmartCardTypeEnabled(type: SmartCardType): boolean {
    return SMART_CARD_TYPE_REGISTRY[type]?.enabled ?? false;
}

/**
 * Get delegation scope for a type + chain combo
 */
export function getDelegationScopeForType(type: SmartCardType, chainId: number): DelegationScope {
    const config = getSmartCardTypeConfig(type);
    return config.getDelegationScope(chainId);
}

/**
 * Generate auto-name for a card based on type and chain
 */
export function generateSmartCardName(type: SmartCardType, chainName?: string): string {
    const config = getSmartCardTypeConfig(type);
    return config.getAutoName(chainName);
}

/**
 * Serialize type config for API response (removes functions)
 */
export function serializeTypeConfig(config: SmartCardTypeConfig) {
    return {
        type: config.type,
        displayName: config.displayName,
        shortDescription: config.shortDescription,
        longDescription: config.longDescription,
        icon: config.icon,
        enabled: config.enabled,
        capabilities: config.capabilities,
    };
}

/**
 * Get all types serialized for API response
 */
export function getSerializedSmartCardTypes(enabledOnly = true) {
    const types = enabledOnly ? getEnabledSmartCardTypes() : getAllSmartCardTypes();
    return types.map(serializeTypeConfig);
}
