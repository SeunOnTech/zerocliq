"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, RefreshCcw, Loader2, User, ShieldCheck } from "lucide-react"

export function OrderFlowSimulation() {
    const [step, setStep] = useState(0)

    // Animation sequence loop
    // 0: Idle
    // 1: Move to Input
    // 2: Typing Amount
    // 3: Move to Button
    // 4: Click Button
    // 5: Processing / Waiting for Peer
    // 6: Peer Found / Matched
    // 7: Completed
    useEffect(() => {
        const sequence = async () => {
            while (true) {
                setStep(0) // Reset
                await new Promise(r => setTimeout(r, 1000))

                setStep(1) // Move to Input
                await new Promise(r => setTimeout(r, 800))

                setStep(2) // Typing
                await new Promise(r => setTimeout(r, 1500))

                setStep(3) // Move to Button
                await new Promise(r => setTimeout(r, 800))

                setStep(4) // Click
                await new Promise(r => setTimeout(r, 200))

                setStep(5) // Processing
                await new Promise(r => setTimeout(r, 2000))

                setStep(6) // Peer Found
                await new Promise(r => setTimeout(r, 1500))

                setStep(7) // Completed
                await new Promise(r => setTimeout(r, 3000))
            }
        }
        sequence()
    }, [])

    return (
        <div className="relative w-full max-w-[340px] mx-auto aspect-[4/5] bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 opacity-50">
                <div className="text-xs font-bold flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    P2P Market
                </div>
                <div className="text-[10px] font-mono">MON/USDC</div>
            </div>

            {/* Form Content */}
            <div className="space-y-4 flex-1 relative z-10">
                {/* Input 1: You Pay */}
                <div className={`bg-background/50 rounded-xl p-3 border transition-colors duration-300 ${step === 2 ? 'border-primary' : 'border-border/50'}`}>
                    <div className="text-[10px] text-muted-foreground mb-1">You Pay</div>
                    <div className="flex justify-between items-center">
                        <div className="text-lg font-bold min-h-[28px] flex items-center">
                            {step < 2 ? <span className="text-muted-foreground/30">0.00</span> : (
                                <Typewriter text="10.00" start={step >= 2} />
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 bg-background rounded-full px-2 py-1 border border-border/50">
                            <img src="https://avatars.githubusercontent.com/u/103986705?s=200&v=4" className="w-4 h-4 rounded-full" alt="MON" />
                            <span className="text-[10px] font-bold">MON</span>
                        </div>
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-card border border-border rounded-full p-1.5 shadow-sm">
                        <RefreshCcw className="h-3 w-3 text-muted-foreground" />
                    </div>
                </div>

                {/* Input 2: You Receive */}
                <div className="bg-background/50 rounded-xl p-3 border border-border/50">
                    <div className="text-[10px] text-muted-foreground mb-1">You Receive</div>
                    <div className="flex justify-between items-center">
                        <div className="text-lg font-bold min-h-[28px] flex items-center">
                            {step < 2 ? <span className="text-muted-foreground/30">0.00</span> : (
                                <Typewriter text="1,450.00" start={step >= 2} delay={0.5} />
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 bg-background rounded-full px-2 py-1 border border-border/50">
                            <img src="https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694" className="w-4 h-4 rounded-full" alt="USDC" />
                            <span className="text-[10px] font-bold">USDC</span>
                        </div>
                    </div>
                </div>

                {/* Button */}
                <motion.div
                    animate={{ scale: step === 4 ? 0.95 : 1 }}
                    className={`mt-6 w-full h-12 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg relative overflow-hidden transition-colors duration-300 ${step >= 5 ? 'bg-green-500' : 'bg-primary'}`}
                >
                    <AnimatePresence mode="wait">
                        {step >= 5 ? (
                            <motion.div
                                key="processing"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="flex items-center gap-2"
                            >
                                {step === 5 && <Loader2 className="h-4 w-4 animate-spin" />}
                                {step === 5 ? "Waiting for Peer..." : step === 6 ? "Peer Found!" : "Completed"}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="label"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                            >
                                Create Order
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Status Overlay for Step 6 & 7 */}
                <AnimatePresence>
                    {step >= 6 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute inset-x-4 bottom-24 bg-card border border-border p-3 rounded-xl shadow-xl z-20"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                    <User className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold">Peer Matched</div>
                                    <div className="text-[10px] text-muted-foreground">0x7a...3f92</div>
                                </div>
                                {step === 7 && (
                                    <div className="h-6 w-6 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                            </div>
                            {step === 7 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 text-[10px] text-green-500 font-medium"
                                >
                                    <ShieldCheck className="h-3 w-3" />
                                    Assets Swapped Successfully
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Hand Cursor */}
            <motion.div
                className="absolute z-50 pointer-events-none drop-shadow-xl"
                animate={{
                    x: step === 0 ? 50 : step === 1 ? 100 : step === 2 ? 100 : step === 3 ? 170 : step === 4 ? 170 : 280,
                    y: step === 0 ? 300 : step === 1 ? 100 : step === 2 ? 100 : step === 3 ? 300 : step === 4 ? 300 : 400,
                    opacity: step >= 5 ? 0 : 1,
                    scale: step === 4 ? 0.9 : 1
                }}
                transition={{
                    duration: step === 4 ? 0.1 : 0.8,
                    ease: "easeInOut"
                }}
            >
                {/* Hand Icon SVG */}
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.5 28C11.5 28 5.5 22 5.5 17C5.5 12 11.5 17 11.5 17V5C11.5 3.34315 12.8431 2 14.5 2C16.1569 2 17.5 3.34315 17.5 5V14H18.5V7C18.5 6.17157 19.1716 5.5 20 5.5C20.8284 5.5 21.5 6.17157 21.5 7V14H22.5V9C22.5 8.17157 23.1716 7.5 24 7.5C24.8284 7.5 25.5 8.17157 25.5 9V14H26.5V11C26.5 10.1716 27.1716 9.5 28 9.5C28.8284 9.5 29.5 10.1716 29.5 11V19C29.5 23 25.5 28 25.5 28H11.5Z" fill="white" stroke="black" strokeWidth="2" strokeLinejoin="round" />
                </svg>
            </motion.div>
        </div>
    )
}

// Helper for typing effect
function Typewriter({ text, start, delay = 0 }: { text: string, start: boolean, delay?: number }) {
    const [displayed, setDisplayed] = useState("")

    useEffect(() => {
        if (!start) {
            setDisplayed("")
            return
        }

        let current = ""
        let i = 0
        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                if (i < text.length) {
                    current += text[i]
                    setDisplayed(current)
                    i++
                } else {
                    clearInterval(interval)
                }
            }, 50) // Typing speed
            return () => clearInterval(interval)
        }, delay * 1000)

        return () => clearTimeout(timeout)
    }, [start, text, delay])

    return <span>{displayed}<span className="animate-pulse">|</span></span>
}
