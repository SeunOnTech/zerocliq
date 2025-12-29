"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Info, ExternalLink, HelpCircle, Check } from "lucide-react"
import {
    Dialog,
    DialogTitle,
    DialogPortal,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useAppStore } from "@/store/useAppStore"
import { useWalletBalances } from "@/hooks/useTokenBalance"
import { useDisconnect, useAccount } from 'wagmi'

// Token type from backend (via chains.tokens)
export interface TokenInfo {
    symbol: string
    name: string
    address: `0x${string}`
    decimals: number
    logoURI: string
    isStable?: boolean
    isBlueChip?: boolean
    isLST?: boolean
    isLP?: boolean
}

interface TokenSelectorModalProps {
    isOpen: boolean
    onClose: () => void
    onSelectToken: (token: TokenInfo) => void
    selectedToken?: string
    excludeToken?: string
}

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
}

const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
}

export function TokenSelectorModal({
    isOpen,
    onClose,
    onSelectToken,
    selectedToken,
    excludeToken,
}: TokenSelectorModalProps) {
    const [searchQuery, setSearchQuery] = useState("")

    const availableChains = useAppStore((state) => state.availableChains)
    const connectedChainId = useAppStore((state) => state.chainId)

    // Use Zustand's selectedChainId for global sync with wallet connection
    const selectedChainId = useAppStore((state) => state.selectedChainId)
    const setSelectedChain = useAppStore((state) => state.setSelectedChain)

    // Set a local setter that updates Zustand
    const setSelectedChainId = (chainId: number) => {
        setSelectedChain(chainId)
    }

    // Set default chain when modal opens (only if no chain is selected)
    // Priority: 1) Already selected, 2) Connected chain, 3) First available chain
    useEffect(() => {
        if (isOpen && !selectedChainId) {
            if (connectedChainId) {
                setSelectedChain(connectedChainId)
            } else if (availableChains.length > 0) {
                setSelectedChain(availableChains[0].id)
            }
        }
    }, [isOpen, connectedChainId, selectedChainId, availableChains, setSelectedChain])

    const selectedChain = availableChains.find((c) => c.id === selectedChainId)
    const tokens = (selectedChain?.tokens || []) as TokenInfo[]

    // Get wallet balances for the SELECTED chain (not just connected chain)
    // This allows browsing balances across different chains!
    const walletBalances = useWalletBalances('eoa', selectedChainId || undefined)

    const filteredTokens = useMemo(() => {
        return tokens.filter((token) => {
            if (excludeToken && token.symbol.toLowerCase() === excludeToken.toLowerCase()) {
                return false
            }
            if (searchQuery) {
                return (
                    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    token.address.toLowerCase().includes(searchQuery.toLowerCase())
                )
            }
            return true
        })
    }, [tokens, searchQuery, excludeToken])

    const favoriteTokens = useMemo(() => {
        return tokens.filter((t) => t.isStable || t.isBlueChip).slice(0, 6)
    }, [tokens])

    const handleSelectToken = (token: TokenInfo) => {
        onSelectToken(token)
        onClose()
    }

    // Handle chain selection - disconnect wallet and update global chain state
    const { disconnect } = useDisconnect()
    const { isConnected } = useAccount()

    const handleChainSelect = (chainId: number) => {
        // Update local UI state
        setSelectedChainId(chainId)

        // Update global Zustand state - SwapInterface will react to this
        setSelectedChain(chainId)

        // If wallet is connected and user selects a DIFFERENT chain, disconnect
        if (isConnected && chainId !== connectedChainId) {
            console.log(`[TokenSelector] 🔄 Switching to chain ${chainId} - disconnecting wallet`)
            disconnect()
        }
    }

    const truncateAddress = (addr: string) => {
        if (addr === "0x0000000000000000000000000000000000000000") return "Native"
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AnimatePresence>
                {isOpen && (
                    <DialogPortal forceMount>
                        <motion.div
                            className="fixed inset-0 z-50 bg-black/50"
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            variants={overlayVariants}
                            transition={{ duration: 0.2 }}
                        />

                        <motion.div
                            className="fixed z-50 w-full h-full md:h-auto md:max-w-[420px] md:top-[50%] md:left-[50%] md:-translate-x-1/2 md:-translate-y-1/2 top-0 left-0"
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        >
                            <DialogPrimitive.Content
                                className="bg-card h-full md:h-auto md:rounded-[20px] overflow-hidden dark:border dark:border-border/40 outline-none flex flex-col"
                                style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}
                            >
                                <DialogTitle className="sr-only">Select a token</DialogTitle>

                                {/* Search Header */}
                                <div className="p-3 pb-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search name or paste address..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-9 h-9 bg-transparent border-0 rounded-none shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60"
                                        />
                                        <button
                                            onClick={onClose}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                                        >
                                            <X className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>

                                <div className="h-[0.1px] bg-gray-200 dark:bg-gray-700 w-full" />

                                {/* Chain Selector */}
                                <div className="px-4 py-2">
                                    <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                                        {availableChains.map((chain, index) => (
                                            <motion.button
                                                key={chain.id}
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.03, type: "spring", stiffness: 400, damping: 15 }}
                                                onClick={() => handleChainSelect(chain.id)}
                                                className={`relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer overflow-hidden ${selectedChainId === chain.id ? '' : 'opacity-50 hover:opacity-90'}`}
                                            >
                                                {chain.logoUrl || (chain as any).logourl ? (
                                                    <img src={chain.logoUrl || (chain as any).logourl} alt={chain.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-primary flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold">{chain.name[0]}</span>
                                                    </div>
                                                )}
                                                {selectedChainId === chain.id && (
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-background">
                                                        <Check className="w-2.5 h-2.5 text-white" />
                                                    </div>
                                                )}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-[0.1px] bg-gray-200 dark:bg-gray-700 w-full" />

                                {/* Popular Tokens */}
                                {favoriteTokens.length > 0 && (
                                    <div className="px-3 py-2">
                                        <div className="flex items-center gap-1 mb-2">
                                            <span className="text-xs font-medium text-foreground">Popular tokens</span>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {favoriteTokens.map((token, index) => (
                                                <motion.button
                                                    key={token.symbol}
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: 0.1 + index * 0.03 }}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleSelectToken(token)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-full border border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
                                                >
                                                    <div className="w-4 h-4 rounded-full overflow-hidden">
                                                        {token.logoURI ? (
                                                            <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-primary flex items-center justify-center">
                                                                <span className="text-white text-[8px]">{token.symbol[0]}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-medium">{token.symbol}</span>
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="h-[0.1px] bg-gray-200 dark:bg-gray-700 w-full" />

                                {/* Token List */}
                                <div className="flex-1 min-h-0">
                                    <ScrollArea className="h-full md:h-[220px]">
                                        <div className="px-1">
                                            {filteredTokens.length === 0 ? (
                                                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                                                    {tokens.length === 0 ? "No tokens available for this chain" : "No tokens found"}
                                                </div>
                                            ) : (
                                                <AnimatePresence mode="popLayout">
                                                    {filteredTokens.map((token, index) => (
                                                        <motion.button
                                                            key={`${token.address}-${token.symbol}`}
                                                            layout
                                                            initial={{ opacity: 0, x: -30 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: 30, transition: { duration: 0.1 } }}
                                                            transition={{ delay: 0.05 + index * 0.02, type: "spring", stiffness: 300, damping: 25 }}
                                                            onClick={() => handleSelectToken(token)}
                                                            className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-muted/70 dark:hover:bg-white/10 ${selectedToken === token.symbol ? 'bg-blue-500/10' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="relative">
                                                                    <div className="w-8 h-8 rounded-full overflow-hidden">
                                                                        {token.logoURI ? (
                                                                            <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full bg-primary flex items-center justify-center">
                                                                                <span className="text-white text-sm">{token.symbol[0]}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {selectedToken === token.symbol && (
                                                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-background">
                                                                            <Check className="w-2.5 h-2.5 text-white" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-semibold text-sm">{token.symbol}</span>
                                                                        <span className="text-[10px] text-muted-foreground">{truncateAddress(token.address)}</span>
                                                                        <Info className="w-3 h-3 text-muted-foreground" />
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs text-muted-foreground">{token.name}</span>
                                                                        {token.isStable && (
                                                                            <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">Stable</span>
                                                                        )}
                                                                        {token.isLST && (
                                                                            <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">LST</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-medium">
                                                                {(() => {
                                                                    const tokenBalance = walletBalances.tokens.find(b => b.address.toLowerCase() === token.address.toLowerCase())
                                                                    if (!tokenBalance || tokenBalance.balance === 0) return '0'
                                                                    if (tokenBalance.balance < 0.0001) return '<0.0001'
                                                                    return tokenBalance.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                                                })()}
                                                            </span>
                                                        </motion.button>
                                                    ))}
                                                </AnimatePresence>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Footer */}
                                <motion.div
                                    className="px-3 py-1.5 border-t border-border/30 mt-auto"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    <button className="flex items-center justify-center gap-1.5 w-full text-primary hover:opacity-80 transition-opacity cursor-pointer py-0.5">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Manage Token Lists</span>
                                    </button>
                                </motion.div>
                            </DialogPrimitive.Content>
                        </motion.div>
                    </DialogPortal>
                )}
            </AnimatePresence>
        </Dialog>
    )
}
