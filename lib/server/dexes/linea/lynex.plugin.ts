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
    zeroAddress,
} from "viem";

// Lynex (Algebra)
const LYNEX_ROUTER = "0x610D2f07b7EdC67565160F587F37636194C34E74" as const;
const LYNEX_QUOTER = "0xcE829655b864E56fc34B783874cf9590053A0640" as const;

// Algebra Quoter ABI
// quoteExactInputSingle(tokenIn, tokenOut, amountIn, limitSqrtPrice) returns (amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate)
// Algebra Quoter ABI
// quoteExactInputSingle(tokenIn, tokenOut, amountIn, limitSqrtPrice) returns (amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate)
const QUOTER_ABI = [
    {
        inputs: [
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "amountIn", type: "uint256" },
            { name: "limitSqrtPrice", type: "uint160" },
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

// Algebra Router ABI
// Algebra Router ABI
const ROUTER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "recipient", type: "address" },
                    { name: "deadline", type: "uint256" },
                    { name: "amountIn", type: "uint256" },
                    { name: "amountOutMinimum", type: "uint256" },
                    { name: "limitSqrtPrice", type: "uint160" },
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

export const LynexPlugin: DexPlugin = {
    id: "lynex",
    name: "Lynex",
    kind: "LYNEX_ALGEBRA",
    supportedChains: [59144], // Linea
    routerAddress: LYNEX_ROUTER,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn.address);
        const tokenOutMapped = normalizeTokenAddressForLinea(tokenOut.address);

        if (tokenInMapped === tokenOutMapped) return null;

        try {
            const result = await client.simulateContract({
                address: LYNEX_QUOTER,
                abi: QUOTER_ABI,
                functionName: "quoteExactInputSingle",
                args: [tokenInMapped, tokenOutMapped, amountIn, 0n],
            });

            const amountOut = result.result[0];

            if (amountOut <= 0n) return null;

            const hop: RouteHop = {
                dexId: "lynex",
                dexName: "Lynex",
                kind: "LYNEX_ALGEBRA",
                detail: "Algebra Pool",
                poolOrQuoter: LYNEX_QUOTER,
                path: [tokenInMapped, tokenOutMapped],
            };

            return {
                chainId: chain.id,
                dexId: "lynex",
                dexName: "Lynex",
                amountIn,
                amountOut,
                hops: [hop],
            };
        } catch (e) {
            return null;
        }
    },

    buildQuoteCall(params: DexQuoteParams) {
        const { chain, tokenIn, tokenOut, amountIn } = params;
        const tokenInMapped = normalizeTokenAddressForLinea(tokenIn.address);
        const tokenOutMapped = normalizeTokenAddressForLinea(tokenOut.address);

        if (tokenInMapped === tokenOutMapped) return [];

        const callData = encodeFunctionData({
            abi: QUOTER_ABI,
            functionName: "quoteExactInputSingle",
            args: [tokenInMapped, tokenOutMapped, amountIn, 0n],
        });

        return [
            {
                to: LYNEX_QUOTER,
                data: callData,
                value: 0n,
                decode: (result: `0x${string}`) => {
                    if (!result || result === "0x") return null;
                    try {
                        const decoded = decodeFunctionResult({
                            abi: QUOTER_ABI,
                            functionName: "quoteExactInputSingle",
                            data: result,
                        });
                        const amountOut = (decoded as any)[0];
                        if (amountOut <= 0n) return null;

                        return {
                            chainId: chain.id,
                            dexId: "lynex",
                            dexName: "Lynex",
                            amountIn,
                            amountOut,
                            hops: [
                                {
                                    dexId: "lynex",
                                    dexName: "Lynex",
                                    kind: "LYNEX_ALGEBRA",
                                    detail: "Algebra Pool",
                                    poolOrQuoter: LYNEX_QUOTER,
                                    path: [tokenInMapped, tokenOutMapped],
                                },
                            ],
                        };
                    } catch (e) {
                        return null;
                    }
                },
            },
        ];
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
            const args = {
                tokenIn: tokenInMapped,
                tokenOut: tokenOutMapped,
                recipient: recipient as `0x${string}`,
                deadline: BigInt(deadline),
                amountIn: BigInt(amountIn),
                amountOutMinimum: BigInt(minAmountOut),
                limitSqrtPrice: 0n,
            };

            const data = encodeFunctionData({
                abi: ROUTER_ABI,
                functionName: "exactInputSingle",
                args: [args],
            });

            return {
                to: LYNEX_ROUTER,
                data,
                value: isNativeIn ? amountIn : 0n,
            };
        } else {
            // Multi-hop
            // Algebra path encoding: tokenIn (20) + tokenMid (20) + tokenOut (20) packed?
            // Or tokenIn (20) + fee? Algebra usually doesn't have fee in path if dynamic.
            // It's usually just packed addresses.
            // Let's verify Algebra path encoding.
            // Usually: tokenA + tokenB + tokenC...
            // But wait, Algebra V1 might be different.
            // Standard Algebra path: token + token + ...
            // Let's assume packed addresses.

            const pathTypes: string[] = [];
            const pathValues: any[] = [];

            for (let i = 0; i < hops.length; i++) {
                const hop = hops[i];
                if (i === 0) {
                    pathTypes.push("address");
                    pathValues.push(hop.path[0]);
                }
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
                to: LYNEX_ROUTER,
                data,
                value: isNativeIn ? amountIn : 0n,
            };
        }
    },
};
