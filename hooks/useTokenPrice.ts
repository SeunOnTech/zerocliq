import { useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'

/**
 * Hook to get the USD price of a single token
 * 
 * @param tokenAddress Token address (supports 0x0 for native)
 * @param chainId Chain ID
 * @returns { price: number | null, isLoading: boolean }
 */
export function useTokenPrice(tokenAddress: string | undefined, chainId: number | undefined) {
    const getPrice = useAppStore((s) => s.getPrice)
    const isPriceStale = useAppStore((s) => s.isPriceStale)

    const price = useMemo(() => {
        if (!tokenAddress || !chainId) return null
        return getPrice(chainId, tokenAddress)
    }, [tokenAddress, chainId, getPrice])

    const isLoading = useMemo(() => {
        if (!chainId) return false
        // Consider loading if no price and stale
        return price === null && isPriceStale(chainId)
    }, [price, chainId, isPriceStale])

    return { price, isLoading }
}

/**
 * Hook to get USD prices for multiple tokens
 * 
 * @param tokenAddresses Array of token addresses
 * @param chainId Chain ID
 * @returns Record<string, number> - address (lowercase) -> USD price
 */
export function useTokenPrices(tokenAddresses: string[], chainId: number | undefined) {
    const tokenPrices = useAppStore((s) => s.tokenPrices)

    const prices = useMemo(() => {
        if (!chainId || tokenAddresses.length === 0) return {}

        const chainPrices = tokenPrices[chainId] || {}
        const result: Record<string, number> = {}

        for (const addr of tokenAddresses) {
            const price = chainPrices[addr.toLowerCase()]
            if (price !== undefined) {
                result[addr.toLowerCase()] = price
            }
        }

        return result
    }, [tokenAddresses, chainId, tokenPrices])

    return prices
}

/**
 * Format USD value for display
 * 
 * @param value USD value (number or null)
 * @param options Formatting options
 * @returns Formatted string like "$1,234.56" or "$0.00"
 */
export function formatUsdValue(
    value: number | null | undefined,
    options: {
        prefix?: string
        minimumFractionDigits?: number
        maximumFractionDigits?: number
    } = {}
): string {
    const {
        prefix = '≈ $',
        minimumFractionDigits = 2,
        maximumFractionDigits = 2
    } = options

    if (value === null || value === undefined || isNaN(value)) {
        return `${prefix}0.00`
    }

    // Handle very small values
    if (value > 0 && value < 0.01) {
        return `${prefix}<0.01`
    }

    return `${prefix}${value.toLocaleString('en-US', {
        minimumFractionDigits,
        maximumFractionDigits
    })}`
}
