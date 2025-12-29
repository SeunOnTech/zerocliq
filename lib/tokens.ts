/**
 * Centralized token configuration with logos and metadata.
 * Use this config across the app for consistent token display.
 */

export interface TokenConfig {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    color: string;
    logoUrl: string;
}

/**
 * Supported tokens with their configurations.
 * Using reliable CDN logo URLs that work consistently.
 */
export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
    SOL: {
        symbol: "SOL",
        name: "Solana",
        mint: "So11111111111111111111111111111111111111112",
        decimals: 9,
        color: "#9945FF",
        logoUrl: "https://assets.coingecko.com/coins/images/4128/standard/solana.png?1718769756",
    },
    USDC: {
        symbol: "USDC",
        name: "USD Coin",
        mint: "4uAoVBPPxH2s6jxesQYB8k5B5VD4PzguRXt41HEr1Qjf",
        decimals: 6,
        color: "#2775CA",
        logoUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
    },
    USDT: {
        symbol: "USDT",
        name: "Tether",
        mint: "DAZDHEvVe2NGb5nXVi4N4oQ5JEnnPa5Po428GvBFDDFQ",
        decimals: 6,
        color: "#26A17B",
        logoUrl: "https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661",
    },
    BONK: {
        symbol: "BONK",
        name: "Bonk",
        mint: "F5msropj71fQMuqh35UUhMRgYRcbdRqPvyuq",
        decimals: 5,
        color: "#F7931A",
        logoUrl: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg",
    },
    WIF: {
        symbol: "WIF",
        name: "dogwifhat",
        mint: "D5oz1ZQ9qcP8EAhzWHdH5qzM6WxbRWaHbk67vSHSqQBF",
        decimals: 6,
        color: "#8B5CF6",
        logoUrl: "https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg",
    },
    JUP: {
        symbol: "JUP",
        name: "Jupiter",
        mint: "J5tKXWtVhYvtQ4xc6LLbXDgHUnAQYDgh8RCaCLopiZx7",
        decimals: 6,
        color: "#00D4AA",
        logoUrl: "https://static.jup.ag/jup/icon.png",
    },
    PYTH: {
        symbol: "PYTH",
        name: "Pyth Network",
        mint: "2UniZ6VqbfcC7Jq5vv59zhHtqUrzXcTxCBXLCKsxtRZx",
        decimals: 6,
        color: "#E84142",
        logoUrl: "https://assets.coingecko.com/coins/images/31924/small/pyth.png",
    },
};

/**
 * Get token config by symbol
 */
export function getTokenConfig(symbol: string): TokenConfig | undefined {
    return SUPPORTED_TOKENS[symbol.toUpperCase()];
}

/**
 * Get token logo URL by symbol
 */
export function getTokenLogo(symbol: string): string {
    const config = SUPPORTED_TOKENS[symbol?.toUpperCase()];
    return config?.logoUrl || "";
}

/**
 * Get all faucet-supported tokens (excludes SOL since it's native)
 */
export function getFaucetTokens(): TokenConfig[] {
    return Object.values(SUPPORTED_TOKENS).filter(t => t.symbol !== "SOL");
}

/**
 * Token list as array for iteration
 */
export const TOKEN_LIST = Object.values(SUPPORTED_TOKENS);
