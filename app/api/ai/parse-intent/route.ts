// app/api/ai/parse-intent/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { callGroq } from '@/lib/server/services/groq.service';
import { getDCAIntentPrompt } from '@/lib/server/prompts/dca-intent.prompt';
import type { ParsedIntent, StreamingDCAIntent } from '@/lib/types/intents';

/**
 * POST /api/ai/parse-intent
 * 
 * Parse natural language into a structured DeFi intent.
 * 
 * Request body:
 * {
 *   message: string;        // User's natural language input
 *   walletAddress?: string; // Optional wallet context
 *   chainId?: number;       // Optional chain context
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   intent?: ParsedIntent;
 *   error?: string;
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, walletAddress, chainId } = body;

        if (!message || typeof message !== 'string') {
            return NextResponse.json({
                success: false,
                error: 'Message is required'
            }, { status: 400 });
        }

        console.log('[AI] Parsing intent:', { message, walletAddress, chainId });

        // Get the DCA prompt (we'll expand to other intents later)
        const systemPrompt = getDCAIntentPrompt();

        // Call Groq for intent parsing
        const startTime = Date.now();
        const result = await callGroq(systemPrompt, message);
        const duration = Date.now() - startTime;

        console.log('[AI] Groq response in', duration, 'ms:', result);

        // Validate and enrich the intent
        const intent = enrichIntent(result as ParsedIntent);

        return NextResponse.json({
            success: true,
            intent,
            metadata: {
                parseTimeMs: duration,
                model: 'llama-3.1-70b-versatile'
            }
        });

    } catch (error) {
        console.error('[AI] Parse intent error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse intent'
        }, { status: 500 });
    }
}

/**
 * Enrich the parsed intent with calculated fields
 */
function enrichIntent(intent: ParsedIntent): ParsedIntent {
    // Calculate amountPerSecond for streaming intents
    if (intent.intentType === 'STREAMING_DCA') {
        const dcaIntent = intent as StreamingDCAIntent;
        const { sourceAmount, durationSeconds } = dcaIntent.parameters;

        if (sourceAmount && durationSeconds) {
            dcaIntent.parameters.amountPerSecond = sourceAmount / durationSeconds;
        }
    }

    return intent;
}
