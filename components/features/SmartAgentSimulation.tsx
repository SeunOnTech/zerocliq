"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Terminal,
    Zap,
    Search,
    ArrowRightLeft,
    ShieldCheck,
    Cpu,
    Sparkles,
    CheckCircle2
} from "lucide-react"

type AgentLog = {
    id: string
    icon: any
    text: string
    subtext?: string
    color: string
}

const EVENTS: AgentLog[] = [
    {
        id: "auth",
        icon: ShieldCheck,
        text: "Verifying Smart Account",
        subtext: "0x7a...3f92 (Verified)",
        color: "text-green-500"
    },
    {
        id: "scan",
        icon: Search,
        text: "Scanning Monad Mempool",
        subtext: "Searching for yield paths...",
        color: "text-blue-500"
    },
    {
        id: "opp",
        icon: Sparkles,
        text: "Opportunity Detected",
        subtext: "APY > 12% on MON-USDC",
        color: "text-purple-500"
    },
    {
        id: "exec",
        icon: Terminal,
        text: "Constructing Bundle",
        subtext: "Batching 3 txs (Gasless)",
        color: "text-amber-500"
    },
    {
        id: "swap",
        icon: ArrowRightLeft,
        text: "Executing Atomic Swap",
        subtext: "100 MON → 1450 USDC",
        color: "text-cyan-500"
    },
    {
        id: "done",
        icon: CheckCircle2,
        text: "Execution Finalized",
        subtext: "Net Profit: +0.4% • 42ms",
        color: "text-green-500"
    }
]

export function SmartAgentSimulation() {
    const [logs, setLogs] = useState<AgentLog[]>([])
    const [cycle, setCycle] = useState(0)

    useEffect(() => {
        let currentIndex = 0
        const currentCycle = cycle // Capture cycle to prevent stale closures issues if any
        setLogs([])

        const interval = setInterval(() => {
            if (currentIndex >= EVENTS.length) {
                clearInterval(interval) // Stop this interval immediately
                setTimeout(() => {
                    setCycle(c => c + 1) // Trigger re-render to restart
                }, 3000)
                return
            }

            const nextEvent = EVENTS[currentIndex]
            setLogs(prev => {
                // Duplicate check: if accidentally re-running, don't add
                if (prev.some(l => l.id === nextEvent.id)) return prev

                const newLogs = [...prev, nextEvent]
                // Strict limit to 3 items
                if (newLogs.length > 3) return newLogs.slice(newLogs.length - 3)
                return newLogs
            })
            currentIndex++
        }, 1500)

        return () => clearInterval(interval)
    }, [cycle])

    return (
        <div className="w-full max-w-[400px] font-mono text-sm relative h-[220px] flex flex-col justify-start overflow-hidden">

            {/* Ambient Background Glow - subtle blending */}
            <div className="absolute inset-0 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />

            {/* Header / Active Status */}
            <div className="flex items-center gap-3 mb-2 pl-4 border-l-2 border-primary/50 shrink-0 h-10">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary blur-sm animate-pulse opacity-50" />
                    <Cpu className="w-5 h-5 text-primary relative z-10" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ZeroCliq Agent</span>
                    <span className="text-foreground font-bold flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        ACTIVE
                    </span>
                </div>
            </div>

            {/* Feed Container */}
            <div className="flex flex-col gap-2 relative z-10 pl-2">
                <AnimatePresence mode="popLayout" initial={false}>
                    {logs.map((log) => {
                        if (!log) return null;
                        return (
                            <motion.div
                                key={`${cycle}-${log.id}`}
                                layout
                                initial={{ opacity: 0, x: -20, filter: "blur(10px)" }}
                                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                                exit={{ opacity: 0, y: -20, scale: 0.95, filter: "blur(5px)" }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                className="flex items-center gap-3 group"
                            >
                                {/* Timestamp / Line Design */}
                                <div className="w-[2px] h-8 bg-gradient-to-b from-transparent via-primary/20 to-transparent group-last:h-4 group-last:bg-gradient-to-t group-last:from-primary group-last:to-transparent" />

                                {/* Icon Container */}
                                <div className="relative">
                                    <div className={`absolute inset-0 blur-lg opacity-20 ${log.color ? log.color.replace('text-', 'bg-') : ''}`} />
                                    <div className="bg-background/80 backdrop-blur-md border border-border p-1.5 rounded-lg shadow-sm">
                                        <log.icon className={`w-3.5 h-3.5 ${log.color}`} />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex flex-col justify-center">
                                    <span className="text-foreground font-semibold text-xs">{log.text}</span>
                                    {log.subtext && (
                                        <span className="text-[10px] text-muted-foreground">{log.subtext}</span>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>

                {/* Cursor Effect just to show system is waiting/active */}
                {logs.length < EVENTS.length && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="pl-[2.75rem] pt-1"
                    >
                        <span className="inline-block w-1.5 h-3 bg-primary/50 animate-pulse" />
                    </motion.div>
                )}
            </div>
        </div>
    )
}
