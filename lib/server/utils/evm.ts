/**
 * EVM Utilities
 * 
 * Provides public client creation and caching for EVM chains.
 * Used by services for on-chain interactions.
 */

import { createPublicClient, http } from "viem";
import type { Chain } from "viem";
import { getChainById, type ChainConfig } from "@/lib/server/config/chains";

const publicClients = new Map<number, ReturnType<typeof createPublicClient>>();

function toViemChain(config: ChainConfig): Chain {
    return {
        id: config.id,
        name: config.name,
        nativeCurrency: config.nativeCurrency,
        rpcUrls: {
            default: {
                http: [config.rpcUrl],
            },
        },
    } as Chain;
}

/**
 * Get or create a cached public client for a chain
 */
export function getPublicClient(chainId: number) {
    const existing = publicClients.get(chainId);
    if (existing) return existing;

    const config = getChainById(chainId);
    if (!config) {
        throw new Error(`Unsupported or inactive chainId: ${chainId}`);
    }

    const client = createPublicClient({
        chain: toViemChain(config),
        transport: http(config.rpcUrl),
    });

    publicClients.set(chainId, client);
    return client;
}
