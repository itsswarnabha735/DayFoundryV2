/**
 * Error Recovery and Retry Logic for LLM API Calls
 * 
 * Implements exponential backoff and graceful degradation for agent LLM interactions
 */

import { LLMAPIError } from './validation-helpers.ts';
import { logger } from './logger.ts';

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

interface RetryConfig {
    maxRetries: number;
    baseDelay: number; // milliseconds
    maxDelay: number; // milliseconds
    timeoutMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    timeoutMs: 30000
};

// ============================================================================
// GEMINI API WRAPPER WITH RETRY
// ============================================================================

export async function callGeminiWithRetry(
    apiKey: string,
    model: string,
    prompt: string,
    options: {
        responseMimeType?: string;
        responseJsonSchema?: any; // New: Support for Structured Output schema
        thinkingConfig?: { thinkingLevel: "low" | "high" }; // New: Support for Gemini 3 Thinking
        agentName?: string;
        retryConfig?: Partial<RetryConfig>;
    } = {}
): Promise<any> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    const agentName = options.agentName || 'unknown';

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            logger.info(agentName, `LLM API call attempt ${attempt}/${config.maxRetries}`, {
                model,
                promptLength: prompt.length,
                thinkingLevel: options.thinkingConfig?.thinkingLevel,
                hasJsonSchema: !!options.responseJsonSchema
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

            // Construct Generation Config
            const generationConfig: any = {
                responseMimeType: options.responseMimeType || 'application/json'
            };

            // Add new optional configs if present
            if (options.responseJsonSchema) {
                generationConfig.responseMimeType = 'application/json'; // Strict schema implies JSON
                generationConfig.responseJsonSchema = options.responseJsonSchema;
            }
            if (options.thinkingConfig) {
                generationConfig.thinkingConfig = options.thinkingConfig;
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: generationConfig
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            // Handle HTTP errors
            if (!response.ok) {
                const errorText = await response.text();
                const isRetryable = response.status === 429 || response.status >= 500;

                logger.error(agentName, 'LLM API HTTP error', null, {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody: errorText,
                    attempt,
                    retryable: isRetryable
                });

                throw new LLMAPIError(
                    `Gemini API Error: ${response.status} - ${errorText}`,
                    response.status,
                    isRetryable,
                    { attempt, errorText }
                );
            }

            // Parse response
            const data = await response.json();

            // Validate response structure
            if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
                logger.error(agentName, 'Invalid LLM response structure', null, {
                    responseKeys: Object.keys(data),
                    attempt
                });
                throw new LLMAPIError(
                    'Invalid response structure from Gemini API',
                    500,
                    true,
                    { attempt, data }
                );
            }

            logger.info(agentName, 'LLM API call successful', {
                attempt,
                responseLength: data.candidates[0].content.parts[0].text.length
            });

            return data;

        } catch (error) {
            lastError = error as Error;

            // If it's an LLMAPIError and not retryable, fail immediately
            if (error instanceof LLMAPIError && !error.retryable) {
                logger.error(agentName, 'Non-retryable LLM error', error);
                throw error;
            }

            // If this was the last attempt, fail
            if (attempt === config.maxRetries) {
                logger.error(agentName, 'LLM retry limit exceeded', error, {
                    totalAttempts: attempt
                });
                break;
            }

            // Calculate backoff delay with exponential increase
            const delay = Math.min(
                config.baseDelay * Math.pow(2, attempt - 1),
                config.maxDelay
            );

            logger.warn(agentName, `LLM call failed, retrying in ${delay}ms`, {
                attempt,
                error: error.message,
                nextDelay: delay
            });

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // All retries exhausted
    throw lastError || new Error('LLM API call failed after all retries');
}

// ============================================================================
// ERROR RESPONSE HANDLERS
// ============================================================================

/**
 * Converts an LLM error into a user-friendly HTTP response
 */
export function handleLLMError(
    error: any,
    corsHeaders: Record<string, string>
): Response {
    if (error instanceof LLMAPIError) {
        let userMessage = 'AI service temporarily unavailable. Please try again.';
        let statusCode = 503;

        if (error.statusCode === 429) {
            userMessage = 'AI service is experiencing high demand. Please wait a moment and try again.';
            statusCode = 429;
        } else if (error.statusCode === 401 || error.statusCode === 403) {
            userMessage = 'AI service authentication error. Please contact support.';
            statusCode = 500; // Don't expose auth errors to user
        }

        return new Response(
            JSON.stringify({
                error: userMessage,
                code: 'LLM_SERVICE_ERROR',
                retryable: error.retryable
            }),
            {
                status: statusCode,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }

    // Generic error
    return new Response(
        JSON.stringify({
            error: 'An unexpected error occurred. Please try again.',
            code: 'INTERNAL_ERROR',
            retryable: true
        }),
        {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    );
}

/**
 * Creates a graceful degradation response when LLM is unavailable
 */
export function createFallbackResponse(
    agentName: string,
    fallbackData: any,
    corsHeaders: Record<string, string>
): Response {
    logger.warn(agentName, 'Using fallback response due to LLM unavailability', {
        fallbackData
    });

    return new Response(
        JSON.stringify({
            ...fallbackData,
            warning: 'AI service unavailable. Using simplified response.',
            fallback: true
        }),
        {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    );
}
