// lib/server/services/groq.service.ts
import Groq from 'groq-sdk';
import { env } from '@/lib/server/config/env';

/**
 * Groq API Client for Intent Parsing
 * 
 * Uses Llama 3.1 70B for fast, accurate intent extraction.
 * Response times: ~100-200ms (10x faster than GPT-4)
 */

const groq = new Groq({
    apiKey: env.GROQ_API_KEY,
});

export interface GroqResponse {
    intentType: string;
    confidence: number;
    parameters: Record<string, unknown>;
    clarificationNeeded: string | null;
    humanReadableSummary: string | null;
}

/**
 * Call Groq API with a system prompt and user message
 * Returns parsed JSON response
 */
export async function callGroq(systemPrompt: string, userMessage: string): Promise<GroqResponse> {
    // Check if API key is configured
    if (!env.GROQ_API_KEY) {
        console.error('[Groq] GROQ_API_KEY is not configured');
        throw new Error('Groq API key is not configured. Please add GROQ_API_KEY to your .env file.');
    }

    try {
        console.log('[Groq] Calling API with model: llama-3.3-70b-versatile');

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1, // Low temp for consistent parsing
            max_tokens: 500,
        });

        const content = completion.choices[0].message.content || '{}';
        console.log('[Groq] Raw response:', content.substring(0, 200));

        return JSON.parse(content) as GroqResponse;
    } catch (error: unknown) {
        // Log detailed error information
        if (error instanceof Error) {
            console.error('[Groq] API call failed:', error.message);
            console.error('[Groq] Error stack:', error.stack);

            // Check for common error types
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                throw new Error('Groq API key is invalid. Please check your GROQ_API_KEY.');
            }
            if (error.message.includes('429') || error.message.includes('rate limit')) {
                throw new Error('Groq rate limit exceeded. Please try again later.');
            }
            if (error.message.includes('model')) {
                throw new Error('Groq model not available. Please check model name.');
            }
        }

        console.error('[Groq] Full error object:', error);
        throw new Error('Failed to parse intent with Groq');
    }
}

/**
 * Health check for Groq API
 */
export async function testGroqConnection(): Promise<boolean> {
    try {
        const result = await callGroq(
            "You are a test assistant. Respond with JSON: {\"status\": \"ok\"}",
            "Hello"
        );
        return result && typeof result === 'object';
    } catch {
        return false;
    }
}
