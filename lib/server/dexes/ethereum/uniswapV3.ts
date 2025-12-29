// src/dexes/ethereum/uniswapV3.ts
import type { PublicClient } from "viem";
import type { ChainConfig, TokenInfo } from "../@/lib/server/config/chains";
import type { DexPlugin, RouteCandidate, RouteHop } from "@/lib/server/dexes/dex.types";

/**
 * Uniswap V3 on Ethereum mainnet
 *
 * QuoterV2:
 *   Mainnet: 0x61fFE014bA17989E743c5F6cB21bF9697530B21e
 */

const UNISWAP_V3_QUOTER_V2_MAINNET =
  "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const;

/**
 * QuoterV2 ABI (only the piece we need)
 *
 * function quoteExactInputSingle(
 *   QuoteExactInputSingleParams memory params
 * )
 *   external
 *   returns (
 *     uint256 amountOut,
 *     uint160 sqrtPriceX96After,
 *     uint32 initializedTicksCrossed,
 *     uint256 gasEstimate
 *   );
 *
 * struct QuoteExactInputSingleParams {
 *   address tokenIn;
 *   address tokenOut;
 *   uint256 amountIn;
 *   uint24 fee;
 *   uint160 sqrtPriceLimitX96;
 * }
 */
const UNISWAP_V3_QUOTER_V2_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

// Common Uniswap v3 fee tiers (in bps)
const UNISWAP_V3_FEE_TIERS = [100, 500, 3000, 10000];

export const uniswapV3Plugin: DexPlugin = {
  id: "uniswap-v3",
  name: "Uniswap V3",
  kind: "UNIV3_LIKE",
  supportedChains: [1], // Ethereum mainnet

  async quoteSingleHop(params: {
    chain: ChainConfig;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
    amountIn: bigint;
    client: PublicClient;
  }): Promise<RouteCandidate | null> {
    const { chain, tokenIn, tokenOut, amountIn, client } = params;

    // Safety guard (aggregator also filters by chain, but keep this)
    if (chain.id !== 1) return null;

    const tokenInAddr = tokenIn.address as `0x${string}`;
    const tokenOutAddr = tokenOut.address as `0x${string}`;

    let bestAmountOut = 0n;
    let bestFee: number | null = null;

    // Try each fee tier and pick the best successful quote
    for (const fee of UNISWAP_V3_FEE_TIERS) {
      try {
        const [amountOut] = (await client.readContract({
          address: UNISWAP_V3_QUOTER_V2_MAINNET,
          abi: UNISWAP_V3_QUOTER_V2_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: tokenInAddr,
              tokenOut: tokenOutAddr,
              amountIn,
              fee,
              sqrtPriceLimitX96: 0n,
            },
          ],
        })) as [bigint, bigint, number, bigint];

        if (amountOut > bestAmountOut) {
          bestAmountOut = amountOut;
          bestFee = fee;
        }
      } catch {
        // No pool / invalid tier → just skip this fee
        continue;
      }
    }

    // No successful tier
    if (!bestFee || bestAmountOut <= 0n) {
      return null;
    }

    const hop: RouteHop = {
      dexId: "uniswap-v3",
      dexName: "Uniswap V3",
      kind: "UNIV3_LIKE",
      detail: `Uniswap V3 QuoterV2 (fee ${bestFee} bps)`,
      poolOrQuoter: UNISWAP_V3_QUOTER_V2_MAINNET,
      path: [tokenInAddr, tokenOutAddr],
    };

    return {
      chainId: chain.id,
      dexId: "uniswap-v3",
      dexName: "Uniswap V3",
      amountIn,
      amountOut: bestAmountOut,
      hops: [hop],
    };
  },
};
