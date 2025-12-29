"use client"

import { motion } from "framer-motion"
import { TrendingUp, Users, Activity } from "lucide-react"

const stats = [
    {
        label: "Reference Price (SOL)",
        value: "$145.23",
        change: "+2.4%",
        icon: TrendingUp,
        color: "text-green-500"
    },
    {
        label: "24h Volume",
        value: "$1,234,567",
        change: "+12%",
        icon: Activity,
        color: "text-blue-500"
    },
    {
        label: "Active Traders",
        value: "892",
        change: "+54",
        icon: Users,
        color: "text-purple-500"
    }
]

export function MarketStats() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {stats.map((stat, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-card/50 backdrop-blur-sm border border-border/50 p-4 rounded-2xl flex items-center justify-between hover:border-primary/20 transition-colors"
                >
                    <div>
                        <div className="text-xs text-muted-foreground font-medium mb-1">{stat.label}</div>
                        <div className="text-xl font-bold flex items-center gap-2">
                            {stat.value}
                            <span className={`text-xs font-medium ${stat.color} bg-background/50 px-1.5 py-0.5 rounded-full`}>
                                {stat.change}
                            </span>
                        </div>
                    </div>
                    <div className={`h-10 w-10 rounded-xl bg-background/50 flex items-center justify-center ${stat.color}`}>
                        <stat.icon className="h-5 w-5" />
                    </div>
                </motion.div>
            ))}
        </div>
    )
}
