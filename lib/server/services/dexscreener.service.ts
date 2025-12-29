/**
 * DexScreener Price Service
 * 
 * Fetches token prices from DexScreener API with caching.
 * Better for newer chains like Monad where DefiLlama may not have data.
 */

import { LRUCache } from "lru-cache";

interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    liquidity?: {
        usd?: number;
    };
}

interface DexScreenerResponse {
    schemaVersion: string;
    pairs: DexScreenerPair[];
}

// Native Token Mappings (Native -> Wrapped)
const WRAPPED_TOKENS: Record<string, string> = {
    // Monad Mainnet
    "143": "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A", // WMON
    // Linea Mainnet
    "59144": "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f", // WETH
    // Sepolia
    "11155111": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // WETH
    // Ethereum Mainnet
    "1": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class DexScreenerService {
    private cache: LRUCache<string, number>;
    private baseUrl = "https://api.dexscreener.com/latest/dex/tokens";

    constructor() {
        this.cache = new LRUCache({
            max: 500,
            ttl: 1000 * 15, // 15 Seconds
            allowStale: false,
        });
    }

    /**
     * Get prices for multiple tokens efficiently
     */
    async getPrices(tokens: string[], chainId: number): Promise<Record<string, number>> {
        console.log(`DexScreener getPrices: ${tokens.length} tokens for chain ${chainId}`);
        const results: Record<string, number> = {};
        const tokensToFetch: string[] = [];
        const originalToWrappedMap: Record<string, string> = {};

        // 1. Check Cache & Prepare Addresses
        for (const token of tokens) {
            const normalizedToken = token.toLowerCase();

            // Handle Native Token
            let searchAddress = normalizedToken;
            if (normalizedToken === ZERO_ADDRESS) {
                const wrapped = WRAPPED_TOKENS[chainId.toString()];
                if (wrapped) {
                    searchAddress = wrapped.toLowerCase();
                    originalToWrappedMap[searchAddress] = normalizedToken;
                }
            }

            // Check Cache
            const cachedPrice = this.cache.get(searchAddress);
            if (cachedPrice !== undefined) {
                const originalAddr = originalToWrappedMap[searchAddress] || searchAddress;
                results[originalAddr] = cachedPrice;
            } else {
                if (!tokensToFetch.includes(searchAddress)) {
                    tokensToFetch.push(searchAddress);
                    if (normalizedToken === ZERO_ADDRESS) {
                        originalToWrappedMap[searchAddress] = normalizedToken;
                    }
                }
            }
        }

        if (tokensToFetch.length === 0) {
            return results;
        }

        // 2. Fetch from API (Batching up to 30)
        const chunks = this.chunkArray(tokensToFetch, 30);
        const fetchedPrices: Record<string, number> = {};

        for (const chunk of chunks) {
            try {
                const url = `${this.baseUrl}/${chunk.join(',')}`;

                const res = await fetch(url);
                if (!res.ok) continue;

                const data = await res.json() as DexScreenerResponse;

                if (data.pairs) {
                    const bestPairs: Record<string, DexScreenerPair & { _isQuote?: boolean }> = {};

                    for (const pair of data.pairs) {
                        const baseAddr = pair.baseToken.address.toLowerCase();
                        const quoteAddr = pair.quoteToken.address.toLowerCase();

                        // Check if our token is the BASE token
                        if (chunk.includes(baseAddr)) {
                            const currentBest = bestPairs[baseAddr];
                            const currentLiquidity = currentBest?.liquidity?.usd || 0;
                            const newLiquidity = pair.liquidity?.usd || 0;

                            if (newLiquidity > currentLiquidity) {
                                bestPairs[baseAddr] = pair;
                            }
                        }

                        // Check if our token is the QUOTE token
                        if (chunk.includes(quoteAddr)) {
                            const currentBest = bestPairs[quoteAddr];
                            const currentLiquidity = currentBest?.liquidity?.usd || 0;
                            const newLiquidity = pair.liquidity?.usd || 0;

                            if (newLiquidity > currentLiquidity) {
                                bestPairs[quoteAddr] = { ...pair, _isQuote: true };
                            }
                        }
                    }

                    // Store results in temporary map
                    for (const [addr, pair] of Object.entries(bestPairs)) {
                        let price = 0;

                        if (pair._isQuote) {
                            const basePrice = parseFloat(pair.priceUsd);
                            const rate = parseFloat(pair.priceNative);
                            if (!isNaN(basePrice) && !isNaN(rate) && rate !== 0) {
                                price = basePrice / rate;
                            }
                        } else {
                            price = parseFloat(pair.priceUsd);
                        }

                        if (!isNaN(price) && price > 0) {
                            this.cache.set(addr, price);
                            fetchedPrices[addr] = price;
                        }
                    }
                }

            } catch (error) {
                console.error("DexScreener Fetch Error:", error);
            }
        }

        // 3. Map back to original requested tokens
        // This ensures both Native (0x0) and Wrapped (0x...) get the price if they share the same search address
        for (const token of tokens) {
            const normalizedToken = token.toLowerCase();
            let searchAddress = normalizedToken;

            // Resolve Native -> Wrapped
            if (normalizedToken === ZERO_ADDRESS) {
                const wrapped = WRAPPED_TOKENS[chainId.toString()];
                if (wrapped) {
                    searchAddress = wrapped.toLowerCase();
                }
            }

            // Get price from fetched results OR cache
            // Note: We check fetchedPrices first, but if not there (e.g. wasn't in this fetch batch but was cached), 
            // the loop above handled cache misses.
            // Wait, the cache check in step 1 might have skipped fetching. 
            // So we should check cache here too.
            const price = fetchedPrices[searchAddress] ?? this.cache.get(searchAddress);

            if (price !== undefined) {
                results[normalizedToken] = price;
            }
        }

        return results;
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunked: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunked.push(array.slice(i, i + size));
        }
        return chunked;
    }
}

export const dexScreenerService = new DexScreenerService();
