import { type StateCreator } from 'zustand'
import type { AppStore } from '@/types/store'
import type { SmartAccountData, SmartAccountFlow, SmartAccountStatus } from '@/types/smart-account'
import type { Address } from 'viem'

export interface SmartAccountSlice {
    // Smart account state
    smartAccount: SmartAccountData | null
    smartAccountFlow: SmartAccountFlow
    smartAccountError: string | null

    // Trade card state
    hasTradeCard: boolean
    tradeCardId: string | null  // Active Trade Card ID for swap execution

    // UI state
    showSmartAccountPrompt: boolean
    hasSkippedSetup: boolean
    hasDismissedBanner: boolean

    // Actions
    setSmartAccount: (account: SmartAccountData | null) => void
    setSmartAccountFlow: (flow: SmartAccountFlow) => void
    setSmartAccountError: (error: string | null) => void
    setHasTradeCard: (has: boolean) => void
    setTradeCardId: (id: string | null) => void
    showPrompt: () => void
    hidePrompt: () => void
    skipSetup: () => void
    dismissBanner: () => void
    resetSmartAccountState: () => void

    // Computed helpers
    needsSmartAccountSetup: () => boolean
    needsDeployment: () => boolean
    isFullySetup: () => boolean
}

export const createSmartAccountSlice: StateCreator<
    AppStore,
    [],
    [],
    SmartAccountSlice
> = (set, get) => ({
    // Initial state
    smartAccount: null,
    smartAccountFlow: 'idle',
    smartAccountError: null,
    hasTradeCard: false,
    tradeCardId: null,
    showSmartAccountPrompt: false,
    hasSkippedSetup: false,
    hasDismissedBanner: false,

    // Actions
    setSmartAccount: (account) => set({ smartAccount: account }),

    setSmartAccountFlow: (flow) => set({ smartAccountFlow: flow }),

    setSmartAccountError: (error) => set({ smartAccountError: error }),

    setHasTradeCard: (has) => set({ hasTradeCard: has }),

    setTradeCardId: (id) => set({ tradeCardId: id }),

    showPrompt: () => set({ showSmartAccountPrompt: true }),

    hidePrompt: () => set({ showSmartAccountPrompt: false }),

    skipSetup: () => set({
        hasSkippedSetup: true,
        showSmartAccountPrompt: false
    }),

    dismissBanner: () => set({ hasDismissedBanner: true }),

    resetSmartAccountState: () => set({
        smartAccount: null,
        smartAccountFlow: 'idle',
        smartAccountError: null,
        hasTradeCard: false,
        tradeCardId: null,
        showSmartAccountPrompt: false,
        hasSkippedSetup: false,
        hasDismissedBanner: false,
    }),

    // Computed helpers - check userProfile from auth slice
    needsSmartAccountSetup: () => {
        const { userProfile } = get()
        if (!userProfile) return false
        return userProfile.smartAccountStatus === 'NONE'
    },

    needsDeployment: () => {
        const { userProfile } = get()
        if (!userProfile) return false
        return userProfile.smartAccountStatus === 'COUNTERFACTUAL'
    },

    isFullySetup: () => {
        const { userProfile } = get()
        if (!userProfile) return false
        return userProfile.smartAccountStatus === 'DEPLOYED'
    },
})
