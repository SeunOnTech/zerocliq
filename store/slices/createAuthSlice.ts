import { type StoreSlice, type AuthSlice } from '@/types/store'
import type { SyncUserRequest, SyncUserResponse, UserProfile, UserSyncState } from '@/types/user'

/**
 * Creates the auth slice for the Zustand store.
 * 
 * This slice handles:
 * - Connection state (synced from Wagmi via AuthSync)
 * - User profile (synced to/from database)
 * - Deduplication of sync requests
 */
export const createAuthSlice: StoreSlice<AuthSlice> = (set, get) => ({
    // Connection state
    isConnected: false,
    address: undefined,
    chainId: undefined,

    // Database sync state
    userProfile: null,
    syncState: 'idle' as UserSyncState,
    lastSyncedKey: null,

    /**
     * Update connection state from Wagmi
     */
    setAuth: (address, chainId, isConnected) => set({ address, chainId, isConnected }),

    /**
     * Set user profile after sync
     */
    setUserProfile: (profile: UserProfile | null) => set({ userProfile: profile }),

    /**
     * Set sync state
     */
    setSyncState: (state: UserSyncState) => set({ syncState: state }),

    /**
     * Sync user to database (fire-and-forget pattern)
     * 
     * This function:
     * 1. Checks if already synced for this address+chain combo
     * 2. Calls the Next.js API route (which proxies to backend)
     * 3. Updates the store with the user profile
     * 4. Handles errors gracefully (no UI blocking)
     */
    syncUserToDb: async (options?: { forceRefresh?: boolean }) => {
        const state = get()
        const { address, chainId, lastSyncedKey, syncState, userProfile } = state
        const forceRefresh = options?.forceRefresh || false

        // Access availableChains from the full store (ChainSlice)
        const availableChains = (state as any).availableChains || []

        // Skip if not connected
        if (!address || !chainId) {
            console.log('🔐 ZeroCliq: syncUserToDb skipped - not connected')
            return
        }

        // Skip if already syncing
        if (syncState === 'syncing') {
            console.log('🔐 ZeroCliq: syncUserToDb skipped - already syncing')
            return
        }

        // Deduplication: skip if already synced this exact combo (unless forceRefresh)
        const currentKey = `${address.toLowerCase()}:${chainId}`
        if (lastSyncedKey === currentKey && !forceRefresh) {
            console.log('🔐 ZeroCliq: syncUserToDb skipped - already synced', {
                key: currentKey,
                cachedProfile: userProfile ? {
                    smartAccountAddress: userProfile.smartAccountAddress,
                    smartAccountStatus: userProfile.smartAccountStatus,
                } : null
            })
            return
        }

        // Get chain name from availableChains
        const chain = availableChains.find((c: any) => c.id === chainId)
        const chainName = chain?.name

        // Start sync
        set({ syncState: 'syncing' })

        try {
            const payload: SyncUserRequest = {
                walletAddress: address as `0x${string}`,
                chainId,
                chainName,
            }

            const response = await fetch('/api/users/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, forceRefresh }),
            })

            const data: SyncUserResponse = await response.json()

            if (data.success && data.user) {
                set({
                    userProfile: data.user,
                    syncState: 'synced',
                    lastSyncedKey: currentKey,
                })

                // Log smart account info if available
                if (data.smartAccount) {
                    console.log('🔐 ZeroCliq: User synced with smart account', {
                        id: data.user.id,
                        smartAccount: data.smartAccount.address,
                        status: data.smartAccount.status,
                        isDeployed: data.smartAccount.isDeployed,
                    })
                } else {
                    console.log('🔐 ZeroCliq: User synced to database', { id: data.user.id })
                }

                // Fetch Trade Card status (fire-and-forget, non-blocking)
                try {
                    const tradeCardParams = new URLSearchParams({
                        userId: address,
                        chainId: chainId.toString(),
                        type: 'TRADING',
                    })
                    const tradeCardRes = await fetch(`/api/smart-cards/user?${tradeCardParams.toString()}`)
                    const tradeCardData = await tradeCardRes.json()

                    if (tradeCardData.success && tradeCardData.smartCards?.length > 0) {
                        const activeCard = tradeCardData.smartCards.find(
                            (card: any) => card.type === 'TRADING' && card.status === 'ACTIVE'
                        )
                        if (activeCard) {
                            set({
                                hasTradeCard: true,
                                tradeCardId: activeCard.id,
                            })
                            console.log('🔐 ZeroCliq: Trade Card found', { id: activeCard.id })
                        } else {
                            set({ hasTradeCard: false, tradeCardId: null })
                        }
                    } else {
                        set({ hasTradeCard: false, tradeCardId: null })
                    }
                } catch (tradeCardError) {
                    console.warn('🔐 ZeroCliq: Trade Card fetch failed (non-blocking)', tradeCardError)
                    // Don't set error state - Trade Card sync is non-critical
                }
            } else {
                console.warn('🔐 ZeroCliq: Sync returned unsuccessful', data.error)
                set({ syncState: 'error' })
            }
        } catch (error) {
            console.error('🔐 ZeroCliq: Sync failed', error)
            set({ syncState: 'error' })
            // Silent failure - don't block the user
        }
    },

    /**
     * Disconnect and clear all auth state
     */
    disconnect: () => set({
        address: undefined,
        chainId: undefined,
        isConnected: false,
        userProfile: null,
        syncState: 'idle',
        lastSyncedKey: null,
    }),

    /**
     * Clear sync key to force a fresh sync
     * Used when wallet address or chain changes
     */
    clearSyncKey: () => {
        console.log('🔐 ZeroCliq: Clearing sync key to force fresh sync')
        set({
            lastSyncedKey: null,
            userProfile: null, // Clear old profile
            syncState: 'idle',
        })
    },
})
