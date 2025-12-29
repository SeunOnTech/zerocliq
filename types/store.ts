import { type StateCreator } from 'zustand'
import type { UserProfile, UserSyncState } from './user'

export interface AuthSlice {
    // Connection state (from Wagmi)
    isConnected: boolean
    address: string | undefined
    chainId: number | undefined

    // Database sync state
    userProfile: UserProfile | null
    syncState: UserSyncState
    lastSyncedKey: string | null // "address:chainId" to prevent duplicate syncs

    // Actions
    setAuth: (address: string | undefined, chainId: number | undefined, isConnected: boolean) => void
    syncUserToDb: (options?: { forceRefresh?: boolean }) => Promise<void>
    setUserProfile: (profile: UserProfile | null) => void
    setSyncState: (state: UserSyncState) => void
    disconnect: () => void
    clearSyncKey: () => void  // Clear lastSyncedKey to force fresh sync (on account change)
}

export type ChainKey =
    | "ethereum"
    | "linea"
    | "base"
    | "bsc"
    | "arbitrum"
    | "optimism"
    | "sepolia"
    | "monad";

export type ChainConfig = {
    key: ChainKey;
    id: number;
    name: string;
    rpcUrl: string;
    bundlerUrl: string;
    paymasterUrl: string;
    explorerUrl: string;
    logoUrl?: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    tokens: any[]; // We can refine this later
    features: {
        supportsPerps: boolean;
        supportsLending: boolean;
        supportsYield: boolean;
    };
};

export interface ChainSlice {
    availableChains: ChainConfig[];
    selectedChainId: number | null;
    isChainSupported: (chainId: number) => boolean;
    setAvailableChains: (chains: ChainConfig[]) => void;
    setSelectedChain: (chainId: number | null) => void;
}

export interface UISlice {
    isChainSelectorOpen: boolean;
    openChainSelector: () => void;
    closeChainSelector: () => void;
}

// Re-export SmartAccountSlice from its file
export type { SmartAccountSlice } from '@/store/slices/createSmartAccountSlice'
import type { SmartAccountSlice } from '@/store/slices/createSmartAccountSlice'

// Re-export BalanceSlice types
export type { TokenBalance, WalletBalanceData, ChainBalances } from '@/store/slices/createBalanceSlice'
import type { TokenBalance, WalletBalanceData, ChainBalances } from '@/store/slices/createBalanceSlice'

export interface BalanceSlice {
    // Balance storage: chainId -> { eoa, smartAccount }
    tokenBalances: Record<number, ChainBalances>

    // Fetching state
    isBalanceFetching: boolean
    lastBalanceFetch: number | null
    balanceRefreshTrigger: number

    // Actions
    triggerBalanceRefresh: () => void

    // Actions
    setBalances: (chainId: number, walletType: 'eoa' | 'smartAccount', data: WalletBalanceData) => void
    getBalances: (chainId: number, walletType: 'eoa' | 'smartAccount') => TokenBalance[]
    getTokenBalance: (chainId: number, tokenAddress: string, walletType?: 'eoa' | 'smartAccount') => TokenBalance | undefined
    getTotalUsdValue: (chainId: number, walletType?: 'eoa' | 'smartAccount') => number
    isBalanceStale: (chainId: number, walletType?: 'eoa' | 'smartAccount') => boolean
    invalidateTokens: (chainId: number, tokenAddresses: string[]) => void
    clearBalances: () => void
    setBalanceFetching: (isFetching: boolean) => void
}

// Re-export SwapSlice types
export type { SwapToken, SwapSlice } from '@/store/slices/createSwapSlice'
import type { SwapSlice } from '@/store/slices/createSwapSlice'

// Re-export PriceSlice types
export type { PriceSlice } from '@/store/slices/createPriceSlice'
import type { PriceSlice } from '@/store/slices/createPriceSlice'

export interface AppStore extends AuthSlice, ChainSlice, UISlice, SmartAccountSlice, BalanceSlice, SwapSlice, PriceSlice { }

export type StoreSlice<T> = StateCreator<AppStore, [], [], T>


