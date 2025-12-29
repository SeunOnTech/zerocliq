import { Token } from "@/types/token";
import { SUPPORTED_TOKENS } from "@/lib/tokens";

// "All" token option for filters
export const ALL_TOKEN: Token = {
    address: "all",
    symbol: "All",
    name: "All Tokens",
    decimals: 0,
    logoURI: "",
};

// Convert SUPPORTED_TOKENS to Token[] format for UI components
export const POPULAR_TOKENS: Token[] = [
    ALL_TOKEN,
    ...Object.values(SUPPORTED_TOKENS).map(t => ({
        address: t.mint,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoUrl,
    }))
];

// Tokens without "All" option (for create order flow)
export const SELECTABLE_TOKENS: Token[] = Object.values(SUPPORTED_TOKENS).map(t => ({
    address: t.mint,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    logoURI: t.logoUrl,
}));
