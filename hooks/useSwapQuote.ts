"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"

/**
 * Hop in a swap route
 */
export interface SwapHop {
    dexId: string
    dexName: string
    kind: string
    detail: string  // e.g. "Fee: 0.05%"
    poolOrQuoter: string
    path: string[]
}

/**
 * Quote response from backend
 */
export interface SwapQuote {
    success: boolean
    bestRoute: {
        dexId: string
        dexName: string
        amountOut: string
        minAmountOut: string
        hops: SwapHop[]
        priceImpactBps: number
        confidenceScore: number
        gasEstimate?: string
    } | null
    alternatives?: Array<{
        dexId: string
        dexName: string
        amountOut: string
        hops: SwapHop[]
        priceImpactBps: number
        confidenceScore: number
    }>
    execution?: {
        approvals: any[]
        swap: {
            to: string
            data: string
            value: string
            description: string
        }
    }
    error?: string
}

/**
 * Parameters for the useSwapQuote hook
 */
interface UseSwapQuoteParams {
    chainId: number | undefined
    tokenIn: string | undefined
    tokenOut: string | undefined
    amountIn: string  // Human readable amount
    tokenInDecimals: number
    userAddress?: string
    enabled?: boolean  // Allow disabling the hook
}

/**
 * Return type for the useSwapQuote hook
 */
interface UseSwapQuoteResult {
    quote: SwapQuote | null
    isLoading: boolean
    error: string | null
    refetch: () => void
    lastUpdated: number | null
}

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 500

/**
 * useSwapQuote - Auto-fetching swap quote hook
 * 
 * Features:
 * - Debounced fetching (500ms) to avoid excessive API calls
 * - Automatic refetch on input changes
 * - Manual refetch function for 30s timer integration
 * - Error handling with retry capability
 * - Request deduplication
 * 
 * Usage:
 * ```tsx
 * const { quote, isLoading, error, refetch } = useSwapQuote({
 *   chainId: 59144,
 *   tokenIn: "0x...",
 *   tokenOut: "0x...",
 *   amountIn: "1.5",
 *   tokenInDecimals: 18,
 *   userAddress: "0x..."
 * })
 * ```
 */
export function useSwapQuote({
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    tokenInDecimals,
    userAddress,
    enabled = true
}: UseSwapQuoteParams): UseSwapQuoteResult {
    const [quote, setQuote] = useState<SwapQuote | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<number | null>(null)

    // Refs for request management
    const abortControllerRef = useRef<AbortController | null>(null)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const lastRequestKeyRef = useRef<string>("")

    // Generate a unique key for the current request params
    const requestKey = useMemo(() => {
        if (!chainId || !tokenIn || !tokenOut || !amountIn) return ""
        return `${chainId}:${tokenIn}:${tokenOut}:${amountIn}`
    }, [chainId, tokenIn, tokenOut, amountIn])

    // Check if we have all required params
    const hasValidParams = useMemo(() => {
        return Boolean(
            chainId &&
            tokenIn &&
            tokenOut &&
            amountIn &&
            parseFloat(amountIn) > 0 &&
            enabled
        )
    }, [chainId, tokenIn, tokenOut, amountIn, enabled])

    /**
     * Core fetch function
     */
    const fetchQuote = useCallback(async () => {
        // Skip if params invalid
        if (!hasValidParams || !chainId || !tokenIn || !tokenOut) {
            return
        }

        // Abort previous request if exists
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        // Create new abort controller
        const abortController = new AbortController()
        abortControllerRef.current = abortController

        setIsLoading(true)
        setError(null)

        try {
            // Convert human amount to raw units (wei)
            const amountInRaw = parseFloat(amountIn) * Math.pow(10, tokenInDecimals)
            const amountInString = Math.floor(amountInRaw).toString()

            // Log request payload for debugging
            const payload = {
                chainId,
                tokenIn,
                tokenOut,
                amountIn: amountInString,
                amountInRaw: true,
                userAddress,
            }

            const response = await fetch("/api/swap/quote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: abortController.signal,
            })

            // Check if request was aborted
            if (abortController.signal.aborted) {
                return
            }

            const data = await response.json()

            if (data.success && data.bestRoute) {
                setQuote(data)
                setError(null)
                setLastUpdated(Date.now())
                lastRequestKeyRef.current = requestKey
            } else {
                setQuote(null)
                setError(data.error || "Failed to get quote")
            }
        } catch (err) {
            // Ignore abort errors
            if (err instanceof Error && err.name === "AbortError") {
                return
            }
            console.error("[useSwapQuote] Error:", err)
            setError(err instanceof Error ? err.message : "Network error")
            setQuote(null)
        } finally {
            setIsLoading(false)
        }
    }, [chainId, tokenIn, tokenOut, amountIn, tokenInDecimals, userAddress, hasValidParams, requestKey])

    /**
     * Debounced fetch - triggers on input changes
     */
    useEffect(() => {
        // Clear quote when params become invalid
        if (!hasValidParams) {
            setQuote(null)
            setError(null)
            setIsLoading(false)
            lastRequestKeyRef.current = ""
            return
        }

        // Clear old quote when inputs change (to show skeleton)
        if (requestKey !== lastRequestKeyRef.current) {
            setQuote(null)
        }

        // Set loading immediately for better UX
        setIsLoading(true)

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // Set new debounced timer
        debounceTimerRef.current = setTimeout(() => {
            fetchQuote()
        }, DEBOUNCE_DELAY)

        // Cleanup
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [hasValidParams, requestKey, fetchQuote])

    /**
     * Manual refetch function (for 30s timer integration)
     */
    const refetch = useCallback(() => {
        if (hasValidParams) {
            fetchQuote()
        }
    }, [hasValidParams, fetchQuote])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    return {
        quote,
        isLoading,
        error,
        refetch,
        lastUpdated,
    }
}

/**
 * Format the output amount from raw units to human readable
 */
export function formatQuoteAmount(
    rawAmount: string | undefined,
    decimals: number
): string {
    if (!rawAmount) return "0"

    const value = parseFloat(rawAmount) / Math.pow(10, decimals)

    // Format with appropriate precision
    if (value >= 1000000) {
        return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    } else if (value >= 1) {
        return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
    } else if (value >= 0.0001) {
        return value.toLocaleString(undefined, { maximumFractionDigits: 6 })
    } else {
        return value.toExponential(4)
    }
}

/**
 * Format price impact for display
 */
export function formatPriceImpact(bps: number | undefined): {
    text: string
    severity: "low" | "medium" | "high"
} {
    if (bps === undefined || bps === null) {
        return { text: "–", severity: "low" }
    }

    const percent = bps / 100

    let severity: "low" | "medium" | "high" = "low"
    if (percent > 5) {
        severity = "high"
    } else if (percent > 1) {
        severity = "medium"
    }

    const sign = percent < 0 ? "" : "-"
    return {
        text: `${sign}${Math.abs(percent).toFixed(2)}%`,
        severity,
    }
}
