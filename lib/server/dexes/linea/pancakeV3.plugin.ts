import {
    DexPlugin,
    DexQuoteParams,
    RouteCandidate,
    RouteHop,
} from "@/lib/server/dexes/dex.types";
import { normalizeTokenAddressForLinea } from "@/lib/server/dexes/linea/common";
import {
    encodeFunctionData,
    parseAbi,
    decodeFunctionResult,
    encodePacked,
} from "viem";

const PANCAKE_V3_QUOTER_LINEA =
    "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as const;

const PANCAKE_V3_ROUTER_ADDRESS =
    "0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86" as const;

// Minimal ABIs
const QUOTER_V2_ABI = [
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

const ROUTER_ABI = [
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
    {
        inputs: [{ name: "data", type: "bytes[]" }],
        name: "multicall",
        outputs: [{ name: "results", type: "bytes[]" }],
        stateMutability: "payable",
        type: "function",
    },
] as const;

const FEES = [100, 500, 2500, 10000]; // 0.01%, 0.05%, 0.25%, 1%

export const PancakeV3LineaPlugin: DexPlugin = {
    id: "pancake-v3-linea",
    name: "PancakeSwap V3",
    kind: "UNISWAP_V3",
    supportedChains: [59144], // Linea
    routerAddress: PANCAKE_V3_ROUTER_ADDRESS,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn.address);
        const tokenOutMapped = normalizeTokenAddressForLinea(tokenOut.address);

        if (tokenInMapped === tokenOutMapped) return null;

        let bestRoute: RouteCandidate | null = null;

        // Parallelize the calls for speed
        const quotePromises = FEES.map(async (fee) => {
            try {
                const result = await client.simulateContract({
                    address: PANCAKE_V3_QUOTER_LINEA,
                    abi: QUOTER_V2_ABI,
                    functionName: "quoteExactInputSingle",
                    args: [
                        {
                            tokenIn: tokenInMapped,
                            tokenOut: tokenOutMapped,
                            amountIn: BigInt(amountIn),
                            fee: fee,
                            sqrtPriceLimitX96: 0n,
                        },
                    ],
                });

                const amountOut = result.result[0]; // First return value is amountOut
                return { fee, amountOut };
            } catch (e) {
                // Pool might not exist for this fee tier
                return null;
            }
        });

        const results = await Promise.all(quotePromises);

        for (const res of results) {
            if (res && res.amountOut > 0n) {
                if (!bestRoute || res.amountOut > BigInt(bestRoute.amountOut)) {
                    const hop: RouteHop = {
                        dexId: "pancake-v3-linea",
                        dexName: "PancakeSwap V3",
                        kind: "UNISWAP_V3",
                        detail: `Fee: ${res.fee / 10000}%`,
                        poolOrQuoter: PANCAKE_V3_QUOTER_LINEA,
                        path: [tokenInMapped, tokenOutMapped],
                    };

                    bestRoute = {
                        chainId: chain.id,
                        dexId: "pancake-v3-linea",
                        dexName: "PancakeSwap V3",
                        amountIn,
                        amountOut: res.amountOut,
                        hops: [hop],
                    };
                }
            }
        }

        return bestRoute;
    },

    buildQuoteCall(params: DexQuoteParams) {
        const { chain, tokenIn, tokenOut, amountIn } = params;
        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn.address);
        const tokenOutMapped = normalizeTokenAddressForLinea(tokenOut.address);

        if (tokenInMapped === tokenOutMapped) return [];

        // Return a call for each fee tier
        return FEES.map((fee) => {
            const callData = encodeFunctionData({
                abi: QUOTER_V2_ABI,
                functionName: "quoteExactInputSingle",
                args: [
                    {
                        tokenIn: tokenInMapped,
                        tokenOut: tokenOutMapped,
                        amountIn: BigInt(amountIn),
                        fee: fee,
                        sqrtPriceLimitX96: 0n,
                    },
                ],
            });

            return {
                to: PANCAKE_V3_QUOTER_LINEA,
                data: callData,
                value: 0n,
                decode: (result: `0x${string}`) => {
                    if (!result || result === "0x") return null;
                    try {
                        const decoded = decodeFunctionResult({
                            abi: QUOTER_V2_ABI,
                            functionName: "quoteExactInputSingle",
                            data: result,
                        });

                        // decoded is [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
                        // but viem might return it as an object or array depending on ABI definition.
                        // Since we used parseAbi with named outputs, it usually returns an array or object.
                        // Let's assume array as per standard behavior for tuple returns in viem with parseAbi?
                        // Actually, with `parseAbi`, if outputs are named, it might return an array.
                        // Let's cast to any to be safe or check structure.
                        // The Monad impl casts to [bigint, bigint, number, bigint].

                        const amountOut = (decoded as any)[0];
                        if (amountOut <= 0n) return null;

                        const hop: RouteHop = {
                            dexId: "pancake-v3-linea",
                            dexName: "PancakeSwap V3",
                            kind: "UNISWAP_V3",
                            detail: `Fee: ${fee / 10000}%`,
                            poolOrQuoter: PANCAKE_V3_QUOTER_LINEA,
                            path: [tokenInMapped, tokenOutMapped],
                        };

                        return {
                            chainId: chain.id,
                            dexId: "pancake-v3-linea",
                            dexName: "PancakeSwap V3",
                            amountIn,
                            amountOut: amountOut,
                            hops: [hop],
                        };
                    } catch (e) {
                        return null;
                    }
                },
            };
        });
    },

    async buildSwapCalldata(params) {
        const {
            chainId,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            recipient,
            deadline,
            hops,
        } = params;
        const isNativeIn =
            tokenIn.toLowerCase() === "0x0000000000000000000000000000000000000000";
        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn);
        const tokenOutMapped = normalizeTokenAddressForLinea(tokenOut);

        // Single Hop
        if (hops.length === 1) {
            const hop = hops[0];
            // Parse fee from detail string "Fee: 0.01%" -> 100
            // Detail format: "Fee: 0.01%"
            const feeStr = hop.detail.replace("Fee: ", "").replace("%", "");
            const fee = Math.round(parseFloat(feeStr) * 10000);

            const exactInputSingleArgs = {
                tokenIn: tokenInMapped,
                tokenOut: tokenOutMapped,
                fee: fee,
                recipient: recipient as `0x${string}`,
                amountIn: BigInt(amountIn),
                amountOutMinimum: BigInt(minAmountOut),
                sqrtPriceLimitX96: 0n,
            };

            const data = encodeFunctionData({
                abi: ROUTER_ABI,
                functionName: "exactInputSingle",
                args: [exactInputSingleArgs],
            });

            return {
                to: PANCAKE_V3_ROUTER_ADDRESS,
                data: data,
                value: isNativeIn ? amountIn : 0n,
            };
        } else {
            // Multi Hop
            // Path encoding: tokenIn (20) + fee (3) + tokenMid (20) + fee (3) + tokenOut (20)
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
                abi: ROUTER_ABI,
                functionName: "exactInput",
                args: [
                    {
                        path,
                        recipient: recipient as `0x${string}`,
                        amountIn: BigInt(amountIn),
                        amountOutMinimum: BigInt(minAmountOut),
                    },
                ],
            });

            return {
                to: PANCAKE_V3_ROUTER_ADDRESS,
                data,
                value: isNativeIn ? amountIn : 0n,
            };
        }
    },
};
