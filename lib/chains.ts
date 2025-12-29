import { defineChain } from 'viem'

export const monadTestnet = defineChain({
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Monad',
        symbol: 'MON',
    },
    rpcUrls: {
        default: { http: ['https://testnet-rpc.monad.xyz'] },
        public: { http: ['https://testnet-rpc.monad.xyz'] },
    },
    blockExplorers: {
        default: { name: 'MonadExplorer', url: 'https://testnet.monadexplorer.com' },
    },
})

export const monadDevnet = defineChain({
    id: 20143,
    name: 'Monad Devnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Monad',
        symbol: 'DMON',
    },
    rpcUrls: {
        default: { http: ['https://rpc-devnet.monad.xyz'] },
        public: { http: ['https://rpc-devnet.monad.xyz'] },
    },
    blockExplorers: {
        default: { name: 'MonadExplorer', url: 'https://explorer.monad-devnet.devnet.101.xyz' },
    },
})

export const monadMainnet = defineChain({
    id: 143,
    name: 'Monad Mainnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Monad',
        symbol: 'MON',
    },
    rpcUrls: {
        default: { http: ['https://rpc.monad.xyz'] },
        public: { http: ['https://rpc.monad.xyz'] },
    },
    blockExplorers: {
        default: { name: 'MonadVision', url: 'https://monadvision.com' },
    },
})

// Import standard viem chains
import { mainnet, sepolia, base, baseSepolia } from 'viem/chains'
import type { Chain } from 'viem'

// Chain ID to viem Chain mapping
const CHAIN_MAP: Record<number, Chain> = {
    1: mainnet,
    11155111: sepolia,
    8453: base,
    84532: baseSepolia,
    143: monadMainnet,
    10143: monadTestnet,
    20143: monadDevnet,
}

/**
 * Get viem Chain object by chain ID
 * Falls back to sepolia if chain not found
 */
export function getViemChain(chainId: number): Chain {
    const chain = CHAIN_MAP[chainId]
    if (!chain) {
        console.warn(`[getViemChain] Unknown chain ID: ${chainId}, falling back to sepolia`)
        return sepolia
    }
    return chain
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
    const chain = CHAIN_MAP[chainId]
    const explorerUrl = chain?.blockExplorers?.default?.url || 'https://etherscan.io'
    return `${explorerUrl}/tx/${txHash}`
}

