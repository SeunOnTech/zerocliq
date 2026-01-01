import { type StoreSlice, type BalanceSlice } from '@/types/store'

/**
 * Token balance with USD pricing
 */
export interface TokenBalance {
    symbol: string
    name: string
    address: `0x${string}`
    decimals: number
    logoURI: string
    balance: number           // Formatted balance (e.g., 1.5 ETH)
    usdPrice: number         // Current USD price
    usdValue: number         // balance * usdPrice
    isNative?: boolean
    isStable?: boolean
    isBlueChip?: boolean
    isLST?: boolean
    chainId?: number         // Optional chain ID for context
}

/**
 * Balance data for a specific wallet
 */
export interface WalletBalanceData {
    address: string
    tokens: TokenBalance[]
    lastUpdated: number      // Timestamp
}

/**
 * Chain-specific balance storage
 */
export interface ChainBalances {
    eoa: WalletBalanceData | null
    smartAccount: WalletBalanceData | null
}

/**
 * Creates the balance slice for the Zustand store.
 * 
 * This slice handles:
 * - Token balances for EOA and Smart Account
 * - Persisted to localStorage for instant load
 * - Per-chain balance storage
 * - Smart invalidation after swaps
 */
export const createBalanceSlice: StoreSlice<BalanceSlice> = (set, get) => ({
    // Balance storage: chainId -> { eoa, smartAccount }
    tokenBalances: {},

    // Fetching state (for deduplication)
    isBalanceFetching: false,
    lastBalanceFetch: null,
    balanceRefreshTrigger: 0, // Used to force refresh from other components

    /**
     * Trigger a balance refresh
     */
    triggerBalanceRefresh: () => set((state) => ({ balanceRefreshTrigger: state.balanceRefreshTrigger + 1 })),

    /**
     * Set balances for a wallet on a chain
     */
    setBalances: (chainId: number, walletType: 'eoa' | 'smartAccount', data: WalletBalanceData) => {
        set((state) => ({
            tokenBalances: {
                ...state.tokenBalances,
                [chainId]: {
                    ...state.tokenBalances[chainId],
                    [walletType]: data
                }
            }
        }))
    },

    /**
     * Get balances for current chain and wallet type
     */
    getBalances: (chainId: number, walletType: 'eoa' | 'smartAccount'): TokenBalance[] => {
        const state = get()
        return state.tokenBalances[chainId]?.[walletType]?.tokens || []
    },

    /**
     * Get balance for a specific token
     */
    getTokenBalance: (chainId: number, tokenAddress: string, walletType: 'eoa' | 'smartAccount' = 'eoa'): TokenBalance | undefined => {
        const state = get()
        const tokens = state.tokenBalances[chainId]?.[walletType]?.tokens || []
        return tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase())
    },

    /**
     * Get total USD value for a wallet
     */
    getTotalUsdValue: (chainId: number, walletType: 'eoa' | 'smartAccount' = 'eoa'): number => {
        const state = get()
        const tokens = state.tokenBalances[chainId]?.[walletType]?.tokens || []
        return tokens.reduce((sum, t) => sum + t.usdValue, 0)
    },

    /**
     * Check if balances are stale (> 30 seconds old)
     */
    isBalanceStale: (chainId: number, walletType: 'eoa' | 'smartAccount' = 'eoa'): boolean => {
        const state = get()
        const lastUpdated = state.tokenBalances[chainId]?.[walletType]?.lastUpdated
        if (!lastUpdated) return true
        return Date.now() - lastUpdated > 30 * 1000 // 30 seconds
    },

    /**
     * Invalidate specific tokens (e.g., after swap)
     * Marks them for refresh without clearing the cache
     */
    invalidateTokens: (chainId: number, tokenAddresses: string[]) => {
        set((state) => {
            const chainBalances = state.tokenBalances[chainId]
            if (!chainBalances) return state

            // Mark as stale by setting lastUpdated to 0
            return {
                tokenBalances: {
                    ...state.tokenBalances,
                    [chainId]: {
                        ...chainBalances,
                        eoa: chainBalances.eoa ? { ...chainBalances.eoa, lastUpdated: 0 } : null,
                        smartAccount: chainBalances.smartAccount ? { ...chainBalances.smartAccount, lastUpdated: 0 } : null
                    }
                }
            }
        })
    },

    /**
     * Clear all balances (e.g., on disconnect)
     */
    clearBalances: () => {
        set({ tokenBalances: {}, lastBalanceFetch: null })
    },

    /**
     * Set fetching state
     */
    setBalanceFetching: (isFetching: boolean) => {
        set({
            isBalanceFetching: isFetching,
            lastBalanceFetch: isFetching ? null : Date.now()
        })
    }
})
