import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ExternalLink, Loader2, Activity } from 'lucide-react'

// Simple type for our Envio data
type AgentActivityItem = {
    id: string
    sender: string
    userOpHash: string
    transactionHash: string
    success: boolean
    actualGasUsed: string
}

export function VerifiedActivityFeed() {
    const [activities, setActivities] = useState<AgentActivityItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    // Poll for new data every 10 seconds
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Point to local Envio or fallback (replace with deployed URL for prod)
                // Use our own API proxy to avoid CORS/browser issues
                const ENDPOINT = "/api/envio-proxy"

                const query = `
                    query GetRecentActivity {
                        EntryPoint_UserOperationEvent(limit: 5, order_by: {id: desc}) {
                            id
                            sender
                            userOpHash
                            transactionHash
                            success
                            actualGasUsed
                        }
                    }
                `

                const res = await fetch(ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // 'x-hasura-admin-secret': 'testing' // Uncomment if needed locally
                    },
                    body: JSON.stringify({ query })
                })

                const json = await res.json()
                if (json.errors) throw new Error(json.errors[0].message)

                if (json.data && json.data.EntryPoint_UserOperationEvent) {
                    setActivities(json.data.EntryPoint_UserOperationEvent)
                    setError(false)
                }
            } catch (e) {
                console.error("Envio Fetch Error:", e)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [])

    // if (error) return null // Commented out to debug


    return (
        <div className={`border rounded-xl p-4 mb-6 ${error ? 'border-destructive/20 bg-destructive/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Verified On-Chain Feed</h3>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            Powered by <span className="font-bold text-emerald-600 dark:text-emerald-400">Envio HyperIndex</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block ml-1" />
                        </p>
                    </div>
                </div>
                {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>

            <div className="space-y-2">
                {error && (
                    <p className="text-xs text-destructive font-mono mb-2">
                        Indexer Disconnected. Is it running on port 8080?
                    </p>
                )}
                <AnimatePresence mode='popLayout'>
                    {activities.length === 0 ? (
                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="text-xs text-muted-foreground text-center py-2"
                        >
                            Waiting for verified execution events...
                        </motion.p>
                    ) : (
                        activities.map((item) => {
                            console.log("Tx Hash:", item.transactionHash); // Debug log
                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border text-xs"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            Agent {item.sender.slice(0, 6)}...{item.sender.slice(-4)}
                                        </span>
                                        <span className={item.success ? "text-emerald-600 dark:text-emerald-500 font-medium" : "text-destructive"}>
                                            {item.success ? "Executed Strategy" : "Failed Execution"}
                                        </span>
                                    </div>
                                    <a
                                        href={`https://sepolia.etherscan.io/tx/${item.transactionHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                    >
                                        View Tx <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </motion.div>
                            )
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
