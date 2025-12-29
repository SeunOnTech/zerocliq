"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, ArrowRightLeft, Shield, Clock, CheckCircle2, X, Sparkles, Zap, Lock, AlertTriangle, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit'
import confetti from 'canvas-confetti'
import { toast } from '@/components/ui/toast'
import {
    getAgentSmartAccountAddress,
    createSmartCard,
    activateSmartCard,
} from '@/lib/smart-card'

/**
 * TradeCardPrompt - Premium modal for Trade Smart Card setup
 * 
 * Flow:
 * 1. Intro - Explain what Trade Card is
 * 2. Permissions - Show capabilities
 * 3. Processing - Create + Sign + Activate
 * 4. Success - Celebración!
 */

type TradeCardStep = 'intro' | 'permissions' | 'processing' | 'success' | 'error'

interface ProcessingPhase {
    id: 'init' | 'create' | 'sign' | 'activate' | 'complete'
    label: string
    status: 'pending' | 'active' | 'done' | 'error'
}

interface TradeCardPromptProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

export function TradeCardPrompt({ isOpen, onClose, onSuccess }: TradeCardPromptProps) {
    const setHasTradeCard = useAppStore((s) => s.setHasTradeCard)
    const setTradeCardId = useAppStore((s) => s.setTradeCardId)
    const userProfile = useAppStore((s) => s.userProfile)

    const { address, chainId } = useAccount()
    const { data: walletClient } = useWalletClient()
    const publicClient = usePublicClient()

    const [step, setStep] = useState<TradeCardStep>('intro')
    const [errorMessage, setErrorMessage] = useState('')
    const [phases, setPhases] = useState<ProcessingPhase[]>([
        { id: 'init', label: 'Initializing', status: 'pending' },
        { id: 'create', label: 'Creating card', status: 'pending' },
        { id: 'sign', label: 'Awaiting signature', status: 'pending' },
        { id: 'activate', label: 'Activating', status: 'pending' },
    ])

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('intro')
            setErrorMessage('')
            setPhases([
                { id: 'init', label: 'Initializing', status: 'pending' },
                { id: 'create', label: 'Creating card', status: 'pending' },
                { id: 'sign', label: 'Awaiting signature', status: 'pending' },
                { id: 'activate', label: 'Activating', status: 'pending' },
            ])
        }
    }, [isOpen])

    const updatePhase = (id: string, status: ProcessingPhase['status']) => {
        setPhases(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    }

    const handleContinue = () => {
        setStep('permissions')
    }

    const handleCreateCard = async () => {
        if (!address || !chainId || !walletClient || !publicClient) {
            toast.error('Connection Required', 'Please connect your wallet')
            return
        }

        // Must have Smart Account deployed
        if (!userProfile?.smartAccountAddress || userProfile.smartAccountStatus !== 'DEPLOYED') {
            toast.error('Smart Account Required', 'Deploy your Smart Account first')
            return
        }

        setStep('processing')
        setErrorMessage('')

        try {
            // Phase 1: Initialize
            updatePhase('init', 'active')
            console.log('[TradeCard] Starting creation for', address, 'on chain', chainId)

            // Get Agent Smart Account address
            const agentAddress = await getAgentSmartAccountAddress(chainId)
            if (!agentAddress) {
                throw new Error('Failed to get agent configuration')
            }
            console.log('[TradeCard] Agent SA:', agentAddress)
            updatePhase('init', 'done')

            // Phase 2: Create Smart Card
            updatePhase('create', 'active')
            const createResult = await createSmartCard({
                userId: address,
                chainId,
                type: 'TRADING',
                delegatorAddress: userProfile.smartAccountAddress,
                delegateAddress: agentAddress,
            })

            if (!createResult.success || !createResult.delegation) {
                throw new Error(createResult.error || 'Failed to create Trade Card')
            }
            console.log('[TradeCard] Created:', createResult.smartCardId)
            updatePhase('create', 'done')

            // Phase 3: Sign delegation
            updatePhase('sign', 'active')

            // Create user's Smart Account for signing
            const userSmartAccount = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [address, [], [], []],
                deploySalt: "0x",
                signer: { walletClient },
            })

            // Reconstruct delegation with BigInt salt
            const saltStr = createResult.delegation.salt?.toString() || "0"
            let saltBigInt: bigint
            if (saltStr === "0x" || saltStr === "" || saltStr === "0") {
                saltBigInt = 0n
            } else {
                saltBigInt = BigInt(saltStr)
            }

            const delegation = {
                ...createResult.delegation,
                salt: saltBigInt,
            }

            console.log('[TradeCard] Signing delegation...')
            const signature = await userSmartAccount.signDelegation({ delegation })
            console.log('[TradeCard] Signed!')
            updatePhase('sign', 'done')

            // Phase 4: Activate
            updatePhase('activate', 'active')
            const activateResult = await activateSmartCard(createResult.smartCardId, signature)

            if (!activateResult.success) {
                throw new Error(activateResult.error || 'Failed to activate Trade Card')
            }
            console.log('[TradeCard] Activated!')
            updatePhase('activate', 'done')

            // Success!
            setStep('success')
            setHasTradeCard(true)
            setTradeCardId(createResult.smartCardId)  // Store the card ID for swap execution

            // Celebration
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa'],
                disableForReducedMotion: true
            })

            toast.success('Trade Card Active!', 'You can now swap gaslessly')
            onSuccess?.()

        } catch (error: any) {
            console.error('[TradeCard] Error:', error)
            setErrorMessage(error.message || 'Failed to create Trade Card')
            setStep('error')

            // Mark current active phase as error
            setPhases(prev => prev.map(p =>
                p.status === 'active' ? { ...p, status: 'error' } : p
            ))

            toast.error('Creation Failed', error.message || 'Failed to create Trade Card')
        }
    }

    const handleClose = () => {
        setStep('intro')
        onClose()
    }

    const handleRetry = () => {
        setStep('permissions')
    }

    if (!isOpen) return null

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
                                    <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20">
                                        <CreditCard className="w-7 h-7 text-blue-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">
                                        Create Trade Smart Card
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Enable instant, gasless swaps on ZeroCliq
                                    </p>
                                </div>

                                {/* What is a Trade Smart Card */}
                                <div className="bg-muted/30 border border-border rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-blue-500/10">
                                            <Sparkles className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground">What is a Trade Smart Card?</h3>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                It's a permission you give your Smart Account to execute swaps on your behalf.
                                                Think of it as a pre-approved trading limit that enables instant, one-click trades.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Benefits */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                                        What You Get
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/20 border border-border">
                                            <Zap className="w-5 h-5 text-amber-500 mb-1.5" />
                                            <span className="text-[11px] font-medium text-foreground">Instant</span>
                                            <span className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">One-click swaps</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/20 border border-border">
                                            <ArrowRightLeft className="w-5 h-5 text-emerald-500 mb-1.5" />
                                            <span className="text-[11px] font-medium text-foreground">Gasless</span>
                                            <span className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">No fees ever</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/20 border border-border">
                                            <Shield className="w-5 h-5 text-blue-500 mb-1.5" />
                                            <span className="text-[11px] font-medium text-foreground">Secure</span>
                                            <span className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">With limits</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            <div className="p-6 pt-0 space-y-3 pb-safe">
                                <Button
                                    onClick={handleContinue}
                                    className="w-full h-12 text-sm font-semibold bg-blue-600 hover:bg-blue-700"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Set Up Trade Card — Free
                                </Button>
                                <button
                                    onClick={handleClose}
                                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Permissions Step */}
                    {step === 'permissions' && (
                        <motion.div
                            key="permissions"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex flex-col h-full md:h-auto min-h-[100dvh] md:min-h-0"
                        >
                            <div className="flex-1 flex flex-col justify-center p-6 space-y-6 overflow-y-auto">
                                {/* Header */}
                                <div className="text-center space-y-3 pt-2">
                                    <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                                        <Lock className="w-7 h-7 text-amber-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">
                                        Approve Permissions
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Review what your Trade Card can do
                                    </p>
                                </div>

                                {/* Permissions List */}
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Execute Swaps</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Your Smart Account can swap tokens through verified DEXs
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Token Approvals</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Auto-approve tokens for swapping (only to trusted routers)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                                            <Shield className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Security Limits</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Built-in spending limits and whitelisted destinations
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Security Note */}
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        You can revoke this permission at any time from Settings.
                                    </p>
                                </div>
                            </div>

                            {/* CTA */}
                            <div className="p-6 pt-0 space-y-3 pb-safe">
                                <Button
                                    onClick={handleCreateCard}
                                    className="w-full h-12 text-sm font-semibold bg-blue-600 hover:bg-blue-700"
                                >
                                    <CreditCard className="w-4 h-4 mr-2" />
                                    Create Trade Card
                                </Button>
                                <button
                                    onClick={() => setStep('intro')}
                                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Go back
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
                            className="p-6 flex flex-col items-center space-y-8 min-h-[350px]"
                        >
                            {/* Header */}
                            <div className="text-center space-y-2 pt-4">
                                <div className="relative inline-flex">
                                    <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 flex items-center justify-center">
                                        <CreditCard className="w-7 h-7 text-blue-500" />
                                    </div>
                                    <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                                </div>
                                <h2 className="text-lg font-bold text-foreground mt-4">
                                    Creating Trade Card
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Sign when prompted by your wallet
                                </p>
                            </div>

                            {/* Progress Steps */}
                            <div className="w-full space-y-3">
                                {phases.map((phase, index) => (
                                    <div
                                        key={phase.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${phase.status === 'active'
                                            ? 'bg-blue-500/5 border-blue-500/30'
                                            : phase.status === 'done'
                                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                                : phase.status === 'error'
                                                    ? 'bg-red-500/5 border-red-500/20'
                                                    : 'bg-muted/10 border-border/50'
                                            }`}
                                    >
                                        {/* Status Icon */}
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${phase.status === 'active'
                                            ? 'bg-blue-500/20'
                                            : phase.status === 'done'
                                                ? 'bg-emerald-500/20'
                                                : phase.status === 'error'
                                                    ? 'bg-red-500/20'
                                                    : 'bg-muted/30'
                                            }`}>
                                            {phase.status === 'active' ? (
                                                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                                            ) : phase.status === 'done' ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                            ) : phase.status === 'error' ? (
                                                <X className="w-3.5 h-3.5 text-red-500" />
                                            ) : (
                                                <span className="text-[10px] font-bold text-muted-foreground">{index + 1}</span>
                                            )}
                                        </div>

                                        {/* Label */}
                                        <span className={`text-sm font-medium ${phase.status === 'active'
                                            ? 'text-blue-500'
                                            : phase.status === 'done'
                                                ? 'text-emerald-500'
                                                : phase.status === 'error'
                                                    ? 'text-red-500'
                                                    : 'text-muted-foreground'
                                            }`}>
                                            {phase.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Error Step */}
                    {step === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-6 flex flex-col items-center space-y-6 min-h-[300px]"
                        >
                            <div className="inline-flex p-4 rounded-full bg-red-500/10 ring-1 ring-red-500/20">
                                <X className="w-10 h-10 text-red-500" />
                            </div>

                            <div className="text-center space-y-2">
                                <h2 className="text-xl font-bold text-foreground">
                                    Something went wrong
                                </h2>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                    {errorMessage || 'Failed to create Trade Card. Please try again.'}
                                </p>
                            </div>

                            <div className="w-full space-y-3">
                                <Button
                                    onClick={handleRetry}
                                    className="w-full h-12 text-sm font-semibold bg-blue-600 hover:bg-blue-700"
                                >
                                    Try Again
                                </Button>
                                <button
                                    onClick={handleClose}
                                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
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
                                    <h2 className="text-xl font-bold text-foreground">Trade Card Active! 🎉</h2>
                                    <p className="text-sm text-muted-foreground">
                                        You're ready for instant, gasless swaps
                                    </p>
                                </div>
                            </div>

                            {/* Card Preview */}
                            <div className="relative p-5 rounded-2xl bg-blue-600 overflow-hidden">
                                {/* Subtle pattern */}
                                <div className="absolute inset-0 opacity-10">
                                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/20 -translate-y-16 translate-x-16" />
                                    <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/20 translate-y-12 -translate-x-12" />
                                </div>

                                <div className="relative flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-blue-200">Trade Smart Card</p>
                                        <p className="text-lg font-bold text-white mt-1">ZeroCliq</p>
                                    </div>
                                    <CreditCard className="w-8 h-8 text-white/80" />
                                </div>
                                <div className="relative mt-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-300" />
                                        <span className="text-xs font-medium text-white">Gasless</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-emerald-300" />
                                        <span className="text-xs font-medium text-white">Secure</span>
                                    </div>
                                </div>
                            </div>

                            {/* What's next */}
                            <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
                                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                    You can now:
                                </h3>
                                <ul className="space-y-2 text-xs text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-500 font-bold text-[8px] mt-0.5">✓</span>
                                        <span><span className="font-medium text-foreground">Swap instantly</span> with one click</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-500 font-bold text-[8px] mt-0.5">✓</span>
                                        <span><span className="font-medium text-foreground">Zero gas fees</span> on all trades</span>
                                    </li>
                                </ul>
                            </div>

                            {/* CTA */}
                            <Button
                                onClick={handleClose}
                                className="w-full h-12 text-sm font-semibold bg-blue-600 hover:bg-blue-700"
                            >
                                <ArrowRightLeft className="w-4 h-4 mr-2" />
                                Start Swapping
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
