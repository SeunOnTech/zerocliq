"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { useAccount } from 'wagmi'

/**
 * SmartAccountBanner - A subtle, non-intrusive top banner
 * 
 * Appears for users who don't have a smart account set up.
 * Dismissible and persisted to localStorage.
 */
export function SmartAccountBanner() {
    const { isConnected } = useAccount()
    const userProfile = useAppStore((s) => s.userProfile)
    const hasDismissedBanner = useAppStore((s) => s.hasDismissedBanner)
    const dismissBanner = useAppStore((s) => s.dismissBanner)
    const showPrompt = useAppStore((s) => s.showPrompt)

    // Only show for connected users without deployed smart account
    const shouldShow = isConnected
        && userProfile
        && userProfile.smartAccountStatus !== 'DEPLOYED'
        && !hasDismissedBanner

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                    <div className="bg-primary/5 border-b border-primary/10">
                        <div className="max-w-7xl mx-auto px-4 py-2.5">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex-shrink-0 p-1.5 rounded-lg bg-primary/10">
                                        <Zap className="w-4 h-4 text-primary" />
                                    </div>
                                    <p className="text-sm text-foreground/80 truncate">
                                        <span className="font-medium text-primary">Enable gasless trading</span>
                                        <span className="hidden sm:inline"> — Save on every transaction</span>
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button
                                        size="sm"
                                        onClick={showPrompt}
                                        className="h-7 px-3 text-xs font-medium rounded-lg"
                                    >
                                        <Sparkles className="w-3 h-3 mr-1.5" />
                                        Set Up
                                    </Button>
                                    <button
                                        onClick={dismissBanner}
                                        className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="Dismiss"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
