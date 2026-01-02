// components/features/ai/IntentConfirmationCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw,
    Zap,
    X,
    Clock,
    ArrowRight,
    Loader2,
    TrendingUp,
    Shield,
    Coins,
    Timer,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import type { ParsedIntent, StreamingDCAIntent, TWAPOrderIntent, TrailingStopIntent, LimitOrderIntent } from '@/lib/types/intents';

interface IntentConfirmationCardProps {
    intent: ParsedIntent;
    onConfirm: () => void;
    onCancel: () => void;
    isExecuting?: boolean;
}

// Ethereum Mainnet token addresses for price fetching
const MAINNET_TOKEN_IDS: Record<string, string> = {
    'ETH': 'ethereum',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'DAI': 'dai',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'WETH': 'weth',
    'WBTC': 'wrapped-bitcoin',
};

// Token logo URLs (CoinGecko assets)
const TOKEN_LOGOS: Record<string, string> = {
    'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    'USDC': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
    'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    'DAI': 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
    'LINK': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    'UNI': 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
    'AAVE': 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',
    'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
    'MON': 'https://assets.coingecko.com/coins/images/38927/small/monad.png',
};

/**
 * Get token logo URL
 */
function getTokenLogo(symbol: string): string {
    return TOKEN_LOGOS[symbol.toUpperCase()] || `https://ui-avatars.com/api/?name=${symbol}&background=6366f1&color=fff&size=64`;
}

/**
 * Fetch token price from CoinGecko (free API)
 */
async function fetchTokenPrice(symbol: string): Promise<number | null> {
    const coinId = MAINNET_TOKEN_IDS[symbol.toUpperCase()];
    if (!coinId) return null;

    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
        );
        const data = await response.json();
        return data[coinId]?.usd || null;
    } catch {
        return null;
    }
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) {
        return hours > 0 ? `${days}d ${hours}h` : `${days} days`;
    }
    if (hours > 0) {
        return `${hours} hours`;
    }
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
}

/**
 * Format number with currency
 */
function formatUSD(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format number with appropriate precision
 */
function formatAmount(amount: number | undefined | null, decimals: number = 4): string {
    if (amount === undefined || amount === null) return '—';
    if (amount >= 1000) {
        return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    if (amount >= 1) {
        return amount.toFixed(2);
    }
    return amount.toFixed(decimals);
}

/**
 * Get icon and styling for intent type
 */
function getIntentStyle(intentType: string) {
    switch (intentType) {
        case 'STREAMING_DCA':
            return {
                icon: RefreshCw,
                accentClass: 'text-blue-600 dark:text-blue-400',
                bgClass: 'bg-blue-50 dark:bg-blue-950/50',
                borderClass: 'border-blue-200 dark:border-blue-800',
                buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                label: 'Streaming DCA',
                description: 'Dollar-Cost Average'
            };
        case 'TWAP_ORDER':
            return {
                icon: Clock,
                accentClass: 'text-violet-600 dark:text-violet-400',
                bgClass: 'bg-violet-50 dark:bg-violet-950/50',
                borderClass: 'border-violet-200 dark:border-violet-800',
                buttonClass: 'bg-violet-600 hover:bg-violet-700 text-white',
                label: 'TWAP Order',
                description: 'Time-Weighted Average'
            };
        case 'TRAILING_STOP':
            return {
                icon: Shield,
                accentClass: 'text-amber-600 dark:text-amber-400',
                bgClass: 'bg-amber-50 dark:bg-amber-950/50',
                borderClass: 'border-amber-200 dark:border-amber-800',
                buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
                label: 'Trailing Stop',
                description: 'Protect Your Gains'
            };
        case 'LIMIT_ORDER':
            return {
                icon: TrendingUp,
                accentClass: 'text-emerald-600 dark:text-emerald-400',
                bgClass: 'bg-emerald-50 dark:bg-emerald-950/50',
                borderClass: 'border-emerald-200 dark:border-emerald-800',
                buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                label: 'Limit Order',
                description: 'Buy Low, Sell High'
            };
        default:
            return {
                icon: Coins,
                accentClass: 'text-gray-600 dark:text-gray-400',
                bgClass: 'bg-gray-50 dark:bg-gray-950/50',
                borderClass: 'border-gray-200 dark:border-gray-800',
                buttonClass: 'bg-gray-600 hover:bg-gray-700 text-white',
                label: 'Intent',
                description: 'DeFi Action'
            };
    }
}

/**
 * Animated counter component
 */
function AnimatedValue({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const duration = 1000;
        const steps = 30;
        const increment = value / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(current);
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value]);

    return <span>{prefix}{formatAmount(displayValue)}{suffix}</span>;
}

/**
 * Streaming progress visualization
 */
function StreamProgress({ durationSeconds }: { durationSeconds: number }) {
    const days = Math.ceil(durationSeconds / 86400);
    const segments = Math.min(days, 14);

    return (
        <div className="flex gap-1 mt-3">
            {Array.from({ length: segments }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ delay: 0.5 + (i * 0.05), duration: 0.3 }}
                    className="flex-1 h-2 rounded-full bg-current opacity-20"
                    style={{ originY: 1 }}
                />
            ))}
        </div>
    );
}

/**
 * DCA Parameters with live pricing - Mobile Responsive with Token Logos
 */
function DCAParameters({ intent }: { intent: StreamingDCAIntent }) {
    const { sourceToken, sourceAmount, targetToken, durationSeconds, amountPerSecond } = intent.parameters;
    const [targetPrice, setTargetPrice] = useState<number | null>(null);
    const [isLoadingPrice, setIsLoadingPrice] = useState(true);

    const dailyAmount = (amountPerSecond || 0) * 86400;
    const estimatedTokens = targetPrice ? sourceAmount / targetPrice : null;

    useEffect(() => {
        fetchTokenPrice(targetToken).then(price => {
            setTargetPrice(price);
            setIsLoadingPrice(false);
        });
    }, [targetToken]);

    return (
        <div className="space-y-4">
            {/* Main swap visualization - Stacked on mobile, row on desktop */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-background border border-border">
                {/* Source Token */}
                <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-3 w-full sm:w-auto sm:flex-1"
                >
                    <img
                        src={getTokenLogo(sourceToken)}
                        alt={sourceToken}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-border"
                    />
                    <div className="flex-1 sm:text-left">
                        <div className="text-2xl sm:text-3xl font-bold text-foreground">
                            {formatUSD(sourceAmount)}
                        </div>
                        <div className="text-sm text-muted-foreground">{sourceToken}</div>
                    </div>
                </motion.div>

                {/* Arrow */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="p-2 sm:p-3 rounded-full bg-muted shrink-0 rotate-90 sm:rotate-0"
                >
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                </motion.div>

                {/* Target Token */}
                <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 sm:flex-row-reverse"
                >
                    <img
                        src={getTokenLogo(targetToken)}
                        alt={targetToken}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-border"
                    />
                    <div className="flex-1 sm:text-right">
                        <div className="text-2xl sm:text-3xl font-bold text-foreground">
                            {isLoadingPrice ? (
                                <Loader2 className="w-5 h-5 animate-spin inline" />
                            ) : estimatedTokens ? (
                                `~${formatAmount(estimatedTokens)}`
                            ) : (
                                '—'
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 sm:justify-end">
                            {targetToken}
                            {targetPrice && (
                                <span className="text-xs opacity-60">@ {formatUSD(targetPrice)}</span>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Stats grid - Responsive */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="p-2 sm:p-3 rounded-xl bg-muted/50 text-center"
                >
                    <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm sm:text-lg font-bold text-foreground">{formatDuration(durationSeconds)}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Duration</div>
                </motion.div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="p-2 sm:p-3 rounded-xl bg-muted/50 text-center"
                >
                    <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm sm:text-lg font-bold text-foreground">{formatUSD(dailyAmount)}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Per Day</div>
                </motion.div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="p-2 sm:p-3 rounded-xl bg-muted/50 text-center"
                >
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm sm:text-lg font-bold text-foreground">{Math.ceil(durationSeconds / 86400)}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Swaps</div>
                </motion.div>
            </div>
        </div>
    );
}

/**
 * TWAP Parameters
 */
function TWAPParameters({ intent }: { intent: TWAPOrderIntent }) {
    const { action, token, amount, durationSeconds, targetToken } = intent.parameters;
    const [tokenPrice, setTokenPrice] = useState<number | null>(null);

    useEffect(() => {
        fetchTokenPrice(token).then(setTokenPrice);
    }, [token]);

    const totalValue = tokenPrice ? amount * tokenPrice : null;
    const hourlyAmount = amount / (durationSeconds / 3600);

    return (
        <div className="space-y-4">
            {/* Action badge */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${action === 'SELL'
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    }`}
            >
                {action === 'SELL' ? <TrendingUp className="w-3.5 h-3.5 rotate-180" /> : <TrendingUp className="w-3.5 h-3.5" />}
                {action}
            </motion.div>

            {/* Amount display */}
            <div className="p-4 rounded-2xl bg-background border border-border">
                <div className="text-4xl font-bold text-foreground">
                    {formatAmount(amount)} <span className="text-muted-foreground text-2xl">{token}</span>
                </div>
                {totalValue && (
                    <div className="text-sm text-muted-foreground mt-1">
                        ≈ {formatUSD(totalValue)}
                    </div>
                )}
            </div>

            {/* Execution details */}
            <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-xl bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">Duration</div>
                    <div className="text-lg font-bold">{formatDuration(durationSeconds)}</div>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">Rate</div>
                    <div className="text-lg font-bold">{formatAmount(hourlyAmount)}/hr</div>
                </div>
                {targetToken && (
                    <div className="flex-1 p-3 rounded-xl bg-muted/50">
                        <div className="text-xs text-muted-foreground mb-1">Receive</div>
                        <div className="text-lg font-bold">{targetToken}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Trailing Stop Parameters
 */
function TrailingStopParameters({ intent }: { intent: TrailingStopIntent }) {
    const { token, amount, trailPercent } = intent.parameters;
    const [tokenPrice, setTokenPrice] = useState<number | null>(null);

    useEffect(() => {
        fetchTokenPrice(token).then(setTokenPrice);
    }, [token]);

    const totalValue = tokenPrice && amount ? amount * tokenPrice : null;
    const triggerPrice = tokenPrice ? tokenPrice * (1 - trailPercent / 100) : null;

    return (
        <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-background border border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-3xl font-bold text-foreground">
                            {formatAmount(amount)} {token}
                        </div>
                        {totalValue && (
                            <div className="text-sm text-muted-foreground">≈ {formatUSD(totalValue)}</div>
                        )}
                    </div>
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-4xl font-bold text-amber-600 dark:text-amber-400"
                    >
                        {trailPercent ?? '—'}%
                    </motion.div>
                </div>
            </div>

            {tokenPrice && triggerPrice && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">Will trigger if price drops to</div>
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                        {formatUSD(triggerPrice)} <span className="text-sm font-normal">from {formatUSD(tokenPrice)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Limit Order Parameters
 */
function LimitOrderParameters({ intent }: { intent: LimitOrderIntent }) {
    const { action, token, amount, targetPrice, condition } = intent.parameters;

    return (
        <div className="space-y-4">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${action === 'SELL'
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    }`}
            >
                {action}
            </motion.div>

            <div className="p-4 rounded-2xl bg-background border border-border">
                <div className="text-3xl font-bold text-foreground">
                    {formatAmount(amount)} {token}
                </div>
                <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                    When price {condition === 'BELOW' ? '≤' : '≥'}
                    <span className="font-bold text-foreground">{formatUSD(targetPrice)}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Intent Confirmation Card Component - Award-Winning UI
 */
export function IntentConfirmationCard({
    intent,
    onConfirm,
    onCancel,
    isExecuting = false
}: IntentConfirmationCardProps) {
    const style = getIntentStyle(intent.intentType);
    const Icon = style.icon;
    const [showSuccess, setShowSuccess] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`w-full bg-card border-2 ${style.borderClass} rounded-3xl overflow-hidden shadow-xl`}
        >
            {/* Header */}
            <div className={`px-5 py-4 ${style.bgClass} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                    <motion.div
                        initial={{ rotate: -180, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                        className={`p-2.5 rounded-xl bg-background border ${style.borderClass}`}
                    >
                        <Icon className={`w-5 h-5 ${style.accentClass}`} />
                    </motion.div>
                    <div>
                        <motion.h3
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.15 }}
                            className="font-bold text-foreground text-lg"
                        >
                            {style.label}
                        </motion.h3>
                        <motion.p
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-xs text-muted-foreground"
                        >
                            {style.description} • {Math.round(intent.confidence * 100)}% confidence
                        </motion.p>
                    </div>
                </div>
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onCancel}
                    disabled={isExecuting}
                    className="p-2 hover:bg-background/80 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                    <X className="w-5 h-5 text-muted-foreground" />
                </motion.button>
            </div>

            {/* Parameters */}
            <div className="p-5">
                {intent.intentType === 'STREAMING_DCA' && (
                    <DCAParameters intent={intent as StreamingDCAIntent} />
                )}
                {intent.intentType === 'TWAP_ORDER' && (
                    <TWAPParameters intent={intent as TWAPOrderIntent} />
                )}
                {intent.intentType === 'TRAILING_STOP' && (
                    <TrailingStopParameters intent={intent as TrailingStopIntent} />
                )}
                {intent.intentType === 'LIMIT_ORDER' && (
                    <LimitOrderParameters intent={intent as LimitOrderIntent} />
                )}

                {/* Stream visualization for streaming intents */}
                {(intent.intentType === 'STREAMING_DCA' || intent.intentType === 'TWAP_ORDER') && (
                    <div className={style.accentClass}>
                        <StreamProgress
                            durationSeconds={
                                intent.intentType === 'STREAMING_DCA'
                                    ? (intent as StreamingDCAIntent).parameters.durationSeconds
                                    : (intent as TWAPOrderIntent).parameters.durationSeconds
                            }
                        />
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCancel}
                    disabled={isExecuting}
                    className="flex-1 py-3.5 rounded-xl border-2 border-border text-foreground font-semibold hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    Cancel
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onConfirm}
                    disabled={isExecuting}
                    className={`flex-1 py-3.5 rounded-xl ${style.buttonClass} font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                >
                    <AnimatePresence mode="wait">
                        {isExecuting ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2"
                            >
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Executing...
                            </motion.div>
                        ) : showSuccess ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Done!
                            </motion.div>
                        ) : (
                            <motion.div
                                key="execute"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2"
                            >
                                <Zap className="w-4 h-4" />
                                Execute
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>
            </div>
        </motion.div>
    );
}

export default IntentConfirmationCard;
