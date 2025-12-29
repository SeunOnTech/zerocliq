/**
 * Sepolia Chain Common Utilities
 */

import type { Address } from "viem";

// Sepolia WETH address (Uniswap V3 - has liquidity)
export const WETH_ADDRESS: Address = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

/**
 * Normalize token address for Sepolia DEXes
 * Replaces native ETH address (0x000...) with WETH address
 */
export function normalizeTokenAddressForSepolia(address: Address): Address {
    if (address === "0x0000000000000000000000000000000000000000") {
        return WETH_ADDRESS;
    }
    return address;
}
