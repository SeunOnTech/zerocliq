/**
 * ZeroSlip SDK - Custom Errors
 * 
 * Custom error classes for better error handling and user-friendly messages.
 */

// ============================================================================
// ERROR CODES (Match on-chain errors.rs)
// ============================================================================

/**
 * ZeroSlip error codes matching on-chain ErrorCode enum
 */
export enum ZeroSlipErrorCode {
    ExpiryInPast = 6000,
    InsufficientFunds = 6001,
    SlippageExceeded = 6002,
    MathOverflow = 6003,
    OracleStale = 6004,
    InvalidOraclePrice = 6005,
    OrderExpired = 6006,
    Unauthorized = 6007,
    InvalidCalculation = 6008,
    OrderFilled = 6009,
    InvalidOrderType = 6010,
    InvalidMint = 6011,
    OrderNotExpired = 6012,
}

/**
 * Human-readable error messages for each error code
 */
export const ERROR_MESSAGES: Record<ZeroSlipErrorCode, string> = {
    [ZeroSlipErrorCode.ExpiryInPast]: "The expiry time is in the past. Please set a future expiry.",
    [ZeroSlipErrorCode.InsufficientFunds]: "Insufficient funds in the vault to complete this trade.",
    [ZeroSlipErrorCode.SlippageExceeded]: "Price slippage exceeded your maximum tolerance. Try increasing max slippage.",
    [ZeroSlipErrorCode.MathOverflow]: "A numerical overflow occurred during calculation.",
    [ZeroSlipErrorCode.OracleStale]: "The oracle price is stale. The price feed hasn't updated recently.",
    [ZeroSlipErrorCode.InvalidOraclePrice]: "The oracle returned an invalid price.",
    [ZeroSlipErrorCode.OrderExpired]: "This order has expired and can no longer be taken.",
    [ZeroSlipErrorCode.Unauthorized]: "You are not authorized to perform this action.",
    [ZeroSlipErrorCode.InvalidCalculation]: "An invalid calculation was detected.",
    [ZeroSlipErrorCode.OrderFilled]: "This order has been completely filled.",
    [ZeroSlipErrorCode.InvalidOrderType]: "Invalid order type specified.",
    [ZeroSlipErrorCode.InvalidMint]: "Invalid token mint provided.",
    [ZeroSlipErrorCode.OrderNotExpired]: "This order has not expired yet.",
};

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

/**
 * Base error class for all ZeroSlip SDK errors
 */
export class ZeroSlipError extends Error {
    /** Error code (if from on-chain) */
    public readonly code?: ZeroSlipErrorCode;
    /** Original error that caused this error */
    public readonly cause?: Error;

    constructor(message: string, code?: ZeroSlipErrorCode, cause?: Error) {
        super(message);
        this.name = "ZeroSlipError";
        this.code = code;
        this.cause = cause;
        Object.setPrototypeOf(this, ZeroSlipError.prototype);
    }
}

// ============================================================================
// SPECIFIC ERROR CLASSES
// ============================================================================

/**
 * Thrown when an order is not found
 */
export class OrderNotFoundError extends ZeroSlipError {
    constructor(orderId: string) {
        super(`Order not found: ${orderId}`);
        this.name = "OrderNotFoundError";
        Object.setPrototypeOf(this, OrderNotFoundError.prototype);
    }
}

/**
 * Thrown when user has insufficient balance
 */
export class InsufficientBalanceError extends ZeroSlipError {
    public readonly token: string;
    public readonly required: number;
    public readonly available: number;

    constructor(token: string, required: number, available: number) {
        super(`Insufficient ${token} balance. Required: ${required}, Available: ${available}`);
        this.name = "InsufficientBalanceError";
        this.token = token;
        this.required = required;
        this.available = available;
        Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
    }
}

/**
 * Thrown when an order has expired
 */
export class OrderExpiredError extends ZeroSlipError {
    public readonly orderId: string;
    public readonly expiredAt: Date;

    constructor(orderId: string, expiredAt: number) {
        super(`Order ${orderId} expired at ${new Date(expiredAt * 1000).toISOString()}`);
        this.name = "OrderExpiredError";
        this.orderId = orderId;
        this.expiredAt = new Date(expiredAt * 1000);
        Object.setPrototypeOf(this, OrderExpiredError.prototype);
    }
}

/**
 * Thrown when slippage exceeds tolerance
 */
export class SlippageExceededError extends ZeroSlipError {
    public readonly expected: number;
    public readonly actual: number;
    public readonly maxSlippageBps: number;

    constructor(expected: number, actual: number, maxSlippageBps: number) {
        const actualSlippage = ((actual - expected) / expected) * 10000;
        super(
            `Slippage exceeded. Expected: ${expected}, Actual: ${actual}. ` +
            `Slippage: ${actualSlippage.toFixed(0)} bps, Max allowed: ${maxSlippageBps} bps`
        );
        this.name = "SlippageExceededError";
        this.expected = expected;
        this.actual = actual;
        this.maxSlippageBps = maxSlippageBps;
        Object.setPrototypeOf(this, SlippageExceededError.prototype);
    }
}

/**
 * Thrown when token is not found in config
 */
export class TokenNotFoundError extends ZeroSlipError {
    public readonly tokenName: string;
    public readonly availableTokens: string[];

    constructor(tokenName: string, availableTokens: string[]) {
        super(`Token "${tokenName}" not found. Available: ${availableTokens.join(", ")}`);
        this.name = "TokenNotFoundError";
        this.tokenName = tokenName;
        this.availableTokens = availableTokens;
        Object.setPrototypeOf(this, TokenNotFoundError.prototype);
    }
}

/**
 * Thrown when oracle feed is not found
 */
export class OracleFeedNotFoundError extends ZeroSlipError {
    public readonly feedName: string;
    public readonly availableFeeds: string[];

    constructor(feedName: string, availableFeeds: string[]) {
        super(`Oracle feed "${feedName}" not found. Available: ${availableFeeds.join(", ")}`);
        this.name = "OracleFeedNotFoundError";
        this.feedName = feedName;
        this.availableFeeds = availableFeeds;
        Object.setPrototypeOf(this, OracleFeedNotFoundError.prototype);
    }
}

/**
 * Thrown when program is not initialized
 */
export class ProgramNotInitializedError extends ZeroSlipError {
    constructor(programName: string) {
        super(`${programName} program not initialized. Call initializePrograms() first.`);
        this.name = "ProgramNotInitializedError";
        Object.setPrototypeOf(this, ProgramNotInitializedError.prototype);
    }
}

// ============================================================================
// ERROR PARSING
// ============================================================================

/**
 * Parse an Anchor/Solana error into a ZeroSlipError
 * 
 * @param error - The original error from Anchor/Solana
 * @returns A ZeroSlipError with a user-friendly message
 */
export function parseError(error: unknown): ZeroSlipError {
    if (error instanceof ZeroSlipError) {
        return error;
    }

    // Handle Anchor errors
    if (error && typeof error === "object" && "error" in error) {
        const anchorError = error as { error: { errorCode?: { code?: string; number?: number }; errorMessage?: string } };

        if (anchorError.error?.errorCode?.number) {
            const code = anchorError.error.errorCode.number as ZeroSlipErrorCode;
            const message = ERROR_MESSAGES[code] || anchorError.error.errorMessage || "Unknown error";
            return new ZeroSlipError(message, code, error instanceof Error ? error : undefined);
        }
    }

    // Handle errors with message
    if (error && typeof error === "object" && "message" in error) {
        const err = error as Error;

        // Check for specific Anchor error patterns
        const errorCodeMatch = err.message.match(/Error Code: (\w+)/);
        if (errorCodeMatch) {
            const codeName = errorCodeMatch[1];
            const code = ZeroSlipErrorCode[codeName as keyof typeof ZeroSlipErrorCode];
            if (code !== undefined) {
                return new ZeroSlipError(ERROR_MESSAGES[code], code, err);
            }
        }

        // Check for error number pattern
        const errorNumMatch = err.message.match(/custom program error: 0x([0-9a-fA-F]+)/);
        if (errorNumMatch) {
            const code = parseInt(errorNumMatch[1], 16) as ZeroSlipErrorCode;
            if (ERROR_MESSAGES[code]) {
                return new ZeroSlipError(ERROR_MESSAGES[code], code, err);
            }
        }

        // Check for account not found
        if (err.message.includes("Account does not exist")) {
            return new OrderNotFoundError(err.message);
        }

        // Check for insufficient funds
        if (err.message.includes("insufficient funds") || err.message.includes("0x1")) {
            return new ZeroSlipError("Insufficient SOL for transaction fees", undefined, err);
        }

        return new ZeroSlipError(err.message, undefined, err);
    }

    // Fallback
    return new ZeroSlipError(String(error));
}

/**
 * Check if an error is a specific ZeroSlip error code
 */
export function isErrorCode(error: unknown, code: ZeroSlipErrorCode): boolean {
    if (error instanceof ZeroSlipError) {
        return error.code === code;
    }
    return false;
}

/**
 * Get user-friendly message for an error code
 */
export function getErrorMessage(code: ZeroSlipErrorCode): string {
    return ERROR_MESSAGES[code] || "Unknown error";
}
