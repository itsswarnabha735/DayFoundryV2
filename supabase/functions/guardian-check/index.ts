import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateRequiredFields, validateTimezone } from "../_shared/validation-helpers.ts";
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
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Use service role to access all data
        );

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

        // 2. Fetch existing schedule blocks for that day
        const startOfDay = new Date(event.start_at);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(event.start_at);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: blocks, error: blocksError } = await supabaseClient
            .from("schedule_blocks")
            .select("*")
            .eq("user_id", user_id)
            .gte("start_time", startOfDay.toISOString())
            .lte("end_time", endOfDay.toISOString());

        if (blocksError) throw blocksError;

        // 3. Deterministic Conflict Check
        const eventStart = new Date(event.start_at).getTime();
        const eventEnd = new Date(event.end_at).getTime();

        const conflictingBlocks = blocks?.filter(block => {
            const blockStart = new Date(block.start_time).getTime();
            const blockEnd = new Date(block.end_time).getTime();
            return (eventStart < blockEnd && eventEnd > blockStart);
        }) || [];

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

        // 4. Agentic Reasoning (Gemini)
        // GUARDRAIL: Timezone validation (G2.3, GX.1)
        const eventTimezone = validateTimezone(
            event.event_data?.start?.timeZone || 'Asia/Kolkata'
        );

        const formatTime = (dateStr: string) => {
            return new Date(dateStr).toLocaleTimeString('en-US', {
                timeZone: eventTimezone,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        };

        const prompt = `
      You are the Guardian Agent for a daily schedule.
      A new calendar event has just been added that conflicts with existing planned blocks.
      
      NEW EVENT:
      Title: ${event.title}
      Time: ${formatTime(event.start_at)} - ${formatTime(event.end_at)}
      
      CONFLICTING BLOCKS:
      ${JSON.stringify(conflictingBlocks.map(b => ({
            title: b.title,
            type: b.block_type,
            start: formatTime(b.start_time),
            end: formatTime(b.end_time)
        })))}
      
      YOUR GOAL:
      Analyze the situation and generate a helpful alert for the user.
      - If the new event clashes with "Deep Work", warn them about focus loss.
      - If it clashes with a "Break", suggest moving the break.
      - Be concise and helpful (max 2 sentences).
      
      OUTPUT JSON:
      {
        "type": "conflict" | "warning",
        "message": "Short user-facing message."
      }
    `;

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            logger.error('guardian', 'GEMINI_API_KEY not configured', null);
            throw new Error("GEMINI_API_KEY is not set");
        }

        // GUARDRAIL: Use retry logic (FM.1, FM.2, FM.3)
        const geminiData = await callGeminiWithRetry(
            GEMINI_API_KEY,
            'gemini-1.5-flash',
            prompt,
            {
                responseMimeType: 'application/json',
                agentName: 'guardian'
            }
        );

        const generatedText = geminiData.candidates[0].content.parts[0].text;
        const analysis = JSON.parse(generatedText);

        //  GUARDRAIL: Validate alert type (G2.9, GX.10)
        if (!['conflict', 'warning'].includes(analysis.type)) {
            logger.warn('guardian', 'Invalid alert type from LLM', {
                receivedType: analysis.type,
                defaultingTo: 'warning'
            });
            analysis.type = 'warning';
        }

        // 5. Create Alert
        const { error: alertError } = await supabaseClient
            .from("schedule_alerts")
            .insert({
                user_id: user_id,
                type: analysis.type,
                message: analysis.message,
                related_block_ids: conflictingBlocks.map(b => b.id),
                status: 'pending'
            });

        if (alertError) throw alertError;

        logger.info('guardian', 'Alert created successfully', {
            event_id,
            alertType: analysis.type,
            conflictCount: conflictingBlocks.length
        });

        return new Response(JSON.stringify({ success: true, alert: analysis }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        logger.error('guardian', 'Guardian check failed', error as Error);
        return handleLLMError(error, corsHeaders);
    }
});
