
import { User } from '@/hooks/useUserStore';

export const MOCK_USER: User = {
    id: 'user_123456789',
    walletAddress: 'DemoWalletAddress123456789', // Will be replaced by actual connected wallet in hook if needed, or just stay mock
    username: 'Demo User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    isVerified: true,
    totalOrders: 42,
    totalVolume: 150000,
    completionRate: 98.5,
    createdAt: new Date().toISOString(),
};

export const MOCK_TOKENS = {
    USDC: { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
    SOL: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
    BONK: { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
    WIF: { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
    JUP: { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtkPHCLkdP9McP6t7dH', decimals: 6 },
};

export const MOCK_ORDERS = [
    {
        orderId: 'order_1',
        maker: 'ActiveMaker1',
        tokenA: MOCK_TOKENS.USDC,
        tokenB: MOCK_TOKENS.SOL,
        amountARemaining: 500,
        priceRate: 0.005,
        effectivePrice: 0.005,
        formattedPrice: '0.005 SOL',
        formattedAmount: '500 USDC',
        isFloating: false,
        isExpired: false,
        expiryTs: Math.floor(Date.now() / 1000) + 3600,
    },
    {
        orderId: 'order_2',
        maker: 'ActiveMaker2',
        tokenA: MOCK_TOKENS.SOL,
        tokenB: MOCK_TOKENS.USDC,
        amountARemaining: 10,
        priceRate: 150,
        effectivePrice: 151.5, // Spread applied
        formattedPrice: '150 USDC',
        formattedAmount: '10 SOL',
        isFloating: true,
        isExpired: false,
        expiryTs: Math.floor(Date.now() / 1000) + 7200,
    },
    {
        orderId: 'order_3',
        maker: 'ActiveMaker3',
        tokenA: MOCK_TOKENS.BONK,
        tokenB: MOCK_TOKENS.USDC,
        amountARemaining: 1000000,
        priceRate: 0.000015,
        effectivePrice: 0.000015,
        formattedPrice: '0.000015 USDC',
        formattedAmount: '1M BONK',
        isFloating: false,
        isExpired: false,
        expiryTs: Math.floor(Date.now() / 1000) + 1800,
    },
];
