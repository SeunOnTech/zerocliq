/**
 * Card Stacks Store
 * 
 * Zustand store for managing Card Stacks (same pattern as useActivityStore).
 */

import { create } from 'zustand'

// Types for Card Stack
export interface SubCard {
    id: string
    name: string
    type: string
    color: string
    allocationPercent: number
}

export interface CardStack {
    id: string
    name: string
    tokenSymbol: string
    tokenAddress: string
    totalBudget: string
    status: string
    expiresAt: string
    subCards: SubCard[]
}

interface CardStacksState {
    stacks: CardStack[]
    isLoading: boolean
    error: string | null
    currentWallet: string | null
    currentChainId: number | null

    // Actions
    fetchStacks: (walletAddress: string, chainId: number) => Promise<void>
    addStack: (stack: CardStack) => void
    clearStacks: () => void
}

export const useCardStacksStore = create<CardStacksState>((set, get) => ({
    stacks: [],
    isLoading: false, // Start false - set true only when actually fetching
    error: null,
    currentWallet: null,
    currentChainId: null,

    fetchStacks: async (walletAddress: string, chainId: number) => {
        if (!walletAddress || !chainId) return

        set({
            isLoading: true,
            error: null,
            currentWallet: walletAddress,
            currentChainId: chainId,
        })

        try {
            const response = await fetch(
                `/api/card-stacks?walletAddress=${walletAddress}&chainId=${chainId}`
            )

            if (!response.ok) throw new Error('Failed to fetch stacks')

            const data = await response.json()

            if (!data.success) throw new Error(data.error)

            // Map to our format
            const stacks: CardStack[] = (data.stacks || []).map((s: any) => ({
                id: s.id,
                name: "Card Stack",
                tokenSymbol: s.tokenSymbol || "WMON",
                tokenAddress: s.tokenAddress || "0x0",
                totalBudget: s.totalBudget || "0",
                status: s.status || "ACTIVE",
                expiresAt: s.expiresAt || new Date().toISOString(),
                subCards: (s.subCards || []).map((sc: any) => ({
                    id: sc.id,
                    name: sc.name || "Sub Card",
                    type: sc.type || "MANUAL_TRADING",
                    color: sc.color || "#666",
                    allocationPercent: sc.allocationPercent || 0,
                })),
            }))

            console.log('[CardStacksStore] Fetched stacks:', stacks)

            set({
                stacks,
                isLoading: false,
            })
        } catch (error: any) {
            console.error('[CardStacksStore] Error:', error)
            set({
                isLoading: false,
                error: error.message,
                stacks: [],
            })
        }
    },

    addStack: (stack: CardStack) => {
        set((state) => ({
            stacks: [stack, ...state.stacks],
        }))
    },

    clearStacks: () => {
        set({
            stacks: [],
            currentWallet: null,
            currentChainId: null,
            error: null,
        })
    },
}))
