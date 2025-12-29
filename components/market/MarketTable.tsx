"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Filter, CheckCircle2, ChevronDown, ArrowRightLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Mock Data - Crypto Native (Atomic Swaps)
// If I am "Buying SOL", the maker is "Selling SOL" for "USDC" (or other token)
const initialOrders = [
    {
        id: 1,
        advertiser: "CryptoKing",
        verified: true,
        orders: 1234,
        completion: "99.8%",
        price: "145.20",
        token: "SOL",
        currency: "USDC", // What needs to be paid
        limitMin: "10",
        limitMax: "5000",
        available: "450.50",
        type: "buy" // User wants to BUY SOL
    },
    {
        id: 2,
        advertiser: "SolanaWhale",
        verified: true,
        orders: 856,
        completion: "98.5%",
        price: "145.18",
        token: "SOL",
        currency: "USDT",
        limitMin: "50",
        limitMax: "10000",
        available: "1200.00",
        type: "buy"
    },
    {
        id: 3,
        advertiser: "FastTrader_99",
        verified: false,
        orders: 45,
        completion: "95.0%",
        price: "145.15",
        token: "SOL",
        currency: "USDC",
        limitMin: "1",
        limitMax: "100",
        available: "50.00",
        type: "buy"
    },
    {
        id: 4,
        advertiser: "SecureSwap",
        verified: true,
        orders: 2100,
        completion: "99.9%",
        price: "146.50",
        token: "SOL",
        currency: "USDC",
        limitMin: "20",
        limitMax: "20000",
        available: "5000.00",
        type: "sell" // User wants to SELL SOL
    },
    {
        id: 5,
        advertiser: "Alice_Wonder",
        verified: true,
        orders: 320,
        completion: "97.2%",
        price: "146.80",
        token: "SOL",
        currency: "BONK",
        limitMin: "5",
        limitMax: "200",
        available: "150.00",
        type: "sell"
    }
]

interface MarketTableProps {
    onCreateOrder: () => void;
}

export function MarketTable({ onCreateOrder }: MarketTableProps) {
    const [mode, setMode] = useState<"buy" | "sell">("buy")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedToken, setSelectedToken] = useState<string>("SOL")
    const [selectedCurrency, setSelectedCurrency] = useState<string>("All")

    // Filter Logic
    const filteredOrders = useMemo(() => {
        return initialOrders.filter(order => {
            // 1. Filter by Mode (Buy/Sell)
            if (order.type !== mode) return false;

            // 2. Filter by Token (The asset being traded)
            if (order.token !== selectedToken) return false;

            // 3. Filter by Currency (The payment asset)
            if (selectedCurrency !== "All" && order.currency !== selectedCurrency) return false;

            // 4. Search Filter
            if (searchQuery && !order.advertiser.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            return true;
        })
    }, [mode, selectedToken, selectedCurrency, searchQuery])

    return (
        <div className="w-full space-y-6">
            {/* Controls Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-card/30 backdrop-blur-md p-4 rounded-2xl border border-border/50">

                <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
                    {/* Buy/Sell Toggle */}
                    <div className="flex bg-background/50 p-1 rounded-xl border border-border/50">
                        <button
                            onClick={() => setMode("buy")}
                            className={`flex-1 md:flex-none px-8 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${mode === "buy"
                                    ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Buy
                        </button>
                        <button
                            onClick={() => setMode("sell")}
                            className={`flex-1 md:flex-none px-8 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${mode === "sell"
                                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Sell
                        </button>
                    </div>

                    {/* Token Selector (Main Asset) */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-xl border border-border/50">
                        <span className="text-xs text-muted-foreground font-medium">Asset:</span>
                        <div className="flex items-center gap-2 font-bold">
                            <img src="https://assets.coingecko.com/coins/images/4128/standard/solana.png" className="w-5 h-5 rounded-full" alt="SOL" />
                            SOL
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            <Search className="h-4 w-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search advertiser..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-9 pr-4 rounded-xl bg-background/50 border border-border/50 text-sm focus:outline-none focus:border-primary/50 w-full md:w-48 transition-all"
                        />
                    </div>

                    {/* Payment Currency Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden md:inline-block">Pay with:</span>
                        {["All", "USDC", "USDT", "BONK"].map(curr => (
                            <button
                                key={curr}
                                onClick={() => setSelectedCurrency(curr)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedCurrency === curr
                                        ? "bg-primary/20 text-primary border border-primary/20"
                                        : "bg-background/50 text-muted-foreground border border-border/50 hover:border-primary/30"
                                    }`}
                            >
                                {curr}
                            </button>
                        ))}
                    </div>

                    <Button
                        onClick={onCreateOrder}
                        className="h-10 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Order
                    </Button>
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-5 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-2 md:col-span-1">Advertiser</div>
                <div className="hidden md:block">Price (per Token)</div>
                <div className="hidden md:block">Limit/Available</div>
                <div className="hidden md:block">Pay With Token</div>
                <div className="text-right md:text-center col-span-3 md:col-span-1">Trade Action</div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {filteredOrders.length > 0 ? (
                        filteredOrders.map((order, i) => (
                            <motion.div
                                key={order.id}
                                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3, delay: i * 0.05 }}
                                className="group grid grid-cols-1 md:grid-cols-5 items-center bg-card/40 hover:bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/30 p-4 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md"
                            >
                                {/* Advertiser */}
                                <div className="col-span-1 flex items-center gap-3">
                                    <div className="relative">
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-sm font-bold text-foreground border border-border/50">
                                            {order.advertiser[0]}
                                        </div>
                                        {order.verified && (
                                            <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500/20" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm flex items-center gap-1.5">
                                            {order.advertiser}
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <span>{order.orders} swaps</span>
                                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground" />
                                            <span>{order.completion}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="col-span-1 hidden md:block">
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-xl font-bold ${mode === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                                            {order.price}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-medium">{order.currency}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">per {order.token}</div>
                                </div>

                                {/* Limits */}
                                <div className="col-span-1 hidden md:block space-y-1">
                                    <div className="text-xs text-muted-foreground">
                                        Available: <span className="text-foreground font-medium">{order.available} {order.token}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Limit: <span className="text-foreground font-medium">{order.limitMin} - {order.limitMax} {order.token}</span>
                                    </div>
                                </div>

                                {/* Payment (Pay With) */}
                                <div className="col-span-1 hidden md:block">
                                    <div className="flex items-center gap-2">
                                        <div className="px-2 py-1 rounded-md bg-background/50 border border-border/50 flex items-center gap-1.5">
                                            {/* Simple logic for icons based on currency */}
                                            {order.currency === 'USDC' && <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center text-[8px] text-blue-500 font-bold">$</div>}
                                            {order.currency === 'USDT' && <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-[8px] text-green-500 font-bold">T</div>}
                                            {order.currency === 'BONK' && <div className="w-4 h-4 rounded-full bg-orange-500/20 flex items-center justify-center text-[8px] text-orange-500 font-bold">B</div>}
                                            <span className="text-xs font-medium text-muted-foreground">{order.currency}</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground bg-primary/10 px-1.5 py-0.5 rounded text-primary">Atomic Swap</span>
                                    </div>
                                </div>

                                {/* Action */}
                                <div className="col-span-1 flex justify-end md:justify-center">
                                    <Button
                                        className={`w-full md:w-auto px-8 font-bold shadow-lg transition-all hover:scale-105 ${mode === 'buy'
                                                ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20'
                                                : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                            }`}
                                    >
                                        {mode === 'buy' ? `Buy ${order.token}` : `Sell ${order.token}`}
                                    </Button>
                                </div>

                                {/* Mobile View Details (Hidden on Desktop) */}
                                <div className="md:hidden col-span-1 mt-4 pt-4 border-t border-border/50 flex justify-between items-center">
                                    <div>
                                        <div className={`text-lg font-bold ${mode === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                                            {order.price} <span className="text-xs text-muted-foreground">{order.currency}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Limit: {order.limitMin} - {order.limitMax} {order.token}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex gap-1 justify-end mb-2">
                                            <span className="text-xs font-medium text-muted-foreground bg-background/50 px-2 py-1 rounded">{order.currency}</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-20 text-muted-foreground"
                        >
                            <p>No orders found matching your criteria.</p>
                            <Button variant="link" className="text-primary" onClick={onCreateOrder}>Create an order</Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
