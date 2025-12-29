/**
 * Balances Service
 * 
 * Fetches token balances with USD values using multicall.
 */

import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { getChainById, getViemChain } from '@/lib/server/config/chains';
import { defillamaService } from './defillama.service';
import { dexScreenerService } from './dexscreener.service';
import { LRUCache } from 'lru-cache';

// Basic ERC20 ABI for balanceOf
const erc20Abi = parseAbi([
    'function balanceOf(address owner) view returns (uint256)'
]);

// Chains that should use DexScreener for pricing (more accurate for new chains)
const USE_DEXSCREENER_CHAINS = [143]; // Monad

export class BalancesService {
    private cache: LRUCache<string, any>;

    constructor() {
        this.cache = new LRUCache({
            max: 100,
            ttl: 1000 * 10, // 10 seconds TTL
        });
    }

    async getWalletBalances(walletAddress: string, chainId: number, force = false) {
        const cacheKey = `${walletAddress}-${chainId}`;
        if (!force && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const chainConfig = getChainById(chainId);
        if (!chainConfig) {
            console.error(`Chain ${chainId} not configured`);
            return [];
        }

        try {
            const viemChain = getViemChain(chainId);
            const client = createPublicClient({
                chain: viemChain,
                transport: http()
            });

            const tokens = chainConfig.tokens;

            // Separate Native and ERC20 tokens
            const zeroAddress = '0x0000000000000000000000000000000000000000';
            const erc20Tokens = tokens.filter(t => t.address !== zeroAddress);
            const nativeToken = tokens.find(t => t.address === zeroAddress);

            // Prepare Multicall for ERC20s
            const contracts = erc20Tokens.map(t => ({
                address: t.address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [walletAddress]
            }));

            // Choose pricing service based on chain
            const useDexScreener = USE_DEXSCREENER_CHAINS.includes(chainId);
            console.log(`[Balances] Chain: ${chainId}, Using: ${useDexScreener ? 'DexScreener' : 'DefiLlama'}`);

            // Execute Calls in Parallel
            const [nativeBalance, multicallResults, prices] = await Promise.all([
                client.getBalance({ address: walletAddress as `0x${string}` }),
                client.multicall({ contracts: contracts as any }),
                useDexScreener
                    ? dexScreenerService.getPrices(tokens.map(t => t.address), chainId)
                    : defillamaService.getBatchPrices(tokens.map(t => t.address), chainId)
            ]);

            console.log(`[Balances] Chain: ${chainId}, Address: ${walletAddress}`);

            const resultTokens = [];

            // 1. Process Native Token
            if (nativeToken) {
                const balance = Number(formatUnits(nativeBalance, nativeToken.decimals));
                const price = prices[nativeToken.address.toLowerCase()] || 0;

                resultTokens.push({
                    ...nativeToken,
                    balance,
                    usdPrice: price,
                    usdValue: balance * price,
                    isNative: true
                });
            }

            // 2. Process ERC20 Tokens
            erc20Tokens.forEach((token, index) => {
                const result = multicallResults[index];
                if (result.status === 'success') {
                    const balance = Number(formatUnits(result.result as bigint, token.decimals));
                    const price = prices[token.address.toLowerCase()] || 0;

                    resultTokens.push({
                        ...token,
                        balance,
                        usdPrice: price,
                        usdValue: balance * price,
                        isNative: false
                    });
                } else {
                    console.warn(`Failed to fetch balance for ${token.symbol} on chain ${chainId}`);
                    resultTokens.push({
                        ...token,
                        balance: 0,
                        usdPrice: prices[token.address.toLowerCase()] || 0,
                        usdValue: 0,
                        isNative: false
                    });
                }
            });

            // Sort by USD value descending
            resultTokens.sort((a, b) => b.usdValue - a.usdValue);

            this.cache.set(cacheKey, resultTokens);
            return resultTokens;

        } catch (error) {
            console.error("BalancesService Error:", error);
            return [];
        }
    }
}

export const balancesService = new BalancesService();
