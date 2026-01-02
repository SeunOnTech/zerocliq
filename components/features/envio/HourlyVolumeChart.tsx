"use client"

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Loader2 } from 'lucide-react'

type HourlyStat = {
    id: string
    timestamp: number
    opsCount: number
    gasUsed: string
}

export function HourlyVolumeChart() {
    const [stats, setStats] = useState<HourlyStat[]>([])
    const [loading, setLoading] = useState(true)

    // DEMO DATA: 24h Sine wave pattern
    const generateDemoData = () => {
        const data = []
        const now = Math.floor(Date.now() / 1000)
        for (let i = 0; i < 24; i++) {
            // Creative sine wave + noise
            const time = now - ((23 - i) * 3600)
            const base = 500 + Math.sin(i / 3) * 300
            const noise = Math.random() * 100
            data.push({
                id: `demo-${i}`,
                timestamp: time,
                opsCount: Math.floor(base + noise),
                gasUsed: "0"
            })
        }
        return data
    }

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Fetch last 24 hours of data
                const query = `
                    query GetHourlyVolume {
                        HourlyStat(limit: 24, order_by: {timestamp: asc}) {
                            id
                            timestamp
                            opsCount
                            gasUsed
                        }
                    }
                `
                const res = await fetch("/api/envio-proxy", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                })
                const json = await res.json()
                if (json.data && json.data.HourlyStat && json.data.HourlyStat.length > 0) {
                    setStats(json.data.HourlyStat)
                } else {
                    setStats(generateDemoData())
                }
            } catch (e) {
                console.error("Volume fetch error:", e)
                setStats(generateDemoData())
            } finally {
                setLoading(false)
            }
        }
        fetchHistory()
    }, [])

    // Calculate max for scaling
    const maxOps = Math.max(...stats.map(s => s.opsCount), 1)

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-foreground">Network Volume</span>
                </div>
                <div className="text-[10px] text-muted-foreground">24h History</div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="flex-1 flex items-end justify-between gap-1 h-32 w-full pr-2">
                    {stats.map((stat, i) => {
                        const heightPercent = (stat.opsCount / maxOps) * 100
                        const date = new Date(stat.timestamp * 1000)
                        const hour = date.getHours()

                        return (
                            <div key={stat.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 border border-zinc-800">
                                    {stat.opsCount} Ops @ {hour}:00
                                </div>

                                {/* Bar */}
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${heightPercent}%` }}
                                    transition={{ delay: i * 0.05, type: "spring" }}
                                    className="w-full bg-blue-500/20 hover:bg-blue-500 dark:bg-blue-500/20 dark:hover:bg-blue-400 rounded-sm transition-colors min-h-[4px]"
                                />

                                {/* Label */}
                                <span className="text-[9px] text-muted-foreground/50">
                                    {i % 4 === 0 ? hour : ''}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
