import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateTimezone } from "./validation-helpers.ts";

export interface DayContext {
    userPrefs: any;
    events: any[];
    blocks: any[];
    freeSlots: Array<{ start: string; end: string; durationMinutes: number }>;
}

export async function getDayScheduleContext(
    supabase: SupabaseClient,
    userId: string,
    targetDate: Date,
    timezone: string
): Promise<DayContext> {
    const validTz = validateTimezone(timezone);

    // 1. Calculate Day Boundaries in User's Timezone
    // We want 00:00 to 23:59 in the *user's* timezone, converted to UTC for DB queries
    // BUT since we store ISOS with timezone, we can just query a wide range and filter in memory for accuracy
    // or use exact ISO strings if we trust the input date is correct.
    // For safety, let's grab -12h to +36h to capture everything relevant.
    const queryStart = new Date(targetDate);
    queryStart.setHours(queryStart.getHours() - 12);
    const queryEnd = new Date(targetDate);
    queryEnd.setHours(queryEnd.getHours() + 36);

    // 2. Parallel Fetch: Prefs, Events, Blocks
    const [prefsResult, eventsResult, blocksResult] = await Promise.all([
        supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
        supabase.from('calendar_events')
            .select('*')
            .gte('start_at', queryStart.toISOString())
            .lte('end_at', queryEnd.toISOString()),
        supabase.from('schedule_blocks')
            .select('*')
            .eq('user_id', userId)
            .gte('start_time', queryStart.toISOString())
            .lte('end_time', queryEnd.toISOString())
    ]);

    // 3. Process Preferences
    const userPrefs = prefsResult.data || {
        working_hours_start: '09:00',
        working_hours_end: '17:00',
        conflict_resolution_style: 'balanced',
        ai_preferences: { model: 'standard' }
    };

    // 4. Filter & Sort Items for the Specific Day
    const isSameDay = (isoString: string) => {
        const d = new Date(isoString).toLocaleDateString('en-US', { timeZone: validTz });
        const t = targetDate.toLocaleDateString('en-US', { timeZone: validTz });
        return d === t;
    };

    const events = (eventsResult.data || []).filter(e => isSameDay(e.start_at));
    const blocks = (blocksResult.data || []).filter(b => isSameDay(b.start_time));

    // 5. Calculate Free Slots (Tetris logic)
    // Combine all busy intervals
    const busyIntervals = [
        ...events.map(e => ({ start: new Date(e.start_at).getTime(), end: new Date(e.end_at).getTime() })),
        ...blocks.map(b => ({ start: new Date(b.start_time).getTime(), end: new Date(b.end_time).getTime() }))
    ].sort((a, b) => a.start - b.start);

    // Merge overlapping intervals
    const mergedBusy = [];
    if (busyIntervals.length > 0) {
        let current = busyIntervals[0];
        for (let i = 1; i < busyIntervals.length; i++) {
            const next = busyIntervals[i];
            if (current.end >= next.start) {
                current.end = Math.max(current.end, next.end);
            } else {
                mergedBusy.push(current);
                current = next;
            }
        }
        mergedBusy.push(current);
    }

    // Define Day Start/End (e.g., 08:00 to 22:00 or stricter Working Hours?)
    // For free slots, we usually care about the *whole* workable day.
    // Let's assume 06:00 to 23:00 to be safe, or parse working hours.
    // Let's use Working Hours + Buffer (e.g. start-2h, end+4h)
    const dayStart = new Date(targetDate);
    const [whStartH, whStartM] = (userPrefs.working_hours_start || '09:00').split(':');
    dayStart.setHours(parseInt(whStartH), parseInt(whStartM), 0, 0); // Working Start

    const dayEnd = new Date(targetDate);
    const [whEndH, whEndM] = (userPrefs.working_hours_end || '17:00').split(':');
    dayEnd.setHours(parseInt(whEndH), parseInt(whEndM), 0, 0); // Working End

    // Adjust to "Available Day" -> Maybe 7am to 10pm?
    // For now, let's limit "Free Slots" to Working Hours to encourage work-life balance,
    // unless there are explicit blocks outside it.
    // actually, let's output slots for the full 24h of that day date, but maybe flag them?
    // Let's stick to 00:00 - 23:59 of the target date for simplicity of "Day".
    const dayStartAbsolute = new Date(targetDate);
    dayStartAbsolute.setHours(0, 0, 0, 0);
    const dayEndAbsolute = new Date(targetDate);
    dayEndAbsolute.setHours(23, 59, 59, 999);

    const startMs = dayStartAbsolute.getTime();
    const endMs = dayEndAbsolute.getTime();
    const freeSlots = [];

    let cursor = startMs;
    for (const busy of mergedBusy) {
        if (busy.start > cursor) {
            freeSlots.push({
                start: new Date(cursor).toISOString(),
                end: new Date(busy.start).toISOString(),
                durationMinutes: Math.round((busy.start - cursor) / 60000)
            });
        }
        cursor = Math.max(cursor, busy.end);
    }
    if (cursor < endMs) {
        freeSlots.push({
            start: new Date(cursor).toISOString(),
            end: new Date(endMs).toISOString(),
            durationMinutes: Math.round((endMs - cursor) / 60000)
        });
    }

    return {
        userPrefs,
        events,
        blocks,
        freeSlots: freeSlots.filter(s => s.durationMinutes >= 15) // Filter tiny gaps
    };
}
