/**
 * Linea Chain Common Utilities
 */

/**
 * WETH on Linea
 */
export const WETH_LINEA = "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f" as const;

/**
 * Map 0x000...0 native token → WETH on Linea for quoting.
 */
export function normalizeTokenAddressForLinea(address: string): `0x${string}` {
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    if (address.toLowerCase() === zeroAddr.toLowerCase()) {
        return WETH_LINEA;
    }
    return address as `0x${string}`;
}
