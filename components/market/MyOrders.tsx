"use client"

import { useEffect, useState } from "react"
import { useUserStore } from "@/hooks/useUserStore"
import { useZerocliq } from "@/lib/zerocliq/client"
import { motion } from "framer-motion"
import { ExternalLink, RefreshCw, XCircle } from "lucide-react"

interface Order {
    onChainId: string
    maker: string
    tokenA: string
    tokenB: string
    amount: number
    price: number
    status: string
    createdAt: string
    signature: string
}

export function MyOrders() {
    const { user } = useUserStore()
    const { connected, cancelOrder, tokens } = useZerocliq()
    const [orders, setOrders] = useState<Order[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const fetchOrders = async () => {
        if (!user) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/orders/user/${user.walletAddress}`)
            if (res.ok) {
                const data = await res.json()
                setOrders(data)
            }
        } catch (error) {
            console.error("Failed to fetch orders", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (user) {
            fetchOrders()
            const interval = setInterval(fetchOrders, 10000) // Poll for updates
            return () => clearInterval(interval)
        }
    }, [user])

    const handleCancel = async (orderId: string) => {
        if (!confirm("Are you sure you want to cancel this order?")) return;

        try {
            const signature = await cancelOrder(orderId);
            console.log("Order Cancelled:", signature);
            // Optimistic update or refresh
            fetchOrders();
        } catch (error: any) {
            alert("Failed to cancel order: " + error.message);
        }
    }

    if (!user) {
        return (
            <div className="text-center p-8 text-muted-foreground bg-background/30 rounded-xl border border-border/50">
                Please connect your wallet to view your orders.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h2 className="text-lg font-bold">My Active Orders</h2>
                <button
                    onClick={fetchOrders}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {orders.length === 0 && !isLoading && (
                <div className="text-center p-8 text-muted-foreground bg-background/30 rounded-xl border border-border/50">
                    No active orders found.
                </div>
            )}

            <div className="grid gap-3">
                {orders.map((order) => (
                    <motion.div
                        key={order.onChainId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card/50 border border-border/50 p-4 rounded-xl flex items-center justify-between"
                    >
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.status === 'OPEN' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'
                                    }`}>
                                    {order.status}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(order.createdAt).toLocaleString()}
                                </span>
                            </div>
                            <div className="font-bold text-sm">
                                {order.amount} {order.tokenB} <span className="text-muted-foreground mx-1">for</span> {order.tokenA}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Price: {order.price === 0 ? "Floating" : `${order.price.toFixed(4)}`}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <a
                                href={`https://explorer.solana.com/tx/${order.signature}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                                title="View transaction"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                            {order.status === 'OPEN' && (
                                <button
                                    onClick={() => handleCancel(order.onChainId)}
                                    className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                    title="Cancel Order"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
