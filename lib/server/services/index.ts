/**
 * Server Services - Export Index
 */

// Smart Card (Core)
export { smartCardService, SmartCardService, getAgentSmartAccountAddress } from "./smart-card.service";

// Delegation
export { delegationBuilderService, DelegationBuilderService } from "./delegation-builder.service";

// Spending Limits
export { spendingLimitService, SpendingLimitService } from "./spending-limit.service";

// Swap
export { swapService, SwapService, type SwapQuoteRequest, type SwapQuoteResponse } from "./swap.service";

// Smart Account
export {
    computeSmartAccountAddress,
    checkDeploymentStatus,
    getOrComputeSmartAccount,
    refreshSmartAccountStatus,
    type SmartAccountInfo,
    type ComputeSmartAccountResult,
} from "./smart-account.service";

// User
export {
    createOrUpdateUserSmartAccount,
    getUserSmartAccount,
    updateSmartAccountStatus,
    markOnboardingComplete,
    type CreateUserSmartAccountInput,
} from "./user.service";

// Balances
export { balancesService, BalancesService } from "./balances.service";

// Price APIs
export { defillamaService, DefilllamaService } from "./defillama.service";
export { dexScreenerService, DexScreenerService } from "./dexscreener.service";
