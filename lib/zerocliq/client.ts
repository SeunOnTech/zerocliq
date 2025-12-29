
import { useMemo, useState, useEffect } from 'react';
import { MOCK_ORDERS, MOCK_TOKENS } from '@/lib/mock/data';
import { useAppStore } from '@/store/useAppStore';

export interface TokenDetails {
    symbol: string;
    mint: string;
    decimals: number;
}

export interface Order {
    orderId: string;
    maker: string;
    tokenA: TokenDetails;
    tokenB: TokenDetails;
    amountARemaining: number;
    priceRate: number;
    effectivePrice: number;
    formattedPrice: string;
    formattedAmount: string;
    isFloating: boolean;
    isExpired: boolean;
    expiryTs: number;
}

export interface CreateOrderResult {
    orderId: string;
    signature: string;
}

export function useZerocliq() {
    const isConnected = useAppStore((state) => state.isConnected);
    const address = useAppStore((state) => state.address);
    const [localOrders, setLocalOrders] = useState<Order[]>(MOCK_ORDERS);

    return useMemo(() => {
        const dummySignature = "5HkZ...DemoSignature...1234";

        if (!isConnected || !address) {
            return {
                connected: false as const,
                publicKey: null,
                createFixedOrder: async () => { throw new Error("Wallet not connected"); },
                createFloatingOrder: async () => { throw new Error("Wallet not connected"); },
                takeOrder: async () => { throw new Error("Wallet not connected"); },
                cancelOrder: async () => { throw new Error("Wallet not connected"); },
                getActiveOrders: async () => localOrders,
                getOrder: async (orderId: string) => localOrders.find(o => o.orderId === orderId) || null,
                getMyOrders: async () => { throw new Error("Wallet not connected"); },
                mintTokens: async () => { throw new Error("Wallet not connected"); },
                getTokenBalance: async () => 0,
                tokens: Object.keys(MOCK_TOKENS),
            };
        }

        return {
            connected: true as const,
            publicKey: address,

            createFixedOrder: async (tokenA: string, tokenB: string, amount: number, priceRate: number, expirySeconds: number): Promise<CreateOrderResult> => {
                const newOrder: Order = {
                    orderId: `order_${Date.now()} `,
                    maker: address,
                    tokenA: MOCK_TOKENS[tokenA as keyof typeof MOCK_TOKENS],
                    tokenB: MOCK_TOKENS[tokenB as keyof typeof MOCK_TOKENS],
                    amountARemaining: amount,
                    priceRate: priceRate,
                    effectivePrice: priceRate,
                    formattedPrice: `${priceRate} ${tokenB}`,
                    formattedAmount: `${amount} ${tokenA} `,
                    isFloating: false,
                    isExpired: false,
                    expiryTs: Math.floor(Date.now() / 1000) + expirySeconds,
                };
                // Zerocliq SDK - Simplified Client
                await new Promise(r => setTimeout(r, 1000));
                setLocalOrders(prev => [newOrder, ...prev]);
                return { orderId: newOrder.orderId, signature: dummySignature };
            },

            createFloatingOrder: async (tokenA: string, tokenB: string, amount: number, spreadBps: number, oracleFeed: string, expirySeconds: number): Promise<CreateOrderResult> => {
                const newOrder: Order = {
                    orderId: `order_${Date.now()} `,
                    maker: address,
                    tokenA: MOCK_TOKENS[tokenA as keyof typeof MOCK_TOKENS],
                    tokenB: MOCK_TOKENS[tokenB as keyof typeof MOCK_TOKENS],
                    amountARemaining: amount,
                    priceRate: spreadBps,
                    effectivePrice: 100, // Dummy oracle price
                    formattedPrice: `Oracle + ${spreadBps / 100}%`,
                    formattedAmount: `${amount} ${tokenA} `,
                    isFloating: true,
                    isExpired: false,
                    expiryTs: Math.floor(Date.now() / 1000) + expirySeconds,
                };
                await new Promise(r => setTimeout(r, 1000));
                setLocalOrders(prev => [newOrder, ...prev]);
                return { orderId: newOrder.orderId, signature: dummySignature };
            },

            takeOrder: async (orderId: string, amount: number, maxSlippageBps: number = 100) => {
                await new Promise(r => setTimeout(r, 1000));
                return dummySignature;
            },

            cancelOrder: async (orderId: string) => {
                await new Promise(r => setTimeout(r, 500));
                setLocalOrders(prev => prev.filter(o => o.orderId !== orderId));
                return dummySignature;
            },

            getActiveOrders: async () => localOrders,

            getOrder: async (orderId: string) => localOrders.find(o => o.orderId === orderId) || null,

            getMyOrders: async () => localOrders.filter(o => o.maker === address),

            mintTokens: async (tokenName: string, amount: number) => {
                await new Promise(r => setTimeout(r, 1000));
                return dummySignature;
            },

            getTokenBalance: async (token: string) => {
                // Mock balance: 10000 for everything
                return 10000;
            },

            tokens: Object.keys(MOCK_TOKENS),
        };
    }, [isConnected, address, localOrders]);
}
