// src/dexes/bsc/pancakeV3.ts
import type { PublicClient } from "viem";
import type { ChainConfig, TokenInfo } from "../@/lib/server/config/chains";
import type { DexPlugin, RouteCandidate, RouteHop } from "@/lib/server/dexes/dex.types";

/**
 * PancakeSwap V3 (Uniswap V3–style) on BNB Chain
 *
 * Quoter V2:
 *  BSC mainnet: 0xb048bbc1ee6b733fffcfb9e9cef7375518e25997
 */

const PANCAKE_V3_QUOTER_V2_BSC =
  "0xb048bbc1ee6b733fffcfb9e9cef7375518e25997" as const;

// Minimal Quoter ABI
const PANCAKE_V3_QUOTER_V2_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "view",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ]
      }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }]
  }
] as const;

// Same fee tiers used by PancakeSwap v3
const PANCAKE_V3_FEE_TIERS = [100, 250, 500, 1000, 2500, 5000, 10000];

export const pancakeV3Plugin: DexPlugin = {
  id: "pancake-v3",
  name: "PancakeSwap V3",
  kind: "UNIV3_LIKE",
  supportedChains: [56], // BNB Chain

  async quoteSingleHop(params: {
    chain: ChainConfig;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
    amountIn: bigint;
    client: PublicClient;
  }): Promise<RouteCandidate | null> {

    const { chain, tokenIn, tokenOut, amountIn, client } = params;

    if (chain.id !== 56) return null;

    const tokenInAddr = tokenIn.address as `0x${string}`;
    const tokenOutAddr = tokenOut.address as `0x${string}`;

    let bestAmountOut = 0n;
    let bestFee: number | null = null;

    // Try each fee tier and choose the best output
    for (const fee of PANCAKE_V3_FEE_TIERS) {
      try {
        const amountOut = await client.readContract({
          address: PANCAKE_V3_QUOTER_V2_BSC,
          abi: PANCAKE_V3_QUOTER_V2_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: tokenInAddr,
              tokenOut: tokenOutAddr,
              fee,
              recipient: "0x0000000000000000000000000000000000000000",
              amountIn,
              sqrtPriceLimitX96: 0n
            }
          ]
        }) as bigint;

        if (amountOut > bestAmountOut) {
          bestAmountOut = amountOut;
          bestFee = fee;
        }
      } catch {
        // No pool for this fee tier – skip
        continue;
      }
    }

    if (!bestFee || bestAmountOut <= 0n) {
      return null;
    }

    const hop: RouteHop = {
      dexId: "pancake-v3",
      dexName: "PancakeSwap V3",
      kind: "UNIV3_LIKE",
      detail: `PancakeSwap V3 QuoterV2 (fee ${bestFee} bps)`,
      poolOrQuoter: PANCAKE_V3_QUOTER_V2_BSC,
      path: [tokenInAddr, tokenOutAddr]
    };

    return {
      chainId: 56,
      dexId: "pancake-v3",
      dexName: "PancakeSwap V3",
      amountIn,
      amountOut: bestAmountOut,
      hops: [hop]
    };
  }
};
