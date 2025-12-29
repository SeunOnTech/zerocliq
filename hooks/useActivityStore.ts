/**
 * Activity Store
 * 
 * Zustand store for managing user activities with filtering and pagination.
 */

import { create } from 'zustand'

// Types matching Prisma schema
export type ActivityType =
    | 'SWAP'
    | 'TRANSFER'
    | 'SMART_ACCOUNT_DEPLOY'
    | 'SMART_ACCOUNT_FUND'
    | 'CARD_STACK_CREATE'
    | 'CARD_STACK_PAUSE'
    | 'CARD_STACK_RESUME'
    | 'DCA_EXECUTION'
    | 'APPROVAL'
    | 'BRIDGE'

export type ActivityStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface Activity {
    id: string
    type: ActivityType
    status: ActivityStatus
    title: string
    description: string
    metadata: Record<string, any>
    txHash: string | null
    createdAt: string
}

export type ActivityFilter = 'all' | 'swaps' | 'dca' | 'account'

interface ActivityState {
    activities: Activity[]
    isLoading: boolean
    filter: ActivityFilter
    nextCursor: string | null
    hasMore: boolean
    currentWallet: string | null
    currentChainId: number | null

    // Actions
    fetchActivities: (walletAddress: string, chainId: number, reset?: boolean) => Promise<void>
    loadMore: () => Promise<void>
    setFilter: (filter: ActivityFilter) => void
    clearActivities: () => void
}

// Map UI filter to API type parameter
const filterToTypes: Record<ActivityFilter, ActivityType[] | null> = {
    all: null,
    swaps: ['SWAP'],
    dca: ['DCA_EXECUTION'],
    account: ['SMART_ACCOUNT_DEPLOY', 'SMART_ACCOUNT_FUND', 'APPROVAL'],
}

export const useActivityStore = create<ActivityState>((set, get) => ({
    activities: [],
    isLoading: false,
    filter: 'all',
    nextCursor: null,
    hasMore: true,
    currentWallet: null,
    currentChainId: null,

    fetchActivities: async (walletAddress: string, chainId: number, reset = true) => {
        if (!walletAddress || !chainId) return

        const { filter } = get()

        set({
            isLoading: true,
            currentWallet: walletAddress,
            currentChainId: chainId,
            ...(reset && { activities: [], nextCursor: null, hasMore: true })
        })

        try {
            const types = filterToTypes[filter]
            let url = `/api/activity?walletAddress=${walletAddress}&chainId=${chainId}&limit=30`

            // If filtering by specific types, make multiple calls or use first type
            if (types && types.length > 0) {
                url += `&type=${types[0]}`
            }

            const response = await fetch(url)

            if (!response.ok) throw new Error('Failed to fetch activities')

            const data = await response.json()

            if (!data.success) throw new Error(data.error)

            set({
                activities: data.activities,
                nextCursor: data.nextCursor || null,
                hasMore: !!data.nextCursor,
                isLoading: false,
            })
        } catch (error) {
            console.error('[ActivityStore] Error fetching activities:', error)
            set({ isLoading: false })
        }
    },

    loadMore: async () => {
        const { currentWallet, currentChainId, nextCursor, isLoading, hasMore, filter } = get()

        if (!currentWallet || !currentChainId || isLoading || !hasMore || !nextCursor) return

        set({ isLoading: true })

        try {
            const types = filterToTypes[filter]
            let url = `/api/activity?walletAddress=${currentWallet}&chainId=${currentChainId}&limit=30&cursor=${nextCursor}`

            if (types && types.length > 0) {
                url += `&type=${types[0]}`
            }

            const response = await fetch(url)

            if (!response.ok) throw new Error('Failed to load more activities')

            const data = await response.json()

            if (!data.success) throw new Error(data.error)

            set((state) => ({
                activities: [...state.activities, ...data.activities],
                nextCursor: data.nextCursor || null,
                hasMore: !!data.nextCursor,
                isLoading: false,
            }))
        } catch (error) {
            console.error('[ActivityStore] Error loading more activities:', error)
            set({ isLoading: false })
        }
    },

    setFilter: (filter: ActivityFilter) => {
        const { currentWallet, currentChainId, fetchActivities } = get()
        set({ filter })

        // Refetch with new filter
        if (currentWallet && currentChainId) {
            fetchActivities(currentWallet, currentChainId, true)
        }
    },

    clearActivities: () => {
        set({
            activities: [],
            nextCursor: null,
            hasMore: true,
            currentWallet: null,
            currentChainId: null,
        })
    },
}))

// ============================================
// HELPER: Log activity via API
// ============================================

export async function logActivity(data: {
    walletAddress: string
    chainId: number
    type: ActivityType
    status: ActivityStatus
    title: string
    description: string
    metadata?: Record<string, any>
    txHash?: string
}): Promise<Activity | null> {
    try {
        const response = await fetch('/api/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })

        if (!response.ok) throw new Error('Failed to log activity')

        const result = await response.json()

        if (result.success && result.activity) {
            // Add to store if user is viewing activities
            const store = useActivityStore.getState()
            if (store.currentWallet === data.walletAddress && store.currentChainId === data.chainId) {
                store.activities = [result.activity, ...store.activities]
            }
            return result.activity
        }

        return null
    } catch (error) {
        console.error('[logActivity] Error:', error)
        return null
    }
}
