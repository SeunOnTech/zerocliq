// src/dexes/monad/curve.plugin.ts
import type {
    DexPlugin,
    DexQuoteParams,
    RouteCandidate,
    RouteHop,
} from "@/lib/server/dexes/dex.types";
import { normalizeTokenAddressForMonad } from "@/lib/server/dexes/monad/common";
import { encodeFunctionData } from "viem";

/**
 * 🔹 Curve on Monad
 *
 * Registry: Not found.
 * Pools (Hardcoded):
 * - 3pool (AUSD/USDC/USDT): 0x94264627195d82B63b36E9B9735dD76f5f5C91ab
 * - WMON/USDC: 0x78051E919D945C33a251786522c070A187A6D
 */

type CurvePool = {
    address: `0x${string}`;
    tokens: `0x${string}`[]; // Normalized addresses
    isCrypto?: boolean; // If true, might use different ABI (get_dy vs get_dy_underlying etc, but usually get_dy works)
};

// Known Pools
const CURVE_POOLS: CurvePool[] = [
    {
        // 3pool: AUSD, USDC, USDT
        address: "0x94264627195d82B63b36E9B9735dD76f5f5C91ab",
        tokens: [
            "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a", // AUSD
            "0x754704Bc059F8C67012fEd69BC8A327a5aafb603", // USDC
            "0xe7cd86e13AC4309349F30B3435a9d337750fC82D", // USDT
        ].map(normalizeTokenAddressForMonad) as `0x${string}`[],
    },
    {
        // WMON/USDC
        address: "0x78051E919D945C33a251786522c070A187A6D",
        tokens: [
            "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A", // WMON
            "0x754704Bc059F8C67012fEd69BC8A327a5aafb603", // USDC
        ].map(normalizeTokenAddressForMonad) as `0x${string}`[],
    }
];

// Curve StableSwap ABI (get_dy, exchange)
const CURVE_ABI = [
    {
        name: "get_dy",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "i", type: "int128" },
            { name: "j", type: "int128" },
            { name: "dx", type: "uint256" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "exchange",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "i", type: "int128" },
            { name: "j", type: "int128" },
            { name: "dx", type: "uint256" },
            { name: "min_dy", type: "uint256" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

export const CurveMonadPlugin: DexPlugin = {
    id: "curve-monad",
    name: "Curve (Monad)",
    kind: "CURVE_STABLE", // or SYNC_STABLE, using CURVE_STABLE for clarity
    supportedChains: [143],

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInNorm = normalizeTokenAddressForMonad(tokenIn.address);
        const tokenOutNorm = normalizeTokenAddressForMonad(tokenOut.address);

        // Find a pool that contains both tokens
        const pool = CURVE_POOLS.find(
            (p) =>
                p.tokens.some((t) => t.toLowerCase() === tokenInNorm.toLowerCase()) &&
                p.tokens.some((t) => t.toLowerCase() === tokenOutNorm.toLowerCase())
        );

        if (!pool) return null;

        // Determine indices i and j
        const i = pool.tokens.findIndex((t) => t.toLowerCase() === tokenInNorm.toLowerCase());
        const j = pool.tokens.findIndex((t) => t.toLowerCase() === tokenOutNorm.toLowerCase());

        if (i === -1 || j === -1) return null;

        try {
            const amountOut = (await client.readContract({
                address: pool.address,
                abi: CURVE_ABI,
                functionName: "get_dy",
                args: [BigInt(i), BigInt(j), amountIn],
            })) as bigint;

            if (amountOut <= 0n) return null;

            const hop: RouteHop = {
                dexId: "curve-monad",
                dexName: "Curve (Monad)",
                kind: "CURVE_STABLE",
                detail: "Stable Pool",
                poolOrQuoter: pool.address,
                path: [tokenInNorm, tokenOutNorm],
            };

            return {
                chainId: chain.id,
                dexId: "curve-monad",
                dexName: "Curve (Monad)",
                amountIn,
                amountOut,
                hops: [hop],
            };
        } catch (e) {
            // console.error("Curve quote failed", e);
            return null;
        }
    },

    async buildSwapCalldata(params) {
        const { chainId, tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadline, hops } = params;

        // Curve usually doesn't support multi-hop natively in one call without a Router.
        // Since we are interacting directly with pools, we only support single-hop here.
        if (hops.length !== 1) {
            throw new Error("Curve (Monad) plugin only supports single-hop swaps directly via pools.");
        }

        const hop = hops[0];
        const poolAddress = hop.poolOrQuoter;

        // We need to re-determine indices i and j.
        // In a real robust system, we might pass indices in 'detail' or 'path', but here we re-find them.
        // We assume the poolAddress corresponds to one of our known pools.
        const pool = CURVE_POOLS.find((p) => p.address.toLowerCase() === poolAddress.toLowerCase());
        if (!pool) throw new Error("Curve pool not found for execution");

        const tokenInNorm = normalizeTokenAddressForMonad(tokenIn);
        const tokenOutNorm = normalizeTokenAddressForMonad(tokenOut);

        const i = pool.tokens.findIndex((t) => t.toLowerCase() === tokenInNorm.toLowerCase());
        const j = pool.tokens.findIndex((t) => t.toLowerCase() === tokenOutNorm.toLowerCase());

        if (i === -1 || j === -1) throw new Error("Tokens not found in Curve pool");

        const data = encodeFunctionData({
            abi: CURVE_ABI,
            functionName: "exchange",
            args: [BigInt(i), BigInt(j), amountIn, minAmountOut],
        });

        return {
            to: poolAddress,
            data,
            value: tokenIn === "0x0000000000000000000000000000000000000000" ? amountIn : 0n,
        };
    },
};
