"use client"

import { motion } from "framer-motion"
import { getTokenLogo } from "@/lib/tokens"

interface SwapRouteVisualProps {
    tokenA: string
    tokenB: string
}

export function SwapRouteVisual({ tokenA, tokenB }: SwapRouteVisualProps) {
    const logoA = getTokenLogo(tokenA)
    const logoB = getTokenLogo(tokenB)

    return (
        <div className="flex items-center gap-2 group/visual overflow-hidden">
            {/* Token A */}
            <div className="relative z-10">
                <div className="w-8 h-8 rounded-full bg-background border border-border/50 flex items-center justify-center p-0.5 shadow-sm">
                    {logoA ? (
                        <img src={logoA} alt={tokenA} className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <span className="text-[10px] font-bold">{tokenA[0]}</span>
                    )}
                </div>
                {/* Badge */}
                <div className="absolute -bottom-1 -right-1 bg-card text-[8px] font-bold px-1 rounded-sm border border-border/50 shadow-sm">
                    {tokenA}
                </div>
            </div>

            {/* Animated Path */}
            <div className="flex-1 flex items-center justify-center relative min-w-[60px] max-w-[80px]">
                {/* Static Line */}
                <div className="absolute h-[2px] w-full bg-border/30 rounded-full" />

                {/* Moving Particle */}
                <motion.div
                    animate={{
                        x: [-20, 20],
                        opacity: [0, 1, 0],
                        scale: [0.5, 1, 0.5]
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] z-10"
                />

                {/* Arrow Head */}
                <div className="absolute right-0 text-border/50">
                    <svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0L6 3L0 6V0Z" fill="currentColor" opacity="0.5" />
                    </svg>
                </div>
            </div>

            {/* Token B */}
            <div className="relative z-10">
                <div className="w-8 h-8 rounded-full bg-background border border-border/50 flex items-center justify-center p-0.5 shadow-sm">
                    {logoB ? (
                        <img src={logoB} alt={tokenB} className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <span className="text-[10px] font-bold">{tokenB[0]}</span>
                    )}
                </div>
                {/* Badge */}
                <div className="absolute -bottom-1 -right-1 bg-card text-[8px] font-bold px-1 rounded-sm border border-border/50 shadow-sm">
                    {tokenB}
                </div>
            </div>
        </div>
    )
}
