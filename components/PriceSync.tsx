"use client"

import { useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useCurrentChainTokens } from '@/hooks/useCurrentChainTokens'

const PRICE_REFRESH_INTERVAL = 30 * 1000 // 30 seconds

/**
 * PriceSync - Background price fetcher
 * 
 * Similar to BalanceSync, this component:
 * 1. Fetches token prices when chain tokens are available
 * 2. Refetches every 30 seconds (prices change faster than balances)
 * 3. Refetch on window focus (if stale)
 * 
 * Prices are persisted to localStorage for instant display on page refresh.
 */
export function PriceSync() {
    const { tokens: chainTokens, currentChain } = useCurrentChainTokens()
    const setPrices = useAppStore((s) => s.setPrices)
    const isPriceStale = useAppStore((s) => s.isPriceStale)
    const tokenPrices = useAppStore((s) => s.tokenPrices)

    const lastFetchKeyRef = useRef<string | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const isFetchingRef = useRef(false)

    /**
     * Fetch prices for all chain tokens in one bulk request
     */
    const fetchPrices = useCallback(async (chainId: number, force = false) => {
        if (chainTokens.length === 0) return
        if (isFetchingRef.current && !force) return

        const fetchKey = `${chainId}:${chainTokens.length}`

        // Skip if same key and not stale
        if (!force && fetchKey === lastFetchKeyRef.current && !isPriceStale(chainId)) {
            return
        }

        isFetchingRef.current = true
        lastFetchKeyRef.current = fetchKey

        try {
            // Collect all token addresses
            const tokenAddresses = chainTokens.map(t => t.address)

            console.log(`[PriceSync] Fetching ${tokenAddresses.length} prices for chain ${chainId}`)

            const response = await fetch('/api/prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokens: tokenAddresses, chainId })
            })

            if (!response.ok) {
                console.warn('[PriceSync] Failed to fetch prices:', response.status)
                return
            }

            const data = await response.json()

            if (data.success && data.prices) {
                console.log(`[PriceSync] ✓ Updated ${Object.keys(data.prices).length} prices`)
                setPrices(chainId, data.prices)
            }
        } catch (error) {
            console.error('[PriceSync] Error fetching prices:', error)
        } finally {
            isFetchingRef.current = false
        }
    }, [chainTokens, isPriceStale, setPrices])

    // Fetch prices when chain changes or tokens load
    useEffect(() => {
        if (!currentChain?.id || chainTokens.length === 0) return

        // Initial fetch
        fetchPrices(currentChain.id, true)

        // Set up interval
        intervalRef.current = setInterval(() => {
            fetchPrices(currentChain.id)
        }, PRICE_REFRESH_INTERVAL)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [currentChain?.id, chainTokens.length, fetchPrices])

    // Refetch on window focus if stale
    useEffect(() => {
        if (!currentChain?.id) return

        const handleFocus = () => {
            if (isPriceStale(currentChain.id)) {
                console.log('[PriceSync] Window focused, refetching stale prices')
                fetchPrices(currentChain.id, true)
            }
        }

        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [currentChain?.id, isPriceStale, fetchPrices])

    // This is a background sync component - no UI
    return null
}
