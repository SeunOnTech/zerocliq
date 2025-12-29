"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    Trophy,
    Wallet,
    Activity,
    ArrowRightLeft,
    Clock,
    CheckCircle2,
    XCircle,
    ExternalLink,
    TrendingUp,
    Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { User } from "@/hooks/useUserStore";

// Demo User Data
const DEMO_USER: User = {
    walletAddress: "DemoTrader123ABC456DEF789GHI",
    username: "CryptoKing",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=cryptoking",
    isVerified: true,
    totalOrders: 156,
    totalVolume: 45230.50,
    completionRate: 98.5,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
    updatedAt: new Date().toISOString(),
};

// Demo Active Orders (Token Swaps - giving tokenOut, receiving tokenIn)
const DEMO_ACTIVE_ORDERS = [
    {
        id: "order-1",
        tokenOut: "SOL",
        tokenIn: "USDC",
        amountOut: 25.5,
        amountIn: 3712.50,
        status: "open",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
    {
        id: "order-2",
        tokenOut: "BONK",
        tokenIn: "SOL",
        amountOut: 5000000,
        amountIn: 0.125,
        status: "open",
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: "order-3",
        tokenOut: "USDC",
        tokenIn: "JUP",
        amountOut: 157.50,
        amountIn: 150,
        status: "open",
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
];

// Demo Trade History
const DEMO_TRADE_HISTORY = [
    {
        id: "trade-1",
        tokenIn: "USDC",
        tokenOut: "SOL",
        amountIn: 1450,
        amountOut: 10,
        status: "completed",
        txSignature: "5xYz...ABC1",
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: "trade-2",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: 5,
        amountOut: 725.50,
        status: "completed",
        txSignature: "3wQr...DEF2",
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: "trade-3",
        tokenIn: "BONK",
        tokenOut: "SOL",
        amountIn: 10000000,
        amountOut: 0.25,
        status: "completed",
        txSignature: "7mNp...GHI3",
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: "trade-4",
        tokenIn: "JUP",
        tokenOut: "USDC",
        amountIn: 100,
        amountOut: 105,
        status: "cancelled",
        txSignature: "9kLm...JKL4",
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
];

// Animated Stats Card
function StatsCard({
    title,
    value,
    icon: Icon,
    delay = 0,
}: {
    title: string;
    value: string;
    icon: React.ElementType;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="p-4 rounded-xl border border-border bg-card"
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{title}</span>
                <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold">{value}</p>
        </motion.div>
    );
}

// Format time ago
function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Format number
function formatNumber(num: number) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
}

export default function ProfilePage() {
    const params = useParams();
    const address = params.address as string;
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("orders");

    useEffect(() => {
        if (!address) return;

        const fetchUser = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/user/${address}`);
                if (!res.ok) {
                    // Use demo data if user not found
                    setUser({ ...DEMO_USER, walletAddress: address });
                    return;
                }
                const data = await res.json();
                setUser(data);
            } catch {
                // Use demo data on error
                setUser({ ...DEMO_USER, walletAddress: address });
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [address]);

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
                {/* Loading Skeleton */}
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card animate-pulse">
                    <div className="h-16 w-16 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-32 bg-muted rounded" />
                        <div className="h-4 w-48 bg-muted rounded" />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse">
                            <div className="h-4 w-16 bg-muted rounded mb-2" />
                            <div className="h-6 w-20 bg-muted rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                <h1 className="text-xl font-bold text-destructive">Profile Not Found</h1>
                <p className="text-sm text-muted-foreground">This user does not exist.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
            {/* Back Button */}
            <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => window.history.back()}
            >
                <ChevronLeft className="mr-1 h-3 w-3" />
                Back
            </Button>

            {/* Profile Header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card"
            >
                <Avatar className="h-16 w-16 border border-border">
                    <AvatarImage src={user.avatarUrl || ""} />
                    <AvatarFallback className="text-lg font-bold">
                        {user.username?.slice(0, 2).toUpperCase() || "ZS"}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-lg font-bold truncate">{user.username}</h1>
                        {user.isVerified && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold bg-blue-500/10 text-blue-500 border-transparent">
                                <Shield className="h-3 w-3 mr-0.5" />
                                Verified
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Wallet className="h-3 w-3" />
                        <span className="font-mono truncate">
                            {user.walletAddress.slice(0, 4)}...{user.walletAddress.slice(-4)}
                        </span>
                        <span className="text-muted-foreground/50">•</span>
                        <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                <Button variant="outline" size="sm" className="h-8 text-xs hidden sm:flex">
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    Explorer
                </Button>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
                <StatsCard
                    title="Total Volume"
                    value={`$${formatNumber(user.totalVolume)}`}
                    icon={TrendingUp}
                    delay={0.1}
                />
                <StatsCard
                    title="Orders"
                    value={user.totalOrders.toString()}
                    icon={Trophy}
                    delay={0.15}
                />
                <StatsCard
                    title="Success Rate"
                    value={`${user.completionRate}%`}
                    icon={Activity}
                    delay={0.2}
                />
            </div>

            {/* Activity Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full justify-start h-9 p-1 bg-muted/50">
                        <TabsTrigger value="orders" className="text-xs h-7">
                            Active Orders
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs h-7">
                            Trade History
                        </TabsTrigger>
                    </TabsList>

                    <AnimatePresence mode="wait">
                        <TabsContent value="orders" className="mt-4 space-y-2">
                            {DEMO_ACTIVE_ORDERS.map((order, i) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                                            <ArrowRightLeft className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">
                                                {formatNumber(order.amountOut)} {order.tokenOut} → {formatNumber(order.amountIn)} {order.tokenIn}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Swap Order
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant="outline" className="text-[10px] h-5 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                            Open
                                        </Badge>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {formatTimeAgo(order.createdAt)}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </TabsContent>

                        <TabsContent value="history" className="mt-4 space-y-2">
                            {DEMO_TRADE_HISTORY.map((trade, i) => (
                                <motion.div
                                    key={trade.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center",
                                            trade.status === "completed" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                        )}>
                                            {trade.status === "completed" ? (
                                                <CheckCircle2 className="h-4 w-4" />
                                            ) : (
                                                <XCircle className="h-4 w-4" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">
                                                {formatNumber(trade.amountIn)} {trade.tokenIn} → {formatNumber(trade.amountOut)} {trade.tokenOut}
                                            </p>
                                            <p className="text-xs text-muted-foreground font-mono">
                                                {trade.txSignature}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[10px] h-5",
                                                trade.status === "completed"
                                                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                                                    : "bg-red-500/10 text-red-600 border-red-500/20"
                                            )}
                                        >
                                            {trade.status === "completed" ? "Completed" : "Cancelled"}
                                        </Badge>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {formatTimeAgo(trade.completedAt)}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </TabsContent>
                    </AnimatePresence>
                </Tabs>
            </motion.div>
        </div>
    );
}
