import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateRequiredFields } from "../_shared/validation-helpers.ts";
import { handleLLMError } from "../_shared/error-recovery.ts";
import { logger } from "../_shared/logger.ts";
import { recordDecision } from "../_shared/context-helper.ts";
import { getDayScheduleContext } from "../_shared/schedule-helper.ts";
import { runGuardianCheck } from "./logic.ts";

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
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Use service role to access all data
        );

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            logger.error('guardian', 'GEMINI_API_KEY not configured', null);
            throw new Error("GEMINI_API_KEY is not set");
        }

        const payload = await req.json();
        let event_id, user_id;

        // Handle Webhook Payload (INSERT event)
        if (payload.type === 'INSERT' && payload.table === 'calendar_events' && payload.record) {
            event_id = payload.record.id;
            user_id = payload.record.user_id;
            logger.info('guardian', 'Triggered via Webhook', { event_id, user_id });
        } else {
            // Handle Direct Call
            event_id = payload.event_id;
            user_id = payload.user_id;
        }

        // GUARDRAIL: Input validation (G2.7)
        validateRequiredFields({ event_id, user_id }, ['event_id', 'user_id']);

        logger.userAction('guardian', 'conflict-check', user_id, { event_id });

        // 1. Fetch the new/updated event
        const { data: event, error: eventError } = await supabaseClient
            .from("calendar_events")
            .select("*")
            .eq("id", event_id)
            .single();

        // GUARDRAIL: Handle malformed events (FM.7)
        if (eventError || !event || !event.start_at || !event.end_at) {
            logger.warn('guardian', 'Malformed or missing event', {
                event_id,
                error: eventError?.message,
                hasEvent: !!event,
                hasStartAt: !!event?.start_at,
                hasEndAt: !!event?.end_at
            });
            return new Response(JSON.stringify({
                status: 'skipped',
                message: 'Event missing required fields'
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2. Fetch Full Day Context (Shared Helper)
        const eventDate = new Date(event.start_at);
        const { userPrefs, blocks } = await getDayScheduleContext(
            supabaseClient,
            user_id,
            eventDate,
            event.event_data?.start?.timeZone || 'Asia/Kolkata' // Fallback tz
        );

        const timezone = event.event_data?.start?.timeZone || userPrefs.timezone || 'Asia/Kolkata';

        // 3. Deterministic Conflict Check (using fresh shared context)
        const eventStart = new Date(event.start_at).getTime();
        const eventEnd = new Date(event.end_at).getTime();

        const conflictingBlocks = blocks?.filter(block => {
            const blockStart = new Date(block.start_time).getTime();
            const blockEnd = new Date(block.end_time).getTime();
            return (eventStart < blockEnd && eventEnd > blockStart);
        }) || [];

        // Also check if it conflicts with OTHER protected attributes (e.g. valid working hours?) = Future

        if (conflictingBlocks.length === 0) {
            logger.info('guardian', 'No conflicts detected', { event_id, event_title: event.title });
            return new Response(JSON.stringify({ status: "ok", conflicts: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        logger.info('guardian', 'Conflicts detected', {
            event_id,
            event_title: event.title,
            conflictCount: conflictingBlocks.length,
            conflictingBlockIds: conflictingBlocks.map(b => b.id)
        });

        // 4. Agentic Reasoning (Extracted Logic)
        const analysis = await runGuardianCheck({
            event,
            conflictingBlocks,
            userPrefs,
            timezone,
            geminiApiKey: GEMINI_API_KEY
        });

        // 5. Create Alert
        const { data: alertData, error: alertError } = await supabaseClient
            .from("schedule_alerts")
            .insert({
                user_id: user_id,
                type: analysis.type,
                message: analysis.message,
                related_block_ids: conflictingBlocks.map(b => b.id),
                status: 'pending',
                metadata: {
                    severity: analysis.severity, // Storing severity in metadata for now if column doesn't exist
                    recommended_action: analysis.recommendedAction
                }
            })
            .select('id')
            .single();

        if (alertError) throw alertError;

        // 6. Orchestration & Event Bus
        try {
            const { publishEvent } = await import('../_shared/event-publisher.ts');
            await publishEvent(
                supabaseClient,
                user_id,
                'schedule.conflict.detected',
                'guardian',
                {
                    alert_id: alertData.id,
                    conflict_type: analysis.type,
                    severity: analysis.severity,
                    related_blocks: conflictingBlocks.map(b => b.id),
                    auto_resolve_enabled: userPrefs?.auto_resolve_conflicts
                }
            );
            logger.info('guardian', 'Published conflict event to bus');
        } catch (e) {
            logger.error('guardian', 'Failed to publish event', e as Error);
        }

        // Record decision
        try {
            await recordDecision(
                supabaseClient,
                user_id,
                'guardian',
                'conflict_detected',
                {
                    alert_id: alertData.id,
                    severity: analysis.severity,
                    conflict_count: conflictingBlocks.length
                },
                null,
                null
            );
        } catch (e) { console.error(e); }

        logger.info('guardian', 'Alert created successfully', {
            event_id,
            alertType: analysis.type,
            severity: analysis.severity
        });

        return new Response(JSON.stringify({ success: true, alert: analysis }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        logger.error('guardian', 'Guardian check failed', error as Error);
        return handleLLMError(error, corsHeaders);
    }
});
