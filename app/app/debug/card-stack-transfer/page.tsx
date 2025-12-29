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
    const [recipientAddress, setRecipientAddress] = useState("")
    const [transferAmount, setTransferAmount] = useState("0.01")
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
                    log(`     Context: ${stack.permissionsContext?.slice(0, 20) || 'NONE'}...`)
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

    // Test transfer using stored permission
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

            const response = await fetch('/api/card-stacks/execute-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stackId: selectedStack.id,
                    recipientAddress,
                    amount: amountWei,
                }),
            })

            const data = await response.json()

            if (data.success) {
                log("✅ API Response:")
                log(`   Message: ${data.message}`)
                if (data.debug) {
                    log(`   Agent: ${data.debug.agentAddress}`)
                    log(`   User SA: ${data.debug.userSmartAccount}`)
                    log(`   Delegation Manager: ${data.debug.delegationManager}`)
                    log(`   Context Length: ${data.debug.permissionsContextLength}`)
                    log(`   Note: ${data.debug.note}`)
                }
                if (data.transactionHash) {
                    log(`🎉 TX Hash: ${data.transactionHash}`)
                }
            } else {
                log(`❌ API Error: ${data.error}`)
                if (data.debug) {
                    log(`   Debug: ${JSON.stringify(data.debug)}`)
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
            log("   This means requestExecutionPermissions() was never called")
            return
        }

        if (selectedStack.permissionsContext === "pending") {
            log("⚠️ permissionsContext is 'pending' - placeholder value")
            log("   Need to call requestExecutionPermissions() and store real response")
            return
        }

        // Try to parse as hex
        if (selectedStack.permissionsContext.startsWith("0x")) {
            log("✅ Looks like a valid hex-encoded context!")
            log(`   Length: ${selectedStack.permissionsContext.length} chars`)
        } else {
            log("⚠️ Not a hex string - might be placeholder or invalid")
        }

        log("")
        log(`📋 Delegation Manager: ${selectedStack.delegationManager}`)
        if (selectedStack.delegationManager && selectedStack.delegationManager.startsWith("0x")) {
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
            <h1 className="text-2xl font-bold mb-4">Card Stack Transfer Test (ERC-7715)</h1>
            <p className="text-sm text-gray-600 mb-6">
                Test executing a token transfer using stored ERC-7715 permission context.
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
                            <label className="block mb-1 text-sm">Amount:</label>
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
                    💸 Test Transfer
                </button>
            </div>

            {/* Logs */}
            <div className="bg-gray-50 p-4 rounded border min-h-[300px] whitespace-pre-wrap overflow-auto text-sm">
                <div className="flex justify-between items-center mb-2 border-b pb-2">
                    <span className="font-bold">Logs</span>
                    <button onClick={clearLogs} className="text-xs text-red-500 underline">Clear</button>
                </div>
                {logs.length === 0 && <span className="text-gray-400">Waiting for action...</span>}
                {logs.map((L, i) => <div key={i} className="mb-1">{L}</div>)}
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="font-bold text-yellow-800 mb-2">⚠️ How Card Stack Transfers Work (ERC-7715):</p>
                <ol className="list-decimal ml-4 text-yellow-700 space-y-1">
                    <li>User creates Card Stack → calls <code>requestExecutionPermissions()</code></li>
                    <li>MetaMask returns <code>permissionsContext</code> + <code>delegationManager</code></li>
                    <li>These are stored in the CardStack database record</li>
                    <li>Agent uses <code>sendUserOperationWithDelegation()</code> to transfer tokens</li>
                </ol>
            </div>
        </div>
    )
}
