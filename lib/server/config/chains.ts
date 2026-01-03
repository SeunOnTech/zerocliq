/**
 * Chain Configuration
 * 
 * Central configuration for all supported EVM chains.
 * Contains RPC URLs, tokens, and chain-specific settings.
 */

import { env } from "./env";

export type ChainKey =
    | "ethereum"
    | "linea"
    | "base"
    | "bsc"
    | "arbitrum"
    | "optimism"
    | "sepolia"
    | "monad";

export type TokenInfo = {
    symbol: string;
    name: string;
    address: `0x${string}`;
    decimals: number;
    logoURI: string;
    isStable?: boolean;
    isBlueChip?: boolean;
    isLST?: boolean;
    isLP?: boolean;
};

export type ChainConfig = {
    key: ChainKey;
    id: number;
    name: string;
    rpcUrl: string;
    bundlerUrl: string;
    paymasterUrl: string;
    explorerUrl: string;
    logourl?: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    tokens: TokenInfo[];
    features: {
        supportsPerps: boolean;
        supportsLending: boolean;
        supportsYield: boolean;
    };
};

const maybe = (value: string | undefined | null) =>
    value && value.trim().length > 0 ? value : undefined;

export const CHAINS: Record<ChainKey, ChainConfig | null> = {
    ethereum: null,
    linea: null,
    // linea: {
    //     key: "linea",
    //     id: 59144,
    //     name: "Linea Mainnet",
    //     rpcUrl: env.LINEA_RPC_URL,
    //     bundlerUrl: "https://api.pimlico.io/v2/59144/rpc?apikey=pim_gpv8uAY4a3SK7ioMf6Y7nh",
    //     paymasterUrl: "https://api.pimlico.io/v2/59144/rpc?apikey=pim_gpv8uAY4a3SK7ioMf6Y7nh",
    //     explorerUrl: "https://lineascan.build",
    //     logourl: "https://assets.coingecko.com/coins/images/68507/standard/linea-logo.jpeg?1756025484",
    //     nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    //     tokens: [
    //         {
    //             symbol: "ETH",
    //             name: "Ether",
    //             address: "0x0000000000000000000000000000000000000000",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/279/standard/ethereum.png",
    //         },
    //         {
    //             symbol: "USDC",
    //             name: "USD Coin",
    //             address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    //             decimals: 6,
    //             logoURI: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
    //             isStable: true,
    //         },
    //         {
    //             symbol: "USDT",
    //             name: "Tether USD",
    //             address: "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
    //             decimals: 6,
    //             logoURI: "https://assets.coingecko.com/coins/images/325/standard/Tether.png",
    //             isStable: true,
    //         },
    //         {
    //             symbol: "DAI",
    //             name: "Dai Stablecoin",
    //             address: "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/9956/standard/Badge_Dai.png?1696509996",
    //             isStable: true,
    //         },
    //         {
    //             symbol: "wstETH",
    //             name: "Wrapped stETH",
    //             address: "0xB5beDd42000b71FddE22D3eE8a79Bd49A568fC8F",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/18834/standard/wstETH.png?1696518295",
    //             isLST: true,
    //         },
    //         {
    //             symbol: "ezETH",
    //             name: "Renzo ezETH",
    //             address: "0x2416092f143378750bb29b79ed961ab195cceea5",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/34753/standard/Ezeth_logo_circle.png?1713496404",
    //             isLST: true,
    //         },
    //         {
    //             symbol: "WETH",
    //             name: "Wrapped Ether",
    //             address: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/2518/standard/weth.png?1762862456",
    //             isBlueChip: true,
    //         },
    //         {
    //             symbol: "UNI",
    //             name: "Uniswap",
    //             address: "0x636b22bc471c955a8db60f28d4795066a8201fa3",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/12504/standard/uniswap-logo.png?1720676669",
    //         },
    //         {
    //             symbol: "ZERO",
    //             name: "ZeroLend",
    //             address: "0x78354f8dccb269a615a7e0a24f9b0718fdc3c7a7",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/37375/standard/image.png?1714884543",
    //         },
    //         {
    //             symbol: "WBTC",
    //             name: "Wrapped BTC",
    //             address: "0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4",
    //             decimals: 8,
    //             logoURI: "https://assets.coingecko.com/coins/images/7598/standard/wrapped_bitcoin_wbtc.png?1762862456",
    //             isBlueChip: true,
    //         },
    //         {
    //             symbol: "FOXY",
    //             name: "Foxy",
    //             address: "0x5FBDF89403270a1846F5ae7D113A989F850d1566",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/36870/standard/Foxy_Logo_Square_200x200.png?1712645286",
    //         },
    //         {
    //             symbol: "LINEA",
    //             name: "Linea",
    //             address: "0x1789e0043623282D5DCc7F213d703C6D8BAfBB04",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/68507/standard/linea-logo.jpeg?1756025484",
    //         },
    //         {
    //             symbol: "REX",
    //             name: "Etherex",
    //             address: "0xEfD81eeC32B9A8222D1842ec3d99c7532C31e348",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/68009/standard/etherex.jpg?1754560098",
    //         },
    //     ],
    //     features: { supportsPerps: false, supportsLending: true, supportsYield: true },
    // },

    base: null,
    bsc: null,
    arbitrum: null,
    optimism: null,

    sepolia: {
        key: "sepolia",
        id: 11155111,
        name: "Sepolia Testnet",
        rpcUrl: env.SEPOLIA_RPC_URL,
        bundlerUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=pim_gpv8uAY4a3SK7ioMf6Y7nh",
        paymasterUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=pim_gpv8uAY4a3SK7ioMf6Y7nh",
        explorerUrl: "https://sepolia.etherscan.io",
        logourl: "https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628",
        nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
        tokens: [
            {
                symbol: "ETH",
                name: "Sepolia Ether",
                address: "0x0000000000000000000000000000000000000000",
                decimals: 18,
                logoURI: "https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628",
            },
            {
                symbol: "WETH",
                name: "Wrapped Ether",
                address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
                decimals: 18,
                logoURI: "https://assets.coingecko.com/coins/images/2518/standard/weth.png",
                isBlueChip: true,
            },
            {
                symbol: "USDC",
                name: "USD Coin",
                address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
                decimals: 6,
                logoURI: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
                isStable: true,
            },
            {
                symbol: "LINK",
                name: "Chainlink",
                address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
                decimals: 18,
                logoURI: "https://assets.coingecko.com/coins/images/877/standard/chainlink-new-logo.png?1720676669",
                isBlueChip: true,
            },
            {
                symbol: "DAI",
                name: "Dai Stablecoin",
                address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
                decimals: 18,
                logoURI: "https://assets.coingecko.com/coins/images/9956/standard/Badge_Dai.png?1696509996",
                isStable: true,
            },
        ],
        features: { supportsPerps: false, supportsLending: true, supportsYield: true },
    },
    monad: null,
    // monad: {
    //     key: "monad",
    //     id: 143,
    //     name: "Monad Mainnet",
    //     rpcUrl: env.MONAD_RPC_URL || "https://rpc.monad.xyz",
    //     bundlerUrl: "https://api.pimlico.io/v2/143/rpc?apikey=pim_gpv8uAY4a3SK7ioMf6Y7nh",
    //     paymasterUrl: "https://api.pimlico.io/v2/143/rpc?apikey=pim_gpv8uAY4a3SK7ioMf6Y7nh",
    //     explorerUrl: "https://monadscan.com",
    //     logourl: "https://assets.coingecko.com/coins/images/38927/standard/monad.png?1764042736",
    //     nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    //     tokens: [
    //         {
    //             symbol: "MON",
    //             name: "Monad",
    //             address: "0x0000000000000000000000000000000000000000",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/38927/standard/monad.png?1764042736",
    //             isBlueChip: true,
    //         },
    //         {
    //             symbol: "USDC",
    //             name: "USD Coin",
    //             address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    //             decimals: 6,
    //             logoURI: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1764042736",
    //             isStable: true,
    //         },
    //         {
    //             symbol: "WMON",
    //             name: "Wrapped Monad",
    //             address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
    //             decimals: 18,
    //             logoURI: "https://assets.coingecko.com/coins/images/38927/standard/monad.png?1764042736",
    //             isBlueChip: true,
    //         },
    //         {
    //             symbol: "USDT",
    //             name: "Tether USD",
    //             address: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    //             decimals: 6,
    //             logoURI: "https://assets.coingecko.com/coins/images/325/standard/Tether.png?1764042736",
    //             isStable: true,
    //         },
    //         {
    //             symbol: "AUSD",
    //             name: "AUSD",
    //             address: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
    //             decimals: 6,
    //             logoURI: "https://assets.coingecko.com/coins/images/39284/standard/Circle_Agora_White_on_Olive_1080px.png?1722961274",
    //             isStable: true,
    //         }
    //     ],
    //     features: { supportsPerps: true, supportsLending: true, supportsYield: true },
    // },
};

export function getActiveChains(): ChainConfig[] {
    return Object.values(CHAINS).filter((c): c is ChainConfig => c !== null);
}

export function getChainById(chainId: number): ChainConfig | undefined {
    return getActiveChains().find((c) => c.id === chainId);
}

export function isSupportedChainId(chainId: number): boolean {
    return !!getChainById(chainId);
}

import { linea, sepolia, type Chain } from "viem/chains";

export const monadChain: Chain = {
    id: 143,
    name: "Monad Mainnet",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.monad.xyz"] },
        public: { http: ["https://rpc.monad.xyz"] },
    },
    blockExplorers: {
        default: { name: "MonadScan", url: "https://monadscan.com" },
    },
    testnet: false,
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 0,
        },
    },
};

export function getViemChain(chainId: number): Chain {
    switch (chainId) {
        case 59144: return linea;
        case 11155111: return sepolia;
        case 143: return monadChain;
        default: throw new Error(`Viem chain not found for ID ${chainId}`);
    }
}
