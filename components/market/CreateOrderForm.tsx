"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { ArrowLeft, ArrowRight, Wallet, Info, Clock, ShieldCheck, Check, X, ExternalLink, Sliders, ChevronRight } from "lucide-react"
import { TokenSelector } from "@/components/ui/token-selector"
import { PaymentMethodSelector } from "@/components/market/PaymentMethodSelector"
import { Token } from "@/types/token"
import { SELECTABLE_TOKENS } from "@/lib/constants/tokens"
import { cn } from "@/lib/utils"
import { useZerocliq } from "@/lib/zerocliq/client"
import { useUserStore } from "@/hooks/useUserStore"
import { toast } from "@/components/ui/toast"
import { useNotificationStore } from "@/hooks/useNotificationStore"

interface CreateOrderFormProps {
    onBack: () => void
}

type WizardStep = "sell" | "receive" | "terms" | "preview" | "success"

export function CreateOrderForm({ onBack }: CreateOrderFormProps) {
    const { user } = useUserStore()
    const zerocliq = useZerocliq()
    const { fetchNotifications } = useNotificationStore()
    const [isLoading, setIsLoading] = useState(false)

    // Wizard State
    const [step, setStep] = useState<WizardStep>("sell")
    const [direction, setDirection] = useState(1) // 1 for forward, -1 for back

    // Form Data
    const [asset, setAsset] = useState<Token>(SELECTABLE_TOKENS[0])
    const [currency, setCurrency] = useState("USDC")
    const [amount, setAmount] = useState("")
    const [expiration, setExpiration] = useState("24h")
    const [margin, setMargin] = useState("100")

    // Advanced Terms
    const [customDurationValue, setCustomDurationValue] = useState("3")
    const [customDurationUnit, setCustomDurationUnit] = useState<"hours" | "days">("days")
    const [notes, setNotes] = useState("")
    const [limitMin, setLimitMin] = useState("1")
    const [limitMax, setLimitMax] = useState("")
    const [limitMode, setLimitMode] = useState<"full" | "custom">("full")

    // Submission State
    const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle")
    const [txSignature, setTxSignature] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const balance = 145.50
    const MARKET_PRICE = 145.23

    // Computed Values
    const effectivePrice = MARKET_PRICE * (parseFloat(margin || "100") / 100)
    const receiveAmount = amount && effectivePrice ? (parseFloat(amount) * effectivePrice).toFixed(2) : "0.00"

    // Auto-update max limit
    useEffect(() => {
        if (limitMode === "full" && amount) {
            setLimitMax(amount)
        }
    }, [amount, limitMode])

    // Navigation Helpers
    const nextStep = (target: WizardStep) => {
        setDirection(1)
        setStep(target)
    }

    const prevStep = (target: WizardStep) => {
        setDirection(-1)
        setStep(target)
    }

    const handleMax = () => {
        setAmount(balance.toString())
    }

    const getExpirationDate = () => {
        if (expiration !== "Custom") return expiration

        const now = new Date()
        const value = parseInt(customDurationValue) || 0

        if (customDurationUnit === "hours") {
            now.setHours(now.getHours() + value)
        } else {
            now.setDate(now.getDate() + value)
        }

        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        }).format(now)
    }

    const handleCreateOrder = async () => {
        if (!zerocliq.connected || !user) {
            setSubmissionStatus("error")
            setErrorMessage("Please connect your wallet first.")
            return
        }

        if (!amount) return

        setIsLoading(true)
        setSubmissionStatus("idle")
        setErrorMessage(null)

        try {
            const assetSymbol = asset.symbol
            const currencySymbol = currency
            const amountVal = parseFloat(amount)
            const marginVal = parseFloat(margin)

            const tokenA = assetSymbol
            const tokenB = currencySymbol
            const inputAmount = amountVal

            // Always use floating pricing
            const spreadBps = (marginVal - 100) * 100

            let expirySeconds = 86400
            if (expiration === "1h") expirySeconds = 3600
            if (expiration === "24h") expirySeconds = 86400
            if (expiration === "7d") expirySeconds = 604800
            if (expiration === "Custom") {
                const val = parseInt(customDurationValue) || 0
                expirySeconds = val * (customDurationUnit === "hours" ? 3600 : 86400)
            }

            console.log("Creating Order via SDK:", { tokenA, tokenB, inputAmount, spreadBps })

            const oracleFeed = `${assetSymbol}/USD`
            const result = await zerocliq.createFloatingOrder(
                tokenA,
                tokenB,
                inputAmount,
                spreadBps,
                oracleFeed,
                expirySeconds
            )

            console.log("Order Created On-Chain:", result.signature)

            // Parse limits
            const limitMinVal = parseFloat(limitMin) || 1
            const limitMaxVal = limitMode === "full"
                ? inputAmount
                : (parseFloat(limitMax) || inputAmount)

            // DEMO MODE: No API Indexing needed
            // const apiRes = await fetch("/api/orders/create", ...)
            console.log("Demo Mode: Order would be indexed here.");

            toast.order(
                "Order Created! 🎉",
                `Your order to trade ${inputAmount} ${tokenA} for ${tokenB} is now live.`
            )

            if (user.walletAddress) {
                fetchNotifications(user.walletAddress)
            }

            setTxSignature(result.signature)
            setSubmissionStatus("success")
            setStep("success")

        } catch (error: any) {
            console.error("Order Creation Error:", error)
            setErrorMessage(error.message || "Failed to create order")
            setSubmissionStatus("error")
            toast.warning(
                "Order Failed",
                error.message || "Failed to create order. Please try again."
            )
        } finally {
            setIsLoading(false)
        }
    }

    // --- ANIMATION VARIANTS ---
    const variants: Variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0,
            scale: 0.98
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1,
            transition: {
                type: "spring",
                bounce: 0,
                duration: 0.4
            }
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0,
            scale: 0.98,
            transition: {
                type: "spring",
                bounce: 0,
                duration: 0.4
            }
        })
    }

    // --- SUB-COMPONENTS ---

    const LiveTicket = () => (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-4 bg-muted/30 border-2 border-dashed border-border/50 rounded-lg p-3"
        >
            <div className="flex items-center gap-1.5 mb-2 text-[9px] uppercase font-bold text-muted-foreground tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live Order Ticket
            </div>

            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground">Selling</span>
                <span className="font-bold text-xs">{amount || "0"} <span className="text-muted-foreground">{asset.symbol}</span></span>
            </div>

            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground">Receiving</span>
                <span className="font-bold text-xs text-primary">{receiveAmount} <span className="text-muted-foreground">{currency}</span></span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/20 mt-1">
                <div className="flex items-center gap-1 text-[9px] text-blue-500">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>Smart Contract</span>
                </div>
                {step === "terms" && (
                    <span className="text-[9px] text-muted-foreground">Exp: {getExpirationDate()}</span>
                )}
            </div>
        </motion.div>
    )

    // STEP 1: SELL
    const StepSell = () => (
        <div className="space-y-4">
            <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight">What are you selling?</h2>
                <p className="text-muted-foreground text-xs">Choose the asset you want to swap.</p>
            </div>

            <div className="p-0.5">
                <Label className="text-[10px] mb-1.5 block font-bold uppercase text-muted-foreground">Select Token</Label>
                <TokenSelector
                    selectedToken={asset}
                    onSelect={setAsset}
                    tokens={SELECTABLE_TOKENS}
                />
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Amount</Label>
                    <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                        <Wallet className="w-2.5 h-2.5" /> Bal: {balance.toFixed(2)}
                    </span>
                </div>

                <div className="relative group">
                    <Input
                        type="number"
                        autoFocus
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-16 pl-4 pr-16 text-3xl font-bold bg-transparent border-2 border-border rounded-xl focus:border-primary focus:ring-0 transition-all font-mono tracking-tight"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end gap-0.5">
                        <span className="text-sm font-bold text-muted-foreground">{asset.symbol}</span>
                        <button
                            onClick={handleMax}
                            className="text-[9px] font-bold bg-muted hover:bg-primary hover:text-primary-foreground px-1.5 py-0.5 rounded transition-colors uppercase tracking-wide"
                        >
                            Max
                        </button>
                    </div>
                </div>

                <Button
                    size="lg"
                    disabled={!amount || parseFloat(amount) <= 0}
                    onClick={() => nextStep("receive")}
                    className="w-full h-12 rounded-xl text-base font-bold bg-foreground text-background hover:bg-foreground/90 mt-2 active:scale-[0.98] transition-all shadow-lg"
                >
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
    )

    // STEP 2: RECEIVE
    const StepReceive = () => (
        <div className="space-y-4">
            <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight">What do you want?</h2>
                <p className="text-muted-foreground text-xs">Select currency to receive.</p>
            </div>

            <div className="p-4 border-2 border-border/60 rounded-xl bg-muted/10">
                <Label className="text-[10px] mb-3 block font-bold uppercase text-muted-foreground text-center">I want to receive</Label>
                <PaymentMethodSelector
                    value={currency}
                    onSelect={setCurrency}
                />
            </div>

            <div className="text-center py-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-bold">Estimated Return</p>
                <div className="text-2xl font-mono font-bold text-primary tracking-tighter">
                    {receiveAmount} <span className="text-sm text-muted-foreground">{currency}</span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">
                    1 {asset.symbol} ≈ {MARKET_PRICE} {currency}
                </p>
            </div>

            <div className="flex gap-2">
                <Button
                    variant="outline"
                    onClick={() => prevStep("sell")}
                    className="h-12 w-12 rounded-xl border-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                    size="lg"
                    onClick={() => nextStep("terms")}
                    className="flex-1 h-12 rounded-xl text-base font-bold bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] transition-all shadow-lg"
                >
                    Review Terms <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
    )

    // STEP 3: TERMS
    const StepTerms = () => (
        <div className="space-y-4">
            <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight">Set your terms</h2>
                <p className="text-muted-foreground text-xs">Fine tune limits & expiry.</p>
            </div>

            <div className="space-y-4">
                {/* Margin Control */}
                <div className="space-y-1.5">
                    <div className="flex justify-between">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Price (%)</Label>
                        <span className="text-[10px] font-bold">{margin}% of Market</span>
                    </div>
                    <div className="relative">
                        <Input
                            type="number"
                            value={margin}
                            onChange={(e) => setMargin(e.target.value)}
                            className="h-10 pl-3 pr-10 font-mono font-bold text-base border-2 border-border rounded-lg focus:ring-0 focus:border-primary"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-muted-foreground">%</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                        Sell at <span className="font-bold text-foreground">{effectivePrice.toFixed(2)} {currency}</span>
                    </p>
                </div>

                {/* Expiration */}
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Expires In</Label>
                    <div className="grid grid-cols-4 gap-2">
                        {['1h', '24h', '7d', 'Custom'].map((exp) => (
                            <button
                                key={exp}
                                onClick={() => setExpiration(exp)}
                                className={cn(
                                    "h-8 rounded-md text-[10px] font-bold border-2 transition-all",
                                    expiration === exp
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border bg-transparent hover:border-primary/50"
                                )}
                            >
                                {exp}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Limits */}
                <div className="space-y-2 pt-2 border-t border-dashed border-border">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Partial Fills?</Label>
                        <div className="flex bg-muted rounded-md p-0.5">
                            <button
                                onClick={() => setLimitMode("full")}
                                className={cn(
                                    "px-2 py-1 rounded-sm text-[9px] font-bold transition-all",
                                    limitMode === "full" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                                )}
                            >
                                No
                            </button>
                            <button
                                onClick={() => setLimitMode("custom")}
                                className={cn(
                                    "px-2 py-1 rounded-sm text-[9px] font-bold transition-all",
                                    limitMode === "custom" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                                )}
                            >
                                Yes
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {limitMode === "custom" && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                className="grid grid-cols-2 gap-2 pt-1 overflow-hidden"
                            >
                                <div>
                                    <Label className="text-[9px] text-muted-foreground mb-0.5 block">Min</Label>
                                    <Input
                                        value={limitMin}
                                        onChange={(e) => setLimitMin(e.target.value)}
                                        className="h-8 text-xs font-bold border-2 border-border"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-muted-foreground mb-0.5 block">Max</Label>
                                    <Input
                                        value={limitMax}
                                        onChange={(e) => setLimitMax(e.target.value)}
                                        className="h-8 text-xs font-bold border-2 border-border"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex gap-2 pt-2">
                    <Button
                        variant="outline"
                        onClick={() => prevStep("receive")}
                        className="h-12 w-12 rounded-xl border-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        size="lg"
                        onClick={() => nextStep("preview")}
                        className="flex-1 h-12 rounded-xl text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg"
                    >
                        Preview Order
                    </Button>
                </div>
            </div>
        </div>
    )

    const SuccessView = () => {
        const [isCopied, setIsCopied] = useState(false)

        const handleShare = async () => {
            const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://zero-slip-psi.vercel.app").replace(/\/$/, "")
            const linkUrl = `${baseUrl}/market/order/${txSignature}`
            const xUrl = `https://twitter.com/intent/tweet?text=I%20just%20created%20a%20Zerocliq%20swap%20order!%20%F0%9F%9A%80%0A%0ATake%20it%20instantly%20here%3A&url=${encodeURIComponent(linkUrl)}`

            await navigator.clipboard.writeText(linkUrl)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
            window.open(xUrl, '_blank')
        }

        return (
            <div className="text-center py-4">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-500/20"
                >
                    <Check className="w-8 h-8 text-white stroke-[3]" />
                </motion.div>

                <h2 className="text-2xl font-bold mb-1">Order Live!</h2>
                <p className="text-muted-foreground text-sm mb-6">Your swap is securely listed.</p>

                <div className="space-y-3 max-w-xs mx-auto">
                    <button
                        onClick={handleShare}
                        className="w-full h-12 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg overflow-hidden relative group"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                        {isCopied ? <Check className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                        {isCopied ? "Copied Link!" : "Share Blink on X"}
                    </button>

                    <a
                        href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground border-2 border-dashed border-border rounded-xl hover:border-solid hover:border-foreground transition-all"
                    >
                        View on Explorer
                    </a>

                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="text-xs text-muted-foreground h-8"
                    >
                        Back to Market
                    </Button>
                </div>
            </div>
        )
    }

    // --- MAIN RENDER ---
    return (
        <div className="max-w-4xl mx-auto flex flex-col justify-center px-4 py-8">
            {step !== "success" && (
                <div className="mb-8 flex justify-center gap-1.5 md:justify-start md:ml-8">
                    {["sell", "receive", "terms", "preview"].map((s, i) => {
                        const stepIndex = ["sell", "receive", "terms", "preview"].indexOf(step)
                        const thisIndex = i

                        return (
                            <div
                                key={s}
                                className={cn(
                                    "h-1 rounded-full transition-all duration-500",
                                    thisIndex <= stepIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                                )}
                            />
                        )
                    })}
                </div>
            )}

            <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Main Wizard Area */}
                    <div className="flex-1">
                        <AnimatePresence initial={false} custom={direction} mode="wait">
                            {step === "sell" ? (
                                <motion.div key="sell" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="w-full">
                                    <StepSell />
                                </motion.div>
                            ) : step === "receive" ? (
                                <motion.div key="receive" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="w-full">
                                    <StepReceive />
                                </motion.div>
                            ) : step === "terms" ? (
                                <motion.div key="terms" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="w-full">
                                    <StepTerms />
                                </motion.div>
                            ) : step === "preview" ? (
                                <motion.div key="preview" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="w-full">
                                    <div className="text-center md:text-left space-y-1 mb-4">
                                        <h2 className="text-xl font-bold tracking-tight">Review Order</h2>
                                        <p className="text-muted-foreground text-xs">One last check.</p>
                                    </div>

                                    {/* Mobile-only summary for preview (desktop has the ticket) */}
                                    <div className="md:hidden bg-muted/30 border-2 border-border/50 rounded-xl p-4 space-y-3 text-xs mb-4">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Selling</span>
                                            <span className="font-bold">{amount} {asset.symbol}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Receiving</span>
                                            <span className="font-bold text-primary">{receiveAmount} {currency}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-border/20">
                                            <span className="text-muted-foreground">Network Fee</span>
                                            <span className="font-bold text-[10px]">~0.00005 SOL</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-8 md:mt-0">
                                        <Button
                                            variant="outline"
                                            onClick={() => prevStep("terms")}
                                            className="h-12 w-12 rounded-xl border-2"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="lg"
                                            onClick={handleCreateOrder}
                                            disabled={isLoading}
                                            className="flex-1 h-12 rounded-xl text-base font-bold bg-green-500 text-white hover:bg-green-600 active:scale-[0.98] transition-all shadow-lg shadow-green-500/20"
                                        >
                                            {isLoading ? "Signing..." : "Confirm & Sign"} <ShieldCheck className="ml-2 w-4 h-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex items-center justify-center">
                                    <SuccessView />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Side Ticket (Desktop) or Bottom Ticket (Mobile) */}
                    {step !== "success" && (
                        <div className="md:w-[280px] shrink-0 md:border-l md:border-dashed md:border-border/50 md:pl-8 flex flex-col justify-center">
                            {/* Creative Desktop visual: 'Ticket' punch-out look */}
                            <div className="hidden md:block absolute top-0 bottom-0 left-[66%] w-[2px] border-l-2 border-dashed border-border/30 h-full pointer-events-none" />

                            <div className="relative">
                                <Label className="hidden md:block text-[10px] font-bold uppercase text-muted-foreground mb-4 tracking-widest text-center md:text-left">
                                    Live Summary
                                </Label>
                                <LiveTicket />

                                <div className="hidden md:block mt-6 text-[10px] text-muted-foreground/60 leading-relaxed text-center md:text-left">
                                    <p>Your order will be instantly discoverable on-chain via Solana Actions.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {step !== "success" && (
                    <button onClick={onBack} className="absolute top-4 right-4 text-muted-foreground/50 hover:text-foreground transition-colors z-10">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    )
}
