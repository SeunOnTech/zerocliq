"use client"

import { motion } from "framer-motion"
import { ArrowUpRight, ArrowDownLeft, Activity, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back to ZeroSlip.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard/create">
                        <Button className="shadow-lg hover:shadow-xl transition-all">
                            Create New Order
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Active Orders", value: "0", icon: Activity, change: "+0%" },
                    { label: "Total Volume", value: "$0.00", icon: DollarSign, change: "+0%" },
                    { label: "Total Trades", value: "0", icon: ArrowUpRight, change: "+0%" },
                    { label: "Success Rate", value: "100%", icon: ArrowDownLeft, change: "+0%" },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-6 rounded-xl border border-border/50 bg-card shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            <span className="text-green-500 font-medium">{stat.change}</span> from last month
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* Recent Activity Placeholder */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-xl border border-border/50 bg-card shadow-sm p-6"
            >
                <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-lg bg-accent/5">
                    <Activity className="h-12 w-12 mb-4 opacity-20" />
                    <p className="font-medium">No recent activity</p>
                    <p className="text-sm mb-4">Create your first order to get started.</p>
                    <Link href="/dashboard/create">
                        <Button variant="outline">Create Order</Button>
                    </Link>
                </div>
            </motion.div>
        </div>
    )
}
