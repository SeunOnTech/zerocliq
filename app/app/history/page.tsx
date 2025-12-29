"use client"

import { motion } from "framer-motion"
import { History, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HistoryPage() {
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
                        animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 bg-muted rounded-full"
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-2 border-2 border-dashed border-muted-foreground/30 rounded-full"
                    />

                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="p-6 relative z-10"
                    >
                        <History className="w-16 h-16 text-muted-foreground stroke-1" />
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
                        No History Yet
                        <span className="block text-muted-foreground text-lg font-medium mt-2 tracking-normal">
                            The Saga Begins With You
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-muted-foreground leading-relaxed"
                    >
                        Your trading journal is currently blank. Create your first ZeroSlip order to start writing your on-chain legacy.
                    </motion.p>
                </div>

                {/* Call to Action */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <Link href="/market">
                        <Button size="lg" className="rounded-xl h-12 text-base font-bold gap-2 px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                            Start Trading
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    )
}
