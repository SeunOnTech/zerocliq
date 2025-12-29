"use client"

import { useState, useEffect, useMemo } from "react"
import { ExternalLink, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { useAppStore } from "@/store/useAppStore"

interface DexScreenerChartProps {
    fromToken: string
    toToken: string
    fromTokenAddress?: string
    toTokenAddress?: string
    className?: string
}

// VERIFIED pool addresses on Monad from DEX Screener API
// Format: "baseToken_quoteToken" (lowercase) -> poolAddress
const MONAD_POOL_ADDRESSES: Record<string, string> = {
    // WMON/USDC - Uniswap V3 (highest liquidity ~$1.1M)
    "0x3bd359c1119da7da1d913d1c4d2b7c461115433a_0x754704bc059f8c67012fed69bc8a327a5aafb603": "0x659bD0BC4167BA25c62E05656F78043E7eD4a9da",
    "0x754704bc059f8c67012fed69bc8a327a5aafb603_0x3bd359c1119da7da1d913d1c4d2b7c461115433a": "0x659bD0BC4167BA25c62E05656F78043E7eD4a9da",

    // Native MON (0x0) maps to WMON pools
    "0x0000000000000000000000000000000000000000_0x754704bc059f8c67012fed69bc8a327a5aafb603": "0x659bD0BC4167BA25c62E05656F78043E7eD4a9da",
    "0x754704bc059f8c67012fed69bc8a327a5aafb603_0x0000000000000000000000000000000000000000": "0x659bD0BC4167BA25c62E05656F78043E7eD4a9da",

    // WMON/USDT - Uniswap V3
    "0x3bd359c1119da7da1d913d1c4d2b7c461115433a_0xe7cd86e13ac4309349f30b3435a9d337750fc82d": "0x9665897a0b66Cb9daBEb248C279fd0967C018608",
    "0xe7cd86e13ac4309349f30b3435a9d337750fc82d_0x3bd359c1119da7da1d913d1c4d2b7c461115433a": "0x9665897a0b66Cb9daBEb248C279fd0967C018608",

    // Native MON to USDT
    "0x0000000000000000000000000000000000000000_0xe7cd86e13ac4309349f30b3435a9d337750fc82d": "0x9665897a0b66Cb9daBEb248C279fd0967C018608",
    "0xe7cd86e13ac4309349f30b3435a9d337750fc82d_0x0000000000000000000000000000000000000000": "0x9665897a0b66Cb9daBEb248C279fd0967C018608",
}

// Linea pool addresses from DEXScreener
const LINEA_POOL_ADDRESSES: Record<string, string> = {
    // WETH/USDC - Etherex (high liquidity)
    "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f_0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "0x90E8a5b881D211f418d77Ba8978788b62544914B",
    "0x176211869ca2b568f2a7d4ee941e073a821ee1ff_0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f": "0x90E8a5b881D211f418d77Ba8978788b62544914B",

    // Native ETH (0x0) maps to WETH pools for USDC
    "0x0000000000000000000000000000000000000000_0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "0x90E8a5b881D211f418d77Ba8978788b62544914B",
    "0x176211869ca2b568f2a7d4ee941e073a821ee1ff_0x0000000000000000000000000000000000000000": "0x90E8a5b881D211f418d77Ba8978788b62544914B",

    // USDC/USDT
    "0x176211869ca2b568f2a7d4ee941e073a821ee1ff_0xa219439258ca9da29e9cc4ce5596924745e12b93": "0x35521ec62d91375AC9510d1FeEFe254b4B582EA0",
    "0xa219439258ca9da29e9cc4ce5596924745e12b93_0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "0x35521ec62d91375AC9510d1FeEFe254b4B582EA0",
}

// Chain ID to DEX Screener chain slug mapping
const CHAIN_SLUGS: Record<number, string> = {
    143: "monad",
    59144: "linea",
    11155111: "sepolia",
    1: "ethereum",
    56: "bsc",
    137: "polygon",
    42161: "arbitrum",
    10: "optimism",
    8453: "base",
}

export function DexScreenerChart({
    fromToken,
    toToken,
    fromTokenAddress,
    toTokenAddress,
    className = ""
}: DexScreenerChartProps) {
    // Use Zustand's selectedChainId for consistency with token modal
    const selectedChainId = useAppStore((state) => state.selectedChainId)
    const connectedChainId = useAppStore((state) => state.chainId)
    const chainId = selectedChainId || connectedChainId || 59144 // Default to Linea

    const { resolvedTheme } = useTheme()
    const [isLoading, setIsLoading] = useState(true)
    const [hasError, setHasError] = useState(false)
    const [iframeKey, setIframeKey] = useState(0)
    const [mounted, setMounted] = useState(false)
    const [dynamicPoolAddress, setDynamicPoolAddress] = useState<string | null>(null)

    // Handle hydration - resolvedTheme is undefined until mounted
    useEffect(() => {
        setMounted(true)
    }, [])

    // Get DEX Screener theme based on app theme
    const dexTheme = mounted && resolvedTheme === 'light' ? 'light' : 'dark'

    // Get the chain slug for DEX Screener
    const chainSlug = useMemo(() => {
        return CHAIN_SLUGS[chainId] || null
    }, [chainId])

    // Fetch pair address dynamically when tokens change
    useEffect(() => {
        const fetchPair = async () => {
            if (!fromTokenAddress || !toTokenAddress || !chainSlug) return

            const normalizedFrom = fromTokenAddress.toLowerCase()
            const normalizedTo = toTokenAddress.toLowerCase()

            // 1. Check hardcoded map first (fastest) - use chain-specific map
            const key1 = `${normalizedFrom}_${normalizedTo}`
            const key2 = `${normalizedTo}_${normalizedFrom}`

            // Get the appropriate pool addresses map based on chain
            const poolAddresses = chainId === 143 ? MONAD_POOL_ADDRESSES
                : chainId === 59144 ? LINEA_POOL_ADDRESSES
                    : {}
            const hardcoded = poolAddresses[key1] || poolAddresses[key2]

            if (hardcoded) {
                setDynamicPoolAddress(hardcoded)
                return
            }

            // 2. Fetch from DEX Screener API
            try {
                // Fetch pairs for both tokens
                const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${fromTokenAddress},${toTokenAddress}`)
                const data = await response.json()

                if (data.pairs && Array.isArray(data.pairs)) {
                    // Find a pair on this chain that contains BOTH tokens
                    const exactPair = data.pairs.find((p: any) =>
                        p.chainId === chainSlug &&
                        (
                            (p.baseToken.address.toLowerCase() === normalizedFrom && p.quoteToken.address.toLowerCase() === normalizedTo) ||
                            (p.baseToken.address.toLowerCase() === normalizedTo && p.quoteToken.address.toLowerCase() === normalizedFrom)
                        )
                    )

                    if (exactPair) {
                        setDynamicPoolAddress(exactPair.pairAddress)
                        return
                    }

                    // Fallback: Find most liquid pair for the 'from' token on this chain
                    const fromTokenPair = data.pairs.find((p: any) =>
                        p.chainId === chainSlug &&
                        (p.baseToken.address.toLowerCase() === normalizedFrom || p.quoteToken.address.toLowerCase() === normalizedFrom)
                    )

                    if (fromTokenPair) {
                        setDynamicPoolAddress(fromTokenPair.pairAddress)
                        return
                    }
                }
            } catch (error) {
                console.error("Failed to fetch DEX Screener pair:", error)
            }

            setDynamicPoolAddress(null)
        }

        fetchPair()
    }, [fromTokenAddress, toTokenAddress, chainSlug])

    // Construct the embed URL
    const embedUrl = useMemo(() => {
        if (!chainSlug) return null

        // Parameters based on working example
        const params = new URLSearchParams({
            embed: "1",
            loadChartSettings: "0",
            trades: "0",
            info: "0",
            chartLeftToolbar: "0",
            chartTheme: dexTheme,
            theme: dexTheme,
            chartStyle: "3",
            chartType: "usd",
            interval: "15",
        })
        const queryString = params.toString()

        // 1. Use dynamically found pool address (best)
        if (dynamicPoolAddress) {
            return `https://dexscreener.com/${chainSlug}/${dynamicPoolAddress}?${queryString}`
        }

        // 2. Fallback: Use fromTokenAddress directly if it's not native
        // DEX Screener often redirects to the liquid pair
        if (fromTokenAddress && fromTokenAddress !== "0x0000000000000000000000000000000000000000") {
            return `https://dexscreener.com/${chainSlug}/${fromTokenAddress.toLowerCase()}?${queryString}`
        }

        // 3. Last resort fallback for Native Monad
        if (chainId === 143) {
            // Default to WMON/USDC pool
            return `https://dexscreener.com/monad/0x659bD0BC4167BA25c62E05656F78043E7eD4a9da?${queryString}`
        }

        return null
    }, [chainSlug, dynamicPoolAddress, fromTokenAddress, chainId, dexTheme])

    // Handle iframe load events
    const handleIframeLoad = () => {
        setIsLoading(false)
        setHasError(false)
    }

    const handleIframeError = () => {
        setIsLoading(false)
        setHasError(true)
    }

    // Reset loading state and force iframe reload when URL changes (including theme changes)
    useEffect(() => {
        if (embedUrl) {
            setIsLoading(true)
            setHasError(false)
            setIframeKey(prev => prev + 1) // Force iframe to reload with new URL
        }
    }, [embedUrl])

    // Refresh the chart
    const handleRefresh = () => {
        setIsLoading(true)
        setHasError(false)
        setIframeKey(prev => prev + 1)
    }

    // Open in DEX Screener
    const openInDexScreener = () => {
        if (!chainSlug) return

        const url = dynamicPoolAddress
            ? `https://dexscreener.com/${chainSlug}/${dynamicPoolAddress}`
            : fromTokenAddress && fromTokenAddress !== "0x0000000000000000000000000000000000000000"
                ? `https://dexscreener.com/${chainSlug}/${fromTokenAddress.toLowerCase()}`
                : `https://dexscreener.com/${chainSlug}`

        window.open(url, '_blank', 'noopener,noreferrer')
    }

    // If no valid URL can be constructed
    if (!chainSlug) {
        return (
            <div className={`bg-card border border-border rounded-2xl overflow-hidden ${className}`}>
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src="https://dexscreener.com/favicon.ico"
                            alt="DEX Screener"
                            className="w-5 h-5 rounded"
                        />
                        <span className="font-semibold text-sm">{fromToken}/{toToken}</span>
                    </div>
                </div>
                <div className="h-[400px] flex items-center justify-center bg-muted/50">
                    <div className="text-center space-y-2 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mx-auto opacity-50" />
                        <p className="text-sm">Chain not supported by DEX Screener</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`bg-card border border-border rounded-2xl overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/50">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img
                            src="https://dexscreener.com/favicon.ico"
                            alt="DEX Screener"
                            className="w-6 h-6 rounded"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-card" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">{fromToken}/{toToken}</h3>
                        <span className="text-xs text-muted-foreground">Powered by DEX Screener</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Refresh chart"
                    >
                        <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={openInDexScreener}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                    </button>
                </div>
            </div>

            {/* Chart Container */}
            <div className="relative h-[400px] bg-background">
                {/* Loading Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Loading chart...</span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {hasError && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                        <div className="text-center space-y-3">
                            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground">Failed to load chart</p>
                            <button
                                onClick={handleRefresh}
                                className="px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}

                {/* DEX Screener Iframe */}
                {embedUrl && (
                    <iframe
                        key={iframeKey}
                        src={embedUrl}
                        title={`${fromToken}/${toToken} Chart - DEX Screener`}
                        className="w-full h-full border-0"
                        onLoad={handleIframeLoad}
                        onError={handleIframeError}
                        sandbox="allow-scripts allow-same-origin allow-popups"
                        loading="lazy"
                    />
                )}

                {/* No URL State */}
                {!embedUrl && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center space-y-3 px-6">
                            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">No chart available for this pair</p>
                                <p className="text-xs text-muted-foreground/70">
                                    This token pair may not have enough liquidity yet
                                </p>
                            </div>
                            <button
                                onClick={openInDexScreener}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Search on DEX Screener
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
                <p className="text-[10px] text-muted-foreground text-center">
                    Real-time market data • Powered by{" "}
                    <a
                        href="https://dexscreener.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                    >
                        DEX Screener
                    </a>
                </p>
            </div>
        </motion.div>
    )
}
