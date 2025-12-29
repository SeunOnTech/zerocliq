import type { DexPlugin, DexQuoteParams, RouteCandidate, SwapParams } from "@/lib/server/dexes/dex.types";
import { encodeFunctionData, decodeFunctionResult, type Address, type Hex } from "viem";
import { normalizeTokenAddressForSepolia } from "@/lib/server/dexes/sepolia/common";

// Uniswap V3 Sepolia Addresses
const QUOTER_V2_ADDRESS = "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3";
const SWAP_ROUTER_02_ADDRESS = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";

// ABIs
const QUOTER_V2_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "fee", type: "uint24" },
                    { name: "sqrtPriceLimitX96", type: "uint160" }
                ],
                name: "params",
                type: "tuple"
            }
        ],
        name: "quoteExactInputSingle",
        outputs: [
            { name: "amountOut", type: "uint256" },
            { name: "sqrtPriceX96After", type: "uint160" },
            { name: "initializedTicksCrossed", type: "uint32" },
            { name: "gasEstimate", type: "uint256" }
        ],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;

const SWAP_ROUTER_02_ABI = [
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
                    { name: "sqrtPriceLimitX96", type: "uint160" }
                ],
                name: "params",
                type: "tuple"
            }
        ],
        name: "exactInputSingle",
        outputs: [{ name: "amountOut", type: "uint256" }],
        stateMutability: "payable",
        type: "function"
    }
] as const;

export const uniswapV3SepoliaPlugin: DexPlugin = {
    id: "uniswap-v3-sepolia",
    name: "Uniswap V3 (Sepolia)",
    kind: "UNISWAP_V3",
    supportedChains: [11155111], // Sepolia
    routerAddress: SWAP_ROUTER_02_ADDRESS,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { tokenIn, tokenOut, amountIn, client } = params;

        const normalizedTokenIn = normalizeTokenAddressForSepolia(tokenIn.address);
        const normalizedTokenOut = normalizeTokenAddressForSepolia(tokenOut.address);

        // Standard Uniswap V3 Fee Tier (0.3%)
        const fee = 3000;

        try {
            const { result } = await client.simulateContract({
                address: QUOTER_V2_ADDRESS,
                abi: QUOTER_V2_ABI,
                functionName: "quoteExactInputSingle",
                args: [{
                    tokenIn: normalizedTokenIn,
                    tokenOut: normalizedTokenOut,
                    amountIn: amountIn,
                    fee: fee,
                    sqrtPriceLimitX96: 0n
                }]
            });

            // result is [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
            const amountOut = result[0];

            return {
                chainId: 11155111,
                dexId: "uniswap-v3-sepolia",
                dexName: "Uniswap V3 (Sepolia)",
                amountIn,
                amountOut,
                hops: [{
                    dexId: "uniswap-v3-sepolia",
                    dexName: "Uniswap V3 (Sepolia)",
                    kind: "UNISWAP_V3",
                    detail: "0.3% Pool",
                    poolOrQuoter: QUOTER_V2_ADDRESS,
                    path: [normalizedTokenIn, normalizedTokenOut]
                }]
            };
        } catch (error) {
            // console.warn(`[Uniswap V3 Sepolia] Quote failed for ${tokenIn.symbol} -> ${tokenOut.symbol}:`, error);
            return null;
        }
    },

    buildQuoteCall(params: DexQuoteParams) {
        console.log("[UniswapV3Sepolia] buildQuoteCall called with:", {
            tokenIn: params.tokenIn.symbol,
            tokenOut: params.tokenOut.symbol,
            amountIn: params.amountIn.toString()
        });

        const { tokenIn, tokenOut, amountIn } = params;
        const normalizedTokenIn = normalizeTokenAddressForSepolia(tokenIn.address);
        const normalizedTokenOut = normalizeTokenAddressForSepolia(tokenOut.address);
        const fee = 3000; // 0.3%

        const data = encodeFunctionData({
            abi: QUOTER_V2_ABI,
            functionName: "quoteExactInputSingle",
            args: [{
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut,
                amountIn: amountIn,
                fee: fee,
                sqrtPriceLimitX96: 0n
            }]
        });

        return [{
            to: QUOTER_V2_ADDRESS,
            data,
            value: 0n,
            decode: (result: Hex) => {
                try {
                    // console.log("[UniswapV3Sepolia] Decoding result:", result);
                    const decoded = decodeFunctionResult({
                        abi: QUOTER_V2_ABI,
                        functionName: "quoteExactInputSingle",
                        data: result
                    });

                    const amountOut = decoded[0];
                    console.log("[UniswapV3Sepolia] Decoded amountOut:", amountOut?.toString());

                    if (!amountOut) return null;

                    return {
                        chainId: 11155111,
                        dexId: "uniswap-v3-sepolia",
                        dexName: "Uniswap V3 (Sepolia)",
                        amountIn,
                        amountOut,
                        hops: [{
                            dexId: "uniswap-v3-sepolia",
                            dexName: "Uniswap V3 (Sepolia)",
                            kind: "UNISWAP_V3",
                            detail: "0.3% Pool",
                            poolOrQuoter: QUOTER_V2_ADDRESS,
                            path: [normalizedTokenIn, normalizedTokenOut]
                        }]
                    };
                } catch (e) {
                    console.error("[UniswapV3Sepolia] Decode failed:", e);
                    return null;
                }
            }
        }];
    },

    async buildSwapCalldata(params: SwapParams): Promise<{
        to: Address;
        data: Hex;
        value: bigint;
    }> {
        const { tokenIn, tokenOut, amountIn, minAmountOut, recipient } = params;

        const normalizedTokenIn = normalizeTokenAddressForSepolia(tokenIn);
        const normalizedTokenOut = normalizeTokenAddressForSepolia(tokenOut);

        // Standard Uniswap V3 Fee Tier (0.3%)
        const fee = 3000;

        const calldata = encodeFunctionData({
            abi: SWAP_ROUTER_02_ABI,
            functionName: "exactInputSingle",
            args: [{
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut,
                fee: fee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0n
            }]
        });

        return {
            to: SWAP_ROUTER_02_ADDRESS,
            data: calldata,
            value: tokenIn === "0x0000000000000000000000000000000000000000" ? amountIn : 0n
        };
    }
};
