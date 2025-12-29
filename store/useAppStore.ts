import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createAuthSlice } from './slices/createAuthSlice'
import { createChainSlice } from './slices/createChainSlice'
import { createUISlice } from './slices/createUISlice'
import { createSmartAccountSlice } from './slices/createSmartAccountSlice'
import { createBalanceSlice } from './slices/createBalanceSlice'
import { createSwapSlice } from './slices/createSwapSlice'
import { createPriceSlice } from './slices/createPriceSlice'
import { type AppStore } from '@/types/store'

export const useAppStore = create<AppStore>()(
    persist(
        (...a) => ({
            ...createAuthSlice(...a),
            ...createChainSlice(...a),
            ...createUISlice(...a),
            ...createSmartAccountSlice(...a),
            ...createBalanceSlice(...a),
            ...createSwapSlice(...a),
            ...createPriceSlice(...a),
        }),
        {
            name: 'zerocliq-store-v5', // v5: Added price persistence
            partialize: (state) => ({
                // Auth & User
                userProfile: state.userProfile,
                lastSyncedKey: state.lastSyncedKey,
                // Smart Account UI
                hasSkippedSetup: state.hasSkippedSetup,
                hasDismissedBanner: state.hasDismissedBanner,
                // Chains & Tokens (CRITICAL: persist for instant token selector)
                availableChains: state.availableChains,
                // Balances (CRITICAL: persist for instant balance display)
                tokenBalances: state.tokenBalances,
                // Prices (persist for instant USD display)
                tokenPrices: state.tokenPrices,
                lastPriceUpdate: state.lastPriceUpdate,
            }),
        }
    )
)

