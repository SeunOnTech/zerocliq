"use client"

import { motion } from "framer-motion"
import { ArrowRight, Wallet, Search, CheckCircle2 } from "lucide-react"

const steps = [
    {
        id: "01",
        title: "Connect Wallet",
        description: "Connect your EVM wallet. ZeroCliq Smart Accounts deploy instantly.",
        icon: Wallet,
    },
    {
        id: "02",
        title: "Define Intent",
        description: "Select a yield strategy or swap target. You define the 'what', agents handle the 'how'.",
        icon: Search,
    },
    {
        id: "03",
        title: "Agent Execution",
        description: "Your Smart Agent bundles transactions and executes atomically. No gas wars, no slippage.",
        icon: CheckCircle2,
    },
]

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 overflow-hidden">
            <div className="container px-4 mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
                    <div className="max-w-xl">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
                            Execution made simple.
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            ZeroCliq abstracts the complexity of MEV and gas. Just simple, intent-based execution on any EVM chain.
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <ArrowRight className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                </div>

                <div className="relative">
                    {/* Connecting Line */}
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -z-10 hidden md:block" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {steps.map((step, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.2 }}
                                className="bg-background relative"
                            >
                                <div className="flex flex-col items-start p-6 rounded-2xl border border-border/50 bg-card hover:border-primary/50 transition-colors h-full">
                                    <div className="text-6xl font-black text-muted-foreground/10 mb-4 absolute -top-8 right-4 select-none">
                                        {step.id}
                                    </div>
                                    <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-6 shadow-lg shadow-primary/20 z-10">
                                        <step.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                    <p className="text-muted-foreground">
                                        {step.description}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
