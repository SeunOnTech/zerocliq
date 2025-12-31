"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    Wallet,
    CreditCard,
    ArrowRight,
    Check,
    AlertCircle,
    Loader2,
    ChevronDown,
    Sparkles,
    Clock,
    ArrowUpRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { parseEther, formatEther, parseUnits, formatUnits, erc20Abi } from 'viem'
import { toast } from '@/components/ui/toast'
import confetti from 'canvas-confetti'
import { getExplorerTxUrl } from '@/lib/chains'
import { createNotification } from '@/hooks/useNotificationStore'
import { logActivity } from '@/hooks/useActivityStore'

// Types
type FundingStep = 'choose' | 'amount' | 'processing' | 'success' | 'error'
type FundingMethod = 'eoa' | 'onramp'

interface FundingModalProps {
    isOpen: boolean
    onClose: () => void
    preselectedToken?: {
        symbol: string
        address: string
        decimals: number
        logoURI?: string
    }
    requiredAmount?: string
    onSuccess?: () => void
}

// Token logo component
function TokenLogo({ logoURI, symbol }: { logoURI?: string; symbol: string }) {
    const [imgError, setImgError] = useState(false)

    if (logoURI && !imgError) {
        return (
            <img
                src={logoURI}
                alt={symbol}
                className="w-full h-full rounded-full object-cover"
                onError={() => setImgError(true)}
            />
        )
    }

    return (
        <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {symbol.slice(0, 2)}
        </div>
    )
}

export function FundingModal({
    isOpen,
    onClose,
    preselectedToken,
    requiredAmount,
    onSuccess
}: FundingModalProps) {
    const { address, chainId } = useAccount()
    const userProfile = useAppStore((s) => s.userProfile)
    const smartAccountAddress = userProfile?.smartAccountAddress

    // State
    const [step, setStep] = useState<FundingStep>('choose')
    const [method, setMethod] = useState<FundingMethod | null>(null)
    const [amount, setAmount] = useState(requiredAmount || '')
    const [errorMessage, setErrorMessage] = useState('')

    // Determine if we are using native token (ETH) or ERC-20
    const isNative = !preselectedToken || preselectedToken.address === '0x0000000000000000000000000000000000000000'

    // Get Balance (Native or Token)
    const { data: balanceData } = useBalance({
        address: address,
        token: isNative ? undefined : (preselectedToken.address as `0x${string}`),
    })

    // Transaction hooks (Native)
    const {
        data: txHash,
        sendTransaction,
        isPending: isSending,
        error: sendError,
        reset: resetTx
    } = useSendTransaction()

    // Transaction hooks (ERC-20)
    const {
        data: writeHash,
        writeContract,
        isPending: isWriting,
        error: writeError,
        reset: resetWrite
    } = useWriteContract()

    const activeHash = txHash || writeHash

    const {
        isLoading: isConfirming,
        isSuccess: isConfirmed,
        error: confirmError
    } = useWaitForTransactionReceipt({
        hash: activeHash,
    })

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('choose')
            setMethod(null)
            setAmount(requiredAmount || '')
            setErrorMessage('')
            resetTx()
            resetWrite()
        }
    }, [isOpen, requiredAmount, resetTx, resetWrite])

    // Handle transaction confirmation
    useEffect(() => {
        if (isConfirmed && step === 'processing') {
            setStep('success')
            // Celebration!
            confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.6 },
                colors: ['#10b981', '#34d399', '#6ee7b7'],
                disableForReducedMotion: true
            })
            toast.success('Funds Transferred!', 'Your Smart Account has been funded.')
            onSuccess?.()

            // Log notification and activity
            if (address && chainId) {
                const tokenSymbol = preselectedToken?.symbol || balanceData?.symbol || 'ETH'

                createNotification({
                    walletAddress: address,
                    chainId,
                    type: 'SMART_ACCOUNT_FUNDED',
                    title: 'Smart Account Funded',
                    message: `Deposited ${amount} ${tokenSymbol} to Smart Account`,
                    metadata: {
                        txHash: activeHash,
                        amount,
                        token: tokenSymbol,
                    }
                })

                logActivity({
                    walletAddress: address,
                    chainId,
                    type: 'SMART_ACCOUNT_FUND',
                    status: 'SUCCESS',
                    title: 'Smart Account Funded',
                    description: `Deposited ${amount} ${tokenSymbol} to Smart Account`,
                    txHash: activeHash || undefined,
                    metadata: {
                        amount,
                        token: tokenSymbol,
                    }
                })
            }
        }
    }, [isConfirmed, step, onSuccess, address, chainId, amount, activeHash, preselectedToken?.symbol, balanceData?.symbol])

    // Handle errors
    useEffect(() => {
        if (sendError || confirmError || writeError) {
            const error = sendError || confirmError || writeError
            setErrorMessage(error?.message || 'Transaction failed')
            setStep('error')
        }
    }, [sendError, confirmError, writeError])

    // Handle method selection
    const handleSelectMethod = (selectedMethod: FundingMethod) => {
        setMethod(selectedMethod)
        if (selectedMethod === 'eoa') {
            setStep('amount')
        }
        // onramp shows coming soon in the card itself
    }

    // Handle transfer
    const handleTransfer = async () => {
        if (!smartAccountAddress || !amount) return

        setStep('processing')
        setErrorMessage('')

        try {
            if (isNative) {
                sendTransaction({
                    to: smartAccountAddress as `0x${string}`,
                    value: parseEther(amount),
                })
            } else {
                writeContract({
                    address: preselectedToken!.address as `0x${string}`,
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [smartAccountAddress as `0x${string}`, parseUnits(amount, preselectedToken!.decimals)],
                })
            }
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to initiate transfer')
            setStep('error')
        }
    }

    // Handle max button
    const handleMax = () => {
        if (balanceData) {
            // Leave a small amount for gas only if it's native token
            const balance = parseFloat(formatUnits(balanceData.value, balanceData.decimals))
            const maxAmount = isNative
                ? Math.max(0, balance - 0.001)
                : balance

            setAmount(maxAmount.toString())
        }
    }

    // Calculate shortfall
    const requiredNum = parseFloat(requiredAmount || '0')
    const currentBalance = parseFloat(balanceData ? formatUnits(balanceData.value, balanceData.decimals) : '0')
    const shortfall = requiredNum > 0 ? (requiredNum - currentBalance).toFixed(4) : null

    if (!isOpen) return null

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20 md:pb-4 bg-black/60 backdrop-blur-sm"
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.5 }}
                        className="w-full max-w-md bg-card rounded-[24px] shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                            <h2 className="text-lg font-bold text-foreground">
                                {step === 'choose' && 'Fund Smart Account'}
                                {step === 'amount' && 'Transfer from Wallet'}
                                {step === 'processing' && 'Processing...'}
                                {step === 'success' && 'Funded!'}
                                {step === 'error' && 'Transfer Failed'}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <AnimatePresence mode="wait">
                                {/* Step 1: Choose Method */}
                                {step === 'choose' && (
                                    <motion.div
                                        key="choose"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <p className="text-sm text-muted-foreground text-center mb-6">
                                            Choose how you'd like to fund your Smart Account
                                        </p>

                                        {/* EOA Transfer Option */}
                                        <button
                                            onClick={() => handleSelectMethod('eoa')}
                                            className="w-full p-4 rounded-[16px] border-2 border-border bg-muted/50 hover:border-primary hover:bg-muted transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                    <Wallet className="w-6 h-6 text-primary" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                                        Transfer from Wallet
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Send tokens from your connected wallet
                                                    </div>
                                                    {balanceData && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Balance: {parseFloat(formatUnits(balanceData.value, balanceData.decimals)).toFixed(4)} {balanceData.symbol}
                                                        </div>
                                                    )}
                                                </div>
                                                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </button>

                                        {/* On-ramp Option (Coming Soon) */}
                                        <div className="w-full p-4 rounded-[16px] border-2 border-border bg-muted/30 opacity-60 cursor-not-allowed relative overflow-hidden">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                                    <CreditCard className="w-6 h-6 text-amber-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                                        Buy with Card
                                                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full">
                                                            Coming Soon
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Purchase crypto directly with card
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Diagonal stripe overlay */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                <div className="absolute -right-4 top-2 rotate-45 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-8 py-0.5">
                                                    SOON
                                                </div>
                                            </div>
                                        </div>

                                        {/* Smart Account Info */}
                                        <div className="mt-6 p-3 rounded-[12px] bg-muted/50 border border-border/50">
                                            <div className="text-xs text-muted-foreground">
                                                <span className="font-medium text-foreground">Smart Account:</span>{' '}
                                                {smartAccountAddress ? (
                                                    <span className="font-mono">
                                                        {smartAccountAddress.slice(0, 6)}...{smartAccountAddress.slice(-4)}
                                                    </span>
                                                ) : (
                                                    'Not deployed'
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 2: Amount Input */}
                                {step === 'amount' && (
                                    <motion.div
                                        key="amount"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        {/* From/To Cards */}
                                        <div className="space-y-3">
                                            {/* From (EOA) */}
                                            <div className="p-4 rounded-[16px] bg-muted border border-border/50">
                                                <div className="text-xs text-muted-foreground mb-2">From: Connected Wallet</div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <Wallet className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium font-mono">
                                                                {address?.slice(0, 6)}...{address?.slice(-4)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-semibold">
                                                            {balanceData ? parseFloat(formatUnits(balanceData.value, balanceData.decimals)).toFixed(4) : '0.0000'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {balanceData?.symbol || 'ETH'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Arrow */}
                                            <div className="flex justify-center">
                                                <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                            </div>

                                            {/* To (Smart Account) */}
                                            <div className="p-4 rounded-[16px] bg-muted border border-border/50">
                                                <div className="text-xs text-muted-foreground mb-2">To: Smart Account</div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                            <Sparkles className="w-4 h-4 text-emerald-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium font-mono">
                                                                {smartAccountAddress?.slice(0, 6)}...{smartAccountAddress?.slice(-4)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                                        Gasless
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Amount Input */}
                                        <div className="p-4 rounded-[16px] bg-muted border border-border/50">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs text-muted-foreground">Amount</span>
                                                <button
                                                    onClick={handleMax}
                                                    className="text-xs text-primary font-medium hover:underline"
                                                >
                                                    MAX
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    className="flex-1 bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
                                                />
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-background border border-border">
                                                    <div className="w-5 h-5">
                                                        {preselectedToken?.logoURI ? (
                                                            <TokenLogo logoURI={preselectedToken.logoURI} symbol={preselectedToken.symbol} />
                                                        ) : (
                                                            <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                                                                {balanceData?.symbol?.slice(0, 2) || 'ET'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-semibold">
                                                        {preselectedToken?.symbol || balanceData?.symbol || 'ETH'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Shortfall Notice */}
                                        {requiredAmount && parseFloat(amount || '0') < parseFloat(requiredAmount) && (
                                            <div className="p-3 rounded-[12px] bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm">
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                    <span>
                                                        You need at least <strong>{requiredAmount}</strong> to complete the swap.
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => setStep('choose')}
                                                className="flex-1 h-12 rounded-[12px]"
                                            >
                                                Back
                                            </Button>
                                            <Button
                                                onClick={handleTransfer}
                                                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > currentBalance}
                                                className="flex-1 h-12 rounded-[12px] bg-primary hover:bg-primary/90"
                                            >
                                                Transfer
                                                <ArrowUpRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3: Processing */}
                                {step === 'processing' && (
                                    <motion.div
                                        key="processing"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="py-8 text-center"
                                    >
                                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground mb-2">
                                            {isSending || isWriting ? 'Confirm in Wallet' : 'Processing Transfer'}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {isSending || isWriting
                                                ? 'Please confirm the transaction in your wallet'
                                                : 'Your transfer is being confirmed on the blockchain'}
                                        </p>

                                        {/* Progress Steps */}
                                        <div className="flex justify-center gap-2 mt-6">
                                            <div className={`w-3 h-3 rounded-full transition-colors ${isSending || isWriting ? 'bg-primary animate-pulse' : 'bg-primary'}`} />
                                            <div className={`w-3 h-3 rounded-full transition-colors ${isConfirming ? 'bg-primary animate-pulse' : isSending || isWriting ? 'bg-muted' : 'bg-primary'}`} />
                                            <div className="w-3 h-3 rounded-full bg-muted" />
                                        </div>
                                        <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                                            <span className={isSending || isWriting ? 'text-primary font-medium' : ''}>Sign</span>
                                            <span className={isConfirming ? 'text-primary font-medium' : ''}>Confirm</span>
                                            <span>Done</span>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 4: Success */}
                                {step === 'success' && (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="py-8 text-center"
                                    >
                                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                            <Check className="w-8 h-8 text-emerald-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground mb-2">
                                            Funds Transferred!
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-6">
                                            <strong>{amount} {balanceData?.symbol || 'ETH'}</strong> has been sent to your Smart Account
                                        </p>

                                        {activeHash && (
                                            <a
                                                href={chainId ? getExplorerTxUrl(chainId, activeHash) : '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-6"
                                            >
                                                View transaction
                                                <ArrowUpRight className="w-3 h-3" />
                                            </a>
                                        )}

                                        <Button
                                            onClick={onClose}
                                            className="w-full h-12 rounded-[12px] bg-primary hover:bg-primary/90"
                                        >
                                            Done
                                        </Button>
                                    </motion.div>
                                )}

                                {/* Step 5: Error */}
                                {step === 'error' && (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="py-8 text-center"
                                    >
                                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                                            <AlertCircle className="w-8 h-8 text-red-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground mb-2">
                                            Transfer Failed
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-6 max-w-[280px] mx-auto">
                                            {errorMessage || 'Something went wrong. Please try again.'}
                                        </p>

                                        <div className="flex gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={onClose}
                                                className="flex-1 h-12 rounded-[12px]"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    resetTx()
                                                    resetWrite()
                                                    setStep('amount')
                                                    setErrorMessage('')
                                                }}
                                                className="flex-1 h-12 rounded-[12px] bg-primary hover:bg-primary/90"
                                            >
                                                Try Again
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
