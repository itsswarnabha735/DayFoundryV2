import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateRequiredFields } from "../_shared/validation-helpers.ts";
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

        const payload = await req.json();
        const { trigger, context } = payload;

        // GUARDRAIL: Input validation
        validateRequiredFields({ trigger, context }, ['trigger', 'context']);
        validateRequiredFields(context, ['user_id']);

        logger.info('orchestrator', `Received trigger: ${trigger}`, {
            trigger,
            user_id: context.user_id
        });

        const results = {
            trigger,
            actions_taken: [] as string[],
            details: {} as any
        };

        // ROUTER LOGIC
        switch (trigger) {
            case 'conflict_detected':
                await handleConflictDetected(supabaseClient, context, results);
                break;

            case 'bundle_accepted':
                // Placeholder for Phase 1.3
                logger.info('orchestrator', 'Bundle accepted trigger received (not yet implemented)', context);
                break;

            default:
                logger.warn('orchestrator', `Unknown trigger: ${trigger}`, context);
                throw new Error(`Unknown trigger: ${trigger}`);
        }

        return new Response(JSON.stringify({ success: true, ...results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        logger.error('orchestrator', 'Orchestration failed', error as Error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

// HANDLERS

async function handleConflictDetected(supabase: any, payload: any, results: any) {
    // 1. Parse Inputs (Handle both direct call & Event Bus formats)
    const context = payload.context || payload.payload || payload;
    const { user_id, alert_id } = context;

    logger.info('orchestrator', 'Handling Conflict Detected', { user_id, alert_id });

    // 2. Check User Preferences (Auto-Resolve?)
    const { data: prefs, error: prefsError } = await supabase
        .from('user_preferences')
        .select('auto_resolve_conflicts, preferred_resolution_strategy, timezone')
        .eq('user_id', user_id)
        .single();

    if (prefsError || !prefs) {
        logger.warn('orchestrator', 'Could not fetch user prefs, skipping auto-resolve', prefsError);
        results.actions_taken.push('skipped_no_prefs');
        return;
    }

    if (!prefs.auto_resolve_conflicts) {
        logger.info('orchestrator', 'Auto-resolve disabled by user');

        // Create Proactive Suggestion for Manual Review
        await supabase.from('proactive_suggestions').insert({
            user_id,
            type: 'conflict_resolution',
            message: 'Scheduling conflict detected. Tap to resolve.',
            action_type: 'review_conflict',
            action_payload: { alert_id },
            status: 'pending'
        });

        results.actions_taken.push('created_suggestion');
        return;
    }

    // 3. Call Negotiator (Get Strategies)
    const negotiatorUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/negotiate-schedule`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    logger.info('orchestrator', 'Calling Negotiator for strategies...');

    // Pass necessary context to negotiator
    // Note: Negotiator expects { alert_id, user_id, timezone }
    const negResponse = await fetch(negotiatorUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({
            alert_id,
            user_id,
            timezone: prefs.timezone
        })
    });

    if (!negResponse.ok) {
        throw new Error(`Negotiator call failed: ${negResponse.status}`);
    }

    const { strategies } = await negResponse.json();

    // 4. Select Best Strategy
    const preferredStrategyKey = prefs.preferred_resolution_strategy || 'protect_focus';

    // Heuristic: Find strategy with matching ID or Title keywords
    let chosenStrategy = strategies.find((s: any) =>
        (s.id && s.id.includes(preferredStrategyKey)) ||
        (s.title && s.title.toLowerCase().includes(preferredStrategyKey.replace('_', ' ')))
    );

    // Fallback: Pick the one with 'Low' impact, or just the first one
    if (!chosenStrategy) {
        chosenStrategy = strategies.find((s: any) => s.impact === 'Low') || strategies[0];
    }

    if (!chosenStrategy) {
        throw new Error('No strategies returned from Negotiator');
    }

    logger.info('orchestrator', `Selected Strategy: ${chosenStrategy.title}`, { id: chosenStrategy.id });
    results.details.chosen_strategy = chosenStrategy.id;

    // 5. Apply Operations (The "Hands")
    if (chosenStrategy.operations) {
        for (const op of chosenStrategy.operations) {
            await applyOperation(supabase, op);
        }
        results.actions_taken.push('operations_applied');
    }

    // 6. Resolve Alert & Publish Event
    // Mark alert as resolved? (Optional, if table supports it)
    await supabase.from('schedule_alerts').update({ status: 'resolved' }).eq('id', alert_id);

    // Publish "Conflict Resolved"
    const { publishEvent } = await import('../_shared/event-publisher.ts');
    await publishEvent(
        supabase,
        user_id,
        'schedule.conflict.resolved',
        'agent-orchestrator',
        {
            original_alert_id: alert_id,
            strategy_applied: chosenStrategy.id,
            operations_count: chosenStrategy.operations?.length || 0
        }
    );
}

// HEAVY LIFTING: Apply Operations to DB
async function applyOperation(supabase: any, op: any) {
    const { type, targetBlockId, params } = op;

    if (!targetBlockId) {
        logger.warn('orchestrator', 'Skipping operation without targetBlockId', op);
        return;
    }

    // Fetch current block state (needed for move/resize logic)
    const { data: block } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('id', targetBlockId)
        .single();

    if (!block) {
        logger.warn('orchestrator', `Block not found for op: ${type}`, { targetBlockId });
        return;
    }

    if (type === 'delete') {
        await supabase.from('schedule_blocks').delete().eq('id', targetBlockId);
        logger.info('orchestrator', `Deleted block ${targetBlockId}`);

    } else if (type === 'move') {
        // Calculate new times
        const shiftMinutes = params?.shiftMinutes || 0;
        const start = new Date(block.start_time);
        const end = new Date(block.end_time);

        start.setMinutes(start.getMinutes() + shiftMinutes);
        end.setMinutes(end.getMinutes() + shiftMinutes);

        await supabase.from('schedule_blocks').update({
            start_time: start.toISOString(),
            end_time: end.toISOString()
        }).eq('id', targetBlockId);
        logger.info('orchestrator', `Moved block ${targetBlockId} by ${shiftMinutes}m`);

    } else if (type === 'resize') {
        // Calculate new end time
        const durationMinutes = params?.durationMinutes;
        if (durationMinutes) {
            const start = new Date(block.start_time);
            const newEnd = new Date(start.getTime() + durationMinutes * 60000);

            await supabase.from('schedule_blocks').update({
                end_time: newEnd.toISOString()
            }).eq('id', targetBlockId);
        }
    }
}
