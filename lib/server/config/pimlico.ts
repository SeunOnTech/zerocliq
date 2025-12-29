/**
 * Pimlico Paymaster Configuration
 * 
 * Used for gasless (sponsored) transactions via ERC-4337 UserOperations.
 * The paymaster sponsors gas for Smart Account transactions.
 */

// Pimlico API Key (same as frontend)
export const PIMLICO_API_KEY = "pim_gpv8uAY4a3SK7ioMf6Y7nh";

/**
 * Get the Pimlico paymaster/bundler URL for a specific chain
 */
export function getPaymasterUrl(chainId: number): string {
    return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`;
}

/**
 * Chains supported by Pimlico for sponsorship
 * Note: Sponsorship quotas may apply
 */
export const PIMLICO_SUPPORTED_CHAINS: number[] = [
    1,        // Ethereum Mainnet
    59144,    // Linea
    11155111, // Sepolia
    143,      // Monad
];

/**
 * Check if a chain is supported by Pimlico
 */
export function isPimlicoSupported(chainId: number): boolean {
    return PIMLICO_SUPPORTED_CHAINS.includes(chainId);
}

/**
 * Agent Smart Account deploy salt
 * Must match the salt used in deploy-agent-smart-account.ts
 */
export const AGENT_SMART_ACCOUNT_DEPLOY_SALT = "0x0000000000000000000000000000000000000000000000000000000000000001";
