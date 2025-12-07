import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
    validateDateString,
    validateTimezone,
    timeToMinutes,
    hasOverlap,
    isValidTimeOnDate,
    validateLLMResponse
} from "../_shared/validation-helpers.ts";
import { callGeminiWithRetry, handleLLMError } from "../_shared/error-recovery.ts";
import { logger, PerformanceTimer } from "../_shared/logger.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const timer = new PerformanceTimer('compose-day', 'full-execution');

        // 1. Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        // 2. Parse and Validate Request Body
        const { date, constraints } = await req.json();
        const targetDate = date ? validateDateString(date) : new Date();
        const timezone = validateTimezone(constraints?.timezone);

        logger.userAction('compose-day', 'schedule-generation-requested',
            'user-from-auth', { date: targetDate.toISOString(), timezone });

        // Format date for DB queries (start/end of day)
        // CRITICAL FIX: Fetch a wider range (-24h to +48h) to account for timezone differences.
        // We will filter strictly in memory.
        const queryStart = new Date(targetDate);
        queryStart.setHours(queryStart.getHours() - 24);
        const queryEnd = new Date(targetDate);
        queryEnd.setHours(queryEnd.getHours() + 48);

        logger.info('compose-day', `Composing schedule for ${targetDate.toDateString()}`, {
            timezone,
            queryRange: {
                start: queryStart.toISOString(),
                end: queryEnd.toISOString()
            }
        });

        // 3. Aggregate Data (Tasks & Events)

        // Fetch Unfinished Tasks
        const { data: allTasks, error: tasksError } = await supabaseClient
            .from("tasks")
            .select("*")
            .is("deleted_at", null);

        if (tasksError) throw tasksError;

        // Filter out completed tasks (if all steps are checked)
        const tasks = allTasks?.filter((t: any) => {
            if (!t.steps || !Array.isArray(t.steps) || t.steps.length === 0) return true; // No steps = active
            return !t.steps.every((s: any) => s.completed);
        }) || [];

        // GUARDRAIL: Handle empty tasks case (EC.4)
        if (tasks.length === 0) {
            logger.info('compose-day', 'No tasks to schedule', {
                date: targetDate.toISOString(),
                totalTasksFetched: allTasks?.length || 0
            });
            timer.end({ tasksScheduled: 0, blocksCreated: 0 });
            return new Response(JSON.stringify({
                success: true,
                optimizedBlocks: [],
                reasoning: 'No incomplete tasks to schedule for this day.'
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Fetch Calendar Events for the day (Wider Range)
        const { data: rawEvents, error: eventsError } = await supabaseClient
            .from("calendar_events")
            .select("*")
            .gte("start_at", queryStart.toISOString())
            .lte("end_at", queryEnd.toISOString());

        if (eventsError) throw eventsError;

        // Filter events to strictly match the User's Local Day
        const events = rawEvents?.filter(e => {
            const eventDate = new Date(e.start_at).toLocaleDateString('en-US', { timeZone: timezone });
            const targetDateStr = targetDate.toLocaleDateString('en-US', { timeZone: timezone });
            return eventDate === targetDateStr;
        }) || [];

        logger.info('compose-day', 'Filtered events for target day', {
            rawEventsFetched: rawEvents?.length || 0,
            eventsAfterFiltering: events.length,
            timezone
        });

        // Fetch User Preferences from database
        const { data: userData } = await supabaseClient.auth.getUser();
        const userId = userData?.user?.id;

        let userPrefs = {
            working_hours_start: constraints?.workingHours?.start || '09:00',
            working_hours_end: constraints?.workingHours?.end || '17:00',
            break_duration: 15,
            break_frequency: 90,
            interruption_budget: 3,
            no_meeting_windows: [] as Array<{ start: string; end: string; label: string }>,
            conflict_resolution_style: 'balanced' as string,
            timezone: timezone
        };

        if (userId) {
            const { data: prefsData, error: prefsError } = await supabaseClient
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!prefsError && prefsData) {
                userPrefs = {
                    working_hours_start: prefsData.working_hours_start || userPrefs.working_hours_start,
                    working_hours_end: prefsData.working_hours_end || userPrefs.working_hours_end,
                    break_duration: prefsData.break_duration ?? userPrefs.break_duration,
                    break_frequency: prefsData.break_frequency ?? userPrefs.break_frequency,
                    interruption_budget: prefsData.interruption_budget ?? userPrefs.interruption_budget,
                    no_meeting_windows: prefsData.no_meeting_windows || userPrefs.no_meeting_windows,
                    conflict_resolution_style: prefsData.conflict_resolution_style || userPrefs.conflict_resolution_style,
                    timezone: prefsData.timezone || userPrefs.timezone
                };
                logger.info('compose-day', 'Loaded user preferences', {
                    workingHours: `${userPrefs.working_hours_start}-${userPrefs.working_hours_end}`,
                    breakSettings: { duration: userPrefs.break_duration, frequency: userPrefs.break_frequency },
                    noMeetingWindows: userPrefs.no_meeting_windows.length
                });
            }
        }

        // Format no-meeting windows for the prompt
        const noMeetingWindowsStr = userPrefs.no_meeting_windows.length > 0
            ? userPrefs.no_meeting_windows.map(w => `${w.start} - ${w.end}: PROTECTED "${w.label}"`).join('\n      ')
            : 'None';


        // 4. Construct Prompt for Gemini with clear blocked time ranges
        const blockedTimeRanges = events?.map(e => {
            const start = new Date(e.start_at).toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true });
            const end = new Date(e.end_at).toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true });
            return `${start} - ${end}: BLOCKED by "${e.title}"`;
        }).join('\n      ') || 'None';

        const prompt = `
      You are an expert Chief of Staff and Daily Planner. Your goal is to create the optimal daily schedule for the user.
      
      CURRENT CONTEXT:
      - Date: ${targetDate.toDateString()}
      - Working Hours: ${userPrefs.working_hours_start} to ${userPrefs.working_hours_end}
      - Energy Profile: ${constraints?.energyPreference || "Standard (High energy 9AM-12PM)"}
      - Conflict Resolution Style: ${userPrefs.conflict_resolution_style} (${userPrefs.conflict_resolution_style === 'aggressive' ? 'prioritize deadlines, reschedule freely' : userPrefs.conflict_resolution_style === 'conservative' ? 'minimize schedule changes' : 'balance deadlines with comfort'})
      
      USER BREAK PREFERENCES:
      - Break Duration: ${userPrefs.break_duration} minutes
      - Break Frequency: Every ${userPrefs.break_frequency} minutes of work
      - Max Daily Interruptions: ${userPrefs.interruption_budget}
      
      ⚠️ CRITICAL - BLOCKED TIME RANGES (DO NOT SCHEDULE ANYTHING DURING THESE TIMES):
      ${blockedTimeRanges}
      
      ${noMeetingWindowsStr !== 'None' ? `⚠️ PROTECTED FOCUS WINDOWS (Schedule only deep work here, avoid meetings/interruptions):
      ${noMeetingWindowsStr}` : ''}

      TASKS TO SCHEDULE (Prioritize High Priority):
      ${JSON.stringify(tasks?.map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            estimatedDuration: t.estimated_duration || 30
        })), null, 2)}

      INSTRUCTIONS:
      1. **CRITICAL**: You MUST NOT schedule any tasks during the BLOCKED time ranges listed above.
      2. During PROTECTED FOCUS WINDOWS, only schedule deep work tasks - no meetings or admin.
      3. Schedule high-priority tasks during high-energy periods (usually morning).
      4. Group similar tasks (e.g., admin) into blocks to avoid context switching.
      5. Add scheduled breaks: ${userPrefs.break_duration}-minute breaks every ${userPrefs.break_frequency} minutes.
      6. Ensure deep work blocks are at least 60 mins.
      7. If tasks don't fit, prioritize P0/P1 and leave P2/P3 for a "Bonus" block or omit them.
      8. Use 24-hour format for times (e.g., "14:00" not "2:00 PM").

      OUTPUT FORMAT:
      Return a valid JSON object with this structure:
      {
        "schedule": [
          {
            "title": "Task Name",
            "startTime": "HH:MM",
            "endTime": "HH:MM",
            "type": "deep" | "meeting" | "admin" | "break" | "buffer",
            "taskId": "uuid (optional)",
            "reason": "Why this time?"
          }
        ],
        "reasoning": "A short paragraph explaining your strategy for the day."
      }
      Do not include markdown formatting (like \`\`\`json). Just the raw JSON.
    `;

        // 5. Call Gemini API with Retry Logic
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            logger.error('compose-day', 'GEMINI_API_KEY not configured', null);
            throw new Error("GEMINI_API_KEY is not set");
        }

        const geminiData = await callGeminiWithRetry(
            GEMINI_API_KEY,
            'gemini-2.0-flash-exp',
            prompt,
            {
                responseMimeType: 'application/json',
                agentName: 'compose-day'
            }
        );

        const generatedText = geminiData.candidates[0].content.parts[0].text;

        let parsedResult;
        try {
            parsedResult = JSON.parse(generatedText);
        } catch (e) {
            logger.error('compose-day', 'Failed to parse LLM JSON response', e as Error, {
                responsePreview: generatedText.substring(0, 200)
            });
            throw new Error("Failed to parse AI response");
        }

        // GUARDRAIL: Validate LLM response structure (GX.9, GX.10)
        validateLLMResponse(parsedResult, {
            requiredFields: ['schedule', 'reasoning'],
            arrayFields: [{ field: 'schedule', minLength: 0 }]
        });

        // 6. VALIDATION: Filter out any blocks that conflict with calendar events
        const validatedSchedule = parsedResult.schedule.filter((block: any) => {
            const blockStartMin = timeToMinutes(block.startTime);
            const blockEndMin = timeToMinutes(block.endTime);

            // GUARDRAIL: Check DST validity (EC.1)
            if (!isValidTimeOnDate(targetDate, blockStartMin, timezone)) {
                logger.validation('compose-day', 'filter-block', 'Invalid DST time', {
                    block: block.title,
                    time: `${block.startTime}-${block.endTime}`
                });
                return false;
            }

            // Check against all calendar events
            for (const event of (events || [])) {
                const eventStartDate = new Date(event.start_at);
                const eventEndDate = new Date(event.end_at);

                // Convert event times to minutes in the user's timezone
                // Force 24-hour format for parsing
                const eventStartHour = parseInt(eventStartDate.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }));
                const eventStartMinute = parseInt(eventStartDate.toLocaleTimeString('en-US', { timeZone: timezone, minute: '2-digit' }));
                const eventEndHour = parseInt(eventEndDate.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }));
                const eventEndMinute = parseInt(eventEndDate.toLocaleTimeString('en-US', { timeZone: timezone, minute: '2-digit' }));

                const eventStartMin = eventStartHour * 60 + eventStartMinute;
                const eventEndMin = eventEndHour * 60 + eventEndMinute;

                // GUARDRAIL: Handle all-day events (G1.3)
                if (event.all_day) {
                    if (hasOverlap(blockStartMin, blockEndMin, 0, 1440)) {
                        logger.validation('compose-day', 'filter-block', 'Overlaps all-day event', {
                            block: block.title,
                            event: event.title
                        });
                        return false;
                    }
                }

                // GUARDRAIL: Check event overlap (G1.2)
                if (hasOverlap(blockStartMin, blockEndMin, eventStartMin, eventEndMin)) {
                    logger.validation('compose-day', 'filter-block', 'Overlaps calendar event', {
                        block: `${block.title} (${block.startTime}-${block.endTime})`,
                        event: `${event.title} (${eventStartHour}:${eventStartMinute}-${eventEndHour}:${eventEndMinute})`
                    });
                    return false;
                }
            }

            // GUARDRAIL: Check working hours (G1.1)
            const workingStartMin = timeToMinutes(userPrefs.working_hours_start);
            const workingEndMin = timeToMinutes(userPrefs.working_hours_end);

            if (blockStartMin < workingStartMin || blockEndMin > workingEndMin) {
                logger.validation('compose-day', 'filter-block', 'Outside working hours', {
                    block: `${block.title} (${block.startTime}-${block.endTime})`,
                    workingHours: `${userPrefs.working_hours_start}-${userPrefs.working_hours_end}`
                });
                return false;
            }

            return true; // Keep this block
        });

        logger.info('compose-day', 'Validation complete', {
            blocksProposed: parsedResult.schedule.length,
            blocksAfterFiltering: validatedSchedule.length,
            blocksFiltered: parsedResult.schedule.length - validatedSchedule.length
        });

        // 7. Return Result
        return new Response(JSON.stringify({
            success: true,
            optimizedBlocks: validatedSchedule,
            reasoning: parsedResult.reasoning
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error in compose-day-llm:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
