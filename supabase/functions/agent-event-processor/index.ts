
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { markEventProcessed, AgentEventType } from "../_shared/event-publisher.ts";
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
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        logger.info('event-processor', 'Starting event processing cycle');

        // 1. Fetch unprocessed events (limit 50 to prevent timeouts)
        // We filter for NOT (processed_by ? 'all') - meaning not fully processed
        // For MVP, we just check generic pending.
        const { data: pendingEvents, error } = await supabase
            .from('agent_events')
            .select('*')
            // Filter out events that are fully processed
            .not('processed_by', 'cs', '["all"]')
            .order('created_at', { ascending: true })
            .limit(20);

        if (error) throw error;

        if (!pendingEvents || pendingEvents.length === 0) {
            logger.info('event-processor', 'No pending events found');
            return new Response(JSON.stringify({ processed: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        let processedCount = 0;

        // 2. Define Subscriptions
        const subscriptions: Record<AgentEventType, string[]> = {
            'calendar.event.synced': ['guardian'], // Guardian checks for conflicts
            'calendar.event.deleted': [], // No action needed for deletions currently
            'schedule.conflict.detected': ['negotiator'], // Negotiator solves conflicts (if auto-resolve)
            'schedule.conflict.resolved': ['compose'], // Compose re-optimizes
            'errand.bundle.accepted': ['compose'], // Compose blocks time
            'compose.day.completed': [], // Maybe 'bundler' in future
            'schedule.block.created': [],
            'schedule.block.modified': [],
            'errand.bundle.suggested': [],
            'user.pattern.updated': [],
            'decision.recorded': []
        };

        // 3. Process Events
        for (const event of pendingEvents) {
            const subscribers = subscriptions[event.event_type as AgentEventType] || [];

            // If no subscribers, just mark as 'all' processed (handled)
            if (subscribers.length === 0) {
                await markEventProcessed(supabase, event.id, 'all');
                continue;
            }

            const processedBy = (event.processed_by as string[]) || [];

            // Check if all subscribers have already processed this event
            const allProcessed = subscribers.every(sub => processedBy.includes(sub));
            if (allProcessed) {
                // Mark as fully processed so it won't be fetched again
                await markEventProcessed(supabase, event.id, 'all');
                continue;
            }

            for (const agentName of subscribers) {
                if (processedBy.includes(agentName)) continue;

                logger.info('event-processor', `Routing event ${event.event_type} to ${agentName}`, { event_id: event.id });

                try {
                    // Route to Agent
                    await triggerAgent(agentName, event, supabaseUrl, supabaseServiceKey, supabase);

                    // Mark as processed by this agent
                    await markEventProcessed(supabase, event.id, agentName);

                    // Update local processedBy array for the next check
                    processedBy.push(agentName);
                } catch (e) {
                    logger.error('event-processor', `Failed to trigger ${agentName}`, e);
                }
            }

            // After processing, check if all subscribers are now done
            const nowAllProcessed = subscribers.every(sub => processedBy.includes(sub));
            if (nowAllProcessed) {
                await markEventProcessed(supabase, event.id, 'all');
            }

            processedCount++;
        }

        return new Response(JSON.stringify({ success: true, processed: processedCount }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        logger.error('event-processor', 'Cycle failed', error as Error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});

async function triggerAgent(agentName: string, event: any, url: string, key: string, supabase: any) {
    let endpoint = '';
    let payload = {};

    switch (agentName) {
        case 'guardian':
            endpoint = `${url}/functions/v1/guardian-check`;
            // Guardian expects event_id (database UUID) and user_id
            // The event.payload.event_id is Google's external_id, we need to translate it
            if (event.event_type === 'calendar.event.synced') {
                // Look up the database UUID from the external_id
                const { data: calEvent, error: lookupError } = await supabase
                    .from('calendar_events')
                    .select('id')
                    .eq('external_id', event.payload.event_id)
                    .eq('user_id', event.user_id)
                    .single();

                if (lookupError || !calEvent) {
                    logger.warn('event-processor', 'Could not find calendar_event by external_id', {
                        external_id: event.payload.event_id,
                        user_id: event.user_id,
                        error: lookupError?.message
                    });
                    return; // Skip this event if we can't find the DB record
                }

                payload = {
                    event_id: calEvent.id, // Use database UUID
                    user_id: event.user_id
                };

                logger.info('event-processor', 'Translated external_id to DB UUID for Guardian', {
                    external_id: event.payload.event_id,
                    db_id: calEvent.id
                });
            }
            break;

        case 'negotiator':
            // Only if auto-resolve is enabled? 
            // Logic currently in Agent Orchestrator. 
            // Actually, we should trigger 'agent-orchestrator' if the event is conflict detected.
            // But existing subscriptions map says 'negotiator'. 
            // Let's route to 'agent-orchestrator' instead for complex logic?
            // Or keep it simple: The Orchestrator IS the processor logic here or a separate function?
            // In Phase 1 we built `agent-orchestrator`. Let's trigger THAT if it exists.
            endpoint = `${url}/functions/v1/agent-orchestrator`;
            payload = {
                trigger: 'conflict_detected',
                payload: {
                    alert_id: event.payload.alert_id,
                    user_id: event.user_id
                }
            };
            break;

        case 'compose':
            // Logic for triggering compose-day?
            // Usually requested by current date.
            // Placeholder for now.
            return;
    }

    if (endpoint) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Agent ${agentName} responded with ${response.status}`);
        }
    }
}
