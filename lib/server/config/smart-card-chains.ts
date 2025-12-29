/**
 * Smart Card Chain Configuration
 * 
 * Dynamically builds Smart Card configurations by discovering
 * DEX routers and tokens from chain config and DEX plugins.
 */

import type { Address } from "viem";
import { CHAINS, type TokenInfo, getChainById } from "./chains";
import { dexPlugins } from "@/lib/server/dexes";
import type { DexPlugin } from "@/lib/server/dexes/dex.types";

// Zero address constant for validation
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

/**
 * Information about a DEX router for Smart Card whitelisting
 */
export interface DexRouterInfo {
    id: string;
    name: string;
    routerAddress: Address;
    chainId: number;
}

/**
 * Configuration for Smart Card delegations on a specific chain
 */
export interface ChainSmartCardConfig {
    chainId: number;
    chainName: string;
    getSupportedTokens: () => TokenInfo[];
    getWhitelistedRouters: () => Address[];
    getDexRouterInfo: () => DexRouterInfo[];
}

/**
 * Router address mappings for DEX plugins
 */
const DEX_ROUTER_ADDRESSES: Record<string, Address> = {
    "syncswap-classic": "0xc2a1947d2336b2af74d5813dc9ca6e0c3b3e8a1e",
    "syncswap-stable": "0xc2a1947d2336b2af74d5813dc9ca6e0c3b3e8a1e",
    "lynex": "0x610D2f07b7EdC67565160F587F37636194C34E74",
    "nile-exchange": "0xAAA45c8F5ef92a000a121d102F4e89278a711Faa",
    "etherex": "0x85974429677c2a701af470B82F3118e74307826e",
    "pancake-v3-linea": "0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86",
    "pancake-v2": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    "pancake-v3": "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    "mdex-v2": "0x7DAe51BD3E3376B8c7c4900E9107f12Be3AF1bA8",
    "uniswap-v3": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    "pancake-v3-monad": "0x21114915Ac6d5A2e156931e20B20b038dEd0Be7C",
    "uniswap-v3-monad": "0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900",
    "uniswap-v4-monad": "0x0d97dc33264bfc1c226207428a79b26757fb9dc3",
    "curve-monad": ZERO_ADDRESS, // Curve on Monad uses direct pool interaction
    "uniswap-v3-sepolia": "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    "uniswap-v2-sepolia": "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3",
};

/**
 * Auto-discover DEX router information for a specific chain
 */
function getRoutersForChain(chainId: number): DexRouterInfo[] {
    const routers: DexRouterInfo[] = [];

    const plugins = dexPlugins as DexPlugin[];

    for (const plugin of plugins) {
        if (!plugin.supportedChains.includes(chainId)) {
            continue;
        }

        const routerAddress = DEX_ROUTER_ADDRESSES[plugin.id];

        if (!routerAddress || routerAddress === ZERO_ADDRESS) {
            console.warn(
                `[Smart Card] DEX plugin "${plugin.id}" for chain ${chainId} has no router address configured`
            );
            continue;
        }

        routers.push({
            id: plugin.id,
            name: plugin.name,
            routerAddress,
            chainId,
        });
    }

    return routers;
}

/**
 * Get chain name from CHAINS config by chain ID
 */
function getChainName(chainId: number): string {
    const chain = getChainById(chainId);
    return chain ? chain.name : `Chain ${chainId}`;
}

/**
 * Get supported tokens for a chain from CHAINS config
 */
function getTokensForChain(chainId: number): TokenInfo[] {
    const chain = getChainById(chainId);
    if (!chain) {
        throw new Error(`Chain ${chainId} not found in CHAINS config`);
    }
    return chain.tokens;
}

/**
 * Dynamically build Smart Card configuration for a chain
 */
function buildChainConfig(chainId: number): ChainSmartCardConfig {
    return {
        chainId,
        chainName: getChainName(chainId),
        getSupportedTokens: () => getTokensForChain(chainId),
        getWhitelistedRouters: () => {
            const routers = getRoutersForChain(chainId);
            const addresses = routers.map(r => r.routerAddress);
            // Deduplicate addresses
            return Array.from(new Set(addresses));
        },
        getDexRouterInfo: () => getRoutersForChain(chainId),
    };
}

/**
 * Smart Card configuration for all supported chains
 */
export const SMART_CARD_CHAIN_CONFIGS: Record<number, ChainSmartCardConfig> = {
    59144: buildChainConfig(59144),     // Linea
    11155111: buildChainConfig(11155111), // Sepolia
    143: buildChainConfig(143),          // Monad
};

/**
 * Get Smart Card configuration for a specific chain
 */
export function getSmartCardChainConfig(chainId: number): ChainSmartCardConfig {
    const config = SMART_CARD_CHAIN_CONFIGS[chainId];

    if (!config) {
        const supportedChains = Object.keys(SMART_CARD_CHAIN_CONFIGS).join(", ");
        throw new Error(
            `Smart Card configuration not found for chain ${chainId}. ` +
            `Supported chains: ${supportedChains}`
        );
    }

    return config;
}

/**
 * Get all supported tokens for a specific chain
 */
export function getSupportedTokensForChain(chainId: number): TokenInfo[] {
    const config = getSmartCardChainConfig(chainId);
    return config.getSupportedTokens();
}

/**
 * Get whitelisted router addresses for a specific chain
 */
export function getWhitelistedRoutersForChain(chainId: number): Address[] {
    const config = getSmartCardChainConfig(chainId);
    return config.getWhitelistedRouters();
}

/**
 * Get detailed DEX information for a specific chain
 */
export function getDexRouterInfoForChain(chainId: number): DexRouterInfo[] {
    const config = getSmartCardChainConfig(chainId);
    return config.getDexRouterInfo();
}

/**
 * Validate that a chain has all required configuration for Smart Cards
 */
export function validateChainConfig(chainId: number): {
    valid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
        const config = getSmartCardChainConfig(chainId);

        // Check tokens
        try {
            const tokens = config.getSupportedTokens();
            if (tokens.length === 0) {
                errors.push("No supported tokens found");
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            errors.push(`Tokens error: ${message}`);
        }

        // Check routers
        try {
            const routers = config.getWhitelistedRouters();
            if (routers.length === 0) {
                warnings.push("No whitelisted DEX routers found - swaps will not be possible");
            }

            const routerInfo = config.getDexRouterInfo();
            const plugins = dexPlugins as DexPlugin[];
            const pluginsForChain = plugins.filter(p => p.supportedChains.includes(chainId));
            const routersWithAddresses = routerInfo.length;

            if (routersWithAddresses < pluginsForChain.length) {
                warnings.push(
                    `Only ${routersWithAddresses}/${pluginsForChain.length} DEX plugins have router addresses configured`
                );
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            errors.push(`Routers error: ${message}`);
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`Chain config error: ${message}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
