/**
 * SyncSwap DEX Plugins for Linea
 * Classic and Stable pools
 */

import type {
    DexPlugin,
    DexQuoteParams,
    RouteCandidate,
    RouteHop,
    SwapParams,
} from "../dex.types";
import { normalizeTokenAddressForLinea } from "./common";
import {
    encodeFunctionData,
    parseAbi,
    encodeAbiParameters,
    parseAbiParameters,
    zeroAddress,
    type PublicClient,
} from "viem";

// SyncSwap Router (v2)
const SYNCSWAP_ROUTER = "0xc2a1947d2336b2af74d5813dc9ca6e0c3b3e8a1e" as const;

// Factories
const CLASSIC_POOL_FACTORY = "0x37BAc764494c8db4e54BDE72f6965beA9fa0AC2d" as const;
const STABLE_POOL_FACTORY = "0xE4CF807E351b56720B17A59094179e7Ed9dD3727" as const;

// ABIs
const POOL_ABI = parseAbi([
    "function getAmountOut(address tokenIn, uint256 amountIn, address sender) external view returns (uint256 amountOut)",
]);

const FACTORY_ABI = parseAbi([
    "function getPool(address tokenA, address tokenB) external view returns (address pool)",
]);

// Helper to get pool address
async function getPoolAddress(
    client: PublicClient,
    factory: string,
    tokenA: string,
    tokenB: string
): Promise<string | null> {
    try {
        const pool = await client.readContract({
            address: factory as `0x${string}`,
            abi: FACTORY_ABI,
            functionName: "getPool",
            args: [tokenA as `0x${string}`, tokenB as `0x${string}`],
        });
        return pool === zeroAddress ? null : pool;
    } catch (e) {
        return null;
    }
}

// SyncSwap Classic Plugin
export const SyncSwapClassicPlugin: DexPlugin = {
    id: "syncswap-classic",
    name: "SyncSwap (Classic)",
    kind: "SYNC_CLASSIC",
    supportedChains: [59144], // Linea
    routerAddress: SYNCSWAP_ROUTER,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn.address);
        const tokenOutMapped = normalizeTokenAddressForLinea(tokenOut.address);

        if (tokenInMapped === tokenOutMapped) return null;

        const poolAddress = await getPoolAddress(
            client,
            CLASSIC_POOL_FACTORY,
            tokenInMapped,
            tokenOutMapped
        );

        if (!poolAddress) return null;

        try {
            const amountOut = await client.readContract({
                address: poolAddress as `0x${string}`,
                abi: POOL_ABI,
                functionName: "getAmountOut",
                args: [tokenInMapped, amountIn, zeroAddress],
            });

            if (amountOut <= 0n) return null;

            const hop: RouteHop = {
                dexId: "syncswap-classic",
                dexName: "SyncSwap (Classic)",
                kind: "SYNC_CLASSIC",
                detail: "Classic Pool",
                poolOrQuoter: poolAddress as `0x${string}`,
                path: [tokenInMapped, tokenOutMapped],
            };

            return {
                chainId: chain.id,
                dexId: "syncswap-classic",
                dexName: "SyncSwap (Classic)",
                amountIn,
                amountOut,
                hops: [hop],
            };
        } catch (e) {
            return null;
        }
    },

    buildQuoteCall(params: DexQuoteParams) {
        return [];
    },

    async buildSwapCalldata(params: SwapParams) {
        const {
            tokenIn,
            amountIn,
            minAmountOut,
            recipient,
            deadline,
            hops,
        } = params;
        const isNativeIn =
            tokenIn.toLowerCase() === "0x0000000000000000000000000000000000000000";
        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn);

        const steps = hops.map((hop, index) => {
            const stepTokenIn =
                index === 0
                    ? tokenInMapped
                    : normalizeTokenAddressForLinea(hop.path[0]);
            const pool = hop.poolOrQuoter;

            const stepRecipient =
                index === hops.length - 1 ? (recipient as `0x${string}`) : zeroAddress;
            const withdrawMode = 0;

            const encodedData = encodeAbiParameters(
                parseAbiParameters("address, address, uint8"),
                [stepTokenIn, stepRecipient, withdrawMode]
            );

            return {
                pool: pool as `0x${string}`,
                data: encodedData,
                callback: zeroAddress,
                callbackData: "0x" as `0x${string}`,
            };
        });

        const swapPath = {
            steps: steps,
            tokenIn: isNativeIn ? zeroAddress : tokenInMapped,
            amountIn: BigInt(amountIn),
        };

        const routerAbi = [
            {
                inputs: [
                    {
                        components: [
                            {
                                components: [
                                    { name: "pool", type: "address" },
                                    { name: "data", type: "bytes" },
                                    { name: "callback", type: "address" },
                                    { name: "callbackData", type: "bytes" },
                                ],
                                name: "steps",
                                type: "tuple[]",
                            },
                            { name: "tokenIn", type: "address" },
                            { name: "amountIn", type: "uint256" },
                        ],
                        name: "paths",
                        type: "tuple[]",
                    },
                    { name: "amountOutMin", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
                name: "swap",
                outputs: [{ name: "amountOut", type: "uint256" }],
                stateMutability: "payable",
                type: "function",
            },
        ] as const;

        const data = encodeFunctionData({
            abi: routerAbi,
            functionName: "swap",
            args: [[swapPath], BigInt(minAmountOut), BigInt(deadline)],
        });

        return {
            to: SYNCSWAP_ROUTER,
            data,
            value: isNativeIn ? amountIn : 0n,
        };
    },
};

// SyncSwap Stable Plugin
export const SyncSwapStablePlugin: DexPlugin = {
    ...SyncSwapClassicPlugin,
    id: "syncswap-stable",
    name: "SyncSwap (Stable)",
    kind: "SYNC_STABLE",

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn.address);
        const tokenOutMapped = normalizeTokenAddressForLinea(tokenOut.address);

        if (tokenInMapped === tokenOutMapped) return null;

        const poolAddress = await getPoolAddress(
            client,
            STABLE_POOL_FACTORY,
            tokenInMapped,
            tokenOutMapped
        );

        if (!poolAddress) return null;

        try {
            const amountOut = await client.readContract({
                address: poolAddress as `0x${string}`,
                abi: POOL_ABI,
                functionName: "getAmountOut",
                args: [tokenInMapped, amountIn, zeroAddress],
            });

            if (amountOut <= 0n) return null;

            const hop: RouteHop = {
                dexId: "syncswap-stable",
                dexName: "SyncSwap (Stable)",
                kind: "SYNC_STABLE",
                detail: "Stable Pool",
                poolOrQuoter: poolAddress as `0x${string}`,
                path: [tokenInMapped, tokenOutMapped],
            };

            return {
                chainId: chain.id,
                dexId: "syncswap-stable",
                dexName: "SyncSwap (Stable)",
                amountIn,
                amountOut,
                hops: [hop],
            };
        } catch (e) {
            return null;
        }
    },
};
