"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowRight, Check, ExternalLink, AlertCircle, Zap, Shield, Clock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useZerocliq } from "@/lib/zerocliq/client"
import { useUserStore } from "@/hooks/useUserStore"
import { getTokenLogo } from "@/lib/tokens"

interface TakeOrderModalProps {
    isOpen: boolean
    onClose: () => void
    order: {
        id: string
        onChainId?: string
        advertiser: string
        avatarUrl?: string
        verified: boolean
        orders: number
        completion: string
        price: string
        token: string
        currency: string
        available: number
        limitMin: number
        limitMax: number
        isLive?: boolean
        makerAddress?: string
        type?: 'buy' | 'sell'
    }
    mode: "buy" | "sell"
}

export function TakeOrderModal({ isOpen, onClose, order, mode }: TakeOrderModalProps) {
    const { user } = useUserStore()
    const zerocliq = useZerocliq()

    const [step, setStep] = useState<"input" | "confirm" | "processing" | "success" | "error">("input")
    const [amount, setAmount] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [txSignature, setTxSignature] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const price = parseFloat(order.price)
    const amountNum = parseFloat(amount) || 0
    const total = amountNum * price

    const handleClose = () => {
        setStep("input")
        setAmount("")
        setErrorMessage(null)
        setTxSignature(null)
        onClose()
    }

    const handleConfirm = () => {
        if (!amount || amountNum < order.limitMin || amountNum > order.limitMax) return
        setStep("confirm")
    }

    const handleExecute = async () => {
        if (!order.isLive || !order.onChainId) {
            // Demo order - just show success
            setStep("processing")
            await new Promise(r => setTimeout(r, 2000))
            setTxSignature("DEMO_TX_" + Date.now())
            setStep("success")
            return
        }

        if (!zerocliq.connected || !user) {
            setErrorMessage("Please connect your wallet first.")
            setStep("error")
            return
        }

        setStep("processing")
        setIsLoading(true)

        try {
            const signature = await zerocliq.takeOrder(order.onChainId, amountNum)
            console.log("Order Taken:", signature)
            setTxSignature(signature)

            // Update user stats and record swap after successful swap
            try {
                await fetch('/api/user/stats/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        makerAddress: order.makerAddress,
                        takerAddress: user.walletAddress,
                        volume: total,
                        txSignature: signature,
                        orderId: order.onChainId,
                        tokenIn: order.currency,
                        tokenOut: order.token,
                        amountIn: total,
                        amountOut: amountNum,
                        priceUsd: parseFloat(order.price)
                    })
                })
            } catch (statsError) {
                console.error("Failed to update stats:", statsError)
                // Don't fail the swap if stats update fails
            }

            setStep("success")
        } catch (error: any) {
            console.error("Take Order Error:", error)
            setErrorMessage(error.message || "Failed to execute swap")
            setStep("error")
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center",
                                mode === "buy" ? "bg-green-500/20" : "bg-red-500/20"
                            )}>
                                <Zap className={cn("w-5 h-5", mode === "buy" ? "text-green-500" : "text-red-500")} />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">
                                    {mode === "buy" ? "Buy" : "Sell"} {order.token}
                                </h2>
                                <p className="text-xs text-muted-foreground">Instant atomic swap</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-full hover:bg-background/50 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        <AnimatePresence mode="wait">
                            {step === "input" && (
                                <motion.div
                                    key="input"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-4"
                                >
                                    {/* Seller Info */}
                                    <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                        <div className="relative">
                                            {order.avatarUrl ? (
                                                <img
                                                    src={order.avatarUrl}
                                                    alt={order.advertiser}
                                                    className="w-10 h-10 rounded-full object-cover border border-border/50"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center font-bold border border-border/50">
                                                    {order.advertiser[0]}
                                                </div>
                                            )}
                                            {order.verified && (
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5 text-black" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm">{order.advertiser}</span>
                                                {order.isLive && (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-green-500 text-white rounded-full animate-pulse">
                                                        LIVE
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {order.orders} trades • {order.completion}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={cn(
                                                "text-lg font-bold",
                                                mode === "buy" ? "text-green-500" : "text-red-500"
                                            )}>
                                                {order.price}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                                                {getTokenLogo(order.currency) && (
                                                    <img src={getTokenLogo(order.currency)} alt={order.currency} className="w-3 h-3 rounded-full" />
                                                )}
                                                {order.currency}/
                                                {getTokenLogo(order.token) && (
                                                    <img src={getTokenLogo(order.token)} alt={order.token} className="w-3 h-3 rounded-full" />
                                                )}
                                                {order.token}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs">Amount ({order.token})</Label>
                                            <span className="text-[10px] text-muted-foreground">
                                                Limit: {order.limitMin} - {order.limitMax}
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="h-14 text-2xl font-bold bg-background/50 border-border/50 pr-20"
                                                autoFocus
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                <button
                                                    onClick={() => setAmount(order.available.toString())}
                                                    className="px-2 py-1 text-[10px] font-bold bg-primary/20 text-primary rounded hover:bg-primary/30"
                                                >
                                                    MAX
                                                </button>
                                                <div className="flex items-center gap-1">
                                                    {getTokenLogo(order.token) && (
                                                        <img src={getTokenLogo(order.token)} alt={order.token} className="w-4 h-4 rounded-full" />
                                                    )}
                                                    <span className="text-sm font-bold text-muted-foreground">{order.token}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="p-3 bg-background/30 rounded-xl border border-border/50 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">You {mode === "buy" ? "pay" : "receive"}</span>
                                            <span className="font-bold flex items-center gap-1">
                                                {total.toFixed(2)}
                                                {getTokenLogo(order.currency) && (
                                                    <img src={getTokenLogo(order.currency)} alt={order.currency} className="w-4 h-4 rounded-full" />
                                                )}
                                                {order.currency}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">You {mode === "buy" ? "receive" : "pay"}</span>
                                            <span className="font-bold flex items-center gap-1">
                                                {amountNum.toFixed(4)}
                                                {getTokenLogo(order.token) && (
                                                    <img src={getTokenLogo(order.token)} alt={order.token} className="w-4 h-4 rounded-full" />
                                                )}
                                                {order.token}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 pt-2 border-t border-border/50">
                                            <Shield className="w-3 h-3 text-primary" />
                                            <span className="text-[10px] text-muted-foreground">Protected by atomic swap</span>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleConfirm}
                                        disabled={!amount || amountNum < order.limitMin || amountNum > order.limitMax}
                                        className={cn(
                                            "w-full h-12 text-base font-bold rounded-xl shadow-lg",
                                            mode === "buy"
                                                ? "bg-green-500 hover:bg-green-600 shadow-green-500/20"
                                                : "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                                        )}
                                    >
                                        Continue <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </motion.div>
                            )}

                            {step === "confirm" && (
                                <motion.div
                                    key="confirm"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div className="text-center py-4">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Shield className="w-8 h-8 text-primary" />
                                        </div>
                                        <h3 className="text-xl font-bold mb-1">Confirm Swap</h3>
                                        <p className="text-sm text-muted-foreground">Review and sign the transaction</p>
                                    </div>

                                    <div className="p-4 bg-background/50 rounded-xl border border-border/50 space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground text-sm">You {mode === "buy" ? "Pay" : "Receive"}</span>
                                            <span className="font-bold">{total.toFixed(2)} {order.currency}</span>
                                        </div>
                                        <div className="flex justify-center">
                                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground text-sm">You {mode === "buy" ? "Receive" : "Pay"}</span>
                                            <span className="font-bold text-primary">{amountNum.toFixed(4)} {order.token}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setStep("input")}
                                            className="flex-1 h-11 rounded-xl"
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            onClick={handleExecute}
                                            className={cn(
                                                "flex-1 h-11 font-bold rounded-xl",
                                                mode === "buy"
                                                    ? "bg-green-500 hover:bg-green-600"
                                                    : "bg-red-500 hover:bg-red-600"
                                            )}
                                        >
                                            Sign & Swap
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {step === "processing" && (
                                <motion.div
                                    key="processing"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="py-12 text-center"
                                >
                                    <div className="relative w-20 h-20 mx-auto mb-6">
                                        <motion.div
                                            className="absolute inset-0 border-4 border-primary/30 rounded-full"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        />
                                        <motion.div
                                            className="absolute inset-2 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full"
                                            animate={{ rotate: -360 }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        />
                                        <Zap className="absolute inset-0 m-auto w-8 h-8 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Processing Swap</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Please sign the transaction in your wallet...
                                    </p>
                                </motion.div>
                            )}

                            {step === "success" && (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="py-8 text-center"
                                >
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", damping: 15, delay: 0.1 }}
                                        className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30"
                                    >
                                        <Check className="w-10 h-10 text-white stroke-[3]" />
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <h3 className="text-2xl font-bold mb-2">Swap Complete!</h3>
                                        <p className="text-muted-foreground mb-6">
                                            You received <span className="font-bold text-foreground">{amountNum.toFixed(4)} {order.token}</span>
                                        </p>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="space-y-3"
                                    >
                                        {txSignature && (
                                            txSignature.startsWith("DEMO") ? (
                                                <div className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-background/30 border border-border/30 text-sm font-medium text-muted-foreground">
                                                    <ExternalLink className="w-4 h-4 opacity-50" />
                                                    Demo Mode - No on-chain tx
                                                </div>
                                            ) : (
                                                <a
                                                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-background/50 border border-border/50 hover:bg-background/80 transition-all text-sm font-medium"
                                                >
                                                    <ExternalLink className="w-4 h-4 opacity-50" />
                                                    View on Solana Explorer
                                                </a>
                                            )
                                        )}
                                        <Button
                                            onClick={handleClose}
                                            className="w-full h-11 font-bold rounded-xl bg-primary hover:bg-primary/90"
                                        >
                                            Done
                                        </Button>
                                    </motion.div>
                                </motion.div>
                            )}

                            {step === "error" && (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="py-8 text-center"
                                >
                                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 border-2 border-red-500/30 flex items-center justify-center">
                                        <AlertCircle className="w-8 h-8 text-red-500" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 text-red-500">Swap Failed</h3>
                                    <p className="text-muted-foreground text-sm mb-6 max-w-[280px] mx-auto">
                                        {errorMessage}
                                    </p>
                                    <div className="space-y-3">
                                        <Button
                                            onClick={() => { setStep("confirm"); setErrorMessage(null); }}
                                            className="w-full h-11 font-bold rounded-xl bg-foreground text-background hover:bg-foreground/90"
                                        >
                                            Try Again
                                        </Button>
                                        <button
                                            onClick={handleClose}
                                            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
