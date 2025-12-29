import { type StoreSlice } from '@/types/store'

/**
 * Price slice state and actions
 */
export interface PriceSlice {
    // Price storage: chainId -> address (lowercase) -> USD price
    tokenPrices: Record<number, Record<string, number>>

    // Last update timestamp per chain
    lastPriceUpdate: Record<number, number>

    // Fetching state
    isPriceFetching: boolean

    // Actions
    setPrices: (chainId: number, prices: Record<string, number>) => void
    getPrice: (chainId: number, tokenAddress: string) => number | null
    isPriceStale: (chainId: number) => boolean
    clearPrices: () => void
}

const PRICE_STALE_THRESHOLD = 30 * 1000 // 30 seconds

/**
 * Creates the price slice for the Zustand store.
 * 
 * This slice handles:
 * - Token USD prices fetched from DEXScreener via backend
 * - Per-chain price storage with timestamps
 * - Stale detection for refresh logic
 */
export const createPriceSlice: StoreSlice<PriceSlice> = (set, get) => ({
    tokenPrices: {},
    lastPriceUpdate: {},
    isPriceFetching: false,

    /**
     * Set prices for multiple tokens on a chain
     */
    setPrices: (chainId: number, prices: Record<string, number>) => {
        // Normalize addresses to lowercase
        const normalizedPrices: Record<string, number> = {}
        for (const [addr, price] of Object.entries(prices)) {
            normalizedPrices[addr.toLowerCase()] = price
        }

        set((state) => ({
            tokenPrices: {
                ...state.tokenPrices,
                [chainId]: {
                    ...state.tokenPrices[chainId],
                    ...normalizedPrices
                }
            },
            lastPriceUpdate: {
                ...state.lastPriceUpdate,
                [chainId]: Date.now()
            },
            isPriceFetching: false
        }))
    },

    /**
     * Get price for a specific token
     */
    getPrice: (chainId: number, tokenAddress: string): number | null => {
        const state = get()
        const chainPrices = state.tokenPrices[chainId]
        if (!chainPrices) return null
        return chainPrices[tokenAddress.toLowerCase()] ?? null
    },

    /**
     * Check if prices are stale (> 30 seconds old)
     */
    isPriceStale: (chainId: number): boolean => {
        const state = get()
        const lastUpdate = state.lastPriceUpdate[chainId]
        if (!lastUpdate) return true
        return Date.now() - lastUpdate > PRICE_STALE_THRESHOLD
    },

    /**
     * Clear all prices (e.g., on disconnect)
     */
    clearPrices: () => {
        set({ tokenPrices: {}, lastPriceUpdate: {}, isPriceFetching: false })
    }
})
