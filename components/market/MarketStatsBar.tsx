"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TrendingUp, TrendingDown, Users, BarChart3, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface MarketStats {
    referencePrice: {
        token: string
        price: number
        priceChange24h: number
    }
    volume24h: number
    volumeChange24h: number
    activeTraders24h: number
    traderChange24h: number
    marketData: {
        token: string
        price: number
        priceChange24h: number
        high24h: number
        low24h: number
        volume24h: number
    }
    timestamp: number
}

function formatNumber(num: number, decimals = 2): string {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(decimals)}B`
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`
    return num.toFixed(decimals)
}

function formatPrice(price: number): string {
    if (price >= 1000) return price.toFixed(0)
    if (price >= 1) return price.toFixed(2)
    if (price >= 0.01) return price.toFixed(4)
    return price.toFixed(6)
}

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: string, prefix?: string, suffix?: string }) {
    return (
        <motion.span
            key={value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="tabular-nums"
        >
            {prefix}{value}{suffix}
        </motion.span>
    )
}

function StatCard({
    title,
    value,
    change,
    icon: Icon,
    prefix = "",
    suffix = "",
    isPositiveGood = true
}: {
    title: string
    value: string
    change?: number
    icon: React.ElementType
    prefix?: string
    suffix?: string
    isPositiveGood?: boolean
}) {
    const isPositive = change !== undefined && change >= 0
    const changeColor = isPositiveGood
        ? (isPositive ? "text-green-500" : "text-red-500")
        : (isPositive ? "text-red-500" : "text-green-500")

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4 transition-all hover:border-primary/30"
        >
            {/* Gradient accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity" />

            <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{title}</span>
                </div>

                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight">
                        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
                    </span>
                    {change !== undefined && (
                        <span className={cn("text-xs font-semibold flex items-center gap-0.5", changeColor)}>
                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isPositive ? "+" : ""}{change.toFixed(2)}%
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

function PriceCard({ stats }: { stats: MarketStats | null }) {
    const marketData = stats?.marketData
    const isPositive = marketData && marketData.priceChange24h >= 0

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4 transition-all hover:border-primary/30 col-span-2 lg:col-span-1"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity" />

            <div className="relative">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">◎</span>
                        </div>
                        <span className="text-sm font-medium">Market Price</span>
                    </div>
                    {marketData && (
                        <span className={cn(
                            "text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1",
                            isPositive ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                        )}>
                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isPositive ? "+" : ""}{marketData.priceChange24h.toFixed(2)}%
                        </span>
                    )}
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-bold tracking-tight">
                        {marketData ? formatPrice(marketData.price) : "—"}
                    </span>
                    <span className="text-sm text-muted-foreground">USDC</span>
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/30">
                    <div>
                        <div className="text-[10px] text-muted-foreground mb-0.5">24h High</div>
                        <div className="text-sm font-semibold text-green-500">
                            {marketData && marketData.high24h > 0 ? formatPrice(marketData.high24h) : "—"}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-muted-foreground mb-0.5">24h Low</div>
                        <div className="text-sm font-semibold text-red-500">
                            {marketData && marketData.low24h > 0 ? formatPrice(marketData.low24h) : "—"}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-muted-foreground mb-0.5">Vol (24h)</div>
                        <div className="text-sm font-semibold">
                            {marketData ? formatNumber(marketData.volume24h) : "—"}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4 animate-pulse">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-muted/30" />
                        <div className="h-3 w-20 bg-muted/30 rounded" />
                    </div>
                    <div className="h-8 w-28 bg-muted/30 rounded mt-1" />
                </div>
            ))}
        </div>
    )
}

export function MarketStatsBar() {
    const [stats, setStats] = useState<MarketStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/market/stats')
            if (!res.ok) throw new Error('Failed to fetch stats')
            const data = await res.json()
            setStats(data)
            setError(null)
        } catch (err) {
            console.error('Failed to fetch market stats:', err)
            setError('Failed to load stats')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
        // Refresh every 30 seconds
        const interval = setInterval(fetchStats, 30000)
        return () => clearInterval(interval)
    }, [])

    if (isLoading) {
        return <StatsSkeleton />
    }

    if (error && !stats) {
        return (
            <div className="text-center py-4 text-muted-foreground text-sm">
                {error}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Reference Price */}
            <StatCard
                title="Reference Price (SOL)"
                value={stats?.referencePrice.price ? formatPrice(stats.referencePrice.price) : "—"}
                change={stats?.referencePrice.priceChange24h}
                icon={Activity}
                prefix="$"
            />

            {/* 24h Volume */}
            <StatCard
                title="24h Volume"
                value={stats?.volume24h ? formatNumber(stats.volume24h, 0) : "0"}
                change={stats?.volumeChange24h}
                icon={BarChart3}
                prefix="$"
            />

            {/* Active Traders */}
            <StatCard
                title="Active Traders"
                value={stats?.activeTraders24h?.toString() || "0"}
                change={stats?.traderChange24h ? (stats.traderChange24h / Math.max(stats.activeTraders24h - stats.traderChange24h, 1)) * 100 : undefined}
                icon={Users}
                suffix={stats?.traderChange24h ? ` (+${stats.traderChange24h})` : ""}
            />

            {/* Market Price with details */}
            <PriceCard stats={stats} />
        </div>
    )
}
