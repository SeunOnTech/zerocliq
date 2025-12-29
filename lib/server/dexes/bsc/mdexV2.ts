// src/dexes/bsc/mdexV2.ts
import type { PublicClient } from "viem";
import type { ChainConfig, TokenInfo } from "../@/lib/server/config/chains";
import type { DexPlugin, RouteCandidate, RouteHop } from "@/lib/server/dexes/dex.types";

/**
 * MDEX (UniswapV2-like) on BNB Chain
 *
 * Router:
 *  - BNB Chain: 0x7DAe51BD3E3376B8c7c4900E9107f12Be3AF1bA8
 *
 * We use getAmountsOut(amountIn, [tokenIn, tokenOut]) for quoting.
 */

const MDEX_V2_ROUTER_BSC =
  "0x7DAe51BD3E3376B8c7c4900E9107f12Be3AF1bA8" as const;

// Minimal UniswapV2-like router ABI
const MDEX_V2_ROUTER_ABI = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

export const mdexV2Plugin: DexPlugin = {
  id: "mdex-v2",
  name: "MDEX V2",
  kind: "UNIV2_LIKE",
  supportedChains: [56], // BNB Smart Chain

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

    try {
      const amounts = (await client.readContract({
        address: MDEX_V2_ROUTER_BSC,
        abi: MDEX_V2_ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [amountIn, [tokenInAddr, tokenOutAddr]],
      })) as bigint[];

      if (!amounts || amounts.length < 2) {
        return null;
      }

      const amountOut = amounts[amounts.length - 1];
      if (amountOut <= 0n) return null;

      const hop: RouteHop = {
        dexId: "mdex-v2",
        dexName: "MDEX V2",
        kind: "UNIV2_LIKE",
        detail: "MDEX V2 Router Pair",
        poolOrQuoter: MDEX_V2_ROUTER_BSC,
        path: [tokenInAddr, tokenOutAddr],
      };

      return {
        chainId: chain.id,
        dexId: "mdex-v2",
        dexName: "MDEX V2",
        amountIn,
        amountOut,
        hops: [hop],
      };
    } catch {
      return null;
    }
  },
};
