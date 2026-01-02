// lib/hooks/useStreamPermission.ts
'use client';

import { useState, useCallback } from 'react';
import { createWalletClient, custom, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import type { ParsedIntent, StreamingDCAIntent, TWAPOrderIntent } from '@/lib/types/intents';
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions';

// Sepolia token addresses
const SEPOLIA_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
    'USDC': { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
    'DAI': { address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', decimals: 18 },
    'LINK': { address: '0x779877A7B0D9E8603169DdbD7836e478b4624789', decimals: 18 },
    'WETH': { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
};

export interface PermissionResult {
    success: boolean;
    permissionsContext?: string;
    delegationManager?: string;
    error?: string;
}

export interface UseStreamPermissionReturn {
    requestPermission: (intent: ParsedIntent) => Promise<PermissionResult>;
    isRequesting: boolean;
    error: string | null;
}

/**
 * Hook for requesting MetaMask Stream Permissions (ERC-7715)
 */
export function useStreamPermission(): UseStreamPermissionReturn {
    const [isRequesting, setIsRequesting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestPermission = useCallback(async (intent: ParsedIntent): Promise<PermissionResult> => {
        setIsRequesting(true);
        setError(null);

        try {
            // Check for MetaMask
            if (typeof window === 'undefined' || !window.ethereum) {
                throw new Error('MetaMask is not installed');
            }

            // Create wallet client with ERC-7715 actions
            const walletClient = createWalletClient({
                chain: sepolia,
                transport: custom(window.ethereum),
            }).extend(erc7715ProviderActions());

            // Get connected address
            const [address] = await walletClient.requestAddresses();
            if (!address) {
                throw new Error('No wallet connected');
            }

            // Current time and expiry (1 week from now)
            const currentTime = Math.floor(Date.now() / 1000);
            const expiry = currentTime + 604800; // 1 week

            // Build permission based on intent type
            let permission;
            let justification: string;

            if (intent.intentType === 'STREAMING_DCA') {
                const dcaIntent = intent as StreamingDCAIntent;
                const { sourceToken, sourceAmount, targetToken, durationSeconds } = dcaIntent.parameters;

                const tokenInfo = SEPOLIA_TOKENS[sourceToken.toUpperCase()];
                if (!tokenInfo) {
                    throw new Error(`Unsupported token: ${sourceToken}`);
                }

                // Calculate amount per second
                // FIX: Ensure minimum rate for demo execution (at least 0.01 USDC available immediately)
                // We add a small buffer or ensure the rate floor allows the first execution
                let amountPerSecond = sourceAmount / durationSeconds;

                // Demo Hack: If < 0.02 USDC/sec, bump it slightly or rely on startAmount if supported (not in V1)
                // Real Fix: We request a slightly higher rate to ensure the demo's 0.01 USDC fits in the first second
                if (amountPerSecond < 0.02) {
                    amountPerSecond = Math.max(amountPerSecond, 0.02); // Ensure at least 0.02/sec
                }

                justification = `Streaming DCA: ${sourceAmount} ${sourceToken} → ${targetToken} over ${Math.ceil(durationSeconds / 86400)} days`;

                permission = {
                    type: 'erc20-token-stream' as const,
                    data: {
                        tokenAddress: tokenInfo.address,
                        amountPerSecond: parseUnits(amountPerSecond.toFixed(tokenInfo.decimals), tokenInfo.decimals),
                        maxAmount: parseUnits(sourceAmount.toString(), tokenInfo.decimals),
                        startTime: currentTime,
                        justification,
                    },
                };
            } else if (intent.intentType === 'TWAP_ORDER') {
                const twapIntent = intent as TWAPOrderIntent;
                const { token, amount, durationSeconds, targetToken, action } = twapIntent.parameters;

                const tokenInfo = SEPOLIA_TOKENS[token.toUpperCase()];
                if (!tokenInfo) {
                    throw new Error(`Unsupported token: ${token}`);
                }

                let amountPerSecond = amount / durationSeconds;
                if (amountPerSecond < 0.02) {
                    amountPerSecond = Math.max(amountPerSecond, 0.02);
                }
                const actionLabel = action === 'SELL' ? 'Sell' : 'Buy';

                justification = `TWAP ${actionLabel}: ${amount} ${token}${targetToken ? ` → ${targetToken}` : ''} over ${Math.ceil(durationSeconds / 3600)}h`;

                permission = {
                    type: 'erc20-token-stream' as const,
                    data: {
                        tokenAddress: tokenInfo.address,
                        amountPerSecond: parseUnits(amountPerSecond.toFixed(tokenInfo.decimals), tokenInfo.decimals),
                        maxAmount: parseUnits(amount.toString(), tokenInfo.decimals),
                        startTime: currentTime,
                        justification,
                    },
                };
            } else {
                throw new Error(`Unsupported intent type for stream permission: ${intent.intentType}`);
            }

            console.log('[StreamPermission] Requesting permission:', permission);

            // Request execution permissions from MetaMask
            // Fetch Agent Address for permission assignment
            const agentResp = await fetch('/api/agent/address')
            const { address: agentAddress } = await agentResp.json()

            if (!agentAddress) throw new Error('Failed to fetch Agent Address')

            console.log('[StreamPermission] Granting permission to Agent:', agentAddress)

            const grantedPermissions = await walletClient.requestExecutionPermissions([{
                chainId: sepolia.id,
                expiry,
                signer: {
                    type: 'account',
                    data: {
                        address: agentAddress, // Grant permission to AGENT
                    },
                },
                permission,
                isAdjustmentAllowed: true,
            }]);

            console.log('[StreamPermission] Permissions granted:', grantedPermissions);

            // Extract context for later redemption
            const permissionsContext = grantedPermissions[0]?.context;
            const delegationManager = grantedPermissions[0]?.signerMeta?.delegationManager;

            return {
                success: true,
                permissionsContext,
                delegationManager,
            };
        } catch (err) {
            console.error('[StreamPermission] Error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to request permission';

            // Handle user rejection
            if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
                setError('Permission request was rejected');
                return { success: false, error: 'Permission request was rejected' };
            }

            // Handle MetaMask not installed/connected
            if (errorMessage.includes('MetaMask') || errorMessage.includes('wallet')) {
                setError(errorMessage);
                return { success: false, error: errorMessage };
            }

            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsRequesting(false);
        }
    }, []);

    return {
        requestPermission,
        isRequesting,
        error,
    };
}

export default useStreamPermission;
