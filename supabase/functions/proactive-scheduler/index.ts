import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        logger.info('proactive-scheduler', 'Starting check cycle');

        // 1. Fetch Users with Preferences (Active users)
        const { data: users, error: userError } = await supabase
            .from('user_preferences')
            .select('user_id, timezone');

        if (userError || !users) {
            throw userError || new Error('No users found');
        }

        let suggestionsCreated = 0;

        for (const user of users) {
            try {
                // Check 1: Morning Briefing
                const createdMorning = await checkMorningBriefing(supabase, user);
                if (createdMorning) suggestionsCreated++;

                // Check 2: Unsynced Calendar
                const createdSync = await checkUnsyncedCalendar(supabase, user);
                if (createdSync) suggestionsCreated++;
            } catch (e) {
                logger.error('proactive-scheduler', `Failed check for user ${user.user_id}`, e);
            }
        }

        logger.info('proactive-scheduler', 'Cycle complete', { suggestionsCreated });

        return new Response(JSON.stringify({ success: true, suggestionsCreated }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        logger.error('proactive-scheduler', 'Cycle failed', error as Error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});

async function checkMorningBriefing(supabase: any, user: any) {
    const { user_id, timezone } = user;
    const tz = timezone || 'UTC';

    // 1. Is it "Morning" for the user? (6 AM - 11 AM)
    const now = new Date();
    // Get hour in user's timezone
    const userHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }));

    // Debug: Force run for demo if needed, but strict logic is:
    const isMorning = userHour >= 6 && userHour <= 11;

    // For MVP verification/demo purposes, we might want to relax this or just log
    if (!isMorning) {
        // Uncomment to skip non-mornings
        // return false; 
    }

    // 2. Has the user planned today?
    const todayStart = new Date().toLocaleDateString('en-US', { timeZone: tz });
    // Format YYYY-MM-DD requires a bit more care with locales, 
    // simplified: Check blocks overlapping "now" or just blocks starting today.

    // Robust "Today" Range in User TZ
    const startOfDay = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const { count, error } = await supabase
        .from('schedule_blocks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

    if (error) throw error;

    if (count && count > 0) {
        // User has already planned
        return false;
    }

    // 3. Have we already suggested this today?
    const { count: suggestionCount } = await supabase
        .from('proactive_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('type', 'morning_briefing')
        .gte('created_at', startOfDay.toISOString()); // Created today

    if (suggestionCount && suggestionCount > 0) {
        return false;
    }

    // 4. Create Suggestion
    const { error: insertError } = await supabase
        .from('proactive_suggestions')
        .insert({
            user_id,
            type: 'morning_briefing',
            message: "Good morning! ☀️ Ready to plan your day?",
            action_type: 'compose_day',
            action_payload: {},
            status: 'pending'
        });

    if (insertError) throw insertError;

    logger.info('proactive-scheduler', `Created Morning Nudge for ${user_id}`);
    return true;
}

async function checkUnsyncedCalendar(supabase: any, user: any) {
    const { user_id, timezone } = user;
    const tz = timezone || 'UTC';

    // 1. Get Today's Range
    const now = new Date();
    const startOfDay = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Fetch Calendar Events for Today
    const { data: calendarEvents, error: calError } = await supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at')
        .eq('user_id', user_id)
        .gte('start_at', startOfDay.toISOString())
        .lte('start_at', endOfDay.toISOString());

    if (calError) {
        logger.error('proactive-scheduler', `Failed to fetch calendar events for ${user_id}`, calError);
        return false;
    }

    if (!calendarEvents || calendarEvents.length === 0) return false;

    // 3. Fetch Schedule Blocks for Today
    // We look for blocks that are LINKED to calendar events (assuming we store source_event_id or similar)
    // OR we can do a fuzzy match on time/title.
    // For MVP, let's assume if there are ANY blocks, we're likely okay, BUT better:
    // Check if there are "unaccounted" calendar events.

    // A simplistic "Unsynced" check:
    // If we have calendar events but ZERO schedule blocks, that's definitely unsynced.
    // Use the existing blocks query (or optimize to fetch together).
    const { data: scheduleBlocks, error: blockError } = await supabase
        .from('schedule_blocks')
        .select('id, start_time, end_time') // Simplified check
        .eq('user_id', user_id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

    if (blockError) return false;

    const blockCount = scheduleBlocks ? scheduleBlocks.length : 0;
    const eventCount = calendarEvents.length;

    // Trigger: If we have Events but NO Blocks, OR significantly fewer blocks than events (heuristic)
    // Let's stick to the "User probably forgot to import" case.
    if (eventCount > 0 && blockCount === 0) {

        // Check if we already nudged about this
        const { count: suggestionCount } = await supabase
            .from('proactive_suggestions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user_id)
            .eq('type', 'unsynced_calendar')
            .gte('created_at', startOfDay.toISOString());

        if (suggestionCount && suggestionCount > 0) return false;

        // Create Suggestion
        const { error: insertError } = await supabase
            .from('proactive_suggestions')
            .insert({
                user_id,
                type: 'unsynced_calendar',
                message: `You have ${eventCount} calendar events today not in your plan. Sync now?`,
                action_type: 'compose_day', // Opening compose will likely show them
                action_payload: { mode: 'import_calendar' }, // Hint to UI
                status: 'pending'
            });

        if (!insertError) {
            logger.info('proactive-scheduler', `Created Calendar Sync Nudge for ${user_id}`);
            return true;
        }
    }

    return false;
}
