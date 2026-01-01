"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { useAppStore } from "@/store/useAppStore"
import {
    PieChart,
    Plus,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Clock,
    Sparkles,
    Shield,
    Calendar,
    MoreVertical,
    ExternalLink,
    Trash2,
    Settings,
    Settings2,
    X,
    Check,
    Wallet,
    Zap,
    RefreshCw,
    BarChart3,
    Play,
    Loader2,
    Activity,
    AlertTriangle,
    ArrowRight,
    Ban,
    TrendingUp,
    TrendingDown,
    Rocket,
    Search,
    ArrowUp,
    ArrowDown,
    CalendarCheck
} from "lucide-react"
import { useBalanceBySymbol, useTokenPrice } from "@/hooks/useTokenBalance"
import { FundingModal } from "@/components/features/smart-account/FundingModal"
import { cn, formatUsdValue } from "@/lib/utils"
import { TokenSelectorModal, TokenInfo } from "@/components/features/swap/TokenSelectorModal"
import { createWalletClient, createPublicClient, custom, parseUnits } from "viem"
import { useAccount } from "wagmi"
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions"
import { toast } from "@/components/ui/toast"
import { getChainById, getViemChain } from "@/lib/server/config/chains"



/**
 * CLEAN TEST PAGE FOR CARD STACKS
 * 
 * Uses the SAME Create Stack flow from original page
 * but with clean data fetching (API only, no demo data)
 */

// Sub-card templates
const SUB_CARD_TEMPLATES = [
    { id: "dca", name: "DCA Bot", icon: "🤖", color: "#8B5CF6", description: "Auto-buy at intervals" },
    { id: "limits", name: "Limit Orders", icon: "📊", color: "#06B6D4", description: "Execute at price targets" },
    { id: "subscription", name: "Recurring Payment", icon: "📅", color: "#10B981", description: "Auto-pay bills & subscriptions" },
    { id: "manual", name: "Manual Trades", icon: "✋", color: "#F97316", description: "Your direct swaps" },
]

// Animation variants
const overlayVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
}

const panelVariants: Variants = {
    hidden: { x: "100%", opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: "spring", damping: 30, stiffness: 300 } },
    exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } }
}

// Type for StackCard
interface StackCardData {
    id: string
    name: string
    token: {
        symbol: string
        name: string
        logoURI: string
        decimals: number
        address: string
        chainId: number
    }
    totalBudget: number
    usedToday: number
    expiresAt: Date
    status: "active" | "paused"
    periodDuration: number
    subCards: Array<{
        id: string
        name: string
        icon: string
        budget: number
        spent: number
        color: string
        status: "active" | "paused"
        type?: string
        config?: {
            targetTokenSymbol?: string
            targetTokenAddress?: string
            amountPerExecution?: string
            description?: string
            targetTokenDecimals?: number
            dailyLimit?: string
            // Limit Order specific
            targetPrice?: string
            condition?: 'BELOW' | 'ABOVE'
            action?: string
        }
    }>
    recentTx: Array<{
        from: string
        to: string
        time: string
        via: string
    }>
}

// Icon mapping for sub-card types
const getSubCardIcon = (type: string): string => {
    switch (type) {
        case 'DCA_BOT': return "🤖"
        case 'LIMIT_ORDER': return "📊"
        case 'MANUAL_TRADING': return "✋"
        default: return "📦"
    }
}

export default function CardStacksTestPage() {
    const { address, chainId } = useAccount()
    const currentChainId = chainId || 143
    const chainConfig = getChainById(currentChainId)
    const supportedTokens = chainConfig?.tokens || []

    // State
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [stacks, setStacks] = useState<StackCardData[]>([])
    const [showCreateFlow, setShowCreateFlow] = useState(false)
    const [executingStackId, setExecutingStackId] = useState<string | null>(null)
    const [executingSubCardId, setExecutingSubCardId] = useState<string | null>(null)

    // Stack Management State
    const [managingStack, setManagingStack] = useState<StackCardData | null>(null)
    const [showStackManagementModal, setShowStackManagementModal] = useState(false)

    // DCA Configuration State
    // Success Modal State
    const [successModal, setSuccessModal] = useState<{
        show: boolean
        txHash: string
        amount: string
        token: string
        tokenLogo?: string
        targetToken?: string
        targetTokenLogo?: string
        amountOut?: string
        rate?: string
        swapTxHash?: string
        isLimitOrder?: boolean
        isSubscription?: boolean
        recipient?: string
    } | null>(null)

    // Refetch stacks from API
    const refetchStacks = useCallback(async () => {
        if (!address) return
        try {
            const res = await fetch(`/api/card-stacks?walletAddress=${address}&chainId=${currentChainId}`)
            const data = await res.json()
            if (data.success && data.stacks) {
                setStacks(data.stacks.map(transformApiStack))
            }
        } catch (e) {
            console.error("Refetch error", e)
        }
    }, [address, currentChainId])

    const handleExecuteDCA = useCallback(async (stackId: string, subCardId: string, amount: number): Promise<boolean> => {
        setExecutingStackId(stackId)
        setExecutingSubCardId(subCardId)
        try {
            const stack = stacks.find(s => s.id === stackId)
            const subCard = stack?.subCards.find(s => s.id === subCardId)
            const isLimitOrder = subCard?.type === 'LIMIT_ORDER'
            // Extract recipient for subscription
            const recipient = (subCard?.config as any)?.recipient

            const res = await fetch('/api/card-stacks/execute-dca', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardStackId: stackId,
                    subCardId,
                    amount: amount.toFixed(stack?.token.decimals || 6),
                    isLimitOrder, // Pass to API for activity tracking
                    recipientAddress: recipient // Pass for subscription handling
                })
            })
            const data = await res.json()
            if (data.success) {
                // Show success modal
                const targetSymbol = data.targetToken || subCard?.config?.targetTokenSymbol
                const targetTokenInfo = supportedTokens.find(t => t.symbol === targetSymbol)

                setSuccessModal({
                    show: true,
                    txHash: data.transferTxHash,
                    swapTxHash: data.swapTxHash,
                    amount: (Number(data.amountIn) / Math.pow(10, stack?.token.decimals || 18)).toString(),
                    token: data.sourceToken || stack?.token.symbol,
                    tokenLogo: stack?.token.logoURI,
                    targetToken: targetSymbol,
                    targetTokenLogo: targetTokenInfo?.logoURI,
                    amountOut: data.amountOut ? (Number(data.amountOut) / Math.pow(10, 18)).toFixed(6) : undefined,
                    rate: data.rate,
                    isLimitOrder,
                    isSubscription: !!recipient,
                    recipient
                })

                // Refetch stacks to get updated spent amounts from DB
                await refetchStacks()
                return true
            } else {
                console.error("Execution failed", data.error)
                toast.error(isLimitOrder ? "Limit Order Failed" : "Execution Failed", data.details?.message || data.error || "Unknown error")
                return false
            }
        } catch (e: any) {
            console.error("Execution error", e)
            toast.error("Execution Failed", e.message || "Network error")
            return false
        } finally {
            setExecutingStackId(null)
            setExecutingSubCardId(null)
        }
    }, [stacks, supportedTokens, refetchStacks])

    // Dedicated handler for Subscription payments - calls new endpoint
    const handleExecuteSubscription = useCallback(async (stackId: string, subCardId: string, amount: number): Promise<boolean> => {
        setExecutingStackId(stackId)
        setExecutingSubCardId(subCardId)
        try {
            const stack = stacks.find(s => s.id === stackId)
            const subCard = stack?.subCards.find(s => s.id === subCardId)
            const config = subCard?.config as any
            const recipient = config?.recipient

            if (!recipient) {
                toast.error("Invalid Subscription", "No recipient address configured")
                return false
            }

            console.log(`[Subscription] Executing payment: ${amount} ${stack?.token.symbol} to ${recipient}`)

            const res = await fetch('/api/card-stacks/execute-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardStackId: stackId,
                    subCardId,
                    amount: amount.toFixed(stack?.token.decimals || 6),
                    recipientAddress: recipient
                })
            })
            const data = await res.json()

            if (data.success) {
                // Show subscription-specific success modal
                setSuccessModal({
                    show: true,
                    txHash: data.transferTxHash,
                    swapTxHash: data.paymentTxHash, // Payment TX
                    amount: (Number(data.amountIn) / Math.pow(10, stack?.token.decimals || 18)).toString(),
                    token: data.sourceToken || stack?.token.symbol,
                    tokenLogo: stack?.token.logoURI,
                    isSubscription: true,
                    recipient: data.recipient || recipient,
                })

                await refetchStacks()
                return true
            } else {
                console.error("Subscription payment failed", data.error)
                toast.error("Payment Failed", data.error || "Unknown error")
                return false
            }
        } catch (e: any) {
            console.error("Subscription execution error", e)
            toast.error("Payment Failed", e.message || "Network error")
            return false
        } finally {
            setExecutingStackId(null)
            setExecutingSubCardId(null)
        }
    }, [stacks, refetchStacks, supportedTokens])

    // Transform API data to StackCard format
    const transformApiStack = (apiStack: any): StackCardData => {
        const foundToken = supportedTokens.find(t => t.symbol === apiStack.tokenSymbol)
        const token: StackCardData['token'] = foundToken ? { ...foundToken, chainId: currentChainId } : {
            symbol: apiStack.tokenSymbol || "???",
            name: apiStack.tokenSymbol || "Unknown",
            logoURI: "https://assets.coingecko.com/coins/images/38927/standard/monad.png",
            decimals: 18,
            address: (apiStack.tokenAddress || "0x0") as `0x${string}`,
            chainId: currentChainId
        }

        // Calculate usedToday as sum of all subCard spent amounts
        // Note: currentSpent is already stored in token units (e.g., "1" for 1 USDC), NOT wei
        const subCardsData = (apiStack.subCards || []).map((sc: any) => ({
            id: sc.id,
            name: sc.name,
            icon: getSubCardIcon(sc.type),
            budget: sc.allocationPercent,
            spent: parseFloat(sc.currentSpent || "0") / Math.pow(10, token.decimals), // Convert Wei to Token Units
            color: sc.color,
            status: sc.status.toLowerCase() as "active" | "paused",
            type: sc.type, // Preserve the type for UI differentiation
            config: {
                description: sc.config?.description,
                // Read from specific subCard config (Hybrid architecture)
                // Support both DCA_BOT and LIMIT_ORDER types
                targetTokenSymbol: sc.config?.targetTokenSymbol || apiStack.targetTokenSymbol,
                targetTokenAddress: sc.config?.targetTokenAddress || apiStack.targetTokenAddress,
                targetTokenDecimals: sc.config?.targetTokenDecimals || apiStack.targetTokenDecimals,
                dailyLimit: sc.config?.dailyLimit,
                // DCA specific
                ...(sc.type === 'DCA_BOT' ? {
                    amountPerExecution: sc.config?.amountPerExecution || apiStack.amountPerExecution,
                } : {}),
                // Limit Order specific
                ...(sc.type === 'LIMIT_ORDER' ? {
                    targetPrice: sc.config?.targetPrice,
                    condition: sc.config?.condition,
                    action: sc.config?.action || 'BUY'
                } : {}),
                // Subscription specific
                ...(sc.type === 'SUBSCRIPTION' ? {
                    recipient: sc.config?.recipient,
                    label: sc.config?.label,
                    frequency: sc.config?.frequency,
                    paymentDay: sc.config?.paymentDay,
                    nextPaymentDate: sc.config?.nextPaymentDate,
                    action: sc.config?.action || 'TRANSFER'
                } : {})
            }
        }))

        const totalSpent = subCardsData.reduce((acc: number, sc: any) => acc + (sc.spent || 0), 0)

        return {
            id: apiStack.id,
            name: `${apiStack.tokenSymbol} Stack`,
            token,
            totalBudget: parseFloat(apiStack.totalBudget),
            periodDuration: parseInt(apiStack.periodDuration || "86400"),
            usedToday: totalSpent, // Calculated from subCards
            expiresAt: new Date(apiStack.expiresAt),
            status: apiStack.status.toLowerCase() as "active" | "paused",
            subCards: subCardsData,
            recentTx: []
        }
    }

    // Fetch from API
    useEffect(() => {
        const fetchStacks = async () => {
            setIsLoading(true)
            setError(null)

            if (!address) {
                console.log("[Test] No wallet connected")
                setIsLoading(false)
                return
            }

            console.log("[Test] Fetching stacks for:", address, currentChainId)

            try {
                const res = await fetch(`/api/card-stacks?walletAddress=${address}&chainId=${currentChainId}`)
                const data = await res.json()
                console.log("[Test] Raw API data:", data)

                if (data.success && data.stacks) {
                    const transformed = data.stacks.map((s: any) => {
                        try {
                            return transformApiStack(s)
                        } catch (err) {
                            console.error("[Test] Transform error for stack:", s.id, err)
                            return null
                        }
                    }).filter(Boolean) as StackCardData[]

                    console.log("[Test] Transformed stacks:", transformed)
                    setStacks(transformed)
                } else {
                    setError(data.error || "No stacks returned")
                }
            } catch (err: any) {
                console.error("[Test] Fetch error:", err)
                setError(err.message || "Failed to fetch")
            } finally {
                setIsLoading(false)
            }
        }

        fetchStacks()
    }, [address, currentChainId, supportedTokens])

    const handleCreateStack = useCallback(() => {
        setShowCreateFlow(true)
    }, [])

    const handleCloseCreate = useCallback(() => {
        setShowCreateFlow(false)
    }, [])

    const handleStackCreated = useCallback((newStack?: any) => {
        setShowCreateFlow(false)
        // Check if newStack is a valid object and NOT a DOM event (which lacks our specific fields)
        if (newStack && newStack.id && typeof newStack.id === 'string') {
            // Format the stack to match the expected UI structure
            const token = supportedTokens.find(t => t.symbol === newStack.tokenSymbol) || {
                symbol: newStack.tokenSymbol,
                name: newStack.tokenSymbol,
                logoURI: "",
                decimals: 18,
                address: newStack.tokenAddress
            }
            const formattedStack: StackCardData = {
                id: newStack.id,
                name: `${newStack.tokenSymbol} Stack`,
                token,
                totalBudget: parseFloat(newStack.totalBudget),
                usedToday: 0,
                expiresAt: new Date(newStack.expiresAt),
                status: (newStack.status?.toLowerCase() || 'active') as "active" | "paused",
                subCards: (newStack.subCards || []).map((sc: any) => ({
                    id: sc.id,
                    name: sc.name,
                    icon: getSubCardIcon(sc.type),
                    budget: sc.allocationPercent,
                    spent: 0,
                    color: sc.color,
                    status: (sc.status?.toLowerCase() || 'active') as "active" | "paused"
                })),
                recentTx: []
            }
            setStacks(prev => [formattedStack, ...prev])
        }
    }, [supportedTokens])

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-6 relative">
            {/* Header - matching original design */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <PieChart className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground whitespace-nowrap">Card Stacks</h1>
                        <p className="text-xs text-muted-foreground">Manage your permission budgets on {chainConfig?.name}</p>
                    </div>
                </div>
                <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateStack}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer w-full sm:w-auto justify-center"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Stack</span>
                </motion.button>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="space-y-4">
                    <div className="h-40 rounded-xl bg-muted animate-pulse" />
                    <div className="h-40 rounded-xl bg-muted animate-pulse" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive text-destructive">
                    Error: {error}
                </div>
            )}

            {/* Verified Activity Feed (Global now) */}

            {/* Stacks */}
            {!isLoading && stacks.length > 0 && (
                <div className="space-y-4">
                    {stacks.map((stack) => (
                        <StackCard
                            key={stack.id}
                            stack={stack}
                            onExecuteDCA={handleExecuteDCA}
                            onExecuteSubscription={handleExecuteSubscription}
                            onRefetch={refetchStacks}
                            isExecuting={executingStackId === stack.id}
                            executingSubCardId={executingSubCardId}
                            supportedTokens={supportedTokens}
                            onManage={(s) => {
                                setManagingStack(s)
                                setShowStackManagementModal(true)
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && address && stacks.length === 0 && (
                <EmptyState onCreateStack={handleCreateStack} />
            )}

            {/* No Wallet */}
            {!address && !isLoading && (
                <div className="p-8 text-center rounded-xl bg-card border border-dashed border-border">
                    <p className="text-muted-foreground">Connect your wallet to view card stacks.</p>
                </div>
            )}

            {/* Create Stack Overlay */}
            <AnimatePresence>
                {showCreateFlow && (
                    <CreateStackOverlay
                        onClose={handleCloseCreate}
                        onSuccess={handleStackCreated}
                        tokens={supportedTokens}
                    />
                )}
            </AnimatePresence>

            {/* Success Modal */}
            <AnimatePresence>
                {successModal?.show && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setSuccessModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
                        >
                            {/* Success Header */}
                            <div className="p-6 text-center border-b border-border">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", damping: 15 }}
                                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
                                >
                                    <motion.div
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ delay: 0.4, duration: 0.5 }}
                                    >
                                        <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                    </motion.div>
                                </motion.div>
                                <motion.h3
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-xl font-bold text-foreground"
                                >
                                    {successModal.isLimitOrder ? 'Limit Order Filled!' : (successModal.isSubscription ? 'Payment Sent!' : 'Transfer Successful!')}
                                </motion.h3>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-sm text-muted-foreground mt-1"
                                >
                                    {successModal.isLimitOrder
                                        ? 'Your limit order has been triggered and executed'
                                        : (successModal.isSubscription ? 'Your recurring payment has been processed' : 'Your DCA trade has been executed')}
                                </motion.p>
                            </div>

                            {/* Details */}
                            <div className="p-6 space-y-4">
                                {successModal.isSubscription ? (
                                    <div className="space-y-4">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Recipient</span>
                                                <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</span>
                                            </div>
                                            <div className="font-mono text-lg font-bold text-foreground">
                                                {successModal.recipient?.startsWith("0x") ? `${successModal.recipient.slice(0, 6)}...${successModal.recipient.slice(-4)}` : successModal.recipient}
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-emerald-500/20 flex justify-between items-center">
                                                <span className="text-sm font-medium text-muted-foreground">Amount Paid</span>
                                                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                    {successModal.tokenLogo && <img src={successModal.tokenLogo} className="w-5 h-5 rounded-full" />}
                                                    {successModal.amount} {successModal.token}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : successModal.targetToken ? (
                                    <div className="space-y-4">
                                        <div className="bg-muted/50 p-4 rounded-xl">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-bold flex items-center gap-1.5">
                                                    {successModal.tokenLogo && <img src={successModal.tokenLogo} className="w-4 h-4 rounded-full" />}
                                                    {successModal.amount} {successModal.token}
                                                </span>
                                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                                                    {successModal.targetTokenLogo && <img src={successModal.targetTokenLogo} className="w-4 h-4 rounded-full" />}
                                                    {successModal.amountOut} {successModal.targetToken}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
                                                Rate: 1 {successModal.token} ≈ {successModal.rate} {successModal.targetToken}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            {successModal.swapTxHash && (
                                                <a
                                                    href={`https://sepolia.etherscan.io/tx/${successModal.swapTxHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 py-2 bg-primary/10 rounded-lg text-xs font-mono text-primary hover:bg-primary/20 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    View Swap on Explorer: {successModal.swapTxHash.slice(0, 6)}...{successModal.swapTxHash.slice(-4)}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                            <span className="text-sm text-muted-foreground">Amount</span>
                                            <span className="font-mono font-semibold text-foreground">
                                                {successModal.amount} {successModal.token}
                                            </span>
                                        </div>

                                        <div className="p-3 bg-muted/50 rounded-lg">
                                            <div className="text-sm text-muted-foreground mb-1.5">Transaction Hash</div>
                                            <a
                                                href={`https://sepolia.etherscan.io/tx/${successModal.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-primary hover:underline font-mono text-xs break-all"
                                            >
                                                {successModal.txHash.slice(0, 20)}...{successModal.txHash.slice(-8)}
                                                <ExternalLink className="w-3 h-3 shrink-0" />
                                            </a>
                                        </div>
                                    </div>
                                )}

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSuccessModal(null)}
                                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
                                >
                                    Done
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {managingStack && (
                <StackManagementModalUpdated
                    isOpen={showStackManagementModal}
                    onClose={() => setShowStackManagementModal(false)}
                    stack={managingStack}
                    onSuccess={refetchStacks}
                />
            )}
        </div>
    )
}

// ============================================
// CREATE STACK OVERLAY (SPA Feel)
// ============================================

interface CreateStackOverlayProps {
    onClose: () => void
    onSuccess: (stack?: any) => void
    tokens: TokenInfo[]
}

function CreateStackOverlay({ onClose, onSuccess, tokens }: CreateStackOverlayProps) {
    const [step, setStep] = useState<"config" | "signing" | "success" | "error">("config")
    const [errorMsg, setErrorMsg] = useState("")
    const [loadingMsg, setLoadingMsg] = useState("")

    // Default to first available ERC-20 token (skip native 0x0)
    const defaultToken = tokens.find(t => t.address !== "0x0000000000000000000000000000000000000000") || tokens[0] || {
        symbol: "USDC", name: "USD Coin", decimals: 6, logoURI: "", address: "0x0"
    }

    const [selectedToken, setSelectedToken] = useState(defaultToken)
    const [totalBudget, setTotalBudget] = useState(100)
    const [duration, setDuration] = useState(30)
    const [periodDuration, setPeriodDuration] = useState(86400) // Default: daily (86400 seconds)

    // Update selected token if tokens list changes
    useEffect(() => {
        const isCurrentNative = selectedToken.address === "0x0000000000000000000000000000000000000000"
        const validDefault = tokens.find(t => t.address !== "0x0000000000000000000000000000000000000000")

        if (tokens.length > 0) {
            if (!tokens.find(t => t.symbol === selectedToken.symbol) || isCurrentNative) {
                if (validDefault) setSelectedToken(validDefault)
            }
        }
    }, [tokens, selectedToken])

    const [tokenModalOpen, setTokenModalOpen] = useState(false)

    const handleTokenSelect = (token: TokenInfo) => {
        if (token.address === "0x0000000000000000000000000000000000000000") {
            toast.error("Native Token Not Supported", "Please select an ERC-20 token (e.g. USDC, WETH) for Card Stacks.")
            return
        }
        const fullToken = tokens.find(t => t.symbol === token.symbol) || token
        setSelectedToken(fullToken)
        setTokenModalOpen(false)
    }

    const handleCreateStack = async () => {
        setStep("signing")
        setErrorMsg("")
        setLoadingMsg("Please sign the permission request in MetaMask...")

        try {
            if (!window.ethereum) throw new Error("Wallet not found")

            const chainIdHex = await (window.ethereum as any).request({ method: 'eth_chainId' })
            const chainId = parseInt(chainIdHex, 16) || 143

            const walletClient = createWalletClient({
                chain: getViemChain(chainId),
                transport: custom(window.ethereum as any)
            }).extend(erc7715ProviderActions())
            const [account] = await walletClient.requestAddresses()

            // Check if account needs chain switching
            try {
                await walletClient.switchChain({ id: chainId })
            } catch (switchError: any) {
                if (switchError.code === 4902 || switchError.message?.includes("Unrecognized chain")) {
                    try {
                        await walletClient.addChain({ chain: getViemChain(chainId) })
                    } catch (addError) {
                        console.error("Failed to add chain:", addError)
                    }
                }
            }

            // ==========================================
            // SMART ACCOUNT DEPLOYMENT CHECK
            // ==========================================
            const publicClient = createPublicClient({
                chain: getViemChain(chainId),
                transport: custom(window.ethereum as any)
            })

            // 1. Get predicted address
            const { toMetaMaskSmartAccount, Implementation } = await import("@metamask/smart-accounts-kit")
            const dummyAccount = { address: account } as any // Placeholder for getting address

            // Note: We use the helper from lib if possible, but importing it client-side might have issues
            // with 'fs' dependencies. Safest is to use the API or simple check.

            // Simple check: Does the user have a Smart Account in our DB?
            // If yes, we assume it's deployed or they know what they are doing.
            // But relying on on-chain code is better.

            // Using the /api/smart-account/status endpoint is cleanest
            setLoadingMsg("Checking Smart Account status...")
            const statusRes = await fetch(`/api/smart-account/status?address=${account}&chainId=${chainId}`)
            const statusData = await statusRes.json()

            if (statusData.status === "counterfactual" || !statusData.isDeployed) {
                setLoadingMsg("Deploying your Smart Account (Gasless)...")
                console.log("[CardStacks] Deploying Smart Account for", account)

                // Trigger deployment via our verified library helper
                // We need to dynamically import it to avoid server-module issues in client component if any
                const { deploySmartAccount } = await import("@/lib/smart-account")

                const result = await deploySmartAccount(account as `0x${string}`, chainId, walletClient)

                if (!result.success) {
                    throw new Error("Smart Account Deployment Failed: " + result.error)
                }
                console.log("[CardStacks] Deployed!", result.address)
            }

            const currentTime = Math.floor(Date.now() / 1000)
            const expiry = currentTime + (duration * 24 * 60 * 60)
            const periodAmount = parseUnits(totalBudget.toString(), selectedToken.decimals)
            const tokenAddress = selectedToken.address

            // Get period label for justification
            const periodLabels: Record<number, string> = {
                3600: "hour",
                86400: "day",
                604800: "week",
                2592000: "month",
            }
            const periodLabel = periodLabels[periodDuration] || "day"

            // Fetch the Agent Smart Account address (the session account that will execute)
            const agentRes = await fetch(`/api/smart-cards/agent-address?chainId=${chainId}`)
            const agentData = await agentRes.json()

            if (!agentData.success || !agentData.agentSmartAccountAddress) {
                console.error("Agent Address API Error:", agentData)
                throw new Error("Failed to configure Session Account. Please try again.")
            }

            const sessionAccountAddress = agentData.agentSmartAccountAddress as `0x${string}`
            console.log("[CardStacks] Session Account (Agent):", sessionAccountAddress)

            if (account && sessionAccountAddress.toLowerCase() === account.toLowerCase()) {
                throw new Error("Configuration Error: Session Account cannot be same as User Wallet.")
            }

            // Request ERC-7715 Advanced Permissions (following docs exactly)
            // https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/
            const grantedPermissions = await walletClient.requestExecutionPermissions([{
                chainId: chainId,
                expiry,
                signer: {
                    type: "account",
                    data: {
                        // The session account that will be granted permission
                        address: sessionAccountAddress as `0x${string}`,
                    },
                },
                permission: {
                    type: "erc20-token-periodic",
                    data: {
                        tokenAddress: tokenAddress as `0x${string}`,
                        // Maximum amount per period
                        periodAmount: periodAmount,
                        // Period duration in seconds (user-selected)
                        periodDuration: periodDuration,
                        // Human-readable justification
                        justification: `ZeroCliq Card Stack: ${totalBudget} ${selectedToken.symbol}/${periodLabel} budget for automated trading`,
                    },
                },
                // Allow user to adjust the permission if they want
                isAdjustmentAllowed: true,
            }])

            // Extract context and delegationManager from the granted permissions
            const permission = grantedPermissions[0]
            console.log("[CardStacks] Full grantedPermissions response:", JSON.stringify(grantedPermissions, null, 2))
            console.log("[CardStacks] Granted permission:", permission)

            if (!permission?.context) {
                throw new Error("Invalid permission response from MetaMask")
            }
            const permissionsContext = permission.context
            const delegationManager = permission.signerMeta?.delegationManager || ""

            setLoadingMsg("Saving your Stack configuration...")

            const response = await fetch('/api/card-stacks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: account,
                    chainId: chainId,
                    permissionsContext: permissionsContext,
                    delegationManager: delegationManager,
                    tokenAddress: tokenAddress,
                    tokenSymbol: selectedToken.symbol,
                    tokenDecimals: selectedToken.decimals,
                    totalBudget: totalBudget.toString(),
                    periodDuration,
                    expiresAt: new Date(expiry * 1000).toISOString(),
                    // Create empty vault - no DCA config yet (will be added via Strategy flow)
                    subCards: [{
                        type: 'DCA_BOT',
                        name: 'DCA Bot',
                        color: '#8B5CF6',
                        allocationPercent: 0,
                        config: { description: 'Auto-buy at intervals' }
                    }]
                })
            })

            const result = await response.json()
            if (!result.success) throw new Error(result.error)

            setStep("success")

            // Track Activity
            try {
                await fetch('/api/activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress: account,
                        chainId: chainId,
                        type: 'CARD_STACK_CREATE',
                        status: 'SUCCESS',
                        title: 'New Card Stack Created',
                        description: `Active ${totalBudget} ${selectedToken.symbol}/day budget`,
                        metadata: { stackId: result.stack.id }
                    })
                })
            } catch (activityErr) {
                console.warn("Failed to log activity:", activityErr)
            }

            // Send Notification
            try {
                await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress: account,
                        chainId: chainId,
                        type: 'CARD_STACK_CREATED',
                        title: '🎉 Card Stack Created!',
                        message: `Your ${selectedToken.symbol} stack with ${totalBudget}/day budget is now active.`,
                        metadata: { stackId: result.stack.id }
                    })
                })
            } catch (notifErr) {
                console.warn("Failed to send notification:", notifErr)
            }

            setTimeout(() => {
                onSuccess(result.stack)
            }, 1500)

        } catch (err: any) {
            console.error("Stack creation failed:", err)
            setErrorMsg(err.message || "Failed to create stack")
            setStep("error")
        }
    }

    return (
        <>
            {/* Backdrop */}
            <motion.div
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onClick={onClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Slide-in Panel */}
            <motion.div
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border z-50 overflow-y-auto pb-24 md:pb-0"
            >
                <AnimatePresence mode="wait">
                    {step === "config" && (
                        <ConfigStep
                            key="config"
                            onClose={onClose}
                            selectedToken={selectedToken}
                            onTokenClick={() => setTokenModalOpen(true)}
                            totalBudget={totalBudget}
                            setTotalBudget={setTotalBudget}
                            duration={duration}
                            setDuration={setDuration}
                            periodDuration={periodDuration}
                            setPeriodDuration={setPeriodDuration}
                            onSubmit={handleCreateStack}
                        />
                    )}
                    {step === "signing" && (
                        <SigningStep msg={loadingMsg} />
                    )}
                    {step === "error" && (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                            <div className="p-4 rounded-full bg-red-500/10 text-red-500 mb-4">
                                <X className="w-8 h-8" />
                            </div>
                            <h3 className="font-bold text-lg mb-2">Creation Failed</h3>
                            <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
                            <button onClick={() => setStep("config")} className="px-4 py-2 bg-secondary rounded-lg text-sm cursor-pointer hover:bg-secondary/80 transition-colors">
                                Try Again
                            </button>
                        </div>
                    )}
                    {step === "success" && (
                        <SuccessStep
                            key="success"
                            selectedToken={selectedToken}
                            totalBudget={totalBudget}
                            onClose={onSuccess}
                        />
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Token Selector Modal */}
            <TokenSelectorModal
                isOpen={tokenModalOpen}
                onClose={() => setTokenModalOpen(false)}
                onSelectToken={handleTokenSelect}
                selectedToken={selectedToken.symbol}
            />


        </>
    )
}

// ============================================
// CONFIG STEP
// ============================================

interface ConfigStepProps {
    onClose: () => void
    selectedToken: TokenInfo
    onTokenClick: () => void
    totalBudget: number
    setTotalBudget: (v: number) => void
    duration: number
    setDuration: (v: number) => void
    periodDuration: number
    setPeriodDuration: (v: number) => void
    onSubmit: () => void
}

function ConfigStep({
    onClose,
    selectedToken,
    onTokenClick,
    totalBudget,
    setTotalBudget,
    duration,
    setDuration,
    periodDuration,
    setPeriodDuration,
    onSubmit,
}: ConfigStepProps) {
    const { price } = useTokenPrice(selectedToken.address, 143)
    const usdValue = price ? totalBudget * price : null

    // Period options with clear labels
    const periodOptions = [
        { value: 3600, label: "Hourly", shortLabel: "hour", icon: "⏰" },
        { value: 86400, label: "Daily", shortLabel: "day", icon: "📅" },
        { value: 604800, label: "Weekly", shortLabel: "week", icon: "📆" },
        { value: 2592000, label: "Monthly", shortLabel: "month", icon: "🗓️" },
    ]
    const selectedPeriod = periodOptions.find(p => p.value === periodDuration) || periodOptions[1]

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-base font-semibold text-foreground">Create Card Stack</h2>
                        <p className="text-xs text-muted-foreground">Configure your budget allocation</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 space-y-6 overflow-y-auto">
                {/* Budget & Duration */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
                    {/* Token Selector */}
                    <div>
                        <label className="text-xs font-medium text-foreground mb-2 block">Budget Token</label>
                        <button
                            onClick={onTokenClick}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border hover:border-primary/30 transition-colors cursor-pointer"
                        >
                            <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-5 h-5 rounded-full" />
                            <span className="text-sm font-medium text-foreground">{selectedToken.symbol}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Budget Slider */}
                    <div className="pt-3 border-t border-border">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-medium text-foreground">
                                Budget per {selectedPeriod.shortLabel}
                            </label>
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1.5">
                                    <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-4 h-4 rounded-full" />
                                    <span className="text-sm font-bold text-primary">{totalBudget} {selectedToken.symbol}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                    {formatUsdValue(usdValue)}
                                </span>
                            </div>
                        </div>
                        <input
                            type="range"
                            min={10}
                            max={1000}
                            step={10}
                            value={totalBudget}
                            onChange={(e) => setTotalBudget(Number(e.target.value))}
                            className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>10 {selectedToken.symbol}</span>
                            <span>1,000 {selectedToken.symbol}</span>
                        </div>
                    </div>

                    {/* Reset Period Selector - Creative UI */}
                    <div className="pt-3 border-t border-border">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-medium text-foreground">Budget Resets</label>
                            <span className="text-xs text-muted-foreground">Every {selectedPeriod.label.toLowerCase()}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {periodOptions.map((period) => (
                                <button
                                    key={period.value}
                                    onClick={() => setPeriodDuration(period.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                                        periodDuration === period.value
                                            ? "bg-primary/10 border-2 border-primary text-primary shadow-sm"
                                            : "bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                                    )}
                                >
                                    <span className="text-base">{period.icon}</span>
                                    <span>{period.label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 text-center">
                            Allowance of {totalBudget} {selectedToken.symbol} resets every {selectedPeriod.shortLabel}
                        </p>
                    </div>

                    {/* Permission Duration */}
                    <div className="pt-3 border-t border-border">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-medium text-foreground">Permission Valid For</label>
                            <span className="text-sm font-bold text-foreground">{duration} days</span>
                        </div>
                        <div className="flex gap-2">
                            {[7, 14, 30, 90].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDuration(d)}
                                    className={cn(
                                        "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                                        duration === d
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                            <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Ready to allocate your budget?</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                After creating this vault, you'll be able to add trading strategies
                                like DCA bots and limit orders.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer CTA */}
            <div className="p-4 border-t border-border bg-background">
                <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onSubmit}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
                >
                    <Shield className="w-4 h-4" />
                    Create Investment Vault
                </motion.button>
                <p className="text-center text-[10px] text-muted-foreground mt-2">
                    You'll sign one permission to authorize this budget
                </p>
            </div>
        </motion.div>
    )
}

// ============================================
// SIGNING STEP
// ============================================

function SigningStep({ msg }: { msg?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center p-8"
        >
            <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-primary" />
                </div>
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">Processing</h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
                {msg || "Please sign the transaction in your wallet..."}
            </p>
        </motion.div>
    )
}

// ============================================
// SUCCESS STEP
// ============================================

interface SuccessStepProps {
    selectedToken: TokenInfo
    totalBudget: number
    onClose: () => void
}

function SuccessStep({ selectedToken, totalBudget, onClose }: SuccessStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center p-8"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", damping: 15 }}
                className="p-5 rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/20 mb-6"
            >
                <Check className="w-10 h-10 text-emerald-500" />
            </motion.div>

            <h3 className="text-lg font-bold text-foreground mb-1">Investment Vault Created! 🎉</h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs mb-6">
                Your vault is ready with a
                <span className="inline-flex items-center gap-1 mx-1">
                    <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-4 h-4 rounded-full" />
                    <span className="font-medium text-foreground">{totalBudget} {selectedToken.symbol}</span>
                </span>
                budget. Add trading strategies to start automating!
            </p>

            {/* Next Steps Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full max-w-xs p-4 rounded-xl bg-primary/5 border border-primary/20 mb-8"
            >
                <p className="text-xs font-semibold text-foreground mb-2">Next Step:</p>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                        <Plus className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Add a <span className="font-medium text-foreground">DCA Bot</span> or other strategy to your vault.
                    </p>
                </div>
            </motion.div>

            <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full max-w-xs py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
            >
                Go to Dashboard
            </motion.button>
        </motion.div>
    )
}

// ============================================
// STACK CARD COMPONENT - AWARD WINNING DESIGN
// ============================================

// Sub-card tile animation variants
const subCardVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            delay: i * 0.08,
            type: "spring",
            stiffness: 300,
            damping: 24
        }
    }),
    hover: {
        y: -4,
        scale: 1.02,
        transition: { type: "spring", stiffness: 400, damping: 20 }
    },
    tap: { scale: 0.98 }
}

// Pulsing dot animation for active status
const pulseVariants: Variants = {
    pulse: {
        scale: [1, 1.3, 1],
        opacity: [1, 0.6, 1],
        transition: {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
        }
    }
}

// Progress bar segment animation
const progressSegmentVariants: Variants = {
    hidden: { scaleX: 0, originX: 0 },
    visible: (i: number) => ({
        scaleX: 1,
        transition: {
            delay: 0.3 + i * 0.15,
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1]
        }
    })
}

// ============================================
// ADD STRATEGY MODAL - Strategy Picker
// ============================================

interface AddStrategyModalProps {
    isOpen: boolean
    onClose: () => void
    stack: StackCardData
    onAddDCA: () => void
    onAddLimit: () => void
    onAddSubscription: () => void
}

function AddStrategyModal({ isOpen, onClose, stack, onAddDCA, onAddLimit, onAddSubscription }: AddStrategyModalProps) {
    const [searchQuery, setSearchQuery] = useState('')

    if (!isOpen) return null

    const strategyOptions = [
        {
            id: 'dca',
            name: 'DCA Bot',
            description: 'Dollar-cost average into any token automatically',
            icon: RefreshCw,
            color: 'blue',
            available: true,
            action: onAddDCA,
            tags: ['automation', 'recurring', 'buy']
        },
        {
            id: 'limit',
            name: 'Limit Order',
            description: 'Buy at a specific price automatically',
            icon: BarChart3,
            color: 'amber',
            available: true,
            action: onAddLimit,
            tags: ['price', 'target', 'buy', 'sell']
        },
        {
            id: 'subscription',
            name: 'Recurring Payment',
            description: 'Auto-pay bills, rent, or salaries',
            icon: Calendar, // Ensure Calendar is imported or use lucide-react generic
            color: 'emerald', // Using emerald color class key
            available: true,
            action: onAddSubscription,
            tags: ['pay', 'bill', 'rent', 'salary', 'transfer']
        },
        {
            id: 'trailing',
            name: 'Trailing Stop',
            description: 'Sell if price drops by a percentage',
            icon: TrendingUp,
            color: 'green',
            available: false,
            action: () => { },
            tags: ['sell', 'protect', 'exit']
        },
        {
            id: 'grid',
            name: 'Grid Trading',
            description: 'Profit from price fluctuations',
            icon: Zap,
            color: 'purple',
            available: false,
            action: () => { },
            tags: ['range', 'volatility', 'profit']
        },
        {
            id: 'rebalance',
            name: 'Portfolio Rebalance',
            description: 'Maintain target allocations automatically',
            icon: PieChart,
            color: 'rose',
            available: false,
            action: () => { },
            tags: ['allocation', 'balance', 'portfolio']
        },
        {
            id: 'snipe',
            name: 'Token Sniper',
            description: 'Buy new tokens instantly on listing',
            icon: Activity,
            color: 'orange',
            available: false,
            action: () => { },
            tags: ['new', 'listing', 'fast']
        }
    ]

    // Filter strategies based on search query
    const filteredStrategies = strategyOptions.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
        orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    }

    return (
        <>
            {/* Backdrop - hidden on mobile */}
            <motion.div
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onClick={onClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden md:block"
            />

            {/* Full Screen on Mobile, Centered Modal on Desktop */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:max-w-md md:max-h-[80vh] bg-background md:border md:border-border md:rounded-2xl z-50 overflow-hidden shadow-xl flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer md:hidden"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Add Strategy</h2>
                            <p className="text-xs text-muted-foreground">Automate your {stack.token.symbol} trading</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer hidden md:block"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-border shrink-0">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search strategies..."
                            className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-background transition-colors"
                        />
                        <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Strategy Options - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredStrategies.length > 0 ? (
                        filteredStrategies.map((strategy) => {
                            const Icon = strategy.icon
                            return (
                                <motion.button
                                    key={strategy.id}
                                    whileHover={strategy.available ? { scale: 1.01 } : {}}
                                    whileTap={strategy.available ? { scale: 0.99 } : {}}
                                    onClick={strategy.available ? strategy.action : undefined}
                                    disabled={!strategy.available}
                                    className={`w-full p-4 rounded-xl border text-left transition-colors flex items-start gap-3 ${strategy.available
                                        ? 'border-border hover:border-primary/50 cursor-pointer bg-card'
                                        : 'border-border/50 opacity-60 cursor-not-allowed bg-muted/20'
                                        }`}
                                >
                                    <div className={`p-2.5 rounded-lg ${colorClasses[strategy.color]}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold">{strategy.name}</span>
                                            {!strategy.available && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                                                    Coming Soon
                                                </span>
                                            )}
                                            {strategy.available && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium shrink-0">
                                                    Available
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{strategy.description}</p>
                                    </div>
                                    {strategy.available && <ChevronRight className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />}
                                </motion.button>
                            )
                        })
                    ) : (
                        <div className="text-center py-8">
                            <div className="p-3 rounded-full bg-muted/50 inline-block mb-3">
                                <Activity className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">No strategies found for "{searchQuery}"</p>
                        </div>
                    )}
                </div>

                {/* Available Count Footer */}
                <div className="p-3 border-t border-border text-center shrink-0 bg-muted/20">
                    <p className="text-xs text-muted-foreground">
                        {strategyOptions.filter(s => s.available).length} available • {strategyOptions.filter(s => !s.available).length} coming soon
                    </p>
                </div>
            </motion.div>
        </>
    )
}

// ============================================
// CONFIGURE STRATEGY MODAL
// ============================================

interface ConfigureStrategyModalProps {
    isOpen: boolean
    onClose: () => void
    stack: StackCardData
    subCard?: StackCardData['subCards'][0]
}

function ConfigureStrategyModal({ isOpen, onClose, stack, subCard }: ConfigureStrategyModalProps) {
    // Hydrate logo from store
    const availableChains = useAppStore((state) => state.availableChains)

    const [targetToken, setTargetToken] = useState<TokenInfo | null>(() => {
        if (!subCard?.config?.targetTokenSymbol) return null

        // Try to find the token in known lists to get the logo
        const chainId = stack.token.chainId
        const chain = availableChains.find(c => c.id === chainId)
        const found = chain?.tokens?.find(t => t.symbol === subCard.config!.targetTokenSymbol)

        return {
            symbol: subCard.config.targetTokenSymbol,
            address: (subCard.config.targetTokenAddress || '0x0') as `0x${string}`,
            decimals: subCard.config.targetTokenDecimals || 18,
            logoURI: found?.logoURI || '', // Use found logo or empty
            name: subCard.config.targetTokenSymbol
        } as TokenInfo
    })

    const [amountPerExec, setAmountPerExec] = useState(subCard?.config?.amountPerExecution || '')
    const [dailyLimit, setDailyLimit] = useState(subCard?.config?.dailyLimit || '')
    const [isSaving, setIsSaving] = useState(false)
    const [showTokenModal, setShowTokenModal] = useState(false)

    // Calculate remaining budget from Master Vault
    const vaultTotalDaily = stack.totalBudget
    const otherStrategiesAllocation = stack.subCards
        .filter(s => s.id !== subCard?.id) // Exclude current if editing
        .reduce((sum, s) => {
            // Heuristic: If dailyLimit is set, use it.
            // If not (legacy bot), assumes at least 1 execution per day is reserved.
            const limit = s.config?.dailyLimit
                ? parseFloat(s.config.dailyLimit)
                : (s.config?.amountPerExecution ? parseFloat(s.config.amountPerExecution) : 0)
            return sum + limit
        }, 0)

    const maxAllowedDaily = Math.max(0, vaultTotalDaily - otherStrategiesAllocation)

    // Validations
    const amountVal = parseFloat(amountPerExec || '0')
    const limitVal = parseFloat(dailyLimit || '0')
    const currentAllocation = limitVal // The value effectively reserved by THIS strategy

    const isAmountTooHigh = amountVal > limitVal && limitVal > 0
    const isLimitTooHigh = limitVal > maxAllowedDaily
    const isValid = targetToken && amountVal > 0 && limitVal > 0 && !isAmountTooHigh && !isLimitTooHigh

    // Projected Utilization (Other + Current)
    const projectedUtilization = Math.min(100, ((otherStrategiesAllocation + limitVal) / vaultTotalDaily) * 100)

    const handleTokenSelect = (token: TokenInfo) => {
        if (token.symbol === stack.token.symbol) {
            toast.error("Invalid Selection", "Target token cannot be the same as source token.")
            return
        }
        setTargetToken(token)
        setShowTokenModal(false)
    }

    const handleSave = async () => {
        if (!isValid) return

        setIsSaving(true)
        try {
            const res = await fetch('/api/card-stacks/configure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stackId: stack.id,
                    subCardId: subCard?.id,
                    targetTokenAddress: targetToken.address,
                    targetTokenSymbol: targetToken.symbol,
                    targetTokenDecimals: targetToken.decimals,
                    amountPerExecution: amountPerExec,
                    dailyLimit: dailyLimit, // Sending dailyLimit to API
                })
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Strategy Saved", `DCA Bot will now buy ${targetToken!.symbol}`)
                onClose()
                // Refresh the page to get updated data
                window.location.reload()
            } else {
                throw new Error(data.error || "Failed to save")
            }
        } catch (err: any) {
            toast.error("Save Failed", err.message)
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <motion.div
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onClick={onClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Slide-in Panel */}
            <motion.div
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border z-50 overflow-y-auto pb-32"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-base font-semibold text-foreground">Configure DCA Bot</h2>
                            <p className="text-xs text-muted-foreground">Set up automatic recurring buys</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                    {/* Source Token (Info Only) */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border">
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Source Token (From Vault)</label>
                        <div className="flex items-center gap-2">
                            <img src={stack.token.logoURI} alt={stack.token.symbol} className="w-6 h-6 rounded-full" />
                            <span className="text-sm font-semibold text-foreground">{stack.token.symbol}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{stack.totalBudget} / day budget</span>
                        </div>
                        {/* Utilization Bar */}
                        <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Vault Utilization</span>
                                <span>{projectedUtilization.toFixed(0)}% Used</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-muted-foreground/30 transition-all duration-300"
                                    style={{ width: `${projectedUtilization}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Target Token */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                        <label className="text-xs font-medium text-foreground block">Buy Token (Target)</label>
                        <button
                            onClick={() => setShowTokenModal(true)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                {targetToken ? (
                                    <>
                                        <img src={targetToken.logoURI || 'https://via.placeholder.com/24'} alt={targetToken.symbol} className="w-5 h-5 rounded-full" />
                                        <span className="text-sm font-semibold text-foreground">{targetToken.symbol}</span>
                                    </>
                                ) : (
                                    <span className="text-sm text-muted-foreground">Select token to buy...</span>
                                )}
                            </div>
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Daily Allocation Limit */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-foreground block">Daily Allocation Limit</label>
                            <span className="text-[10px] text-muted-foreground">Max available: {maxAllowedDaily} {stack.token.symbol}</span>
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={dailyLimit}
                                onChange={(e) => setDailyLimit(e.target.value)}
                                className={`w-full h-11 pl-4 pr-16 rounded-lg bg-background border text-sm font-semibold focus:outline-none ${isLimitTooHigh ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary/50'
                                    }`}
                                placeholder={maxAllowedDaily.toString()}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                {stack.token.symbol} / day
                            </span>
                        </div>
                        {isLimitTooHigh && (
                            <p className="text-[10px] text-red-500 font-medium">
                                Exceeds remaining vault budget of {maxAllowedDaily} {stack.token.symbol}
                            </p>
                        )}
                        {!isLimitTooHigh && (
                            <p className="text-[10px] text-muted-foreground">
                                Max budget this bot can spend per day
                            </p>
                        )}
                    </div>

                    {/* Amount per Execution */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                        <label className="text-xs font-medium text-foreground block">Amount per Trigger</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={amountPerExec}
                                onChange={(e) => setAmountPerExec(e.target.value)}
                                className={`w-full h-11 pl-4 pr-16 rounded-lg bg-background border text-sm font-semibold focus:outline-none ${isAmountTooHigh ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary/50'
                                    }`}
                                placeholder="1"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                {stack.token.symbol}
                            </span>
                        </div>
                        {isAmountTooHigh && (
                            <p className="text-[10px] text-red-500 font-medium">
                                Cannot exceed daily limit of {dailyLimit} {stack.token.symbol}
                            </p>
                        )}
                        {!isAmountTooHigh && (
                            <p className="text-[10px] text-muted-foreground">
                                Each trigger will swap {amountPerExec} {stack.token.symbol} → {targetToken?.symbol || '???'}
                            </p>
                        )}
                    </div>

                    {/* Summary */}
                    {targetToken && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-xl bg-primary/5 border border-primary/20"
                        >
                            <p className="text-xs font-semibold text-foreground mb-2">Strategy Summary</p>
                            <div className="flex items-center gap-2 text-sm">
                                <img src={stack.token.logoURI} alt={stack.token.symbol} className="w-5 h-5 rounded-full" />
                                <span className="font-semibold">{amountPerExec} {stack.token.symbol}</span>
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                <img src={targetToken.logoURI || 'https://via.placeholder.com/24'} alt={targetToken.symbol} className="w-5 h-5 rounded-full" />
                                <span className="font-semibold">{targetToken.symbol}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Automatic swap on each trigger
                            </p>
                        </motion.div>
                    )}
                </div>

                {/* Footer CTA */}
                <div className="p-4 border-t border-border bg-background">
                    <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSave}
                        disabled={isSaving || !targetToken}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {isSaving ? "Saving..." : "Save Strategy"}
                    </motion.button>
                </div>
            </motion.div>

            {/* Token Selector Modal */}
            <TokenSelectorModal
                isOpen={showTokenModal}
                onClose={() => setShowTokenModal(false)}
                onSelectToken={handleTokenSelect}
                selectedToken={targetToken?.symbol || ""}
            />
        </>
    )
}

// ============================================
// CONFIGURE SUBSCRIPTION MODAL
// ============================================

interface ConfigureSubscriptionModalProps {
    isOpen: boolean
    onClose: () => void
    stack: StackCardData
    onSuccess?: () => void
}

// ============================================
// CONFIGURE SUBSCRIPTION MODAL (REDESIGN)
// ============================================

interface ConfigureSubscriptionModalProps {
    isOpen: boolean
    onClose: () => void
    stack: StackCardData
    onSuccess?: () => void
}

function ConfigureSubscriptionModal({ isOpen, onClose, stack, onSuccess }: ConfigureSubscriptionModalProps) {
    // Steps: 'IDENTITY' | 'DETAILS' | 'REVIEW'
    const [step, setStep] = useState<'IDENTITY' | 'DETAILS' | 'REVIEW'>('IDENTITY')
    const [isSaving, setIsSaving] = useState(false)

    // Form State
    const [recipient, setRecipient] = useState("")
    const [label, setLabel] = useState("") // e.g. Netflix
    const [amount, setAmount] = useState("")
    const [frequency, setFrequency] = useState<'WEEKLY' | 'MONTHLY'>('MONTHLY')
    const [paymentDay, setPaymentDay] = useState<number>(1) // 1st, 15th, or last day (31)

    // Derived
    const maxAllowedDaily = stack.totalBudget
    const isAmountTooHigh = Number(amount) > maxAllowedDaily

    // Calculate Next Payment Date based on frequency and paymentDay
    const calculateNextPaymentDate = (): Date => {
        const today = new Date()
        const nextDate = new Date()

        if (frequency === 'MONTHLY') {
            // For monthly: set to the selected day of the current or next month
            nextDate.setDate(paymentDay)
            // If the day has passed this month, move to next month
            if (nextDate <= today) {
                nextDate.setMonth(nextDate.getMonth() + 1)
            }
            // Handle months with fewer days (e.g., Feb 30 -> Feb 28)
            if (paymentDay > 28 && nextDate.getDate() !== paymentDay) {
                nextDate.setDate(0) // Last day of previous month
            }
        } else {
            // For weekly: find the next occurrence of the day of week (0=Sun, 1=Mon, etc.)
            const daysUntilNext = (paymentDay - today.getDay() + 7) % 7 || 7
            nextDate.setDate(today.getDate() + daysUntilNext)
        }

        return nextDate
    }

    const nextPaymentDate = calculateNextPaymentDate()

    const handleNext = () => {
        if (step === 'IDENTITY') setStep('DETAILS')
        else if (step === 'DETAILS') setStep('REVIEW')
    }

    const handleBack = () => {
        if (step === 'DETAILS') setStep('IDENTITY')
        else if (step === 'REVIEW') setStep('DETAILS')
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch('/api/card-stacks/configure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardStackId: stack.id,
                    chainId: stack.token.chainId,
                    type: 'SUBSCRIPTION',
                    name: `Auto-Pay ${label}`,
                    color: 'emerald',
                    allocationPercent: 0,
                    config: {
                        targetTokenSymbol: stack.token.symbol,
                        targetTokenAddress: stack.token.address,
                        recipient: recipient,
                        label: label,
                        frequency: frequency,
                        paymentDay: paymentDay,
                        nextPaymentDate: nextPaymentDate.toISOString(),
                        dailyLimit: amount,
                        action: 'TRANSFER'
                    }
                })
            })

            const data = await res.json()
            if (data.success) {
                toast.success("Subscription Active", `Auto-paying ${label} ${amount} ${stack.token.symbol} ${frequency.toLowerCase()}`)
                onClose()
                if (onSuccess) onSuccess()
            } else {
                toast.error("Failed", data.error || "Could not create subscription")
            }
        } catch (error: any) {
            toast.error("Error", error.message)
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-background/80 backdrop-blur-md"
        >
            <div className="absolute inset-0" onClick={onClose} />
            <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {step !== 'IDENTITY' && (
                            <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors cursor-pointer">
                                <ChevronLeft className="w-5 h-5 text-foreground cursor-pointer" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-lg font-bold text-foreground tracking-tight">New Subscription</h2>
                            <p className="text-xs text-muted-foreground font-medium">Step {step === 'IDENTITY' ? 1 : step === 'DETAILS' ? 2 : 3} of 3</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors cursor-pointer">
                        <X className="w-5 h-5 text-muted-foreground cursor-pointer" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                    <AnimatePresence mode="wait">
                        {step === 'IDENTITY' ? (
                            <motion.div
                                key="identity"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-foreground">Who are you paying?</h3>
                                    <p className="text-sm text-muted-foreground">Set up the recipient details.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service Name</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={label}
                                                onChange={(e) => setLabel(e.target.value)}
                                                placeholder="e.g. Netflix"
                                                className="w-full bg-muted/50 border border-border rounded-xl px-4 pl-10 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 transition-colors"
                                                autoFocus
                                            />
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                <div className="w-4 h-4 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                                                    {label ? label[0].toUpperCase() : "?"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recipient Address</label>
                                        <div className="relative">
                                            <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="text"
                                                value={recipient}
                                                onChange={(e) => setRecipient(e.target.value)}
                                                placeholder="0x... or name.eth"
                                                className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : step === 'DETAILS' ? (
                            <motion.div
                                key="details"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-foreground">Payment Details</h3>
                                    <p className="text-sm text-muted-foreground">How much and how often?</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</label>
                                            <span className="text-xs text-muted-foreground">Max: {maxAllowedDaily} {stack.token.symbol}</span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full bg-muted/50 border border-border rounded-xl px-4 pl-4 pr-16 py-4 text-2xl font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 transition-colors"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                <img src={stack.token.logoURI} className="w-6 h-6 rounded-full" />
                                                <span className="text-sm font-bold text-muted-foreground">{stack.token.symbol}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Frequency</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {['WEEKLY', 'MONTHLY'].map((f) => (
                                                <button
                                                    key={f}
                                                    onClick={() => {
                                                        setFrequency(f as any)
                                                        // Reset paymentDay to sensible default when frequency changes
                                                        setPaymentDay(f === 'WEEKLY' ? 1 : 1) // Monday for weekly, 1st for monthly
                                                    }}
                                                    className={`p-4 rounded-xl border text-sm font-bold transition-all cursor-pointer flex flex-col items-center gap-2 ${frequency === f
                                                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-muted border-border text-muted-foreground hover:border-primary/50'
                                                        }`}
                                                >
                                                    <span className="text-lg">{f === 'WEEKLY' ? '📅' : '📆'}</span>
                                                    {f === 'WEEKLY' ? 'Weekly' : 'Monthly'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Payment Day Selector */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            {frequency === 'MONTHLY' ? 'Payment Date' : 'Payment Day'}
                                        </label>

                                        {frequency === 'MONTHLY' ? (
                                            <div className="space-y-3">
                                                {/* Quick Select Pills */}
                                                <div className="flex gap-2">
                                                    {[
                                                        { value: 1, label: '1st' },
                                                        { value: 15, label: '15th' },
                                                        { value: 28, label: 'Last' }
                                                    ].map(({ value, label: dayLabel }) => (
                                                        <button
                                                            key={value}
                                                            onClick={() => setPaymentDay(value)}
                                                            className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-bold transition-all cursor-pointer ${paymentDay === value
                                                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                                                : 'bg-muted border-border text-muted-foreground hover:border-primary/50'
                                                                }`}
                                                        >
                                                            {dayLabel}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Horizontal Scroll for All Days */}
                                                <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mx-1 px-1">
                                                    <div className="flex gap-1.5 min-w-max">
                                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                                            <button
                                                                key={day}
                                                                onClick={() => setPaymentDay(day)}
                                                                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${paymentDay === day
                                                                    ? 'bg-emerald-500 text-white'
                                                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                                                    }`}
                                                            >
                                                                {day}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            // Weekly: Show Mon-Sun
                                            <div className="grid grid-cols-7 gap-1.5">
                                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => setPaymentDay(index + 1)}
                                                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${paymentDay === index + 1
                                                            ? 'bg-emerald-500 text-white'
                                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                            }`}
                                                    >
                                                        {day}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Preview next payment date */}
                                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                            <CalendarCheck className="w-4 h-4 text-emerald-500" />
                                            <span className="text-xs font-medium text-foreground">
                                                First payment: <strong>{nextPaymentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="review"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex flex-col items-center py-4">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border border-border z-10 relative overflow-hidden">
                                            <img
                                                src={`https://img.logo.dev/${label.toLowerCase().trim().replace(/\s+/g, '')}.com?token=pk_123`}
                                                onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/64?text=?")}
                                                className="w-full h-full object-cover"
                                                alt="Service"
                                            />
                                        </div>
                                        {/* Pulse Effect */}
                                        <motion.div
                                            className="absolute inset-0 rounded-full bg-emerald-500/30 -z-10"
                                            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        />
                                    </div>
                                    <h3 className="text-2xl font-bold text-foreground mt-4">{label}</h3>
                                    <p className="text-sm text-muted-foreground">Subscription</p>
                                </div>

                                <div className="bg-muted/30 rounded-2xl border border-border p-5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Amount</span>
                                        <span className="text-lg font-bold text-foreground">{amount} {stack.token.symbol}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Frequency</span>
                                        <span className="text-sm font-bold text-foreground capitalize">{frequency.toLowerCase()}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-4 border-t border-border">
                                        <span className="text-sm text-muted-foreground">Next Pay</span>
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{nextPaymentDate.toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-card flex-shrink-0">
                    {step === 'REVIEW' ? (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-4 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                            {isSaving ? "Activating..." : "Confirm Subscription"}
                        </motion.button>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleNext}
                            disabled={step === 'IDENTITY' ? (!label || !recipient) : (!amount)}
                            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            Next Step <ArrowRight className="w-4 h-4" />
                        </motion.button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}

// ============================================
// STACK MANAGEMENT MODAL
// ============================================

interface StackManagementModalProps {
    isOpen: boolean
    onClose: () => void
    stack: StackCardData
    onSuccess: () => void
}

function StackManagementModal({ isOpen, onClose, stack, onSuccess }: StackManagementModalProps) {
    const [view, setView] = useState<'MENU' | 'EDIT' | 'SIGNING' | 'SUCCESS'>('MENU')
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [statusMsg, setStatusMsg] = useState("")
    const [newBudget, setNewBudget] = useState(stack.totalBudget.toString())
    const [newPeriod, setNewPeriod] = useState(stack.periodDuration)

    useEffect(() => {
        if (isOpen) {
            setView('MENU')
            setConfirmDelete(false)
            setNewBudget(stack.totalBudget.toString())
            setNewPeriod(stack.periodDuration)
        }
    }, [isOpen, stack])

    if (!isOpen) return null

    const periods = [{ label: 'Daily', value: 86400 }, { label: 'Weekly', value: 604800 }, { label: 'Monthly', value: 2592000 }]

    const handleUpdate = async () => {
        setIsLoading(true)
        setView('SIGNING')
        setStatusMsg("Initializing wallet...")
        try {
            if (!window.ethereum) throw new Error("Wallet not found")
            const chainId = stack.token.chainId
            const walletClient = createWalletClient({ chain: getViemChain(chainId), transport: custom(window.ethereum as any) }).extend(erc7715ProviderActions())

            setStatusMsg("Requesting account access...")
            const [account] = await walletClient.requestAddresses()
            setStatusMsg("Switching chain...")
            try { await walletClient.switchChain({ id: chainId }) } catch (e) { }

            setStatusMsg("Configuring session...")
            const agentRes = await fetch(`/api/smart-cards/agent-address?chainId=${chainId}`)
            const agentData = await agentRes.json()
            if (!agentData.success || !agentData.agentSmartAccountAddress) throw new Error("Failed to get Agent Address")
            const sessionAccountAddress = agentData.agentSmartAccountAddress as `0x${string}`

            const expiry = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
            const periodAmount = parseUnits(newBudget, stack.token.decimals)
            const periodLabel = periods.find(p => p.value === newPeriod)?.label.toLowerCase() || "period"

            setStatusMsg("Please sign the update in MetaMask...")
            const grantedPermissions = await walletClient.requestExecutionPermissions([{
                chainId: chainId, expiry,
                signer: { type: "account", data: { address: sessionAccountAddress } },
                permission: {
                    type: "erc20-token-periodic",
                    data: {
                        tokenAddress: stack.token.address as `0x${string}`,
                        periodAmount, periodDuration: newPeriod,
                        justification: `Update Stack: ${newBudget} ${stack.token.symbol}/${periodLabel}`
                    }
                },
                isAdjustmentAllowed: true
            }])
            const permission = grantedPermissions[0]
            if (!permission?.context) throw new Error("Permission denied")

            setStatusMsg("Saving changes...")
            const updateRes = await fetch('/api/card-stacks/update', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stackId: stack.id, totalBudget: parseFloat(newBudget), periodDuration: newPeriod, permissionsContext: permission.context })
            })
            const updateData = await updateRes.json()
            if (!updateData.success) throw new Error(updateData.error)

            setView('SUCCESS')
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error(error)
            toast.error("Update Failed", error.message)
            setView('EDIT')
        } finally { setIsLoading(false) }
    }

    const handleDelete = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/card-stacks/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stackId: stack.id }) })
            const data = await res.json()
            if (data.success) {
                toast.success('Stack Deleted', 'Stack removed successfully')
                setConfirmDelete(false)
                onClose()
                if (onSuccess) onSuccess()
            } else { toast.error('Failed', data.error) }
        } catch (error: any) { toast.error('Error', error.message) } finally { setIsLoading(false) }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-background/80 backdrop-blur-md"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full sm:max-w-md bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {confirmDelete ? (
                            <div className="p-6">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                                        <Trash2 className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-bold">Delete Stack?</h3>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        This will permanently remove <strong>{stack.name}</strong> and all its active strategies. This action cannot be undone.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        className="flex-1 px-4 py-3 rounded-xl font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={isLoading}
                                        className="flex-1 px-4 py-3 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Stack"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                                            {stack.token.logoURI ? (
                                                <img src={stack.token.logoURI} alt="" className="w-6 h-6" />
                                            ) : (
                                                <Zap className="w-5 h-5 text-primary" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground">{stack.name}</h3>
                                            <p className="text-xs text-muted-foreground">{getChainById(stack.token.chainId)?.name}</p>
                                        </div>
                                    </div>
                                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stack Settings</h4>

                                    {/* Edit Budget (Disabled) */}
                                    <div className="group flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20 opacity-60 cursor-not-allowed">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                <Wallet className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-sm">Transfer Limit</div>
                                                <div className="text-xs text-muted-foreground">Change budget or period</div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-medium px-2 py-1 rounded bg-secondary text-muted-foreground">Soon</span>
                                    </div>

                                    {/* Delete Stack (Active) */}
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="w-full group flex items-center justify-between p-4 rounded-xl border border-red-200/50 bg-red-50/50 hover:bg-red-100/50 hover:border-red-200 dark:bg-red-900/10 dark:hover:bg-red-900/20 dark:border-red-900/30 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                                <Trash2 className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-sm text-red-700 dark:text-red-400">Delete Stack</div>
                                                <div className="text-xs text-red-600/70 dark:text-red-400/70">Remove stack and strategies</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-red-400/50 group-hover:text-red-500 transition-colors" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

function StackManagementModalUpdated({ isOpen, onClose, stack, onSuccess }: StackManagementModalProps) {
    const [view, setView] = useState<'MENU' | 'EDIT' | 'SIGNING' | 'SUCCESS'>('MENU')
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [statusMsg, setStatusMsg] = useState("")
    const [newBudget, setNewBudget] = useState(stack.totalBudget.toString())
    const [newPeriod, setNewPeriod] = useState(stack.periodDuration)

    useEffect(() => {
        if (isOpen) {
            setView('MENU')
            setConfirmDelete(false)
            setNewBudget(stack.totalBudget.toString())
            setNewPeriod(stack.periodDuration)
        }
    }, [isOpen, stack])

    if (!isOpen) return null

    const periods = [
        { label: 'Daily', value: 86400 },
        { label: 'Weekly', value: 604800 },
        { label: 'Monthly', value: 2592000 },
    ]

    const handleUpdate = async () => {
        setIsLoading(true)
        setView('SIGNING')
        setStatusMsg("Initializing wallet...")

        try {
            if (!window.ethereum) throw new Error("Wallet not found")
            const chainId = stack.token.chainId

            const walletClient = createWalletClient({
                chain: getViemChain(chainId),
                transport: custom(window.ethereum as any)
            }).extend(erc7715ProviderActions())

            setStatusMsg("Requesting account access...")
            const [account] = await walletClient.requestAddresses()

            setStatusMsg("Switching chain...")
            try {
                await walletClient.switchChain({ id: chainId })
            } catch (e) {
                // Ignore if already on chain
            }

            // Fetch Agent Address
            setStatusMsg("Configuring session...")
            const agentRes = await fetch(`/api/smart-cards/agent-address?chainId=${chainId}`)
            const agentData = await agentRes.json()
            if (!agentData.success || !agentData.agentSmartAccountAddress) {
                throw new Error("Failed to get Agent Address")
            }
            const sessionAccountAddress = agentData.agentSmartAccountAddress as `0x${string}`

            // Request Permissions
            const expiry = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days
            const periodAmount = parseUnits(newBudget, stack.token.decimals)
            const tokenAddress = stack.token.address
            const periodLabel = periods.find(p => p.value === newPeriod)?.label.toLowerCase() || "period"

            setStatusMsg("Please sign the update in MetaMask...")

            const grantedPermissions = await walletClient.requestExecutionPermissions([{
                chainId: chainId,
                expiry,
                signer: {
                    type: "account",
                    data: { address: sessionAccountAddress }
                },
                permission: {
                    type: "erc20-token-periodic",
                    data: {
                        tokenAddress: tokenAddress as `0x${string}`,
                        periodAmount,
                        periodDuration: newPeriod,
                        justification: `Update Stack: ${newBudget} ${stack.token.symbol}/${periodLabel}`
                    }
                },
                isAdjustmentAllowed: true
            }])

            const permission = grantedPermissions[0]
            if (!permission?.context) throw new Error("Permission denied or invalid")

            // Update Backend
            setStatusMsg("Saving changes...")
            const updateRes = await fetch('/api/card-stacks/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stackId: stack.id,
                    totalBudget: parseFloat(newBudget),
                    periodDuration: newPeriod,
                    permissionsContext: permission.context
                })
            })

            const updateData = await updateRes.json()
            if (!updateData.success) throw new Error(updateData.error)

            setView('SUCCESS')
            if (onSuccess) onSuccess()

        } catch (error: any) {
            console.error(error)
            toast.error("Update Failed", error.message)
            setView('EDIT') // Go back to EDIT on error
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/card-stacks/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stackId: stack.id })
            })
            const data = await res.json()
            if (data.success) {
                toast.success('Stack Deleted', 'Stack removed successfully')
                setConfirmDelete(false)
                onClose()
                if (onSuccess) onSuccess()
            } else {
                toast.error('Failed', data.error)
            }
        } catch (error: any) {
            toast.error('Error', error.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-background/80 backdrop-blur-md"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full sm:max-w-md bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <AnimatePresence mode="wait">
                            {view === 'MENU' && (
                                <motion.div key="menu" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    {confirmDelete ? (
                                        <div className="p-6">
                                            <div className="text-center mb-6">
                                                <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                                                    <Trash2 className="w-8 h-8" />
                                                </div>
                                                <h3 className="text-lg font-bold">Delete Stack?</h3>
                                                <p className="text-sm text-muted-foreground mt-2">
                                                    Permanently remove <strong>{stack.name}</strong> and all strategies?
                                                </p>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={() => setConfirmDelete(false)} className="flex-1 px-4 py-3 rounded-xl font-semibold bg-muted hover:bg-muted/80 transition-colors">Cancel</button>
                                                <button onClick={handleDelete} disabled={isLoading} className="flex-1 px-4 py-3 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2">
                                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Stack"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                                                        {stack.token.logoURI ? <img src={stack.token.logoURI} alt="" className="w-6 h-6" /> : <Zap className="w-5 h-5 text-primary" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-foreground">{stack.name}</h3>
                                                        <p className="text-xs text-muted-foreground">{getChainById(stack.token.chainId)?.name}</p>
                                                    </div>
                                                </div>
                                                <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground"><X className="w-5 h-5" /></button>
                                            </div>

                                            <div className="space-y-3">
                                                {/* Edit Budget */}
                                                <button
                                                    onClick={() => setView('EDIT')}
                                                    className="w-full group flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                            <Wallet className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-sm">Edit Budget & Period</div>
                                                            <div className="text-xs text-muted-foreground">Adjust limits and frequency</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                </button>

                                                {/* Delete Stack */}
                                                <button
                                                    onClick={() => setConfirmDelete(true)}
                                                    className="w-full group flex items-center justify-between p-4 rounded-xl border border-red-200/50 bg-red-50/10 hover:bg-red-100/30 hover:border-red-200 dark:bg-red-900/10 dark:hover:bg-red-900/20 dark:border-red-900/30 transition-all text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                                            <Trash2 className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-sm text-red-700 dark:text-red-400">Delete Stack</div>
                                                            <div className="text-xs text-red-600/70 dark:text-red-400/70">Remove stack and strategies</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-red-400/50 group-hover:text-red-500 transition-colors" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {view === 'EDIT' && (
                                <motion.div key="edit" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                                            <ChevronLeft className="w-4 h-4" /> Back
                                        </button>
                                        <h3 className="font-bold">Edit Stack</h3>
                                        <div className="w-8" />
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">New Budget Limit</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={newBudget}
                                                    onChange={e => setNewBudget(e.target.value)}
                                                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-4 text-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="0.00"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                                                    {stack.token.symbol}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Reset Period</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {periods.map(p => (
                                                    <button
                                                        key={p.value}
                                                        onClick={() => setNewPeriod(p.value)}
                                                        className={cn(
                                                            "py-3 rounded-xl text-sm font-medium border transition-all",
                                                            newPeriod === p.value
                                                                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                                                : "bg-background border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        {p.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleUpdate}
                                            disabled={isLoading || !newBudget || parseFloat(newBudget) <= 0}
                                            className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold mt-4 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Stack"}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {view === 'SIGNING' && (
                                <motion.div key="signing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
                                    <div className="relative mb-8">
                                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center relative z-10 shadow-xl">
                                            <Shield className="w-10 h-10 text-white" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Sign Request</h3>
                                    <p className="text-muted-foreground max-w-[200px] mx-auto animate-pulse">{statusMsg || "Please check your wallet..."}</p>
                                </motion.div>
                            )}

                            {view === 'SUCCESS' && (
                                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
                                    <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6">
                                        <Check className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-foreground">Stack Updated!</h3>
                                    <p className="text-muted-foreground mt-2">
                                        New Limit: {newBudget} {stack.token.symbol} / {periods.find(p => p.value === newPeriod)?.label}
                                    </p>
                                    <button onClick={onClose} className="mt-8 w-full py-4 bg-secondary text-secondary-foreground rounded-xl font-bold hover:bg-secondary/80 transition-colors">
                                        Done
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

// ============================================
// STRATEGY MANAGEMENT MODAL (AWARD-WINNING)
// ============================================

interface StrategyManagementModalProps {
    isOpen: boolean
    onClose: () => void
    stack: StackCardData
    strategy: StackCardData['subCards'][0]
    onSuccess?: () => void
}

function StrategyManagementModal({ isOpen, onClose, stack, strategy, onSuccess }: StrategyManagementModalProps) {
    const [confirmAction, setConfirmAction] = useState<'PAUSE' | 'RESUME' | 'DELETE' | 'SKIP' | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const config = strategy.config as any
    const isPaused = strategy.status === 'paused'

    // Determine Strategy Type
    const isSubscription = strategy.type === 'SUBSCRIPTION' || strategy.name?.includes("Auto-Pay")
    const isLimit = strategy.type === 'LIMIT_ORDER'
    const isDCA = !isSubscription && !isLimit

    // Label Logic
    let displayLabel = config?.label || strategy.name
    if (isSubscription && !config?.label) {
        if (strategy.name.startsWith("Auto-Pay ")) displayLabel = strategy.name.replace("Auto-Pay ", "")
        else if (config?.recipient) displayLabel = `${config.recipient.slice(0, 6)}...`
    } else if (isLimit) {
        displayLabel = "Limit Order"
    } else if (isDCA && !isSubscription) {
        displayLabel = "DCA Strategy"
    }

    const nextPaymentDate = (isSubscription && config?.nextPaymentDate) ? new Date(config.nextPaymentDate) : null

    // Calculate days until next payment (Subs only)
    const daysUntilPayment = nextPaymentDate
        ? Math.ceil((nextPaymentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null

    const handleAction = async (action: 'PAUSE' | 'RESUME' | 'DELETE' | 'SKIP') => {
        setIsLoading(true)
        try {
            const endpoint = action === 'DELETE'
                ? `/api/card-stacks/delete-subcard`
                : `/api/card-stacks/update-subcard`

            const body = action === 'DELETE'
                ? { subCardId: strategy.id }
                : {
                    subCardId: strategy.id,
                    status: action === 'PAUSE' ? 'PAUSED' : action === 'RESUME' ? 'ACTIVE' : undefined,
                    skipNext: action === 'SKIP' ? true : undefined
                }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            const data = await res.json()
            if (data.success) {
                const messages = {
                    PAUSE: { title: 'Strategy Paused', desc: `${displayLabel} won't execute` },
                    RESUME: { title: 'Strategy Active', desc: `${displayLabel} is running` },
                    DELETE: { title: 'Strategy Deleted', desc: `${displayLabel} removed` },
                    SKIP: { title: 'Run Skipped', desc: `Next ${displayLabel} run skipped` }
                }
                toast.success(messages[action].title, messages[action].desc)
                setConfirmAction(null)
                onClose()
                if (onSuccess) onSuccess()
            } else {
                toast.error('Action Failed', data.error || 'Please try again')
            }
        } catch (error: any) {
            toast.error('Error', error.message)
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-background/80 backdrop-blur-md"
        >
            <div className="absolute inset-0" onClick={onClose} />
            <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full sm:max-w-md bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <AnimatePresence mode="wait">
                    {confirmAction ? (
                        // Confirmation Dialog
                        <motion.div
                            key="confirm"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="p-6"
                        >
                            <div className="flex flex-col items-center text-center mb-6">
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", damping: 15, stiffness: 200 }}
                                    className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${confirmAction === 'DELETE' ? 'bg-red-100 dark:bg-red-900/30' :
                                        confirmAction === 'PAUSE' ? 'bg-amber-100 dark:bg-amber-900/30' :
                                            'bg-emerald-100 dark:bg-emerald-900/30'
                                        }`}
                                >
                                    {confirmAction === 'DELETE' && <Trash2 className="w-7 h-7 text-red-600 dark:text-red-400" />}
                                    {confirmAction === 'PAUSE' && <Ban className="w-7 h-7 text-amber-600 dark:text-amber-400" />}
                                    {confirmAction === 'RESUME' && <Play className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />}
                                    {confirmAction === 'SKIP' && <ArrowRight className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />}
                                </motion.div>

                                <h3 className="text-xl font-bold text-foreground mb-2">
                                    {confirmAction === 'DELETE' && 'Delete Strategy?'}
                                    {confirmAction === 'PAUSE' && 'Pause Strategy?'}
                                    {confirmAction === 'RESUME' && 'Resume Strategy?'}
                                    {confirmAction === 'SKIP' && 'Skip Next Run?'}
                                </h3>

                                <p className="text-sm text-muted-foreground">
                                    {confirmAction === 'DELETE' && `This will permanently remove ${displayLabel}. You can always create a new one.`}
                                    {confirmAction === 'PAUSE' && `${displayLabel} will be paused until you resume.`}
                                    {confirmAction === 'RESUME' && `${displayLabel} will resume operations.`}
                                    {confirmAction === 'SKIP' && `The next scheduled run for ${displayLabel} will be skipped.`}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setConfirmAction(null)}
                                    disabled={isLoading}
                                    className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors cursor-pointer"
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleAction(confirmAction)}
                                    disabled={isLoading}
                                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 ${confirmAction === 'DELETE'
                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                        : confirmAction === 'PAUSE'
                                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                                            : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                        }`}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    {isLoading ? 'Processing...' : 'Confirm'}
                                </motion.button>
                            </div>
                        </motion.div>
                    ) : (
                        // Main Actions View
                        <motion.div
                            key="main"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Header with Service Info */}
                            <div className="p-6 border-b border-border">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center border border-border overflow-hidden">
                                        {isSubscription ? (
                                            <img
                                                src={`https://img.logo.dev/${displayLabel.toLowerCase().trim().replace(/\s+/g, '')}.com?token=pk_123`}
                                                onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/56?text=" + displayLabel[0]?.toUpperCase())}
                                                className="w-full h-full object-cover"
                                                alt={displayLabel}
                                            />
                                        ) : (
                                            <img
                                                src={stack.token.logoURI || "https://via.placeholder.com/56"}
                                                className="w-full h-full object-cover"
                                                alt={stack.token.symbol}
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-lg font-bold text-foreground">{displayLabel}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaused
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                }`}>
                                                {isPaused ? 'PAUSED' : 'ACTIVE'}
                                            </span>
                                            {isSubscription && (
                                                <span className="text-xs text-muted-foreground">
                                                    {config?.dailyLimit} {stack.token.symbol} • {config?.frequency?.toLowerCase()}
                                                </span>
                                            )}
                                            {isDCA && (
                                                <span className="text-xs text-muted-foreground">
                                                    {config?.dailyLimit || config?.amountPerExecution} {stack.token.symbol} / execution
                                                </span>
                                            )}
                                            {isLimit && (
                                                <span className="text-xs text-muted-foreground">
                                                    Target: ${config?.targetPrice}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors cursor-pointer">
                                        <X className="w-5 h-5 text-muted-foreground" />
                                    </button>
                                </div>

                                {/* Next Payment Info (Subs Only) */}
                                {isSubscription && nextPaymentDate && !isPaused && (
                                    <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border/50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CalendarCheck className="w-4 h-4 text-emerald-500" />
                                                <span className="text-sm text-muted-foreground">Next Payment</span>
                                            </div>
                                            <span className="text-sm font-bold text-foreground">
                                                {daysUntilPayment !== null && daysUntilPayment <= 0
                                                    ? 'Due Today!'
                                                    : daysUntilPayment === 1
                                                        ? 'Tomorrow'
                                                        : nextPaymentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Cards */}
                            <div className="p-4 space-y-2">
                                {/* Edit */}
                                <motion.button
                                    whileHover={{ scale: 1.01, backgroundColor: 'hsl(var(--muted))' }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => {
                                        onClose()
                                        // Will trigger edit flow
                                        toast.success('Coming Soon', 'Edit functionality will be available soon')
                                    }}
                                    className="w-full p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all cursor-pointer flex items-center gap-4"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Settings2 className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="text-sm font-semibold text-foreground block">Edit Settings</span>
                                        <span className="text-xs text-muted-foreground">Change amount or settings</span>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </motion.button>

                                {/* Pause/Resume */}
                                <motion.button
                                    whileHover={{ scale: 1.01, backgroundColor: 'hsl(var(--muted))' }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => setConfirmAction(isPaused ? 'RESUME' : 'PAUSE')}
                                    className="w-full p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all cursor-pointer flex items-center gap-4"
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPaused ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                                        }`}>
                                        {isPaused
                                            ? <Play className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                            : <Ban className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                        }
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="text-sm font-semibold text-foreground block">
                                            {isPaused ? 'Resume Strategy' : 'Pause Strategy'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {isPaused ? 'Continue execution' : 'Temporarily stop execution'}
                                        </span>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </motion.button>

                                {/* Skip Next (Subs Only) */}
                                {isSubscription && !isPaused && (
                                    <motion.button
                                        whileHover={{ scale: 1.01, backgroundColor: 'hsl(var(--muted))' }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setConfirmAction('SKIP')}
                                        className="w-full p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all cursor-pointer flex items-center gap-4"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                            <ArrowRight className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <span className="text-sm font-semibold text-foreground block">Skip Next Payment</span>
                                            <span className="text-xs text-muted-foreground">Skip once, then resume normally</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    </motion.button>
                                )}

                                {/* Delete */}
                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => setConfirmAction('DELETE')}
                                    className="w-full p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-all cursor-pointer flex items-center gap-4"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                        <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="text-sm font-semibold text-red-600 dark:text-red-400 block">Delete Strategy</span>
                                        <span className="text-xs text-red-500/70 dark:text-red-400/70">Permanently remove this strategy</span>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-red-400" />
                                </motion.button>
                            </div>

                            {/* Bottom Safe Area */}
                            <div className="h-6" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    )
}

// ============================================
// CONFIGURE LIMIT MODAL
// ============================================

interface ConfigureLimitModalProps {
    isOpen: boolean
    onClose: () => void
    stack: StackCardData
    onSuccess?: () => void
}

function ConfigureLimitModal({ isOpen, onClose, stack, onSuccess }: ConfigureLimitModalProps) {
    // Steps: 'STRATEGY' | 'CONFIG' | 'REVIEW'
    const [step, setStep] = useState<'STRATEGY' | 'CONFIG' | 'REVIEW'>('STRATEGY')
    const [isSaving, setIsSaving] = useState(false)

    // Config State
    const [limitType, setLimitType] = useState<'BELOW' | 'ABOVE'>('BELOW') // BELOW = Dip, ABOVE = Breakout
    const [targetToken, setTargetToken] = useState<TokenInfo | null>(null)
    const [targetPrice, setTargetPrice] = useState("")
    const [amountToSpend, setAmountToSpend] = useState("")
    const [showTokenModal, setShowTokenModal] = useState(false)

    const router = useRouter()

    // Logic to use Mainnet prices for Sepolia (Testnet)
    const priceChainId = useMemo(() => {
        const chainId = targetToken?.chainId || stack.token.chainId
        return (chainId === 11155111 || chainId === 84532) ? 1 : chainId
    }, [targetToken, stack.token.chainId])

    // Fetch real-time price
    const { price: currentPrice, isLoading: isPriceLoading } = useTokenPrice(targetToken?.address || '', priceChainId)
    console.log('[LimitDebug] Render:', { symbol: targetToken?.symbol, currentPrice, isPriceLoading, priceChainId })

    // Map for fetching Mainnet prices for Testnet tokens
    const TESTNET_TO_MAINNET_MAP: Record<string, string> = {
        'LINK': '0x514910771af9ca656af840dff83e8264ecf986ca',
        'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        'WBTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        'WETH': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        'ETH': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    }

    // Effect to manually fetch price for Sepolia->Mainnet support
    useEffect(() => {
        if (!targetToken?.address || !priceChainId) return

        const fetchDiscretePrice = async () => {
            console.log('[LimitDebug] Effect for:', targetToken.symbol)
            try {
                let fetchAddress = targetToken.address
                if (priceChainId === 1 && TESTNET_TO_MAINNET_MAP[targetToken.symbol.toUpperCase()]) {
                    fetchAddress = TESTNET_TO_MAINNET_MAP[targetToken.symbol.toUpperCase()]
                }

                const res = await fetch('/api/prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tokens: [fetchAddress],
                        chainId: priceChainId
                    })
                })
                const data = await res.json()
                if (data.success && data.prices) {
                    const price = data.prices[fetchAddress] || data.prices[fetchAddress.toLowerCase()]
                    if (price) {
                        useAppStore.getState().setPrices(priceChainId, { [targetToken.address]: price })
                    }
                }
            } catch (e) {
                console.error("[LimitDebug] Failed", e)
            }
        }
        fetchDiscretePrice()
    }, [targetToken?.address, priceChainId, targetToken?.symbol])

    // Calculations
    const allocatedDaily = (stack.subCards || []).reduce((acc: number, card: any) => {
        if (card.config && card.config.dailyLimit) {
            return acc + parseFloat(card.config.dailyLimit)
        }
        const allocation = (Number(stack.totalBudget) * (card.allocationPercent || 0)) / 100
        return acc + allocation
    }, 0)
    const maxAllowedDaily = Number(stack.totalBudget) - allocatedDaily
    const isAmountTooHigh = Number(amountToSpend) > maxAllowedDaily

    // Compute Price Gap
    const priceGap = useMemo(() => {
        if (!currentPrice || !targetPrice) return null
        const target = parseFloat(targetPrice)
        const diff = ((target - currentPrice) / currentPrice) * 100
        return diff
    }, [currentPrice, targetPrice])

    const handleNext = () => {
        if (step === 'STRATEGY') setStep('CONFIG')
        else if (step === 'CONFIG') setStep('REVIEW')
    }

    const handleSave = async () => {
        if (!targetToken || !amountToSpend || !targetPrice) return

        setIsSaving(true)
        try {
            const res = await fetch('/api/card-stacks/configure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardStackId: stack.id,
                    chainId: stack.token.chainId,
                    type: 'LIMIT_ORDER',
                    name: limitType === 'BELOW' ? `Sniper Buy ${targetToken.symbol}` : `Breakout Buy ${targetToken.symbol}`,
                    color: limitType === 'BELOW' ? 'emerald' : 'violet',
                    allocationPercent: 0,
                    config: {
                        targetTokenAddress: targetToken.address,
                        targetTokenSymbol: targetToken.symbol,
                        targetTokenDecimals: targetToken.decimals,
                        targetPrice: targetPrice,
                        condition: limitType,
                        dailyLimit: amountToSpend,
                        action: 'BUY'
                    }
                })
            })

            const data = await res.json()
            if (data.success) {
                toast.success("Limit Order Created!", `Bot will buy ${targetToken.symbol} when price ${limitType === 'BELOW' ? 'drops to' : 'rises to'} $${targetPrice}`)
                onClose()
                // Smooth state update instead of full page reload
                if (onSuccess) {
                    onSuccess()
                }
            } else {
                toast.error("Failed to Create", data.error || "Please try again")
            }
        } catch (error: any) {
            console.error(error)
            toast.error("Error", error.message || "Failed to create limit order")
        } finally {
            setIsSaving(false)
        }
    }

    const formatUsdValue = (value: number | string) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return '';
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-background/80 backdrop-blur-md"
            >
                <div className="absolute inset-0" onClick={onClose} />

                <motion.div
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800/50 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            {step !== 'STRATEGY' && (
                                <button onClick={() => setStep(step === 'REVIEW' ? 'CONFIG' : 'STRATEGY')} className="p-2 -ml-2 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer">
                                    <ChevronLeft className="w-5 h-5 cursor-pointer" />
                                </button>
                            )}
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-tight">Create Limit Order</h2>
                                <p className="text-xs text-zinc-400 font-medium">Build your automated strategy</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer">
                            <X className="w-5 h-5 text-zinc-400 cursor-pointer" />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        <AnimatePresence mode="wait">
                            {step === 'STRATEGY' ? (
                                <motion.div
                                    key="strategy"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-4"
                                >
                                    <p className="text-sm text-zinc-400 mb-6">Which market condition do you want to target?</p>

                                    {/* Sniper Mode Card */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            setLimitType('BELOW')
                                            setStep('CONFIG')
                                        }}
                                        className="w-full text-left p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900/80 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                                                <TrendingDown className="w-6 h-6" />
                                            </div>
                                            <div className="px-2 py-1 rounded-md bg-zinc-950 text-[10px] font-bold text-zinc-500 border border-zinc-800">MOST POPULAR</div>
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1">Sniper Mode (Buy the Dip)</h3>
                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                            Wait patiently for the price to drop. Trigger a buy order precisely when the asset hits your discount target.
                                        </p>
                                    </motion.button>

                                    {/* Breakout Mode Card */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            setLimitType('ABOVE')
                                            setStep('CONFIG')
                                        }}
                                        className="w-full text-left p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-violet-500/50 hover:bg-zinc-900/80 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-colors">
                                                <Rocket className="w-6 h-6" />
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1">Breakout Mode (Buy the Rip)</h3>
                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                            Catch the momentum. Auto-buy only when the price breaks above a key resistance level.
                                        </p>
                                    </motion.button>
                                </motion.div>
                            ) : step === 'CONFIG' ? (
                                <motion.div
                                    key="config"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {/* Selected Strategy Indicator */}
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                                        <div className={`p-1.5 rounded-lg ${limitType === 'BELOW' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-violet-500/20 text-violet-500'}`}>
                                            {limitType === 'BELOW' ? <TrendingDown className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}
                                        </div>
                                        <span className="text-sm font-medium text-white">
                                            {limitType === 'BELOW' ? "Buying the Dip" : "Buying the Breakout"}
                                        </span>
                                    </div>

                                    {/* Token Selector */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Target Asset</label>
                                        <button
                                            onClick={() => setShowTokenModal(true)}
                                            className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                {targetToken ? (
                                                    <img src={targetToken.logoURI} className="w-8 h-8 rounded-full bg-zinc-800" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                                                        <Search className="w-4 h-4 text-zinc-500" />
                                                    </div>
                                                )}
                                                <div className="text-left">
                                                    <div className="text-sm font-bold text-white">{targetToken?.symbol || "Select Token"}</div>
                                                    <div className="text-xs text-zinc-500">{targetToken?.name || "Choose what to buy"}</div>
                                                </div>
                                            </div>
                                            <ChevronDown className="w-5 h-5 text-zinc-500" />
                                        </button>
                                    </div>

                                    {/* Price Input & Visualizer */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Target Price</label>
                                            {currentPrice && (
                                                <span className="text-xs font-medium text-zinc-400">Current: ${formatUsdValue(currentPrice)}</span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                                            <input
                                                type="number"
                                                value={targetPrice}
                                                onChange={(e) => setTargetPrice(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 pl-8 py-4 text-xl font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        {/* Price Gap Indicator */}
                                        {priceGap !== null && !isNaN(priceGap) && targetPrice && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                                className={`text-xs font-bold flex items-center gap-1.5 ${(limitType === 'BELOW' && priceGap < 0) || (limitType === 'ABOVE' && priceGap > 0)
                                                    ? 'text-emerald-500'
                                                    : 'text-amber-500' // Warning color if setting 'dip' above current price
                                                    }`}
                                            >
                                                {priceGap > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                {Math.abs(priceGap).toFixed(2)}% {priceGap > 0 ? "above" : "below"} market price
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Amount Input */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Budget Allocation</label>
                                            <span className="text-xs text-zinc-500">Max: {maxAllowedDaily.toFixed(2)} {stack.token.symbol}</span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={amountToSpend}
                                                onChange={(e) => setAmountToSpend(e.target.value)}
                                                className={`w-full bg-zinc-900 border ${isAmountTooHigh ? 'border-red-500/50' : 'border-zinc-800'} rounded-xl px-4 py-4 text-xl font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all`}
                                                placeholder="100.00"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-600">{stack.token.symbol}</span>
                                        </div>
                                        {isAmountTooHigh && (
                                            <p className="text-xs text-red-500">Exceeds remaining daily budget</p>
                                        )}
                                    </div>

                                </motion.div>
                            ) : (
                                <motion.div
                                    key="review"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <h3 className="text-lg font-bold text-white text-center mb-6">Review & Confirm</h3>

                                    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-5">
                                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Strategy Details</h3>

                                        <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                                            <span className="text-zinc-400 text-sm">Condition</span>
                                            <div className="flex items-center gap-2">
                                                {limitType === 'BELOW' ? <TrendingDown className="w-4 h-4 text-emerald-500" /> : <Rocket className="w-4 h-4 text-violet-500" />}
                                                <span className={`text-sm font-bold ${limitType === 'BELOW' ? 'text-emerald-500' : 'text-violet-500'}`}>
                                                    {limitType === 'BELOW' ? 'Sniper (Buy Dip)' : 'Breakout (Buy Rip)'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                                            <span className="text-zinc-400 text-sm">Target Asset</span>
                                            <div className="flex items-center gap-2">
                                                <img src={targetToken?.logoURI} className="w-5 h-5 rounded-full" alt={targetToken?.symbol} />
                                                <span className="text-white font-bold text-sm tracking-tight">{targetToken?.name} ({targetToken?.symbol})</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                                            <span className="text-zinc-400 text-sm">Trigger Price</span>
                                            <div className="text-right">
                                                <span className="text-white font-bold text-sm block">${formatUsdValue(targetPrice)}</span>
                                                <span className="text-[10px] text-zinc-500">Current: ${formatUsdValue(currentPrice || 0)}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center py-2">
                                            <span className="text-zinc-400 text-sm">Budget Allocation</span>
                                            <span className="text-white font-bold text-sm">{amountToSpend} {stack.token.symbol}</span>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs leading-relaxed text-center">
                                        <span className="font-semibold block mb-1">How it works</span>
                                        This bot will monitor market prices 24/7. When {targetToken?.symbol} hits ${formatUsdValue(targetPrice)}, it will automatically execute a buy order using your Smart Account.
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="p-6 pb-20 sm:pb-6 border-t border-zinc-800 bg-zinc-950 flex-shrink-0">
                        {step === 'STRATEGY' ? (
                            <div className="text-xs text-center text-zinc-500">Select a strategy mode to continue</div>
                        ) : step === 'CONFIG' ? (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleNext}
                                disabled={!targetToken || !targetPrice || !amountToSpend || isAmountTooHigh}
                                className={`w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${(!targetToken || !targetPrice || !amountToSpend || isAmountTooHigh)
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : 'bg-white text-black hover:bg-zinc-200 shadow-lg shadow-white/10'
                                    }`}
                            >
                                Review Order <ArrowRight className="w-4 h-4" />
                            </motion.button>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 cursor-pointer"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                {isSaving ? "Creating Order..." : "Confirm Limit Order"}
                            </motion.button>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            <TokenSelectorModal
                isOpen={showTokenModal}
                onClose={() => setShowTokenModal(false)}
                onSelectToken={(t) => {
                    setTargetToken(t)
                    setShowTokenModal(false)
                }}
                selectedToken={targetToken?.symbol || ""}
                filter={(t) => !['USDC', 'USDT', 'DAI', 'USDE'].includes(t.symbol.toUpperCase())}
            />
        </>
    )
}

// ============================================
// LIMIT ORDER SIMULATION MODAL (Demo Mode)
// ============================================

interface LimitOrderSimulationModalProps {
    isOpen: boolean
    onClose: () => void
    strategy: {
        id: string
        name: string
        config?: {
            targetTokenSymbol?: string
            targetTokenAddress?: string
            targetPrice?: string
            condition?: 'BELOW' | 'ABOVE'
            dailyLimit?: string
        }
    }
    stack: StackCardData
    onExecute: () => void
    isExecuting: boolean
}

function LimitOrderSimulationModal({ isOpen, onClose, strategy, stack, onExecute, isExecuting }: LimitOrderSimulationModalProps) {
    const [progress, setProgress] = useState(0)
    const [phase, setPhase] = useState<'monitoring' | 'approaching' | 'triggered' | 'executing'>('monitoring')
    const [hasExecuted, setHasExecuted] = useState(false)
    const SIMULATION_DURATION = 4000 // 4 seconds total

    const targetPrice = parseFloat(strategy.config?.targetPrice || '0')
    const condition = strategy.config?.condition || 'BELOW'
    const isSniper = condition === 'BELOW'

    // Simulate a starting price based on condition
    const startPrice = isSniper ? targetPrice * 1.25 : targetPrice * 0.8
    const currentDisplayPrice = startPrice + (targetPrice - startPrice) * (progress / 100)

    useEffect(() => {
        if (!isOpen) {
            setProgress(0)
            setPhase('monitoring')
            setHasExecuted(false)
            return
        }

        // Start monitoring phase, then immediately switch to approaching
        const startDelay = setTimeout(() => {
            setPhase('approaching')
        }, 300)

        // Progress animation
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval)
                    return 100
                }
                return prev + 2
            })
        }, SIMULATION_DURATION / 50)

        return () => {
            clearTimeout(startDelay)
            clearInterval(interval)
        }
    }, [isOpen])

    // Trigger phase when progress hits 100
    useEffect(() => {
        if (progress >= 100 && !hasExecuted) {
            console.log('[SimModal] Progress hit 100, setting triggered phase')
            setHasExecuted(true)
            setPhase('triggered')
        }
    }, [progress, hasExecuted])

    // Execute when phase becomes 'triggered'
    useEffect(() => {
        if (phase === 'triggered') {
            console.log('[SimModal] Phase is triggered, executing in 800ms...')
            const triggerDelay = setTimeout(() => {
                console.log('[SimModal] Calling onExecute callback NOW')
                setPhase('executing')
                onExecute()
            }, 800)
            return () => clearTimeout(triggerDelay)
        }
    }, [phase, onExecute])

    // Skip to trigger immediately
    const handleSkipToTrigger = () => {
        if (hasExecuted) return // Prevent double execution
        setHasExecuted(true)
        setProgress(100)
        setPhase('triggered')
        setTimeout(() => {
            setPhase('executing')
            onExecute()
        }, 300)
    }

    if (!isOpen) return null

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
            >
                {/* Animated Background Gradient */}
                <div className={`absolute inset-0 opacity-20 ${isSniper ? 'bg-gradient-to-br from-emerald-500/30 via-transparent to-transparent' : 'bg-gradient-to-br from-violet-500/30 via-transparent to-transparent'}`} />

                {/* Header */}
                <div className="relative p-6 border-b border-zinc-800/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${isSniper ? 'bg-emerald-500/20 text-emerald-500' : 'bg-violet-500/20 text-violet-500'}`}>
                                {isSniper ? <TrendingDown className="w-6 h-6" /> : <Rocket className="w-6 h-6" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Limit Order Bot</h2>
                                <p className="text-xs text-zinc-400">Demo Simulation</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isExecuting}
                            className="p-2 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="relative p-6 space-y-6">
                    {/* Status Message */}
                    <div className="text-center">
                        <motion.div
                            key={phase}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`text-sm font-semibold ${phase === 'triggered' || phase === 'executing'
                                ? 'text-emerald-400'
                                : 'text-zinc-300'
                                }`}
                        >
                            {phase === 'monitoring' && '🔍 Monitoring market prices...'}
                            {phase === 'approaching' && `📉 Price ${isSniper ? 'dropping' : 'rising'} toward target...`}
                            {phase === 'triggered' && '🎯 TARGET HIT! Executing order...'}
                            {phase === 'executing' && '⚡ Swapping tokens...'}
                        </motion.div>
                    </div>

                    {/* Price Display */}
                    <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
                        <div className="flex justify-between items-center mb-4 gap-4">
                            <div className="flex-1 min-w-0">
                                <span className="text-xs text-zinc-500 block mb-1">Current Price</span>
                                <motion.span
                                    className="text-xl sm:text-2xl font-bold text-white font-mono block truncate"
                                    animate={{
                                        color: phase === 'triggered' ? '#10b981' : '#ffffff'
                                    }}
                                >
                                    ${currentDisplayPrice.toFixed(2)}
                                </motion.span>
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                                <span className="text-xs text-zinc-500 block mb-1">Target</span>
                                <span className={`text-xl sm:text-2xl font-bold font-mono block truncate ${isSniper ? 'text-emerald-500' : 'text-violet-500'}`}>
                                    ${targetPrice.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                                className={`h-full ${isSniper ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-violet-600 to-violet-400'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.1 }}
                            />
                        </div>
                        <div className="flex justify-between mt-2">
                            <span className="text-[10px] text-zinc-500">Start</span>
                            <span className="text-[10px] text-zinc-500">{progress.toFixed(0)}%</span>
                            <span className="text-[10px] text-zinc-500">Target</span>
                        </div>
                    </div>

                    {/* Order Details */}
                    <div className="flex items-center justify-center gap-3 py-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-lg">
                            <img src={stack.token.logoURI} alt={stack.token.symbol} className="w-5 h-5 rounded-full" />
                            <span className="text-sm font-bold text-white">{strategy.config?.dailyLimit} {stack.token.symbol}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-500" />
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-lg">
                            <span className={`text-sm font-bold ${isSniper ? 'text-emerald-500' : 'text-violet-500'}`}>
                                {strategy.config?.targetTokenSymbol}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        disabled={isExecuting}
                        className="flex-1 py-3 rounded-xl border border-zinc-700 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSkipToTrigger}
                        disabled={phase === 'triggered' || phase === 'executing' || isExecuting}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 ${isSniper
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-violet-500 text-white hover:bg-violet-600'
                            }`}
                    >
                        {isExecuting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Executing...
                            </>
                        ) : (
                            <>
                                <Zap className="w-4 h-4" />
                                Skip to Trigger
                            </>
                        )}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ============================================
// STACK CARD COMPONENT (Futuristic Dashboard)
// ============================================


interface StackCardProps {
    stack: StackCardData
    onExecuteDCA: (stackId: string, subCardId: string, amount: number) => Promise<boolean>
    onExecuteSubscription: (stackId: string, subCardId: string, amount: number) => Promise<boolean>
    onRefetch?: () => void
    isExecuting?: boolean
    executingSubCardId?: string | null
    supportedTokens: TokenInfo[]
    onManage?: (stack: StackCardData) => void
}

function StackCard({ stack, onExecuteDCA, onExecuteSubscription, onRefetch, isExecuting, executingSubCardId, supportedTokens, onManage }: StackCardProps) {
    const { dca, limits, subscription, manual } = useMemo(() => {
        return {
            dca: stack.subCards.find(s => s.name?.includes("DCA") || s.name?.includes("Auto")),
            limits: stack.subCards.find(s => s.name?.includes("Limit") || s.type === 'LIMIT_ORDER'),
            subscription: stack.subCards.find(s => s.type === 'SUBSCRIPTION' || s.name?.includes("Auto-Pay")),
            manual: stack.subCards.find(s => s.name?.includes("Manual"))
        }
    }, [stack.subCards])

    const [showFundingModal, setShowFundingModal] = useState(false)
    const [showConfigModal, setShowConfigModal] = useState(false)
    const [showAddStrategyModal, setShowAddStrategyModal] = useState(false)
    const [showLimitModal, setShowLimitModal] = useState(false)
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
    const [selectedStrategy, setSelectedStrategy] = useState<StackCardData['subCards'][0] | null>(null)
    // Subscription Management Modal State
    const [showSubscriptionManagementModal, setShowSubscriptionManagementModal] = useState(false)
    const [managingSubscription, setManagingSubscription] = useState<StackCardData['subCards'][0] | null>(null)
    // Demo Simulation Modal State
    const [showSimulationModal, setShowSimulationModal] = useState(false)
    const [simulatingStrategy, setSimulatingStrategy] = useState<StackCardData['subCards'][0] | null>(null)

    // Filter to only configured strategies
    const configuredStrategies = useMemo(() => {
        return stack.subCards.filter(s => s.config?.targetTokenSymbol || s.type === 'SUBSCRIPTION')
    }, [stack.subCards])

    // Calculate DCA amount
    const isStablecoin = ['USDC', 'USDT'].includes(stack.token.symbol.toUpperCase())
    const dcaAmount = isStablecoin ? 1 : (dca ? (stack.totalBudget * (dca.budget / 100)) : 0)

    // Get Smart Account Balance
    const smartAccountBalanceHook = useBalanceBySymbol(stack.token.symbol, 'smartAccount')
    const smartAccountBalance = smartAccountBalanceHook?.balance ?? 0
    const hasInsufficientFunds = smartAccountBalance < dcaAmount

    const totalUsed = stack.subCards.reduce((acc, s) => acc + (s.spent || 0), 0)
    const percentUsed = Math.min((totalUsed > 0 && stack.totalBudget > 0 ? (totalUsed / stack.totalBudget) * 100 : 0), 100)
    const daysRemaining = Math.max(0, Math.ceil((new Date(stack.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

    const formatTokenValue = (val: any) => {
        const num = typeof val === 'string' ? parseFloat(val) : val
        return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 })} ${stack.token.symbol}`
    }

    // Pie Chart Data (unchanged logic)
    const pieData = useMemo(() => {
        const allocated = stack.subCards.reduce((sum, s) => {
            if (!s.config?.dailyLimit) return sum
            return sum + parseFloat(s.config.dailyLimit)
        }, 0)
        const unallocated = Math.max(0, stack.totalBudget - allocated)
        const data = stack.subCards.filter(s => s.config?.dailyLimit).map(s => ({
            name: s.name,
            value: parseFloat(s.config!.dailyLimit!),
            color: s.color || '#8884d8'
        }))
        if (unallocated > 0) data.push({ name: 'Unallocated', value: unallocated, color: '#27272a' })
        return data
    }, [stack.subCards, stack.totalBudget])

    return (
        <>
            {/* Modals */}
            <AnimatePresence>
                {showLimitModal && (
                    <ConfigureLimitModal
                        isOpen={showLimitModal}
                        onClose={() => setShowLimitModal(false)}
                        stack={stack}
                        onSuccess={onRefetch}
                    />
                )}
                {showSubscriptionModal && (
                    <ConfigureSubscriptionModal
                        isOpen={showSubscriptionModal}
                        onClose={() => setShowSubscriptionModal(false)}
                        stack={stack}
                        onSuccess={onRefetch}
                    />
                )}
                {showSimulationModal && simulatingStrategy && (
                    <LimitOrderSimulationModal
                        isOpen={showSimulationModal}
                        onClose={() => {
                            setShowSimulationModal(false)
                            setSimulatingStrategy(null)
                        }}
                        strategy={simulatingStrategy}
                        stack={stack}
                        onExecute={async () => {
                            const amount = parseFloat(simulatingStrategy.config?.dailyLimit || '0')
                            await onExecuteDCA(stack.id, simulatingStrategy.id, amount > 0 ? amount : 1)
                            setShowSimulationModal(false)
                            setSimulatingStrategy(null)
                        }}
                        isExecuting={isExecuting || false}
                    />
                )}

                {/* Strategy Management Modal */}
                {showSubscriptionManagementModal && managingSubscription && (
                    <StrategyManagementModal
                        isOpen={showSubscriptionManagementModal}
                        onClose={() => {
                            setShowSubscriptionManagementModal(false)
                            setManagingSubscription(null)
                        }}
                        stack={stack}
                        strategy={managingSubscription}
                        onSuccess={onRefetch}
                    />
                )}
            </AnimatePresence>

            <AddStrategyModal
                isOpen={showAddStrategyModal}
                onClose={() => setShowAddStrategyModal(false)}
                stack={stack}
                onAddDCA={() => {
                    setShowAddStrategyModal(false)
                    setSelectedStrategy({ id: 'new', type: 'DCA_BOT' } as any)
                    setShowConfigModal(true)
                }}
                onAddLimit={() => {
                    setShowAddStrategyModal(false)
                    setShowLimitModal(true)
                }}
                onAddSubscription={() => {
                    setShowAddStrategyModal(false)
                    setShowSubscriptionModal(true)
                }}
            />

            <ConfigureStrategyModal
                isOpen={showConfigModal}
                onClose={() => {
                    setShowConfigModal(false)
                    setSelectedStrategy(null)
                }}
                stack={stack}
                subCard={selectedStrategy || undefined}
            />

            <FundingModal
                isOpen={showFundingModal}
                onClose={() => setShowFundingModal(false)}
                preselectedToken={{
                    symbol: stack.token.symbol,
                    address: stack.token.address,
                    decimals: stack.token.decimals,
                    logoURI: stack.token.logoURI
                }}
                requiredAmount={dcaAmount.toString()}
                onSuccess={() => {
                    setShowFundingModal(false)
                    // Force refresh balances to update UI immediately
                    useAppStore.getState().triggerBalanceRefresh()
                }}
            />

            <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full bg-background border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
            >
                {/* MASTER HEADER */}
                <div className="p-6 border-b border-border/50 bg-muted/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center relative overflow-hidden">
                                {/* Active indicator ring */}
                                {stack.status === "active" && (
                                    <motion.div
                                        className="absolute inset-0 rounded-xl border-2 border-primary/30"
                                        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.05, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                )}
                                {stack.token.logoURI ? (
                                    <img src={stack.token.logoURI} alt={stack.token.symbol} className="w-7 h-7 relative z-10" />
                                ) : (
                                    <Zap className="w-6 h-6 text-primary relative z-10" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{stack.name}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${stack.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
                                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stack.status}</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-sm font-medium text-muted-foreground">{getChainById(stack.token.chainId)?.name}</span>
                                </div>
                            </div>
                        </div>

                        {/* Budget Pie Chart Visualization */}
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">ALLOCATION</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-xs text-muted-foreground">Strategies</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
                                    <span className="text-xs text-muted-foreground">Unallocated</span>
                                </div>
                            </div>
                            <div className="relative w-16 h-16">
                                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                    {pieData.map((slice, i) => {
                                        // Calculate SVG arc paths based on values
                                        const total = stack.totalBudget;
                                        const circumference = 2 * Math.PI * 40;
                                        const strokeDasharray = `${(slice.value / total) * circumference} ${circumference}`;
                                        const strokeDashoffset = -((pieData.slice(0, i).reduce((acc, curr) => acc + curr.value, 0) / total) * circumference);

                                        return (
                                            <circle
                                                key={slice.name}
                                                cx="50"
                                                cy="50"
                                                r="40"
                                                fill="transparent"
                                                stroke={slice.color}
                                                strokeWidth="20"
                                                strokeDasharray={strokeDasharray}
                                                strokeDashoffset={strokeDashoffset}
                                                className="transition-all duration-500"
                                            />
                                        )
                                    })}
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-muted-foreground">
                                        {Math.round((1 - (pieData.find(d => d.name === 'Unallocated')?.value || 0) / stack.totalBudget) * 100)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-4">
                            <div className="text-left sm:text-right">
                                <div className="text-2xl font-bold font-mono tracking-tight">
                                    {formatTokenValue(stack.totalBudget)}
                                    <span className="text-base text-muted-foreground font-sans ml-1">
                                        {stack.periodDuration === 3600 ? '/ hour' :
                                            stack.periodDuration === 604800 ? '/ week' :
                                                stack.periodDuration === 2592000 ? '/ month' :
                                                    '/ day'}
                                    </span>
                                </div>
                                <div className="text-sm text-muted-foreground">Master Budget Limit</div>
                            </div>
                            {onManage && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onManage(stack)
                                    }}
                                    className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Master Budget Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <span>Total Usage</span>
                            <span>{percentUsed.toFixed(1)}% Used</span>
                        </div>
                        <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
                            {/* Background segments for context */}
                            <div className="absolute inset-0 flex opacity-30">
                                <div className="h-full border-r border-background/50 bg-blue-500/20" style={{ width: `${dca?.budget || 0}%` }} />
                                <div className="h-full border-r border-background/50 bg-amber-500/20" style={{ width: `${limits?.budget || 0}%` }} />
                                <div className="h-full border-r border-background/50 bg-purple-500/20" style={{ width: `${manual?.budget || 0}%` }} />
                            </div>
                            <motion.div
                                className="h-full bg-primary relative z-10"
                                initial={{ width: 0 }}
                                animate={{ width: `${percentUsed}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                            />
                        </div>
                    </div>
                </div>

                {/* STRATEGIES SECTION - Dynamic */}
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-foreground">Active Strategies</h4>
                        <span className="text-xs text-muted-foreground">
                            {configuredStrategies.length} active
                        </span>
                    </div>

                    {/* Strategy Cards Grid */}
                    {configuredStrategies.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            {configuredStrategies.map((strategy) => {
                                // Cast config to any to avoid TS errors with Prisma Json type
                                const config = strategy.config as any

                                // Lookup target token for logo
                                const targetTokenInfo = supportedTokens.find(t => t.symbol === config?.targetTokenSymbol)
                                const isLimit = strategy.type === 'LIMIT_ORDER' || strategy.name.includes('Limit')
                                const isSubscription = strategy.type === 'SUBSCRIPTION' || strategy.name.includes("Auto-Pay")

                                // Robust Label Logic: Try config.label -> parsing strategy.name -> config.recipient -> 'Recipient'
                                let displayLabel = config?.label
                                if (!displayLabel && isSubscription) {
                                    // Try to parse "Auto-Pay Netflix" -> "Netflix"
                                    if (strategy.name.startsWith("Auto-Pay ")) {
                                        displayLabel = strategy.name.replace("Auto-Pay ", "")
                                    } else {
                                        // Fallback to recipient address
                                        displayLabel = config?.recipient ? `${config.recipient.slice(0, 6)}...` : 'Recipient'
                                    }
                                }
                                if (!displayLabel) displayLabel = strategy.name // Absolute fallback

                                // Display Logic
                                let subText = config?.dailyLimit
                                    ? `${config.dailyLimit} ${stack.token.symbol}/day`
                                    : "No daily limit"

                                if (isLimit) {
                                    subText = `Target: $${config?.targetPrice}`
                                } else if (isSubscription) {
                                    subText = `${config?.frequency === 'WEEKLY' ? 'Weekly' : 'Monthly'} Payment`
                                }

                                const isPaused = strategy.status === 'paused'
                                const borderColor = isLimit ? 'border-amber-500/20' : (isSubscription ? 'border-emerald-500/20' : 'border-border')
                                const loadColor = isPaused
                                    ? 'bg-muted text-muted-foreground'
                                    : (isLimit ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : (isSubscription ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'))

                                const statusDotColor = isPaused
                                    ? 'bg-amber-500' // Paused = Amber
                                    : (isLimit ? 'bg-amber-500 animate-pulse' : (isSubscription ? 'bg-emerald-500' : 'bg-blue-500'))

                                return (
                                    <motion.div
                                        key={strategy.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: isPaused ? 0.6 : 1, scale: 1 }}
                                        className={`p-4 rounded-xl bg-card border hover:border-primary/30 transition-all ${borderColor} ${isPaused ? 'grayscale-[0.5]' : ''}`}
                                    >
                                        {/* Strategy Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${loadColor}`}>
                                                    {isLimit ? <BarChart3 className="w-3.5 h-3.5" /> : (isSubscription ? <Calendar className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />)}
                                                </div>
                                                <div>
                                                    <span className="text-xs font-semibold block flex items-center gap-1.5">
                                                        {isLimit ? 'Limit Order' : (isSubscription ? (displayLabel) : 'DCA Bot')}
                                                        {isPaused && (
                                                            <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-[9px] text-amber-600 font-bold uppercase tracking-wider">
                                                                Paused
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground block">{subText}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {/* Manage button for subscriptions and DCA */}
                                                {(true) && (
                                                    <button
                                                        onClick={() => {
                                                            setManagingSubscription(strategy)
                                                            setShowSubscriptionManagementModal(true)
                                                        }}
                                                        className="text-[10px] font-medium text-primary hover:underline cursor-pointer"
                                                    >
                                                        Manage
                                                    </button>
                                                )}

                                                <div className={`w-2 h-2 rounded-full ${statusDotColor}`} />
                                            </div>
                                        </div>

                                        {/* Strategy Config */}
                                        <div className={`p-2.5 rounded-lg border mb-3 ${isLimit ? 'bg-amber-500/5 border-amber-500/10' : (isSubscription ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-primary/5 border-primary/10')}`}>
                                            <div className="flex items-center gap-2">
                                                <img src={stack.token.logoURI} alt={stack.token.symbol} className="w-4 h-4 rounded-full" />
                                                <span className="text-xs font-semibold">
                                                    {config?.dailyLimit || config?.amountPerExecution} {stack.token.symbol}
                                                </span>
                                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                                {isSubscription ? (
                                                    <div className="flex items-center gap-1">
                                                        <Wallet className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-xs font-semibold text-emerald-500">
                                                            {displayLabel}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {targetTokenInfo?.logoURI ? (
                                                            <img src={targetTokenInfo?.logoURI || 'https://via.placeholder.com/24'} alt={config?.targetTokenSymbol} className="w-4 h-4 rounded-full" />
                                                        ) : null}
                                                        <span className={`text-xs font-semibold ${isLimit ? 'text-amber-500' : 'text-primary'}`}>{config?.targetTokenSymbol}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Next Payment Date (Subscriptions only) */}
                                        {isSubscription && config?.nextPaymentDate && (
                                            <div className="mb-3 p-2 rounded-lg bg-muted/30 border border-border/50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <CalendarCheck className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-[10px] font-medium text-muted-foreground">Next Payment</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground">
                                                        {(() => {
                                                            const nextDate = new Date(config.nextPaymentDate)
                                                            const today = new Date()
                                                            const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                                            if (diffDays <= 0) return "Due Today!"
                                                            if (diffDays === 1) return "Tomorrow"
                                                            return nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Trigger Button */}
                                        {(() => {
                                            const dailyLimit = parseFloat(config?.dailyLimit || '0')
                                            const amount = parseFloat(config?.amountPerExecution || config?.dailyLimit || '0')
                                            const currentSpent = strategy.spent || 0

                                            // Limit Order Logic: Strictly enforce daily limit as the "Budget" for the buy
                                            // If we already spent it, we are done.
                                            const isLimitReached = dailyLimit > 0 && (currentSpent + (isLimit ? 0.000001 : amount) > dailyLimit)
                                            const isOverLimit = dailyLimit > 0 && currentSpent >= dailyLimit

                                            // Only show executing state for THIS specific strategy
                                            const isThisStrategyExecuting = executingSubCardId === strategy.id

                                            const isDisabled = isThisStrategyExecuting || isLimitReached || isOverLimit

                                            // Special "Paid" state for subscriptions
                                            const isSubscriptionPaid = isSubscription && (isLimitReached || isOverLimit)

                                            // Handler - route to correct execution function based on strategy type
                                            const handleClick = () => {
                                                if (isLimit) {
                                                    setSimulatingStrategy(strategy)
                                                    setShowSimulationModal(true)
                                                } else if (isSubscription) {
                                                    // Use dedicated subscription handler
                                                    onExecuteSubscription(stack.id, strategy.id, amount)
                                                } else {
                                                    onExecuteDCA(stack.id, strategy.id, amount)
                                                }
                                            }

                                            return (
                                                <motion.button
                                                    whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                                                    whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                                                    onClick={handleClick}
                                                    disabled={isDisabled}
                                                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isSubscriptionPaid
                                                        ? 'bg-emerald-500 text-white opacity-100 disabled:opacity-100' // creative "Paid" badge
                                                        : isDisabled && (isLimitReached || isOverLimit)
                                                            ? 'bg-destructive/10 text-destructive'
                                                            : (isLimit ? 'bg-amber-500 text-white hover:bg-amber-600' : (isSubscription ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-primary text-primary-foreground'))
                                                        }`}
                                                >
                                                    {isThisStrategyExecuting ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : isSubscriptionPaid ? (
                                                        <Check className="w-3 h-3" />
                                                    ) : (isDisabled && (isLimitReached || isOverLimit)) ? (
                                                        <Ban className="w-3 h-3" />
                                                    ) : (
                                                        isSubscription ? <Zap className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />
                                                    )}

                                                    {isThisStrategyExecuting ? "Processing..."
                                                        : isSubscriptionPaid ? `Paid: ${displayLabel}`
                                                            : (isLimitReached || isOverLimit) ? "Limit Reached"
                                                                : (isLimit ? "Simulate Trigger" : (isSubscription ? "Pay Now" : "Trigger"))}
                                                </motion.button>
                                            )
                                        })()}
                                    </motion.div>
                                )
                            })}
                        </div>
                    ) : (
                        /* Empty State */
                        <div className="text-center py-8 mb-4">
                            <div className="p-4 rounded-full bg-muted/50 inline-block mb-3">
                                <Zap className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">No strategies yet</p>
                            <p className="text-xs text-muted-foreground">Add your first trading strategy to get started</p>
                        </div>
                    )}

                    {/* Add Strategy Button */}
                    <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setShowAddStrategyModal(true)}
                        className="w-full py-3 px-4 border-2 border-dashed border-border hover:border-primary/50 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        Add Strategy
                    </motion.button>
                </div>
            </motion.div >
        </>
    )
}



// ============================================
// EMPTY STATE COMPONENT - PREMIUM DESIGN
// ============================================

interface EmptyStateProps {
    onCreateStack: () => void
}

function EmptyState({ onCreateStack }: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl bg-card border border-dashed border-border p-10"
        >
            <div className="max-w-sm mx-auto text-center">
                {/* Animated Icon */}
                <motion.div
                    animate={{
                        y: [0, -5, 0],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="inline-flex p-5 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-6"
                >
                    <Shield className="w-10 h-10 text-primary" />
                </motion.div>

                <h3 className="text-lg font-bold text-foreground mb-2">
                    Create Your First Card Stack
                </h3>
                <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                    Split your daily budget across different trading strategies.
                    Each sub-card has isolated limits enforced on-chain.
                </p>

                {/* Feature Pills with Stagger */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    {[
                        { icon: <Sparkles className="w-4 h-4" />, label: "One Signature" },
                        { icon: <Shield className="w-4 h-4" />, label: "Isolated Limits" },
                        { icon: <Clock className="w-4 h-4" />, label: "Auto Reset" }
                    ].map((feature, i) => (
                        <motion.div
                            key={feature.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + i * 0.1 }}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border"
                        >
                            <span className="text-primary">{feature.icon}</span>
                            <span className="text-[10px] font-semibold text-muted-foreground">{feature.label}</span>
                        </motion.div>
                    ))}
                </div>

                <motion.button
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCreateStack}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer shadow-lg shadow-primary/20"
                >
                    <Plus className="w-4 h-4" />
                    Create Card Stack
                </motion.button>
            </div>
        </motion.div>
    )
}
