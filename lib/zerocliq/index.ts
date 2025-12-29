/**
 * ZeroSlip SDK
 * 
 * A self-contained TypeScript SDK for interacting with the ZeroSlip protocol.
 * 
 * @example
 * ```typescript
 * import { ZeroSlipClient } from './sdk';
 * 
 * const client = new ZeroSlipClient(connection, wallet, 'devnet');
 * ```
 */

// Main client
export { ZeroSlipClient } from "./zeroslip-client";
export type { WalletAdapter } from "./zeroslip-client";

// Types
export type {
    Order,
    OrderSummary,
    OrderType,
    CreateFixedOrderParams,
    CreateFloatingOrderParams,
    TakeOrderParams,
    CreateOrderResult,
    TakeOrderEstimate,
    ProtocolConfig,
    TokenInfo,
    PythFeed,
    NetworkConfig,
    NetworkType,
} from "./types";

// Configuration and constants
export {
    PROGRAM_IDS,
    PROTOCOL_CONFIG,
    TOKENS,
    PYTH_FEEDS,
    PYTH_RECEIVER_PROGRAM_IDS,
    getNetworkConfig,
    getTokenInfo,
    getTokenByMint,
    getPythFeed,
    getAllTokenNames,
    getAllPythPairs,
} from "./constants";

// Errors
export {
    ZeroSlipError,
    OrderNotFoundError,
    InsufficientBalanceError,
    OrderExpiredError,
    SlippageExceededError,
    TokenNotFoundError,
    OracleFeedNotFoundError,
    ProgramNotInitializedError,
    ERROR_MESSAGES,
    parseError,
    isErrorCode,
    getErrorMessage,
} from "./errors";
export type { ZeroSlipErrorCode } from "./errors";
