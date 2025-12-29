import {
    DexPlugin,
    DexQuoteParams,
    RouteCandidate,
    RouteHop,
    SwapParams,
} from "@/lib/server/dexes/dex.types";
import { normalizeTokenAddressForLinea } from "@/lib/server/dexes/linea/common";
import {
    encodeFunctionData,
    parseAbi,
    decodeFunctionResult,
    encodePacked,
} from "viem";

// Nile (Uni V3)
const NILE_ROUTER = "0xAAA45c8F5ef92a000a121d102F4e89278a711Faa" as const;
const NILE_QUOTER_V2 = "0xAAAEA10b0e6FBe566FE27c3A023DC5D8cA6Bca3d" as const;

// QuoterV2 ABI
// QuoterV2 ABI
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

// Router ABI
const ROUTER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "fee", type: "uint24" },
                    { name: "recipient", type: "address" },
                    { name: "deadline", type: "uint256" },
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
                    { name: "deadline", type: "uint256" },
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

const FEES = [100, 500, 2500, 10000]; // 0.01%, 0.05%, 0.25%, 1%

export const NilePlugin: DexPlugin = {
    id: "nile-exchange",
    name: "Nile Exchange",
    kind: "UNISWAP_V3",
    supportedChains: [59144], // Linea
    routerAddress: NILE_ROUTER,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn.address);
        const tokenOutMapped = normalizeTokenAddressForLinea(tokenOut.address);

        if (tokenInMapped === tokenOutMapped) return null;

        let bestRoute: RouteCandidate | null = null;

        // Parallelize calls for all fee tiers
        const quotePromises = FEES.map(async (fee) => {
            try {
                const result = await client.simulateContract({
                    address: NILE_QUOTER_V2,
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

                const amountOut = result.result[0];
                return { fee, amountOut };
            } catch (e) {
                return null;
            }
        });

        const results = await Promise.all(quotePromises);

        for (const res of results) {
            if (res && res.amountOut > 0n) {
                if (!bestRoute || res.amountOut > BigInt(bestRoute.amountOut)) {
                    const hop: RouteHop = {
                        dexId: "nile-exchange",
                        dexName: "Nile Exchange",
                        kind: "UNISWAP_V3",
                        detail: `Fee: ${res.fee / 10000}%`,
                        poolOrQuoter: NILE_QUOTER_V2,
                        path: [tokenInMapped, tokenOutMapped],
                    };

                    bestRoute = {
                        chainId: chain.id,
                        dexId: "nile-exchange",
                        dexName: "Nile Exchange",
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
                to: NILE_QUOTER_V2,
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
                        const amountOut = (decoded as any)[0];
                        if (amountOut <= 0n) return null;

                        return {
                            chainId: chain.id,
                            dexId: "nile-exchange",
                            dexName: "Nile Exchange",
                            amountIn,
                            amountOut,
                            hops: [
                                {
                                    dexId: "nile-exchange",
                                    dexName: "Nile Exchange",
                                    kind: "UNISWAP_V3",
                                    detail: `Fee: ${fee / 10000}%`,
                                    poolOrQuoter: NILE_QUOTER_V2,
                                    path: [tokenInMapped, tokenOutMapped],
                                },
                            ],
                        };
                    } catch (e) {
                        return null;
                    }
                },
            };
        });
    },

    async buildSwapCalldata(params: SwapParams) {
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

        if (hops.length === 1) {
            const hop = hops[0];
            const feeStr = hop.detail.replace("Fee: ", "").replace("%", "");
            const fee = Math.round(parseFloat(feeStr) * 10000);

            const args = {
                tokenIn: tokenInMapped,
                tokenOut: tokenOutMapped,
                fee: fee,
                recipient: recipient as `0x${string}`,
                deadline: BigInt(deadline),
                amountIn: BigInt(amountIn),
                amountOutMinimum: BigInt(minAmountOut),
                sqrtPriceLimitX96: 0n,
            };

            const data = encodeFunctionData({
                abi: ROUTER_ABI,
                functionName: "exactInputSingle",
                args: [args],
            });

            return {
                to: NILE_ROUTER,
                data,
                value: isNativeIn ? amountIn : 0n,
            };
        } else {
            // Multi-hop
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

            const args = {
                path,
                recipient: recipient as `0x${string}`,
                deadline: BigInt(deadline),
                amountIn: BigInt(amountIn),
                amountOutMinimum: BigInt(minAmountOut),
            };

            const data = encodeFunctionData({
                abi: ROUTER_ABI,
                functionName: "exactInput",
                args: [args],
            });

            return {
                to: NILE_ROUTER,
                data,
                value: isNativeIn ? amountIn : 0n,
            };
        }
    },
};
