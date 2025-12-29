"use client"

import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
    Bell,
    X,
    CheckCheck,
    ArrowRightLeft,
    Layers,
    Wallet,
    TrendingUp,
    Zap,
    ChevronRight,
    ChevronLeft,
    Clock,
    ExternalLink,
    Check,
    AlertCircle,
    Sparkles,
    RefreshCw,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNotificationStore, type Notification, type NotificationType } from "@/hooks/useNotificationStore"
import { useAccount } from "wagmi"
import { useCurrentChainTokens } from "@/hooks/useCurrentChainTokens"

// ============================================
// HELPERS
// ============================================

const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
        case "SWAP_SUCCESS":
        case "SWAP_FAILED":
        case "SWAP_PENDING":
            return ArrowRightLeft
        case "DCA_EXECUTED":
        case "DCA_FAILED":
            return TrendingUp
        case "SMART_ACCOUNT_DEPLOYED":
        case "SMART_ACCOUNT_FUNDED":
            return Wallet
        case "CARD_STACK_CREATED":
        case "CARD_STACK_EXPIRED":
        case "PERMISSION_EXPIRING":
        case "PERMISSION_EXPIRED":
            return Layers
        case "SYSTEM_ALERT":
        case "SYSTEM_INFO":
            return Sparkles
        default:
            return Bell
    }
}

const getStatusFromType = (type: NotificationType): "success" | "pending" | "failed" | "info" => {
    if (type.includes("SUCCESS") || type.includes("DEPLOYED") || type.includes("FUNDED") || type.includes("CREATED") || type.includes("EXECUTED")) {
        return "success"
    }
    if (type.includes("FAILED") || type.includes("EXPIRED")) {
        return "failed"
    }
    if (type.includes("PENDING") || type.includes("EXPIRING")) {
        return "pending"
    }
    return "info"
}

const getStatusColor = (status: "success" | "pending" | "failed" | "info") => {
    switch (status) {
        case "success": return "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
        case "pending": return "bg-amber-500/10 text-amber-500 ring-amber-500/20"
        case "failed": return "bg-red-500/10 text-red-500 ring-red-500/20"
        case "info": return "bg-blue-500/10 text-blue-500 ring-blue-500/20"
        default: return "bg-muted text-muted-foreground ring-border"
    }
}

const getStatusIcon = (status: "success" | "pending" | "failed" | "info") => {
    switch (status) {
        case "success": return Check
        case "pending": return Clock
        case "failed": return AlertCircle
        case "info": return Zap
        default: return Bell
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

const groupNotificationsByDate = (notifications: Notification[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const groups: { label: string; notifications: Notification[] }[] = [
        { label: "Today", notifications: [] },
        { label: "Yesterday", notifications: [] },
        { label: "Earlier", notifications: [] },
    ]

    notifications.forEach((n) => {
        const nDate = new Date(n.createdAt)
        nDate.setHours(0, 0, 0, 0)

        if (nDate.getTime() === today.getTime()) {
            groups[0].notifications.push(n)
        } else if (nDate.getTime() === yesterday.getTime()) {
            groups[1].notifications.push(n)
        } else {
            groups[2].notifications.push(n)
        }
    })

    return groups.filter((g) => g.notifications.length > 0)
}

// Get explorer URL for transaction - use dynamic chain config
import { getExplorerTxUrl } from "@/lib/chains"

// ============================================
// ANIMATION VARIANTS
// ============================================

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
}

const panelVariants = {
    hidden: { x: "100%", opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: "spring" as const, damping: 30, stiffness: 300 } },
    exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } }
}

// ============================================
// MAIN COMPONENT
// ============================================

interface NotificationsPanelProps {
    isCollapsed?: boolean
    inHeader?: boolean
}

export function NotificationsPanel({ isCollapsed = false, inHeader = false }: NotificationsPanelProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [viewMode, setViewMode] = useState<"list" | "detail">("list")
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    // Get wallet and chain info
    const { address: walletAddress } = useAccount()
    const { currentChain } = useCurrentChainTokens()
    const chainId = currentChain?.id

    // Notification store
    const {
        notifications,
        isLoading,
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        startPolling,
        stopPolling
    } = useNotificationStore()

    // Mount check for portal
    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    // Start polling when wallet connects
    useEffect(() => {
        if (walletAddress && chainId) {
            startPolling(walletAddress, chainId)
        }
        return () => stopPolling()
    }, [walletAddress, chainId, startPolling, stopPolling])

    const groupedNotifications = useMemo(() => groupNotificationsByDate(notifications), [notifications])
    const selectedNotification = useMemo(() => notifications.find((n) => n.id === selectedId), [notifications, selectedId])

    const handleMarkAllAsRead = () => {
        markAllAsRead()
    }

    const handleRefresh = () => {
        if (walletAddress && chainId) {
            fetchNotifications(walletAddress, chainId)
        }
    }

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id)
        }
        setSelectedId(notification.id)
        setViewMode("detail")
    }

    const handleBackToList = () => {
        setViewMode("list")
        setSelectedId(null)
    }

    const handleClose = () => {
        setIsOpen(false)
        setViewMode("list")
        setSelectedId(null)
    }

    // Bell button trigger
    const BellTrigger = (
        <button
            onClick={() => setIsOpen(true)}
            className={cn(
                "relative p-2 rounded-lg transition-colors cursor-pointer",
                inHeader
                    ? "hover:bg-muted"
                    : "flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground w-full",
                isCollapsed && !inHeader && "justify-center"
            )}
        >
            <div className="relative">
                <Bell className={cn("shrink-0", inHeader ? "w-4 h-4" : "w-5 h-5")} />
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center"
                        >
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
            {!isCollapsed && !inHeader && <span className="font-medium">Notifications</span>}
        </button>
    )

    return (
        <>
            {BellTrigger}

            {mounted && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                variants={overlayVariants}
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                onClick={handleClose}
                                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]"
                            />

                            {/* Single Slide-in Panel */}
                            <motion.div
                                variants={panelVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="fixed right-0 top-0 h-screen w-full max-w-sm bg-white dark:bg-zinc-900 border-l border-border z-[60] shadow-2xl flex flex-col"
                            >
                                {/* Internal View Switching */}
                                <AnimatePresence mode="wait">
                                    {viewMode === "list" && (
                                        <NotificationListView
                                            key="list"
                                            groupedNotifications={groupedNotifications}
                                            unreadCount={unreadCount}
                                            isLoading={isLoading}
                                            onClose={handleClose}
                                            onMarkAllRead={handleMarkAllAsRead}
                                            onRefresh={handleRefresh}
                                            onNotificationClick={handleNotificationClick}
                                        />
                                    )}
                                    {viewMode === "detail" && selectedNotification && (
                                        <NotificationDetailView
                                            key="detail"
                                            notification={selectedNotification}
                                            chainId={chainId}
                                            onBack={handleBackToList}
                                        />
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}

// ============================================
// LIST VIEW COMPONENT
// ============================================

interface NotificationListViewProps {
    groupedNotifications: { label: string; notifications: Notification[] }[]
    unreadCount: number
    isLoading: boolean
    onClose: () => void
    onMarkAllRead: () => void
    onRefresh: () => void
    onNotificationClick: (notification: Notification) => void
}

function NotificationListView({
    groupedNotifications,
    unreadCount,
    isLoading,
    onClose,
    onMarkAllRead,
    onRefresh,
    onNotificationClick
}: NotificationListViewProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="h-full flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                        <Bell className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">Notifications</h2>
                        <p className="text-[10px] text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="h-7 w-7 p-0 cursor-pointer"
                    >
                        <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                    </Button>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onMarkAllRead}
                            className="h-7 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            <CheckCheck className="w-3 h-3 mr-1" />
                            Mark all
                        </Button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {isLoading && groupedNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                        <p className="text-xs text-muted-foreground mt-2">Loading notifications...</p>
                    </div>
                ) : groupedNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-4 rounded-full bg-muted/50 mb-4">
                            <Bell className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No notifications</p>
                        <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
                    </div>
                ) : (
                    groupedNotifications.map((group) => (
                        <div key={group.label}>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                                {group.label}
                            </p>
                            <div className="space-y-1.5">
                                {group.notifications.map((notification, index) => {
                                    const Icon = getNotificationIcon(notification.type)
                                    const status = getStatusFromType(notification.type)
                                    const StatusIcon = getStatusIcon(status)

                                    return (
                                        <motion.div
                                            key={notification.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            onClick={() => onNotificationClick(notification)}
                                            className={cn(
                                                "group relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all",
                                                notification.read
                                                    ? "bg-transparent hover:bg-muted/50"
                                                    : "bg-primary/5 hover:bg-primary/10 ring-1 ring-primary/10"
                                            )}
                                        >
                                            {/* Icon */}
                                            <div className={cn(
                                                "relative p-2 rounded-lg ring-1",
                                                getStatusColor(status)
                                            )}>
                                                <Icon className="w-4 h-4" />
                                                <div className={cn(
                                                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-900",
                                                    status === "success" && "bg-emerald-500",
                                                    status === "pending" && "bg-amber-500",
                                                    status === "failed" && "bg-red-500",
                                                    status === "info" && "bg-blue-500"
                                                )}>
                                                    <StatusIcon className="w-2 h-2 text-white" />
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={cn(
                                                        "text-xs truncate",
                                                        notification.read ? "font-medium text-foreground" : "font-bold text-foreground"
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                        {formatTimeAgo(notification.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                                    {notification.message}
                                                </p>
                                            </div>

                                            {/* Unread indicator */}
                                            {!notification.read && (
                                                <motion.span
                                                    animate={{ scale: [1, 1.2, 1] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary"
                                                />
                                            )}

                                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center" />
                                        </motion.div>
                                    )
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    )
}

// ============================================
// DETAIL VIEW COMPONENT
// ============================================

interface NotificationDetailViewProps {
    notification: Notification
    chainId?: number
    onBack: () => void
}

function NotificationDetailView({ notification, chainId, onBack }: NotificationDetailViewProps) {
    const Icon = getNotificationIcon(notification.type)
    const status = getStatusFromType(notification.type)
    const txHash = notification.metadata?.txHash

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className="h-full flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                    <h2 className="text-sm font-bold text-foreground">Notification</h2>
                    <p className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(notification.createdAt)}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Status Card */}
                <div className="text-center py-6">
                    <div className={cn(
                        "inline-flex p-4 rounded-2xl ring-1 mb-4",
                        getStatusColor(status)
                    )}>
                        <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-1">
                        {notification.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {notification.message}
                    </p>
                </div>

                {/* Metadata */}
                {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                            Details
                        </p>
                        <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                            {Object.entries(notification.metadata).map(([key, value]) => {
                                // Skip internal keys
                                if (key === 'error') return null

                                return (
                                    <div key={key} className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground capitalize">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                        <span className="font-medium text-foreground font-mono text-right max-w-[180px] truncate">
                                            {typeof value === 'string' && value.startsWith('0x') && value.length > 20
                                                ? `${value.slice(0, 8)}...${value.slice(-6)}`
                                                : String(value)
                                            }
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Error message if failed */}
                {notification.metadata?.error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-600 dark:text-red-400">
                            {notification.metadata.error}
                        </p>
                    </div>
                )}

                {/* Actions */}
                {txHash && chainId && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-9 text-xs gap-2 cursor-pointer"
                        onClick={() => window.open(getExplorerTxUrl(chainId, txHash), '_blank')}
                    >
                        <ExternalLink className="w-3 h-3" />
                        View on Explorer
                    </Button>
                )}
            </div>
        </motion.div>
    )
}
