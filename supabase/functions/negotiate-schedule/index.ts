import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateRequiredFields, validateTimezone, validateLLMResponse, GuardrailViolationError } from "../_shared/validation-helpers.ts";
import { callGeminiWithRetry, handleLLMError } from "../_shared/error-recovery.ts";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { alert_id, user_id, timezone } = await req.json();

        // GUARDRAIL: Input validation (G3.7)
        validateRequiredFields({ alert_id, user_id }, ['alert_id', 'user_id']);
        const validatedTimezone = validateTimezone(timezone);

        logger.userAction('negotiator', 'generate-strategies', user_id, { alert_id, timezone: validatedTimezone });

        // 1. Fetch Alert Details
        const { data: alert, error: alertError } = await supabaseClient
            .from("schedule_alerts")
            .select("*")
            .eq("id", alert_id)
            .single();

        if (alertError || !alert) {
            logger.error('negotiator', 'Alert not found', alertError as Error, { alert_id });
            throw new Error("Alert not found");
        }

        // 2. Fetch Related Blocks (The Conflict)
        // GUARDRAIL: Handle orphaned block IDs (FM.6)
        let conflictingBlocks = [];
        if (alert.related_block_ids && alert.related_block_ids.length > 0) {
            const { data: blocks } = await supabaseClient
                .from("schedule_blocks")
                .select("*")
                .in("id", alert.related_block_ids);
            conflictingBlocks = blocks || [];

            if (conflictingBlocks.length === 0) {
                logger.warn('negotiator', 'Orphaned block IDs in alert', {
                    alert_id,
                    blockIds: alert.related_block_ids
                });
            }
        }

        logger.info('negotiator', 'Loaded conflict context', {
            alert_id,
            conflictingBlocksCount: conflictingBlocks.length
        });

        const formatTime = (dateStr: string) => {
            return new Date(dateStr).toLocaleTimeString('en-US', {
                timeZone: validatedTimezone,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        };

        // 3. Agentic Negotiation (Gemini)
        const prompt = `
      You are the Negotiator Agent for a daily schedule.
      A conflict has been detected: "${alert.message}"
      
      CONFLICTING BLOCKS:
      ${JSON.stringify(conflictingBlocks.map(b => ({
            title: b.title,
            start: formatTime(b.start_time),
            end: formatTime(b.end_time),
            type: b.block_type
        })))}
      
      YOUR GOAL:
      Propose EXACTLY 3 distinct strategies to resolve this conflict.
      - Strategy 1: The "Hard" Choice (e.g., Decline meeting, Cancel task).
      - Strategy 2: The "Compromise" (e.g., Shorten duration, Move to later).
      - Strategy 3: The "Reschedule" (e.g., Move conflicting block to tomorrow).
      
      OUTPUT JSON:
      {
        "strategies": [
          {
            "id": "strategy_1",
            "title": "Short Title (e.g. 'Move Deep Work')",
            "description": "One sentence explanation.",
            "impact": "High" | "Medium" | "Low",
            "action": "move" | "shorten" | "delete" | "split",
            "operations": [
              {
                "type": "move",
                "targetBlockId": "string (title of block to move)",
                "params": { "shiftMinutes": 30 }
              },
              {
                "type": "resize",
                "targetBlockId": "string (title of block to resize)",
                "params": { "durationMinutes": 60 }
              },
              {
                "type": "delete",
                "targetBlockId": "string (title of block to delete)"
              }
            ]
          },
          {
            "id": "strategy_2",
            ...
          },
          {
            "id": "strategy_3",
            ...
          }
        ]
      }
    `;

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            logger.error('negotiator', 'GEMINI_API_KEY not configured', null);
            throw new Error("GEMINI_API_KEY is not set");
        }

        // GUARDRAIL: Use retry logic (FM.1, FM.2, FM.3)
        const geminiData = await callGeminiWithRetry(
            GEMINI_API_KEY,
            'gemini-1.5-flash',
            prompt,
            {
                responseMimeType: 'application/json',
                agentName: 'negotiator'
            }
        );

        const generatedText = geminiData.candidates[0].content.parts[0].text;
        const result = JSON.parse(generatedText);

        // GUARDRAIL: Validate response structure (G3.1, GX.10)
        validateLLMResponse(result, {
            requiredFields: ['strategies'],
            arrayFields: [{ field: 'strategies', minLength: 3, maxLength: 3 }]
        });

        // Additional validation: Check each strategy has required fields
        for (const strategy of result.strategies) {
            if (!strategy.id || !strategy.title || !strategy.description || !strategy.impact || !strategy.action) {
                throw new GuardrailViolationError(
                    'Strategy missing required fields',
                    'INVALID_STRATEGY_STRUCTURE',
                    { strategy }
                );
            }
            // Ensure operations array exists (even if empty)
            if (!strategy.operations || !Array.isArray(strategy.operations)) {
                strategy.operations = [];
            }
        }

        logger.info('negotiator', 'Strategies generated successfully', {
            alert_id,
            strategyCount: result.strategies.length
        });

        return new Response(JSON.stringify({ success: true, strategies: result.strategies }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        logger.error('negotiator', 'Negotiation failed', error as Error);
        return handleLLMError(error, corsHeaders);
    }
});
