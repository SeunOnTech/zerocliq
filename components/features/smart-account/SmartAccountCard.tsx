"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Shield, Wallet, ArrowRight, Loader2, CheckCircle2, X, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SmartAccountCardProps {
    /** Estimated gas cost in USD for the current transaction */
    estimatedGasCost?: string
    /** Callback when user chooses to proceed without smart account */
    onProceedWithGas?: () => void
    /** Callback when smart account setup is complete */
    onSetupComplete?: () => void
    /** Custom class name */
    className?: string
}

/**
 * SmartAccountCard - Contextual card shown in swap interface
 * 
 * Educates users about gasless trading and provides a non-blocking
 * way to set up their smart account right before a transaction.
 */
export function SmartAccountCard({
    estimatedGasCost = "$0.50",
    onProceedWithGas,
    onSetupComplete,
    className,
}: SmartAccountCardProps) {
    const userProfile = useAppStore((s) => s.userProfile)
    const smartAccountFlow = useAppStore((s) => s.smartAccountFlow)
    const setSmartAccountFlow = useAppStore((s) => s.setSmartAccountFlow)
    const hasSkippedSetup = useAppStore((s) => s.hasSkippedSetup)
    const skipSetup = useAppStore((s) => s.skipSetup)
    const syncUserToDb = useAppStore((s) => s.syncUserToDb)

    const [isExpanded, setIsExpanded] = useState(false)

    // Determine current state
    const status = userProfile?.smartAccountStatus || 'NONE'
    const isLoading = smartAccountFlow === 'computing' || smartAccountFlow === 'deploying' || smartAccountFlow === 'signing'
    const isSuccess = smartAccountFlow === 'success'

    // Don't show if fully set up or if user has skipped
    if (status === 'DEPLOYED' || hasSkippedSetup) {
        return null
    }

    const handleActivate = async () => {
        setSmartAccountFlow('computing')

        try {
            const response = await fetch('/api/smart-account/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: userProfile?.walletAddress,
                    chainId: userProfile?.chainId,
                }),
            })

            const data = await response.json()

            if (data.success) {
                setSmartAccountFlow('success')
                // Refresh user profile
                await syncUserToDb()
                onSetupComplete?.()
            } else {
                setSmartAccountFlow('error')
            }
        } catch (error) {
            console.error('[SmartAccountCard] Error:', error)
            setSmartAccountFlow('error')
        }
    }

    const handleSkip = () => {
        skipSetup()
        onProceedWithGas?.()
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "border border-border rounded-xl overflow-hidden bg-card",
                className
            )}
        >
            {/* Collapsed state - just the teaser */}
            <AnimatePresence mode="wait">
                {!isExpanded && !isLoading && !isSuccess && (
                    <motion.div
                        key="collapsed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-4"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                    <Zap className="w-4 h-4 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground">
                                        This swap will cost ~{estimatedGasCost} in gas
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Enable gasless mode to trade for free
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => setIsExpanded(true)}
                                className="flex-shrink-0"
                            >
                                Learn More
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Expanded state - full education */}
                {isExpanded && !isLoading && !isSuccess && (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-5"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="space-y-5">
                            {/* Header */}
                            <div className="text-center space-y-2">
                                <div className="inline-flex p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                                    <Sparkles className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">
                                    {status === 'NONE' ? 'Enable Gasless Trading' : 'Activate Your Smart Account'}
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                                    ZeroCliq sponsors all your gas fees. Trade without limits.
                                </p>
                            </div>

                            {/* Benefits */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-muted/50 border border-border space-y-2">
                                    <Zap className="w-4 h-4 text-amber-500" />
                                    <div>
                                        <p className="text-xs font-medium text-foreground">Zero Gas Fees</p>
                                        <p className="text-[10px] text-muted-foreground">We pay, you save</p>
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl bg-muted/50 border border-border space-y-2">
                                    <Shield className="w-4 h-4 text-emerald-500" />
                                    <div>
                                        <p className="text-xs font-medium text-foreground">Enhanced Security</p>
                                        <p className="text-[10px] text-muted-foreground">Session keys & limits</p>
                                    </div>
                                </div>
                            </div>

                            {/* Gas comparison */}
                            <div className="flex items-center justify-center gap-6 py-3 px-4 rounded-xl bg-muted/30 border border-border">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-red-500 line-through">{estimatedGasCost}</p>
                                    <p className="text-[10px] text-muted-foreground">Normal gas</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                                <div className="text-center">
                                    <p className="text-lg font-bold text-emerald-500">$0.00</p>
                                    <p className="text-[10px] text-muted-foreground">With gasless</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <Button
                                    onClick={handleActivate}
                                    className="w-full h-11 text-sm font-semibold"
                                >
                                    <Zap className="w-4 h-4 mr-2" />
                                    {status === 'NONE' ? 'Enable Gasless Mode' : 'Activate Now'}
                                </Button>
                                <button
                                    onClick={handleSkip}
                                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Continue with gas fee ({estimatedGasCost})
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Loading state */}
                {isLoading && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-8 flex flex-col items-center justify-center space-y-4"
                    >
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
                            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Wallet className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-sm font-medium text-foreground">
                                {smartAccountFlow === 'computing' && 'Computing address...'}
                                {smartAccountFlow === 'signing' && 'Waiting for signature...'}
                                {smartAccountFlow === 'deploying' && 'Deploying...'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                This is completely free
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* Success state */}
                {isSuccess && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-6 flex flex-col items-center justify-center space-y-4"
                    >
                        <div className="p-4 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-base font-semibold text-foreground">
                                Gasless Mode Enabled! 🎉
                            </p>
                            <p className="text-xs text-muted-foreground">
                                You'll never pay gas fees on ZeroCliq again
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
