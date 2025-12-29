"use client"

import { motion } from "framer-motion"
import { Construction, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function LimitOrdersPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-md space-y-8"
            >
                {/* Icon Animation */}
                <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-4 border-dashed border-border rounded-full"
                    />
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="bg-primary/10 p-6 rounded-2xl"
                    >
                        <Construction className="w-12 h-12 text-primary" />
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
                        Limit Orders
                        <span className="block text-muted-foreground text-lg font-medium mt-2 tracking-normal">
                            Are Under Construction
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-muted-foreground leading-relaxed"
                    >
                        We're building a powerful limit order engine that lets you set your price and sleep soundly. No gradients were harmed in the making of this feature.
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
                            Back to Market
                        </Button>
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    )
}
