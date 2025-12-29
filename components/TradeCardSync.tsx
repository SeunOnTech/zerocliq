"use client"

import { useEffect, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useAppStore } from '@/store/useAppStore'

/**
 * TradeCardSync - Background Trade Card status synchronizer
 * 
 * Similar to BalanceSync and AuthSync, this component:
 * 1. Fetches Trade Card status on wallet connect
 * 2. Refetches on chain change
 * 3. Persists state in Zustand (hasTradeCard, tradeCardId)
 * 
 * This runs independently of AuthSync to ensure Trade Card status
 * is always synced, even when user sync is deduplicated.
 */
export function TradeCardSync() {
    const { address, chainId, isConnected } = useAccount()

    // Store selectors
    const hasTradeCard = useAppStore((s) => s.hasTradeCard)
    const tradeCardId = useAppStore((s) => s.tradeCardId)
    const setHasTradeCard = useAppStore((s) => s.setHasTradeCard)
    const setTradeCardId = useAppStore((s) => s.setTradeCardId)
    const userProfile = useAppStore((s) => s.userProfile)

    // Track last synced key to avoid duplicate calls
    const lastSyncKeyRef = useRef<string | null>(null)
    const isFetchingRef = useRef(false)

    /**
     * Fetch Trade Card status from backend via Next.js API
     */
    const fetchTradeCardStatus = useCallback(async (
        userId: string,
        chain: number
    ) => {
        // Build unique key for deduplication
        const syncKey = `${userId.toLowerCase()}:${chain}`

        // Skip if already synced for this combo
        if (lastSyncKeyRef.current === syncKey) {
            console.log('[TradeCardSync] Skipped - already synced', syncKey)
            return
        }

        // Skip if already fetching
        if (isFetchingRef.current) {
            console.log('[TradeCardSync] Skipped - already fetching')
            return
        }

        isFetchingRef.current = true

        try {
            console.log('[TradeCardSync] Fetching Trade Card status...', { userId, chain })

            const params = new URLSearchParams({
                userId,
                chainId: chain.toString(),
                type: 'TRADING',
            })

            const response = await fetch(`/api/smart-cards/user?${params.toString()}`)
            const data = await response.json()

            if (data.success && data.smartCards?.length > 0) {
                // Find active Trade Card
                const activeCard = data.smartCards.find(
                    (card: any) => card.type === 'TRADING' && card.status === 'ACTIVE'
                )

                if (activeCard) {
                    console.log('[TradeCardSync] ✅ Trade Card found:', activeCard.id)
                    setHasTradeCard(true)
                    setTradeCardId(activeCard.id)
                } else {
                    console.log('[TradeCardSync] ⚠️ No active Trade Card')
                    setHasTradeCard(false)
                    setTradeCardId(null)
                }
            } else {
                console.log('[TradeCardSync] ❌ No Trade Cards found')
                setHasTradeCard(false)
                setTradeCardId(null)
            }

            // Mark as synced for this key
            lastSyncKeyRef.current = syncKey

        } catch (error) {
            console.error('[TradeCardSync] Fetch failed:', error)
            // Don't update state on error - keep existing values
        } finally {
            isFetchingRef.current = false
        }
    }, [setHasTradeCard, setTradeCardId])

    /**
     * Effect: Sync Trade Card when connected and profile is ready
     */
    useEffect(() => {
        // Wait for wallet connection AND user profile to be synced
        if (!isConnected || !address || !chainId) {
            console.log('[TradeCardSync] Not ready - wallet not connected')
            return
        }

        // User profile indicates backend sync is complete
        if (!userProfile?.smartAccountAddress) {
            console.log('[TradeCardSync] Waiting for user profile sync...')
            return
        }

        // Fetch Trade Card status
        fetchTradeCardStatus(address, chainId)

    }, [isConnected, address, chainId, userProfile?.smartAccountAddress, fetchTradeCardStatus])

    /**
     * Effect: Reset on disconnect
     */
    useEffect(() => {
        if (!isConnected) {
            lastSyncKeyRef.current = null
            // Don't clear state on disconnect - will be cleared by resetSmartAccountState
        }
    }, [isConnected])

    /**
     * Effect: Clear sync key on chain change to force refetch
     */
    useEffect(() => {
        if (chainId) {
            // Chain changed - clear key to allow refetch
            lastSyncKeyRef.current = null
        }
    }, [chainId])

    // This is a sync component - renders nothing
    return null
}
