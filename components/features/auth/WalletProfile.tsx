"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Copy,
    LogOut,
    ExternalLink,
    ChevronDown,
    Loader2,
    Wallet,
    Check,
    RefreshCw,
    Network
} from "lucide-react"
import { useAccount, useDisconnect } from "wagmi"
import { useAppStore } from "@/store/useAppStore"
import { useChainConfig } from "@/hooks/useChainConfig"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
// Assuming exists or I will create simple copy logic

export function WalletProfile() {
    const { address, isConnected, isConnecting, chainId } = useAccount()
    const { disconnect } = useDisconnect()
    const openChainSelector = useAppStore(state => state.openChainSelector)
    const userProfile = useAppStore(state => state.userProfile)
    const { chains } = useChainConfig()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [copied, setCopied] = useState(false)

    // Find current chain info
    const currentChain = chains?.find(c => c.id === chainId)

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleCopy = () => {
        if (address) {
            navigator.clipboard.writeText(address)
            setCopied(true)
            toast.success("Address copied to clipboard")
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleDisconnect = () => {
        disconnect()
        setIsOpen(false)
        toast.info("Wallet disconnected")
    }

    // Use avatar from database, fallback to generated DiceBear URL
    const avatarUrl = userProfile?.avatarUrl
        || (address ? `https://api.dicebear.com/9.x/shapes/svg?seed=${address}` : "")

    if (isConnecting) {
        return (
            <Button
                disabled
                className="relative overflow-hidden bg-primary/10 text-primary border border-primary/20 rounded-full pl-3 pr-4 h-10 cursor-not-allowed"
            >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-xs font-medium">Connecting...</span>
                <motion.div
                    className="absolute inset-0 bg-white/20"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
            </Button>
        )
    }

    if (!isConnected || !address) {
        // Fallback to "Connect Wallet" if something is wrong, though Navbar handles this toggle usually.
        // But for completeness:
        return (
            <Button
                onClick={() => openChainSelector()}
                className="font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 shadow-[0_0_15px_rgba(234,88,12,0.3)] rounded-full h-10 px-6 group cursor-pointer"
            >
                <Wallet className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
                Connect Wallet
            </Button>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                    "flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all duration-200 cursor-pointer group",
                    isOpen
                        ? "bg-primary/15 border-primary/40 shadow-[0_0_15px_rgba(234,88,12,0.2)]"
                        : "bg-background/80 border-border/60 hover:bg-muted/60 hover:border-border/90"
                )}
            >
                {/* Avatar with Chain Badge */}
                <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 p-0.5 border border-primary/20 overflow-hidden">
                        <img
                            src={avatarUrl}
                            alt="Avatar"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    {/* Floating Chain Indicator */}
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background border border-border flex items-center justify-center shadow-sm overflow-hidden">
                        {/* @ts-ignore */}
                        {currentChain?.logoUrl || currentChain?.logourl ? (
                            <img
                                // @ts-ignore
                                src={currentChain.logoUrl || currentChain.logourl}
                                alt="Chain"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <Network className="h-2.5 w-2.5 text-muted-foreground" />
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-start mr-1">
                    <span className="text-xs font-bold text-foreground leading-none group-hover:text-primary transition-colors">
                        {address.slice(0, 4)}...{address.slice(-4)}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-none mt-0.5 font-medium">
                        {currentChain?.name || "Connected"}
                    </span>
                </div>
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200 group-hover:text-foreground", isOpen && "rotate-180")} />
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute right-0 mt-2 w-72 z-50 origin-top-right rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5"
                    >
                        {/* Chain Banner Background */}
                        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

                        {/* Header Section */}
                        <div className="relative p-5 flex flex-col items-center border-b border-border/40 z-10">
                            <div className="relative mb-3 group cursor-pointer" onClick={handleCopy}>
                                <div className="h-16 w-16 rounded-full border-2 border-primary/20 p-1 bg-background shadow-xl group-hover:border-primary/50 transition-colors">
                                    <img
                                        src={avatarUrl}
                                        alt="Avatar Large"
                                        className="h-full w-full rounded-full object-cover"
                                    />
                                </div>
                                <div className="absolute bottom-0 right-0 h-5 w-5 bg-green-500 border-[3px] border-background rounded-full shadow-sm" />
                            </div>

                            <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border border-border/50 mb-1 hover:bg-background/80 transition-colors cursor-pointer" onClick={handleCopy}>
                                <span className="text-xs font-mono text-foreground font-medium tracking-wide">
                                    {address.slice(0, 6)}...{address.slice(-6)}
                                </span>
                                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-2 space-y-1 bg-popover/50">
                            {/* Switch Network */}
                            <button
                                onClick={() => {
                                    setIsOpen(false)
                                    openChainSelector()
                                }}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-all group text-sm cursor-pointer border border-transparent hover:border-border/40"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform shadow-inner">
                                        {/* @ts-ignore */}
                                        {currentChain?.logoUrl || currentChain?.logourl ? (
                                            <img
                                                // @ts-ignore
                                                src={currentChain.logoUrl || currentChain.logourl}
                                                className="h-5 w-5 object-contain"
                                            />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium text-foreground">Switch Network</span>
                                        <span className="text-xs text-muted-foreground">
                                            Current: <span className="text-primary">{currentChain?.name || "Unknown"}</span>
                                        </span>
                                    </div>
                                </div>
                                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </button>

                            {/* Disconnect */}
                            <button
                                onClick={handleDisconnect}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all group text-sm cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform shadow-inner">
                                        <LogOut className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium group-hover:text-red-500 text-foreground transition-colors">Disconnect</span>
                                        <span className="text-xs text-muted-foreground group-hover:text-red-400/80 transition-colors">End session</span>
                                    </div>
                                </div>
                            </button>
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-border/40 bg-muted/30 text-center">
                            <span className="text-[10px] text-muted-foreground font-medium">Connected with ZeroCore™</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
