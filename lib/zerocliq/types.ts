/**
 * ZeroSlip SDK - TypeScript Types
 * 
 * All interfaces, types, and enums for the ZeroSlip SDK.
 */

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// ============================================================================
// ORDER TYPES
// ============================================================================

/**
 * Order type enum
 */
export enum OrderType {
    Fixed = "fixed",
    Floating = "floating",
}

/**
 * Order data returned from on-chain queries
 */
export interface Order {
    /** Order state PDA */
    orderId: PublicKey;
    /** Order creator's wallet */
    maker: PublicKey;
    /** Token being sold */
    mintA: PublicKey;
    /** Token being received */
    mintB: PublicKey;
    /** Token A name (if recognized) */
    tokenA: string | null;
    /** Token B name (if recognized) */
    tokenB: string | null;
    /** Initial amount of Token A */
    amountAInitial: number;
    /** Remaining amount of Token A */
    amountARemaining: number;
    /** Price rate (Token B per Token A, scaled) */
    priceRate: number;
    /** Expiry timestamp (unix) */
    expiryTs: number;
    /** Whether order uses floating oracle price */
    isFloating: boolean;
    /** Oracle feed ID (for floating orders) */
    oracleFeed: number[] | null;
    /** Whether order has expired */
    isExpired: boolean;
}

/**
 * Order summary for list views
 */
export interface OrderSummary {
    orderId: PublicKey;
    maker: PublicKey;
    tokenA: string | null;
    tokenB: string | null;
    amountARemaining: number;
    priceRate: number;
    isFloating: boolean;
    isExpired: boolean;
    expiryTs?: number;
}

/**
 * Parameters for creating a fixed price order
 */
export interface CreateFixedOrderParams {
    /** Token to sell (name, e.g., "USDC") */
    tokenA: string;
    /** Token to receive (name, e.g., "SOL") */
    tokenB: string;
    /** Amount of Token A to sell (human-readable) */
    amount: number;
    /** Price rate (Token B per Token A) */
    priceRate: number;
    /** Expiry in seconds from now */
    expirySeconds: number;
}

/**
 * Parameters for creating a floating price order
 */
export interface CreateFloatingOrderParams {
    /** Token to sell (name, e.g., "USDC") */
    tokenA: string;
    /** Token to receive (name, e.g., "SOL") */
    tokenB: string;
    /** Amount of Token A to sell (human-readable) */
    amount: number;
    /** Spread above oracle price in basis points (e.g., 50 = +0.5%) */
    spreadBps: number;
    /** Oracle feed pair (e.g., "SOL/USD") or raw 32-byte array */
    oracleFeed: string | number[];
    /** Expiry in seconds from now */
    expirySeconds: number;
}

/**
 * Parameters for taking an order
 */
export interface TakeOrderParams {
    /** Order state public key */
    orderId: PublicKey | string;
    /** Amount of Token A to take (human-readable) */
    amount: number;
    /** Maximum slippage in basis points (default: 100 = 1%) */
    maxSlippageBps?: number;
    /** Pyth oracle account (required for floating orders) */
    oracleAccount?: PublicKey;
}

/**
 * Result from order creation
 */
export interface CreateOrderResult {
    /** Order state PDA */
    orderId: PublicKey;
    /** Vault ATA holding Token A */
    vault: PublicKey;
    /** Unique seed used to derive order */
    seed: BN;
    /** Transaction signature */
    signature: string;
}

/**
 * Cost estimation for taking an order
 */
export interface TakeOrderEstimate {
    /** Token A name */
    tokenA: string;
    /** Token B name */
    tokenB: string;
    /** Amount of Token A to receive */
    amountA: number;
    /** Amount of Token B to pay */
    tokenBCost: number;
    /** Price rate used */
    priceRate: number;
    /** Protocol fee in SOL */
    protocolFeeSol: number;
    /** Protocol fee in lamports */
    protocolFeeLamports: number;
    /** Whether order uses floating price */
    isFloating: boolean;
    /** Remaining Token A after take */
    remainingAfterTake: number;
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

/**
 * Protocol configuration
 */
export interface ProtocolConfig {
    /** Protocol admin wallet */
    admin: PublicKey;
    /** Fee recipient wallet */
    feeRecipient: PublicKey;
    /** Fee in lamports */
    feeLamports: number;
    /** Fee in SOL */
    feeSol: number;
}

/**
 * Token information
 */
export interface TokenInfo {
    /** Token name (e.g., "USDC") */
    name: string;
    /** Token symbol (e.g., "USDC") */
    symbol: string;
    /** Token decimals */
    decimals: number;
    /** Token mint address */
    mint: PublicKey;
    /** Pyth feed ID (hex string) */
    pythFeedId: string;
    /** Pyth feed ID (32-byte array) */
    pythFeedBytes: number[];
}

/**
 * Pyth oracle feed information
 */
export interface PythFeed {
    /** Feed ID as hex string */
    feedId: string;
    /** Feed ID as 32-byte array */
    feedBytes: number[];
}

/**
 * Network configuration
 */
export interface NetworkConfig {
    /** Program IDs */
    programIds: {
        zeroslip: PublicKey;
        mockTokens: PublicKey;
    };
    /** Protocol config */
    protocolConfig: {
        protocolConfig: PublicKey;
        admin: PublicKey;
        feeLamports: number;
    };
    /** Available tokens */
    tokens: Record<string, TokenInfo>;
    /** Available Pyth feeds */
    pythFeeds: Record<string, PythFeed>;
}

// ============================================================================
// WALLET TYPES
// ============================================================================

/**
 * Wallet adapter interface compatible with browser wallets and Keypair
 */
export interface WalletAdapter {
    publicKey: PublicKey;
    signTransaction?: <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(tx: T) => Promise<T>;
    signAllTransactions?: <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(txs: T[]) => Promise<T[]>;
}

// ============================================================================
// NETWORK TYPES
// ============================================================================

/**
 * Supported network types
 */
export type NetworkType = "devnet" | "mainnet";
