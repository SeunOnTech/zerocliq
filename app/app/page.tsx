"use client"

import { motion } from "framer-motion"
import {
    ArrowRightLeft,
    Wallet,
    TrendingUp,
    ArrowUpRight,
    Zap,
    PieChart,
    Clock,
    Shield,
    ChevronRight,
    Sparkles,
    Loader2
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/store/useAppStore"
import { useActivityStore } from "@/hooks/useActivityStore"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

// Demo data for Permissions (leaving for now as requested primarily for Activity)


// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

export default function AppHomePage() {
    const router = useRouter()
    const userProfile = useAppStore((s) => s.userProfile)
    const getBalances = useAppStore((s) => s.getBalances)
    const balances = userProfile?.chainId ? getBalances(userProfile.chainId, 'smartAccount') : []

    // Connect to Activity Store
    const { activities, fetchActivities, isLoading: isActivityLoading } = useActivityStore()

    // Fetch activities on load
    const [stacks, setStacks] = useState<any[]>([])
    const [isLoadingStacks, setIsLoadingStacks] = useState(true)

    // Fetch activities and stacks on load
    useEffect(() => {
        if (userProfile?.walletAddress && userProfile?.chainId) {
            fetchActivities(userProfile.walletAddress, userProfile.chainId)

            // Fetch Stacks
            fetch(`/api/card-stacks?walletAddress=${userProfile.walletAddress}&chainId=${userProfile.chainId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setStacks(data.stacks || [])
                    }
                })
                .catch(err => console.error("Failed to fetch stacks", err))
                .finally(() => setIsLoadingStacks(false))
        } else {
            setIsLoadingStacks(false)
        }
    }, [userProfile?.walletAddress, userProfile?.chainId, fetchActivities])

    // Calculate total balance
    const totalBalance = balances?.reduce((sum: number, b: any) => sum + (b.usdValue || 0), 0) || 0
    const formattedBalance = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(totalBalance)

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-6">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-5"
            >
                {/* Top Stats Row */}
                <motion.div
                    variants={itemVariants}
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3"
                >
                    {/* Smart Account Balance */}
                    <StatCard
                        icon={<Wallet className="w-4 h-4" />}
                        label="Smart Account"
                        value={formattedBalance}
                        trend={totalBalance > 0 ? "+2.4%" : undefined}
                        trendUp={true}
                    />

                    {/* Today's Volume */}
                    <StatCard
                        icon={<TrendingUp className="w-4 h-4" />}
                        label="24h Volume"
                        value="$156.78"
                        subtext="3 swaps"
                    />

                    {/* Gas Saved */}
                    <StatCard
                        icon={<Zap className="w-4 h-4" />}
                        label="Gas Saved"
                        value="$12.50"
                        accent="emerald"
                    />

                    {/* Active Permissions */}
                    <StatCard
                        icon={<Shield className="w-4 h-4" />}
                        label="Permissions"
                        value="3 Active"
                        accent="primary"
                    />
                </motion.div>

                {/* Main Content Grid */}
                <div className="grid lg:grid-cols-3 gap-4">
                    {/* Left Column - Active Bots Widget */}
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <ActiveBotsWidget stacks={stacks} isLoading={isLoadingStacks} />
                    </motion.div>

                    {/* Right Column - Quick Actions + Activity */}
                    <motion.div variants={itemVariants} className="space-y-4">
                        {/* Quick Actions */}
                        <QuickActionsCard onNavigate={(path) => router.push(path)} />

                        {/* Recent Activity */}
                        <RecentActivityCard
                            activities={activities.slice(0, 5)}
                            isLoading={isActivityLoading}
                        />
                    </motion.div>
                </div>

                {/* Bottom CTA - Only if no stacks */}
                {!isLoadingStacks && stacks.length === 0 && (
                    <motion.div variants={itemVariants}>
                        <EmptyStateCard onCreateStack={() => router.push('/app/card-stacks')} />
                    </motion.div>
                )}
            </motion.div>
        </div>
    )
}

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
    icon: React.ReactNode
    label: string
    value: string
    trend?: string
    trendUp?: boolean
    subtext?: string
    accent?: "primary" | "emerald" | "amber"
}

function StatCard({ icon, label, value, trend, trendUp, subtext, accent }: StatCardProps) {
    const accentColors = {
        primary: "text-primary",
        emerald: "text-emerald-500",
        amber: "text-amber-500",
    }

    return (
        <div className="p-4 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-muted/50">
                    <span className="text-muted-foreground">{icon}</span>
                </div>
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
            </div>
            <div className="flex items-end justify-between gap-2">
                <p className={cn(
                    "text-lg font-bold",
                    accent ? accentColors[accent] : "text-foreground"
                )}>
                    {value}
                </p>
                {trend && (
                    <span className={cn(
                        "text-xs font-medium flex items-center",
                        trendUp ? "text-emerald-500" : "text-red-500"
                    )}>
                        <ArrowUpRight className={cn("w-3 h-3", !trendUp && "rotate-90")} />
                        {trend}
                    </span>
                )}
                {subtext && (
                    <span className="text-xs text-muted-foreground">{subtext}</span>
                )}
            </div>
        </div>
    )
}

// ============================================
// CARD STACK PREVIEW COMPONENT
// ============================================

// ============================================
// ACTIVE BOTS WIDGET COMPONENT
// ============================================

interface ActiveBotsWidgetProps {
    stacks: any[]
    isLoading: boolean
}

function ActiveBotsWidget({ stacks, isLoading }: ActiveBotsWidgetProps) {
    const router = useRouter()

    // Filter for active DCA bots
    const activeBots = stacks.flatMap(stack =>
        (stack.subCards || [])
            .filter((card: any) => card.type === "DCA_BOT" || card.name.includes("DCA"))
            .map((card: any) => ({
                ...card,
                tokenSymbol: stack.tokenSymbol,
                tokenDecimals: stack.tokenDecimals || 18,
                stackId: stack.id
            }))
    )

    if (isLoading) {
        return (
            <div className="p-5 rounded-xl bg-card border border-border h-[260px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (stacks.length === 0) {
        return (
            <div className="p-8 rounded-xl bg-card border border-border text-center h-full flex flex-col items-center justify-center">
                <div className="p-3 rounded-xl bg-primary/10 mb-3">
                    <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">No Active Strategies</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Start automating your trades with Card Stacks</p>
                <button
                    onClick={() => router.push('/app/card-stacks')}
                    className="text-xs font-medium text-primary hover:underline"
                >
                    Create your first stack →
                </button>
            </div>
        )
    }

    return (
        <div className="p-5 rounded-xl bg-card border border-border h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                        <Zap className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Active Bots</h3>
                        <p className="text-xs text-muted-foreground">{activeBots.length} strategies running</p>
                    </div>
                </div>
                <button
                    onClick={() => router.push('/app/card-stacks')}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
                >
                    Manage <ChevronRight className="w-3 h-3" />
                </button>
            </div>

            {/* Bots List */}
            {activeBots.length > 0 ? (
                <div className="space-y-3 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
                    {activeBots.map((bot: any, i: number) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => router.push('/app/card-stacks')}
                            className="p-3 rounded-lg bg-muted/30 border border-border flex items-center justify-between group hover:border-blue-500/30 hover:bg-muted/50 transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-xs">
                                    {bot.tokenSymbol?.[0] || "T"}
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-foreground">{bot.tokenSymbol} DCA</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Active
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">•</span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {(() => {
                                                const config = bot.config as any
                                                const dailyLimit = parseFloat(config?.dailyLimit || "0")
                                                if (dailyLimit > 0) {
                                                    const spent = parseFloat(bot.currentSpent || "0") / Math.pow(10, bot.tokenDecimals)
                                                    const percent = Math.round((spent / dailyLimit) * 100)
                                                    return `${percent}% Daily Limit`
                                                }
                                                return `${bot.allocationPercent}% Budget`
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-xs font-mono font-medium text-foreground">
                                    {(() => {
                                        const spent = parseFloat(bot.currentSpent || "0") / Math.pow(10, bot.tokenDecimals)
                                        return spent > 0
                                            ? `${spent.toFixed(4)} ${bot.tokenSymbol}`
                                            : "Waiting"
                                    })()}
                                </p>
                                <p className="text-[10px] text-muted-foreground">spent today</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-xs text-muted-foreground">You have stacks but no active DCA bots.</p>
                    <button className="mt-2 text-[10px] text-primary" onClick={() => router.push('/app/card-stacks')}>Enable one now</button>
                </div>
            )}
        </div>
    )
}

// ============================================
// QUICK ACTIONS CARD
// ============================================

interface QuickActionsCardProps {
    onNavigate: (path: string) => void
}

function QuickActionsCard({ onNavigate }: QuickActionsCardProps) {
    const actions = [
        { icon: <ArrowRightLeft className="w-4 h-4" />, label: "Swap", path: "/app/swap", color: "text-primary" },
        { icon: <Sparkles className="w-4 h-4" />, label: "New Stack", path: "/app/card-stacks", color: "text-amber-500" },
        { icon: <TrendingUp className="w-4 h-4" />, label: "Limits", path: "/app/limit-orders", color: "text-emerald-500" },
    ]

    return (
        <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-3">Quick Actions</p>
            <div className="grid grid-cols-3 gap-2">
                {actions.map((action) => (
                    <motion.button
                        key={action.path}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate(action.path)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors cursor-pointer"
                    >
                        <span className={action.color}>{action.icon}</span>
                        <span className="text-xs font-medium text-foreground">{action.label}</span>
                    </motion.button>
                ))}
            </div>
        </div>
    )
}

// ============================================
// RECENT ACTIVITY CARD
// ============================================

interface RecentActivityCardProps {
    activities: any[]
    isLoading: boolean
}

function RecentActivityCard({ activities, isLoading }: RecentActivityCardProps) {
    const router = useRouter()

    return (
        <div className="p-4 rounded-xl bg-card border border-border min-h-[200px]">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">Recent Activity</p>
                <button
                    onClick={() => router.push('/app/history')}
                    className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer"
                >
                    View all
                </button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mb-1" />
                    <span className="text-[10px]">Loading...</span>
                </div>
            ) : activities.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                    No recent activity
                </div>
            ) : (
                <div className="space-y-2">
                    {activities.map((item, i) => {
                        // Format display logic
                        let title = item.title
                        let via = "Manual"
                        let icon = <ArrowRightLeft className="w-3 h-3 text-primary" />

                        if (item.type === 'DCA_EXECUTION') {
                            via = "DCA Bot"
                            icon = <Clock className="w-3 h-3 text-amber-500" />
                        } else if (item.type === 'CARD_STACK_CREATE') {
                            via = "System"
                            icon = <Sparkles className="w-3 h-3 text-emerald-500" />
                        }

                        // Parse metadata for cleaner display if Swap
                        if (item.type === 'SWAP' && item.metadata) {
                            const m = item.metadata
                            if (m.fromAmount && m.toAmount) {
                                title = `${m.fromAmount} ${m.fromToken} → ${m.toAmount} ${m.toToken}`
                            }
                        }

                        // Time ago calculation
                        const date = new Date(item.createdAt)
                        const now = new Date()
                        const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000)
                        let timeStr = "just now"
                        if (diffMins < 60) timeStr = `${diffMins}m ago`
                        else if (diffMins < 1440) timeStr = `${Math.floor(diffMins / 60)}h ago`
                        else timeStr = `${Math.floor(diffMins / 1440)}d ago`

                        return (
                            <div
                                key={item.id}
                                className="flex items-center justify-between py-2 border-b border-border last:border-0"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-primary/10">
                                        {icon}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-foreground truncate max-w-[140px]">
                                            {title}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">via {via}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    {timeStr}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ============================================
// EMPTY STATE CARD
// ============================================

interface EmptyStateCardProps {
    onCreateStack: () => void
}

function EmptyStateCard({ onCreateStack }: EmptyStateCardProps) {
    return (
        <div className="p-6 rounded-xl bg-card border border-dashed border-border text-center">
            <div className="inline-flex p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-4">
                <PieChart className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
                Set Up Your First Card Stack
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
                Allocate budgets for different trading strategies. Each with its own limits, all with one signature.
            </p>
            <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCreateStack}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
            >
                <Sparkles className="w-4 h-4" />
                Create Card Stack
            </motion.button>
        </div>
    )
}
