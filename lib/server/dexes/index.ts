/**
 * DEX Plugins Registry
 * 
 * Aggregates all DEX plugins across all supported chains.
 */

import type { DexPlugin } from "./dex.types";

// Linea Plugins
import { SyncSwapClassicPlugin, SyncSwapStablePlugin } from "./linea/syncswap.plugin";
import { LynexPlugin } from "./linea/lynex.plugin";
import { NilePlugin } from "./linea/nile.plugin";
import { EtherexPlugin } from "./linea/etherex.plugin";
import { PancakeV3LineaPlugin } from "./linea/pancakeV3.plugin";

// BSC Plugins
import { pancakeV2Plugin } from "./bsc/pancake-v2.plugin";
import { pancakeV3Plugin } from "./bsc/pancakeV3";
import { mdexV2Plugin } from "./bsc/mdexV2";

// Ethereum Plugins
import { uniswapV3Plugin } from "./ethereum/uniswapV3";

// Monad Plugins
import { PancakeV3MonadPlugin } from "./monad/pancakeV3.plugin";
import { UniswapV3MonadPlugin } from "./monad/uniswapV3.plugin";
import { UniswapV4MonadPlugin } from "./monad/uniswapV4.plugin";
import { CurveMonadPlugin } from "./monad/curve.plugin";

// Sepolia Plugins
import { uniswapV3SepoliaPlugin } from "./sepolia/uniswapV3.plugin";
import { uniswapV2SepoliaPlugin } from "./sepolia/uniswapV2.plugin";

/**
 * Global registry of all DEX plugins.
 * Aggregator will filter by chainId using supportedChains.
 */
export const dexPlugins: DexPlugin[] = [
    // Linea
    SyncSwapClassicPlugin,
    SyncSwapStablePlugin,
    LynexPlugin,
    NilePlugin,
    EtherexPlugin,
    PancakeV3LineaPlugin,

    // BSC
    pancakeV2Plugin,
    pancakeV3Plugin,
    mdexV2Plugin,

    // Ethereum
    uniswapV3Plugin,

    // Sepolia
    uniswapV3SepoliaPlugin,
    uniswapV2SepoliaPlugin,

    // Monad
    PancakeV3MonadPlugin,
    UniswapV3MonadPlugin,
    UniswapV4MonadPlugin,
    CurveMonadPlugin,
];

// Re-export types
export type { DexPlugin, RouteCandidate, RouteHop, DexQuoteParams, SwapParams, DexId, DexKind } from "./dex.types";
