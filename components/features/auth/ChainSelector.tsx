"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Loader2, Network } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { useChainConfig } from "@/hooks/useChainConfig"
import { Button } from "@/components/ui/button"
import { useAppKit, useAppKitNetwork } from '@reown/appkit/react'
import { useAccount } from "wagmi"
import { cn } from "@/lib/utils"
// import Image from "next/image" // Assuming logos are URLs

export function ChainSelector() {
    const isChainSelectorOpen = useAppStore(state => state.isChainSelectorOpen)
    const closeChainSelector = useAppStore(state => state.closeChainSelector)
    const setSelectedChain = useAppStore(state => state.setSelectedChain)
    const selectedChainId = useAppStore(state => state.selectedChainId)
    const { chains, isLoading } = useChainConfig()
    const { isConnected, chainId } = useAccount()
    // const isConnected = useAppStore(state => state.isConnected) // Use store for consistency - Actually let's trust wagmi for real-time chain ID
    const { open } = useAppKit()
    const { switchNetwork } = useAppKitNetwork()
    const [hoveredChain, setHoveredChain] = useState<number | null>(null)

    // Reset selection when modal closes or unmounts, or ensure it syncs with actual connection
    // But for the selector, we want to show what is clicked. 
    // If we want it to NOT persist if connection fails, we should perhaps not set it global until connected?
    // Actually, "selected" implies "Connect to THIS". 
    // We can clear it on close if not connected.

    useEffect(() => {
        if (!isChainSelectorOpen && !isConnected) {
            // If closed and not connected, maybe we shouldn't reset? 
            // User said: "chain shows selected style on the chain select modal" implies when they reopen it? 
            // Or while it's open? 
            // "even though chain wallet connect was not successful" -> implies they are back in the modal.
            // Let's reset it on mount/open?
            // Logic to reset if needed
        }
    }, [isChainSelectorOpen, isConnected])

    // Better: Only show "selected" visual if it's the *target*. 
    // But user wants it to NOT be selected if failed. 
    // I will simply remove the "selected" state persistence by clearing it when the modal opens?

    useEffect(() => {
        if (isChainSelectorOpen && !isConnected) {
            setSelectedChain(null)
        }
    }, [isChainSelectorOpen, isConnected, setSelectedChain])

    // Handle chain selection
    const handleSelectChain = async (chainId: number) => {
        setSelectedChain(chainId)
        closeChainSelector()

        // If wallet is already connected, try to switch network directly
        if (isConnected) {
            try {
                await switchNetwork({
                    id: chainId,
                    caipNetworkId: `eip155:${chainId}`
                } as any)
            } catch (error) {
                console.error("Failed to switch network:", error)
                // If switch fails, maybe open the modal as fallback?
                await open({ view: 'Networks' })
            }
            return
        }

        // If not connected, attempt to switch network (prime it) then open standard connect
        try {
            await switchNetwork({
                id: chainId,
                caipNetworkId: `eip155:${chainId}`
            } as any)
        } catch (e) {
            console.warn("Failed to pre-switch network", e)
        }

        await open({ view: 'Connect' })
    }

    // Determine grid columns
    const gridCols = chains && chains.length > 4 ? "grid-cols-3" : "grid-cols-2"

    return (
        <AnimatePresence>
            {isChainSelectorOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeChainSelector}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative w-full max-w-lg bg-background/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden dark:bg-card/90 dark:border-white/10"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">
                                    Select Network
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Choose a chain to connect your wallet
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={closeChainSelector} className="rounded-full hover:bg-muted/20">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Chain Grid */}
                        <div className="p-6">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-sm">Loading networks...</span>
                                </div>
                            ) : (
                                <div className={cn("grid gap-3", gridCols)}>
                                    {chains?.map((chain) => {
                                        const isActive = selectedChainId === chain.id || (isConnected && chainId === chain.id)

                                        return (
                                            <motion.button
                                                key={chain.id}
                                                onClick={() => handleSelectChain(chain.id)}
                                                onMouseEnter={() => setHoveredChain(chain.id)}
                                                onMouseLeave={() => setHoveredChain(null)}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className={cn(
                                                    "relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 group cursor-pointer",
                                                    isActive
                                                        ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
                                                        : "border-border/40 bg-card/50 hover:border-border/80 hover:bg-card/80 dark:bg-white/5 dark:hover:bg-white/10"
                                                )}
                                            >
                                                <div className="relative h-12 w-12 mb-3 rounded-full bg-background flex items-center justify-center border border-border shadow-sm group-hover:shadow-md transition-shadow">
                                                    {/* @ts-ignore */}
                                                    {chain.logoUrl || chain.logourl ? (
                                                        <img
                                                            // @ts-ignore
                                                            src={chain.logoUrl || chain.logourl}
                                                            alt={chain.name}
                                                            className="h-8 w-8 object-contain"
                                                        />
                                                    ) : (
                                                        <Network className="h-6 w-6 text-muted-foreground" />
                                                    )}

                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="check"
                                                            className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5"
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </motion.div>
                                                    )}
                                                </div>

                                                <span className="font-semibold text-sm text-center">
                                                    {chain.name}
                                                </span>

                                                {/* Hover Glow Effect */}
                                                {hoveredChain === chain.id && (
                                                    <motion.div
                                                        layoutId="glow"
                                                        className="absolute inset-0 rounded-2xl bg-white/5 pointer-events-none"
                                                        transition={{ duration: 0.2 }}
                                                    />
                                                )}
                                            </motion.button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
