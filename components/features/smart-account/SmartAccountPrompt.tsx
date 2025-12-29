"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Shield, Wallet, Loader2, CheckCircle2, X, Sparkles, Copy, Check, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { useWalletClient, useAccount, useChainId } from 'wagmi'
import { deploySmartAccount, getSmartAccountAddress } from '@/lib/smart-account'
import { toast } from '@/components/ui/toast'
import confetti from 'canvas-confetti'
import type { Address, Hex } from 'viem'
import { createNotification } from '@/hooks/useNotificationStore'
import { logActivity } from '@/hooks/useActivityStore'

/**
 * SmartAccountPrompt - Premium modal for smart account creation & deployment
 * 
 * Handles both NEW_USER (no smart account) and NEEDS_DEPLOYMENT (counterfactual) states.
 * Uses bundler for gasless deployment via UserOperation.
 */
export function SmartAccountPrompt() {
    const userProfile = useAppStore((s) => s.userProfile)
    const showSmartAccountPrompt = useAppStore((s) => s.showSmartAccountPrompt)
    const hidePrompt = useAppStore((s) => s.hidePrompt)
    const smartAccountFlow = useAppStore((s) => s.smartAccountFlow)
    const setSmartAccountFlow = useAppStore((s) => s.setSmartAccountFlow)
    const setSmartAccountError = useAppStore((s) => s.setSmartAccountError)
    const syncUserToDb = useAppStore((s) => s.syncUserToDb)
    const clearSyncKey = useAppStore((s) => s.clearSyncKey)
    const skipSetup = useAppStore((s) => s.skipSetup)

    const { data: walletClient } = useWalletClient()
    const { address } = useAccount()
    const chainId = useChainId()

    const [copied, setCopied] = useState(false)
    const [step, setStep] = useState<'intro' | 'processing' | 'success'>('intro')
    const [deployedAddress, setDeployedAddress] = useState<Address | null>(null)
    const [deploymentTxHash, setDeploymentTxHash] = useState<Hex | null>(null)

    const status = userProfile?.smartAccountStatus || 'NONE'
    const smartAccountAddress = userProfile?.smartAccountAddress

    // Reset step when modal opens
    useEffect(() => {
        if (showSmartAccountPrompt) {
            setStep('intro')
            setDeploymentTxHash(null)
        }
    }, [showSmartAccountPrompt])

    const handleCopy = () => {
        const addrToCopy = deployedAddress || smartAccountAddress
        if (addrToCopy) {
            navigator.clipboard.writeText(addrToCopy)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const getExplorerUrl = (hash: Hex) => {
        const explorers: Record<number, string> = {
            1: 'https://etherscan.io/tx/',
            11155111: 'https://sepolia.etherscan.io/tx/',
            8453: 'https://basescan.org/tx/',
            84532: 'https://sepolia.basescan.org/tx/',
            143: 'https://monadvision.com/tx/',
        }
        return `${explorers[chainId] || 'https://etherscan.io/tx/'}${hash}`
    }

    const handleActivate = async () => {
        if (!address || !chainId || !walletClient) {
            toast.error('Wallet not connected', 'Please connect your wallet to continue.')
            return
        }

        setStep('processing')
        setSmartAccountFlow('computing')

        try {
            // Step 1: Compute address (for display)
            const computedAddress = await getSmartAccountAddress(address, chainId)
            setDeployedAddress(computedAddress)
            console.log('[SmartAccountPrompt] Computed address:', computedAddress)

            // Step 2: Deploy via bundler
            setSmartAccountFlow('deploying')
            const result = await deploySmartAccount(address, chainId, walletClient)

            if (result.success) {
                setSmartAccountFlow('success')
                setStep('success')
                setDeploymentTxHash(result.txHash || null)

                // Celebration! 🎉
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#22c55e', '#10b981', '#34d399', '#6ee7b7'],
                    disableForReducedMotion: true
                })

                // Success toast with deployment hash
                toast.success(
                    'Smart Account Deployed! 🎉',
                    'Your gasless trading is now enabled.',
                    result.txHash ? {
                        action: {
                            label: 'View Transaction',
                            href: getExplorerUrl(result.txHash)
                        }
                    } : undefined
                )

                // Force fresh sync to get DEPLOYED status
                clearSyncKey()
                await syncUserToDb({ forceRefresh: true })

                // Log notification and activity
                if (address) {
                    createNotification({
                        walletAddress: address,
                        chainId,
                        type: 'SMART_ACCOUNT_DEPLOYED',
                        title: 'Smart Account Deployed',
                        message: 'Your Smart Account is now active and ready for gasless transactions.',
                        metadata: {
                            smartAccountAddress: computedAddress,
                            txHash: result.txHash,
                        }
                    })

                    logActivity({
                        walletAddress: address,
                        chainId,
                        type: 'SMART_ACCOUNT_DEPLOY',
                        status: 'SUCCESS',
                        title: 'Smart Account Deployed',
                        description: `Smart Account ${computedAddress.slice(0, 6)}...${computedAddress.slice(-4)} is now active`,
                        txHash: result.txHash || undefined,
                        metadata: {
                            smartAccountAddress: computedAddress,
                        }
                    })
                }
            } else {
                setSmartAccountFlow('error')
                setSmartAccountError(result.error || 'Failed to deploy smart account')
                setStep('intro')

                // Error toast
                toast.error(
                    'Deployment Failed',
                    result.error || 'Something went wrong. Please try again.',
                    { duration: 8000 }
                )
            }
        } catch (error: any) {
            console.error('[SmartAccountPrompt] Error:', error)
            setSmartAccountFlow('error')
            setSmartAccountError(error.message || 'An unexpected error occurred')
            setStep('intro')

            // Error toast
            toast.error(
                'Deployment Failed',
                error.message || 'Please check your wallet and try again.',
                { duration: 8000 }
            )
        }
    }

    const handleClose = () => {
        hidePrompt()
        setStep('intro')
        setSmartAccountFlow('idle')
    }

    const handleSkip = () => {
        skipSetup()
        handleClose()
    }

    if (!showSmartAccountPrompt) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden md:block fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative bg-card md:border border-border md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-md overflow-y-auto"
            >
                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-10"
                >
                    <X className="w-4 h-4" />
                </button>

                <AnimatePresence mode="wait">
                    {/* Intro Step */}
                    {step === 'intro' && (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex flex-col h-full md:h-auto min-h-[100dvh] md:min-h-0"
                        >
                            <div className="flex-1 flex flex-col justify-center p-6 space-y-6 overflow-y-auto">
                                {/* Header */}
                                <div className="text-center space-y-3 pt-2">
                                    <div className="inline-flex p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                                        <Wallet className="w-7 h-7 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">
                                        {status === 'NONE' ? 'Create Smart Account' : 'Deploy Smart Account'}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Enable gasless trading on ZeroCliq
                                    </p>
                                </div>

                                {/* What is Smart Account */}
                                <div className="bg-muted/30 border border-border rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                            <Sparkles className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground">What is a Smart Account?</h3>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                A new wallet address linked to your current wallet. Your existing wallet becomes the "key" to control it, enabling gasless trades and automation.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Benefits */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                                        Benefits
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/20 border border-border">
                                            <Zap className="w-5 h-5 text-amber-500 mb-1.5" />
                                            <span className="text-[11px] font-medium text-foreground">Zero Gas</span>
                                            <span className="text-[9px] text-muted-foreground mt-0.5">We pay all fees</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/20 border border-border">
                                            <Shield className="w-5 h-5 text-emerald-500 mb-1.5" />
                                            <span className="text-[11px] font-medium text-foreground">Secure</span>
                                            <span className="text-[9px] text-muted-foreground mt-0.5">Session limits</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/20 border border-border">
                                            <Wallet className="w-5 h-5 text-blue-500 mb-1.5" />
                                            <span className="text-[11px] font-medium text-foreground">Smart Cards</span>
                                            <span className="text-[9px] text-muted-foreground mt-0.5">Auto orders</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            <div className="p-6 pt-0 space-y-3 pb-safe">
                                <Button
                                    onClick={handleActivate}
                                    disabled={!address || !walletClient}
                                    className="w-full h-12 text-sm font-semibold"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    {status === 'NONE' ? 'Create & Deploy — Free' : 'Deploy Now — Free'}
                                </Button>
                                <button
                                    onClick={handleSkip}
                                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Processing Step */}
                    {step === 'processing' && (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="p-8 flex flex-col items-center justify-center space-y-6 min-h-[300px]"
                        >
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full border-4 border-primary/20" />
                                <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Wallet className="w-8 h-8 text-primary" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-semibold text-foreground">
                                    {smartAccountFlow === 'computing' && 'Computing address...'}
                                    {smartAccountFlow === 'signing' && 'Waiting for signature...'}
                                    {smartAccountFlow === 'deploying' && 'Deploying on-chain...'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    This is completely free — no gas required
                                </p>
                            </div>

                            {/* Show computed address while processing */}
                            {deployedAddress && (
                                <div
                                    onClick={handleCopy}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/30 border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                                >
                                    <code className="text-xs font-mono text-foreground">
                                        {deployedAddress.slice(0, 8)}...{deployedAddress.slice(-6)}
                                    </code>
                                    {copied ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Success Step */}
                    {step === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-6 space-y-6"
                        >
                            {/* Header */}
                            <div className="text-center space-y-3 pt-2">
                                <div className="inline-flex p-4 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-xl font-bold text-foreground">You're All Set! 🎉</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Gasless trading is now enabled
                                    </p>
                                </div>
                            </div>

                            {/* Smart Account Address */}
                            {deployedAddress && (
                                <div
                                    onClick={handleCopy}
                                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border cursor-pointer hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                            <Wallet className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Smart Account</p>
                                            <code className="text-sm font-mono text-foreground">
                                                {deployedAddress.slice(0, 8)}...{deployedAddress.slice(-6)}
                                            </code>
                                        </div>
                                    </div>
                                    {copied ? (
                                        <Check className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                                    )}
                                </div>
                            )}

                            {/* Deployment Transaction */}
                            {deploymentTxHash && (
                                <a
                                    href={getExplorerUrl(deploymentTxHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        </div>
                                        <code className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
                                            {deploymentTxHash.slice(0, 10)}...{deploymentTxHash.slice(-8)}
                                        </code>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
                                </a>
                            )}

                            {/* What's next */}
                            <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
                                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                                    What you can do now:
                                </h3>
                                <ul className="space-y-2 text-xs text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary font-bold text-[8px] mt-0.5">1</span>
                                        <span><span className="font-medium text-foreground">Swap tokens</span> without paying gas</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary font-bold text-[8px] mt-0.5">2</span>
                                        <span><span className="font-medium text-foreground">Create Trade Smart Cards</span> for automated trading</span>
                                    </li>
                                </ul>
                            </div>

                            {/* CTA */}
                            <Button
                                onClick={handleClose}
                                className="w-full h-12 text-sm font-semibold"
                            >
                                Start Trading
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
