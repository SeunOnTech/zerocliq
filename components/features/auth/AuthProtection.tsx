"use client"

import { useEffect } from "react"
import { useAppStore } from "@/store/useAppStore"
import { useAccount, useDisconnect, useSwitchChain } from "wagmi"
import { toast } from "sonner"

export function AuthProtection() {
    const { isConnected, chainId } = useAccount()
    const { disconnect } = useDisconnect()
    const selectedChainId = useAppStore(state => state.selectedChainId)
    const availableChains = useAppStore(state => state.availableChains)

    // Sync wagmi state to store (optional if we want centralized sync, but AuthSlice handles some)
    // Here we focus on ENFORCEMENT.

    useEffect(() => {
        if (isConnected && chainId && availableChains.length > 0) {
            // Check if current chain is supported
            const isSupported = availableChains.some(c => c.id === chainId)

            if (!isSupported) {
                // Determine disconnect message
                toast.error("Unsupported Network", {
                    description: "You have been disconnected because this network is not supported."
                })
                disconnect()
                return
            }

            // OPTIONAL: Check if it matches the *intended* selection
            // If user selected Monad but connected Sepolia, should we disconnect?
            // "Strict" mode suggests yes.
            if (selectedChainId && chainId !== selectedChainId) {
                const intended = availableChains.find(c => c.id === selectedChainId)?.name
                toast.warning("Wrong Network", {
                    description: `Please connect to ${intended || 'the selected network'}.`
                })
                disconnect()
            }
        }
    }, [isConnected, chainId, availableChains, selectedChainId, disconnect])

    return null
}
