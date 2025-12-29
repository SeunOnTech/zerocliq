"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Settings, History, ArrowDown, ArrowRightLeft, ChevronDown, ChevronUp, ChevronRight, Fuel, Clock, Layers, DollarSign, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TokenSelectorModal, type TokenInfo } from "./TokenSelectorModal"
import { SwapSuccess, SwapError } from "./SwapResult"
import { useCurrentChainTokens } from "@/hooks/useCurrentChainTokens"
import { useBalanceBySymbol } from "@/hooks/useTokenBalance"
import { useTokenPrice, formatUsdValue } from "@/hooks/useTokenPrice"
import { useSwapQuote, formatQuoteAmount, formatPriceImpact, type SwapQuote } from "@/hooks/useSwapQuote"
import { useAppStore } from "@/store/useAppStore"
import { useAccount } from "wagmi"
import { toast } from "@/components/ui/toast"
import { TradeCardPrompt } from "@/components/features/smart-account"
import { FundingModal } from "@/components/features/smart-account/FundingModal"
import { createNotification } from "@/hooks/useNotificationStore"
import { logActivity } from "@/hooks/useActivityStore"

// Helper component to render token logo from URL
function TokenLogo({ logoURI, symbol, className = "w-full h-full" }: { logoURI?: string; symbol: string; className?: string }) {
    if (logoURI) {
        return <img src={logoURI} alt={symbol} className={`${className} object-cover rounded-full`} />
    }
    return (
        <div className={`${className} bg-primary rounded-full flex items-center justify-center`}>
            <span className="text-white font-bold text-xs">{symbol[0]}</span>
        </div>
    )
}

// Reusable Token Input Component
interface TokenInputProps {
    value: string
    onChange: (value: string) => void
    tokenSymbol?: string
    tokenLogoURI?: string
    dollarValue?: string
    balance?: string
    placeholder?: boolean
    autoFocus?: boolean
    onTokenClick?: () => void
}

function TokenInput({ value, onChange, tokenSymbol, tokenLogoURI, dollarValue = "≈ $0.00", balance = "0", placeholder = false, autoFocus = false, onTokenClick }: TokenInputProps) {
    // Only allow numbers and one decimal point
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value
        // Allow empty string, numbers, and one decimal point
        if (inputValue === '' || /^[0-9]*\.?[0-9]*$/.test(inputValue)) {
            onChange(inputValue)
        }
    }

    return (
        <div className="relative rounded-[16px] p-4 bg-muted border border-gray-200 dark:border-transparent">
            <div className="flex items-center justify-between">
                {/* Show value if present, otherwise show placeholder or input */}
                {placeholder && !value ? (
                    <span
                        className="leading-none h-[40px] flex items-center w-[50%] text-muted-foreground/60"
                        style={{
                            fontSize: '32px',
                            fontWeight: 500
                        }}
                    >
                        0
                    </span>
                ) : placeholder && value ? (
                    <span
                        className="leading-none h-[40px] flex items-center w-[50%] text-foreground"
                        style={{
                            fontSize: '32px',
                            fontWeight: 500
                        }}
                    >
                        {value}
                    </span>
                ) : (
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={value}
                        onChange={handleInputChange}
                        autoFocus={autoFocus}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            boxShadow: 'none',
                            fontSize: '32px',
                            fontWeight: 500,
                            lineHeight: 1,
                            height: '40px',
                            width: '50%',
                            padding: 0
                        }}
                        className="text-foreground placeholder:text-muted-foreground/50"
                    />
                )}
                <div
                    onClick={onTokenClick}
                    className="flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 cursor-pointer transition-all duration-200 bg-background"
                    style={{
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e3a8a'
                        const span = e.currentTarget.querySelector('span') as HTMLElement | null
                        const chevron = e.currentTarget.querySelector('svg:last-child') as HTMLElement | null
                        if (span) span.style.color = 'white'
                        if (chevron) chevron.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = ''
                        const span = e.currentTarget.querySelector('span') as HTMLElement | null
                        const chevron = e.currentTarget.querySelector('svg:last-child') as HTMLElement | null
                        if (span) span.style.color = ''
                        if (chevron) chevron.style.color = ''
                    }}
                >
                    {tokenSymbol ? (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden">
                            <TokenLogo logoURI={tokenLogoURI} symbol={tokenSymbol} />
                        </div>
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-gray-600" />
                    )}
                    <span className="font-semibold text-sm transition-colors duration-200 text-foreground">
                        {tokenSymbol || 'Select'}
                    </span>
                    <ChevronDown className="w-4 h-4 transition-colors duration-200 text-muted-foreground" />
                </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground font-medium">
                <span>{dollarValue}</span>
                <span>{tokenSymbol ? `${balance} ${tokenSymbol}` : '—'}</span>
            </div>
        </div>
    )
}

// ETH Logo SVG
const EthLogo = () => (
    <svg viewBox="0 0 256 417" className="w-full h-full">
        <path fill="#343434" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" />
        <path fill="#8C8C8C" d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
        <path fill="#3C3C3B" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" />
        <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z" />
    </svg>
)

// USDC Logo SVG
const UsdcLogo = () => (
    <svg viewBox="0 0 32 32" className="w-full h-full">
        <circle cx="16" cy="16" r="16" fill="#2775CA" />
        <path fill="#FFFFFF" d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.24-2.18-.732-2.18-1.584 0-.852.632-1.396 1.872-1.396 1.124 0 1.752.376 2.04 1.312a.42.42 0 0 0 .404.3h.92a.384.384 0 0 0 .38-.428c-.24-1.304-1.12-2.252-2.5-2.504v-1.44a.384.384 0 0 0-.384-.384h-.868a.384.384 0 0 0-.384.384v1.396c-1.64.304-2.696 1.4-2.696 2.864 0 1.988 1.24 2.752 3.8 3.056 1.72.264 2.22.68 2.22 1.648 0 .968-.876 1.632-2.052 1.632-1.6 0-2.12-.676-2.3-1.58a.404.404 0 0 0-.396-.32h-.988a.384.384 0 0 0-.38.44c.248 1.456 1.216 2.456 2.792 2.776v1.448c0 .212.172.384.384.384h.868a.384.384 0 0 0 .384-.384v-1.42c1.68-.328 2.804-1.456 2.804-3.044z" />
        <path fill="#FFFFFF" d="M12.596 24.396c-4.168-1.488-6.332-6.104-4.808-10.236 1.488-4.132 6.104-6.332 10.236-4.808.696.252 1.34.588 1.916 1.004l.028.02 1.476-1.476-.024-.02a10.328 10.328 0 0 0-2.496-1.356C13.392 5.472 7.684 8.012 5.648 13.544 3.612 19.076 6.152 24.784 11.684 26.82c.868.32 1.768.536 2.68.652v-2.128a8.212 8.212 0 0 1-1.768-.948z" />
        <path fill="#FFFFFF" d="M20.252 7.608v2.128c2.86 1.636 4.232 5.012 3.22 8.212-1.012 3.2-4.016 5.248-7.344 5.248-.22 0-.44-.008-.656-.028v2.124c.22.02.44.028.656.028 4.6 0 8.52-3.14 9.604-7.568.828-3.388-.264-6.9-2.8-9.276a8.512 8.512 0 0 0-2.68-.868z" />
    </svg>
)

// Token type for UI display (extends TokenInfo with balance)
interface Token extends Partial<TokenInfo> {
    symbol: string
    logoURI?: string
    balance: string
}

// Route Info Component - displays swap route details
interface RouteInfoProps {
    sellAmount: string
    sellToken: Token
    buyToken: Token
    chainId?: number
    quote?: SwapQuote | null
    isQuoteLoading?: boolean
    onRefresh?: () => void
    onStatusAction?: (status: SmartCardStatus) => void
}

// Circular Progress Ring Component
function CircularProgress({ progress, size = 20 }: { progress: number; size?: number }) {
    const strokeWidth = 2
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="none"
                className="text-primary/20"
            />
            {/* Progress circle */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                className="text-primary transition-[stroke-dashoffset] duration-300 ease-out"
                style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: strokeDashoffset,
                }}
            />
        </svg>
    )
}

// Loading Skeleton for Route Info
function RouteInfoSkeleton() {
    return (
        <div className="mt-2 rounded-[16px] overflow-hidden border border-gray-200 dark:border-transparent bg-muted animate-pulse">
            <div className="px-4 pt-3 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 w-16 bg-gray-300 dark:bg-gray-700 rounded" />
                    <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-700" />
                </div>
                <div className="h-5 w-24 bg-gray-300 dark:bg-gray-700 rounded mb-3" />
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700" />
                    <div className="flex-1">
                        <div className="h-6 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-1" />
                        <div className="h-4 w-48 bg-gray-300 dark:bg-gray-700 rounded" />
                    </div>
                </div>
                <div className="h-4 w-40 bg-gray-300 dark:bg-gray-700 rounded mt-3" />
            </div>
        </div>
    )
}

// Swapping State Component - Animated swap progress visualization
interface SwappingStateProps {
    sellToken: Token
    buyToken: Token
    sellAmount: string
    buyAmount: string
    dexName?: string
}

function SwappingState({ sellToken, buyToken, sellAmount, buyAmount, dexName }: SwappingStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="mt-2 rounded-[16px] overflow-hidden border border-gray-200 dark:border-transparent bg-muted"
        >
            <div className="px-4 py-6">
                {/* Header */}
                <div className="text-center mb-4">
                    <motion.span
                        className="text-sm font-semibold text-foreground"
                        animate={{ opacity: [1, 0.6, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        Swapping...
                    </motion.span>
                </div>

                {/* Animated Token Swap Visualization */}
                <div className="flex items-center justify-center gap-4">
                    {/* Sell Token */}
                    <motion.div
                        className="flex flex-col items-center gap-2"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.3 }}
                    >
                        <motion.div
                            className="w-14 h-14 rounded-full bg-card border-2 border-primary/30 flex items-center justify-center shadow-lg"
                            animate={{
                                scale: [1, 1.05, 1],
                                borderColor: ['rgba(var(--primary), 0.3)', 'rgba(var(--primary), 0.6)', 'rgba(var(--primary), 0.3)']
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <div className="w-8 h-8 flex items-center justify-center">
                                <TokenLogo logoURI={sellToken.logoURI} symbol={sellToken.symbol} />
                            </div>
                        </motion.div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-foreground">{sellAmount}</div>
                            <div className="text-xs text-muted-foreground">{sellToken.symbol}</div>
                        </div>
                    </motion.div>

                    {/* Animated Arrows */}
                    <div className="flex items-center gap-1 px-2">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0.3, x: -2 }}
                                animate={{
                                    opacity: [0.3, 1, 0.3],
                                    x: [-2, 2, -2]
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.2
                                }}
                            >
                                <ChevronRight className="w-5 h-5 text-primary" />
                            </motion.div>
                        ))}
                    </div>

                    {/* Buy Token */}
                    <motion.div
                        className="flex flex-col items-center gap-2"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                    >
                        <motion.div
                            className="w-14 h-14 rounded-full bg-card border-2 border-emerald-500/30 flex items-center justify-center shadow-lg"
                            animate={{
                                scale: [1, 1.05, 1],
                                boxShadow: [
                                    '0 0 0 0 rgba(16, 185, 129, 0)',
                                    '0 0 20px 4px rgba(16, 185, 129, 0.3)',
                                    '0 0 0 0 rgba(16, 185, 129, 0)'
                                ]
                            }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        >
                            <div className="w-8 h-8 flex items-center justify-center">
                                <TokenLogo logoURI={buyToken.logoURI} symbol={buyToken.symbol} />
                            </div>
                        </motion.div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-foreground">{buyAmount}</div>
                            <div className="text-xs text-muted-foreground">{buyToken.symbol}</div>
                        </div>
                    </motion.div>
                </div>

                {/* Progress Dots */}
                <div className="flex justify-center gap-2 mt-6">
                    {[0, 1, 2, 3].map((i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full bg-primary"
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.4, 1, 0.4]
                            }}
                            transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                delay: i * 0.15
                            }}
                        />
                    ))}
                </div>

                {/* Status Text */}
                <motion.div
                    className="text-center mt-4"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <span className="text-xs text-muted-foreground">
                        Executing via {dexName || 'DEX'}
                    </span>
                </motion.div>
            </div>
        </motion.div>
    )
}


// Smart Card Status Types
type SmartCardStatus =
    | 'no-smart-account'
    | 'not-deployed'
    | 'no-trade-card'
    | 'insufficient-funds'
    | 'ready'

function RouteInfo({ sellAmount, sellToken, buyToken, chainId, quote, isQuoteLoading, onRefresh, onStatusAction }: RouteInfoProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [progress, setProgress] = useState(0)

    // Get smart account status from store - subscribe to userProfile for reactive updates
    const userProfile = useAppStore((s) => s.userProfile)
    const hasTradeCard = useAppStore((s) => s.hasTradeCard)

    // Get Smart Account balance for the sell token (for insufficient-funds check)
    // This is separate from the main swap UI which shows EOA balance
    const smartAccountSellBalance = useBalanceBySymbol(sellToken.symbol, 'smartAccount')
    const smartAccountBalanceNum = smartAccountSellBalance?.balance ?? 0

    // Compute smart card status from userProfile directly (reactive)
    const smartCardStatus = useMemo<SmartCardStatus>(() => {
        const status = userProfile?.smartAccountStatus
        if (!status || status === 'NONE') return 'no-smart-account'
        if (status === 'COUNTERFACTUAL') return 'not-deployed'
        if (!hasTradeCard) return 'no-trade-card'
        // Check insufficient funds - compare sell amount to Smart Account balance
        const sellAmountNum = parseFloat(sellAmount) || 0
        if (sellAmountNum > 0 && sellAmountNum > smartAccountBalanceNum) return 'insufficient-funds'
        return 'ready'
    }, [userProfile?.smartAccountStatus, hasTradeCard, sellAmount, smartAccountBalanceNum])

    const REFRESH_INTERVAL = 30 // 30 seconds

    // Get price for USD calculation  
    const { price: buyPrice } = useTokenPrice(buyToken.address, chainId)

    // Progress timer - 30 seconds countdown with auto-refresh
    useEffect(() => {
        // Don't run timer while loading
        if (isQuoteLoading) {
            setProgress(0)
            return
        }

        const interval = setInterval(() => {
            setProgress((prev) => {
                const newProgress = prev + (100 / REFRESH_INTERVAL)
                if (newProgress >= 100) {
                    // Auto-refresh when timer completes
                    onRefresh?.()
                    return 0
                }
                return newProgress
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [isQuoteLoading, onRefresh])

    // Calculate values from quote or use estimates
    const tokenDecimals = buyToken.decimals ?? 18

    const receiveAmount = quote?.bestRoute?.amountOut
        ? formatQuoteAmount(quote.bestRoute.amountOut, tokenDecimals)
        : "..."
    const receiveAmountRaw = quote?.bestRoute?.amountOut
        ? parseFloat(quote.bestRoute.amountOut) / Math.pow(10, tokenDecimals)
        : 0

    const dollarValue = (receiveAmountRaw && buyPrice)
        ? (receiveAmountRaw * buyPrice).toFixed(2)
        : "0.00"

    // Price impact from bestRoute
    const { text: priceImpactText, severity: priceImpactSeverity } = formatPriceImpact(quote?.bestRoute?.priceImpactBps)

    // DEX name from quote
    const dexName = quote?.bestRoute?.dexName || "Finding best route..."

    // Hops from quote
    const hops = quote?.bestRoute?.hops || []

    // Calculate exchange rate from quote
    const sellDecimals = sellToken.decimals ?? 18
    const sellAmountNum = parseFloat(sellAmount) || 1
    const exchangeRate = receiveAmountRaw > 0 ? (receiveAmountRaw / sellAmountNum) : 0

    const hasInsufficientFunds = parseFloat(sellToken.balance) < parseFloat(sellAmount)

    // Show skeleton while loading
    if (isQuoteLoading && !quote) {
        return <RouteInfoSkeleton />
    }

    return (
        <>
            <div className="mt-2 rounded-[16px] overflow-hidden border border-gray-200 dark:border-transparent bg-muted">
                {/* Receive Header with Progress Ring on right */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-sm font-semibold text-foreground">Receive</span>
                    <CircularProgress progress={progress} size={20} />
                </div>

                {/* Main Content */}
                <div className="px-4 pb-4">
                    {/* Best Return Badge */}
                    <div className="mb-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-[11px] font-semibold bg-primary opacity-90 text-white">
                            Best Return
                        </span>
                    </div>

                    {/* Token Amount Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Token Logo with gradient ring */}
                            <div className="relative">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5">
                                    <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                                        <TokenLogo logoURI={buyToken.logoURI} symbol={buyToken.symbol} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                {/* Bold amount */}
                                <div className="text-xl font-bold">
                                    {receiveAmount}
                                </div>
                                {/* Subtitle with dollar, percentage, and DEX */}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                    <span>${parseFloat(dollarValue).toLocaleString()}</span>
                                    <span>•</span>
                                    <span className={priceImpactSeverity === 'high' ? 'text-red-500' : priceImpactSeverity === 'medium' ? 'text-yellow-500' : 'text-green-500'}>
                                        {priceImpactText}
                                    </span>
                                    <span>•</span>
                                    {/* DEX icon */}
                                    <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center">
                                        <span className="text-white text-[7px] font-bold">{dexName[0]}</span>
                                    </div>
                                    <span>{dexName}</span>
                                </div>
                            </div>
                        </div>
                        {/* Circular chevron button */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-7 h-7 rounded-full bg-gray-200 border border-border/50 flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                        >
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Expanded Details with Timeline - Animated */}
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="mt-4">
                                    {/* Route Provider Header */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center">
                                            <ArrowRightLeft className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <span className="text-sm font-medium">{dexName}</span>
                                    </div>

                                    {/* Timeline Container - Dynamic Hops */}
                                    <div className="relative ml-[14px] mt-2">
                                        {/* Vertical line connecting hops */}
                                        {hops.length > 1 && (
                                            <div className="absolute left-[9px] top-5 bottom-[42px] w-px bg-gray-300 dark:bg-gray-600" />
                                        )}

                                        {/* Render each hop */}
                                        {hops.map((hop, index) => (
                                            <div key={index}>
                                                <div className="relative flex items-start gap-2.5">
                                                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center z-10">
                                                        <span className="text-white text-[8px] font-bold">{index + 1}</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {hop.dexName} • {hop.detail}
                                                        </div>
                                                        <div className="text-xs">
                                                            {hop.path[0]?.slice(0, 6)}...{hop.path[0]?.slice(-4)} → {hop.path[1]?.slice(0, 6)}...{hop.path[1]?.slice(-4)}
                                                        </div>
                                                    </div>
                                                </div>
                                                {index < hops.length - 1 && (
                                                    <div className="relative flex items-center py-1.5">
                                                        <div className="absolute left-[6px] w-1.5 h-1.5 rounded-full bg-violet-500 z-10" />
                                                        <ChevronDown className="ml-5 w-2.5 h-2.5 text-violet-500" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Signatures - Gray layers, NOT connected */}
                                        <div className="flex items-start gap-2.5 mt-3">
                                            <Layers className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <div className="text-xs font-semibold">{hops.length > 0 ? hops.length : 1} step{hops.length !== 1 ? 's' : ''}</div>
                                                <div className="text-[11px] text-muted-foreground leading-tight">
                                                    Gas sponsored by ZeroCliq
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Summary Row */}
                    <div className="flex items-center justify-between mt-3 text-xs font-medium">
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <span>1 {sellToken.symbol} ≈ {exchangeRate > 0 ? exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '...'} {buyToken.symbol}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <div className="flex items-center gap-0.5 text-emerald-500">
                                <Fuel className="w-3.5 h-3.5" />
                                <span>Free</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>~3s</span>
                            </div>
                        </div>
                    </div>

                    {/* Show All Button - Light gray background */}
                    <button
                        className="w-full mt-3 py-2.5 rounded-lg text-foreground font-semibold text-xs transition-all cursor-pointer hover:opacity-80 active:scale-[0.99] bg-gray-200 dark:bg-white/10"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? 'Show less' : 'Show all'}
                    </button>
                </div>
            </div>

            {/* Smart Card Status Badge - Shows different states */}
            {(() => {
                // Smart card status is already computed dynamically in useMemo above

                const statusConfig: Record<SmartCardStatus, { message: string; cta?: string; ctaAction?: string }> = {
                    'no-smart-account': {
                        message: 'You need a Smart Account to swap.',
                        cta: 'Create one',
                        ctaAction: '/app/settings'
                    },
                    'not-deployed': {
                        message: 'Your Smart Account needs to be deployed.',
                        cta: 'Deploy now',
                        ctaAction: '/app/settings'
                    },
                    'no-trade-card': {
                        message: 'Create your Trade Smart Card to enable instant swaps.',
                        cta: 'Set up',
                        ctaAction: '/app/settings'
                    },
                    'insufficient-funds': {
                        message: `Your Smart Account has ${smartAccountBalanceNum.toFixed(4)} ${sellToken.symbol} — you need ${parseFloat(sellAmount).toFixed(4)}.`,
                        cta: 'Top up',
                        ctaAction: '/app/portfolio'
                    },
                    'ready': {
                        message: 'Trade Smart Card active'
                    }
                }

                const config = statusConfig[smartCardStatus]

                // Success state (ready)
                if (smartCardStatus === 'ready') {
                    return (
                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 text-xs rounded-[8px]">
                            <div className="w-4 h-4 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="font-medium">{config.message}</span>
                        </div>
                    )
                }

                // Warning states
                return (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100 text-xs rounded-[8px]">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="flex-1">{config.message}</span>
                        {config.cta && (
                            <button
                                onClick={() => onStatusAction?.(smartCardStatus)}
                                className="flex items-center gap-0.5 font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0 cursor-pointer"
                            >
                                <span>{config.cta}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )
            })()}
        </>
    )
}

export function SwapInterface() {
    const [sellAmount, setSellAmount] = useState("")
    const [buyAmount, setBuyAmount] = useState("")

    // Balance refresh trigger
    const triggerBalanceRefresh = useAppStore(s => s.triggerBalanceRefresh)

    // Demo: Swapping state - set to true to see SwappingState animation
    const [isSwapping, setIsSwapping] = useState(false)

    // Swap Result State
    const [swapResult, setSwapResult] = useState<'success' | 'error' | null>(null)
    const [swapErrorMessage, setSwapErrorMessage] = useState<string>('')
    const [swapTxHash, setSwapTxHash] = useState<string>('')
    const [completedSwap, setCompletedSwap] = useState<{
        sell: Token
        buy: Token
        sellAmt: string
        buyAmt: string
        gasSaved?: string
    } | null>(null)
    // Get tokens from current connected chain (or fallback)
    const { tokens: chainTokens, currentChain } = useCurrentChainTokens()

    // Placeholder token for initial state (before chain data loads)
    const placeholderToken: Token = {
        symbol: "Select",
        name: "Select Token",
        address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        decimals: 18,
        logoURI: "",
        balance: "0"
    }

    // Token state
    const [sellToken, setSellToken] = useState<Token>(placeholderToken)
    const [buyToken, setBuyToken] = useState<Token>(placeholderToken)
    const [lastChainId, setLastChainId] = useState<number | null>(null)

    // Initialize/update tokens when chain changes or tokens become available
    useEffect(() => {
        const chainId = currentChain?.id

        // Only reinitialize if chain changed or tokens just became available
        if (chainTokens.length > 0 && chainId !== lastChainId) {
            // First token (usually native like ETH) as sell
            const sell = chainTokens[0]
            // First stablecoin as buy
            const buy = chainTokens.find((t: TokenInfo) => t.isStable) || chainTokens[1] || chainTokens[0]

            setSellToken({ ...sell, balance: "0" })
            if (buy && buy.symbol !== sell.symbol) {
                setBuyToken({ ...buy, balance: "0" })
            }
            setLastChainId(chainId || null)
        }
    }, [chainTokens, currentChain?.id, lastChainId])

    // Get real token balances from BalanceSync
    const sellTokenBalance = useBalanceBySymbol(sellToken.symbol)
    const buyTokenBalance = useBalanceBySymbol(buyToken.symbol)

    // Get real USD prices from PriceSync
    const { price: sellPrice } = useTokenPrice(sellToken.address, currentChain?.id)
    const { price: buyPrice } = useTokenPrice(buyToken.address, currentChain?.id)

    // Calculate USD values
    const sellUsdValue = sellAmount && sellPrice
        ? parseFloat(sellAmount) * sellPrice
        : null
    const buyUsdValue = buyAmount && buyPrice
        ? parseFloat(buyAmount) * buyPrice
        : null

    // Get user address for quote
    const { address: userAddress } = useAccount()

    // Auto-fetch quotes when inputs change
    const {
        quote,
        isLoading: isQuoteLoading,
        error: quoteError,
        refetch: refetchQuote
    } = useSwapQuote({
        chainId: currentChain?.id,
        tokenIn: sellToken.address,
        tokenOut: buyToken.address,
        amountIn: sellAmount,
        tokenInDecimals: sellToken.decimals ?? 18,
        userAddress,
        enabled: sellToken.symbol !== "Select" && buyToken.symbol !== "Select"
    })

    // Update buyAmount when quote changes
    useEffect(() => {
        if (quote?.bestRoute?.amountOut && buyToken.decimals !== undefined) {
            const outAmount = parseFloat(quote.bestRoute.amountOut) / Math.pow(10, buyToken.decimals)
            setBuyAmount(outAmount.toFixed(6))
        } else if (!quote) {
            // Clear buyAmount when quote is null (loading or error)
            setBuyAmount("")
        }
    }, [quote?.bestRoute?.amountOut, quote, buyToken.decimals])

    // Sync tokens to Zustand for chart display
    const setSwapTokens = useAppStore((s) => s.setSwapTokens)
    useEffect(() => {
        if (sellToken.symbol !== "Select" && buyToken.symbol !== "Select") {
            setSwapTokens(
                { symbol: sellToken.symbol, address: sellToken.address as string, logoURI: sellToken.logoURI },
                { symbol: buyToken.symbol, address: buyToken.address as string, logoURI: buyToken.logoURI }
            )
        }
    }, [sellToken, buyToken, setSwapTokens])

    // Handle token switch
    const handleSwitch = () => {
        // Swap tokens
        const tempToken = sellToken
        setSellToken(buyToken)
        setBuyToken(tempToken)

        // Swap amounts
        const tempAmount = sellAmount
        setSellAmount(buyAmount)
        setBuyAmount(tempAmount)
    }

    // Get smart account status from store for swap validation
    const needsSmartAccountSetup = useAppStore((s) => s.needsSmartAccountSetup)
    const needsDeployment = useAppStore((s) => s.needsDeployment)
    const hasTradeCard = useAppStore((s) => s.hasTradeCard)
    const tradeCardId = useAppStore((s) => s.tradeCardId)

    // Get Smart Account balance for swap validation (separate from EOA balance in UI)
    const smartAccountSellBalanceForSwap = useBalanceBySymbol(sellToken.symbol, 'smartAccount')
    const smartAccountBalanceForSwap = smartAccountSellBalanceForSwap?.balance ?? 0

    // Compute smart card status for swap validation
    const swapValidationStatus = useMemo<SmartCardStatus>(() => {
        if (needsSmartAccountSetup()) return 'no-smart-account'
        if (needsDeployment()) return 'not-deployed'
        if (!hasTradeCard) return 'no-trade-card'
        // Check insufficient funds using Smart Account balance
        const sellAmountNum = parseFloat(sellAmount) || 0
        if (sellAmountNum > 0 && sellAmountNum > smartAccountBalanceForSwap) return 'insufficient-funds'
        return 'ready'
    }, [needsSmartAccountSetup, needsDeployment, hasTradeCard, sellAmount, smartAccountBalanceForSwap])

    // Handle Swap Action - Validation first, then real API execution
    const handleSwap = async () => {
        if (!sellAmount || !quote) return

        // Validate and show toast for warning states
        if (swapValidationStatus !== 'ready') {
            switch (swapValidationStatus) {
                case 'no-smart-account':
                    toast.warning('Smart Account Required', 'You need a Smart Account to swap tokens gaslessly.', {
                        action: { label: 'Create Smart Account', onClick: () => showPrompt() }
                    })
                    break
                case 'not-deployed':
                    toast.warning('Deploy Smart Account', 'Your Smart Account needs to be deployed before you can swap.', {
                        action: { label: 'Deploy Now', onClick: () => showPrompt() }
                    })
                    break
                case 'no-trade-card':
                    toast.warning('Trade Smart Card Required', 'Set up your Trade Smart Card to enable instant gasless swaps.', {
                        action: { label: 'Set Up Card', onClick: () => setShowTradeCardPrompt(true) }
                    })
                    break
                case 'insufficient-funds':
                    toast.warning('Insufficient Balance', `Your Smart Account has ${smartAccountBalanceForSwap.toFixed(4)} ${sellToken.symbol} but you need ${parseFloat(sellAmount).toFixed(4)}.`, {
                        action: { label: 'Top Up', onClick: () => setShowFundingModal(true) }
                    })
                    break
            }
            return
        }

        // Check for Trade Card ID
        if (!tradeCardId) {
            toast.error('Trade Card Missing', 'Please set up your Trade Card first.')
            setShowTradeCardPrompt(true)
            return
        }

        // Store swap details for result screen BEFORE API call
        const currentSwap = {
            sell: sellToken,
            buy: buyToken,
            sellAmt: sellAmount,
            buyAmt: buyAmount || (quote?.bestRoute?.amountOut
                ? (parseFloat(quote.bestRoute.amountOut) / Math.pow(10, buyToken.decimals ?? 18)).toFixed(6)
                : '0'),
            gasSaved: '$5.42' // Will be replaced with real value from backend
        }

        // Start execution
        setIsSwapping(true)
        setSwapErrorMessage('')
        setSwapTxHash('')

        try {
            console.log('[SwapInterface] Executing swap via Trade Card:', tradeCardId)

            const response = await fetch('/api/smart-cards/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    smartCardId: tradeCardId,
                    quote: quote,
                }),
            })

            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Swap execution failed')
            }

            // Success!
            console.log('[SwapInterface] Swap successful:', data.transactionHash)
            setSwapTxHash(data.transactionHash)
            setCompletedSwap(currentSwap)
            setSwapResult('success')

            // Clear inputs
            setSellAmount('')
            setBuyAmount('')

            toast.success('Swap Complete!', `Swapped ${currentSwap.sellAmt} ${sellToken.symbol} for ${currentSwap.buyAmt} ${buyToken.symbol}`)

            // Log notification and activity (fire and forget)
            if (userAddress && currentChain?.id) {
                createNotification({
                    walletAddress: userAddress,
                    chainId: currentChain.id,
                    type: 'SWAP_SUCCESS',
                    title: 'Swap Completed',
                    message: `Swapped ${currentSwap.sellAmt} ${sellToken.symbol} → ${currentSwap.buyAmt} ${buyToken.symbol}`,
                    metadata: {
                        txHash: data.transactionHash,
                        fromAmount: currentSwap.sellAmt,
                        fromToken: sellToken.symbol,
                        toAmount: currentSwap.buyAmt,
                        toToken: buyToken.symbol,
                        dexName: quote?.bestRoute?.dexName,
                    }
                })

                logActivity({
                    walletAddress: userAddress,
                    chainId: currentChain.id,
                    type: 'SWAP',
                    status: 'SUCCESS',
                    title: 'Token Swap',
                    description: `Swapped ${currentSwap.sellAmt} ${sellToken.symbol} for ${currentSwap.buyAmt} ${buyToken.symbol}`,
                    txHash: data.transactionHash,
                    metadata: {
                        fromAmount: currentSwap.sellAmt,
                        fromToken: sellToken.symbol,
                        toAmount: currentSwap.buyAmt,
                        toToken: buyToken.symbol,
                        dexName: quote?.bestRoute?.dexName,
                        priceImpact: quote?.bestRoute?.priceImpactBps,
                    }
                })
            }

        } catch (error: any) {
            console.error('[SwapInterface] Swap failed:', error)
            setSwapErrorMessage(error.message || 'Swap failed. Please try again.')
            setCompletedSwap(currentSwap)
            setSwapResult('error')

            toast.error('Swap Failed', error.message || 'Please try again')

            // Log failed notification and activity
            if (userAddress && currentChain?.id) {
                createNotification({
                    walletAddress: userAddress,
                    chainId: currentChain.id,
                    type: 'SWAP_FAILED',
                    title: 'Swap Failed',
                    message: `Failed to swap ${currentSwap.sellAmt} ${sellToken.symbol} → ${buyToken.symbol}`,
                    metadata: {
                        fromAmount: currentSwap.sellAmt,
                        fromToken: sellToken.symbol,
                        toToken: buyToken.symbol,
                        error: error.message,
                    }
                })

                logActivity({
                    walletAddress: userAddress,
                    chainId: currentChain.id,
                    type: 'SWAP',
                    status: 'FAILED',
                    title: 'Swap Failed',
                    description: `Failed to swap ${currentSwap.sellAmt} ${sellToken.symbol} → ${buyToken.symbol}`,
                    metadata: {
                        fromAmount: currentSwap.sellAmt,
                        fromToken: sellToken.symbol,
                        toToken: buyToken.symbol,
                        error: error.message,
                    }
                })
            }
        } finally {
            setIsSwapping(false)
        }
    }

    // Handle back from result screen - refetch quote for retry
    const handleBack = () => {
        setSwapResult(null)
        setCompletedSwap(null)
        setSwapErrorMessage('')
        setSwapTxHash('')
        // Refetch quote for fresh data on retry
        refetchQuote()
    }

    // Token selector modal state
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
    const [selectingSide, setSelectingSide] = useState<'sell' | 'buy'>('sell')

    // Trade Card prompt state
    const [showTradeCardPrompt, setShowTradeCardPrompt] = useState(false)

    // Funding modal state
    const [showFundingModal, setShowFundingModal] = useState(false)

    // Smart account prompt action
    const showPrompt = useAppStore((s) => s.showPrompt)

    const openSellTokenModal = () => {
        setSelectingSide('sell')
        setIsTokenModalOpen(true)
    }

    const openBuyTokenModal = () => {
        setSelectingSide('buy')
        setIsTokenModalOpen(true)
    }

    const handleTokenSelect = (token: TokenInfo) => {
        const newToken: Token = {
            ...token,
            balance: "0" // TODO: Fetch real balance from wallet
        }

        if (selectingSide === 'sell') {
            // If selecting same token as buy side → auto-swap! 🔄
            if (buyToken.symbol === token.symbol) {
                // Swap them - the old sell token becomes the new buy token
                setBuyToken(sellToken)
                setSellToken(newToken)
                // Also swap amounts for a smooth UX
                const tempAmount = sellAmount
                setSellAmount(buyAmount)
                setBuyAmount(tempAmount)
            } else {
                setSellToken(newToken)
            }
        } else {
            // If selecting same token as sell side → auto-swap! 🔄
            if (sellToken.symbol === token.symbol) {
                // Swap them - the old buy token becomes the new sell token
                setSellToken(buyToken)
                setBuyToken(newToken)
                // Also swap amounts
                const tempAmount = sellAmount
                setSellAmount(buyAmount)
                setBuyAmount(tempAmount)
            } else {
                setBuyToken(newToken)
            }
        }
    }

    if (swapResult === 'success' && completedSwap) {
        return (
            <div className="w-full max-w-md mx-auto relative">
                <SwapSuccess
                    sellToken={completedSwap.sell}
                    buyToken={completedSwap.buy}
                    sellAmount={completedSwap.sellAmt}
                    buyAmount={completedSwap.buyAmt}
                    onBack={handleBack}
                    txHash={swapTxHash || undefined}
                    gasSaved={completedSwap.gasSaved}
                    chainId={currentChain?.id}
                />
            </div>
        )
    }

    if (swapResult === 'error' && completedSwap) {
        return (
            <div className="w-full max-w-md mx-auto relative">
                <SwapError
                    sellToken={completedSwap.sell}
                    buyToken={completedSwap.buy}
                    sellAmount={completedSwap.sellAmt}
                    buyAmount={completedSwap.buyAmt}
                    onBack={handleBack}
                    errorMessage={swapErrorMessage || 'Swap failed. Please try again.'}
                />
            </div>
        )
    }

    return (
        <>
            <div className="w-full max-w-md mx-auto">
                {/* Main Card */}
                <div
                    className="bg-card backdrop-blur-xl rounded-[28px] p-2 dark:border dark:border-border/40"
                    style={{
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.02)'
                    }}
                >

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 mb-2">
                        <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                            <span className="text-lg font-semibold">Swap</span>
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" className="h-8 rounded-full bg-muted/50 hover:bg-muted text-xs font-medium gap-1.5 px-3">
                                My orders <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted/50">
                                <Settings className="w-5 h-5 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>

                    {/* Token Inputs with Overlapping Switcher */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateRows: 'auto auto',
                            gap: '4px',
                            position: 'relative'
                        }}
                    >
                        {/* Sell Input */}
                        <TokenInput
                            value={sellAmount}
                            onChange={setSellAmount}
                            tokenSymbol={sellToken.symbol}
                            tokenLogoURI={sellToken.logoURI}
                            dollarValue={formatUsdValue(sellUsdValue)}
                            balance={sellTokenBalance?.balance?.toLocaleString(undefined, { maximumFractionDigits: 4 }) || "0"}
                            autoFocus={true}
                            onTokenClick={openSellTokenModal}
                        />

                        {/* Buy Input */}
                        <TokenInput
                            value={buyAmount}
                            onChange={setBuyAmount}
                            tokenSymbol={buyToken.symbol}
                            placeholder={true}
                            tokenLogoURI={buyToken.logoURI}
                            dollarValue={formatUsdValue(buyUsdValue)}
                            balance={buyTokenBalance?.balance?.toLocaleString(undefined, { maximumFractionDigits: 4 }) || "0"}
                            onTokenClick={openBuyTokenModal}
                        />

                        {/* Switcher Arrow - Centered at the junction of both inputs */}
                        <div
                            onClick={handleSwitch}
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 20
                            }}
                        >
                            <div className="bg-background border-4 border-background rounded-xl p-0.5 cursor-pointer hover:scale-105 transition-transform active:scale-95">
                                <div className="bg-muted p-2 rounded-lg">
                                    <ArrowDown className="w-4 h-4 text-primary stroke-[2.5]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Route Info / Swapping State - Animated transition */}
                    <AnimatePresence mode="wait">
                        {sellAmount && parseFloat(sellAmount) > 0 && (
                            isSwapping ? (
                                <SwappingState
                                    key="swapping"
                                    sellToken={sellToken}
                                    buyToken={buyToken}
                                    sellAmount={sellAmount}
                                    buyAmount={buyAmount}
                                    dexName={quote?.bestRoute?.dexName}
                                />
                            ) : (
                                <motion.div
                                    key="routeinfo"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <RouteInfo
                                        sellAmount={sellAmount}
                                        sellToken={sellToken}
                                        buyToken={buyToken}
                                        chainId={currentChain?.id}
                                        quote={quote}
                                        isQuoteLoading={isQuoteLoading}
                                        onRefresh={refetchQuote}
                                        onStatusAction={(status) => {
                                            if (status === 'no-smart-account' || status === 'not-deployed') {
                                                showPrompt()
                                            } else if (status === 'no-trade-card') {
                                                setShowTradeCardPrompt(true)
                                            } else if (status === 'insufficient-funds') {
                                                setShowFundingModal(true)
                                            }
                                        }}
                                    />
                                </motion.div>
                            )
                        )}
                    </AnimatePresence>

                    {/* Action Button */}
                    <Button
                        className={`w-full h-14 rounded-[16px] mt-2 text-lg font-semibold transition-colors ${isSwapping
                            ? 'bg-primary/80 text-primary-foreground cursor-not-allowed'
                            : sellAmount
                                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80 text-foreground'
                            }`}
                        disabled={!sellAmount || isSwapping}
                        onClick={handleSwap}
                    >
                        {isSwapping ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Swapping...
                            </>
                        ) : sellAmount ? (
                            <>
                                Swap
                                <ArrowRightLeft className="w-5 h-5 ml-2" />
                            </>
                        ) : (
                            'Enter an amount'
                        )}
                    </Button>

                </div>
            </div>

            {/* Token Selector Modal */}
            <TokenSelectorModal
                isOpen={isTokenModalOpen}
                onClose={() => setIsTokenModalOpen(false)}
                onSelectToken={handleTokenSelect}
                selectedToken={selectingSide === 'sell' ? sellToken.symbol : buyToken.symbol}
            />

            {/* Trade Card Prompt Modal */}
            <TradeCardPrompt
                isOpen={showTradeCardPrompt}
                onClose={() => setShowTradeCardPrompt(false)}
                onSuccess={() => {
                    // Trade card created successfully, user can now swap
                    refetchQuote()
                }}
            />

            {/* Funding Modal */}
            <FundingModal
                isOpen={showFundingModal}
                onClose={() => setShowFundingModal(false)}
                preselectedToken={{
                    symbol: sellToken.symbol,
                    address: sellToken.address as string,
                    decimals: sellToken.decimals ?? 18,
                    logoURI: sellToken.logoURI,
                }}
                requiredAmount={sellAmount}
                onSuccess={() => {
                    // Refetch quote immediately
                    refetchQuote()
                    // Force balance refresh immediately
                    triggerBalanceRefresh()

                    // Poll balance refresh every 2 seconds for 10 seconds to account for RPC latency
                    const interval = setInterval(() => {
                        console.log('[SwapInterface] Polling balance refresh...')
                        triggerBalanceRefresh()
                    }, 2000)

                    // Clear interval after 10 seconds
                    setTimeout(() => clearInterval(interval), 10000)
                }}
            />
        </>
    )
}
