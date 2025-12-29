/**
 * Smart Account Library
 * 
 * Core SDK integration for MetaMask Smart Accounts.
 * Handles counterfactual address computation, deployment via bundler,
 * and user operation execution.
 * 
 * Architecture:
 * - Uses MetaMask Delegation Toolkit's Hybrid implementation
 * - Deployment via bundler with Pimlico Paymaster (gasless)
 * - Bundler URL fetched from backend chain config
 * - Deterministic address = f(eoaAddress, deploySalt)
 */

import {
    type Address,
    type Hex,
    type WalletClient,
    createPublicClient,
    http,
    parseEther,
} from "viem"
import {
    entryPoint07Address,
} from "viem/account-abstraction"
import {
    toMetaMaskSmartAccount,
    Implementation,
    type MetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit"
import { createSmartAccountClient } from "permissionless"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { privateKeyToAccount } from "viem/accounts"
import { getViemChain } from "@/lib/chains"

// -----------------------------------------------------------
// TYPES
// -----------------------------------------------------------
export interface ChainConfig {
    id: number
    name: string
    rpcUrl: string
    bundlerUrl: string
}

export interface SmartAccountStatus {
    address: Address
    isDeployed: boolean
    status: "deployed" | "counterfactual"
}

export interface DeploymentResult {
    success: boolean
    txHash?: Hex
    address: Address
    error?: string
}

// -----------------------------------------------------------
// FETCH CHAIN CONFIG FROM LOCAL API
// -----------------------------------------------------------

let cachedChains: ChainConfig[] | null = null

async function getBackendChains(): Promise<ChainConfig[]> {
    if (cachedChains) return cachedChains

    try {
        // Use local API route instead of external backend
        const response = await fetch('/api/chains')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        cachedChains = data.chains || data || []
        return cachedChains!
    } catch (error) {
        console.error("[SmartAccount] Failed to fetch chains:", error)
        return []
    }
}

export async function resolveChainConfig(chainId: number): Promise<ChainConfig> {
    const chains = await getBackendChains()
    const chain = chains.find((c) => c.id === chainId)
    if (!chain) throw new Error(`Unsupported chain: ${chainId}`)
    return chain
}

// -----------------------------------------------------------
// CREATE PUBLIC CLIENT
// -----------------------------------------------------------
export async function getPublicClient(chainId: number) {
    const viemChain = getViemChain(chainId)
    try {
        const chainConfig = await resolveChainConfig(chainId)
        return createPublicClient({
            chain: viemChain,
            transport: http(chainConfig.rpcUrl),
        })
    } catch {
        // Fallback to viem chain default RPC
        return createPublicClient({
            chain: viemChain,
            transport: http(),
        })
    }
}

// -----------------------------------------------------------
// GET SMART ACCOUNT ADDRESS (COUNTERFACTUAL)
// Uses factory address calculation - no signing needed
// -----------------------------------------------------------
export async function getSmartAccountAddress(
    eoaAddress: Address,
    chainId: number
): Promise<Address> {
    const publicClient = await getPublicClient(chainId)

    // Use a dummy private key - address is deterministic based on
    // deployParams and deploySalt, not the signer
    const dummyAccount = privateKeyToAccount(
        "0x0000000000000000000000000000000000000000000000000000000000000001"
    )

    const tempSmartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [eoaAddress, [], [], []],
        deploySalt: "0x",
        signer: { account: dummyAccount },
    })

    return tempSmartAccount.address
}

// -----------------------------------------------------------
// CHECK IF SMART ACCOUNT IS DEPLOYED ON-CHAIN
// -----------------------------------------------------------
export async function isSmartAccountDeployed(
    smartAccountAddress: Address,
    chainId: number
): Promise<boolean> {
    const publicClient = await getPublicClient(chainId)

    const code = await publicClient.getBytecode({
        address: smartAccountAddress,
    })

    return code !== undefined && code !== "0x" && (code?.length ?? 0) > 2
}

// -----------------------------------------------------------
// GET SMART ACCOUNT STATUS
// -----------------------------------------------------------
export async function getSmartAccountStatus(
    eoaAddress: Address,
    chainId: number
): Promise<SmartAccountStatus> {
    const smartAccountAddr = await getSmartAccountAddress(eoaAddress, chainId)
    const isDeployed = await isSmartAccountDeployed(smartAccountAddr, chainId)

    return {
        address: smartAccountAddr,
        isDeployed,
        status: isDeployed ? "deployed" : "counterfactual",
    }
}

// -----------------------------------------------------------
// CREATE SMART ACCOUNT (with WalletClient for signing)
// -----------------------------------------------------------
export async function createSmartAccount(
    eoaAddress: Address,
    chainId: number,
    walletClient: WalletClient
): Promise<MetaMaskSmartAccount> {
    if (!walletClient.account) {
        throw new Error("WalletClient must have an account attached")
    }

    const publicClient = await getPublicClient(chainId)

    const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [eoaAddress, [], [], []],
        deploySalt: "0x",
        signer: {
            walletClient: walletClient as WalletClient & { account: NonNullable<WalletClient['account']> }
        },
    })

    return smartAccount
}

// -----------------------------------------------------------
// DEPLOY SMART ACCOUNT WITH PIMLICO PAYMASTER
// Uses SmartAccountClient with paymaster for gasless deployment
// -----------------------------------------------------------
export async function deploySmartAccount(
    eoaAddress: Address,
    chainId: number,
    walletClient: WalletClient
): Promise<DeploymentResult> {
    try {
        console.log("[SmartAccount] Starting deployment for:", eoaAddress)

        // 1. Get chain config with bundler URL
        const chainConfig = await resolveChainConfig(chainId)
        const viemChain = getViemChain(chainId)
        console.log("[SmartAccount] Bundler URL:", chainConfig.bundlerUrl)

        // 2. Create smart account instance
        const smartAccount = await createSmartAccount(eoaAddress, chainId, walletClient)
        console.log("[SmartAccount] Smart account address:", smartAccount.address)

        // 3. Check if already deployed
        const alreadyDeployed = await isSmartAccountDeployed(smartAccount.address, chainId)
        if (alreadyDeployed) {
            console.log("[SmartAccount] Already deployed!")
            return {
                success: true,
                address: smartAccount.address,
            }
        }

        // 4. Setup Pimlico Paymaster using bundler URL from backend
        console.log("[SmartAccount] Setting up Pimlico Paymaster...")
        const pimlicoClient = createPimlicoClient({
            transport: http(chainConfig.bundlerUrl),
            entryPoint: {
                address: entryPoint07Address,
                version: "0.7",
            },
        })

        // 5. Create Smart Account Client with Paymaster
        const smartAccountClient = createSmartAccountClient({
            account: smartAccount as any,
            chain: viemChain,
            bundlerTransport: http(chainConfig.bundlerUrl),
            paymaster: pimlicoClient,
            userOperation: {
                estimateFeesPerGas: async () => {
                    return (await pimlicoClient.getUserOperationGasPrice()).fast
                },
            },
        })

        console.log("[SmartAccount] SmartAccountClient ready with Pimlico paymaster")

        // 6. Deploy by sending a 0-value transaction to self
        console.log("[SmartAccount] Sending sponsored deployment transaction...")
        const hash = await smartAccountClient.sendTransaction({
            to: eoaAddress,
            value: 0n,
            data: "0x",
        })

        console.log("[SmartAccount] Deployment TX Hash:", hash)

        // 7. Wait for confirmation
        const publicClient = await getPublicClient(chainId)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        console.log("[SmartAccount] Deployment successful!")
        console.log("[SmartAccount] TX Receipt:", receipt)

        return {
            success: true,
            txHash: hash,
            address: smartAccount.address,
        }
    } catch (error: any) {
        console.error("[SmartAccount] Deployment error:", error)

        // Extract cleaner error message
        let errorMessage = error.message || "Deployment failed"

        // Common error handling
        if (errorMessage.includes("AA21 didn't pay prefund")) {
            errorMessage = "Paymaster sponsorship rejected. Please try again later."
        } else if (errorMessage.includes("paymaster")) {
            errorMessage = "Paymaster service unavailable. Please try again."
        } else if (errorMessage.includes("rejected")) {
            errorMessage = "Transaction rejected by user."
        }

        return {
            success: false,
            address: "0x" as Address,
            error: errorMessage,
        }
    }
}
