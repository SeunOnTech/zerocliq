"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, ArrowRightLeft, MessageSquare, AlertCircle, ChevronLeft, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Notification, NotificationType, useNotificationStore } from "@/hooks/useNotificationStore";

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
            return <ArrowRightLeft className="h-5 w-5" />;
        case "COUNTER_OFFER":
            return <ArrowRightLeft className="h-5 w-5" />;
        case "MESSAGE":
            return <MessageSquare className="h-5 w-5" />;
        case "SYSTEM":
            return <AlertCircle className="h-5 w-5" />;
        default:
            return <Bell className="h-5 w-5" />;
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

const getTypeLabel = (type: NotificationType) => {
    switch (type) {
        case "ORDER_FILLED":
            return "Trade";
        case "ORDER_PARTIALLY_FILLED":
            return "Partial Fill";
        case "COUNTER_OFFER":
            return "Offer";
        case "MESSAGE":
            return "Message";
        case "SYSTEM":
            return "System";
        default:
            return "Notification";
    }
};

export default function NotificationDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { markAsRead } = useNotificationStore();

    const [notification, setNotification] = useState<Notification | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch single notification
    useEffect(() => {
        async function fetchNotification() {
            try {
                setIsLoading(true);
                const response = await fetch(`/api/notifications/${id}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        setError("Notification not found");
                    } else {
                        throw new Error("Failed to fetch notification");
                    }
                    return;
                }

                const data = await response.json();
                setNotification(data.notification);

                // Mark as read
                if (!data.notification.isRead) {
                    await markAsRead(id);
                }
            } catch (err) {
                console.error("Error fetching notification:", err);
                setError("Failed to load notification");
            } finally {
                setIsLoading(false);
            }
        }

        if (id) {
            fetchNotification();
        }
    }, [id, markAsRead]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !notification) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                <Bell className="h-12 w-12 text-muted-foreground/30" />
                <h1 className="text-xl font-bold">{error || "Notification Not Found"}</h1>
                <p className="text-sm text-muted-foreground">This notification doesn&apos;t exist.</p>
                <Link href="/market/notifications">
                    <Button variant="outline" size="sm">
                        Back to Notifications
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
            {/* Back Button */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => window.history.back()}
                >
                    <ChevronLeft className="mr-1 h-3 w-3" />
                    Back
                </Button>
            </motion.div>

            {/* Notification Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-xl border border-border bg-card space-y-4"
            >
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div
                        className={cn(
                            "h-12 w-12 rounded-full flex items-center justify-center shrink-0",
                            getNotificationColor(notification.type)
                        )}
                    >
                        {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-lg font-bold">{notification.title}</h1>
                            <Badge variant="secondary" className="text-[10px] h-5">
                                {getTypeLabel(notification.type)}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(notification.createdAt)}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-3">
                    <p className="text-sm text-foreground leading-relaxed">
                        {notification.details || notification.message}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                    {notification.relatedOrderId && (
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                            <ExternalLink className="h-3 w-3 mr-1.5" />
                            View Order
                        </Button>
                    )}
                    {notification.relatedUserAddress && (
                        <Link href={`/profile/${notification.relatedUserAddress}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                                View User Profile
                            </Button>
                        </Link>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
