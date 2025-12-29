"use client"

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { ChainConfig } from '@/types/store'

// Refresh interval: 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000

/**
 * ChainSync - Global Chain & Token Synchronizer
 * 
 * This component lives in the ROOT layout and handles:
 * 1. Fetching chains + tokens from API on app load
 * 2. Syncing to Zustand store (which persists to localStorage)
 * 3. Background refresh every 5 minutes
 * 
 * Key design decisions:
 * - Runs on EVERY page (not just /app/* routes)
 * - Zustand persistence means tokens available instantly on refresh
 * - Background refresh keeps data fresh
 * - No loading states for token selector!
 */
export function ChainSync() {
    const availableChains = useAppStore((state) => state.availableChains)
    const setAvailableChains = useAppStore((state) => state.setAvailableChains)

    const isFetching = useRef(false)
    const lastFetchTime = useRef<number>(0)

    const fetchChains = async (force = false) => {
        // Skip if already fetching
        if (isFetching.current) {
            console.log('[ChainSync] Already fetching, skipping...')
            return
        }

        // Skip if fetched recently (within 30 seconds) unless forced
        const now = Date.now()
        if (!force && now - lastFetchTime.current < 30000) {
            console.log('[ChainSync] Fetched recently, skipping...')
            return
        }

        isFetching.current = true
        console.log('[ChainSync] Fetching chains...')

        try {
            // Use local API route instead of backend
            const response = await fetch('/api/chains')
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = await response.json()
            const chains = data.chains as ChainConfig[]

            console.log(`[ChainSync] Received ${chains.length} chains:`, chains.map(c => c.name))

            // Check if data actually changed
            const prevCount = availableChains.length
            const prevTokenCount = availableChains.reduce((acc, c) => acc + (c.tokens?.length || 0), 0)
            const newTokenCount = chains.reduce((acc, c) => acc + (c.tokens?.length || 0), 0)

            setAvailableChains(chains)
            lastFetchTime.current = now

            if (prevCount !== chains.length || prevTokenCount !== newTokenCount) {
                console.log(`[ChainSync] ✓ Updated! ${prevCount}→${chains.length} chains, ${prevTokenCount}→${newTokenCount} tokens`)
            } else {
                console.log('[ChainSync] ✓ No changes detected')
            }
        } catch (error) {
            console.error('[ChainSync] Failed to fetch chains:', error)
            // Don't clear existing data on error - keep cached
        } finally {
            isFetching.current = false
        }
    }

    // Initial fetch on mount
    useEffect(() => {
        // If we have cached chains, log it
        if (availableChains.length > 0) {
            console.log(`[ChainSync] 🚀 Instant load from cache: ${availableChains.length} chains`)
        }

        // Fetch fresh data (will update in background)
        fetchChains()

        // Set up periodic refresh
        const intervalId = setInterval(() => {
            console.log('[ChainSync] Periodic refresh...')
            fetchChains()
        }, REFRESH_INTERVAL)

        return () => clearInterval(intervalId)
    }, []) // Empty deps - only run on mount

    // Also refetch on window focus (user returns to tab)
    useEffect(() => {
        const handleFocus = () => {
            console.log('[ChainSync] Window focused, refreshing...')
            fetchChains()
        }

        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [])

    return null
}
