"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence, PanInfo } from "framer-motion"
import { ArrowRightLeft, ChevronRight, X, ShieldCheck, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { POPULAR_TOKENS } from "@/lib/constants/tokens"
import { useMediaQuery } from "@/hooks/use-media-query"

interface PremiumSwapModalProps {
    isOpen: boolean
    onClose: () => void
    order: any
}

export function PremiumSwapModal({ isOpen, onClose, order }: PremiumSwapModalProps) {
    const [amount, setAmount] = useState("")
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSwap = async () => {
        setIsSubmitting(true)
        // Simulate wallet interaction
        await new Promise(resolve => setTimeout(resolve, 2000))
        setIsSubmitting(false)
        onClose()
    }

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setAmount("")
        }
    }, [isOpen])

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 100) {
            onClose()
        }
    }

    if (!order) return null

    // Find token logos
    const tokenLogo = POPULAR_TOKENS.find(t => t.symbol === order.token)?.logoURI
    const currencyLogo = POPULAR_TOKENS.find(t => t.symbol === order.currency)?.logoURI

    const SwapContent = ({ className }: { className?: string }) => (
        <div className={cn("flex flex-col bg-background w-full overflow-hidden", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {order.advertiser[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="font-bold text-sm flex items-center gap-2">
                            {order.advertiser}
                            {order.verified && <ShieldCheck className="w-3 h-3 text-green-500" />}
                        </h2>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <span>Online</span>
                        </div>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto min-h-0">
                <div className="max-w-sm mx-auto space-y-5">

                    {/* Rate Display */}
                    <div className="text-center space-y-0.5">
                        <h3 className="text-lg font-bold tracking-tight">
                            {order.type === 'buy' ? 'Sell' : 'Buy'} {order.token}
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium">
                            1 {order.token} ≈ {order.price} {order.currency}
                        </p>
                    </div>

                    {/* Input Group */}
                    <div className="space-y-4">
                        {/* You Pay */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                <span>You Pay</span>
                                <span>Balance: 0.00</span>
                            </div>
                            <div className="relative group">
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="h-14 pl-4 pr-20 text-xl font-bold bg-muted/30 border-border focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                    <div className="w-6 h-6 rounded-full bg-white border border-border flex items-center justify-center overflow-hidden">
                                        {currencyLogo ? (
                                            <img src={currencyLogo} alt={order.currency} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[10px] font-bold">{order.currency[0]}</span>
                                        )}
                                    </div>
                                    <span className="font-bold text-sm">{order.currency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="relative flex justify-center py-1">
                            <div className="absolute inset-0 flex items-center">
                                <Separator className="w-full" />
                            </div>
                            <div className="relative bg-background px-2">
                                <div className="bg-muted border border-border rounded-full p-1.5 text-muted-foreground">
                                    <ArrowRightLeft className="w-3 h-3 rotate-90" />
                                </div>
                            </div>
                        </div>

                        {/* You Receive */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                <span>You Receive</span>
                            </div>
                            <div className="relative">
                                <Input
                                    readOnly
                                    value={amount ? (parseFloat(amount) / parseFloat(order.price)).toFixed(4) : "0.00"}
                                    className="h-14 pl-4 pr-20 text-xl font-bold bg-muted/10 border-border text-muted-foreground rounded-xl"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                    <div className="w-6 h-6 rounded-full bg-white border border-border flex items-center justify-center overflow-hidden">
                                        {tokenLogo ? (
                                            <img src={tokenLogo} alt={order.token} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[10px] font-bold">{order.token[0]}</span>
                                        )}
                                    </div>
                                    <span className="font-bold text-sm">{order.token}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary Details */}
                    <div className="bg-muted/20 rounded-lg p-3 space-y-2 text-xs border border-border/50">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Payment Method</span>
                            <span className="font-medium flex items-center gap-1.5">
                                <Wallet className="w-3 h-3" />
                                Crypto Transfer
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Network Fee</span>
                            <span className="font-medium text-green-500">~0.00005 SOL</span>
                        </div>
                        <Separator className="bg-border/50" />
                        <div className="flex justify-between font-bold text-sm">
                            <span>Total</span>
                            <span>{amount || "0.00"} {order.currency}</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 border-t border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
                <Button
                    onClick={handleSwap}
                    disabled={isSubmitting}
                    className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all rounded-xl group relative overflow-hidden"
                >
                    {isSubmitting ? (
                        <div className="flex items-center gap-2 justify-center">
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Waiting for Wallet...</span>
                        </div>
                    ) : (
                        <>
                            Confirm Swap
                            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    )

    if (isDesktop) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-background border border-border shadow-2xl rounded-2xl overflow-hidden block">
                    <SwapContent className="max-h-[85vh]" />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.2}
                        onDragEnd={handleDragEnd}
                        className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-background rounded-t-[2rem] z-50 flex flex-col shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] overflow-hidden"
                    >
                        {/* Drag Handle */}
                        <div className="h-1.5 w-10 bg-muted-foreground/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />

                        <div className="flex-1 overflow-hidden flex flex-col">
                            <SwapContent className="h-full" />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
