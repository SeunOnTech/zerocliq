/**
 * Standard function selectors allowed in Smart Card delegations.
 * 100% matching the pattern from the working create-delegation.ts script.
 * 
 * These selectors are UNIVERSAL across most DEXes (Uniswap V3 forks).
 */
export const STANDARD_DELEGATION_SELECTORS = [
    // ============================================
    // ERC-20 Token Functions (Universal)
    // ============================================
    "approve(address,uint256)",    // 0x095ea7b3
    "transfer(address,uint256)",   // 0xa9059cbb

    // ============================================
    // Wrapped Native Token Functions (WETH/WMON/WBNB)
    // ============================================
    "deposit()",                   // 0xd0e30db0
    "withdraw(uint256)",           // 0x2e1a7d4d

    // ============================================
    // SwapRouter V1 (with deadline in struct)
    // Used by: Uniswap V3 (Ethereum), older PancakeSwap V3
    // ============================================
    "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",  // 0x414bf389
    "exactInput((bytes,address,uint256,uint256,uint256))",                                  // 0xc04b8d59
    "exactOutputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))", // 0xdb3e2198
    "exactOutput((bytes,address,uint256,uint256,uint256))",                                 // 0xf28c0498

    // ============================================
    // SwapRouter02 (NO deadline in struct)
    // Used by: Monad Uniswap V3, newer deployments
    // CRITICAL for Monad!
    // ============================================
    "exactInput((bytes,address,uint256,uint256))",                            // 0xb858183f
    "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))", // 0x04e45aaf

    // ============================================
    // Multicall for Batched Operations
    // ============================================
    "multicall(uint256,bytes[])",  // 0x5ae401dc - with deadline
    "multicall(bytes[])",          // 0xac9650d8 - without deadline

    // ============================================
    // Uniswap V2 Style (for chains that use V2)
    // ============================================
    "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",      // 0x38ed1739
    "swapExactETHForTokens(uint256,address[],address,uint256)",                 // 0x7ff36ab5
    "swapExactTokensForETH(uint256,uint256,address[],address,uint256)",         // 0x18cbafe5
];
