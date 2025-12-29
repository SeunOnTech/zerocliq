"use client"

import { useState } from "react"
import { Navbar } from "@/components/layouts/Navbar"
import { Footer } from "@/components/layouts/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"
import { ArrowLeft, ArrowRight, ArrowDown, Wallet, Info } from "lucide-react"
import Link from "next/link"

export default function CreateOrderPage() {
    const [orderType, setOrderType] = useState<"buy" | "sell">("buy")
    const [asset, setAsset] = useState("SOL")
    const [currency, setCurrency] = useState("USDC")
    const [amount, setAmount] = useState("")
    const [price, setPrice] = useState("")

    return (
        <main className="min-h-screen bg-background text-foreground selection:bg-primary/20">
            <Navbar />

            <div className="container mx-auto px-4 pt-32 pb-20">
                <div className="max-w-2xl mx-auto">
                    {/* Back Link */}
                    <Link href="/market" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Market
                    </Link>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card/50 backdrop-blur-md border border-border/50 rounded-3xl p-8 shadow-xl relative overflow-hidden"
                    >
                        {/* Background Glow */}
                        <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${orderType === 'buy' ? 'from-green-500/10' : 'from-red-500/10'} to-transparent blur-3xl -z-10`} />

                        <div className="mb-8">
                            <h1 className="text-3xl font-bold mb-2">Create Order</h1>
                            <p className="text-muted-foreground">Set your price and terms. Zero slippage execution.</p>
                        </div>

                        {/* Order Type Toggle */}
                        <div className="flex bg-background/50 p-1 rounded-xl border border-border/50 mb-8">
                            <button
                                onClick={() => setOrderType("buy")}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all duration-300 ${orderType === "buy"
                                        ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                I want to Buy
                            </button>
                            <button
                                onClick={() => setOrderType("sell")}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all duration-300 ${orderType === "sell"
                                        ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                I want to Sell
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Asset Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Asset</Label>
                                    <div className="h-12 bg-background/50 border border-border/50 rounded-xl flex items-center px-4 font-bold gap-2">
                                        <img src="https://assets.coingecko.com/coins/images/4128/standard/solana.png" className="w-6 h-6 rounded-full" alt="SOL" />
                                        SOL
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>With Currency</Label>
                                    <div className="h-12 bg-background/50 border border-border/50 rounded-xl flex items-center px-4 font-bold gap-2 text-muted-foreground">
                                        USDC
                                    </div>
                                </div>
                            </div>

                            {/* Amount & Price Inputs */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label>Amount ({asset})</Label>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Wallet className="w-3 h-3" /> Balance: 0.00 {asset}
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="h-14 pl-4 pr-16 text-lg font-bold bg-background/50 border-border/50 focus:border-primary/50 rounded-xl"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                                            {asset}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-center text-muted-foreground">
                                    <ArrowDown className="w-5 h-5 opacity-50" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Price (in {currency})</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            className="h-14 pl-4 pr-16 text-lg font-bold bg-background/50 border-border/50 focus:border-primary/50 rounded-xl"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                                            {currency}
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                                        <span>Market Rate: 1 {asset} ≈ 145.23 {currency}</span>
                                        <span className="text-green-500">2.4% Premium</span>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Card */}
                            <div className="bg-background/30 rounded-xl p-4 border border-border/50 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {orderType === "buy" ? "You Pay" : "You Receive"}
                                    </span>
                                    <span className="font-bold text-lg">
                                        {amount && price ? (parseFloat(amount) * parseFloat(price)).toFixed(2) : "0.00"} {currency}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {orderType === "buy" ? "You Receive" : "You Sell"}
                                    </span>
                                    <span className="font-bold text-lg">
                                        {amount || "0.00"} {asset}
                                    </span>
                                </div>
                                <div className="h-px bg-border/50 my-2" />
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Platform Fee (0%)</span>
                                    <span className="font-bold text-green-500">FREE</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Network Fee</span>
                                    <span className="font-bold">~0.000005 SOL</span>
                                </div>
                            </div>

                            <Button
                                className={`w-full h-14 text-lg font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] ${orderType === "buy"
                                        ? "bg-green-500 hover:bg-green-600 shadow-green-500/20"
                                        : "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                                    }`}
                            >
                                {orderType === "buy" ? "Create Buy Order" : "Create Sell Order"}
                            </Button>

                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                <Info className="w-3 h-3" />
                                <span>Funds will be held in a secure atomic escrow until trade execution.</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <Footer />
        </main>
    )
}
