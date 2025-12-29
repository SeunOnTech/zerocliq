"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"

interface SmartCard {
    id: string
    type: string
    name: string
    status: string
    chainId: number
    createdAt: string
}

export default function DeleteTradeCardDebugPage() {
    const { address, chainId } = useAccount()
    const [cards, setCards] = useState<SmartCard[]>([])
    const [logs, setLogs] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const log = (msg: string) => {
        console.log(msg)
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    }

    const clearLogs = () => setLogs([])

    // Fetch user's Smart Cards
    const fetchCards = async () => {
        if (!address || !chainId) {
            log("❌ Connect your wallet first")
            return
        }

        setIsLoading(true)
        log(`📊 Fetching Smart Cards for ${address} on chain ${chainId}...`)

        try {
            const params = new URLSearchParams({
                userId: address,
                chainId: chainId.toString(),
            })

            const response = await fetch(`/api/smart-cards/user?${params.toString()}`)
            const data = await response.json()

            if (data.success && data.smartCards) {
                setCards(data.smartCards)
                log(`✅ Found ${data.smartCards.length} Smart Card(s)`)
                data.smartCards.forEach((card: SmartCard) => {
                    log(`   • ${card.type} (${card.status}) - ${card.id.slice(0, 8)}...`)
                })
            } else {
                setCards([])
                log(`⚠️ No Smart Cards found: ${data.error || 'Empty result'}`)
            }
        } catch (error: any) {
            log(`❌ Error: ${error.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Delete a specific Smart Card
    const deleteCard = async (cardId: string) => {
        setIsLoading(true)
        log(`🗑️ Deleting Smart Card ${cardId.slice(0, 8)}...`)

        try {
            const response = await fetch(`/api/smart-cards/${cardId}`, {
                method: 'DELETE',
            })

            const data = await response.json()

            if (data.success) {
                log(`✅ Deleted Smart Card ${cardId.slice(0, 8)}...`)
                // Remove from local state
                setCards(prev => prev.filter(c => c.id !== cardId))
            } else {
                log(`❌ Delete failed: ${data.error || 'Unknown error'}`)
            }
        } catch (error: any) {
            log(`❌ Error: ${error.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Delete all TRADING cards
    const deleteAllTradeCards = async () => {
        const tradeCards = cards.filter(c => c.type === 'TRADING')
        if (tradeCards.length === 0) {
            log("⚠️ No Trade Cards to delete")
            return
        }

        log(`🗑️ Deleting ${tradeCards.length} Trade Card(s)...`)
        for (const card of tradeCards) {
            await deleteCard(card.id)
        }
        log("✅ All Trade Cards deleted!")
    }

    // Fetch cards on wallet connection
    useEffect(() => {
        if (address && chainId) {
            fetchCards()
        }
    }, [address, chainId])

    return (
        <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: '900px', margin: '0 auto' }}>
            <h1 className="text-2xl font-bold mb-4">Delete Trade Cards (Debug)</h1>
            <p className="text-sm text-gray-600 mb-6">
                View and delete Smart Cards from the database for the connected wallet.
            </p>

            {/* Wallet Info */}
            <div className="mb-6 p-4 bg-gray-100 rounded border">
                <p className="text-sm">
                    <span className="font-bold">Wallet:</span>{" "}
                    {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : "Not connected"}
                </p>
                <p className="text-sm">
                    <span className="font-bold">Chain:</span> {chainId || "N/A"}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mb-6 flex-wrap">
                <button
                    onClick={fetchCards}
                    disabled={isLoading || !address}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? "Loading..." : "🔄 Refresh Cards"}
                </button>
                <button
                    onClick={deleteAllTradeCards}
                    disabled={isLoading || cards.filter(c => c.type === 'TRADING').length === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                    🗑️ Delete All Trade Cards
                </button>
            </div>

            {/* Cards List */}
            {cards.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">Smart Cards ({cards.length})</h2>
                    <div className="space-y-2">
                        {cards.map(card => (
                            <div
                                key={card.id}
                                className={`flex items-center justify-between p-3 rounded border ${card.status === 'ACTIVE'
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                <div>
                                    <span className="font-bold">{card.type}</span>
                                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${card.status === 'ACTIVE'
                                            ? 'bg-green-200 text-green-800'
                                            : 'bg-gray-200 text-gray-800'
                                        }`}>
                                        {card.status}
                                    </span>
                                    <p className="text-xs text-gray-500 mt-1">
                                        ID: {card.id.slice(0, 16)}... | Chain: {card.chainId}
                                    </p>
                                </div>
                                <button
                                    onClick={() => deleteCard(card.id)}
                                    disabled={isLoading}
                                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50"
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Logs */}
            <div className="bg-gray-50 p-4 rounded border min-h-[200px] whitespace-pre-wrap overflow-auto text-sm">
                <div className="flex justify-between items-center mb-2 border-b pb-2">
                    <span className="font-bold">Logs</span>
                    <button onClick={clearLogs} className="text-xs text-red-500 underline">Clear</button>
                </div>
                {logs.length === 0 && <span className="text-gray-400">Waiting for action...</span>}
                {logs.map((L, i) => <div key={i} className="mb-1">{L}</div>)}
            </div>
        </div>
    )
}
