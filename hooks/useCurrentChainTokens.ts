import { useAppStore } from '@/store/useAppStore'
import type { ChainConfig } from '@/types/store'

/**
 * useCurrentChainTokens - Get tokens for the current chain
 * 
 * This is a derived selector that:
 * 1. Reads from Zustand (persisted to localStorage)
 * 2. Prioritizes selectedChainId (from token modal) over connected chainId
 * 3. Falls back to first chain if neither is available
 * 4. Returns instantly (no fetch, no loading!)
 * 
 * Use this in the token selector for instant token lists.
 */
export function useCurrentChainTokens() {
    const connectedChainId = useAppStore((state) => state.chainId)
    const selectedChainId = useAppStore((state) => state.selectedChainId)
    const availableChains = useAppStore((state) => state.availableChains)

    // Priority: 1) User-selected chain from token modal, 2) Connected chain, 3) First available
    const activeChainId = selectedChainId || connectedChainId

    // Find the current chain, or fallback to first chain if wallet not connected
    const currentChain = activeChainId
        ? availableChains.find((c) => c.id === activeChainId)
        : availableChains[0] // Default to first chain when not connected

    // Get tokens for the current chain
    const tokens = currentChain?.tokens || []

    // Also return some useful derived values
    const stableTokens = tokens.filter((t) => t.isStable)
    const lstTokens = tokens.filter((t) => t.isLST)
    const blueChipTokens = tokens.filter((t) => t.isBlueChip)

    return {
        tokens,
        stableTokens,
        lstTokens,
        blueChipTokens,
        currentChain,
        hasTokens: tokens.length > 0,
    }
}

/**
 * useChainTokens - Get tokens for a specific chain
 * 
 * Use when you need tokens for a chain other than the connected one.
 */
export function useChainTokens(chainId: number | undefined) {
    const availableChains = useAppStore((state) => state.availableChains)

    if (!chainId) return []

    const chain = availableChains.find((c) => c.id === chainId)
    return chain?.tokens || []
}

/**
 * useTokenByAddress - Get a specific token by address
 */
export function useTokenByAddress(address: string | undefined, chainId?: number) {
    const connectedChainId = useAppStore((state) => state.chainId)
    const availableChains = useAppStore((state) => state.availableChains)

    const targetChainId = chainId || connectedChainId
    if (!address || !targetChainId) return undefined

    const chain = availableChains.find((c) => c.id === targetChainId)
    return chain?.tokens.find((t) => t.address.toLowerCase() === address.toLowerCase())
}
