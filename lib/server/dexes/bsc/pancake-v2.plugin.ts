// src/dexes/bsc/pancake-v2.plugin.ts
import type { PublicClient } from "viem";
import type { ChainConfig, TokenInfo } from "../@/lib/server/config/chains";
import type { DexPlugin, RouteCandidate, RouteHop } from "@/lib/server/dexes/dex.types";

/**
 * PancakeSwap V2 on BNB Smart Chain
 *
 * Factory: 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73
 * (Official Pancake V2 factory on BSC)
 *
 * Router is not needed for quoting — we quote directly from the pair.
 */
const PANCAKE_V2_FACTORY_BSC =
  "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const PANCAKE_FACTORY_ABI = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

const PANCAKE_PAIR_ABI = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

/**
 * Helper: find chain's wrapped native (WBNB) by symbol pattern: W + native symbol.
 * (e.g. native BNB → WBNB).
 */
function getWrappedNative(chain: ChainConfig): `0x${string}` | null {
  const nativeSymbol = chain.nativeCurrency.symbol.toUpperCase();
  const wrappedSymbol = `W${nativeSymbol}`; // BNB -> WBNB

  const wrapped = chain.tokens.find(
    (t) => t.symbol.toUpperCase() === wrappedSymbol
  );

  return wrapped ? (wrapped.address as `0x${string}`) : null;
}

/**
 * Helper: normalize 0x000... "native" addresses to wrapped native on this chain.
 */
function normalizeAddressForBsc(
  chain: ChainConfig,
  address: `0x${string}`
): `0x${string}` {
  if (address.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    const wrapped = getWrappedNative(chain);
    if (!wrapped) {
      throw new Error(
        `No wrapped native token configured for chain ${chain.id}`
      );
    }
    return wrapped;
  }
  return address;
}

/**
 * UniswapV2-style amountOut calculation with 0.25% fee:
 *   amountOut = (amountIn * 9975 * reserveOut) /
 *               (reserveIn*10000 + amountIn*9975)
 */
function getAmountOutUniv2(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;

  const feeNumerator = 9975n;
  const feeDenominator = 10000n;

  const amountInWithFee = amountIn * feeNumerator;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * feeDenominator + amountInWithFee;

  return denominator === 0n ? 0n : numerator / denominator;
}

/**
 * Main Pancake V2 plugin (single-hop).
 */
export const pancakeV2Plugin: DexPlugin = {
  id: "pancake-v2",
  name: "PancakeSwap V2",
  kind: "UNIV2_LIKE",             // ✅ REQUIRED FIELD (FIX ADDED)
  supportedChains: [56],          // BNB Smart Chain

  async quoteSingleHop(args: {
    chain: ChainConfig;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
    amountIn: bigint;
    client: PublicClient;
  }): Promise<RouteCandidate | null> {
    const { chain, tokenIn, tokenOut, amountIn, client } = args;

    if (chain.id !== 56) {
      throw new Error("Pancake V2 plugin only supports BSC (chainId 56).");
    }

    // Normalize possible "native BNB" address to WBNB
    const tokenInNorm = normalizeAddressForBsc(
      chain,
      tokenIn.address as `0x${string}`
    );
    const tokenOutNorm = normalizeAddressForBsc(
      chain,
      tokenOut.address as `0x${string}`
    );

    // 1) Get pair address from factory
    const pairAddress = (await client.readContract({
      address: PANCAKE_V2_FACTORY_BSC,
      abi: PANCAKE_FACTORY_ABI,
      functionName: "getPair",
      args: [tokenInNorm, tokenOutNorm],
    })) as `0x${string}`;

    if (
      !pairAddress ||
      pairAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()
    ) {
      // no pool for this pair
      return null;
    }

    // 2) Fetch reserves + token0/token1
    const [reserve0, reserve1] = (await client.readContract({
      address: pairAddress,
      abi: PANCAKE_PAIR_ABI,
      functionName: "getReserves",
      args: [],
    })) as [bigint, bigint, number];

    const token0 = (await client.readContract({
      address: pairAddress,
      abi: PANCAKE_PAIR_ABI,
      functionName: "token0",
      args: [],
    })) as `0x${string}`;

    const token1 = (await client.readContract({
      address: pairAddress,
      abi: PANCAKE_PAIR_ABI,
      functionName: "token1",
      args: [],
    })) as `0x${string}`;

    // Map reserves to input/output side
    let reserveIn: bigint;
    let reserveOut: bigint;

    if (tokenInNorm.toLowerCase() === token0.toLowerCase()) {
      reserveIn = reserve0;
      reserveOut = reserve1;
    } else if (tokenInNorm.toLowerCase() === token1.toLowerCase()) {
      reserveIn = reserve1;
      reserveOut = reserve0;
    } else {
      // Shouldn't happen if factory.getPair matched the same token addresses
      return null;
    }

    const amountOut = getAmountOutUniv2(amountIn, reserveIn, reserveOut);
    if (amountOut <= 0n) return null;

    const hop: RouteHop = {
      dexId: "pancake-v2",
      dexName: "PancakeSwap V2",
      kind: "UNIV2_LIKE",
      detail: "PancakeSwap V2 Pair",
      poolOrQuoter: pairAddress,
      path: [tokenInNorm, tokenOutNorm],
    };

    const candidate: RouteCandidate = {
      chainId: chain.id,
      dexId: "pancake-v2",
      dexName: "PancakeSwap V2",
      amountIn,
      amountOut,
      hops: [hop],
    };

    return candidate;
  },
};
