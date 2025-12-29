/**
 * Server Config - Export Index
 * 
 * Re-exports all server-side configuration for easy importing.
 */

// Environment
export { env, validateEnv } from "./env";

// Chains
export {
    CHAINS,
    getActiveChains,
    getChainById,
    isSupportedChainId,
    getViemChain,
    monadChain,
    type ChainKey,
    type ChainConfig,
    type TokenInfo,
} from "./chains";

// Pimlico
export {
    PIMLICO_API_KEY,
    getPaymasterUrl,
    PIMLICO_SUPPORTED_CHAINS,
    isPimlicoSupported,
    AGENT_SMART_ACCOUNT_DEPLOY_SALT,
} from "./pimlico";

// Delegation Constants
export { STANDARD_DELEGATION_SELECTORS } from "./delegation-constants";

// Smart Card Chains
export {
    SMART_CARD_CHAIN_CONFIGS,
    getSmartCardChainConfig,
    getSupportedTokensForChain,
    getWhitelistedRoutersForChain,
    getDexRouterInfoForChain,
    validateChainConfig,
    type ChainSmartCardConfig,
    type DexRouterInfo,
} from "./smart-card-chains";

// Smart Card Types
export {
    SMART_CARD_TYPE_REGISTRY,
    TRADING_SELECTORS,
    REBALANCING_SELECTORS,
    STAKING_SELECTORS,
    GOVERNANCE_SELECTORS,
    getSmartCardTypeConfig,
    getEnabledSmartCardTypes,
    getAllSmartCardTypes,
    isSmartCardTypeEnabled,
    getDelegationScopeForType,
    generateSmartCardName,
    serializeTypeConfig,
    getSerializedSmartCardTypes,
    type SmartCardType,
    type SmartCardTypeConfig,
    type SmartCardCapability,
    type DelegationScope,
} from "./smart-card-types";
