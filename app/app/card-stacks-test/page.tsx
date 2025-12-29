"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    PieChart,
    Plus,
    ChevronLeft,
    ChevronDown,
    Clock,
    Sparkles,
    Shield,
    Calendar,
    MoreVertical,
    ExternalLink,
    Trash2,
    Settings2,
    X,
    Check,
    Wallet
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TokenSelectorModal, TokenInfo } from "@/components/features/swap/TokenSelectorModal"
import { createWalletClient, custom, parseUnits } from "viem"
import { useAccount } from "wagmi"
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions"
import { toast } from "@/components/ui/toast"
import { getChainById, getViemChain } from "@/lib/server/config/chains"
import { useTokenPrice, formatUsdValue } from "@/hooks/useTokenPrice"

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
    { id: "manual", name: "Manual Trades", icon: "✋", color: "#F97316", description: "Your direct swaps" },
]

// Animation variants
const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
}

const panelVariants = {
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
    }
    totalBudget: number
    usedToday: number
    expiresAt: Date
    status: "active" | "paused"
    subCards: Array<{
        id: string
        name: string
        icon: string
        budget: number
        spent: number
        color: string
        status: "active" | "paused"
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

    // Transform API data to StackCard format
    const transformApiStack = (apiStack: any): StackCardData => {
        const token = supportedTokens.find(t => t.symbol === apiStack.tokenSymbol) || {
            symbol: apiStack.tokenSymbol || "???",
            name: apiStack.tokenSymbol || "Unknown",
            logoURI: "https://assets.coingecko.com/coins/images/38927/standard/monad.png",
            decimals: 18,
            address: apiStack.tokenAddress || "0x0"
        }

        return {
            id: apiStack.id,
            name: `${apiStack.tokenSymbol} Stack`,
            token,
            totalBudget: parseFloat(apiStack.totalBudget),
            usedToday: 0,
            expiresAt: new Date(apiStack.expiresAt),
            status: apiStack.status.toLowerCase() as "active" | "paused",
            subCards: (apiStack.subCards || []).map((sc: any) => ({
                id: sc.id,
                name: sc.name,
                icon: getSubCardIcon(sc.type),
                budget: sc.allocationPercent,
                spent: parseFloat(sc.currentSpent || "0") / Math.pow(10, token.decimals),
                color: sc.color,
                status: sc.status.toLowerCase() as "active" | "paused"
            })),
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
        if (newStack) {
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

            {/* Stacks */}
            {!isLoading && stacks.length > 0 && (
                <div className="space-y-4">
                    {stacks.map((stack) => (
                        <StackCard key={stack.id} stack={stack} />
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
    const [allocations, setAllocations] = useState([
        { ...SUB_CARD_TEMPLATES[0], percent: 40 },
        { ...SUB_CARD_TEMPLATES[1], percent: 30 },
        { ...SUB_CARD_TEMPLATES[2], percent: 30 },
    ])

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

    const handleAllocationChange = (index: number, newPercent: number) => {
        const updated = [...allocations]
        const diff = newPercent - updated[index].percent
        const othersCount = allocations.length - 1
        if (othersCount > 0) {
            const adjustPerOther = diff / othersCount
            updated.forEach((alloc, i) => {
                if (i === index) {
                    alloc.percent = Math.max(0, Math.min(100, newPercent))
                } else {
                    alloc.percent = Math.max(0, Math.min(100, alloc.percent - adjustPerOther))
                }
            })
        } else {
            updated[index].percent = newPercent
        }
        setAllocations(updated)
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

            // Get Session Smart Account Address from environment
            const sessionAccountAddress = process.env.NEXT_PUBLIC_SESSION_SMART_ACCOUNT_ADDRESS

            console.log("[DEBUG] Session Smart Account Address:", sessionAccountAddress)
            console.log("[DEBUG] User Address:", account)

            if (!sessionAccountAddress) {
                const msg = "Session account not configured. Please set NEXT_PUBLIC_SESSION_SMART_ACCOUNT_ADDRESS in .env and RESTART your dev server (npm run dev)."
                console.error(msg)
                throw new Error(msg)
            }

            if (account && sessionAccountAddress.toLowerCase() === account.toLowerCase()) {
                const msg = "CRITICAL ERROR: Your session account address is the SAME as your wallet address. " +
                    "ERC-7715 requires an EXTERNAL session account. Please use the address generated " +
                    "by the script and RESTART YOUR DEV SERVER."
                console.error(msg)
                throw new Error(msg)
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
                    subCards: allocations.map(alloc => ({
                        type: alloc.id === 'dca' ? 'DCA_BOT' : alloc.id === 'limits' ? 'LIMIT_ORDER' : 'MANUAL_TRADING',
                        name: alloc.name,
                        color: alloc.color,
                        allocationPercent: alloc.percent,
                        config: { description: alloc.description }
                    }))
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
                            allocations={allocations}
                            onAllocationChange={handleAllocationChange}
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
                            allocations={allocations}
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
    allocations: Array<typeof SUB_CARD_TEMPLATES[0] & { percent: number }>
    onAllocationChange: (index: number, percent: number) => void
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
    allocations,
    onAllocationChange,
    onSubmit
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

                {/* Sub-Card Allocations */}
                <div>
                    <h3 className="text-xs font-medium text-foreground mb-3">Budget Allocation</h3>
                    <div className="space-y-3">
                        {allocations.map((alloc, index) => (
                            <div key={alloc.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{alloc.icon}</span>
                                        <div>
                                            <p className="text-xs font-medium text-foreground">{alloc.name}</p>
                                            <p className="text-[10px] text-muted-foreground">{alloc.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 text-right">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-3.5 h-3.5 rounded-full" />
                                            <p className="text-sm font-bold text-foreground">
                                                {Math.round(totalBudget * alloc.percent / 100)} {selectedToken.symbol}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            {formatUsdValue(price ? (totalBudget * alloc.percent / 100) * price : null)}
                                        </p>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={alloc.percent}
                                    onChange={(e) => onAllocationChange(index, Number(e.target.value))}
                                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer"
                                    style={{ accentColor: alloc.color }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Live Preview */}
                <div className="p-4 rounded-xl bg-card border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Live Preview</p>
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                        {allocations.map((alloc) => (
                            <motion.div
                                key={alloc.id}
                                animate={{ width: `${alloc.percent}%` }}
                                transition={{ duration: 0.3 }}
                                className="h-full first:rounded-l-full last:rounded-r-full"
                                style={{ backgroundColor: alloc.color }}
                            />
                        ))}
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-3">
                        {allocations.map((alloc) => (
                            <div key={alloc.id} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: alloc.color }} />
                                <span className="text-[10px] text-muted-foreground">{alloc.name}</span>
                            </div>
                        ))}
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
                    <Sparkles className="w-4 h-4" />
                    Create Stack (1 Signature)
                </motion.button>
                <p className="text-center text-[10px] text-muted-foreground mt-2">
                    You'll approve {allocations.length} permissions with one signature
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
    allocations: Array<typeof SUB_CARD_TEMPLATES[0] & { percent: number }>
    selectedToken: TokenInfo
    totalBudget: number
    onClose: () => void
}

function SuccessStep({ allocations, selectedToken, totalBudget, onClose }: SuccessStepProps) {
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

            <h3 className="text-lg font-bold text-foreground mb-1">Stack Created! 🎉</h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs mb-6 flex items-center justify-center gap-1.5 flex-wrap">
                <span>Your {allocations.length} sub-cards are now active with</span>
                <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-4 h-4 rounded-full inline" />
                <span className="font-medium text-foreground">{totalBudget} {selectedToken.symbol}/day</span>
                <span>budget</span>
            </p>

            {/* Created Cards */}
            <div className="w-full max-w-xs space-y-2 mb-8">
                {allocations.map((alloc, i) => (
                    <motion.div
                        key={alloc.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{alloc.icon}</span>
                            <span className="text-xs font-medium text-foreground">{alloc.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-4 h-4 rounded-full" />
                            <span className="text-xs font-bold text-foreground">
                                {Math.round(totalBudget * alloc.percent / 100)} {selectedToken.symbol}/day
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>
                    </motion.div>
                ))}
            </div>

            <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full max-w-xs py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
            >
                Done
            </motion.button>
        </motion.div>
    )
}

// ============================================
// STACK CARD COMPONENT - AWARD WINNING DESIGN
// ============================================

// Sub-card tile animation variants
const subCardVariants = {
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
const pulseVariants = {
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
const progressSegmentVariants = {
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

function StackCard({ stack }: { stack: StackCardData }) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [hoveredCard, setHoveredCard] = useState<string | null>(null)
    const [activityExpanded, setActivityExpanded] = useState(false)

    const usagePercent = stack.totalBudget > 0 ? Math.round((stack.usedToday / stack.totalBudget) * 100) : 0
    const daysRemaining = Math.max(0, Math.ceil((stack.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
        >
            {/* Header Section */}
            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    {/* Stack Info */}
                    <div className="flex items-center gap-4 min-w-0">
                        {/* Animated Icon Container */}
                        <motion.div
                            whileHover={{ rotate: [0, -10, 10, 0], scale: 1.05 }}
                            transition={{ duration: 0.5 }}
                            className="relative p-3 rounded-xl bg-amber-500/10 flex-shrink-0"
                        >
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            {/* Active indicator ring */}
                            {stack.status === "active" && (
                                <motion.div
                                    className="absolute -inset-0.5 rounded-xl border-2 border-amber-500/30"
                                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                            )}
                        </motion.div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5">
                                <h3 className="text-base font-semibold text-foreground truncate">{stack.name}</h3>
                                {/* Status Badge with Pulse */}
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                                    stack.status === "active"
                                        ? "bg-emerald-500/10 text-emerald-500"
                                        : "bg-muted text-muted-foreground"
                                )}>
                                    {stack.status === "active" && (
                                        <motion.div
                                            variants={pulseVariants}
                                            animate="pulse"
                                            className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                                        />
                                    )}
                                    {stack.status}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <img src={stack.token.logoURI} alt={stack.token.symbol} className="w-4 h-4 rounded-full ring-1 ring-border" />
                                    <span className="font-medium">{stack.token.symbol}</span>
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span className="font-medium">{daysRemaining}d</span> remaining
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Menu */}
                    <div className="relative">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </motion.button>
                        <AnimatePresence>
                            {menuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -8 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    className="absolute right-0 top-10 w-44 rounded-xl bg-popover border border-border shadow-xl z-10 overflow-hidden"
                                >
                                    <div className="p-1">
                                        <button className="w-full px-3 py-2 text-xs text-left hover:bg-muted rounded-lg flex items-center gap-2.5 text-foreground cursor-pointer transition-colors">
                                            <Settings2 className="w-3.5 h-3.5" /> Settings
                                        </button>
                                        <button className="w-full px-3 py-2 text-xs text-left hover:bg-muted rounded-lg flex items-center gap-2.5 text-foreground cursor-pointer transition-colors">
                                            <ExternalLink className="w-3.5 h-3.5" /> View on Explorer
                                        </button>
                                        <div className="h-px bg-border my-1" />
                                        <button className="w-full px-3 py-2 text-xs text-left hover:bg-destructive/10 rounded-lg flex items-center gap-2.5 text-destructive cursor-pointer transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" /> Revoke All
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Budget Progress Section */}
                <div className="mt-5">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Today's usage</span>
                        <div className="flex items-center gap-2">
                            <img src={stack.token.logoURI} alt="" className="w-4 h-4 rounded-full" />
                            <span className="text-sm font-bold text-foreground">{stack.usedToday}</span>
                            <span className="text-xs text-muted-foreground">/ {stack.totalBudget} {stack.token.symbol}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{usagePercent}%</span>
                        </div>
                    </div>

                    {/* Multi-color Progress Bar with Animation */}
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                        {stack.subCards.map((card, i) => {
                            const width = stack.totalBudget > 0 ? (card.spent / stack.totalBudget) * 100 : 0
                            return (
                                <motion.div
                                    key={card.id}
                                    custom={i}
                                    variants={progressSegmentVariants}
                                    initial="hidden"
                                    animate="visible"
                                    style={{
                                        backgroundColor: card.color,
                                        width: `${width}%`
                                    }}
                                    className="h-full first:rounded-l-full relative overflow-hidden"
                                >
                                    {/* Shimmer effect */}
                                    <motion.div
                                        className="absolute inset-0 bg-white/20"
                                        initial={{ x: "-100%" }}
                                        animate={{ x: "200%" }}
                                        transition={{
                                            delay: 0.8 + i * 0.2,
                                            duration: 0.8,
                                            ease: "easeOut"
                                        }}
                                    />
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-2.5">
                        {stack.subCards.map((card) => (
                            <div key={card.id} className="flex items-center gap-1.5">
                                <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: card.color }}
                                />
                                <span className="text-[10px] font-medium text-muted-foreground">{card.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Horizontal Sub-Cards Section - THE STAR OF THE SHOW */}
            <div className="px-5 pb-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Sub-Cards</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{stack.subCards.length} active</span>
                        {/* Mobile-friendly add button */}
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-6 h-6 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center cursor-pointer transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5 text-primary" />
                        </motion.button>
                    </div>
                </div>

                {/* Horizontal Scrolling Cards */}
                <div className="flex gap-3 overflow-x-auto pt-2 pb-1 -mx-1 px-1 -mt-2 scrollbar-hide">
                    {stack.subCards.map((card, index) => {
                        const cardBudget = (stack.totalBudget * card.budget / 100)
                        const cardPercent = cardBudget > 0 ? Math.round((card.spent / cardBudget) * 100) : 0
                        const isHovered = hoveredCard === card.id

                        return (
                            <motion.div
                                key={card.id}
                                custom={index}
                                variants={subCardVariants}
                                initial="hidden"
                                animate="visible"
                                whileHover="hover"
                                whileTap="tap"
                                onHoverStart={() => setHoveredCard(card.id)}
                                onHoverEnd={() => setHoveredCard(null)}
                                className="relative flex-shrink-0 w-[160px] p-4 rounded-xl border border-border bg-muted/30 cursor-pointer overflow-hidden group"
                            >
                                {/* Colored top accent bar */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-1"
                                    style={{ backgroundColor: card.color }}
                                />

                                {/* Status indicator */}
                                <div className="absolute top-3 right-3">
                                    {card.status === "active" ? (
                                        <motion.div
                                            variants={pulseVariants}
                                            animate="pulse"
                                            className="w-2 h-2 rounded-full bg-emerald-500"
                                        />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                    )}
                                </div>

                                {/* Icon with animated background */}
                                <motion.div
                                    animate={isHovered ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
                                    style={{ backgroundColor: `${card.color}15` }}
                                >
                                    {card.icon}
                                </motion.div>

                                {/* Card Name */}
                                <p className="text-sm font-semibold text-foreground mb-1 truncate">{card.name}</p>

                                {/* Percentage Badge */}
                                <div className="flex items-center gap-2 mb-3">
                                    <span
                                        className="text-xs font-bold"
                                        style={{ color: card.color }}
                                    >
                                        {card.budget}%
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">allocation</span>
                                </div>

                                {/* Mini Progress Bar */}
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${cardPercent}%` }}
                                        transition={{ delay: 0.5 + index * 0.1, duration: 0.6, ease: "easeOut" }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: card.color }}
                                    />
                                </div>

                                {/* Spent / Budget */}
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground">
                                        {card.spent.toFixed(1)} used
                                    </span>
                                    <span className="font-medium text-foreground">
                                        {cardBudget.toFixed(1)} {stack.token.symbol}
                                    </span>
                                </div>

                                {/* Hover reveal action - covers bottom content for visibility */}
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute inset-x-0 bottom-0 p-3 pt-8 rounded-b-xl"
                                            style={{
                                                background: `linear-gradient(to top, hsl(var(--card)) 60%, transparent)`
                                            }}
                                        >
                                            <button
                                                className="w-full py-2 rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
                                                style={{
                                                    backgroundColor: card.color,
                                                    color: '#ffffff'
                                                }}
                                            >
                                                Configure →
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}

                    {/* Add Sub-Card Button */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: stack.subCards.length * 0.08 + 0.1 }}
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="relative flex-shrink-0 w-[140px] p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/10 hover:bg-primary/5 cursor-pointer transition-colors group flex flex-col items-center justify-center min-h-[160px]"
                    >
                        {/* Plus Icon with Animation */}
                        <motion.div
                            whileHover={{ rotate: 90 }}
                            transition={{ type: "spring", stiffness: 300 }}
                            className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors"
                        >
                            <Plus className="w-5 h-5 text-primary" />
                        </motion.div>

                        <p className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors text-center">
                            Add Sub-Card
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors text-center mt-1">
                            Split your budget
                        </p>

                        {/* Hover glow effect */}
                        <motion.div
                            className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                        />
                    </motion.div>
                </div>
            </div>

            {/* Recent Activity Section - Collapsible */}
            <div className="border-t border-border">
                <motion.button
                    onClick={() => setActivityExpanded(!activityExpanded)}
                    whileHover={{ backgroundColor: "rgba(var(--muted), 0.5)" }}
                    className="w-full px-5 py-3 flex items-center justify-between cursor-pointer transition-colors"
                >
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        Recent Activity
                        {stack.recentTx.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                                {stack.recentTx.length}
                            </span>
                        )}
                    </span>
                    <motion.div
                        animate={{ rotate: activityExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                </motion.button>

                <AnimatePresence>
                    {activityExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                        >
                            <div className="px-5 pb-4 space-y-2">
                                {stack.recentTx.length > 0 ? (
                                    stack.recentTx.map((tx, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                                    <span className="text-xs">↗</span>
                                                </div>
                                                <span className="text-xs font-medium text-foreground">{tx.from} → {tx.to}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-muted-foreground">via {tx.via}</span>
                                                <span className="text-[10px] font-medium text-muted-foreground">{tx.time}</span>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-xs text-muted-foreground">No recent activity</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
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
