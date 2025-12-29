/**
 * Swap Service
 * 
 * Aggregates DEX quotes and builds swap execution data.
 * Uses multicall for efficient quote batching.
 */

import { createPublicClient, http, type PublicClient, encodeFunctionData } from "viem";
import {
    getChainById,
    type ChainConfig,
    type TokenInfo,
} from "@/lib/server/config/chains";

import { dexPlugins } from "@/lib/server/dexes/index";
import type {
    DexPlugin,
    RouteCandidate,
    RouteHop,
} from "@/lib/server/dexes/dex.types";

// Types for swap service
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

export interface TransactionRequest {
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
    description?: string;
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
        priceImpactBps?: number;
        confidenceScore?: number;
        gasEstimate?: string;
    } | null;
    alternatives: any[];
    execution?: {
        approvals: TransactionRequest[];
        swap: TransactionRequest;
    };
    debug?: any;
    error?: string;
}

// Standard ERC20 ABI for allowance/approve
const ERC20_ABI = [
    {
        constant: true,
        inputs: [
            { name: "_owner", type: "address" },
            { name: "_spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
    {
        constant: false,
        inputs: [
            { name: "_spender", type: "address" },
            { name: "_value", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

// Simple cache for no-liquidity pairs
const noLiquidityCache = new Map<string, boolean>();

export class SwapService {
    /**
     * Main entry point: Get best swap quote
     */
    async getQuote(params: SwapQuoteRequest): Promise<SwapQuoteResponse> {
        const {
            chainId,
            tokenIn,
            tokenOut,
            amountIn,
            amountInRaw = true,
            slippageBps = 50,
            debugRoutes = false,
            userAddress,
            deadline,
        } = params;

        const chain = getChainById(chainId);
        if (!chain) throw new Error(`Unsupported chainId: ${chainId}`);

        // 1. Validate tokens
        const inToken = this.findToken(chain.tokens, tokenIn);
        const outToken = this.findToken(chain.tokens, tokenOut);

        if (!inToken) throw new Error(`TokenIn not supported: ${tokenIn}`);
        if (!outToken) throw new Error(`TokenOut not supported: ${tokenOut}`);

        // 2. Parse amount
        let amountInBigInt: bigint;
        try {
            if (amountInRaw) {
                amountInBigInt = BigInt(amountIn);
            } else {
                amountInBigInt = this.parseAmountToUnits(amountIn, inToken.decimals);
            }
        } catch (e) {
            throw new Error(`Invalid amountIn: ${amountIn}`);
        }

        if (amountInBigInt <= 0n) throw new Error("Amount must be > 0");

        const client = createPublicClient({
            chain: {
                id: chain.id,
                name: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: { default: { http: [chain.rpcUrl] }, public: { http: [chain.rpcUrl] } },
                contracts: {
                    multicall3: {
                        address: "0xcA11bde05977b3631167028862bE2a173976CA11",
                        blockCreated: 0,
                    },
                },
            } as any,
            transport: http(chain.rpcUrl),
        });

        // 4. Filter plugins for this chain
        const pluginsOnChain = dexPlugins.filter((p) => p.supportedChains.includes(chainId));
        if (pluginsOnChain.length === 0) {
            throw new Error(`No DEX plugins configured for chainId ${chainId}`);
        }

        // 5. Get quotes from all plugins
        const allCandidates: RouteCandidate[] = [];

        try {
            const candidates = await this.quoteAllPlugins({
                plugins: pluginsOnChain,
                chain,
                tokenIn: inToken,
                tokenOut: outToken,
                amountIn: amountInBigInt,
                client: client as any,
            });

            allCandidates.push(...candidates);
        } catch (e) {
            console.error("[SwapService] quoteAllPlugins error:", e);
        }

        if (allCandidates.length === 0) {
            return {
                success: false,
                request: {
                    chainId,
                    tokenIn,
                    tokenOut,
                    amountIn,
                    amountInRaw: amountInRaw.toString(),
                },
                bestRoute: null,
                alternatives: [],
                error: "No viable routes found on any DEX (no pools/liquidity)",
            };
        }

        // 7) Pick best by max amountOut
        const best = allCandidates.reduce((a, b) =>
            a.amountOut >= b.amountOut ? a : b
        );

        const minAmountOut = this.applySlippage(best.amountOut, slippageBps);

        // 8) Build execution if userAddress provided
        let execution: SwapQuoteResponse["execution"] | undefined;

        if (userAddress) {
            try {
                execution = await this.buildExecution({
                    route: { ...best, minAmountOut },
                    userAddress: userAddress as `0x${string}`,
                    deadline: deadline || Math.floor(Date.now() / 1000) + 1200,
                    client: client as any,
                    tokenIn: inToken,
                });
            } catch (e) {
                console.warn("[SwapService] buildExecution failed:", e);
            }
        }

        return {
            success: true,
            request: {
                chainId,
                tokenIn,
                tokenOut,
                amountIn,
                amountInRaw: amountInRaw.toString(),
            },
            bestRoute: {
                dexId: best.dexId,
                dexName: best.dexName,
                amountOut: best.amountOut.toString(),
                minAmountOut: minAmountOut.toString(),
                hops: best.hops,
                priceImpactBps: 0,
                confidenceScore: 100,
            },
            alternatives: allCandidates
                .filter((c) => c !== best)
                .map((c) => ({
                    dexId: c.dexId,
                    dexName: c.dexName,
                    amountOut: c.amountOut.toString(),
                    hops: c.hops,
                })),
            execution,
        };
    }

    /**
     * Build execution data (approvals + swap transaction)
     */
    public async buildExecution(params: {
        route: RouteCandidate & { minAmountOut: bigint };
        userAddress: `0x${string}`;
        deadline: number;
        client: PublicClient;
        tokenIn: TokenInfo;
        recipient?: `0x${string}`;
    }): Promise<SwapQuoteResponse["execution"]> {
        const { route, userAddress, deadline, client, tokenIn, recipient } = params;

        const plugin = dexPlugins.find((p) => p.id === route.dexId) as any;
        if (!plugin) throw new Error(`Plugin not found for dexId: ${route.dexId}`);

        if (!plugin.buildSwapCalldata) {
            throw new Error(`Execution not supported for DEX: ${plugin.name}`);
        }

        // 1. Check approvals (only if tokenIn is NOT native ETH)
        const approvals: TransactionRequest[] = [];
        const isNative = tokenIn.address === "0x0000000000000000000000000000000000000000";

        if (!isNative && plugin.routerAddress) {
            const router = plugin.routerAddress;
            const allowance = await client.readContract({
                address: tokenIn.address as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [userAddress, router],
            });

            if (allowance < route.amountIn) {
                const data = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [router, route.amountIn],
                });

                approvals.push({
                    to: tokenIn.address as `0x${string}`,
                    data,
                    value: "0",
                    description: `Approve ${tokenIn.symbol} for ${plugin.name}`,
                });
            }
        }

        // 2. Build swap transaction
        const lastHop = route.hops[route.hops.length - 1];
        const swapTx = await plugin.buildSwapCalldata({
            chainId: route.chainId,
            tokenIn: tokenIn.address as `0x${string}`,
            tokenOut: lastHop.path[lastHop.path.length - 1],
            amountIn: route.amountIn,
            minAmountOut: route.minAmountOut,
            recipient: recipient || userAddress,
            deadline,
            hops: route.hops,
        });

        return {
            approvals,
            swap: {
                to: swapTx.to,
                data: swapTx.data,
                value: swapTx.value.toString(),
                description: `Swap ${tokenIn.symbol} on ${plugin.name}`,
            },
        };
    }

    /**
     * Quote from all plugins concurrently
     */
    private async quoteAllPlugins(params: {
        plugins: DexPlugin[];
        chain: ChainConfig;
        tokenIn: TokenInfo;
        tokenOut: TokenInfo;
        amountIn: bigint;
        client: PublicClient;
    }): Promise<RouteCandidate[]> {
        const { plugins, chain, tokenIn, tokenOut, amountIn, client } = params;
        const candidates: RouteCandidate[] = [];

        // Execute quotes in parallel
        const quotePromises = plugins.map(async (plugin) => {
            try {
                if (plugin.quoteSingleHop) {
                    const result = await plugin.quoteSingleHop({
                        chain,
                        tokenIn,
                        tokenOut,
                        amountIn,
                        client,
                    });
                    if (result) {
                        return result;
                    }
                }
            } catch (e) {
                console.warn(`[SwapService] Quote failed for ${plugin.name}:`, e);
            }
            return null;
        });

        const results = await Promise.all(quotePromises);

        for (const result of results) {
            if (result) {
                candidates.push(result);
            }
        }

        return candidates;
    }

    /**
     * Lookup token by address
     */
    private findToken(tokens: TokenInfo[], address: string): TokenInfo | undefined {
        return tokens.find(
            (t) => t.address.toLowerCase() === address.toLowerCase()
        );
    }

    /**
     * Helper: parse human string "1.23" -> bigint units
     */
    private parseAmountToUnits(amount: string, decimals: number): bigint {
        const [whole, fraction = ""] = amount.split(".");
        const padding = decimals - fraction.length;
        if (padding < 0) {
            return BigInt(whole + fraction.slice(0, decimals));
        }
        return BigInt(whole + fraction + "0".repeat(padding));
    }

    /**
     * Helper: apply slippage
     */
    private applySlippage(amountOut: bigint, slippageBps: number): bigint {
        return (amountOut * BigInt(10000 - slippageBps)) / 10000n;
    }
}

export const swapService = new SwapService();
