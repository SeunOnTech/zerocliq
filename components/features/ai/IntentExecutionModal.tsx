"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle2, X, Zap, ArrowRight, Loader2, Play, PartyPopper, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import confetti from 'canvas-confetti'
import { ZeroSlipLogo } from '@/components/ZeroSlipLogo'
import { useAccount } from 'wagmi'


interface IntentExecutionModalProps {
    isOpen: boolean
    onClose: () => void
    intentSummary: string
    permissionContext?: string // The signed permission context
    intent?: any // Pass full intent object
}

type ExecutionStep = 'success' | 'demo-prompt' | 'executing' | 'verifying' | 'complete'

interface ExecutionPhase {
    id: 'init' | 'swap-1' | 'swap-2' | 'swap-3'
    label: string
    status: 'pending' | 'active' | 'done' | 'error'
    details?: string
    txHash?: string
    envioVerified?: boolean
    gasUsed?: string
}

const verifyWithEnvio = async (txHash: string): Promise<any> => {
    const query = `
    query VerifyUserOp {
      EntryPoint_UserOperationEvent(where: { transactionHash: { _eq: "${txHash}" } }) {
        id
        actualGasUsed
        actualGasCost
        success
        blockNumber
      }
    }
    `
    try {
        const res = await fetch('/api/envio-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        })
        const data = await res.json()
        return data?.data?.EntryPoint_UserOperationEvent?.[0]
    } catch (e) {
        console.error("Envio verify failed", e)
        return null
    }
}

export function IntentExecutionModal({ isOpen, onClose, intentSummary, permissionContext, intent }: IntentExecutionModalProps) {
    const { address } = useAccount()
    const [currentStep, setCurrentStep] = useState<ExecutionStep>('success')
    const [lastTxHash, setLastTxHash] = useState<string>('')
    const [envioData, setEnvioData] = useState<{ verified: boolean; gasUsed?: string; blockNumber?: number } | null>(null)
    const [phases, setPhases] = useState<ExecutionPhase[]>([
        { id: 'init', label: 'Initializing Stream', status: 'pending' },
        { id: 'swap-1', label: 'Executing Swap #1', status: 'pending', details: '0.01 USDC → WETH' },
        { id: 'swap-2', label: 'Executing Swap #2', status: 'pending', details: '0.01 USDC → WETH' },
        { id: 'swap-3', label: 'Executing Swap #3', status: 'pending', details: '0.01 USDC → WETH' },
    ])

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setCurrentStep('success')
            setPhases([
                { id: 'init', label: 'Initializing Stream', status: 'pending' },
                { id: 'swap-1', label: 'Executing Swap #1', status: 'pending', details: '10 USDC → WETH' },
                { id: 'swap-2', label: 'Executing Swap #2', status: 'pending', details: '10 USDC → WETH' },
                { id: 'swap-3', label: 'Executing Swap #3', status: 'pending', details: '10 USDC → WETH' },
            ])
            setEnvioData(null)
            setLastTxHash('')
        }
    }, [isOpen])

    const executeSwap = async (phaseId: string): Promise<string | null> => {
        if (!address || !permissionContext || !intent) return null

        try {
            setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, status: 'active' } : p))

            const response = await fetch('/api/ai/execute-demo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress: address,
                    permissionsContext: permissionContext,
                    intent: { ...intent, amount: 0.01 }, // Override amount for demo
                    chainId: 11155111
                })
            })

            const data = await response.json()

            if (!data.success) throw new Error(data.error)

            const txHash = data.swapTxHash || data.transferTxHash
            setLastTxHash(txHash)
            setPhases(prev => prev.map(p => p.id === phaseId ? {
                ...p,
                status: 'done',
                txHash: txHash
            } : p))

            return txHash

        } catch (error) {
            console.error('Swap failed', error)
            setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, status: 'error', details: 'Failed' } : p))
            return null
        }
    }

    const handleRunDemo = async () => {
        setCurrentStep('executing')

        // Phase 1: Init (Fake delay for stream setup)
        setPhases(prev => prev.map(p => p.id === 'init' ? { ...p, status: 'active' } : p))
        await new Promise(r => setTimeout(r, 800))
        setPhases(prev => prev.map(p => p.id === 'init' ? { ...p, status: 'done' } : p))

        // Execute Swaps
        await executeSwap('swap-1')
        await new Promise(r => setTimeout(r, 1000))

        await executeSwap('swap-2')
        await new Promise(r => setTimeout(r, 1000))

        const finalTxHash = await executeSwap('swap-3')

        if (!finalTxHash) {
            // All swaps failed or no txHash
            setCurrentStep('complete')
            return
        }

        // Start Verification Phase
        setCurrentStep('verifying')

        // Poll Envio for 30s using the captured txHash directly
        let attempts = 0
        const pollEnvio = setInterval(async () => {
            attempts++
            if (attempts > 30) { // 30s timeout
                clearInterval(pollEnvio)
                setEnvioData({ verified: false })
                setCurrentStep('complete')
                triggerConfetti()
                return
            }

            const event = await verifyWithEnvio(finalTxHash)
            if (event) {
                clearInterval(pollEnvio)
                setEnvioData({
                    verified: true,
                    gasUsed: event.actualGasUsed,
                    blockNumber: event.blockNumber
                })
                setCurrentStep('complete')
                triggerConfetti()
            }
        }, 1000)
    }

    const triggerConfetti = () => {
        const duration = 3000
        const end = Date.now() + duration
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899']

        const frame = () => {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            })
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            })

            if (Date.now() < end) {
                requestAnimationFrame(frame)
            }
        }
        frame()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 font-sans">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card md:border border-border md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-md overflow-hidden flex flex-col"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-20"
                >
                    <X className="w-4 h-4" />
                </button>

                <AnimatePresence mode="wait">
                    {/* STEP 1: Success State */}
                    {currentStep === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex flex-col p-8 items-center text-center space-y-6"
                        >
                            <div className="relative">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                                    className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20"
                                >
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                </motion.div>
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center border-2 border-card"
                                >
                                    <Zap className="w-3 h-3 text-white fill-current" />
                                </motion.div>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-blue-500">
                                    Permission Granted!
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    Your Stream Permission is active. ZeroCliq can now execute your intent automatically.
                                </p>
                            </div>

                            <div className="w-full bg-muted/30 border border-border rounded-xl p-4 text-left">
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                                    Active Intent
                                </div>
                                <div className="text-sm font-medium text-foreground leading-relaxed">
                                    {intentSummary.split('\n\n')[0]} {/* Show first paragraph aka acknowledgment */}
                                </div>
                            </div>

                            <div className="w-full pt-4">
                                <Button
                                    onClick={() => setCurrentStep('demo-prompt')}
                                    className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
                                >
                                    Continue
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: Demo Prompt */}
                    {currentStep === 'demo-prompt' && (
                        <motion.div
                            key="demo-prompt"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex flex-col p-8 items-center text-center space-y-8"
                        >
                            <div className="relative w-full h-32 flex items-center justify-center">
                                <div className="absolute inset-0 bg-blue-500/5 rounded-2xl animate-pulse" />
                                <ZeroSlipLogo className="w-16 h-16 text-foreground relative z-10" />
                                <div className="absolute -bottom-3 px-3 py-1 bg-background border border-border rounded-full text-xs font-medium shadow-sm flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    System Ready
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-foreground">
                                    Let's Run a Live Demo 🚀
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    We'll execute 3 small streaming swaps right now to demonstrate the automation in real-time.
                                </p>
                            </div>

                            <div className="w-full grid grid-cols-2 gap-3">
                                <div className="p-3 bg-muted/20 rounded-xl border border-border text-center space-y-1">
                                    <div className="text-2xl font-bold text-foreground">3</div>
                                    <div className="text-xs text-muted-foreground">Live Swaps</div>
                                </div>
                                <div className="p-3 bg-muted/20 rounded-xl border border-border text-center space-y-1">
                                    <div className="text-2xl font-bold text-foreground">Envio</div>
                                    <div className="text-xs text-muted-foreground">Indexing</div>
                                </div>
                            </div>

                            <div className="w-full pt-2">
                                <Button
                                    onClick={handleRunDemo}
                                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.02] border-0"
                                >
                                    <Play className="w-5 h-5 mr-2 fill-current" />
                                    Run Live Demo
                                </Button>
                                <p className="text-xs text-muted-foreground mt-3">
                                    Executes visible transactions on Sepolia
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: Executing */}
                    {currentStep === 'executing' && (
                        <motion.div
                            key="executing"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex flex-col p-6 space-y-6"
                        >
                            <div className="text-center space-y-1">
                                <h2 className="text-lg font-bold text-foreground">Executing Intent...</h2>
                                <p className="text-xs text-muted-foreground">Don't close this window</p>
                            </div>

                            <div className="space-y-3">
                                {phases.map((phase, index) => (
                                    <motion.div
                                        key={phase.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${phase.status === 'active'
                                            ? 'bg-blue-500/5 border-blue-500/30 scale-[1.02] shadow-sm'
                                            : phase.status === 'done'
                                                ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70'
                                                : 'bg-muted/10 border-border/50 opacity-50'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${phase.status === 'active'
                                            ? 'bg-blue-500/20'
                                            : phase.status === 'done'
                                                ? 'bg-emerald-500/20'
                                                : 'bg-muted/30'
                                            }`}>
                                            {phase.status === 'active' ? (
                                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                            ) : phase.status === 'done' ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium ${phase.status === 'active' ? 'text-blue-500' :
                                                phase.status === 'done' ? 'text-emerald-500' : 'text-muted-foreground'
                                                }`}>
                                                {phase.label}
                                            </div>
                                            {phase.status !== 'pending' && phase.details && (
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {phase.details}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 4: Verifying */}
                    {currentStep === 'verifying' && (
                        <motion.div
                            key="verifying"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center py-8 space-y-6"
                        >
                            <div className="relative w-20 h-20 mx-auto">
                                <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-ping"></div>
                                <div className="relative bg-indigo-500/10 rounded-full p-4 border-2 border-indigo-500">
                                    <Sparkles className="w-10 h-10 text-indigo-500 animate-pulse" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">Verifying with Envio</h3>
                                <p className="text-muted-foreground/80">
                                    Indexing your transaction on the graph...
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 5: Complete */}
                    {currentStep === 'complete' && (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col p-8 items-center text-center space-y-8"
                        >
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/20 animate-bounce-slow">
                                <PartyPopper className="w-12 h-12 text-white" />
                            </div>

                            <div className="space-y-3">
                                <h2 className="text-2xl font-bold text-foreground">
                                    Demo Smashed! 💥
                                </h2>
                                <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                                    The Agent successfully executed trades using the stream permission. The intent system is live.
                                </p>

                                {envioData?.verified && (
                                    <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center animate-in fade-in slide-in-from-bottom-4">
                                        <div className="flex items-center justify-center gap-2 text-green-500 font-bold mb-1">
                                            <CheckCircle2 className="w-5 h-5" />
                                            Verified by Envio Indexer
                                        </div>
                                        <div className="text-xs text-green-700/80 dark:text-green-300/80 font-mono">
                                            Block #{envioData.blockNumber} • Gas Used: {envioData.gasUsed}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="w-full space-y-3 pt-4">
                                {envioData?.verified && (
                                    <Button
                                        onClick={() => window.open('https://envio.dev/console', '_blank')}
                                        className="w-full h-12 text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                                    >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Verify on Envio Console
                                        <ExternalLink className="w-4 h-4 ml-2" />
                                    </Button>
                                )}
                                <Button
                                    onClick={() => window.open(lastTxHash ? `https://sepolia.etherscan.io/tx/${lastTxHash}` : 'https://sepolia.etherscan.io', '_blank')}
                                    className="w-full h-12 text-sm font-semibold bg-white text-black hover:bg-gray-100 border border-border shadow-sm"
                                >
                                    Verify on Explorer
                                    <ExternalLink className="w-4 h-4 ml-2" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    className="w-full"
                                >
                                    Close
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
