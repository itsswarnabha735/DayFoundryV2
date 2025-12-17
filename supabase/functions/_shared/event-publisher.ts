
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type AgentEventType =
    | 'calendar.event.synced'
    | 'schedule.conflict.detected'
    | 'schedule.conflict.resolved'
    | 'schedule.block.created'
    | 'schedule.block.modified'
    | 'errand.bundle.suggested'
    | 'errand.bundle.accepted'
    | 'compose.day.completed'
    | 'user.pattern.updated'
    | 'decision.recorded'
    | 'calendar.event.deleted';

export async function publishEvent(
    supabase: SupabaseClient,
    userId: string,
    eventType: AgentEventType,
    source: string,
    payload: Record<string, any>
): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('agent_events')
            .insert({
                user_id: userId,
                event_type: eventType,
                event_source: source,
                payload
            })
            .select('id')
            .single();

        if (error) {
            console.error(`Failed to publish event ${eventType}:`, error);
            return null; // Don't crash the agent if logging fails
        }
        return data.id;
    } catch (e) {
        console.error(`Exception publishing event ${eventType}:`, e);
        return null;
    }
}

export async function publishEventsBatch(
    supabase: SupabaseClient,
    events: {
        userId: string,
        eventType: AgentEventType,
        source: string,
        payload: Record<string, any>
    }[]
): Promise<number> {
    if (events.length === 0) return 0;

    try {
        const rows = events.map(e => ({
            user_id: e.userId,
            event_type: e.eventType,
            event_source: e.source,
            payload: e.payload
        }));

        const { error } = await supabase
            .from('agent_events')
            .insert(rows);

        if (error) {
            console.error(`Failed to publish batch of ${events.length} events:`, error);
            return 0;
        }
        return events.length;
    } catch (e) {
        console.error(`Exception publishing batch events:`, e);
        return 0;
    }
}

export async function markEventProcessed(
    supabase: SupabaseClient,
    eventId: string,
    processorName: string
): Promise<void> {
    // Uses a custom RPC or raw JSONB update. 
    // For simplicity without RPC, we can fetch, modify, update. 
    // Or closer to bare metal:

    // We'll use a safer approach: fetch current -> append -> update
    //Ideally this should be an RPC 'append_to_jsonb_array' for atomicity.

    // For Phase 3 MVP, we will assume single processor per cycle or accept slight race condition risk
    // Or better, define the RPC in the migration if possible.

    // Fallback: simple append via raw SQL if available, or just JS logic
    const { data } = await supabase.from('agent_events').select('processed_by').eq('id', eventId).single();
    if (data) {
        const current = data.processed_by || [];
        if (!current.includes(processorName)) {
            await supabase.from('agent_events').update({
                processed_by: [...current, processorName]
            }).eq('id', eventId);
        }
    }
}
