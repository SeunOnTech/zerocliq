import { StateCreator } from 'zustand'
import type { AppStore } from '@/types/store'

export interface SwapToken {
    symbol: string
    address: string
    logoURI?: string
}

export interface SwapSlice {
    // Current swap tokens (for chart sync)
    swapSellToken: SwapToken | null
    swapBuyToken: SwapToken | null

    // Actions
    setSwapTokens: (sellToken: SwapToken, buyToken: SwapToken) => void
    clearSwapTokens: () => void
}

export const createSwapSlice: StateCreator<AppStore, [], [], SwapSlice> = (set) => ({
    swapSellToken: null,
    swapBuyToken: null,

    setSwapTokens: (sellToken, buyToken) => set({
        swapSellToken: sellToken,
        swapBuyToken: buyToken
    }),

    clearSwapTokens: () => set({
        swapSellToken: null,
        swapBuyToken: null
    })
})
