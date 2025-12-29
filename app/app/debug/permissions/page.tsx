"use client"

import { useState } from "react"
import { createWalletClient, custom, parseUnits, parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions"

type ChainKey = 'sepolia' | 'base'

const CHAINS = {
    sepolia: {
        id: 11155111,
        name: "Sepolia",
        // USDC on Sepolia (from docs)
        usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    },
    base: {
        id: 8453,
        name: "Base Mainnet",
        // USDC on Base Mainnet
        usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    }
}

export default function PermissionScript() {
    const [selectedChain, setSelectedChain] = useState<ChainKey>('sepolia')
    const [logs, setLogs] = useState<string[]>([])

    const log = (msg: any) => {
        console.log(msg)
        const replacer = (_key: string, value: any) =>
            typeof value === 'bigint' ? value.toString() : value

        setLogs(prev => [...prev, typeof msg === 'object' ? JSON.stringify(msg, replacer, 2) : String(msg)])
    }

    const clearLogs = () => setLogs([])

    const runScript = async (permissionType: 'native-token-periodic' | 'erc20-token-periodic') => {
        clearLogs()
        const chainConfig = CHAINS[selectedChain]
        log(`🚀 Starting ${permissionType} Script on ${chainConfig.name}...`)

        try {
            // =========================================================================
            // 1. Setup Wallet Client
            // =========================================================================
            if (!window.ethereum) throw new Error("No window.ethereum found")

            const walletClient = createWalletClient({
                transport: custom(window.ethereum as any),
            }).extend(erc7715ProviderActions())

            const [account] = await walletClient.requestAddresses()
            log(`Wallet: ${account}`)

            // =========================================================================
            // 2. Setup Session Account (EOA per docs)
            // =========================================================================
            // "Set up a session account which can either be a smart account or an externally owned account (EOA)"
            const sessionKey = generatePrivateKey()
            const sessionAccount = privateKeyToAccount(sessionKey)

            log(`🆕 Session Key Generated: ${sessionAccount.address}`)
            // log(`(Private Key: ${sessionKey})`) // Optional: hide security sensitive info

            // =========================================================================
            // 3. Define Parameters
            // =========================================================================
            const currentTime = Math.floor(Date.now() / 1000)
            const expiry = currentTime + 604800 // 1 week

            let permission: any

            if (permissionType === 'erc20-token-periodic') {
                permission = {
                    type: "erc20-token-periodic",
                    data: {
                        tokenAddress: chainConfig.usdc as `0x${string}`,
                        periodAmount: parseUnits("0.1", 6), // 0.1 USDC (6 decimals)
                        periodDuration: 86400, // 1 day
                        justification: `Debug: Transfer 0.1 USDC daily on ${chainConfig.name}`,
                    },
                }
            } else {
                permission = {
                    type: "native-token-periodic",
                    data: {
                        periodAmount: parseEther("0.0001"), // 0.0001 ETH
                        periodDuration: 86400, // 1 day
                        justification: `Debug: Transfer 0.0001 ETH daily on ${chainConfig.name}`,
                    },
                }
            }

            log("Requesting Permission:")
            log(permission)

            // =========================================================================
            // 4. Request Permissions
            // =========================================================================
            const grantedPermissions = await walletClient.requestExecutionPermissions([{
                chainId: chainConfig.id,
                expiry,
                signer: {
                    type: "account",
                    data: {
                        address: sessionAccount.address,
                    },
                },
                permission,
                isAdjustmentAllowed: true,
            }])

            log("✅ Success! Permissions Granted:")
            log(grantedPermissions)

        } catch (error: any) {
            log("❌ Error:")
            log(error.message || error)
            console.error(error)
        }
    }

    return (
        <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="text-2xl font-bold mb-4">ERC-7715 Debug: Multi-Chain</h1>

            <div className="mb-6 bg-gray-100 p-4 rounded border">
                <label className="block mb-2 font-bold">1. Select Chain:</label>
                <select
                    value={selectedChain}
                    onChange={(e) => setSelectedChain(e.target.value as ChainKey)}
                    className="p-2 border rounded w-full mb-2"
                >
                    <option value="sepolia">Sepolia (Testnet)</option>
                    <option value="base">Base (Mainnet)</option>
                </select>
                <p className="text-sm text-gray-600">
                    Selected: {CHAINS[selectedChain].name} (ID: {CHAINS[selectedChain].id})
                </p>
                <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Ensure your MetaMask is set to this same network before running!
                </p>
            </div>

            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => runScript('native-token-periodic')}
                    className="px-6 py-3 bg-black text-white rounded hover:bg-gray-800"
                >
                    ▶ Test Native Token (ETH/MON)
                </button>
                <button
                    onClick={() => runScript('erc20-token-periodic')}
                    className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    ▶ Test ERC-20 (USDC)
                </button>
            </div>

            <div className="bg-gray-50 p-4 rounded border min-h-[300px] whitespace-pre-wrap overflow-auto">
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
