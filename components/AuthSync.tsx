"use client"

import { useAccount } from 'wagmi'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'

/**
 * AuthSync - Global Authentication Synchronizer
 * 
 * This component lives in the root layout and handles:
 * 1. Syncing Wagmi connection state to Zustand store
 * 2. Triggering database sync when a new wallet connects
 * 3. Syncing on page refresh (wallet already connected)
 * 4. Detecting wallet address changes (account switch in wallet)
 * 5. Deduplicating sync requests (handled in store)
 * 
 * Key design decisions:
 * - Fire-and-forget: DB sync is non-blocking
 * - Single source of truth: Wagmi state flows to Zustand
 * - No network calls on disconnect (only on connect)
 * - Account switches trigger fresh sync with new wallet
 */
export function AuthSync() {
    const { address, isConnected, chainId } = useAccount()
    const setAuth = useAppStore((state) => state.setAuth)
    const syncUserToDb = useAppStore((state) => state.syncUserToDb)
    const disconnect = useAppStore((state) => state.disconnect)
    const clearSyncKey = useAppStore((state) => state.clearSyncKey)
    const setSelectedChain = useAppStore((state) => state.setSelectedChain)

    // Track the last synced address to detect account changes
    const lastAddressRef = useRef<string | undefined>(undefined)
    const lastChainRef = useRef<number | undefined>(undefined)

    useEffect(() => {
        // Always sync connection state to store
        setAuth(address, chainId, isConnected)

        if (isConnected && address && chainId) {
            // Sync selected chain with connected chain
            // This ensures token modal always reflects connected chain when wallet is connected
            setSelectedChain(chainId)

            // Detect account or chain change
            const addressChanged = lastAddressRef.current && lastAddressRef.current !== address
            const chainChanged = lastChainRef.current && lastChainRef.current !== chainId

            if (addressChanged || chainChanged) {
                console.log("🔄 ZeroCliq: Account/chain changed!", {
                    from: { address: lastAddressRef.current, chainId: lastChainRef.current },
                    to: { address, chainId }
                })
                // Clear the sync key to force a fresh sync
                clearSyncKey()
            }

            // Update refs
            lastAddressRef.current = address
            lastChainRef.current = chainId

            // Sync to DB (will be deduplicated by lastSyncedKey in store)
            console.log("🔒 ZeroCliq: Syncing...", { address, chainId })
            syncUserToDb()
        }

        // Detect disconnect
        if (!isConnected && lastAddressRef.current) {
            console.log("🔓 ZeroCliq: Wallet disconnected")
            lastAddressRef.current = undefined
            lastChainRef.current = undefined
            disconnect()
        }

    }, [address, isConnected, chainId, setAuth, syncUserToDb, disconnect, clearSyncKey])

    return null
}
