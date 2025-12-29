"use client"

import { useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowRightLeft,
    TrendingUp,
    Wallet,
    Layers,
    Clock,
    ExternalLink,
    ChevronRight,
    Check,
    AlertCircle,
    Loader2,
    Activity as ActivityIcon,
    Filter,
    RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useActivityStore, type Activity, type ActivityType, type ActivityFilter } from "@/hooks/useActivityStore"
import { useAccount } from "wagmi"
import { useCurrentChainTokens } from "@/hooks/useCurrentChainTokens"

// ============================================
// HELPERS
// ============================================

const getActivityIcon = (type: ActivityType) => {
    switch (type) {
        case "SWAP":
            return ArrowRightLeft
        case "DCA_EXECUTION":
            return TrendingUp
        case "SMART_ACCOUNT_DEPLOY":
        case "SMART_ACCOUNT_FUND":
            return Wallet
        case "CARD_STACK_CREATE":
        case "CARD_STACK_PAUSE":
        case "CARD_STACK_RESUME":
            return Layers
        case "APPROVAL":
            return Check
        default:
            return ActivityIcon
    }
}

const getStatusColor = (status: string) => {
    switch (status) {
        case "SUCCESS":
            return "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
        case "PENDING":
            return "bg-amber-500/10 text-amber-500 ring-amber-500/20"
        case "FAILED":
            return "bg-red-500/10 text-red-500 ring-red-500/20"
        default:
            return "bg-muted text-muted-foreground ring-border"
    }
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case "SUCCESS":
            return { icon: Check, label: "Success", color: "bg-emerald-500" }
        case "PENDING":
            return { icon: Clock, label: "Pending", color: "bg-amber-500" }
        case "FAILED":
            return { icon: AlertCircle, label: "Failed", color: "bg-red-500" }
        default:
            return { icon: Clock, label: status, color: "bg-muted" }
    }
}

const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return "Yesterday"
    return `${diffDays}d ago`
}

// Use dynamic explorer URL from chains config
import { getExplorerTxUrl } from "@/lib/chains"

// ============================================
// ANIMATION VARIANTS
// ============================================

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
}

// ============================================
// FILTER TABS
// ============================================

const FILTER_TABS: { id: ActivityFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "swaps", label: "Swaps" },
    { id: "dca", label: "DCA" },
    { id: "account", label: "Account" },
]

// ============================================
// MAIN COMPONENT
// ============================================

export default function ActivityPage() {
    const { address: walletAddress } = useAccount()
    const { currentChain } = useCurrentChainTokens()
    const chainId = currentChain?.id

    const {
        activities,
        isLoading,
        filter,
        hasMore,
        fetchActivities,
        loadMore,
        setFilter
    } = useActivityStore()

    // Fetch on mount and when wallet/chain changes
    useEffect(() => {
        if (walletAddress && chainId) {
            fetchActivities(walletAddress, chainId)
        }
    }, [walletAddress, chainId, fetchActivities])

    const handleRefresh = () => {
        if (walletAddress && chainId) {
            fetchActivities(walletAddress, chainId)
        }
    }

    return (
        <div className="min-h-screen">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-2xl mx-auto px-4 py-6 space-y-6"
            >
                {/* Page Header */}
                <motion.div variants={itemVariants} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <ActivityIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-foreground">Activity</h1>
                            <p className="text-xs text-muted-foreground">Your transaction history</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="h-8 w-8 p-0"
                    >
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </Button>
                </motion.div>

                {/* Filter Tabs */}
                <motion.div variants={itemVariants} className="flex items-center gap-2 overflow-x-auto pb-2">
                    {FILTER_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                                filter === tab.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </motion.div>

                {/* Activity List */}
                <motion.div variants={itemVariants} className="space-y-3">
                    {isLoading && activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                            <p className="text-xs text-muted-foreground mt-2">Loading activities...</p>
                        </div>
                    ) : activities.length === 0 ? (
                        <EmptyState filter={filter} />
                    ) : (
                        <>
                            {activities.map((activity, index) => (
                                <ActivityCard
                                    key={activity.id}
                                    activity={activity}
                                    chainId={chainId}
                                    index={index}
                                />
                            ))}

                            {/* Load More */}
                            {hasMore && (
                                <div className="flex justify-center pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadMore}
                                        disabled={isLoading}
                                        className="gap-2"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4" />
                                        )}
                                        Load more
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            </motion.div>
        </div>
    )
}

// ============================================
// ACTIVITY CARD
// ============================================

interface ActivityCardProps {
    activity: Activity
    chainId?: number
    index: number
}

function ActivityCard({ activity, chainId, index }: ActivityCardProps) {
    const Icon = getActivityIcon(activity.type)
    const statusBadge = getStatusBadge(activity.status)
    const StatusIcon = statusBadge.icon

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="group p-4 rounded-xl bg-card border border-border hover:border-primary/20 transition-all"
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn(
                    "relative p-2.5 rounded-xl ring-1",
                    getStatusColor(activity.status)
                )}>
                    <Icon className="w-5 h-5" />
                    <div className={cn(
                        "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-card",
                        statusBadge.color
                    )}>
                        <StatusIcon className="w-2.5 h-2.5 text-white" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                {activity.title}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {activity.description}
                            </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatTimeAgo(activity.createdAt)}
                        </span>
                    </div>

                    {/* Metadata Row */}
                    <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                            {/* Status Badge */}
                            <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                                activity.status === "SUCCESS" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                activity.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                activity.status === "FAILED" && "bg-red-500/10 text-red-600 dark:text-red-400"
                            )}>
                                {statusBadge.label}
                            </span>

                            {/* Type Badge */}
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {activity.type.replace(/_/g, ' ')}
                            </span>
                        </div>

                        {/* Explorer Link */}
                        {activity.txHash && chainId && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(getExplorerTxUrl(chainId, activity.txHash!), '_blank')}
                            >
                                <ExternalLink className="w-3 h-3" />
                                Explorer
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState({ filter }: { filter: ActivityFilter }) {
    const messages: Record<ActivityFilter, { title: string; description: string }> = {
        all: { title: "No activity yet", description: "Your transactions will appear here" },
        swaps: { title: "No swaps yet", description: "Swap tokens to see your history" },
        dca: { title: "No DCA executions", description: "Set up DCA to see automated trades" },
        account: { title: "No account activity", description: "Deploy or fund your Smart Account" },
    }

    const msg = messages[filter]

    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
                <ActivityIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">{msg.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{msg.description}</p>
        </div>
    )
}
