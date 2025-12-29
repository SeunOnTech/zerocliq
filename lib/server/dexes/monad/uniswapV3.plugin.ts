// src/dexes/monad/uniswapV3.plugin.ts
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
 * 🔹 Uniswap V3 on Monad
 *
 * Factory: 0x204faca1764b154221e35c0d20abb3c525710498
 * QuoterV2: 0x661e93cca42afacb172121ef892830ca3b70f08d
 * SwapRouter02: 0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900
 */
const UNISWAP_V3_QUOTER_MONAD =
    "0x661e93cca42afacb172121ef892830ca3b70f08d" as const;

const UNISWAP_V3_ROUTER_ADDRESS =
    "0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900" as const;

// Uniswap V3 QuoterV2 ABI (quoteExactInputSingle)
const UNISWAP_V3_QUOTER_ABI = [
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
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

// Uniswap V3 Router ABI (exactInputSingle, exactInput)
const UNISWAP_V3_ROUTER_ABI = [
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

// Common fees: 0.01%, 0.05%, 0.3%, 1%
const FEES = [100, 500, 3000, 10000];

export const UniswapV3MonadPlugin: DexPlugin = {
    id: "uniswap-v3-monad",
    name: "Uniswap V3 (Monad)",
    kind: "UNISWAP_V3",
    supportedChains: [143], // Monad Mainnet
    routerAddress: UNISWAP_V3_ROUTER_ADDRESS,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInNorm = normalizeTokenAddressForMonad(tokenIn.address);
        const tokenOutNorm = normalizeTokenAddressForMonad(tokenOut.address);

        let bestAmountOut = 0n;
        let bestFee = 0;

        // Try all fee tiers using Multicall
        const contracts = FEES.map((fee) => ({
            address: UNISWAP_V3_QUOTER_MONAD,
            abi: UNISWAP_V3_QUOTER_ABI,
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
            dexId: "uniswap-v3-monad",
            dexName: "Uniswap V3 (Monad)",
            kind: "UNISWAP_V3",
            detail: `Fee: ${bestFee / 10000}%`,
            poolOrQuoter: UNISWAP_V3_QUOTER_MONAD,
            path: [tokenInNorm, tokenOutNorm],
        };

        return {
            chainId: chain.id,
            dexId: "uniswap-v3-monad",
            dexName: "Uniswap V3 (Monad)",
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
                to: UNISWAP_V3_QUOTER_MONAD,
                data: encodeFunctionData({
                    abi: UNISWAP_V3_QUOTER_ABI,
                    functionName: "quoteExactInputSingle",
                    args: args,
                }),
                decode: (result: `0x${string}`) => {
                    if (!result) return null;
                    try {
                        const decoded = decodeFunctionResult({
                            abi: UNISWAP_V3_QUOTER_ABI,
                            functionName: "quoteExactInputSingle",
                            data: result,
                        }) as [bigint, bigint, number, bigint];

                        const amountOut = decoded[0];
                        if (amountOut <= 0n) return null;

                        return {
                            chainId: chain.id,
                            dexId: "uniswap-v3-monad",
                            dexName: "Uniswap V3 (Monad)",
                            amountIn,
                            amountOut,
                            hops: [{
                                dexId: "uniswap-v3-monad",
                                dexName: "Uniswap V3 (Monad)",
                                kind: "UNISWAP_V3",
                                detail: `Fee: ${fee / 10000}%`,
                                poolOrQuoter: UNISWAP_V3_QUOTER_MONAD,
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
            const feeStr = hop.detail.replace("Fee: ", "").replace("%", "");
            const fee = Math.round(parseFloat(feeStr) * 10000);

            const data = encodeFunctionData({
                abi: UNISWAP_V3_ROUTER_ABI,
                functionName: "exactInputSingle",
                args: [{
                    tokenIn: tokenInNorm,
                    tokenOut: tokenOutNorm,
                    fee,
                    recipient,
                    // deadline: BigInt(deadline), // SwapRouter02 exactInputSingle often doesn't take deadline in params struct, checking ABI...
                    // Actually SwapRouter02 `ExactInputSingleParams` usually DOES NOT have deadline. It's in the outer call or msg.sender check?
                    // Wait, looking at standard SwapRouter02 ABI:
                    // struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }
                    // It does NOT have deadline.
                    amountIn,
                    amountOutMinimum: minAmountOut,
                    sqrtPriceLimitX96: 0n,
                }],
            });

            return {
                to: UNISWAP_V3_ROUTER_ADDRESS,
                data,
                value: tokenIn === "0x0000000000000000000000000000000000000000" ? amountIn : 0n,
            };
        } else {
            // Multi hop
            const pathTypes: string[] = [];
            const pathValues: any[] = [];

            for (let i = 0; i < hops.length; i++) {
                const hop = hops[i];
                const feeStr = hop.detail.replace("Fee: ", "").replace("%", "");
                const fee = Math.round(parseFloat(feeStr) * 10000);

                if (i === 0) {
                    pathTypes.push("address");
                    pathValues.push(hop.path[0]);
                }
                pathTypes.push("uint24");
                pathValues.push(fee);
                pathTypes.push("address");
                pathValues.push(hop.path[1]);
            }

            const path = encodePacked(pathTypes, pathValues);

            const data = encodeFunctionData({
                abi: UNISWAP_V3_ROUTER_ABI,
                functionName: "exactInput",
                args: [{
                    path,
                    recipient,
                    // deadline: BigInt(deadline), // SwapRouter02 exactInput also often lacks deadline in struct
                    amountIn,
                    amountOutMinimum: minAmountOut,
                }],
            });

            return {
                to: UNISWAP_V3_ROUTER_ADDRESS,
                data,
                value: tokenIn === "0x0000000000000000000000000000000000000000" ? amountIn : 0n,
            };
        }
    },
};
