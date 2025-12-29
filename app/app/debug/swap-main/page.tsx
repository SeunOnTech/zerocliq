"use client"

import { useState } from "react"
import { formatUnits, parseUnits, createWalletClient, custom } from "viem"
import { sepolia } from "viem/chains"

// Available tokens (matching chains.ts Sepolia config)
const TOKENS = {
    ETH: {
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        symbol: "ETH",
    },
    USDC: {
        address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        decimals: 6,
        symbol: "USDC",
    },
    LINK: {
        address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
        decimals: 18,
        symbol: "LINK",
    },
    DAI: {
        address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
        decimals: 18,
        symbol: "DAI",
    },
}

type TokenKey = keyof typeof TOKENS

export default function MainSwapDebugPage() {
    const [sellToken, setSellToken] = useState<TokenKey>("ETH")
    const [buyToken, setBuyToken] = useState<TokenKey>("USDC")
    const [amount, setAmount] = useState("0.001")
    const [logs, setLogs] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [quoteResult, setQuoteResult] = useState<any>(null)
    const [swapCalldata, setSwapCalldata] = useState<any>(null)

    const log = (msg: any) => {
        console.log(msg)
        const replacer = (_key: string, value: any) =>
            typeof value === 'bigint' ? value.toString() : value
        setLogs(prev => [...prev, typeof msg === 'object' ? JSON.stringify(msg, replacer, 2) : String(msg)])
    }

    const clearLogs = () => {
        setLogs([])
        setQuoteResult(null)
        setSwapCalldata(null)
    }

    // Test quote using API route (uses Sepolia uniswapV3.plugin.ts)
    const testQuote = async () => {
        clearLogs()
        setIsLoading(true)
        log("📊 Testing Quote via Main Swap API...")

        try {
            const sell = TOKENS[sellToken]
            const buy = TOKENS[buyToken]
            const amountIn = parseUnits(amount, sell.decimals)

            log(`Sell: ${amount} ${sell.symbol} (${sell.address})`)
            log(`Buy: ${buy.symbol} (${buy.address})`)
            log(`Amount In (wei): ${amountIn.toString()}`)

            const response = await fetch('/api/swap/quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chainId: 11155111, // Sepolia
                    tokenIn: sell.address, // Pass address string, not object
                    tokenOut: buy.address, // Pass address string, not object
                    amountIn: amountIn.toString(),
                }),
            })

            const data = await response.json()
            log("API Response:")
            log(data)

            if (data.success && data.bestRoute) {
                setQuoteResult(data) // Store entire response (which has bestRoute)
                const bestRoute = data.bestRoute
                const amountOut = formatUnits(BigInt(bestRoute.amountOut), buy.decimals)
                log(`✅ Best Route: ${bestRoute.dexName}`)
                log(`✅ Amount Out: ${amountOut} ${buy.symbol}`)
                if (data.alternatives?.length > 0) {
                    log(`📊 Alternatives: ${data.alternatives.length}`)
                }
            } else {
                log(`❌ Quote failed: ${data.error || 'Unknown error'}`)
            }

        } catch (error: any) {
            log("❌ Error:")
            log(error.message || error)
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    // Build swap calldata using API route
    const buildSwapCalldata = async (userAddress: string) => {
        if (!quoteResult?.bestRoute) {
            log("❌ Get a quote first!")
            return null
        }

        log("🔧 Building swap calldata via API...")

        try {
            const response = await fetch('/api/swap/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chainId: 11155111,
                    quote: quoteResult,
                    recipient: userAddress,
                    slippageBps: 50, // 0.5%
                }),
            })

            const data = await response.json()
            log("Build Response:")
            log(data)

            if (data.success && data.calldata) {
                setSwapCalldata(data.calldata)
                log(`✅ Router: ${data.calldata.to}`)
                log(`✅ Value: ${data.calldata.value}`)
                return data.calldata
            } else {
                log(`❌ Build failed: ${data.error || 'Unknown error'}`)
                return null
            }

        } catch (error: any) {
            log("❌ Error:")
            log(error.message || error)
            console.error(error)
            return null
        }
    }

    // Execute swap with wallet signing
    const executeSwap = async () => {
        if (!quoteResult?.bestRoute) {
            log("❌ Get a quote first!")
            return
        }

        setIsLoading(true)
        log("🔄 Starting Swap Execution...")

        try {
            if (!window.ethereum) throw new Error("No wallet found")

            // Switch to Sepolia
            log("🔗 Switching to Sepolia...")
            try {
                await (window.ethereum as any).request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0xaa36a7" }], // 11155111 in hex
                })
            } catch (switchError: any) {
                if (switchError.code === 4902) {
                    log("Adding Sepolia network...")
                    await (window.ethereum as any).request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: "0xaa36a7",
                            chainName: "Sepolia Testnet",
                            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                            blockExplorerUrls: ["https://sepolia.etherscan.io"],
                        }],
                    })
                } else {
                    throw switchError
                }
            }

            // Create wallet client
            const walletClient = createWalletClient({
                chain: sepolia,
                transport: custom(window.ethereum as any),
            })

            // Get account
            const [account] = await walletClient.requestAddresses()
            log(`📍 Wallet: ${account}`)

            // Build calldata with user's address
            const calldata = await buildSwapCalldata(account)
            if (!calldata) throw new Error("Failed to build swap calldata")

            // Parse value
            const sell = TOKENS[sellToken]
            const amountIn = parseUnits(amount, sell.decimals)
            const value = sell.address === "0x0000000000000000000000000000000000000000" ? amountIn : 0n

            log(`💰 Sending Transaction...`)
            log(`  - To: ${calldata.to}`)
            log(`  - Value: ${value.toString()} wei`)

            // Send transaction
            const txHash = await walletClient.sendTransaction({
                account,
                to: calldata.to as `0x${string}`,
                data: calldata.data as `0x${string}`,
                value: value,
            })

            log(`✅ Transaction Sent!`)
            log(`🔗 TX Hash: ${txHash}`)
            log(`🔍 View: https://sepolia.etherscan.io/tx/${txHash}`)

        } catch (error: any) {
            log("❌ Swap Error:")
            log(error.message || error)
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: '900px', margin: '0 auto' }}>
            <h1 className="text-2xl font-bold mb-4">Main Swap Debug (Sepolia)</h1>
            <p className="text-sm text-gray-600 mb-6">
                Test the main swap API (uses uniswapV3.plugin.ts and common.ts with the fixed WETH address)
            </p>

            <div className="mb-6 bg-gray-100 p-4 rounded border">
                <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-bold">Sell Token:</label>
                        <select
                            value={sellToken}
                            onChange={(e) => {
                                setSellToken(e.target.value as TokenKey)
                                setQuoteResult(null)
                                setSwapCalldata(null)
                            }}
                            className="p-2 border rounded w-full bg-white"
                        >
                            {Object.keys(TOKENS).map((key) => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-bold">Amount:</label>
                        <input
                            type="text"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="p-2 border rounded w-full"
                            placeholder="0.001"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-bold">Buy Token:</label>
                        <select
                            value={buyToken}
                            onChange={(e) => {
                                setBuyToken(e.target.value as TokenKey)
                                setQuoteResult(null)
                                setSwapCalldata(null)
                            }}
                            className="p-2 border rounded w-full bg-white"
                        >
                            {Object.keys(TOKENS).map((key) => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {quoteResult?.bestRoute && (
                    <div className="bg-green-100 p-3 rounded border border-green-300 mt-4">
                        <p className="font-bold text-green-800">
                            Quote: {amount} {sellToken} → {formatUnits(BigInt(quoteResult.bestRoute.amountOut), TOKENS[buyToken].decimals)} {buyToken}
                        </p>
                        <p className="text-sm text-green-600">via {quoteResult.bestRoute.dexName}</p>
                    </div>
                )}
            </div>

            <div className="flex gap-4 mb-6 flex-wrap">
                <button
                    onClick={testQuote}
                    disabled={isLoading}
                    className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? "Loading..." : "📊 Get Quote"}
                </button>
                <button
                    onClick={executeSwap}
                    disabled={isLoading || !quoteResult?.bestRoute}
                    className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                    {isLoading ? "Loading..." : "🔄 Execute Swap (Sign TX)"}
                </button>
            </div>

            <div className="bg-gray-50 p-4 rounded border min-h-[300px] whitespace-pre-wrap overflow-auto text-sm">
                <div className="flex justify-between items-center mb-2 border-b pb-2">
                    <span className="font-bold">Logs</span>
                    <button onClick={clearLogs} className="text-xs text-red-500 underline">Clear</button>
                </div>
                {logs.length === 0 && <span className="text-gray-400">Waiting for action...</span>}
                {logs.map((L, i) => <div key={i} className="mb-1">{L}</div>)}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="font-bold text-yellow-800 mb-2">⚠️ This uses the server-side swap service:</p>
                <ul className="list-disc ml-4 text-yellow-700">
                    <li><code>lib/server/dexes/sepolia/uniswapV3.plugin.ts</code></li>
                    <li><code>lib/server/dexes/sepolia/common.ts</code> (WETH normalization)</li>
                    <li><code>lib/server/services/swap.service.ts</code></li>
                </ul>
            </div>
        </div>
    )
}

