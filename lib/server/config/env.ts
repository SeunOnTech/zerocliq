/**
 * Environment Configuration
 * 
 * Provides typed environment variables for server-side code.
 * Next.js automatically loads .env files, so no dotenv needed.
 */

// Environment variable accessors with defaults
export const env = {
    NODE_ENV: process.env.NODE_ENV || "development",

    // Agent EOA for Delegations
    AGENT_EOA_ADDRESS: process.env.AGENT_EOA_ADDRESS || "",
    AGENT_EOA_PRIVATE_KEY: process.env.AGENT_EOA_PRIVATE_KEY || "",

    // EVM RPCs
    ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
    LINEA_RPC_URL: process.env.LINEA_RPC_URL || "https://rpc.linea.build",
    BASE_RPC_URL: process.env.BASE_RPC_URL,
    BSC_RPC_URL: process.env.BSC_RPC_URL,
    ARBITRUM_RPC_URL: process.env.ARBITRUM_RPC_URL,
    OPTIMISM_RPC_URL: process.env.OPTIMISM_RPC_URL,
    SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL!,
    MONAD_RPC_URL: process.env.MONAD_RPC_URL,

    // Pimlico
    PIMLICO_API_KEY: process.env.PIMLICO_API_KEY || "pim_gpv8uAY4a3SK7ioMf6Y7nh",
};

/**
 * Validate that required environment variables are set
 * Call this at server startup
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
    const required = [
        "AGENT_EOA_ADDRESS",
        "AGENT_EOA_PRIVATE_KEY",
    ];

    const missing = required.filter(key => !process.env[key]);

    return {
        valid: missing.length === 0,
        missing,
    };
}
