"use client"

import { useState, useEffect } from "react"
import { useAccount, useWalletClient, usePublicClient } from "wagmi"
import { parseUnits, formatUnits, encodeFunctionData, parseAbi } from "viem"
import { useAppStore } from "@/store/useAppStore"

const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
const USDC_DECIMALS = 6

export default function FundTransferDebugPage() {
    const { address: eoaAddress, isConnected } = useAccount()
    const { data: walletClient } = useWalletClient()
    const publicClient = usePublicClient()
    const { userProfile } = useAppStore()
    const smartAccountAddress = userProfile?.smartAccountAddress

    const [eoaBalance, setEoaBalance] = useState<string>("0")
    const [saBalance, setSaBalance] = useState<string>("0")
    const [amount, setAmount] = useState<string>("1")
    const [isLoading, setIsLoading] = useState(false)
    const [txHash, setTxHash] = useState<string>("")
    const [error, setError] = useState<string>("")
    const [status, setStatus] = useState<string>("")

    // Fetch balances
    const fetchBalances = async () => {
        if (!publicClient || !eoaAddress) return

        try {
            // EOA Balance
            const eoaBal = await publicClient.readContract({
                address: USDC_ADDRESS,
                abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
                functionName: "balanceOf",
                args: [eoaAddress],
            })
            setEoaBalance(formatUnits(eoaBal, USDC_DECIMALS))

            // Smart Account Balance (if exists)
            if (smartAccountAddress) {
                const saBal = await publicClient.readContract({
                    address: USDC_ADDRESS,
                    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
                    functionName: "balanceOf",
                    args: [smartAccountAddress as `0x${string}`],
                })
                setSaBalance(formatUnits(saBal, USDC_DECIMALS))
            }
        } catch (e) {
            console.error("Error fetching balances:", e)
        }
    }

    useEffect(() => {
        fetchBalances()
        const interval = setInterval(fetchBalances, 10000)
        return () => clearInterval(interval)
    }, [eoaAddress, smartAccountAddress, publicClient])

    // Transfer from EOA to Smart Account
    const transferToSmartAccount = async () => {
        if (!walletClient || !eoaAddress || !smartAccountAddress) {
            setError("Wallet not connected or no Smart Account")
            return
        }

        setIsLoading(true)
        setError("")
        setTxHash("")
        setStatus("Sending transaction...")

        try {
            const amountWei = parseUnits(amount, USDC_DECIMALS)

            const hash = await walletClient.writeContract({
                address: USDC_ADDRESS,
                abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
                functionName: "transfer",
                args: [smartAccountAddress as `0x${string}`, amountWei],
            })

            setTxHash(hash)
            setStatus("Waiting for confirmation...")

            await publicClient?.waitForTransactionReceipt({ hash })
            setStatus("Transfer complete!")
            await fetchBalances()
        } catch (e: any) {
            console.error("Transfer error:", e)
            setError(e.message || "Transfer failed")
        } finally {
            setIsLoading(false)
        }
    }

    // Transfer from Smart Account to EOA
    // Note: After EIP-7702 upgrade, EOA and Smart Account may be the same address
    // If they're different, this requires the smart account to have authorized this wallet
    const transferToEOA = async () => {
        if (!walletClient || !eoaAddress || !smartAccountAddress) {
            setError("Wallet not connected or no Smart Account")
            return
        }

        // Check if EOA and Smart Account are the same (EIP-7702 upgraded)
        if (eoaAddress.toLowerCase() === smartAccountAddress.toLowerCase()) {
            setError("EOA and Smart Account are the same address (EIP-7702 upgraded). No transfer needed.")
            return
        }

        setIsLoading(true)
        setError("")
        setTxHash("")
        setStatus("Note: This requires the Smart Account to have authorized your wallet...")

        try {
            const amountWei = parseUnits(amount, USDC_DECIMALS)

            // For separate smart accounts, we would need a delegation/permission
            // This is a basic implementation that won't work without proper authorization
            // Just showing the UI for now
            setError("Transfer from a separate Smart Account requires ERC-7715 delegation. If your EOA was upgraded via EIP-7702, both addresses should be the same.")
        } catch (e: any) {
            console.error("Transfer error:", e)
            setError(e.message || "Transfer failed")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Fund Transfer Debug</h1>

                {!isConnected ? (
                    <div className="bg-yellow-900/50 border border-yellow-500 rounded-lg p-4">
                        <p>Please connect your wallet first</p>
                    </div>
                ) : (
                    <>
                        {/* Addresses */}
                        <div className="bg-gray-800 rounded-lg p-6 mb-6">
                            <h2 className="text-xl font-semibold mb-4">Addresses</h2>
                            <div className="space-y-2">
                                <div>
                                    <span className="text-gray-400">EOA: </span>
                                    <code className="text-green-400">{eoaAddress}</code>
                                </div>
                                <div>
                                    <span className="text-gray-400">Smart Account: </span>
                                    <code className="text-blue-400">{smartAccountAddress || "Not detected"}</code>
                                </div>
                            </div>
                        </div>

                        {/* Balances */}
                        <div className="bg-gray-800 rounded-lg p-6 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">USDC Balances</h2>
                                <button
                                    onClick={fetchBalances}
                                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                                >
                                    Refresh
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
                                    <p className="text-gray-400 text-sm">EOA Balance</p>
                                    <p className="text-2xl font-bold text-green-400">{parseFloat(eoaBalance).toFixed(4)} USDC</p>
                                </div>
                                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 text-center">
                                    <p className="text-gray-400 text-sm">Smart Account Balance</p>
                                    <p className="text-2xl font-bold text-blue-400">{parseFloat(saBalance).toFixed(4)} USDC</p>
                                </div>
                            </div>
                        </div>

                        {/* Transfer Controls */}
                        <div className="bg-gray-800 rounded-lg p-6 mb-6">
                            <h2 className="text-xl font-semibold mb-4">Transfer</h2>

                            <div className="mb-4">
                                <label className="block text-gray-400 text-sm mb-2">Amount (USDC)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                                    placeholder="1.0"
                                    step="0.1"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={transferToSmartAccount}
                                    disabled={isLoading || !smartAccountAddress}
                                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                                >
                                    <span>→</span>
                                    <span>EOA to Smart Account</span>
                                </button>
                                <button
                                    onClick={transferToEOA}
                                    disabled={isLoading || !smartAccountAddress}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                                >
                                    <span>←</span>
                                    <span>Smart Account to EOA</span>
                                </button>
                            </div>
                        </div>

                        {/* Status */}
                        {(status || txHash || error) && (
                            <div className="bg-gray-800 rounded-lg p-6">
                                <h2 className="text-xl font-semibold mb-4">Status</h2>

                                {isLoading && (
                                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                                        <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                                        <span>{status}</span>
                                    </div>
                                )}

                                {txHash && (
                                    <div className="mb-2">
                                        <span className="text-gray-400">TX Hash: </span>
                                        <a
                                            href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline break-all"
                                        >
                                            {txHash}
                                        </a>
                                    </div>
                                )}

                                {error && (
                                    <div className="bg-red-900/50 border border-red-500 rounded p-3 text-red-300">
                                        {error}
                                    </div>
                                )}

                                {status === "Transfer complete!" && !error && (
                                    <div className="bg-green-900/50 border border-green-500 rounded p-3 text-green-300">
                                        ✓ Transfer successful!
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Info */}
                        <div className="mt-6 text-sm text-gray-500">
                            <p>• With EIP-7702, your EOA is upgraded in-place to act as a smart account</p>
                            <p>• The EOA address and Smart Account address may be the same after upgrade</p>
                            <p>• This page is for debugging fund movements on Sepolia testnet</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
