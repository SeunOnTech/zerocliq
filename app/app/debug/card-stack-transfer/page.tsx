"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { formatUnits, parseUnits } from "viem"

interface CardStack {
    id: string
    tokenAddress: string
    tokenSymbol: string
    tokenDecimals: number
    totalBudget: string
    periodDuration: number
    permissionsContext: string
    delegationManager: string
    status: string
    expiresAt: string
    subCards: any[]
}

export default function CardStackTransferDebugPage() {
    const { address, chainId } = useAccount()

    const [stacks, setStacks] = useState<CardStack[]>([])
    const [selectedStack, setSelectedStack] = useState<CardStack | null>(null)
    const [recipientAddress, setRecipientAddress] = useState("0x5153d9734b24715943036527279cbff18a4493ea")
    const [transferAmount, setTransferAmount] = useState("0.01") // Amount in token units (e.g., 0.01 USDC)
    const [logs, setLogs] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const log = (msg: string) => {
        console.log(msg)
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    }

    const clearLogs = () => setLogs([])

    // Fetch user's Card Stacks
    const fetchStacks = async () => {
        if (!address) {
            log("❌ Connect your wallet first")
            return
        }

        setIsLoading(true)
        log(`📊 Fetching Card Stacks for ${address}...`)

        try {
            const response = await fetch(`/api/card-stacks?walletAddress=${address}&chainId=${chainId}`)
            const data = await response.json()

            if (data.success && data.stacks) {
                setStacks(data.stacks)
                log(`✅ Found ${data.stacks.length} Card Stack(s)`)
                data.stacks.forEach((stack: CardStack) => {
                    log(`   • ${stack.tokenSymbol} | Budget: ${formatUnits(BigInt(stack.totalBudget), stack.tokenDecimals)} | Status: ${stack.status}`)
                    log(`     Context: ${stack.permissionsContext?.slice(0, 30) || 'NONE'}...`)
                })
            } else {
                setStacks([])
                log(`⚠️ No Card Stacks found`)
            }
        } catch (error: any) {
            log(`❌ Error: ${error.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Test transfer using stored permission (via BACKEND API)
    const testTransfer = async () => {
        if (!selectedStack) {
            log("❌ Select a Card Stack first")
            return
        }

        if (!recipientAddress) {
            log("❌ Enter a recipient address")
            return
        }

        if (!selectedStack.permissionsContext || selectedStack.permissionsContext === "pending") {
            log("❌ This Card Stack doesn't have a valid permissionsContext!")
            log("   The permission was never properly granted via requestExecutionPermissions()")
            return
        }

        setIsLoading(true)
        log("🔄 Starting Transfer Test...")

        try {
            log(`📝 Stack Details:`)
            log(`   Token: ${selectedStack.tokenSymbol} (${selectedStack.tokenAddress})`)
            log(`   Delegation Manager: ${selectedStack.delegationManager}`)
            log(`   Permissions Context: ${selectedStack.permissionsContext.slice(0, 50)}...`)

            // Parse transfer amount to wei
            const amountWei = parseUnits(transferAmount, selectedStack.tokenDecimals).toString()
            log(`💰 Transfer: ${transferAmount} ${selectedStack.tokenSymbol} (${amountWei} wei) to ${recipientAddress.slice(0, 10)}...`)

            log("📡 Calling /api/card-stacks/execute-transfer...")
            log("   (Server uses AGENT_EOA_PRIVATE_KEY to sign)")

            const response = await fetch('/api/card-stacks/execute-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardStackId: selectedStack.id,
                    recipientAddress,
                    amount: amountWei,
                }),
            })

            const data = await response.json()

            if (data.success) {
                log("✅ SUCCESS!")
                if (data.transactionHash) {
                    log(`🎉 TX Hash: ${data.transactionHash}`)
                    log(`   View: https://sepolia.etherscan.io/tx/${data.transactionHash}`)
                }
            } else {
                log(`❌ API Error: ${data.error}`)
                if (data.details) {
                    if (typeof data.details === 'object') {
                        // Handle object details (like insufficient balance)
                        if (data.details.message) {
                            log(`   ℹ️ ${data.details.message}`)
                        }
                        if (data.details.userSmartAccount) {
                            log(`   User SA: ${data.details.userSmartAccount}`)
                        }
                        if (data.details.balance !== undefined) {
                            log(`   Balance: ${data.details.balance}`)
                        }
                    } else {
                        log(`   Details: ${String(data.details).slice(0, 200)}...`)
                    }
                }
            }

        } catch (error: any) {
            log(`❌ Error: ${error.message}`)
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    // Check if permission context is valid
    const validatePermissionContext = () => {
        if (!selectedStack) {
            log("❌ Select a Card Stack first")
            return
        }

        log("🔍 Validating Permission Context...")
        log(`   Raw Value: ${selectedStack.permissionsContext}`)

        if (!selectedStack.permissionsContext) {
            log("❌ No permissionsContext stored!")
            return
        }

        if (selectedStack.permissionsContext === "pending") {
            log("⚠️ permissionsContext is 'pending' - placeholder value")
            return
        }

        if (selectedStack.permissionsContext.startsWith("0x")) {
            log("✅ Looks like a valid hex-encoded context!")
            log(`   Length: ${selectedStack.permissionsContext.length} chars`)
        } else {
            log("⚠️ Not a hex string - might be placeholder or invalid")
        }

        log(`📋 Delegation Manager: ${selectedStack.delegationManager}`)
        if (selectedStack.delegationManager?.startsWith("0x")) {
            log("✅ Delegation Manager looks valid")
        } else {
            log("⚠️ Delegation Manager might be invalid")
        }
    }

    useEffect(() => {
        if (address) {
            fetchStacks()
        }
    }, [address])

    return (
        <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: '1000px', margin: '0 auto' }}>
            <h1 className="text-2xl font-bold mb-4">Card Stack Transfer Test (Backend API)</h1>
            <p className="text-sm text-gray-600 mb-6">
                Test executing a token transfer using stored ERC-7715 permission via the <strong>backend API</strong>.
                <br />
                The server has the Agent key (AGENT_EOA_PRIVATE_KEY) and will execute the UserOperation.
            </p>

            {/* Wallet Info */}
            <div className="mb-6 p-4 bg-gray-100 rounded border">
                <p className="text-sm">
                    <span className="font-bold">Wallet:</span>{" "}
                    {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : "Not connected"}
                </p>
                <p className="text-sm">
                    <span className="font-bold">Chain:</span> {chainId || "N/A"} {chainId === 11155111 && "(Sepolia)"}
                </p>
            </div>

            {/* Stack Selection */}
            {stacks.length > 0 && (
                <div className="mb-6">
                    <label className="block mb-2 font-bold">Select Card Stack:</label>
                    <select
                        value={selectedStack?.id || ""}
                        onChange={(e) => {
                            const stack = stacks.find(s => s.id === e.target.value)
                            setSelectedStack(stack || null)
                        }}
                        className="p-2 border rounded w-full bg-white"
                    >
                        <option value="">-- Select a stack --</option>
                        {stacks.map(stack => (
                            <option key={stack.id} value={stack.id}>
                                {stack.tokenSymbol} | {formatUnits(BigInt(stack.totalBudget), stack.tokenDecimals)} | {stack.status}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Selected Stack Details */}
            {selectedStack && (
                <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-200">
                    <h3 className="font-bold mb-2">Selected Stack:</h3>
                    <p className="text-sm"><span className="font-medium">Token:</span> {selectedStack.tokenSymbol} ({selectedStack.tokenAddress.slice(0, 10)}...)</p>
                    <p className="text-sm"><span className="font-medium">Budget:</span> {formatUnits(BigInt(selectedStack.totalBudget), selectedStack.tokenDecimals)} {selectedStack.tokenSymbol}</p>
                    <p className="text-sm"><span className="font-medium">Period:</span> {selectedStack.periodDuration} seconds</p>
                    <p className="text-sm"><span className="font-medium">Has Context:</span> {selectedStack.permissionsContext && selectedStack.permissionsContext !== "pending" ? "✅ Yes" : "❌ No"}</p>
                </div>
            )}

            {/* Transfer Form */}
            {selectedStack && (
                <div className="mb-6 p-4 bg-gray-50 rounded border">
                    <h3 className="font-bold mb-3">Test Transfer:</h3>
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                            <label className="block mb-1 text-sm">Recipient Address:</label>
                            <input
                                type="text"
                                value={recipientAddress}
                                onChange={(e) => setRecipientAddress(e.target.value)}
                                placeholder="0x..."
                                className="p-2 border rounded w-full text-sm"
                            />
                        </div>
                        <div className="w-32">
                            <label className="block mb-1 text-sm">Amount (in {selectedStack?.tokenSymbol || 'tokens'}):</label>
                            <input
                                type="text"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                placeholder="0.01"
                                className="p-2 border rounded w-full text-sm"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 mb-6 flex-wrap">
                <button
                    onClick={fetchStacks}
                    disabled={isLoading || !address}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    🔄 Refresh Stacks
                </button>
                <button
                    onClick={validatePermissionContext}
                    disabled={isLoading || !selectedStack}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                    🔍 Validate Permission
                </button>
                <button
                    onClick={testTransfer}
                    disabled={isLoading || !selectedStack || !recipientAddress}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                    💸 Execute Transfer (via Backend)
                </button>
            </div>

            {/* Logs */}
            <div className="bg-black text-green-400 p-4 rounded min-h-[300px] overflow-auto text-xs font-mono">
                <div className="flex justify-between items-center mb-2 border-b border-green-800 pb-2">
                    <span className="font-bold">Logs</span>
                    <button onClick={clearLogs} className="text-xs text-red-400 underline">Clear</button>
                </div>
                {logs.length === 0 && <span className="opacity-50">Waiting for action...</span>}
                {logs.map((L, i) => <div key={i} className="mb-1">{L}</div>)}
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="font-bold text-yellow-800 mb-2">ℹ️ How This Works:</p>
                <ol className="list-decimal ml-4 text-yellow-700 space-y-1">
                    <li>Card Stack was created → permission granted to <strong>Server Agent</strong></li>
                    <li>Server has <code>AGENT_EOA_PRIVATE_KEY</code> to sign UserOperations</li>
                    <li>This page calls the backend API which executes the transfer</li>
                    <li>No browser session key needed (unlike the standalone debug flow)</li>
                </ol>
            </div>
        </div>
    )
}
