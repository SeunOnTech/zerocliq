"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import {
    createWalletClient,
    custom,
    parseUnits,
    type Hex,
    type Address,
} from "viem"
import { sepolia } from "viem/chains"
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions"

interface Permission {
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
    createdAt: string
}

/**
 * ERC-7715 Debug Page with API Routes
 * 
 * - Frontend only handles permission request (needs MetaMask)
 * - Backend handles Agent setup and redemption (has private key)
 * - Permissions are saved to DB and can be selected for redemption
 */
export default function AgentErc7715DebugPage() {
    const { address, isConnected, chainId } = useAccount()

    // State
    const [logs, setLogs] = useState<string[]>([])
    const [agentAddress, setAgentAddress] = useState<string>("")
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
    const [permissionsResponse, setPermissionsResponse] = useState<any>(null)
    const [txHash, setTxHash] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [recipientAddress, setRecipientAddress] = useState("0x5153d9734b24715943036527279cbff18a4493ea")
    const [transferAmount, setTransferAmount] = useState("10000")

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    const clearLogs = () => setLogs([])

    // Fetch Agent address from backend
    const fetchAgentAddress = useCallback(async () => {
        try {
            addLog("📡 Fetching Agent address from backend...")
            const res = await fetch(`/api/smart-cards/agent-address?chainId=${chainId || 11155111}`)
            const data = await res.json()
            if (data.success) {
                setAgentAddress(data.agentSmartAccountAddress)
                addLog(`✅ Agent Smart Account: ${data.agentSmartAccountAddress}`)
            } else {
                addLog(`❌ Error: ${data.error}`)
            }
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`)
        }
    }, [chainId])

    // Fetch saved permissions
    const fetchPermissions = useCallback(async () => {
        if (!address) return
        try {
            addLog("📡 Fetching saved permissions...")
            const res = await fetch(`/api/debug/permissions?walletAddress=${address}`)
            const data = await res.json()
            if (data.success) {
                setPermissions(data.permissions)
                addLog(`✅ Found ${data.permissions.length} saved permission(s)`)
            }
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`)
        }
    }, [address])

    // Request permissions from MetaMask
    const requestPermissions = useCallback(async () => {
        try {
            if (!agentAddress) throw new Error("Agent address not loaded")
            if (!window.ethereum) throw new Error("No Wallet")

            setIsLoading(true)
            const walletClient = createWalletClient({
                transport: custom(window.ethereum as any),
                chain: sepolia,
            }).extend(erc7715ProviderActions())

            const currentTime = Math.floor(Date.now() / 1000)
            const expiry = currentTime + 86400 // 1 day

            const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" // USDC Sepolia

            addLog("🚀 Requesting Execution Permissions...")
            addLog(`   Granting permission to Agent: ${agentAddress}`)

            const grantedPermissions = await walletClient.requestExecutionPermissions([{
                chainId: sepolia.id,
                expiry,
                signer: {
                    type: "account",
                    data: {
                        address: agentAddress as Address,
                    },
                },
                permission: {
                    type: "erc20-token-periodic",
                    data: {
                        tokenAddress,
                        periodAmount: parseUnits("10", 6),
                        periodDuration: 86400,
                    },
                },
                isAdjustmentAllowed: true,
            }])

            setPermissionsResponse(grantedPermissions)
            addLog("✅ Permissions Granted!")
            addLog(`   Context: ${grantedPermissions[0].context?.slice(0, 50)}...`)
            addLog(`   Delegation Manager: ${grantedPermissions[0].signerMeta?.delegationManager}`)

            // Auto-save to DB
            addLog("💾 Saving permission to DB...")
            const saveRes = await fetch("/api/debug/permissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: address,
                    chainId: chainId || 11155111,
                    permissionsContext: grantedPermissions[0].context,
                    delegationManager: grantedPermissions[0].signerMeta?.delegationManager,
                    tokenAddress,
                    tokenSymbol: "USDC",
                    tokenDecimals: 6,
                    periodAmount: "10000000",
                    periodDuration: 86400,
                    expiresAt: new Date(expiry * 1000).toISOString(),
                }),
            })
            const saveData = await saveRes.json()
            if (saveData.success) {
                addLog(`✅ Permission saved! ID: ${saveData.permission.id}`)
                fetchPermissions()
            } else {
                addLog(`❌ Save Error: ${saveData.error}`)
            }

        } catch (e: any) {
            addLog(`❌ Permission Error: ${e.message}`)
        } finally {
            setIsLoading(false)
        }
    }, [agentAddress, address, chainId, fetchPermissions])

    // Redeem permission via backend
    const redeemPermission = useCallback(async () => {
        try {
            if (!selectedPermission) throw new Error("Select a permission first")

            setIsLoading(true)
            addLog("🔧 Calling backend to redeem permission...")
            addLog(`   Permission ID: ${selectedPermission.id}`)
            addLog(`   Token: ${selectedPermission.tokenSymbol}`)
            addLog(`   Amount: ${transferAmount} wei`)
            addLog(`   Recipient: ${recipientAddress}`)

            const res = await fetch("/api/debug/permissions/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    permissionId: selectedPermission.id,
                    recipientAddress,
                    amount: transferAmount,
                }),
            })

            const data = await res.json()

            if (data.success) {
                setTxHash(data.transactionHash)
                addLog(`✅ SUCCESS!`)
                addLog(`   UserOp: ${data.userOpHash}`)
                addLog(`   TX: ${data.transactionHash}`)
            } else {
                addLog(`❌ Redeem Error: ${data.error}`)
                if (data.details) {
                    addLog(`   Details: ${data.details.slice(0, 200)}`)
                }
            }
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`)
        } finally {
            setIsLoading(false)
        }
    }, [selectedPermission, recipientAddress, transferAmount])

    // Initial load
    useEffect(() => {
        fetchAgentAddress()
    }, [fetchAgentAddress])

    useEffect(() => {
        if (address) {
            fetchPermissions()
        }
    }, [address, fetchPermissions])

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6 font-mono text-sm">
            <h1 className="text-2xl font-bold border-b pb-4">ERC-7715 Agent Debug (API Mode)</h1>
            <p className="text-gray-500 text-sm">
                Backend handles Agent credentials. Frontend only requests permissions via MetaMask.
            </p>

            {/* Connection Status */}
            <section className="p-4 bg-gray-50 dark:bg-gray-900 rounded border">
                <h2 className="font-bold mb-2">Status</h2>
                <p className="text-sm">Wallet: {isConnected ? address : "Not connected"}</p>
                <p className="text-sm">Chain: {chainId} {chainId === 11155111 && "(Sepolia)"}</p>
                <p className="text-sm">Agent SA: {agentAddress || "Loading..."}</p>
            </section>

            {/* Request Permission */}
            <section className="p-4 border rounded">
                <h2 className="font-bold mb-2">1. Request Permission</h2>
                <p className="text-xs text-gray-500 mb-2">User grants Agent permission to transfer USDC</p>
                <button
                    onClick={requestPermissions}
                    disabled={isLoading || !isConnected || !agentAddress}
                    className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                    {isLoading ? "Processing..." : "Request & Save Permission"}
                </button>
            </section>

            {/* Permission Selection */}
            <section className="p-4 border rounded">
                <h2 className="font-bold mb-2">2. Select Saved Permission</h2>
                <div className="flex gap-2 items-center mb-2">
                    <select
                        value={selectedPermission?.id || ""}
                        onChange={(e) => {
                            const p = permissions.find(p => p.id === e.target.value)
                            setSelectedPermission(p || null)
                        }}
                        className="p-2 border rounded flex-1 bg-white"
                    >
                        <option value="">-- Select a permission --</option>
                        {permissions.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.tokenSymbol} | {new Date(p.createdAt).toLocaleString()}
                            </option>
                        ))}
                    </select>
                    <button onClick={fetchPermissions} className="px-3 py-2 bg-gray-200 rounded">
                        🔄
                    </button>
                </div>
                {selectedPermission && (
                    <div className="text-xs bg-blue-50 p-2 rounded">
                        <p>Token: {selectedPermission.tokenSymbol}</p>
                        <p>Context: {selectedPermission.permissionsContext?.slice(0, 40)}...</p>
                    </div>
                )}
            </section>

            {/* Redeem */}
            <section className="p-4 border rounded">
                <h2 className="font-bold mb-2">3. Redeem (Execute Transfer)</h2>
                <div className="flex gap-2 mb-2">
                    <input
                        type="text"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="Recipient Address"
                        className="p-2 border rounded flex-1 text-xs"
                    />
                    <input
                        type="text"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        placeholder="Amount (wei)"
                        className="p-2 border rounded w-32 text-xs"
                    />
                </div>
                <button
                    onClick={redeemPermission}
                    disabled={isLoading || !selectedPermission}
                    className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                    {isLoading ? "Processing..." : "Redeem via Backend"}
                </button>
                {txHash && (
                    <div className="mt-2 p-2 bg-green-100 rounded">
                        <p className="text-green-800 font-bold">✅ Success!</p>
                        <a
                            href={`https://sepolia.etherscan.io/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline text-xs break-all"
                        >
                            {txHash}
                        </a>
                    </div>
                )}
            </section>

            {/* Logs */}
            <section className="bg-black text-green-400 p-4 rounded h-64 overflow-auto text-xs">
                <div className="flex justify-between items-center mb-2 border-b border-green-800 pb-2">
                    <span className="font-bold">Logs</span>
                    <button onClick={clearLogs} className="text-red-400 underline text-xs">Clear</button>
                </div>
                {logs.length === 0 && <p className="opacity-50">Logs will appear here...</p>}
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </section>
        </div>
    )
}
