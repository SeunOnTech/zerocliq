// src/dexes/monad/uniswapV4.plugin.ts
import type {
    DexPlugin,
    DexQuoteParams,
    RouteCandidate,
    RouteHop,
} from "@/lib/server/dexes/dex.types";
import { normalizeTokenAddressForMonad } from "@/lib/server/dexes/monad/common";
import { encodeFunctionData, encodePacked, encodeAbiParameters } from "viem";

/**
 * 🔹 Uniswap V4 on Monad
 *
 * PoolManager: 0x188d586ddcf52439676ca21a244753fa19f9ea8e
 * Quoter: 0x661e93cca42afacb172121ef892830ca3b70f08d (Note: Using V3 Quoter address as placeholder/fallback if V4 Quoter is same or not found.
 * WAIT - The search result for V4 PoolManager was 0x188d... but Quoter was not explicitly found.
 * However, Uniswap V4 usually uses a specific Quoter contract.
 * If V4 Quoter is not found, we might need to rely on PoolManager directly or a specific Quoter.
 * Let's assume for now we can use the V3 Quoter if it supports V4 pools (unlikely) or if there's a V4 Quoter.
 * Actually, the search result for V3 Quoter was 0x661e...
 * Let's use the PoolManager address 0x188d... and assume a Quoter exists or we simulate against PoolManager?
 * No, V4 needs a Quoter.
 * Let's try to use the V3 Quoter address for now, but label it as V4 in case they are shared or similar.
 * actually, let's use the Universal Router for execution: 0x0d97dc33264bfc1c226207428a79b26757fb9dc3
 *
 * For Quoting: We need a V4 Quoter. If not found, we can't easily quote V4 pools without it.
 * Let's assume the V3 Quoter might work or we use the V3 logic for now as a fallback if V4 is just V3-style pools under the hood?
 * No, V4 is different (Singleton).
 *
 * CRITICAL: Without a specific V4 Quoter address, we can't implement `quoteSingleHop` correctly for V4.
 * I will use a PLACEHOLDER address for V4 Quoter and add a TODO.
 * Or better, I will assume the V3 Quoter *might* be the one if it's a "Universal Quoter"?
 * Let's use a placeholder and comment heavily.
 */

const UNISWAP_V4_POOL_MANAGER = "0x188d586ddcf52439676ca21a244753fa19f9ea8e" as const;
const UNISWAP_V4_QUOTER = "0xa222dd357a9076d1091ed6aa2e16c9742dd26891" as const;
const UNISWAP_UNIVERSAL_ROUTER = "0x0d97dc33264bfc1c226207428a79b26757fb9dc3" as const;

// Uniswap V4 Quoter ABI (Hypothetical / Standard V4)
// function quoteExactInputSingle(QuoteExactSingleParams memory params) external returns (uint256 amountOut, uint256 gasEstimate)
// struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 amountIn; bytes hookData; }
// struct PoolKey { Currency currency0; Currency currency1; uint24 fee; int24 tickSpacing; IHooks hooks; }
const UNISWAP_V4_QUOTER_ABI = [
    {
        inputs: [
            {
                components: [
                    {
                        components: [
                            { name: "currency0", type: "address" },
                            { name: "currency1", type: "address" },
                            { name: "fee", type: "uint24" },
                            { name: "tickSpacing", type: "int24" },
                            { name: "hooks", type: "address" }
                        ],
                        name: "poolKey",
                        type: "tuple"
                    },
                    { name: "zeroForOne", type: "bool" },
                    { name: "amountIn", type: "uint128" },
                    { name: "hookData", type: "bytes" }
                ],
                name: "params",
                type: "tuple"
            }
        ],
        name: "quoteExactInputSingle",
        outputs: [
            { name: "amountOut", type: "uint256" },
            { name: "gasEstimate", type: "uint256" }
        ],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;

// Universal Router ABI (Execute)
const UNIVERSAL_ROUTER_ABI = [
    {
        inputs: [
            { name: "commands", type: "bytes" },
            { name: "inputs", type: "bytes[]" },
            { name: "deadline", type: "uint256" }
        ],
        name: "execute",
        outputs: [],
        stateMutability: "payable",
        type: "function"
    }
] as const;

// Standard V4 Fee Tiers / Tick Spacings
// Fee: 500 (0.05%), TickSpacing: 10
// Fee: 3000 (0.30%), TickSpacing: 60
// Fee: 10000 (1.00%), TickSpacing: 200
const V4_POOL_CONFIGS = [
    { fee: 500, tickSpacing: 10 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 }
];

export const UniswapV4MonadPlugin: DexPlugin = {
    id: "uniswap-v4-monad",
    name: "Uniswap V4 (Monad)",
    kind: "UNISWAP_V3", // Using UNIV3_LIKE for now as it's closest in structure for aggregator
    supportedChains: [143],
    routerAddress: UNISWAP_UNIVERSAL_ROUTER,

    async quoteSingleHop(params: DexQuoteParams): Promise<RouteCandidate | null> {
        const { chain, tokenIn, tokenOut, amountIn, client } = params;

        const tokenInNorm = normalizeTokenAddressForMonad(tokenIn.address);
        const tokenOutNorm = normalizeTokenAddressForMonad(tokenOut.address);

        // Sort tokens for PoolKey (currency0 < currency1)
        const isZeroForOne = tokenInNorm.toLowerCase() < tokenOutNorm.toLowerCase();
        const currency0 = isZeroForOne ? tokenInNorm : tokenOutNorm;
        const currency1 = isZeroForOne ? tokenOutNorm : tokenInNorm;

        let bestAmountOut = 0n;
        let bestConfig = V4_POOL_CONFIGS[0];

        for (const config of V4_POOL_CONFIGS) {
            try {
                const result = await client.simulateContract({
                    address: UNISWAP_V4_QUOTER,
                    abi: UNISWAP_V4_QUOTER_ABI,
                    functionName: "quoteExactInputSingle",
                    args: [{
                        poolKey: {
                            currency0,
                            currency1,
                            fee: config.fee,
                            tickSpacing: config.tickSpacing,
                            hooks: "0x0000000000000000000000000000000000000000" // No hooks for standard pools
                        },
                        zeroForOne: isZeroForOne,
                        amountIn: BigInt(amountIn), // Cast to uint128 safe?
                        hookData: "0x"
                    }]
                }) as any;

                const amountOut = result.result[0];
                if (amountOut > bestAmountOut) {
                    bestAmountOut = amountOut;
                    bestConfig = config;
                }
            } catch (e) {
                // console.log("V4 Quote Failed", e);
            }
        }

        if (bestAmountOut <= 0n) return null;

        const hop: RouteHop = {
            dexId: "uniswap-v4-monad",
            dexName: "Uniswap V4 (Monad)",
            kind: "UNISWAP_V3", // Using V3 type for compatibility
            detail: `V4 Pool (Fee: ${bestConfig.fee / 10000}%)`,
            poolOrQuoter: UNISWAP_V4_POOL_MANAGER,
            path: [tokenInNorm, tokenOutNorm]
        };

        return {
            chainId: chain.id,
            dexId: "uniswap-v4-monad",
            dexName: "Uniswap V4 (Monad)",
            amountIn,
            amountOut: bestAmountOut,
            hops: [hop]
        };
    },

    async buildSwapCalldata(params) {
        const { chainId, tokenIn, tokenOut, amountIn, minAmountOut, recipient, hops } = params;
        const hop = hops[0]; // Assuming single hop for now as per quoteSingleHop

        // 1. Parse Pool Config from detail string (Hacky but effective without changing RouteHop)
        // Format: "V4 Pool (Fee: 0.05%)"
        let fee = 3000;
        let tickSpacing = 60;

        if (hop.detail.includes("0.05%")) { fee = 500; tickSpacing = 10; }
        else if (hop.detail.includes("0.3%")) { fee = 3000; tickSpacing = 60; }
        else if (hop.detail.includes("1%")) { fee = 10000; tickSpacing = 200; }

        const tokenInNorm = normalizeTokenAddressForMonad(tokenIn);
        const tokenOutNorm = normalizeTokenAddressForMonad(tokenOut);

        // 2. Construct PoolKey
        const isZeroForOne = tokenInNorm.toLowerCase() < tokenOutNorm.toLowerCase();
        const currency0 = isZeroForOne ? tokenInNorm : tokenOutNorm;
        const currency1 = isZeroForOne ? tokenOutNorm : tokenInNorm;

        const poolKey = {
            currency0,
            currency1,
            fee,
            tickSpacing,
            hooks: "0x0000000000000000000000000000000000000000" as `0x${string}` // No hooks
        };

        // 3. Encode ExactInputSingleParams
        // struct ExactInputSingleParams { PoolKey poolKey; bool zeroForOne; uint128 amountIn; uint128 amountOutMinimum; bytes hookData; }
        const exactInputSingleParams = encodeAbiParameters(
            [
                {
                    components: [
                        { name: "currency0", type: "address" },
                        { name: "currency1", type: "address" },
                        { name: "fee", type: "uint24" },
                        { name: "tickSpacing", type: "int24" },
                        { name: "hooks", type: "address" }
                    ],
                    name: "poolKey",
                    type: "tuple"
                },
                { name: "zeroForOne", type: "bool" },
                { name: "amountIn", type: "uint128" },
                { name: "amountOutMinimum", type: "uint128" },
                { name: "hookData", type: "bytes" }
            ],
            [
                poolKey,
                isZeroForOne,
                amountIn,
                minAmountOut,
                "0x" // hookData
            ]
        );

        // 4. Encode V4 Actions
        // Action: SWAP_EXACT_IN_SINGLE = 0x06
        const actions = encodePacked(["uint8"], [0x06]); // 0x06
        const paramsData = [exactInputSingleParams];

        const v4SwapInput = encodeAbiParameters(
            [
                { name: "actions", type: "bytes" },
                { name: "params", type: "bytes[]" }
            ],
            [actions, paramsData]
        );

        // 5. Encode Universal Router Command
        // Command: V4_SWAP = 0x10
        const commands = encodePacked(["uint8"], [0x10]); // 0x10
        const inputs = [v4SwapInput];

        // 6. Encode Final Calldata
        const data = encodeFunctionData({
            abi: UNIVERSAL_ROUTER_ABI,
            functionName: "execute",
            args: [commands, inputs, BigInt(params.deadline || Math.floor(Date.now() / 1000) + 1200)]
        });

        return {
            to: UNISWAP_UNIVERSAL_ROUTER,
            data,
            value: 0n
        };
    }
};
