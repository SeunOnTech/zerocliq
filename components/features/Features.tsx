"use client"

import { motion } from "framer-motion"
import { ArrowLeftRight, Coins, Layers, Zap, ShieldCheck, Globe } from "lucide-react"
import { Spotlight } from "@/components/ui/spotlight"

const features = [
    {
        title: "Smart Accounts",
        description: "Create a gasless, abstracted account. No more popups for every interaction.",
        icon: Layers,
        className: "md:col-span-2",
        gradient: "from-orange-500/20 to-red-500/20"
    },
    {
        title: "Smart Cards",
        description: "Deploy logic, not just orders. Set limits and permissions for your AI agents.",
        icon: Coins,
        className: "md:col-span-1",
        gradient: "from-blue-500/20 to-cyan-500/20"
    },
    {
        title: "Yield Automation",
        description: "Auto-compound your assets across Solana's best yield sources.",
        icon: Zap,
        className: "md:col-span-1",
        gradient: "from-yellow-500/20 to-orange-500/20"
    },
    {
        title: "Intent-Based Trading",
        description: "Define your outcome, and let the network execute the best route.",
        icon: Globe,
        className: "md:col-span-2",
        gradient: "from-purple-500/20 to-pink-500/20"
    },
]

export function Features() {
    return (
        <section id="features" className="py-20 relative bg-[#FAF5FF] dark:bg-background/40">
            {/* Dark Mode Background Effects */}
            <div className="absolute inset-0 bg-grid-white/[0.02] -z-10 hidden dark:block" />

            <div className="container px-4 mx-auto relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-semibold text-primary mb-4 shadow-sm dark:bg-primary/10 dark:border-primary/20 dark:text-primary dark:shadow-none"
                    >
                        <ShieldCheck className="w-3 h-3 mr-2 text-primary" />
                        Built for Precision
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-purple-950 dark:text-foreground"
                    >
                        Why ZeroCliq?
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-purple-900/60 font-medium dark:text-muted-foreground"
                    >
                        We're reimagining DeFi with autonomous agents. ZeroCliq automates yield, executes intents, and abstracts complexity.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {features.map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            whileHover={{ y: -5 }}
                            className={`group relative p-8 rounded-3xl bg-white border border-transparent shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 dark:bg-card/50 dark:backdrop-blur-sm dark:border-border/50 dark:shadow-none dark:hover:border-primary/50 ${feature.className}`}
                        >
                            <div className="relative z-10">
                                <div className="h-12 w-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center mb-6 text-primary shadow-sm group-hover:bg-primary/5 group-hover:scale-110 transition-all duration-300 dark:bg-background/80 dark:border-border/50 dark:group-hover:bg-primary/10">
                                    <feature.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-purple-950 dark:text-foreground">{feature.title}</h3>
                                <p className="text-base text-purple-900/60 leading-relaxed group-hover:text-purple-900 transition-colors dark:text-muted-foreground dark:group-hover:text-foreground">
                                    {feature.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
