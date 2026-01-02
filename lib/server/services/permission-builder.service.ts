// lib/server/services/permission-builder.service.ts

import { parseUnits } from 'viem';
import type { StreamingDCAParameters, TWAPOrderParameters } from '@/lib/types/intents';
import { getChainById, type TokenInfo } from '@/lib/server/config/chains';

/**
 * Stream Permission Config as per MetaMask SDK
 */
export interface StreamPermissionConfig {
    type: 'erc20-token-stream' | 'native-token-stream';
    data: {
        tokenAddress?: string;  // Only for ERC-20
        amountPerSecond: bigint;
        maxAmount: bigint;
        initialAmount: bigint;
        startTime: number;
        justification: string;
    };
}

/**
 * Get token info by symbol and chain from existing chain config
 */
export function getTokenInfo(symbol: string, chainId: number): TokenInfo | null {
    const chain = getChainById(chainId);
    if (!chain) {
        console.warn(`[PermissionBuilder] Unknown chain: ${chainId}`);
        return null;
    }

    const token = chain.tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
    if (!token) {
        console.warn(`[PermissionBuilder] Unknown token: ${symbol} on chain ${chain.name}`);
        return null;
    }

    return token;
}

/**
 * Check if token is native (address is zero address)
 */
function isNativeToken(address: string): boolean {
    return address === '0x0000000000000000000000000000000000000000';
}

/**
 * Build Stream Permission for DCA Intent
 */
export function buildDCAPermission(
    params: StreamingDCAParameters,
    chainId: number
): StreamPermissionConfig {
    const { sourceToken, sourceAmount, targetToken, durationSeconds } = params;

    // Get token info
    const tokenInfo = getTokenInfo(sourceToken, chainId);
    if (!tokenInfo) {
        throw new Error(`Unknown token: ${sourceToken}`);
    }

    const { address: tokenAddress, decimals } = tokenInfo;

    // Calculate amount per second with high precision
    const amountPerSecond = sourceAmount / durationSeconds;

    // Use more decimal places for precision, then parse
    const amountPerSecondStr = amountPerSecond.toFixed(Math.min(decimals, 18));
    const maxAmountStr = sourceAmount.toString();

    // Determine if native or ERC-20
    const isNative = isNativeToken(tokenAddress);

    const permissionData = {
        amountPerSecond: parseUnits(amountPerSecondStr, decimals),
        maxAmount: parseUnits(maxAmountStr, decimals),
        initialAmount: 0n,
        startTime: Math.floor(Date.now() / 1000),
        justification: `Streaming DCA: ${sourceAmount} ${sourceToken} → ${targetToken} over ${formatDuration(durationSeconds)}`,
    };

    if (isNative) {
        return {
            type: 'native-token-stream',
            data: permissionData,
        };
    }

    return {
        type: 'erc20-token-stream',
        data: {
            ...permissionData,
            tokenAddress,
        },
    };
}

/**
 * Build Stream Permission for TWAP Order Intent
 */
export function buildTWAPPermission(
    params: TWAPOrderParameters,
    chainId: number
): StreamPermissionConfig {
    const { action, token, amount, durationSeconds, targetToken } = params;

    // Get token info
    const tokenInfo = getTokenInfo(token, chainId);
    if (!tokenInfo) {
        throw new Error(`Unknown token: ${token}`);
    }

    const { address: tokenAddress, decimals } = tokenInfo;

    // Calculate amount per second
    const amountPerSecond = amount / durationSeconds;
    const amountPerSecondStr = amountPerSecond.toFixed(Math.min(decimals, 18));
    const maxAmountStr = amount.toString();

    // Determine if native or ERC-20
    const isNative = isNativeToken(tokenAddress);

    const actionLabel = action === 'SELL' ? 'Sell' : 'Buy';
    const targetLabel = targetToken ? ` for ${targetToken}` : '';

    const permissionData = {
        amountPerSecond: parseUnits(amountPerSecondStr, decimals),
        maxAmount: parseUnits(maxAmountStr, decimals),
        initialAmount: 0n,
        startTime: Math.floor(Date.now() / 1000),
        justification: `TWAP ${actionLabel}: ${amount} ${token}${targetLabel} over ${formatDuration(durationSeconds)}`,
    };

    if (isNative) {
        return {
            type: 'native-token-stream',
            data: permissionData,
        };
    }

    return {
        type: 'erc20-token-stream',
        data: {
            ...permissionData,
            tokenAddress,
        },
    };
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) {
        return hours > 0 ? `${days}d ${hours}h` : `${days} days`;
    }
    if (hours > 0) {
        return `${hours} hours`;
    }
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minutes`;
}

/**
 * Generic permission builder - routes to specific builders based on intent type
 */
export function buildStreamPermission(
    intentType: string,
    parameters: StreamingDCAParameters | TWAPOrderParameters,
    chainId: number
): StreamPermissionConfig {
    switch (intentType) {
        case 'STREAMING_DCA':
            return buildDCAPermission(parameters as StreamingDCAParameters, chainId);
        case 'TWAP_ORDER':
            return buildTWAPPermission(parameters as TWAPOrderParameters, chainId);
        default:
            throw new Error(`Unsupported intent type for stream permission: ${intentType}`);
    }
}
