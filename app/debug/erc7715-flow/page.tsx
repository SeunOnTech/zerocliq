"use client"

import { useState, useCallback } from "react"
import {
    createWalletClient,
    custom,
    createPublicClient,
    http,
    parseUnits,
    type Hex,
    type Address,
    encodeFunctionData,
    parseAbi
} from "viem"
import { sepolia } from "viem/chains"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { createBundlerClient } from "viem/account-abstraction"
import {
    toMetaMaskSmartAccount,
    Implementation,
    getSmartAccountsEnvironment,
    type MetaMaskSmartAccount
} from "@metamask/smart-accounts-kit"
import { erc7715ProviderActions, erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions"

export default function Erc7715DebugPage() {
    // State
    const [logs, setLogs] = useState<string[]>([])
    const [pimlicoKey, setPimlicoKey] = useState("")
    const [sessionPrivateKey, setSessionPrivateKey] = useState<Hex | "">("")
    const [sessionAccount, setSessionAccount] = useState<MetaMaskSmartAccount | null>(null)
    const [userAddress, setUserAddress] = useState<Address | "">("")
    const [permissionsResponse, setPermissionsResponse] = useState<any>(null)
    const [txHash, setTxHash] = useState<string>("")

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])

    // --- STEP 1 & 2: SETUP CLIENTS & CONNECT USER ---
    const connectUser = useCallback(async () => {
        try {
            if (!typeof window.ethereum) throw new Error("No window.ethereum")
            const walletClient = createWalletClient({
                transport: custom(window.ethereum as any),
                chain: sepolia,
            }).extend(erc7715ProviderActions())

            const [address] = await walletClient.requestAddresses()
            setUserAddress(address)
            addLog(`✅ User Connected: ${address}`)
            return { walletClient }
        } catch (e: any) {
            addLog(`❌ Connect Error: ${e.message}`)
            return {}
        }
    }, [])

    // --- STEP 3 & 4: SETUP SESSION ACCOUNT ---
    const setupSessionAccount = useCallback(async () => {
        try {
            // Note: Setup now uses 1RPC so Pimlico Key is not strictly required here, 
            // but we still need it for Redemption later.

            if (!sessionPrivateKey) {
                const newKey = generatePrivateKey()
                setSessionPrivateKey(newKey)
                addLog(`🔑 Generated New Session Key: ${newKey}`)
            }

            // Use current or new key
            const key = sessionPrivateKey || generatePrivateKey()
            if (!sessionPrivateKey) setSessionPrivateKey(key)

            // Use 1RPC for public client (User Request) to avoid timeouts
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http("https://1rpc.io/sepolia")
            })

            const sessionEOA = privateKeyToAccount(key)

            addLog("⚙️ creating Session Smart Account...")
            const account = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [sessionEOA.address, [], [], []],
                deploySalt: "0x0000000000000000000000000000000000000000000000000000000000000001",
                signer: { account: sessionEOA },
            })

            setSessionAccount(account)
            addLog(`✅ Session Smart Account Ready: ${account.address}`)
            return account
        } catch (e: any) {
            addLog(`❌ Setup Error: ${e.message}`)
        }
    }, [sessionPrivateKey])

    // --- STEP 5: REQUEST PERMISSIONS (BROWSER) ---
    const requestPermissions = useCallback(async () => {
        try {
            if (!sessionAccount) throw new Error("Setup Session Account first")
            if (!window.ethereum) throw new Error("No Wallet")

            const walletClient = createWalletClient({
                transport: custom(window.ethereum as any),
                chain: sepolia,
            }).extend(erc7715ProviderActions())

            const currentTime = Math.floor(Date.now() / 1000)
            const expiry = currentTime + 86400 // 1 day

            // USDC Sepolia
            const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

            addLog("🚀 Requesting Execution Permissions...")

            // EXACT DOCS IMPLEMENTATION
            const grantedPermissions = await walletClient.requestExecutionPermissions([{
                chainId: sepolia.id,
                expiry,
                signer: {
                    type: "account",
                    data: {
                        address: sessionAccount.address,
                    },
                },
                permission: {
                    type: "erc20-token-periodic",
                    data: {
                        tokenAddress,
                        periodAmount: parseUnits("10", 6), // 10 USDC
                        periodDuration: 86400,
                    },
                },
                isAdjustmentAllowed: true, // Docs use this? Checked reference.
            }])

            setPermissionsResponse(grantedPermissions)
            addLog("✅ Permissions Granted!")
            console.log("Granted Permissions:", grantedPermissions)

        } catch (e: any) {
            addLog(`❌ Permission Error: ${e.message}`)
        }
    }, [sessionAccount])

    // --- STEP 6 & 7: REDEEM PERMISSIONS ---
    const redeemPermission = useCallback(async () => {
        try {
            if (!pimlicoKey) throw new Error("Please enter Pimlico API Key")
            if (!permissionsResponse) throw new Error("No permissions granted yet")
            if (!sessionAccount) throw new Error("No session account")

            addLog("🔧 Setting up Bundler Client...")
            const bundlerUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoKey}`

            // Use 1RPC for Public Client too to avoid timeouts on default RPCs
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http("https://1rpc.io/sepolia")
            })

            const bundlerClient = createBundlerClient({
                client: publicClient,
                transport: http(bundlerUrl),
                paymaster: true,
            }).extend(erc7710BundlerActions())

            // Prepare Transfer
            const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
            const recipient = "0x5153d9734b24715943036527279cbff18a4493ea" // Test Recipient
            const amount = 10000n // 0.01 USDC

            const calldata = encodeFunctionData({
                abi: parseAbi(["function transfer(address,uint256) external returns (bool)"]),
                functionName: "transfer",
                args: [recipient, amount],
            })

            // Extract Context from Response
            // Docs: const permissionsContext = grantedPermissions[0].context
            const permissionsContext = permissionsResponse[0].context as Hex
            const delegationManager = permissionsResponse[0].signerMeta.delegationManager as Address

            addLog("🚀 Sending UserOperation with Delegation...")
            const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
                publicClient,
                account: sessionAccount,
                calls: [{
                    to: tokenAddress,
                    data: calldata,
                    value: 0n,
                    permissionsContext,
                    delegationManager,
                }],
                maxFeePerGas: 10000000000n, // Fallback gas
                maxPriorityFeePerGas: 1000000000n,
            })

            addLog(`✅ UserOp Sent! Hash: ${userOpHash}`)

            addLog("⏳ Waiting for Receipt...")
            const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })

            setTxHash(receipt.receipt.transactionHash)
            addLog(`🎉 SUCCESS! TX: ${receipt.receipt.transactionHash}`)

        } catch (e: any) {
            addLog(`❌ Redeem Error: ${e.message}`)
            console.error(e)
        }
    }, [pimlicoKey, permissionsResponse, sessionAccount])


    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 font-mono text-sm">
            <h1 className="text-2xl font-bold border-b pb-4">ERC-7715 Browser Debugger</h1>

            {/* CONFIG */}
            <section className="space-y-4 border p-4 rounded bg-gray-50 dark:bg-gray-900">
                <h2 className="font-bold">0. Configuration</h2>
                <div className="flex gap-4 items-center">
                    <label>Pimlico API Key:</label>
                    <input
                        className="border p-2 rounded flex-1 bg-white text-black"
                        value={pimlicoKey}
                        onChange={e => setPimlicoKey(e.target.value)}
                        placeholder="Please paste Pimlico API Key"
                    />
                </div>
            </section>

            {/* STEP 1: CONNECT */}
            <section className="space-y-4 border p-4 rounded">
                <h2 className="font-bold">1. User Account (Delegator)</h2>
                <div className="flex gap-4 items-center">
                    <button onClick={connectUser} className="bg-blue-600 text-white px-4 py-2 rounded">
                        Connect Wallet
                    </button>
                    {userAddress && <span>Connected: {userAddress}</span>}
                </div>
            </section>

            {/* STEP 2: SESSION */}
            <section className="space-y-4 border p-4 rounded">
                <h2 className="font-bold">2. Session Account (Delegate)</h2>
                <button onClick={setupSessionAccount} className="bg-purple-600 text-white px-4 py-2 rounded">
                    Setup Session Account
                </button>
                {sessionAccount && (
                    <div className="text-xs bg-gray-100 p-2 rounded dark:text-black">
                        <p>Smart Account: {sessionAccount.address}</p>
                        <p className="mt-1 text-gray-500">Private Key: {sessionPrivateKey}</p>
                    </div>
                )}
            </section>

            {/* STEP 3: PERMISSIONS */}
            <section className="space-y-4 border p-4 rounded">
                <h2 className="font-bold">3. Request Permissions (Step 5)</h2>
                <p className="text-gray-500 text-xs">Must accept in MetaMask Flask popup</p>
                <button
                    onClick={requestPermissions}
                    disabled={!sessionAccount || !userAddress}
                    className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                    Request Permission
                </button>
                {permissionsResponse && (
                    <div className="text-xs bg-green-50 p-2 rounded border border-green-200 text-green-800 overflow-auto max-h-40">
                        JSON Captured! Ready to redeem.
                    </div>
                )}
            </section>

            {/* STEP 4: REDEEM */}
            <section className="space-y-4 border p-4 rounded">
                <h2 className="font-bold">4. Redeem Permission (Step 7)</h2>
                <button
                    onClick={redeemPermission}
                    disabled={!permissionsResponse}
                    className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                    Redeem & Execute Transfer
                </button>
                {txHash && (
                    <p className="text-green-600 font-bold">Transfer Executed! TX: {txHash}</p>
                )}
            </section>

            {/* LOGS */}
            <section className="bg-black text-green-400 p-4 rounded h-64 overflow-auto text-xs">
                {logs.length === 0 && <p className="opacity-50">Logs will appear here...</p>}
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </section>
        </div>
    )
}
