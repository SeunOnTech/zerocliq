// lib/types/intents.ts

/**
 * Intent Types for ZeroSlip Intelligence
 * 
 * These types define the structure of parsed intents from natural language.
 */

// Supported intent types
export type IntentType =
    | 'STREAMING_DCA'
    | 'TWAP_ORDER'
    | 'STREAMING_REPAYMENT'
    | 'INSURANCE_STREAM'
    | 'SUBSCRIPTION'
    | 'LIMIT_ORDER'
    | 'TRAILING_STOP'
    | 'UNKNOWN';

// Base intent structure
export interface BaseIntent {
    intentType: IntentType;
    confidence: number;
    clarificationNeeded: string | null;
    humanReadableSummary: string | null;
}

// Streaming DCA Parameters
export interface StreamingDCAParameters {
    sourceToken: string;
    sourceAmount: number;
    targetToken: string;
    durationSeconds: number;
    // Calculated field
    amountPerSecond?: number;
}

export interface StreamingDCAIntent extends BaseIntent {
    intentType: 'STREAMING_DCA';
    parameters: StreamingDCAParameters;
}

// TWAP Order Parameters
export interface TWAPOrderParameters {
    action: 'BUY' | 'SELL';
    token: string;
    amount: number;
    targetToken?: string;
    durationSeconds: number;
    // Calculated field
    amountPerSecond?: number;
}

export interface TWAPOrderIntent extends BaseIntent {
    intentType: 'TWAP_ORDER';
    parameters: TWAPOrderParameters;
}

// Streaming Repayment Parameters
export interface StreamingRepaymentParameters {
    token: string;
    totalAmount: number;
    dailyAmount?: number;
    durationSeconds?: number;
    // Calculated field
    amountPerSecond?: number;
}

export interface StreamingRepaymentIntent extends BaseIntent {
    intentType: 'STREAMING_REPAYMENT';
    parameters: StreamingRepaymentParameters;
}

// Limit Order Parameters
export interface LimitOrderParameters {
    action: 'BUY' | 'SELL';
    token: string;
    amount: number;
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    sourceToken?: string;
}

export interface LimitOrderIntent extends BaseIntent {
    intentType: 'LIMIT_ORDER';
    parameters: LimitOrderParameters;
}

// Trailing Stop Parameters
export interface TrailingStopParameters {
    token: string;
    amount: number;
    trailPercent: number;
    targetToken?: string;
}

export interface TrailingStopIntent extends BaseIntent {
    intentType: 'TRAILING_STOP';
    parameters: TrailingStopParameters;
}

// Unknown Intent
export interface UnknownIntent extends BaseIntent {
    intentType: 'UNKNOWN';
    parameters: Record<string, unknown>;
}

// Union of all intent types
export type ParsedIntent =
    | StreamingDCAIntent
    | TWAPOrderIntent
    | StreamingRepaymentIntent
    | LimitOrderIntent
    | TrailingStopIntent
    | UnknownIntent;

// Context passed to the intent parser
export interface IntentParserContext {
    walletAddress: string;
    chainId: number;
    balances?: Record<string, number>;
    prices?: Record<string, number>;
}
