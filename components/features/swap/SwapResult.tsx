
import React from 'react'
import { motion } from "framer-motion"
import { ChevronLeft, AlertTriangle, ExternalLink, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getExplorerTxUrl } from "@/lib/chains"

// Token type compatible with TokenInfo from TokenSelectorModal
interface Token {
    symbol: string
    logoURI?: string
    balance?: string
}

// Helper component to render token logo from URL
function TokenLogo({ logoURI, symbol, size = 24 }: { logoURI?: string; symbol: string; size?: number }) {
    if (logoURI) {
        return <img src={logoURI} alt={symbol} className="w-full h-full object-cover rounded-full" />
    }
    return (
        <div className="w-full h-full bg-primary rounded-full flex items-center justify-center">
            <span className="text-white font-bold" style={{ fontSize: size * 0.5 }}>{symbol[0]}</span>
        </div>
    )
}

interface SwapResultProps {
    sellToken: Token
    buyToken: Token
    sellAmount: string
    buyAmount: string
    onBack: () => void
    txHash?: string
    errorMessage?: string
    gasSaved?: string
    chainId?: number
}

export function SwapSuccess({ sellToken, buyToken, sellAmount, buyAmount, onBack, txHash, gasSaved = "$5.42", chainId }: SwapResultProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col w-full bg-card backdrop-blur-xl rounded-[24px] overflow-hidden relative shadow-xl border dark:border-border/50"
        >
            {/* Header - Minimal */}
            <div className="absolute top-4 left-4 z-20">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
                >
                    <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                </button>
            </div>

            {/* Content Container - Compact */}
            <div className="flex-1 flex flex-col px-5 pt-10 pb-5 gap-3 items-center text-center">

                {/* Main Success Visual */}
                <div className="flex flex-col items-center justify-center">
                    <div className="relative mb-3">
                        <motion.div
                            className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center relative z-10 shadow-lg shadow-emerald-500/25"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <motion.path
                                    d="M20 6L9 17l-5-5"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.4, delay: 0.2 }}
                                />
                            </svg>
                        </motion.div>
                    </div>

                    <div className="flex flex-col items-center gap-0.5">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">You Received</div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-3xl font-bold text-foreground tracking-tight">{buyAmount}</span>
                            <span className="text-xl font-bold text-muted-foreground">{buyToken.symbol}</span>
                        </div>
                    </div>
                </div>

                {/* The Narrative - Emphasizing Smart Card & Sponsorship */}
                <div className="bg-muted/30 rounded-xl p-3.5 border border-border/50 w-full">
                    <div className="text-xs leading-relaxed text-muted-foreground/90">
                        Executed via your <span className="font-bold text-foreground inline-flex items-center gap-1"><CreditCard className="w-3 h-3" />Trade Smart Card</span>.
                        <br className="my-1.5 block h-0" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">ZeroCliq</span> sponsored the gas fees.
                        <div className="mt-1.5 pt-1.5 border-t border-border/50 flex justify-center">
                            <span className="font-medium text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                You saved {gasSaved}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Explorer Link - Tiny/Footer */}
                <a
                    href={txHash && chainId ? getExplorerTxUrl(chainId, txHash) : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer opacity-70 hover:opacity-100"
                >
                    <span>View on Explorer</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                </a>

                {/* Big Done Button */}
                <Button
                    onClick={onBack}
                    className="w-full h-11 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 mt-1"
                >
                    Done
                </Button>
            </div>
        </motion.div>
    )
}

export function SwapError({ sellToken, buyToken, sellAmount, buyAmount, onBack, errorMessage }: SwapResultProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col w-full bg-card backdrop-blur-xl rounded-[24px] overflow-hidden relative shadow-xl border dark:border-border/50 min-h-[350px]"
        >
            {/* Header */}
            <div className="absolute top-4 left-4 z-20">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
                >
                    <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                </button>
            </div>

            <div className="flex-1 flex flex-col px-6 items-center justify-center text-center gap-4 pt-8 pb-6">
                {/* Error Icon */}
                <div className="relative">
                    <motion.div
                        className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center relative z-10"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                        <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" strokeWidth={2.5} />
                    </motion.div>
                </div>

                {/* Message */}
                <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Transaction Failed</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
                        {errorMessage || "The transaction could not be completed."}
                    </p>
                </div>

                {/* Actions */}
                <div className="w-full space-y-2 mt-2">
                    <Button
                        onClick={onBack}
                        className="w-full h-10 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20"
                    >
                        Try Again
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}
