"use client"

import { useState } from "react"
import { createWalletClient, createPublicClient, custom, http, parseEther, formatUnits, encodeFunctionData } from "viem"
import { sepolia } from "viem/chains"

// Sepolia Contract Addresses
const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
const UNISWAP_QUOTER_V2 = "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3"
const UNISWAP_SWAP_ROUTER_02 = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"

// Available output tokens
const TOKENS = {
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

// Quoter V2 ABI (quoteExactInputSingle)
const QUOTER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "fee", type: "uint24" },
                    { name: "sqrtPriceLimitX96", type: "uint160" },
                ],
                name: "params",
                type: "tuple",
            },
        ],
        name: "quoteExactInputSingle",
        outputs: [
            { name: "amountOut", type: "uint256" },
            { name: "sqrtPriceX96After", type: "uint160" },
            { name: "initializedTicksCrossed", type: "uint32" },
            { name: "gasEstimate", type: "uint256" },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const

// SwapRouter02 ABI (exactInputSingle)
const SWAP_ROUTER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "fee", type: "uint24" },
                    { name: "recipient", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "amountOutMinimum", type: "uint256" },
                    { name: "sqrtPriceLimitX96", type: "uint160" },
                ],
                name: "params",
                type: "tuple",
            },
        ],
        name: "exactInputSingle",
        outputs: [{ name: "amountOut", type: "uint256" }],
        stateMutability: "payable",
        type: "function",
    },
] as const

export default function SwapDebugPage() {
    const [ethAmount, setEthAmount] = useState("0.001")
    const [selectedToken, setSelectedToken] = useState<TokenKey>("USDC")
    const [quoteResult, setQuoteResult] = useState<string | null>(null)
    const [logs, setLogs] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const log = (msg: any) => {
        console.log(msg)
        const replacer = (_key: string, value: any) =>
            typeof value === 'bigint' ? value.toString() : value
        setLogs(prev => [...prev, typeof msg === 'object' ? JSON.stringify(msg, replacer, 2) : String(msg)])
    }

    const clearLogs = () => {
        setLogs([])
        setQuoteResult(null)
    }

    const getQuote = async () => {
        clearLogs()
        setIsLoading(true)
        log("📊 Fetching Quote from Uniswap V3 Quoter...")

        try {
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http("https://ethereum-sepolia-rpc.publicnode.com", {
                    timeout: 30_000,
                }),
            })

            const amountIn = parseEther(ethAmount)
            log(`Amount In: ${ethAmount} ETH (${amountIn.toString()} wei)`)

            // Call quoteExactInputSingle
            const token = TOKENS[selectedToken]
            const result = await publicClient.simulateContract({
                address: UNISWAP_QUOTER_V2,
                abi: QUOTER_ABI,
                functionName: "quoteExactInputSingle",
                args: [{
                    tokenIn: WETH_SEPOLIA,
                    tokenOut: token.address as `0x${string}`,
                    amountIn,
                    fee: 3000, // 0.3%
                    sqrtPriceLimitX96: BigInt(0),
                }],
            })

            const amountOut = result.result[0]
            const formattedOut = formatUnits(amountOut, token.decimals)

            log(`✅ Quote: ${ethAmount} ETH ➡️ ${formattedOut} ${token.symbol}`)
            setQuoteResult(formattedOut)

        } catch (error: any) {
            log("❌ Quote Error:")
            log(error.message || error)
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const executeSwap = async () => {
        setIsLoading(true)
        log("🔄 Starting Swap...")

        try {
            if (!window.ethereum) throw new Error("No window.ethereum found")

            // Switch to Sepolia first
            log("🔗 Switching to Sepolia...")
            try {
                await (window.ethereum as any).request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0xaa36a7" }], // 11155111 in hex
                })
                log("✅ Switched to Sepolia")

                // Re-request accounts after chain switch to ensure authorization
                await (window.ethereum as any).request({
                    method: "eth_requestAccounts",
                })
            } catch (switchError: any) {
                // If chain not added, add it
                if (switchError.code === 4902) {
                    await (window.ethereum as any).request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: "0xaa36a7",
                            chainName: "Sepolia",
                            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                            rpcUrls: ["https://rpc.sepolia.org"],
                            blockExplorerUrls: ["https://sepolia.etherscan.io"],
                        }],
                    })
                } else {
                    throw switchError
                }
            }

            const walletClient = createWalletClient({
                chain: sepolia,
                transport: custom(window.ethereum as any),
            })

            const [account] = await walletClient.requestAddresses()
            log(`Wallet: ${account}`)

            const amountIn = parseEther(ethAmount)
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800) // 30 minutes

            // Calculate minimum output (use 95% of quote as slippage protection)
            const token = TOKENS[selectedToken]
            const minOut = quoteResult
                ? BigInt(Math.floor(parseFloat(quoteResult) * 0.95 * Math.pow(10, token.decimals)))
                : BigInt(0)

            log(`Swap Params:`)
            log(`  - Amount In: ${ethAmount} ETH`)
            log(`  - Min Out: ${formatUnits(minOut, token.decimals)} ${token.symbol}`)

            // Encode the swap call
            const swapData = encodeFunctionData({
                abi: SWAP_ROUTER_ABI,
                functionName: "exactInputSingle",
                args: [{
                    tokenIn: WETH_SEPOLIA,
                    tokenOut: token.address as `0x${string}`,
                    fee: 3000,
                    recipient: account,
                    amountIn,
                    amountOutMinimum: minOut,
                    sqrtPriceLimitX96: BigInt(0),
                }],
            })

            log("Sending Transaction...")

            const txHash = await walletClient.sendTransaction({
                account,
                to: UNISWAP_SWAP_ROUTER_02,
                data: swapData,
                value: amountIn, // Send ETH with the transaction (will be wrapped)
            })

            log(`✅ Transaction Sent!`)
            log(`TX Hash: ${txHash}`)
            log(`View on Etherscan: https://sepolia.etherscan.io/tx/${txHash}`)

        } catch (error: any) {
            log("❌ Swap Error:")
            log(error.message || error)
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="text-2xl font-bold mb-4">Manual Swap Debug (Sepolia)</h1>
            <p className="text-sm text-gray-600 mb-6">
                Test swapping ETH → {selectedToken} on Sepolia via Uniswap V3 with manual wallet signing.
            </p>

            <div className="mb-6 bg-gray-100 p-4 rounded border">
                <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-bold">ETH Amount:</label>
                        <input
                            type="text"
                            value={ethAmount}
                            onChange={(e) => setEthAmount(e.target.value)}
                            className="p-2 border rounded w-full"
                            placeholder="0.001"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-bold">Output Token:</label>
                        <select
                            value={selectedToken}
                            onChange={(e) => {
                                setSelectedToken(e.target.value as TokenKey)
                                setQuoteResult(null)
                            }}
                            className="p-2 border rounded w-full bg-white"
                        >
                            {Object.keys(TOKENS).map((key) => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {quoteResult && (
                    <p className="text-green-600 font-bold mt-2">
                        Quoted Output: {quoteResult} {selectedToken}
                    </p>
                )}
            </div>

            <div className="flex gap-4 mb-6">
                <button
                    onClick={getQuote}
                    disabled={isLoading}
                    className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? "Loading..." : "📊 Get Quote"}
                </button>
                <button
                    onClick={executeSwap}
                    disabled={isLoading || !quoteResult}
                    className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                    {isLoading ? "Loading..." : "🔄 Execute Swap"}
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
