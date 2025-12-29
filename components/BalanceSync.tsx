"use client"

import { useEffect, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useAppStore } from '@/store/useAppStore'
import type { TokenBalance, WalletBalanceData } from '@/store/slices/createBalanceSlice'

const BALANCE_REFRESH_INTERVAL = 60 * 1000 // 60 seconds
const STALE_THRESHOLD = 30 * 1000 // 30 seconds

/**
 * BalanceSync - Background balance fetcher
 * 
 * Similar to ChainSync and AuthSync, this component:
 * 1. Fetches token balances on wallet connect
 * 2. Refetches on chain change
 * 3. Background refresh every 60 seconds (while tab active)
 * 4. Refetch on window focus (if stale > 30s)
 * 
 * Balances are persisted to localStorage for instant display on page refresh.
 * Uses Next.js API routes to proxy backend requests.
 */
export function BalanceSync() {
    const { address, chainId, isConnected } = useAccount()
    const userProfile = useAppStore((s) => s.userProfile)
    const setBalances = useAppStore((s) => s.setBalances)
    const tokenBalances = useAppStore((s) => s.tokenBalances)
    const isBalanceFetching = useAppStore((s) => s.isBalanceFetching)
    const setBalanceFetching = useAppStore((s) => s.setBalanceFetching)
    const clearBalances = useAppStore((s) => s.clearBalances)

    // Track last fetch to avoid duplicate calls
    const lastFetchKeyRef = useRef<string | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    /**
     * Fetch balances via Next.js API route (proxies to backend)
     * NEVER call backend directly from client
     */
    const fetchBalances = useCallback(async (
        walletAddress: string,
        chain: number,
        walletType: 'eoa' | 'smartAccount',
        force: boolean = false
    ) => {
        try {
            // Use Next.js API route - proxies to backend
            const response = await fetch(`/api/balances/${walletAddress}/${chain}${force ? '?force=true' : ''}`)
            if (!response.ok) {
                console.warn(`[BalanceSync] Failed to fetch ${walletType} balances:`, response.status)
                return null
            }

            const data = await response.json()
            if (data.success && data.tokens) {
                const balanceData: WalletBalanceData = {
                    address: walletAddress,
                    tokens: data.tokens as TokenBalance[],
                    lastUpdated: Date.now()
                }
                return balanceData
            }
            return null
        } catch (error) {
            console.error(`[BalanceSync] Error fetching ${walletType} balances:`, error)
            return null
        }
    }, [])

    /**
     * Fetch both EOA and Smart Account balances in parallel
     */
    const fetchAllBalances = useCallback(async (force = false) => {
        if (!address || !chainId || !isConnected) {
            return
        }

        // Check for duplicate fetch
        const fetchKey = `${address}:${chainId}`
        if (!force && fetchKey === lastFetchKeyRef.current && isBalanceFetching) {
            console.log('[BalanceSync] Skipping duplicate fetch')
            return
        }

        // Check if we have fresh cached data
        if (!force) {
            const cachedEoa = tokenBalances[chainId]?.eoa
            if (cachedEoa && Date.now() - cachedEoa.lastUpdated < STALE_THRESHOLD) {
                console.log('[BalanceSync] 🚀 Using fresh cached balances')
                return
            }
        }

        setBalanceFetching(true)
        lastFetchKeyRef.current = fetchKey

        console.log(`[BalanceSync] Fetching balances for ${address} on chain ${chainId}`)

        // Get Smart Account address if available
        const smartAccountAddress = userProfile?.smartAccountAddress

        // Fetch both in parallel
        const [eoaBalances, smartBalances] = await Promise.all([
            fetchBalances(address, chainId, 'eoa', force),
            smartAccountAddress
                ? fetchBalances(smartAccountAddress, chainId, 'smartAccount', force)
                : Promise.resolve(null)
        ])

        // Update store
        if (eoaBalances) {
            setBalances(chainId, 'eoa', eoaBalances)
            console.log(`[BalanceSync] ✓ EOA balances updated: ${eoaBalances.tokens.length} tokens`)
        }

        if (smartBalances) {
            setBalances(chainId, 'smartAccount', smartBalances)
            console.log(`[BalanceSync] ✓ Smart Account balances updated: ${smartBalances.tokens.length} tokens`)
        }

        setBalanceFetching(false)
    }, [address, chainId, isConnected, userProfile?.smartAccountAddress, tokenBalances, isBalanceFetching, fetchBalances, setBalances, setBalanceFetching])

    /**
     * Handle connection state changes
     */
    useEffect(() => {
        if (isConnected && address && chainId) {
            // Check if we have cached balances for instant display
            const cached = tokenBalances[chainId]?.eoa
            if (cached && cached.tokens.length > 0) {
                console.log(`[BalanceSync] 🚀 Instant load from cache: ${cached.tokens.length} tokens`)
            }

            // Fetch fresh balances (will skip if cache is fresh)
            fetchAllBalances()
        } else {
            // Clear balances on disconnect
            clearBalances()
            lastFetchKeyRef.current = null
        }
    }, [isConnected, address, chainId])

    /**
     * Force refetch when chain changes OR when triggered manually
     */
    const balanceRefreshTrigger = useAppStore((s) => s.balanceRefreshTrigger)

    useEffect(() => {
        if (isConnected && chainId) {
            console.log('[BalanceSync] Triggered refresh')
            fetchAllBalances(true) // Force fetch
        }
    }, [chainId, balanceRefreshTrigger])

    /**
     * Background polling (60 seconds)
     */
    useEffect(() => {
        if (!isConnected) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
            return
        }

        intervalRef.current = setInterval(() => {
            // Only poll if document is visible
            if (document.visibilityState === 'visible') {
                console.log('[BalanceSync] Background refresh...')
                fetchAllBalances()
            }
        }, BALANCE_REFRESH_INTERVAL)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [isConnected, fetchAllBalances])

    /**
     * Refetch on window focus (if stale)
     */
    useEffect(() => {
        const handleFocus = () => {
            if (!isConnected || !chainId) return

            const cached = tokenBalances[chainId]?.eoa
            const isStale = !cached || Date.now() - cached.lastUpdated > STALE_THRESHOLD

            if (isStale) {
                console.log('[BalanceSync] Refetching on focus (stale)')
                fetchAllBalances()
            }
        }

        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [isConnected, chainId, tokenBalances, fetchAllBalances])

    // This component renders nothing
    return null
}
