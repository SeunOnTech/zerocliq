"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, ArrowRightLeft, MessageSquare, AlertCircle, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNotificationStore, NotificationType } from "@/hooks/useNotificationStore";

// Helper function to format time ago
function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
        case "ORDER_FILLED":
        case "ORDER_PARTIALLY_FILLED":
            return <ArrowRightLeft className="h-4 w-4" />;
        case "COUNTER_OFFER":
            return <ArrowRightLeft className="h-4 w-4" />;
        case "MESSAGE":
            return <MessageSquare className="h-4 w-4" />;
        case "SYSTEM":
            return <AlertCircle className="h-4 w-4" />;
        default:
            return <Bell className="h-4 w-4" />;
    }
};

const getNotificationColor = (type: NotificationType) => {
    switch (type) {
        case "ORDER_FILLED":
        case "ORDER_PARTIALLY_FILLED":
            return "bg-green-500/10 text-green-500";
        case "COUNTER_OFFER":
            return "bg-orange-500/10 text-orange-500";
        case "MESSAGE":
            return "bg-blue-500/10 text-blue-500";
        case "SYSTEM":
            return "bg-muted text-muted-foreground";
        default:
            return "bg-muted text-muted-foreground";
    }
};

export default function NotificationsPage() {
    const { publicKey } = useWallet();
    const walletAddress = publicKey?.toBase58();

    const {
        notifications,
        isLoading,
        getUnreadCount,
        markAsRead,
        markAllAsRead,
        fetchNotifications,
    } = useNotificationStore();

    const unreadCount = getUnreadCount();

    // Fetch notifications on mount
    useEffect(() => {
        if (walletAddress) {
            fetchNotifications(walletAddress);
        }
    }, [walletAddress, fetchNotifications]);

    const handleMarkAllAsRead = async () => {
        if (walletAddress) {
            await markAllAsRead(walletAddress);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        await markAsRead(id);
    };

    if (!walletAddress) {
        return (
            <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 text-muted-foreground"
                >
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Connect your wallet to see notifications</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.history.back()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold">Notifications</h1>
                        <p className="text-xs text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
                        </p>
                    </div>
                </div>
                {unreadCount > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        className="h-8 text-xs"
                    >
                        <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                        Mark all read
                    </Button>
                )}
            </motion.div>

            {/* Loading State */}
            {isLoading && notifications.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center py-12"
                >
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </motion.div>
            )}

            {/* Notifications List */}
            {!isLoading && notifications.length > 0 && (
                <div className="space-y-2">
                    <AnimatePresence>
                        {notifications.map((notification, index) => (
                            <motion.div
                                key={notification.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Link
                                    href={`/market/notifications/${notification.id}`}
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    className={cn(
                                        "flex items-start gap-4 p-4 rounded-xl border border-border cursor-pointer transition-all",
                                        notification.isRead
                                            ? "bg-card hover:bg-accent/30"
                                            : "bg-accent/20 hover:bg-accent/40 border-primary/20"
                                    )}
                                >
                                    {/* Icon */}
                                    <div
                                        className={cn(
                                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                            getNotificationColor(notification.type)
                                        )}
                                    >
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p
                                                className={cn(
                                                    "text-sm",
                                                    notification.isRead ? "font-medium" : "font-bold"
                                                )}
                                            >
                                                {notification.title}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                    {formatTimeAgo(notification.createdAt)}
                                                </span>
                                                {!notification.isRead && (
                                                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {notification.message}
                                        </p>
                                        {notification.relatedUserAddress && (
                                            <Link
                                                href={`/profile/${notification.relatedUserAddress}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-block mt-2 text-xs text-primary hover:underline"
                                            >
                                                View User Profile →
                                            </Link>
                                        )}
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && notifications.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 text-muted-foreground"
                >
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">No notifications yet</p>
                </motion.div>
            )}
        </div>
    );
}
