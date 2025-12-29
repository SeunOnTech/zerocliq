"use client"

import { useMemo } from "react"
import { SwapInterface } from "@/components/features/swap/SwapInterface"
import { DexScreenerChart } from "@/components/features/swap/DexScreenerChart"
import { useAppStore } from "@/store/useAppStore"
import { useCurrentChainTokens } from "@/hooks/useCurrentChainTokens"
import { motion } from "framer-motion"
import type { TokenInfo } from "@/components/features/swap/TokenSelectorModal"

export default function SwapPage() {
    // Read swap tokens from Zustand (synced by SwapInterface after user interaction)
    const swapSellToken = useAppStore((s) => s.swapSellToken)
    const swapBuyToken = useAppStore((s) => s.swapBuyToken)

    // Get chain tokens as fallback for initial load (same source as SwapInterface)
    const { tokens: chainTokens } = useCurrentChainTokens()

    // Derive default tokens from chain (same logic as SwapInterface)
    const defaultTokens = useMemo(() => {
        if (chainTokens.length === 0) {
            return { sell: null, buy: null }
        }
        const sell = chainTokens[0] as TokenInfo
        const buy = (chainTokens.find((t: TokenInfo) => t.isStable) || chainTokens[1] || chainTokens[0]) as TokenInfo
        return { sell, buy }
    }, [chainTokens])

    // Use Zustand tokens if available, otherwise use default from chain
    const sellToken = swapSellToken || (defaultTokens.sell ? {
        symbol: defaultTokens.sell.symbol,
        address: defaultTokens.sell.address,
        logoURI: defaultTokens.sell.logoURI
    } : { symbol: "ETH", address: "" })

    const buyToken = swapBuyToken || (defaultTokens.buy ? {
        symbol: defaultTokens.buy.symbol,
        address: defaultTokens.buy.address,
        logoURI: defaultTokens.buy.logoURI
    } : { symbol: "USDC", address: "" })

    return (
        <div className="container max-w-7xl mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">

            {/* Left Column: Swap Interface */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full lg:w-[480px] shrink-0"
            >
                <SwapInterface />
            </motion.div>

            {/* Right Column: DexScreener Chart - Shows below on mobile, beside on desktop */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex-1 w-full"
            >
                <DexScreenerChart
                    fromToken={sellToken.symbol}
                    toToken={buyToken.symbol}
                    fromTokenAddress={sellToken.address}
                    toTokenAddress={buyToken.address}
                />
            </motion.div>

        </div>
    )
}
