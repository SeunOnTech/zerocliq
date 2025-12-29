"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Filter, CheckCircle2, ChevronDown, ChevronRight, ArrowRightLeft, Plus, SlidersHorizontal, ArrowUpDown, Clock, ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TokenSelector } from "@/components/ui/token-selector"
import { cn } from "@/lib/utils"
import { Token } from "@/types/token"
import { POPULAR_TOKENS, ALL_TOKEN } from "@/lib/constants/tokens"
import { TakeOrderModal } from "@/components/market/TakeOrderModal"
import { PaymentMethodSelector } from "@/components/market/PaymentMethodSelector"
import { useZerocliq, Order as SDKOrder } from "@/lib/zerocliq/client"
import { getTokenLogo } from "@/lib/tokens"
import Link from "next/link"
import { SwapRouteVisual } from "@/components/market/SwapRouteVisual"

// Demo/Mock Data (isLive: false) - COMMENTED OUT FOR PRODUCTION
/*
const demoOrders = [
    // SOL Orders
    { id: "demo-1", advertiser: "SecureSwap", verified: true, orders: 2100, completion: "99.9%", price: "146.50", token: "SOL", currency: "USDC", limitMin: 20, limitMax: 20000, available: 5000.00, type: "sell", isLive: false },
    { id: "demo-2", advertiser: "Alice_Wonder", verified: true, orders: 320, completion: "97.2%", price: "146.80", token: "SOL", currency: "BONK", limitMin: 5, limitMax: 200, available: 150.00, type: "sell", isLive: false },
    { id: "demo-3", advertiser: "MoonWalker", verified: false, orders: 12, completion: "88.0%", price: "147.00", token: "SOL", currency: "USDT", limitMin: 1, limitMax: 50, available: 15.00, type: "sell", isLive: false },
    { id: "demo-4", advertiser: "CryptoKing", verified: true, orders: 1234, completion: "99.8%", price: "145.20", token: "SOL", currency: "USDC", limitMin: 10, limitMax: 5000, available: 450.50, type: "buy", isLive: false },
    { id: "demo-5", advertiser: "SolanaWhale", verified: true, orders: 856, completion: "98.5%", price: "145.18", token: "SOL", currency: "USDT", limitMin: 50, limitMax: 10000, available: 1200.00, type: "buy", isLive: false },
    // USDC Orders
    { id: "demo-6", advertiser: "StableSwap", verified: true, orders: 5000, completion: "99.9%", price: "1.001", token: "USDC", currency: "USDT", limitMin: 1000, limitMax: 100000, available: 500000.00, type: "buy", isLive: false },
    { id: "demo-7", advertiser: "ArbBot_3000", verified: true, orders: 15000, completion: "100%", price: "0.999", token: "USDC", currency: "USDT", limitMin: 5000, limitMax: 250000, available: 100000.00, type: "sell", isLive: false },
    // BONK Orders
    { id: "demo-8", advertiser: "BonkMaster", verified: false, orders: 88, completion: "92.0%", price: "0.000025", token: "BONK", currency: "SOL", limitMin: 1000000, limitMax: 50000000, available: 100000000.00, type: "sell", isLive: false },
    { id: "demo-9", advertiser: "DogeKiller", verified: true, orders: 450, completion: "97.5%", price: "0.000023", token: "BONK", currency: "USDC", limitMin: 500000, limitMax: 10000000, available: 50000000.00, type: "buy", isLive: false },
    // JUP Orders
    { id: "demo-10", advertiser: "JupLover", verified: true, orders: 150, completion: "96.5%", price: "1.05", token: "JUP", currency: "USDC", limitMin: 100, limitMax: 5000, available: 10000.00, type: "buy", isLive: false },
    { id: "demo-11", advertiser: "JupiterDAO", verified: true, orders: 890, completion: "99.8%", price: "1.08", token: "JUP", currency: "USDC", limitMin: 500, limitMax: 10000, available: 25000.00, type: "sell", isLive: false },
    // More SOL
    { id: "demo-12", advertiser: "HODLer_XYZ", verified: true, orders: 12, completion: "100%", price: "148.50", token: "SOL", currency: "USDC", limitMin: 50, limitMax: 500, available: 200.00, type: "sell", isLive: false },
]
*/

interface OrderBookProps {
    onCreateOrder: () => void;
}

export function OrderBook({ onCreateOrder }: OrderBookProps) {
    const zerocliq = useZerocliq()

    const [searchQuery, setSearchQuery] = useState("")
    const [selectedToken, setSelectedToken] = useState<Token>(ALL_TOKEN) // Default to All
    const [selectedCurrency, setSelectedCurrency] = useState<string>("All")
    const [priceRange, setPriceRange] = useState([0, 10000])
    const [minOrderSize, setMinOrderSize] = useState("")
    const [sortBy, setSortBy] = useState<"price" | "reputation" | "size">("price")
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [isTakeModalOpen, setIsTakeModalOpen] = useState(false)
    const [liveOrders, setLiveOrders] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Fetch live orders from SDK (on-chain)
    useEffect(() => {
        const fetchLiveOrders = async () => {
            setIsLoading(true)
            try {
                console.log("[OrderBook] Fetching live orders from chain via SDK...")
                const orders = await zerocliq.getActiveOrders()
                console.log("[OrderBook] SDK returned orders:", orders)

                // Map SDK Order type to UI format
                const mappedOrders = orders.map((order: SDKOrder) => ({
                    id: order.orderId,
                    onChainId: order.orderId,
                    advertiser: `${order.maker.slice(0, 4)}...${order.maker.slice(-4)}`,
                    makerAddress: order.maker,
                    verified: false,
                    orders: 0,
                    completion: "0%",
                    price: order.effectivePrice.toFixed(4),
                    token: order.tokenA.symbol,
                    currency: order.tokenB.symbol,
                    available: order.amountARemaining,
                    limitMin: Math.min(1, order.amountARemaining),
                    limitMax: order.amountARemaining,
                    type: "sell",
                    isLive: true,
                    isFloating: order.isFloating,
                    formattedPrice: order.formattedPrice,
                    formattedAmount: order.formattedAmount,
                }))

                /*
                // Enrich with DB data (limits + user info) - DISABLED FOR DEMO
                try {
                    // ... (API call removed)
                } catch (e) {
                    console.log("[OrderBook] Could not fetch DB enrichment, using defaults")
                }
                */

                console.log("[OrderBook] Mapped live orders:", mappedOrders)
                setLiveOrders(mappedOrders)
            } catch (error) {
                console.error("[OrderBook] Failed to fetch live orders:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchLiveOrders()
        // Refresh every 30 seconds
        const interval = setInterval(fetchLiveOrders, 30000)
        return () => clearInterval(interval)
    }, [zerocliq])

    const handleOrderClick = (order: any) => {
        setSelectedOrder(order)
        setIsTakeModalOpen(true)
    }

    const filteredOrders = useMemo(() => {
        // Only show live orders from blockchain (demo orders commented out)
        const allOrders = [...liveOrders]

        return allOrders.filter(order => {
            // Filter by token pair
            if (selectedToken.symbol !== "All" && order.token !== selectedToken.symbol) return false
            if (selectedCurrency !== "All" && order.currency !== selectedCurrency) return false

            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                return (
                    order.advertiser.toLowerCase().includes(query) ||
                    order.token.toLowerCase().includes(query) ||
                    order.currency.toLowerCase().includes(query)
                )
            }

            const price = parseFloat(order.price)
            if (price < priceRange[0] || price > priceRange[1]) return false

            if (minOrderSize && parseFloat(order.limitMin.toString()) > parseFloat(minOrderSize)) return false

            return true
        }).sort((a, b) => {
            // Live orders always come first
            if (a.isLive && !b.isLive) return -1
            if (!a.isLive && b.isLive) return 1

            // Then sort by selected criteria
            if (sortBy === 'price') {
                return parseFloat(a.price) - parseFloat(b.price)
            }
            if (sortBy === 'reputation') {
                return parseFloat(b.completion) - parseFloat(a.completion)
            }
            if (sortBy === 'size') {
                return b.available - a.available
            }
            return 0
        })
    }, [searchQuery, selectedToken, selectedCurrency, priceRange, minOrderSize, sortBy, liveOrders])

    return (
        <div className="space-y-6">
            {selectedOrder && (
                <TakeOrderModal
                    isOpen={isTakeModalOpen}
                    onClose={() => setIsTakeModalOpen(false)}
                    order={selectedOrder}
                    mode={selectedOrder.type === 'sell' ? 'buy' : 'sell'}
                />
            )}

            {/* Header Controls - Creative Single-Row Design */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch">
                {/* Left Section - Pair Selection */}
                <div className="flex items-center gap-3 bg-background/30 backdrop-blur-sm p-2 rounded-2xl border border-border/30 w-full lg:w-auto">
                    {/* Token Pair Selection */}
                    <div className="flex items-center gap-2 w-full">
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1 ml-1">
                                <ArrowDown className="w-3 h-3 text-primary" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Receive</span>
                            </div>
                            <div className="w-full">
                                <TokenSelector
                                    selectedToken={selectedToken}
                                    onSelect={setSelectedToken}
                                />
                            </div>
                        </div>

                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground mt-6 shrink-0" />

                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1 ml-1">
                                <ArrowUp className="w-3 h-3 text-red-500" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pay</span>
                            </div>
                            <div className="w-full">
                                <PaymentMethodSelector
                                    value={selectedCurrency}
                                    onSelect={setSelectedCurrency}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Section - Search, Filters & Create */}
                <div className="flex items-center gap-2 bg-background/30 backdrop-blur-sm p-2 rounded-2xl border border-border/30 w-full lg:w-auto overflow-x-auto no-scrollbar">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[120px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-9 pr-4 rounded-xl bg-background/50 border border-border/40 text-sm focus:outline-none focus:border-primary/50 w-full transition-all"
                        />
                    </div>

                    {/* Advanced Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-accent/30 shrink-0">
                                <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4 bg-card/95 backdrop-blur-xl border-border/50 rounded-xl">
                            <div className="space-y-4">
                                <h4 className="font-medium leading-none">Filters</h4>
                                <div className="space-y-2">
                                    <label className="text-xs text-muted-foreground">Price Range</label>
                                    <Slider
                                        defaultValue={[0, 10000]}
                                        max={10000}
                                        step={1}
                                        value={priceRange}
                                        onValueChange={setPriceRange}
                                        className="py-4"
                                    />
                                    <div className="flex justify-between text-xs font-mono">
                                        <span>${priceRange[0]}</span>
                                        <span>${priceRange[1]}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-muted-foreground">Min Order Size</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 100"
                                        value={minOrderSize}
                                        onChange={(e) => setMinOrderSize(e.target.value)}
                                        className="w-full h-8 px-3 rounded-lg bg-background/50 border border-border/50 text-sm"
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Sort */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-accent/30 shrink-0">
                                <ArrowUpDown className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-2 bg-card/95 backdrop-blur-xl border-border/50 rounded-xl">
                            <div className="grid gap-1">
                                {['price', 'reputation', 'size'].map((sort) => (
                                    <button
                                        key={sort}
                                        onClick={() => setSortBy(sort as any)}
                                        className={cn(
                                            "flex items-center w-full px-2 py-1.5 text-sm rounded-lg hover:bg-primary/10 transition-colors",
                                            sortBy === sort ? "text-primary font-bold" : "text-muted-foreground"
                                        )}
                                    >
                                        {sort.charAt(0).toUpperCase() + sort.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Divider */}
                    <div className="w-px h-8 bg-border/50 shrink-0" />

                    {/* Create Order Button - Premium Style */}
                    <Button
                        onClick={onCreateOrder}
                        className="h-10 px-4 md:px-5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all hover:scale-105 shrink-0 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create
                    </Button>
                </div>
            </div>

            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-6 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-2">Advertiser</div>
                <div>Price</div>
                <div>Limit/Available</div>
                <div className="text-center">Route</div>
                <div className="text-center">Action</div>
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
                                className="group relative cursor-pointer bg-card/40 hover:bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/30 p-4 md:py-3 md:px-6 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-6 items-center gap-4 md:gap-0">

                                    {/* Advertiser Info - Clickable to Profile */}
                                    <Link
                                        href={`/profile/${order.makerAddress || order.advertiser}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="col-span-2 flex items-center gap-3 hover:opacity-80 transition-opacity"
                                    >
                                        <div className="relative">
                                            {order.avatarUrl ? (
                                                <img
                                                    src={order.avatarUrl}
                                                    alt={order.advertiser}
                                                    className="h-10 w-10 rounded-full object-cover border border-border/50"
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground border border-border/50">
                                                    {order.advertiser[0]}
                                                </div>
                                            )}
                                            {order.verified && (
                                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500/20" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm flex items-center gap-1.5">
                                                {order.advertiser}
                                                {order.isLive && (
                                                    <span className="px-1.5 py-0.5 text-[8px] font-bold bg-green-500 text-white rounded-full animate-pulse">
                                                        LIVE
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                                <span>{order.orders} swaps</span>
                                                <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground" />
                                                <span>{order.completion}</span>
                                            </div>
                                        </div>
                                    </Link>

                                    {/* Price */}
                                    <div className="col-span-1 flex flex-col justify-center">
                                        <div className="flex items-baseline gap-1">
                                            <span className={cn("text-lg font-bold", order.type === 'sell' ? 'text-green-500' : 'text-red-500')}>
                                                {order.price}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {getTokenLogo(order.currency) && (
                                                    <img src={getTokenLogo(order.currency)} alt={order.currency} className="w-3.5 h-3.5 rounded-full" />
                                                )}
                                                <span className="text-[10px] text-muted-foreground font-medium">{order.currency}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Limits */}
                                    <div className="col-span-1 space-y-0.5">
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            Avail:
                                            <span className="text-foreground font-medium flex items-center gap-1">
                                                {order.available}
                                                {getTokenLogo(order.token) && (
                                                    <img src={getTokenLogo(order.token)} alt={order.token} className="w-3 h-3 rounded-full" />
                                                )}
                                                {order.token}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            Limit: <span className="text-foreground font-medium">{order.limitMin} - {order.limitMax}</span>
                                        </div>
                                    </div>

                                    {/* Swap Route Visual - Replaces Payment */}
                                    <div className="col-span-1 flex justify-center">
                                        <SwapRouteVisual tokenA={order.token} tokenB={order.currency} />
                                    </div>

                                    {/* Action */}
                                    <div className="col-span-1 flex justify-end">
                                        <Button
                                            onClick={() => handleOrderClick(order)}
                                            className="w-full md:w-auto px-4 font-bold transition-all hover:scale-105 h-9 text-xs border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                                        >
                                            Swap
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : isLoading ? (
                        // Creative Animated Loading Skeleton
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="relative overflow-hidden p-4 md:p-5 rounded-2xl bg-card border border-border/30"
                                >
                                    {/* Shimmer effect */}
                                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-muted/10" />

                                    <div className="grid grid-cols-6 gap-4 items-center">
                                        {/* Avatar skeleton */}
                                        <div className="col-span-2 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                                            <div className="space-y-2">
                                                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                                                <div className="h-3 w-16 bg-muted/30 rounded animate-pulse" />
                                            </div>
                                        </div>

                                        {/* Price skeleton */}
                                        <div className="col-span-1">
                                            <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                                        </div>

                                        {/* Limit skeleton */}
                                        <div className="col-span-1">
                                            <div className="h-4 w-20 bg-muted/30 rounded animate-pulse mb-1" />
                                            <div className="h-3 w-14 bg-muted/20 rounded animate-pulse" />
                                        </div>

                                        {/* Payment skeleton */}
                                        <div className="col-span-1">
                                            <div className="h-6 w-12 bg-muted/30 rounded-full animate-pulse" />
                                        </div>

                                        {/* Button skeleton */}
                                        <div className="col-span-1 flex justify-end">
                                            <div className="h-9 w-20 bg-muted rounded-xl animate-pulse" />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
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
