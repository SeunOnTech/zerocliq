// src/dexes/monad/pancakeV3.plugin.ts
import type {
    DexPlugin,
    DexQuoteParams,
    RouteCandidate,
    RouteHop,
} from "@/lib/server/dexes/dex.types";
import { normalizeTokenAddressForMonad } from "@/lib/server/dexes/monad/common";

import { encodeFunctionData, encodePacked, decodeFunctionResult } from "viem";
import { MulticallService } from "@/lib/server/services/multicall.service";

/**
 * 🔹 PancakeSwap V3 on Monad
 *
 * Factory: 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865
 * QuoterV2: 0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997
 * Smart Router: 0x21114915Ac6d5A2e156931e20B20b038dEd0Be7C
 */
const PANCAKE_V3_QUOTER_MONAD =
    "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as const;

const PANCAKE_V3_ROUTER_ADDRESS =
    "0x21114915Ac6d5A2e156931e20B20b038dEd0Be7C" as const;

// PancakeSwap V3 QuoterV2 ABI (quoteExactInputSingle)
const PANCAKE_V3_QUOTER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "fee", type: "uint24" },
                    { name: "sqrtPriceLimitX96", type: "uint160" },
                ],
                name: "params",
                type: "tuple",
            },
        ],
        name: "quoteExactInputSingle",
        outputs: [
            { name: "amountOut", type: "uint256" },
            { name: "sqrtPriceX96After", type: "uint160" },
            { name: "initializedTicksCrossed", type: "uint32" },
            { name: "gasEstimate", type: "uint256" },
        ],
        stateMutability: "nonpayable", // V2 quoter is non-view but we use call simulation
        type: "function",
    },
] as const;

// PancakeSwap V3 Smart Router ABI (SwapRouter02 - NO deadline in struct!)
// CRITICAL: Monad uses SwapRouter02 style which does NOT have deadline in the struct
// Selector: exactInput = 0xb858183f (not 0xc04b8d59 which has deadline)
// Selector: exactInputSingle = 0x04e45aaf (not 0x414bf389 which has deadline)
const PANCAKE_V3_ROUTER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "fee", type: "uint24" },
                    { name: "recipient", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "amountOutMinimum", type: "uint256" },
                    { name: "sqrtPriceLimitX96", type: "uint160" },
                ],
                name: "params",
                type: "tuple",
            },
        ],
        name: "exactInputSingle",
        outputs: [{ name: "amountOut", type: "uint256" }],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            {
                components: [
                    { name: "path", type: "bytes" },
                    { name: "recipient", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "amountOutMinimum", type: "uint256" },
                ],
                name: "params",
                type: "tuple",
            },
        ],
        name: "exactInput",
        outputs: [{ name: "amountOut", type: "uint256" }],
        stateMutability: "payable",
        type: "function",
    },
] as const;

// Common fees: 0.01%, 0.05%, 0.25%, 1%
const FEES = [100, 500, 2500, 10000];

export const PancakeV3MonadPlugin: DexPlugin = {
    id: "pancake-v3-monad",
    name: "PancakeSwap V3 (Monad)",
    kind: "UNISWAP_V3",
    supportedChains: [143], // Monad Mainnet
    routerAddress: PANCAKE_V3_ROUTER_ADDRESS,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInNorm = normalizeTokenAddressForMonad(tokenIn.address);
        const tokenOutNorm = normalizeTokenAddressForMonad(tokenOut.address);

        let bestAmountOut = 0n;
        let bestFee = 0;

        // Try all fee tiers using Multicall
        const contracts = FEES.map((fee) => ({
            address: PANCAKE_V3_QUOTER_MONAD,
            abi: PANCAKE_V3_QUOTER_ABI,
            functionName: "quoteExactInputSingle",
            args: [
                {
                    tokenIn: tokenInNorm,
                    tokenOut: tokenOutNorm,
                    amountIn: amountIn,
                    fee: fee,
                    sqrtPriceLimitX96: 0n,
                },
            ],
        }));

        const results = await MulticallService.multicall(client, contracts);

        results.forEach((res: any, index: number) => {
            if (res) {
                // res is [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
                const amountOut = res[0];
                if (amountOut > bestAmountOut) {
                    bestAmountOut = amountOut;
                    bestFee = FEES[index];
                }
            }
        });

        if (bestAmountOut <= 0n) return null;

        const hop: RouteHop = {
            dexId: "pancake-v3-monad",
            dexName: "PancakeSwap V3 (Monad)",
            kind: "UNISWAP_V3",
            detail: `Fee: ${bestFee / 10000}%`,
            poolOrQuoter: PANCAKE_V3_QUOTER_MONAD,
            path: [tokenInNorm, tokenOutNorm],
        };

        return {
            chainId: chain.id,
            dexId: "pancake-v3-monad",
            dexName: "PancakeSwap V3 (Monad)",
            amountIn,
            amountOut: bestAmountOut,
            hops: [hop],
        };
    },

    buildQuoteCall(params: DexQuoteParams) {
        const { chain, tokenIn, tokenOut, amountIn } = params;
        const tokenInNorm = normalizeTokenAddressForMonad(tokenIn.address);
        const tokenOutNorm = normalizeTokenAddressForMonad(tokenOut.address);

        return FEES.map((fee) => {
            const args = [{
                tokenIn: tokenInNorm,
                tokenOut: tokenOutNorm,
                amountIn: amountIn,
                fee: fee,
                sqrtPriceLimitX96: 0n,
            }] as const;

            return {
                to: PANCAKE_V3_QUOTER_MONAD,
                data: encodeFunctionData({
                    abi: PANCAKE_V3_QUOTER_ABI,
                    functionName: "quoteExactInputSingle",
                    args: args,
                }),
                decode: (result: `0x${string}`) => {
                    if (!result) return null;
                    try {
                        const decoded = decodeFunctionResult({
                            abi: PANCAKE_V3_QUOTER_ABI,
                            functionName: "quoteExactInputSingle",
                            data: result,
                        }) as [bigint, bigint, number, bigint];

                        const amountOut = decoded[0];
                        if (amountOut <= 0n) return null;

                        return {
                            chainId: chain.id,
                            dexId: "pancake-v3-monad",
                            dexName: "PancakeSwap V3 (Monad)",
                            amountIn,
                            amountOut,
                            hops: [{
                                dexId: "pancake-v3-monad",
                                dexName: "PancakeSwap V3 (Monad)",
                                kind: "UNISWAP_V3",
                                detail: `Fee: ${fee / 10000}%`,
                                poolOrQuoter: PANCAKE_V3_QUOTER_MONAD,
                                path: [tokenInNorm, tokenOutNorm],
                            }],
                        };
                    } catch (e) {
                        return null;
                    }
                },
            };
        });
    },

    async buildSwapCalldata(params) {
        const { chainId, tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadline, hops } = params;

        const tokenInNorm = normalizeTokenAddressForMonad(tokenIn);
        const tokenOutNorm = normalizeTokenAddressForMonad(tokenOut);

        if (hops.length === 1) {
            // Single hop
            const hop = hops[0];
            // Parse fee from detail string "Fee: 0.01%" -> 100
            const feeStr = hop.detail.replace("Fee: ", "").replace("%", "");
            const fee = Math.round(parseFloat(feeStr) * 10000);

            const data = encodeFunctionData({
                abi: PANCAKE_V3_ROUTER_ABI,
                functionName: "exactInputSingle",
                args: [{
                    tokenIn: tokenInNorm,
                    tokenOut: tokenOutNorm,
                    fee,
                    recipient,
                    amountIn,
                    amountOutMinimum: minAmountOut,
                    sqrtPriceLimitX96: 0n,
                }],
            });

            return {
                to: PANCAKE_V3_ROUTER_ADDRESS,
                data,
                value: tokenIn === "0x0000000000000000000000000000000000000000" ? amountIn : 0n,
            };
        } else {
            // Multi hop
            // Path encoding: tokenIn (20) + fee (3) + tokenMid (20) + fee (3) + tokenOut (20)
            const pathTypes: string[] = [];
            const pathValues: any[] = [];

            for (let i = 0; i < hops.length; i++) {
                const hop = hops[i];
                const feeStr = hop.detail.replace("Fee: ", "").replace("%", "");
                const fee = Math.round(parseFloat(feeStr) * 10000);

                if (i === 0) {
                    pathTypes.push("address");
                    pathValues.push(hop.path[0]); // hop.path is already normalized in quoteSingleHop?
                }
                pathTypes.push("uint24");
                pathValues.push(fee);
                pathTypes.push("address");
                pathValues.push(hop.path[1]);
            }

            const path = encodePacked(pathTypes, pathValues);

            const data = encodeFunctionData({
                abi: PANCAKE_V3_ROUTER_ABI,
                functionName: "exactInput",
                args: [{
                    path,
                    recipient,
                    amountIn,
                    amountOutMinimum: minAmountOut,
                }],
            });

            return {
                to: PANCAKE_V3_ROUTER_ADDRESS,
                data,
                value: tokenIn === "0x0000000000000000000000000000000000000000" ? amountIn : 0n,
            };
        }
    },
};
