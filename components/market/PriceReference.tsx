"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Activity, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface PriceReferenceProps {
    token: string
    currency: string
    currentPrice?: number // Optional: if provided, calculates premium/discount
}

// Mock Historical Data for Sparkline
const MOCK_HISTORY = [
    142.5, 143.2, 142.8, 143.5, 144.1, 143.9, 144.5, 145.2, 144.8, 145.5,
    146.1, 145.8, 146.5, 147.2, 146.9, 147.5, 148.1, 147.8, 148.5, 149.2
]

export function PriceReference({ token, currency, currentPrice }: PriceReferenceProps) {
    // Mock Market Data
    const marketPrice = 145.23
    const change24h = 2.45
    const high24h = 149.50
    const low24h = 141.20
    const volume24h = "1.2B"

    const premium = useMemo(() => {
        if (!currentPrice) return null;
        const diff = ((currentPrice - marketPrice) / marketPrice) * 100;
        return diff;
    }, [currentPrice, marketPrice]);

    // Simple Sparkline SVG Path
    const sparklinePath = useMemo(() => {
        const min = Math.min(...MOCK_HISTORY)
        const max = Math.max(...MOCK_HISTORY)
        const range = max - min
        const width = 100
        const height = 30

        return MOCK_HISTORY.map((val, i) => {
            const x = (i / (MOCK_HISTORY.length - 1)) * width
            const y = height - ((val - min) / range) * height
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
        }).join(' ')
    }, [])

    return (
        <div className="bg-card/30 backdrop-blur-md border border-border/50 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        Market Price <Info className="w-3 h-3 opacity-50" />
                    </h3>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold tracking-tight">
                            {marketPrice.toFixed(2)} <span className="text-sm font-medium text-muted-foreground">{currency}</span>
                        </span>
                        <span className={cn(
                            "text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5",
                            change24h >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                            {change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(change24h)}%
                        </span>
                    </div>
                </div>

                {/* Sparkline */}
                <div className="w-24 h-8">
                    <svg width="100%" height="100%" viewBox="0 0 100 30" preserveAspectRatio="none">
                        <path
                            d={sparklinePath}
                            fill="none"
                            stroke={change24h >= 0 ? "#22c55e" : "#ef4444"}
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                        />
                        <path
                            d={`${sparklinePath} V 30 H 0 Z`}
                            fill={change24h >= 0 ? "url(#gradient-green)" : "url(#gradient-red)"}
                            opacity="0.2"
                        />
                        <defs>
                            <linearGradient id="gradient-green" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" />
                                <stop offset="100%" stopColor="transparent" />
                            </linearGradient>
                            <linearGradient id="gradient-red" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#ef4444" />
                                <stop offset="100%" stopColor="transparent" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                <div>
                    <div className="text-[10px] text-muted-foreground">24h High</div>
                    <div className="text-xs font-medium">{high24h}</div>
                </div>
                <div>
                    <div className="text-[10px] text-muted-foreground">24h Low</div>
                    <div className="text-xs font-medium">{low24h}</div>
                </div>
                <div>
                    <div className="text-[10px] text-muted-foreground">Vol (24h)</div>
                    <div className="text-xs font-medium">{volume24h}</div>
                </div>
            </div>

            {/* Premium/Discount Indicator (Only if currentPrice is provided) */}
            {premium !== null && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "mt-3 p-2 rounded-lg text-xs font-medium flex justify-between items-center border",
                        premium > 0
                            ? "bg-green-500/5 border-green-500/20 text-green-500"
                            : premium < 0
                                ? "bg-red-500/5 border-red-500/20 text-red-500"
                                : "bg-muted/50 border-border text-muted-foreground"
                    )}
                >
                    <span>Vs Market Price</span>
                    <span className="font-bold">
                        {premium > 0 ? "+" : ""}{premium.toFixed(2)}%
                        {premium > 0 ? " Premium" : premium < 0 ? " Discount" : " Par"}
                    </span>
                </motion.div>
            )}
        </div>
    )
}
