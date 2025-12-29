/**
 * DefiLlama Price Service
 * 
 * Fetches token prices from DefiLlama API with caching.
 */

import { LRUCache } from "lru-cache";

interface PricePoint {
    timestamp: number;
    price: number;
}

interface HistoricalPriceResponse {
    coins: {
        [key: string]: {
            price: number;
            symbol: string;
            timestamp: number;
            confidence: number;
        };
    };
}

interface CurrentPriceResponse {
    coins: {
        [key: string]: {
            price: number;
            symbol: string;
            decimals?: number;
            timestamp: number;
            confidence: number;
        };
    };
}

// Chain ID to DefiLlama chain name map
const CHAIN_NAME_MAP: Record<number, string> = {
    1: "ethereum",
    56: "bsc",
    137: "polygon",
    42161: "arbitrum",
    10: "optimism",
    8453: "base",
    59144: "linea",
    11155111: "ethereum", // Sepolia - use mainnet for pricing
    143: "ethereum", // Monad - use mainnet for pricing (fallback)
};

// Wrapped native tokens for native balance pricing
const WRAPPED_NATIVE_TOKENS: Record<number, string> = {
    1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    56: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
    137: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
    42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
    10: "0x4200000000000000000000000000000000000006", // WETH
    8453: "0x4200000000000000000000000000000000000006", // WETH
    59144: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f", // WETH
    11155111: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH (mainnet)
    143: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH (mainnet fallback)
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class DefilllamaService {
    private baseURL = "https://coins.llama.fi";
    private priceCache: LRUCache<string, number>;

    constructor() {
        // High-performance cache: 500 items, 15 seconds TTL
        this.priceCache = new LRUCache({
            max: 500,
            ttl: 1000 * 15, // 15 seconds
            allowStale: false,
        });
    }

    /**
     * Get batch prices for multiple tokens (HIGH PERFORMANCE)
     * Uses DefiLlama's batch endpoint + LRU cache
     */
    async getBatchPrices(
        tokens: string[],
        chainId: number
    ): Promise<Record<string, number>> {
        const chainName = CHAIN_NAME_MAP[chainId] || "ethereum";
        const results: Record<string, number> = {};
        const tokensToFetch: string[] = [];
        const nativeTokenMapping: Record<string, string> = {};

        // 1. Check cache & prepare coin IDs
        for (const token of tokens) {
            const normalizedToken = token.toLowerCase();
            let searchToken = normalizedToken;

            // Handle native token by mapping to wrapped
            if (normalizedToken === ZERO_ADDRESS) {
                const wrapped = WRAPPED_NATIVE_TOKENS[chainId];
                if (wrapped) {
                    searchToken = wrapped.toLowerCase();
                    nativeTokenMapping[searchToken] = ZERO_ADDRESS;
                }
            }

            const coinId = `${chainName}:${searchToken}`;
            const cachedPrice = this.priceCache.get(coinId);

            if (cachedPrice !== undefined) {
                const resultKey = nativeTokenMapping[searchToken] || normalizedToken;
                results[resultKey] = cachedPrice;
            } else {
                if (!tokensToFetch.includes(searchToken)) {
                    tokensToFetch.push(searchToken);
                }
            }
        }

        if (tokensToFetch.length === 0) {
            return results;
        }

        // 2. Batch fetch from DefiLlama
        try {
            const coinIds = tokensToFetch.map(t => `${chainName}:${t}`).join(",");
            const url = `${this.baseURL}/prices/current/${coinIds}`;

            const response = await fetch(url);
            if (!response.ok) {
                console.error(`DefiLlama API error: ${response.status}`);
                return results;
            }

            const data: CurrentPriceResponse = await response.json();

            // 3. Process results
            for (const token of tokensToFetch) {
                const coinId = `${chainName}:${token}`;
                const coinData = data.coins[coinId];

                if (coinData?.price) {
                    this.priceCache.set(coinId, coinData.price);
                    const resultKey = nativeTokenMapping[token] || token;
                    results[resultKey] = coinData.price;
                }
            }
        } catch (error) {
            console.error("DefiLlama batch fetch error:", error);
        }

        return results;
    }

    /**
     * Get historical price chart data for a token by fetching multiple snapshots
     */
    async getPriceChart(
        chainName: string,
        tokenAddress: string,
        span: number = 1
    ): Promise<PricePoint[]> {
        try {
            const coinId = `${chainName}:${tokenAddress}`;
            const now = Math.floor(Date.now() / 1000);
            const startTime = now - span * 24 * 60 * 60;

            const numPoints = this.getDataPoints(span);
            const interval = Math.floor((span * 24 * 60 * 60) / (numPoints - 1));

            const timestamps: number[] = [];
            for (let i = 0; i < numPoints; i++) {
                timestamps.push(startTime + i * interval);
            }

            const pricePromises = timestamps.map(ts =>
                this.getPriceAtTimestamp(coinId, ts)
            );

            const results = await Promise.all(pricePromises);

            return results
                .filter((result): result is PricePoint => result !== null)
                .sort((a, b) => a.timestamp - b.timestamp);
        } catch (error) {
            console.error("DeFiLlama price chart error:", error);
            return [];
        }
    }

    private async getPriceAtTimestamp(
        coinId: string,
        timestamp: number
    ): Promise<PricePoint | null> {
        try {
            const url = `${this.baseURL}/prices/historical/${timestamp}/${coinId}`;
            const response = await fetch(url);

            if (!response.ok) {
                return null;
            }

            const data: HistoricalPriceResponse = await response.json();
            const coinData = data.coins[coinId];

            if (!coinData || !coinData.price) {
                return null;
            }

            return {
                timestamp: timestamp,
                price: coinData.price,
            };
        } catch (error) {
            console.error(`Failed to fetch price at timestamp ${timestamp}:`, error);
            return null;
        }
    }

    async getCurrentPrice(
        chainName: string,
        tokenAddress: string
    ): Promise<number | null> {
        try {
            const coinId = `${chainName}:${tokenAddress}`;
            const url = `${this.baseURL}/prices/current/${coinId}`;

            const response = await fetch(url);

            if (!response.ok) {
                console.error(
                    `DeFiLlama API error: ${response.status} ${response.statusText}`
                );
                return null;
            }

            const data = await response.json();
            const coinData = data.coins[coinId];

            return coinData?.price || null;
        } catch (error) {
            console.error("DeFiLlama current price error:", error);
            return null;
        }
    }

    private getDataPoints(span: number): number {
        if (span <= 1) return 24;
        if (span <= 7) return 28;
        if (span <= 30) return 30;
        if (span <= 365) return 52;
        return 60;
    }

    static getChainName(chainId: number): string {
        return CHAIN_NAME_MAP[chainId] || "ethereum";
    }
}

export const defillamaService = new DefilllamaService();
