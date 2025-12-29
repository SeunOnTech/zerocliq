/**
 * ZeroSlip SDK - Network Configuration
 * 
 * Embedded configuration for devnet deployment.
 * This file contains all program IDs, token mints, and Pyth oracle feeds.
 */

import { PublicKey } from "@solana/web3.js";

// ============================================================================
// NETWORK TYPES
// ============================================================================

export type NetworkType = "devnet" | "mainnet";

// ============================================================================
// PROGRAM IDS
// ============================================================================

export const PROGRAM_IDS = {
    devnet: {
        zeroslip: new PublicKey("2F7iDmCAWmNg1KS2GEFGteGmuq7LysKYzq5qvgR3z5Sg"),
        mockTokens: new PublicKey("DErDBoxAceabitCjvCrKrd8xeVDQdpuoeTA28gVkPkRK"),
    },
    mainnet: {
        zeroslip: new PublicKey("11111111111111111111111111111111"), // Placeholder
        mockTokens: new PublicKey("11111111111111111111111111111111"), // Placeholder
    },
} as const;

export const PYTH_RECEIVER_PROGRAM_IDS = {
    devnet: new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"),
    mainnet: new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"),
} as const;

// ============================================================================
// PROTOCOL CONFIG
// ============================================================================

export const PROTOCOL_CONFIG = {
    devnet: {
        protocolConfig: new PublicKey("BgwWm3x7vk7kwrnBJ6jDDk62yxHDXW5PhMz5ogYh7tP4"),
        admin: new PublicKey("8uZWyqPLTTkWncpTBHmgBbztKcSvcVr8esS5ggagQde"),
        feeLamports: 500000, // 0.0005 SOL
    },
    mainnet: {
        protocolConfig: new PublicKey("11111111111111111111111111111111"), // Placeholder
        admin: new PublicKey("11111111111111111111111111111111"), // Placeholder
        feeLamports: 500000,
    },
} as const;

// ============================================================================
// TOKEN CONFIGURATION
// ============================================================================

export interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    mint: PublicKey;
    pythFeedId: string; // Hex string format
    pythFeedBytes: number[]; // 32-byte array for on-chain use
}

/**
 * Convert hex Pyth feed ID to byte array
 */
function hexToBytes(hex: string): number[] {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes: number[] = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes.push(parseInt(cleanHex.slice(i, i + 2), 16));
    }
    return bytes;
}

// Devnet Mock Tokens with Pyth Feeds
export const TOKENS: Record<NetworkType, Record<string, TokenInfo>> = {
    devnet: {
        USDC: {
            name: "USDC",
            symbol: "USDC",
            decimals: 6,
            mint: new PublicKey("4uAoVBPPxH2s6jxesQYB8k5B5VD4PzguRXt41HEr1Qjf"),
            pythFeedId: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
            pythFeedBytes: hexToBytes("0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"),
        },
        USDT: {
            name: "USDT",
            symbol: "USDT",
            decimals: 6,
            mint: new PublicKey("DAZDHEvVe2NGb5nXVi4N4oQ5JEnnPa5Po428GvBFDDFQ"),
            pythFeedId: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
            pythFeedBytes: hexToBytes("0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b"),
        },
        BONK: {
            name: "BONK",
            symbol: "BONK",
            decimals: 5,
            mint: new PublicKey("F5msropj71fQMuqh35UUhMRgYRfu2NsnGRcbdRqPvyuq"),
            pythFeedId: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
            pythFeedBytes: hexToBytes("0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419"),
        },
        WIF: {
            name: "WIF",
            symbol: "WIF",
            decimals: 6,
            mint: new PublicKey("D5oz1ZQ9qcP8EAhzWHdH5qzM6WxbRWaHbk67vSHSqQBF"),
            pythFeedId: "0xeff7445778848d6a4574936d53890f5c1d1a60039234b655593845b7468239389",
            pythFeedBytes: hexToBytes("0xeff7445778848d6a4574936d53890f5c1d1a60039234b655593845b7468239389"),
        },
        JUP: {
            name: "JUP",
            symbol: "JUP",
            decimals: 6,
            mint: new PublicKey("J5tKXWtVhYvtQ4xc6LLbXDgHUnAQYDgh8RCaCLopiZx7"),
            pythFeedId: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
            pythFeedBytes: hexToBytes("0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996"),
        },
        PYTH: {
            name: "PYTH",
            symbol: "PYTH",
            decimals: 6,
            mint: new PublicKey("2UniZ6VqbfcC7Jq5vv59zhHtqUrzXcTxCBXLCKsxtRZx"),
            pythFeedId: "0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
            pythFeedBytes: hexToBytes("0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff"),
        },
    },
    mainnet: {
        // Mainnet tokens would go here - using real mints
    },
};

// ============================================================================
// PYTH ORACLE FEEDS
// ============================================================================

export const PYTH_FEEDS: Record<NetworkType, Record<string, { feedId: string; feedBytes: number[] }>> = {
    devnet: {
        "SOL/USD": {
            feedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
            feedBytes: hexToBytes("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"),
        },
        "USDC/USD": {
            feedId: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
            feedBytes: hexToBytes("0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"),
        },
        "USDT/USD": {
            feedId: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
            feedBytes: hexToBytes("0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b"),
        },
        "BONK/USD": {
            feedId: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
            feedBytes: hexToBytes("0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419"),
        },
        "WIF/USD": {
            feedId: "0xeff7445778848d6a4574936d53890f5c1d1a60039234b655593845b7468239389",
            feedBytes: hexToBytes("0xeff7445778848d6a4574936d53890f5c1d1a60039234b655593845b7468239389"),
        },
        "JUP/USD": {
            feedId: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
            feedBytes: hexToBytes("0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996"),
        },
        "PYTH/USD": {
            feedId: "0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
            feedBytes: hexToBytes("0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff"),
        },
    },
    mainnet: {
        // Mainnet feeds would go here
    },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get network configuration
 */
export function getNetworkConfig(network: NetworkType) {
    return {
        programIds: PROGRAM_IDS[network],
        protocolConfig: PROTOCOL_CONFIG[network],
        tokens: TOKENS[network],
        pythFeeds: PYTH_FEEDS[network],
        pythReceiver: PYTH_RECEIVER_PROGRAM_IDS[network],
    };
}

/**
 * Get token info by name
 */
export function getTokenInfo(network: NetworkType, tokenName: string): TokenInfo | undefined {
    return TOKENS[network][tokenName.toUpperCase()];
}

/**
 * Get token info by mint address
 */
export function getTokenByMint(network: NetworkType, mint: PublicKey): TokenInfo | undefined {
    const tokens = TOKENS[network];
    for (const token of Object.values(tokens)) {
        if (token.mint.equals(mint)) {
            return token;
        }
    }
    return undefined;
}

/**
 * Get Pyth feed info by pair name (e.g., "SOL/USD")
 */
export function getPythFeed(network: NetworkType, pair: string) {
    return PYTH_FEEDS[network][pair.toUpperCase()];
}

/**
 * Get all supported token names
 */
export function getAllTokenNames(network: NetworkType): string[] {
    return Object.keys(TOKENS[network]);
}

/**
 * Get all supported Pyth feed pairs
 */
export function getAllPythPairs(network: NetworkType): string[] {
    return Object.keys(PYTH_FEEDS[network]);
}
