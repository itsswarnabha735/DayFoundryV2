import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateRequiredFields, validateTimezone } from "../_shared/validation-helpers.ts";
import { handleLLMError } from "../_shared/error-recovery.ts";
import { logger } from "../_shared/logger.ts";
import { getDayScheduleContext } from "../_shared/schedule-helper.ts";
import { runNegotiator } from "./logic.ts";

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

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            logger.error('negotiator', 'GEMINI_API_KEY not configured', null);
            throw new Error("GEMINI_API_KEY is not set");
        }

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
        }

        logger.info('negotiator', 'Loaded conflict context', { alert_id, conflictingBlocksCount: conflictingBlocks.length });

        // 3. Fetch Full Day Context (Shared Helper) - The "Board"
        // Use the date of the first conflicting block, or today if none
        let targetDate = new Date();
        if (conflictingBlocks.length > 0) {
            targetDate = new Date(conflictingBlocks[0].start_time);
        }

        const { userPrefs, freeSlots } = await getDayScheduleContext(
            supabaseClient,
            user_id,
            targetDate,
            validatedTimezone
        );

        const isProModel = (userPrefs as any)?.ai_preferences?.model === 'pro';
        const modelName = isProModel ? 'gemini-3.0-pro-preview' : 'gemini-2.0-flash-exp';

        logger.info('negotiator', `Using model: ${modelName}`, { isProModel });

        // 4. Agentic Negotiation (Extracted Logic)
        const result = await runNegotiator({
            alert,
            conflictingBlocks,
            freeSlots,
            userPrefs,
            timezone: validatedTimezone,
            geminiApiKey: GEMINI_API_KEY
        });

        logger.info('negotiator', 'Strategies generated successfully', {
            alert_id,
            strategyCount: result.strategies.length
        });

        // 5. Record Decision Context (Phase 2)
        try {
            const { recordDecision } = await import('../_shared/context-helper.ts');
            await recordDecision(
                supabaseClient,
                user_id,
                'negotiator',
                'conflict_resolution_generated',
                { alert_id, conflict_count: conflictingBlocks.length, timezone: validatedTimezone },
                result.strategies,
                null // No choice made yet
            );
        } catch (e) {
            logger.warn('negotiator', 'Failed to record context', e);
        }

        return new Response(JSON.stringify({ success: true, strategies: result.strategies }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        logger.error('negotiator', 'Negotiation failed', error as Error);
        return handleLLMError(error, corsHeaders);
    }
});
