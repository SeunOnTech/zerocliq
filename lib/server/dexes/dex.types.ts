/**
 * DEX Plugin Type Definitions
 * 
 * Types for swap route aggregation across multiple DEXes.
 */

import type { PublicClient } from "viem";
import type { ChainConfig, TokenInfo } from "@/lib/server/config/chains";

/**
 * DEX identifiers we support today.
 */
export type DexId =
    | "syncswap-classic"
    | "syncswap-stable"
    | "lynex"
    | "pancake-v2"
    | "pancake-v3"
    | "pancake-v3-linea"
    | "pancake-v3-monad"
    | "nile-exchange"
    | "etherex"
    | "mdex-v2"
    | "uniswap-v3"
    | "uniswap-v3-monad"
    | "uniswap-v4-monad"
    | "curve-monad"
    | "uniswap-v3-sepolia"
    | "uniswap-v2-sepolia";

/**
 * Category / flavor of the DEX implementation.
 */
export type DexKind =
    | "UNIV2_LIKE"        // Pancake V2, Uni V2, Sushi
    | "UNIV3_LIKE"        // Pancake V3, Uni V3, Algebra V3
    | "UNISWAP_V3"        // Uniswap V3 specific
    | "STABLE"            // Curve, Wombat, Maverick Stable
    | "SYNC_CLASSIC"      // SyncSwap classic pools
    | "SYNC_STABLE"       // SyncSwap stable pools
    | "LYNEX_ALGEBRA"     // Lynex Algebra pools
    | "ALGBRA_V3"         // Algebra v3 (multi-chain variant)
    | "SOLIDLY"           // Velodrome, BaseSwap Solidly
    | "CL"                // Concentrated Liquidity (generic)
    | "BALANCER"          // Weighted pools
    | "MDEX_V2"           // MDEX
    | "WOMBAT"            // Wombat stable pools
    | "CURVE_STABLE"      // Curve pools
    | "IZISWAP"           // iZiSwap
    ;


/**
 * A single hop in a route (pool or quoter level).
 */
export interface RouteHop {
    dexId: DexId;
    dexName: string;
    kind: DexKind;
    detail: string;
    poolOrQuoter: `0x${string}`;
    path: `0x${string}`[];
}

/**
 * A full route candidate returned by a DEX plugin.
 */
export interface RouteCandidate {
    chainId: number;
    dexId: DexId;
    dexName: string;
    amountIn: bigint;
    amountOut: bigint;
    hops: RouteHop[];
}

/**
 * Params passed from the aggregator into each DEX plugin.
 */
export interface DexQuoteParams {
    chain: ChainConfig;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
    amountIn: bigint;
    client: PublicClient;
}

/**
 * DEX Plugin interface.
 */
export interface DexPlugin {
    id: DexId;
    name: string;
    kind: DexKind;
    supportedChains: number[];
    routerAddress?: `0x${string}`;

    /**
     * Return a quote for a direct swap.
     */
    quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null>;

    /**
     * Build the calldata for a single-hop quote (for Multicall).
     */
    buildQuoteCall?: (params: DexQuoteParams) => {
        to: string;
        data: string;
        value?: bigint;
        decode: (result: `0x${string}`) => RouteCandidate | null;
    }[];

    /**
     * Build the transaction calldata for executing a swap.
     */
    buildSwapCalldata?(params: SwapParams): Promise<{
        to: `0x${string}`;
        data: `0x${string}`;
        value: bigint;
    }>;
}

export interface SwapParams {
    chainId: number;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    amountIn: bigint;
    minAmountOut: bigint;
    recipient: `0x${string}`;
    deadline: number;
    hops: RouteHop[];
}

/**
 * Transaction request data for frontend execution
 */
export interface TransactionRequest {
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
    description?: string;
}

/**
 * Request body for /swap/quote
 */
export interface SwapQuoteRequest {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountInRaw?: boolean;
    slippageBps?: number;
    debugRoutes?: boolean;
    userAddress?: string;
    deadline?: number;
}

export interface DebugRouteSummary {
    dexId: string;
    dexName: string;
    path: string[];
    amountOut: string;
    hopsType: "direct" | "multi-hop";
    via: string | null;
}

export interface SwapQuoteResponse {
    success: boolean;
    request: {
        chainId: number;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        amountInRaw: string;
    };
    bestRoute: {
        dexId: string;
        dexName: string;
        amountOut: string;
        minAmountOut: string;
        hops: RouteHop[];
        priceImpactBps: number;
        confidenceScore: number;
        gasEstimate?: string;
    } | null;
    alternatives: {
        dexId: string;
        dexName: string;
        amountOut: string;
        hops: RouteHop[];
        priceImpactBps: number;
        confidenceScore: number;
        gasEstimate?: string;
    }[];
    execution?: {
        approvals: TransactionRequest[];
        swap: TransactionRequest;
    };
    debug?: {
        summary: {
            directRoutes: DebugRouteSummary[];
            multiHopRoutes: DebugRouteSummary[];
            errors: { dex: string; reason: string }[];
            explainBestRoute: string;
        };
        raw: any;
    };
    error?: string;
}
