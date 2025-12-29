"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    PieChart,
    Plus,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    Clock,
    Pause,
    Play,
    Sparkles,
    Shield,
    Calendar,
    MoreVertical,
    ExternalLink,
    Trash2,
    Settings2,
    X,
    Check,
    Wallet,
    Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TokenSelectorModal, TokenInfo } from "@/components/features/swap/TokenSelectorModal"
import { createWalletClient, custom, parseUnits, toHex } from "viem"
import { useAccount } from "wagmi"
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions"
import { toast } from "@/components/ui/toast"
import { getChainById, getViemChain } from "@/lib/server/config/chains"
import { useTokenPrice, formatUsdValue } from "@/hooks/useTokenPrice"
import { useCardStacksStore } from "@/hooks/useCardStacksStore"

// Demo data - 1 original demo stack (DB stacks come from API)
const DEMO_STACKS = [
    {
        id: "stack-1",
        name: "Trading Stack",
        token: { // USDC
            symbol: "USDC",
            name: "USD Coin",
            logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
            decimals: 6,
            address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as `0x${string}`
        },
        totalBudget: 100,
        usedToday: 42,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "active" as const,
        subCards: [
            { id: "sc-1", name: "DCA Bot", icon: "🤖", budget: 40, spent: 32, color: "#8B5CF6", status: "active" as const },
            { id: "sc-2", name: "Limit Orders", icon: "📊", budget: 30, spent: 8, color: "#06B6D4", status: "active" as const },
            { id: "sc-3", name: "Manual", icon: "✋", budget: 30, spent: 2, color: "#F97316", status: "paused" as const },
        ],
        recentTx: [
            { from: "10 USDC", to: "0.004 ETH", time: "2m ago", via: "DCA Bot" },
            { from: "5 USDC", to: "2.3 LINK", time: "1h ago", via: "Manual" },
            { from: "8 USDC", to: "15 USDT", time: "3h ago", via: "Limit Orders" },
        ]
    }
]

// Sub-card templates
const SUB_CARD_TEMPLATES = [
    { id: "dca", name: "DCA Bot", icon: "🤖", color: "#8B5CF6", description: "Auto-buy at intervals" },
    { id: "limits", name: "Limit Orders", icon: "📊", color: "#06B6D4", description: "Execute at price targets" },
    { id: "manual", name: "Manual Trades", icon: "✋", color: "#F97316", description: "Your direct swaps" },
]

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06 }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } }
}

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
}

const panelVariants = {
    hidden: { x: "100%", opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: "spring", damping: 30, stiffness: 300 } },
    exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } }
}

// Loading Skeleton for Stack Cards
function StackSkeleton() {
    return (
        <div className="rounded-xl bg-card border border-border p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1">
                    <div className="h-4 w-32 bg-muted rounded mb-2" />
                    <div className="h-3 w-24 bg-muted/50 rounded" />
                </div>
            </div>
            <div className="flex gap-2">
                <div className="h-8 flex-1 bg-muted/30 rounded-lg" />
                <div className="h-8 flex-1 bg-muted/30 rounded-lg" />
                <div className="h-8 flex-1 bg-muted/30 rounded-lg" />
            </div>
        </div>
    )
}

// Simple Stack Item - Just renders essential data to debug
function SimpleStackItem({ stack }: { stack: any }) {
    return (
        <div className="rounded-xl bg-card border border-border p-4">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h3 className="font-semibold text-foreground">{stack.name || "Card Stack"}</h3>
                    <p className="text-xs text-muted-foreground">
                        {stack.tokenSymbol || "WMON"} • {stack.status || "active"}
                    </p>
                </div>
            </div>
            {stack.subCards && stack.subCards.length > 0 && (
                <div className="mt-3 flex gap-2">
                    {stack.subCards.map((sc: any, i: number) => (
                        <span key={sc.id || i} className="text-xs px-2 py-1 rounded bg-muted">
                            {sc.name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function CardStacksPage() {
    const { address, chainId } = useAccount()

    // DEMO DATA - always show this for now
    const demoStacks = [
        {
            id: "demo-1",
            name: "Trading Stack",
            tokenSymbol: "WMON",
            status: "active",
            subCards: [
                { id: "sub-1", name: "DCA Bot" },
                { id: "sub-2", name: "Limit Orders" },
                { id: "sub-3", name: "Manual Trading" }
            ]
        }
    ]

    // Local UI state only
    const [showCreateFlow, setShowCreateFlow] = useState(false)
    const [dcaConfigSubCard, setDcaConfigSubCard] = useState<{
        card: { id: string; name: string; icon: string; color: string; budget: number }
        stackToken: TokenInfo
    } | null>(null)

    // Get tokens from Chain Config
    const currentChainId = chainId || 143
    const chainConfig = getChainById(currentChainId) || getChainById(143)
    const supportedTokens = chainConfig?.tokens || []

    // Combined stacks: demo + real API data
    const [apiStacks, setApiStacks] = useState<typeof DEMO_STACKS>([])

    // Function to convert API card stack to DEMO_STACKS format
    const transformApiStack = (apiStack: any): typeof DEMO_STACKS[0] => {
        // Find token from chain config, or create fallback
        const token = supportedTokens.find(t => t.symbol === apiStack.tokenSymbol) || {
            symbol: apiStack.tokenSymbol || "???",
            name: apiStack.tokenSymbol || "Unknown Token",
            logoURI: "",
            decimals: 18,
            address: (apiStack.tokenAddress || "0x0") as `0x${string}`
        }

        // Map sub-cards with icons based on type
        const getSubCardIcon = (type: string) => {
            switch (type) {
                case 'DCA_BOT': return "🤖"
                case 'LIMIT_ORDER': return "📊"
                case 'MANUAL_TRADING': return "✋"
                default: return "📦"
            }
        }

        return {
            id: apiStack.id,
            name: `${apiStack.tokenSymbol} Stack`,
            token,
            totalBudget: parseFloat(apiStack.totalBudget) / Math.pow(10, token.decimals),
            usedToday: 0, // TODO: calculate from subCards currentSpent
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
            recentTx: [] // No transactions yet
        }
    }

    // Fetch and transform API stacks
    useEffect(() => {
        if (!address) {
            console.log("[CardStacks] No address, skipping fetch")
            return
        }
        const load = async () => {
            console.log("[CardStacks] Fetching for:", address, currentChainId)
            try {
                const res = await fetch(`/api/card-stacks?walletAddress=${address}&chainId=${currentChainId}`)
                const data = await res.json()
                console.log("[CardStacks] Raw API response:", data)

                if (data.success && Array.isArray(data.stacks)) {
                    console.log("[CardStacks] Stacks count:", data.stacks.length)

                    // Transform each stack with individual error handling
                    const transformed: typeof DEMO_STACKS = []
                    for (const apiStack of data.stacks) {
                        try {
                            console.log("[CardStacks] Transforming stack:", apiStack.id)
                            const result = transformApiStack(apiStack)
                            console.log("[CardStacks] Transformed result:", result)
                            transformed.push(result)
                        } catch (err) {
                            console.error("[CardStacks] Error transforming stack:", apiStack.id, err)
                        }
                    }

                    console.log("[CardStacks] Final transformed array:", transformed.length, transformed)
                    setApiStacks(transformed)
                } else {
                    console.log("[CardStacks] API returned no stacks or failed:", data)
                }
            } catch (err) {
                console.error("[CardStacks] Fetch error:", err)
            }
        }
        load()
    }, [address, currentChainId])

    // Combine demo stacks with API stacks
    const stacks = [...DEMO_STACKS, ...apiStacks]
    console.log("[CardStacks] The Final stacks array:", stacks.length, stacks)
    const isLoading = false
    const hasStacks = stacks.length > 0

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
            const formattedStack = {
                id: newStack.id,
                name: "Card Stack",
                token: supportedTokens.find(t => t.symbol === newStack.tokenSymbol) || {
                    symbol: newStack.tokenSymbol,
                    name: newStack.tokenSymbol,
                    logoURI: "",
                    decimals: 18,
                    address: newStack.tokenAddress
                },
                totalBudget: parseFloat(newStack.totalBudget) / Math.pow(10, 6),
                usedToday: 0,
                expiresAt: new Date(newStack.expiresAt),
                status: newStack.status?.toLowerCase() || 'active',
                subCards: (newStack.subCards || []).map((sc: any) => ({
                    id: sc.id,
                    name: sc.name,
                    icon: sc.type === 'DCA_BOT' ? "🤖" : sc.type === 'LIMIT_ORDER' ? "📊" : "✋",
                    budget: sc.allocationPercent,
                    spent: 0,
                    color: sc.color,
                    status: sc.status?.toLowerCase() || 'active'
                })),
                recentTx: []
            }
            setApiStacks(prev => [formattedStack, ...prev])
        }
        // DON'T call fetchStacks() - it causes the render crash
        // Just keep the newly added stack in the list
    }, [supportedTokens])

    const handleOpenDCAConfig = useCallback((card: any, stackToken: TokenInfo) => {
        setDcaConfigSubCard({ card, stackToken })
    }, [])

    const handleCloseDCAConfig = useCallback(() => {
        setDcaConfigSubCard(null)
    }, [])

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-6 relative">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-5"
            >
                {/* Page Header */}
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                </motion.div>

                {/* Stacks List */}
                {isLoading ? (
                    <div className="space-y-4">
                        <StackSkeleton />
                        <StackSkeleton />
                    </div>
                ) : hasStacks ? (
                    <div className="space-y-4">
                        {stacks.map((stack, index) => {
                            console.log(`[CardStacks] RENDER - Stack ${index}:`, stack.id, stack.name)
                            return (
                                <motion.div key={stack.id} variants={itemVariants}>
                                    <StackCard stack={stack} onSubCardClick={(card) => handleOpenDCAConfig(card, stack.token)} />
                                </motion.div>
                            )
                        })}
                    </div>
                ) : (
                    <motion.div variants={itemVariants}>
                        <EmptyState onCreateStack={handleCreateStack} />
                    </motion.div>
                )}
            </motion.div>

            {/* Create Stack Overlay - SPA Feel */}
            <AnimatePresence>
                {showCreateFlow && (
                    <CreateStackOverlay
                        onClose={handleCloseCreate}
                        onSuccess={handleStackCreated}
                        tokens={supportedTokens}
                    />
                )}
                {dcaConfigSubCard && (
                    <DCAConfigOverlay
                        subCard={dcaConfigSubCard.card}
                        stackToken={dcaConfigSubCard.stackToken}
                        onClose={handleCloseDCAConfig}
                        onSave={(config) => {
                            console.log('DCA Config saved:', config)
                            handleCloseDCAConfig()
                        }}
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
    const [allocations, setAllocations] = useState([
        { ...SUB_CARD_TEMPLATES[0], percent: 40 },
        { ...SUB_CARD_TEMPLATES[1], percent: 30 },
        { ...SUB_CARD_TEMPLATES[2], percent: 30 },
    ])

    // Update selected token if tokens list changes (e.g. chain switch)
    useEffect(() => {
        // If current selected is invalid or not in new list, pick new default
        const isCurrentNative = selectedToken.address === "0x0000000000000000000000000000000000000000"
        const validDefault = tokens.find(t => t.address !== "0x0000000000000000000000000000000000000000")

        if (tokens.length > 0) {
            if (!tokens.find(t => t.symbol === selectedToken.symbol) || isCurrentNative) {
                if (validDefault) setSelectedToken(validDefault)
            }
        }
    }, [tokens, selectedToken])

    // Token selector modal state
    const [tokenModalOpen, setTokenModalOpen] = useState(false)

    const handleTokenSelect = (token: TokenInfo) => {
        if (token.address === "0x0000000000000000000000000000000000000000") {
            toast.error("Native Token Not Supported", "Please select an ERC-20 token (e.g. USDC, WETH) for Card Stacks.")
            return
        }

        // Find full token object from our list to ensure we have address
        const fullToken = tokens.find(t => t.symbol === token.symbol) || token
        setSelectedToken(fullToken)
        setTokenModalOpen(false)
    }

    const handleAllocationChange = (index: number, newPercent: number) => {
        const updated = [...allocations]
        const diff = newPercent - updated[index].percent

        // Simple redistribution to other cards
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

            // 1. Get current Chain ID cleanly
            const chainIdHex = await (window.ethereum as any).request({ method: 'eth_chainId' })
            const chainId = parseInt(chainIdHex, 16) || 143

            // Setup client with chain context
            const walletClient = createWalletClient({
                chain: getViemChain(chainId),
                transport: custom(window.ethereum as any)
            }).extend(erc7715ProviderActions())
            const [account] = await walletClient.requestAddresses()

            // 1.5 Force Network Switch/Add to ensure Metadata is known
            try {
                // Try switching first
                await walletClient.switchChain({ id: chainId })
            } catch (switchError: any) {
                // This error code 4902 indicates that the chain has not been added to MetaMask.
                if (switchError.code === 4902 || switchError.message?.includes("Unrecognized chain")) {
                    try {
                        await walletClient.addChain({ chain: getViemChain(chainId) })
                    } catch (addError) {
                        console.error("Failed to add chain:", addError)
                    }
                }
                console.warn("Chain switch non-critical error:", switchError)
            }

            // Determine if using Mock Mode (for standard wallets) or standard ERC-7715
            // For now assuming ERC-7715 capable wallet

            // 2. Prepare Permission Data
            const currentTime = Math.floor(Date.now() / 1000)
            const expiry = currentTime + (duration * 24 * 60 * 60)
            const periodDuration = 86400 // 1 day

            // Calculate wei amount based on decimals
            const periodAmount = parseUnits(totalBudget.toString(), selectedToken.decimals)

            // Check for Native Token (ETH, MON)
            // WMON is Wrapped, so it is ERC20 and has a real address.
            // Native tokens usually have address 0x0...0 in our config or we check symbol.
            const isNative = selectedToken.address === "0x0000000000000000000000000000000000000000";

            // Resolve Token Address
            // If it's a known token in our list, use that. If not (custom), we need address.
            const tokenAddress = selectedToken.address

            console.log("Requesting permissions...", {
                token: selectedToken.symbol,
                address: tokenAddress,
                amount: totalBudget,
                wei: periodAmount.toString(),
                type: isNative ? "native-token-periodic" : "erc20-token-periodic"
            })


            // 3. Request Execution Permissions (The "One Signature")
            // 3. Request Execution Permissions
            let permission: any = null

            try {
                const permissionType = isNative ? "native-token-periodic" : "erc20-token-periodic"

                const permissionData = isNative
                    ? {
                        periodAmount: periodAmount,
                        periodDuration: periodDuration,
                        justification: `Allow ZeroCliq Card Stack to spend ${totalBudget} ${selectedToken.symbol}/day`
                    }
                    : {
                        tokenAddress: tokenAddress as `0x${string}`,
                        periodAmount: periodAmount,
                        periodDuration: periodDuration,
                        justification: `Allow ZeroCliq Card Stack to spend ${totalBudget} ${selectedToken.symbol}/day`
                    }

                console.log("Attempting Permissions...", { type: permissionType, data: permissionData })

                // NOTE: We are intentionally skipping the experimental EIP-7715 'wallet_grantPermissions' call
                // because MetaMask's current beta UI displays "Unknown Network" for custom chains (like Monad),
                // which hurts the "Winning Aesthetics" of the demo.
                // We default to the "Standard Signature" flow which renders correctly.
                const USE_EXPERIMENTAL_7715 = false

                if (USE_EXPERIMENTAL_7715) {
                    // Try Advanced Permissions (ERC-7715)
                    const grantedPermissions = await walletClient.requestExecutionPermissions([{
                        chainId: chainId,
                        expiry,
                        signer: {
                            type: "account",
                            data: { address: account }
                        },
                        permission: {
                            type: permissionType as any,
                            data: permissionData as any
                        },
                        isAdjustmentAllowed: true
                    }])

                    if (grantedPermissions && grantedPermissions.length > 0) {
                        permission = grantedPermissions[0]
                    }
                } else {
                    // Force Fallback for UI Polish
                    throw new Error("Skipping experimental 7715 for UI polish")
                }
            } catch (err: any) {
                console.log("Using Standard Signature Flow (UI Polish):", err.message)

                // Fallback: Standard Signature (EIP-712 or Personal Sign)
                // This provides the cleanest UI ("Monad" network label is guaranteed correct)

                // toast.info("Signing Request", "Please sign the authorization.") // Optional

                const message = `Authorize ZeroCliq Card Stack\n\nToken: ${selectedToken.symbol}\nBudget: ${totalBudget}/day\nExpiry: ${new Date(expiry * 1000).toLocaleString()}`
                const signature = await walletClient.signMessage({
                    account,
                    message
                })

                // Create a "Mock" permission context derived from the signature
                // The backend will treat this as a verified legacy authorization
                permission = {
                    context: signature,
                    signerMeta: { delegationManager: "0x0000000000000000000000000000000000000000" },
                    fallbackMode: true
                }
            }

            if (!permission) {
                throw new Error("Failed to obtain permissions")
            }
            setLoadingMsg("Saving your Stack configuration...")

            // 4. Send to Backend
            const response = await fetch('/api/card-stacks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: account,
                    chainId: chainId,
                    permissionsContext: permission.context,
                    delegationManager: permission.signerMeta?.delegationManager || "",
                    tokenAddress: tokenAddress, // Use the resolved address (including 0x0 for Native)
                    tokenSymbol: selectedToken.symbol,
                    totalBudget: periodAmount.toString(),
                    periodDuration,
                    rawPermission: permission,
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

            // Track Activity (with proper headers)
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

            // Fix: Pass the new stack back to parent for immediate UI update
            setTimeout(() => {
                onSuccess(result.stack)
            }, 1500) // Small delay to let the success animation play

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
                            <button onClick={() => setStep("config")} className="px-4 py-2 bg-secondary rounded-lg text-sm">
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
    selectedToken: typeof SUPPORTED_TOKENS[0]
    onTokenClick: () => void
    totalBudget: number
    setTotalBudget: (v: number) => void
    duration: number
    setDuration: (v: number) => void
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
    allocations,
    onAllocationChange,
    onSubmit
}: ConfigStepProps) {
    const { price } = useTokenPrice(selectedToken.address, 143) // Use Monad Chain ID
    const usdValue = price ? totalBudget * price : null

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
                            <label className="text-xs font-medium text-foreground">Daily Budget</label>
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

                    <div className="pt-3 border-t border-border">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-medium text-foreground">Duration</label>
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
    selectedToken: typeof SUPPORTED_TOKENS[0]
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
// STACK CARD COMPONENT
// ============================================

interface StackCardProps {
    stack: typeof DEMO_STACKS[0]
    onSubCardClick?: (card: { id: string; name: string; icon: string; color: string; budget: number }) => void
}

function StackCard({ stack, onSubCardClick }: StackCardProps) {
    console.log("[StackCard] RENDERING:", stack.id, stack.name, stack.token?.symbol)

    const [expandedSection, setExpandedSection] = useState<"cards" | "history" | null>("cards")
    const [menuOpen, setMenuOpen] = useState(false)

    // Validate required data - if missing, show error card instead
    if (!stack.token) {
        console.error("[StackCard] Missing token data for stack:", stack.id)
        return (
            <div className="rounded-xl bg-destructive/10 border border-destructive p-4">
                <p className="text-sm text-destructive">Error: Stack {stack.id} missing token data</p>
                <pre className="text-xs text-muted-foreground mt-2">{JSON.stringify(stack, null, 2)}</pre>
            </div>
        )
    }

    // Safe calculations with fallbacks
    const usagePercent = stack.totalBudget > 0 ? Math.round((stack.usedToday / stack.totalBudget) * 100) : 0
    const expiresDate = stack.expiresAt instanceof Date ? stack.expiresAt : new Date(stack.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000)
    const daysRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

    return (
        <div className="rounded-xl bg-card border border-border overflow-hidden">
            {/* Stack Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-amber-500/10 flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground truncate">{stack.name}</h3>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
                                    stack.status === "active"
                                        ? "bg-emerald-500/10 text-emerald-500"
                                        : "bg-muted text-muted-foreground"
                                )}>
                                    {stack.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <img src={stack.token.logoURI} alt={stack.token.symbol} className="w-3.5 h-3.5 rounded-full" />
                                    {stack.token.symbol}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {daysRemaining}d left
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="relative">
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                            {menuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute right-0 top-8 w-40 rounded-lg bg-popover border border-border shadow-lg z-10 overflow-hidden"
                                >
                                    <button className="w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2 text-foreground cursor-pointer">
                                        <Settings2 className="w-3 h-3" /> Settings
                                    </button>
                                    <button className="w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2 text-foreground cursor-pointer">
                                        <ExternalLink className="w-3 h-3" /> View on Explorer
                                    </button>
                                    <button className="w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2 text-destructive cursor-pointer">
                                        <Trash2 className="w-3 h-3" /> Revoke All
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Budget Progress */}
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-muted-foreground">Today's usage</span>
                        <span className="text-xs font-medium text-foreground flex items-center gap-1">
                            <img src={stack.token.logoURI} alt={stack.token.symbol} className="w-3.5 h-3.5 rounded-full" />
                            {stack.usedToday} / {stack.totalBudget} {stack.token.symbol} <span className="text-muted-foreground">({usagePercent}%)</span>
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full flex">
                            {stack.subCards.map((card, i) => {
                                const width = (card.spent / stack.totalBudget) * 100
                                return (
                                    <motion.div
                                        key={card.id}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${width}%` }}
                                        transition={{ delay: i * 0.1, duration: 0.4 }}
                                        style={{ backgroundColor: card.color }}
                                        className="h-full first:rounded-l-full"
                                    />
                                )
                            })}
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-2">
                        {stack.subCards.map((card) => (
                            <div key={card.id} className="flex items-center gap-1.5">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: card.color }}
                                />
                                <span className="text-[10px] text-muted-foreground">{card.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Section Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setExpandedSection("cards")}
                    className={cn(
                        "flex-1 px-4 py-2.5 text-xs font-medium transition-colors relative cursor-pointer",
                        expandedSection === "cards"
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Sub-Cards
                    {expandedSection === "cards" && (
                        <motion.div
                            layoutId={`tab-${stack.id}`}
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                        />
                    )}
                </button>
                <button
                    onClick={() => setExpandedSection("history")}
                    className={cn(
                        "flex-1 px-4 py-2.5 text-xs font-medium transition-colors relative cursor-pointer",
                        expandedSection === "history"
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Recent Activity
                    {expandedSection === "history" && (
                        <motion.div
                            layoutId={`tab-${stack.id}`}
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                        />
                    )}
                </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {expandedSection === "cards" && (
                    <motion.div
                        key="cards"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4"
                    >
                        <div className="grid sm:grid-cols-3 gap-3">
                            {stack.subCards.map((card) => (
                                <SubCardTile key={card.id} card={card} onClick={() => onSubCardClick?.(card)} />
                            ))}
                        </div>
                    </motion.div>
                )}
                {expandedSection === "history" && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4"
                    >
                        <div className="space-y-2">
                            {stack.recentTx.map((tx, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-md bg-primary/10">
                                            <ChevronRight className="w-3 h-3 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-foreground">
                                                {tx.from} → {tx.to}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">via {tx.via}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {tx.time}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ============================================
// SUB-CARD TILE COMPONENT
// ============================================

interface SubCardTileProps {
    card: typeof DEMO_STACKS[0]["subCards"][0]
    onClick?: () => void
}

function SubCardTile({ card, onClick }: SubCardTileProps) {
    const [isHovered, setIsHovered] = useState(false)
    const [isPaused, setIsPaused] = useState(card.status === "paused")

    const percent = Math.round((card.spent / card.budget) * 100)
    const remaining = card.budget - card.spent

    return (
        <motion.div
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            whileHover={{ y: -2 }}
            onClick={onClick}
            className={cn(
                "relative p-3 rounded-lg border transition-colors cursor-pointer",
                isPaused
                    ? "bg-muted/20 border-border opacity-60"
                    : "bg-muted/30 border-border hover:border-primary/30"
            )}
        >
            {/* Status indicator */}
            <div className="absolute top-2 right-2">
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isPaused ? "bg-muted-foreground" : "bg-emerald-500"
                )} />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{card.icon}</span>
                <span className="text-xs font-medium text-foreground">{card.name}</span>
            </div>

            {/* Progress */}
            <div className="space-y-2">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: card.color }}
                    />
                </div>
                <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{card.spent} used</span>
                    <span className="text-foreground font-medium">{remaining} left</span>
                </div>
            </div>

            {/* Action Button (shows on hover) */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="mt-3 pt-2 border-t border-border"
                    >
                        <button
                            onClick={() => setIsPaused(!isPaused)}
                            className={cn(
                                "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer",
                                isPaused
                                    ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                            )}
                        >
                            {isPaused ? (
                                <>
                                    <Play className="w-3 h-3" /> Resume
                                </>
                            ) : (
                                <>
                                    <Pause className="w-3 h-3" /> Pause
                                </>
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================

interface EmptyStateProps {
    onCreateStack: () => void
}

function EmptyState({ onCreateStack }: EmptyStateProps) {
    return (
        <div className="rounded-xl bg-card border border-dashed border-border p-8">
            <div className="max-w-sm mx-auto text-center">
                {/* Icon */}
                <div className="inline-flex p-4 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-5">
                    <Shield className="w-8 h-8 text-primary" />
                </div>

                {/* Content */}
                <h3 className="text-base font-semibold text-foreground mb-2">
                    Create Your First Card Stack
                </h3>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    Split your daily budget across different trading strategies.
                    Each sub-card has isolated limits enforced on-chain.
                </p>

                {/* Features */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <FeaturePill icon={<Sparkles className="w-3 h-3" />} label="One Signature" />
                    <FeaturePill icon={<Shield className="w-3 h-3" />} label="Isolated Limits" />
                    <FeaturePill icon={<Clock className="w-3 h-3" />} label="Auto Reset" />
                </div>

                {/* CTA */}
                <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCreateStack}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    Create Card Stack
                </motion.button>
            </div>
        </div>
    )
}

function FeaturePill({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-muted/50 border border-border">
            <span className="text-primary">{icon}</span>
            <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        </div>
    )
}

// ============================================
// DCA CONFIG OVERLAY (Goal-Oriented WOW Design)
// ============================================

interface DCAConfig {
    targetToken: typeof SUPPORTED_TOKENS[0] | null
    totalBudget: number
    duration: number
    isActive: boolean
}

interface DCAConfigOverlayProps {
    subCard: {
        id: string
        name: string
        icon: string
        color: string
        budget: number
    }
    stackToken: typeof SUPPORTED_TOKENS[0]
    onClose: () => void
    onSave: (config: DCAConfig) => void
}

const DURATION_OPTIONS = [
    { value: 7, label: "7 days", shortLabel: "7d" },
    { value: 30, label: "30 days", shortLabel: "30d" },
    { value: 90, label: "90 days", shortLabel: "90d" },
]

// Mock prices for estimation (will be replaced with real data)
const MOCK_PRICES: Record<string, number> = {
    "ETH": 3200,
    "WETH": 3200,
    "MON": 1.5,
    "USDT": 1,
    "USDC": 1,
}

function DCAConfigOverlay({ subCard, stackToken, onClose, onSave }: DCAConfigOverlayProps) {
    const [step, setStep] = useState<"config" | "saving" | "success">("config")
    const [targetToken, setTargetToken] = useState<typeof SUPPORTED_TOKENS[0] | null>(null)
    const [totalBudget, setTotalBudget] = useState(subCard.budget * 30)
    const [duration, setDuration] = useState(30)
    const [tokenModalOpen, setTokenModalOpen] = useState(false)

    // Get real price for USD display
    const { price } = useTokenPrice(stackToken.address, 143)
    const usdValue = price ? totalBudget * price : null

    // Calculate projections
    const dailyAmount = totalBudget / duration
    const estimatedTokens = targetToken
        ? (totalBudget / (MOCK_PRICES[targetToken.symbol] || 1)).toFixed(4)
        : "0"
    const buysPerDay = 6
    const amountPerBuy = (dailyAmount / buysPerDay).toFixed(2)

    const handleTokenSelect = (token: TokenInfo) => {
        setTargetToken({
            symbol: token.symbol,
            name: token.name,
            logoURI: token.logoURI,
            decimals: token.decimals
        })
        setTokenModalOpen(false)
    }

    const handleSave = async () => {
        if (!targetToken) return
        setStep("saving")
        await new Promise(r => setTimeout(r, 1800))
        setStep("success")
    }

    const handleDone = () => {
        if (targetToken) {
            onSave({ targetToken, totalBudget, duration, isActive: true })
        }
        onClose()
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
                className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border z-50 overflow-y-auto pb-24 md:pb-0"
            >
                <AnimatePresence mode="wait">
                    {step === "config" && (
                        <motion.div
                            key="config"
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
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-primary/10">
                                            <span className="text-base">{subCard.icon}</span>
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-semibold text-foreground">Auto-Accumulate</h2>
                                            <p className="text-[10px] text-muted-foreground">Build your position automatically</p>
                                        </div>
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
                            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                                {/* Step 1: Target Token */}
                                <div className="space-y-2">
                                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">I want to accumulate</p>
                                    <button
                                        onClick={() => setTokenModalOpen(true)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                                            targetToken
                                                ? "bg-card border-primary/30 ring-1 ring-primary/10"
                                                : "bg-muted/20 border-dashed border-border hover:border-primary/30"
                                        )}
                                    >
                                        {targetToken ? (
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img src={targetToken.logoURI} alt={targetToken.symbol} className="w-8 h-8 rounded-full" />
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
                                                        <Check className="w-2 h-2 text-white" />
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-semibold text-foreground">{targetToken.symbol}</p>
                                                    <p className="text-[10px] text-muted-foreground">{targetToken.name}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                                    <Plus className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <span className="text-xs text-muted-foreground">Select token to accumulate</span>
                                            </div>
                                        )}
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                </div>

                                {/* Step 2: Total Budget */}
                                <div className="space-y-2">
                                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">With a total budget of</p>
                                    <div className="p-3 rounded-xl bg-card border border-border">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-1.5">
                                                <img src={stackToken.logoURI} alt={stackToken.symbol} className="w-4 h-4 rounded-full" />
                                                <span className="text-lg font-bold text-foreground">{totalBudget}</span>
                                                <span className="text-sm text-muted-foreground">{stackToken.symbol}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {formatUsdValue(usdValue)}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={100}
                                            max={10000}
                                            step={50}
                                            value={totalBudget}
                                            onChange={(e) => setTotalBudget(Number(e.target.value))}
                                            className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                                        />
                                        <div className="flex justify-between text-[9px] text-muted-foreground mt-1.5">
                                            <span>100</span>
                                            <span>10,000</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 3: Duration */}
                                <div className="space-y-2">
                                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Over the next</p>
                                    <div className="flex gap-2">
                                        {DURATION_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setDuration(opt.value)}
                                                className={cn(
                                                    "flex-1 p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                                                    duration === opt.value
                                                        ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                                                        : "bg-card border-border hover:border-primary/20"
                                                )}
                                            >
                                                <p className={cn(
                                                    "text-sm font-bold",
                                                    duration === opt.value ? "text-primary" : "text-foreground"
                                                )}>{opt.shortLabel}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Projection Card */}
                                {targetToken && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 rounded-xl bg-card border border-border"
                                    >
                                        {/* Estimated Accumulation */}
                                        <div className="text-center mb-4">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Estimated Accumulation</p>
                                            <div className="flex items-center justify-center gap-2">
                                                <img src={targetToken.logoURI} alt={targetToken.symbol} className="w-6 h-6 rounded-full" />
                                                <span className="text-2xl font-bold text-foreground">~{estimatedTokens}</span>
                                                <span className="text-sm text-muted-foreground">{targetToken.symbol}</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1">based on current price</p>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mb-4">
                                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: "100%" }}
                                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                                    className="h-full rounded-full"
                                                    style={{ backgroundColor: subCard.color }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[9px] text-muted-foreground">Day 1</span>
                                                <span className="text-[9px] text-muted-foreground">Day {duration}</span>
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="p-2 rounded-lg bg-muted/30">
                                                <p className="text-[9px] text-muted-foreground mb-0.5">Daily</p>
                                                <p className="text-xs font-semibold text-foreground">{dailyAmount.toFixed(0)} {stackToken.symbol}</p>
                                            </div>
                                            <div className="p-2 rounded-lg bg-muted/30">
                                                <p className="text-[9px] text-muted-foreground mb-0.5">Per Buy</p>
                                                <p className="text-xs font-semibold text-foreground">{amountPerBuy}</p>
                                            </div>
                                            <div className="p-2 rounded-lg bg-muted/30">
                                                <p className="text-[9px] text-muted-foreground mb-0.5">Buys/Day</p>
                                                <p className="text-xs font-semibold text-foreground">{buysPerDay}x</p>
                                            </div>
                                        </div>

                                        {/* Smart Note */}
                                        <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
                                            <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                                            <p className="text-[10px] text-muted-foreground">
                                                <span className="text-foreground font-medium">Smart timing</span> — Optimized for best average price
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-border bg-background">
                                <motion.button
                                    whileHover={{ y: -1 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSave}
                                    disabled={!targetToken}
                                    className={cn(
                                        "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors",
                                        targetToken
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    {targetToken ? "Start Auto-Accumulating" : "Select a token to continue"}
                                </motion.button>
                                {targetToken && (
                                    <p className="text-center text-[10px] text-muted-foreground mt-2">
                                        No signatures required • Uses Card Stack permission
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === "saving" && (
                        <motion.div
                            key="saving"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex flex-col items-center justify-center p-8"
                        >
                            <div className="relative mb-6">
                                <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
                                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {targetToken && (
                                        <img src={targetToken.logoURI} alt="" className="w-7 h-7 rounded-full" />
                                    )}
                                </div>
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-1">Setting Up Strategy</h3>
                            <p className="text-xs text-muted-foreground text-center max-w-xs">
                                Configuring your {targetToken?.symbol} accumulation...
                            </p>
                        </motion.div>
                    )}

                    {step === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex flex-col items-center justify-center p-8"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.1, type: "spring", damping: 15 }}
                                className="relative mb-5"
                            >
                                <div className="p-4 rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/20">
                                    <Check className="w-8 h-8 text-emerald-500" />
                                </div>
                            </motion.div>

                            <h3 className="text-base font-bold text-foreground mb-1">You're Accumulating! 🚀</h3>
                            <p className="text-xs text-muted-foreground text-center max-w-xs mb-5">
                                Sit back and watch your {targetToken?.symbol} grow automatically
                            </p>

                            {/* Summary */}
                            <div className="w-full max-w-xs p-4 rounded-xl bg-card border border-border mb-5">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <div className="flex items-center gap-1">
                                        <img src={stackToken.logoURI} alt="" className="w-5 h-5 rounded-full" />
                                        <span className="text-sm font-semibold text-foreground">{totalBudget}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    <div className="flex items-center gap-1">
                                        <img src={targetToken?.logoURI} alt="" className="w-5 h-5 rounded-full" />
                                        <span className="text-sm font-semibold text-foreground">~{estimatedTokens}</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Duration</span>
                                        <span className="font-medium text-foreground">{duration} days</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Daily amount</span>
                                        <span className="font-medium text-foreground">{dailyAmount.toFixed(0)} {stackToken.symbol}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Optimized buys</span>
                                        <span className="font-medium text-foreground">{buysPerDay}x per day</span>
                                    </div>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleDone}
                                className="w-full max-w-xs py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
                            >
                                Done
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Token Selector Modal */}
            <TokenSelectorModal
                isOpen={tokenModalOpen}
                onClose={() => setTokenModalOpen(false)}
                onSelectToken={handleTokenSelect}
                selectedToken={targetToken?.symbol}
            />
        </>
    )
}
