import { useAppStore } from '@/store/useAppStore'
import { useAccount } from 'wagmi'
import type { TokenBalance } from '@/store/slices/createBalanceSlice'

/**
 * useTokenBalance - Get balance for a specific token
 * 
 * Reads directly from Zustand for instant access.
 * 
 * @param tokenAddress - The token address to get balance for
 * @param walletType - 'eoa' or 'smartAccount' (defaults to 'eoa')
 * @returns Token balance data or undefined if not found
 * 
 * @example
 * const { balance, usdValue } = useTokenBalance('0x123...') ?? { balance: 0, usdValue: 0 }
 */
export function useTokenBalance(
    tokenAddress: string | undefined,
    walletType: 'eoa' | 'smartAccount' = 'eoa'
): TokenBalance | undefined {
    const { chainId } = useAccount()
    const getTokenBalance = useAppStore((s) => s.getTokenBalance)

    if (!tokenAddress || !chainId) return undefined

    return getTokenBalance(chainId, tokenAddress, walletType)
}

/**
 * useWalletBalances - Get all balances for current wallet
 * 
 * Reads directly from Zustand for instant access.
 * 
 * @param walletType - 'eoa' or 'smartAccount' (defaults to 'eoa')
 * @param overrideChainId - Optional chain ID to get balances for a specific chain
 * @returns Object with tokens array, total USD value, and metadata
 * 
 * @example
 * const { tokens, totalUsdValue, hasBalances } = useWalletBalances()
 * // Or for a specific chain:
 * const { tokens } = useWalletBalances('eoa', 59144) // Linea
 */
export function useWalletBalances(
    walletType: 'eoa' | 'smartAccount' = 'eoa',
    overrideChainId?: number
) {
    const { chainId: connectedChainId, isConnected } = useAccount()
    const tokenBalances = useAppStore((s) => s.tokenBalances)
    const isBalanceFetching = useAppStore((s) => s.isBalanceFetching)

    // Use override chain if provided, otherwise use connected chain
    const chainId = overrideChainId || connectedChainId

    if (!chainId) {
        return {
            tokens: [] as TokenBalance[],
            totalUsdValue: 0,
            hasBalances: false,
            isLoading: false,
            lastUpdated: null as number | null
        }
    }

    const walletData = tokenBalances[chainId]?.[walletType]
    const tokens = walletData?.tokens || []
    const totalUsdValue = tokens.reduce((sum, t) => sum + t.usdValue, 0)

    return {
        tokens,
        totalUsdValue,
        hasBalances: tokens.length > 0,
        isLoading: isBalanceFetching,
        lastUpdated: walletData?.lastUpdated || null
    }
}

/**
 * useFormattedBalance - Get formatted balance string for a token
 * 
 * @param tokenAddress - The token address
 * @param decimals - Number of decimal places to show (default: 4)
 * @returns Formatted balance string (e.g., "1.2345")
 */
export function useFormattedBalance(
    tokenAddress: string | undefined,
    decimals = 4
): string {
    const tokenBalance = useTokenBalance(tokenAddress)

    if (!tokenBalance) return '0'

    // Format with proper decimal places
    const balance = tokenBalance.balance
    if (balance === 0) return '0'
    if (balance < 0.0001) return '<0.0001'

    return balance.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
    })
}

/**
 * useBalanceBySymbol - Get balance by token symbol
 * 
 * Useful when you only know the symbol (e.g., "ETH", "USDC")
 * 
 * @param symbol - Token symbol
 * @param walletType - 'eoa' or 'smartAccount' (defaults to 'eoa')
 * @returns Token balance or undefined
 */
export function useBalanceBySymbol(
    symbol: string | undefined,
    walletType: 'eoa' | 'smartAccount' = 'eoa'
): TokenBalance | undefined {
    const { tokens } = useWalletBalances(walletType)

    if (!symbol) return undefined

    return tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase())
}
