"use client"

import { motion } from "framer-motion"
import { WalletCards, ArrowLeft, PieChart } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function PortfolioPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="max-w-md space-y-8"
            >
                {/* Icon Animation */}
                <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                    <motion.div
                        animate={{
                            y: [0, -10, 0],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        className="bg-primary/5 rounded-3xl w-full h-full absolute inset-0 rotate-12"
                    />
                    <motion.div
                        animate={{
                            y: [0, -15, 0],
                            rotate: [0, -5, 5, 0]
                        }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        className="bg-primary/10 rounded-3xl w-full h-full absolute inset-0 -rotate-6"
                    />

                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="bg-background border-2 border-border p-6 rounded-2xl relative z-10 shadow-xl"
                    >
                        <PieChart className="w-12 h-12 text-primary" />
                    </motion.div>
                </div>

                {/* Text Content */}
                <div className="space-y-4">
                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-4xl font-black tracking-tighter"
                    >
                        Your Vault
                        <span className="block text-muted-foreground text-lg font-medium mt-2 tracking-normal">
                            Is Being Secured
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-muted-foreground leading-relaxed"
                    >
                        Soon you'll see all your assets, allocations, and performance in one beautiful, gradient-free dashboard.
                    </motion.p>
                </div>

                {/* Call to Action */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <Link href="/market">
                        <Button variant="outline" size="lg" className="rounded-xl h-12 border-2 text-base font-bold gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Return to Trading
                        </Button>
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    )
}
