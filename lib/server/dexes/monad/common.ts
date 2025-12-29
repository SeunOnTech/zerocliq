/**
 * Monad Chain Common Utilities
 */

/**
 * WMON on Monad
 */
export const WMON_MONAD = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as const;

/**
 * Map 0x000...0 native token → WMON on Monad for quoting.
 */
export function normalizeTokenAddressForMonad(address: string): `0x${string}` {
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    if (address.toLowerCase() === zeroAddr.toLowerCase()) {
        return WMON_MONAD;
    }
    return address as `0x${string}`;
}
