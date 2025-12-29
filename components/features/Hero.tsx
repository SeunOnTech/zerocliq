"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion, useMotionTemplate, useMotionValue } from "framer-motion"
import { ArrowRight, Zap, Shield, Lock, RefreshCcw, ChevronDown } from "lucide-react"
import { Spotlight } from "@/components/ui/spotlight"
import { TextGenerateEffect } from "@/components/ui/text-generate-effect"
import { SmartAgentSimulation } from "@/components/features/SmartAgentSimulation"
import { Particles } from "@/components/features/hero/Particles"
import { MouseEvent } from "react"

export function Hero() {
    // Mouse tracking for card glow effect
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    return (
        <div className="min-h-[calc(100vh-80px)] w-full flex md:items-center md:justify-center bg-background antialiased relative overflow-hidden pt-24 pb-10">
            <Particles />

            <Spotlight
                className="-top-40 left-0 md:left-60 md:-top-20"
                fill="hsl(var(--primary))"
            />

            <div className="container mx-auto px-4 relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                {/* Left Content */}
                <div className="flex-1 text-center lg:text-left max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-xl mb-6"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse shadow-[0_0_10px_rgba(234,88,12,0.5)]"></span>
                        Now Live on
                        <img src="https://assets.coingecko.com/coins/images/38927/standard/monad.png?1764042736" alt="Monad" className="h-5 w-5 ml-2 rounded-full" />
                    </motion.div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                            Zero Cliq.
                        </span>
                        <br />
                        <span className="text-primary">
                            Infinite Yield.
                        </span>
                    </h1>

                    <div className="mt-4 font-normal text-base md:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
                        <TextGenerateEffect
                            words="Trade DeFi without signature fatigue. ZeroCliq Smart Cards let you swap, stake, and manage assets with zero wallet popups."
                            className="font-normal"
                        />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
                    >
                        <Link href="/app" className="w-full sm:w-auto">
                            <Button size="lg" className="w-full sm:w-auto rounded-full h-12 px-8 text-base font-bold shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)] transition-all hover:scale-105">
                                Launch App <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full h-12 px-8 border-border/50 text-foreground hover:bg-accent/50 backdrop-blur-sm text-base">
                            How it Works
                        </Button>
                    </motion.div>

                    <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-xs font-medium text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <span>Non-Custodial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <span>Gasless Transactions</span>
                        </div>
                    </div>
                </div>

                {/* Right Content - Animated Order Flow */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, x: 50 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="flex-1 w-full max-w-[320px] relative"
                >
                    {/* Glow Effect */}
                    <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-full blur-3xl opacity-30" />

                    <SmartAgentSimulation />
                </motion.div>
            </div>
        </div >
    )
}
