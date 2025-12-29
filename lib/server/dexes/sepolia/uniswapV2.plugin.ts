import type { DexPlugin, DexQuoteParams, RouteCandidate, SwapParams } from "@/lib/server/dexes/dex.types";
import { encodeFunctionData, decodeFunctionResult, parseAbi, type Address, type Hex } from "viem";
import { normalizeTokenAddressForSepolia } from "@/lib/server/dexes/sepolia/common";

// Uniswap V2 Sepolia Addresses
const FACTORY_ADDRESS = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6" as Address;
const ROUTER_02_ADDRESS = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3" as Address;

// ABIs
const ROUTER_02_ABI = parseAbi([
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
]);

export const uniswapV2SepoliaPlugin: DexPlugin = {
    id: "uniswap-v2-sepolia",
    name: "Uniswap V2 (Sepolia)",
    kind: "UNIV2_LIKE",
    supportedChains: [11155111], // Sepolia
    routerAddress: ROUTER_02_ADDRESS,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { tokenIn, tokenOut, amountIn, client } = params;

        const normalizedTokenIn = normalizeTokenAddressForSepolia(tokenIn.address);
        const normalizedTokenOut = normalizeTokenAddressForSepolia(tokenOut.address);

        try {
            const { result } = await client.simulateContract({
                address: ROUTER_02_ADDRESS,
                abi: ROUTER_02_ABI,
                functionName: "getAmountsOut" as any,
                args: [amountIn, [normalizedTokenIn, normalizedTokenOut]] as any
            });

            // result is uint[] memory amounts, where amounts[1] is output
            const amountOut = result[1];

            return {
                chainId: 11155111,
                dexId: "uniswap-v2-sepolia",
                dexName: "Uniswap V2 (Sepolia)",
                amountIn,
                amountOut,
                hops: [{
                    dexId: "uniswap-v2-sepolia",
                    dexName: "Uniswap V2 (Sepolia)",
                    kind: "UNIV2_LIKE",
                    detail: "V2 Pool",
                    poolOrQuoter: FACTORY_ADDRESS,
                    path: [normalizedTokenIn, normalizedTokenOut]
                }]
            };
        } catch (error) {
            // console.warn(`[Uniswap V2 Sepolia] Quote failed for ${tokenIn.symbol} -> ${tokenOut.symbol}:`, error);
            return null;
        }
    },

    buildQuoteCall(params: DexQuoteParams) {
        console.log("[UniswapV2Sepolia] buildQuoteCall called with:", {
            tokenIn: params.tokenIn.symbol,
            tokenOut: params.tokenOut.symbol,
            amountIn: params.amountIn.toString()
        });

        const { tokenIn, tokenOut, amountIn } = params;
        const normalizedTokenIn = normalizeTokenAddressForSepolia(tokenIn.address);
        const normalizedTokenOut = normalizeTokenAddressForSepolia(tokenOut.address);

        const data = encodeFunctionData({
            abi: ROUTER_02_ABI,
            functionName: "getAmountsOut",
            args: [amountIn, [normalizedTokenIn, normalizedTokenOut]]
        });

        return [{
            to: ROUTER_02_ADDRESS,
            data,
            value: 0n,
            decode: (result: Hex) => {
                try {
                    // console.log("[UniswapV2Sepolia] Decoding result:", result);
                    const decoded = decodeFunctionResult({
                        abi: ROUTER_02_ABI,
                        functionName: "getAmountsOut",
                        data: result
                    });

                    // result is uint[] memory amounts, where amounts[1] is output
                    const amountOut = decoded[1];
                    console.log("[UniswapV2Sepolia] Decoded amountOut:", amountOut?.toString());

                    if (!amountOut) return null;

                    return {
                        chainId: 11155111,
                        dexId: "uniswap-v2-sepolia",
                        dexName: "Uniswap V2 (Sepolia)",
                        amountIn,
                        amountOut,
                        hops: [{
                            dexId: "uniswap-v2-sepolia",
                            dexName: "Uniswap V2 (Sepolia)",
                            kind: "UNIV2_LIKE",
                            detail: "V2 Pool",
                            poolOrQuoter: FACTORY_ADDRESS,
                            path: [normalizedTokenIn, normalizedTokenOut]
                        }]
                    };
                } catch (e) {
                    console.error("[UniswapV2Sepolia] Decode failed:", e);
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
        const { tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadline } = params;

        const normalizedTokenIn = normalizeTokenAddressForSepolia(tokenIn);
        const normalizedTokenOut = normalizeTokenAddressForSepolia(tokenOut);
        const path = [normalizedTokenIn, normalizedTokenOut];

        let functionName = "swapExactTokensForTokens";
        let args: any[] = [amountIn, minAmountOut, path, recipient, BigInt(deadline)];
        let value: bigint = 0n;

        // Handle ETH swaps
        if (tokenIn === "0x0000000000000000000000000000000000000000") {
            functionName = "swapExactETHForTokens";
            args = [minAmountOut, path, recipient, BigInt(deadline)];
            value = amountIn;
        } else if (tokenOut === "0x0000000000000000000000000000000000000000") {
            functionName = "swapExactTokensForETH";
            args = [amountIn, minAmountOut, path, recipient, BigInt(deadline)];
        }

        const calldata = encodeFunctionData({
            abi: ROUTER_02_ABI,
            functionName: functionName as any,
            args: args as any
        });

        return {
            to: ROUTER_02_ADDRESS,
            data: calldata,
            value: value
        };
    }
};
