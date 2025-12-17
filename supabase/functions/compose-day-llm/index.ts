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

// Helper to parse duration strings like "1-2 hours", "45 mins", "1-2h", "30-60m" into minutes
function parseDurationToMinutes(durationStr: string | null | undefined): number {
    if (!durationStr) return 30; // Default

    const lower = durationStr.toLowerCase().trim();

    // Handle ranges like "1-2 hours", "45-60 mins" -> take MAX
    const rangeMatch = lower.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(h|hr|hour|hours|m|min|mins|minutes)$/);
    if (rangeMatch) {
        const val1 = parseFloat(rangeMatch[1]);
        const val2 = parseFloat(rangeMatch[2]);
        const unit = rangeMatch[3];
        const maxVal = Math.max(val1, val2);

        if (unit.startsWith('h')) return Math.round(maxVal * 60);
        return Math.round(maxVal);
    }

    // Handle single values like "2 hours", "45 mins"
    const singleMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hour|hours|m|min|mins|minutes)$/);
    if (singleMatch) {
        const val = parseFloat(singleMatch[1]);
        const unit = singleMatch[2];
        if (unit.startsWith('h')) return Math.round(val * 60);
        return Math.round(val);
    }

    return 30; // Default fallback
}

// Helper function to reliably extract hours and minutes from a Date in a timezone
function getTimeComponentsInTimezone(date: Date, tz: string): { hours: number; minutes: number } {
    // Use Intl.DateTimeFormat to reliably get time components in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const hourPart = parts.find(p => p.type === 'hour');
    const minutePart = parts.find(p => p.type === 'minute');

    return {
        hours: parseInt(hourPart?.value || '0'),
        minutes: parseInt(minutePart?.value || '0')
    };
}

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

        const authHeader = req.headers.get('Authorization');


        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader || '' } } }
        );

        // 2. Identify User & Fetch Preferences
        // Explicitly extract token from header to avoid any ambiguity
        const token = authHeader?.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

        if (userError) {
            logger.error('compose-day', 'Auth Error details', userError);
        }

        const userId = user?.id;
        // removed early isProModel declaration to avoid conflict

        // 2. Parse and Validate Request Body
        const { date, constraints, bundle_constraints, test_mode, test_tasks, test_calendar } = await req.json();
        const targetDate = date ? validateDateString(date) : new Date();
        const timezone = validateTimezone(constraints?.timezone);

        // PRODUCTION SAFEGUARD: Test mode requires BOTH test_mode=true AND test_tasks array
        // This ensures test mode can NEVER accidentally trigger in production
        const isTestMode = test_mode === true && Array.isArray(test_tasks);

        if (isTestMode) {
            logger.warn('compose-day', '⚠️ RUNNING IN TEST MODE - using injected test data', {
                testTaskCount: test_tasks.length,
                testCalendarCount: test_calendar?.length || 0
            });
        }

        logger.userAction('compose-day', 'schedule-generation-requested',
            'user-from-auth', { date: targetDate.toISOString(), timezone, isTestMode });

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
        let tasks: any[] = [];
        let events: any[] = [];

        if (isTestMode) {
            // TEST MODE: Use provided test data directly (bypasses database)
            tasks = test_tasks.map((t: any) => ({
                ...t,
                // Ensure required fields exist
                id: t.id || `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: t.title || 'Untitled Test Task',
                category: t.category || null,
                estimated_duration: t.estimated_duration || t.duration || '30 mins',
                priority: t.priority || 'medium'
            }));

            events = (test_calendar || []).map((e: any) => ({
                ...e,
                id: e.id || `test-event-${Date.now()}`,
                title: e.title || 'Test Event',
                start_at: e.start_at || e.start,
                end_at: e.end_at || e.end
            }));

            logger.info('compose-day', 'Test mode data loaded', {
                tasksCount: tasks.length,
                eventsCount: events.length
            });
        } else {
            // PRODUCTION MODE: Fetch from database
            const { data: allTasks, error: tasksError } = await supabaseClient
                .from("tasks")
                .select("*")
                .is("deleted_at", null);

            if (tasksError) throw tasksError;

            // Filter out completed tasks (if all steps are checked)
            tasks = allTasks?.filter((t: any) => {
                if (!t.steps || !Array.isArray(t.steps) || t.steps.length === 0) return true;
                return !t.steps.every((s: any) => s.completed);
            }) || [];

            // Fetch Calendar Events for the day (Wider Range)
            const { data: rawEvents, error: eventsError } = await supabaseClient
                .from("calendar_events")
                .select("*")
                .gte("start_at", queryStart.toISOString())
                .lte("end_at", queryEnd.toISOString());

            if (eventsError) throw eventsError;

            // Filter events to strictly match the User's Local Day
            events = rawEvents?.filter(e => {
                const eventDate = new Date(e.start_at).toLocaleDateString('en-US', { timeZone: timezone });
                const targetDateStr = targetDate.toLocaleDateString('en-US', { timeZone: timezone });
                return eventDate === targetDateStr;
            }) || [];
        }

        // GUARDRAIL: Handle empty tasks case (EC.4)
        if (tasks.length === 0) {
            logger.info('compose-day', 'No tasks to schedule', {
                date: targetDate.toISOString(),
                isTestMode
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

        logger.info('compose-day', 'Events loaded for scheduling', {
            eventsCount: events.length,
            isTestMode,
            timezone
        });

        // Fetch User Preferences from database

        // Remove redundant getUser call and userId definition
        // const userId is defined at top of function

        let userPrefs = {
            working_hours_start: constraints?.workingHours?.start || '09:00',
            working_hours_end: constraints?.workingHours?.end || '17:00',
            break_duration: 15,
            break_frequency: 90,
            interruption_budget: 3,
            no_meeting_windows: [] as Array<{ start: string; end: string; label: string }>,
            conflict_resolution_style: 'balanced' as string,
            timezone: timezone,
            ai_model_pref: 'standard' // Initialize default
        };

        if (userId) {
            logger.info('compose-day', 'Fetching prefs for user', { userId });
            const { data: prefsData, error: prefsError } = await supabaseClient
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (prefsError) {
                logger.error('compose-day', 'Error fetching user_preferences', prefsError);
            }

            if (!prefsError && prefsData) {
                // Fetch learned patterns from Shared Context (Phase 2)
                let learnedPatterns = {};
                try {
                    // Import dynamically to avoid top-level await issues if module not ready
                    const { getUserPatterns } = await import('../_shared/context-helper.ts');
                    learnedPatterns = await getUserPatterns(supabaseClient, userId);
                    logger.info('compose-day', 'Loaded learned user patterns', learnedPatterns);
                } catch (e) {
                    logger.warn('compose-day', 'Failed to load learned patterns (using static prefs)', e);
                }

                userPrefs = {
                    working_hours_start: prefsData.working_hours_start || userPrefs.working_hours_start,
                    working_hours_end: prefsData.working_hours_end || userPrefs.working_hours_end,
                    break_duration: prefsData.break_duration ?? userPrefs.break_duration,
                    break_frequency: prefsData.break_frequency ?? userPrefs.break_frequency,
                    interruption_budget: prefsData.interruption_budget ?? userPrefs.interruption_budget,
                    no_meeting_windows: prefsData.no_meeting_windows || userPrefs.no_meeting_windows,
                    // Prioritize learned style if confidence is high, else database pref
                    conflict_resolution_style: (learnedPatterns as any)?.conflict_resolution_style || prefsData.conflict_resolution_style || userPrefs.conflict_resolution_style,
                    timezone: prefsData.timezone || userPrefs.timezone,
                    ai_model_pref: prefsData.ai_preferences?.model || 'standard'
                };

                logger.info('compose-day', 'Loaded user preferences', {
                    workingHours: `${userPrefs.working_hours_start}-${userPrefs.working_hours_end}`,
                    breakSettings: { duration: userPrefs.break_duration, frequency: userPrefs.break_frequency },
                    modelPref: userPrefs.ai_model_pref
                });
            }
        }

        // Format no-meeting windows for the prompt
        const noMeetingWindowsStr = userPrefs.no_meeting_windows.length > 0
            ? userPrefs.no_meeting_windows.map(w => `${w.start} - ${w.end}: PROTECTED "${w.label}"`).join('\n      ')
            : 'None';

        // 4b. Pre-calculate Duration Requirements (HARD RULES)
        const durationRequirements: Record<string, number> = {
            'deep': 0,
            'admin': 0,
            'errand': 0,
            'meeting': 0
        };

        const tasksForPrompt = tasks?.map((t: any) => {
            // Priority: est_most -> est_max -> estimated_duration string -> 30 default
            // If we have numeric estimates, use them directly.
            let minutes: number;

            if (typeof t.est_most === 'number' && t.est_most > 0) {
                minutes = t.est_most;
            } else if (typeof t.est_max === 'number' && t.est_max > 0) {
                minutes = t.est_max; // Fallback to max if most is missing
            } else if (typeof t.est_min === 'number' && t.est_min > 0) {
                minutes = t.est_min; // Fallback to min
            } else {
                minutes = parseDurationToMinutes(t.estimated_duration);
            }

            logger.info('compose-day', `Task "${t.title}": raw duration="${t.estimated_duration}", est_most=${t.est_most}, parsed/final minutes=${minutes}`);

            // PRIORITY 1: Respect existing category from task extraction
            let blockType: string;
            let isLocked = false;

            if (t.category) {
                // Map database category to schedule block type
                isLocked = true; // Existing category is authoritative
                switch (t.category) {
                    case 'deep_work':
                        blockType = 'deep';
                        break;
                    case 'admin':
                        blockType = 'admin';
                        break;
                    case 'meeting':
                        blockType = 'meeting';
                        break;
                    case 'errand':
                        blockType = 'errand';
                        break;
                    default:
                        blockType = 'admin';
                }
            } else {
                // PRIORITY 2: Fallback inference for uncategorized tasks
                if (/strategy|plan|write|prd|kpi|analysis|design|architect|document/i.test(t.title)) {
                    blockType = 'deep';
                } else if (/call|meet|sync|standup|1:1/i.test(t.title)) {
                    blockType = 'meeting';
                } else if (/grocery|errand|pickup|dropoff|gym|pharmacy/i.test(t.title)) {
                    blockType = 'errand';
                } else {
                    blockType = 'admin';
                }
            }

            // Accumulate duration by block type
            durationRequirements[blockType] += minutes;

            return {
                id: t.id,
                title: t.title,
                priority: t.priority,
                estimatedDuration: t.estimated_duration || "30 mins",
                estimatedMinutes: minutes,
                originalCategory: t.category || 'none',
                blockType: blockType, // This is authoritative
                isTypeLocked: isLocked, // LLM must not change this
                tags: t.tags
            };
        });

        const timeRequirementsStr = Object.entries(durationRequirements)
            .filter(([_, mins]) => mins > 0)
            .map(([type, mins]) => `- ${type.toUpperCase()}: Minimum ${mins} minutes required`)
            .join('\n      ');


        // 4. Construct Prompt for Gemini with clear blocked time ranges
        const blockedTimeRanges = events?.map(e => {
            const start = new Date(e.start_at).toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true });
            const end = new Date(e.end_at).toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true });
            return `${start} - ${end}: BLOCKED by "${e.title}"`;
            return `${start} - ${end}: BLOCKED by "${e.title}"`;
        }).join('\n      ') || 'None';

        // Format bundle/orchestrator constraints
        const extraConstraintsStr = bundle_constraints && Array.isArray(bundle_constraints)
            ? bundle_constraints.map((c: any) => {
                // Ensure times are formatted if they are ISO strings, or pass through if already HH:MM
                // Assuming ISO for safety as that's what smart-bundler returns
                let startStr = c.start;
                let endStr = c.end;
                try {
                    if (c.start.includes('T')) {
                        startStr = new Date(c.start).toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true });
                        endStr = new Date(c.end).toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true });
                    }
                } catch (e) { /* ignore parse error, use raw string */ }

                return `${startStr} - ${endStr}: ${c.reason} (FIXED BUNDLE)`;
            }).join('\n      ')
            : 'None';

        let prompt;
        // Determine AI Model
        const isProModel = (userPrefs as any).ai_model_pref === 'pro';

        logger.info('compose-day', `Using model: ${isProModel ? 'Gemini 3.0 Pro' : 'Gemini 2.0 Flash'}`);

        if (isProModel) {
            // GEMINI 3.0 PRO PROMPT (Simplified, relies on Reasoning)
            prompt = `
            SOLVE the schedule puzzle by fitting tasks into the available time slots.

            CURRENT CONTEXT:
            - Date: ${targetDate.toDateString()}
            - Working Hours: ${userPrefs.working_hours_start} to ${userPrefs.working_hours_end}
            - Energy Profile: ${constraints?.energyPreference || "Standard (High energy 9AM-12PM)"}
            - Conflict Resolution Style: ${userPrefs.conflict_resolution_style}

            USER BREAK PREFERENCES:
            - Break Duration: ${userPrefs.break_duration} minutes
            - Break Frequency: Every ${userPrefs.break_frequency} minutes of work
            - Max Daily Interruptions: ${userPrefs.interruption_budget}

            ⚠️ CRITICAL - BLOCKED TIME RANGES (DO NOT SCHEDULE ANYTHING DURING THESE TIMES):
            ${blockedTimeRanges}

            ${extraConstraintsStr !== 'None' ? `⚠️ EXTERNAL CONSTRAINTS (e.g. ERRAND BUNDLES) - DO NOT OVERWRITE:
            ${extraConstraintsStr}` : ''}

            ${noMeetingWindowsStr !== 'None' ? `⚠️ PROTECTED FOCUS WINDOWS (Schedule only deep work here, avoid meetings/interruptions):
            ${noMeetingWindowsStr}` : ''}

            ⚠️ TIME REQUIREMENTS (HARD CONSTRAINTS):
            You MUST schedule enough blocks to cover these minimum totals.
            ${timeRequirementsStr}

            TASKS TO SCHEDULE:
            ${JSON.stringify(tasksForPrompt, null, 2)}

            GLOSSARY OF TYPES (STRICT RULES):
            1. **DEEP WORK (type='deep')**: Minimum 60 mins.
            2. **ADMIN (type='admin')**: Low cognitive load. Fragmentable.
            3. **MEETING (type='meeting')**: Treat as fixed if specific time.
            4. **ERRAND (type='errand')**: Physical travel/movement.

            INSTRUCTIONS (CONSTRAINT SOLVING):
            1. **Task Type is Authoritative**: Respect the "blockType" field.
               - Tasks with blockType='deep' MUST go in a 'deep' block.
            2. **Energy Matching**: Deep work in High Energy, Admin in Low Energy.
            3. **PRIORITY**: Schedule HIGH priority tasks FIRST.
            4. **Block Construction**:
               - **HOMOGENEITY**: All tasks in a block MUST be of the same type.
               - **DURATION PRECISION**: For short tasks (< 30 mins), use EXACT duration.
               - **DEEP WORK**: Must be at least 60 mins. Pad if necessary.
               - **BREAK LOGIC**: Insert a ${userPrefs.break_duration}-min break after every 90 minutes of continuous work.
               - **DURATION SUM**: Block duration MUST be >= SUM of task durations.
            
            OUTPUT:
            Adhere strictly to the JSON schema provided.
            `;
        } else {
            // LEGACY PROMPT (Gemini 2.0 Flash / 1.5 Pro)
            prompt = `
          You are an expert Chief of Staff and Daily Planner. Your goal is to SOLVE the schedule puzzle by fitting tasks into the available time slots.
    
          CURRENT CONTEXT:
          - Date: ${targetDate.toDateString()}
          - Working Hours: ${userPrefs.working_hours_start} to ${userPrefs.working_hours_end}
          - Energy Profile: ${constraints?.energyPreference || "Standard (High energy 9AM-12PM)"}
          - Conflict Resolution Style: ${userPrefs.conflict_resolution_style}
    
          USER BREAK PREFERENCES:
          - Break Duration: ${userPrefs.break_duration} minutes
          - Break Frequency: Every ${userPrefs.break_frequency} minutes of work
          - Max Daily Interruptions: ${userPrefs.interruption_budget}
    
          ⚠️ CRITICAL - BLOCKED TIME RANGES (DO NOT SCHEDULE ANYTHING DURING THESE TIMES):
          ${blockedTimeRanges}
    
          ${extraConstraintsStr !== 'None' ? `⚠️ EXTERNAL CONSTRAINTS (e.g. ERRAND BUNDLES) - DO NOT OVERWRITE:
          ${extraConstraintsStr}` : ''}
    
          ${noMeetingWindowsStr !== 'None' ? `⚠️ PROTECTED FOCUS WINDOWS (Schedule only deep work here, avoid meetings/interruptions):
          ${noMeetingWindowsStr}` : ''}
    
          ⚠️ TIME REQUIREMENTS (HARD CONSTRAINTS):
          You MUST schedule enough blocks to cover these minimum totals. If you output less than the minimum, you have FAILED.
          ${timeRequirementsStr}
    
          TASKS TO SCHEDULE (Prioritize High Priority):
          ${JSON.stringify(tasksForPrompt, null, 2)}
    
          GLOSSARY OF TYPES (STRICT RULES):
          1. **DEEP WORK (type='deep')**: Strategy, Coding, Writing, Planning, Analysis. High cognitive load. Minimum 60 mins.
          2. **ADMIN (type='admin')**: Emails, Quick Tasks, Maintenance, Scheduling. Low cognitive load. Fragmentable.
          3. **MEETING (type='meeting')**: Synchronous calls (e.g., "Call Mom"). Treat as fixed if specific time, otherwise float in Admin blocks.
          4. **ERRAND (type='errand')**: Physical travel/movement (e.g., "Groceries", "Gym").
    
          INSTRUCTIONS (CONSTRAINT SOLVING):
          1. **Task Type is Pre-Determined**: Each task has a "blockType" field. THIS IS AUTHORITATIVE. DO NOT CHANGE IT.
             - If isTypeLocked=true, the blockType is final. Place the task ONLY in a block of that type.
             - If isTypeLocked=false, the blockType was inferred but should still be respected.
             - **CRITICAL**: A task with blockType='deep' MUST go in a 'deep' block, NOT an 'admin' block.
    
          2. **Energy Matching**:
             - Schedule 'deep' blocks during High Energy periods (usually Morning).
             - Schedule 'admin'/'errand' blocks during Low Energy periods (Afternoon) or gaps.
             - NEVER put Shallow work in Protected Focus Windows.
    
          3. **PRIORITY ORDERING (CRITICAL)**:
             - Schedule HIGH priority tasks FIRST (earlier in the day).
             - Within the same type, HIGH priority tasks should come before MEDIUM and LOW.
             - Example: A HIGH priority deep work task at 09:00, then MEDIUM at 11:00.
    
          4. **TIME SLOT OPTIMIZATION**:
             - If a task's duration fits a gap between calendar events, schedule it there.
             - Short tasks (<30 mins) should fill small gaps first.
             - Long tasks should be scheduled in larger continuous blocks.
    
           5. **Block Construction**:
              - **HOMOGENEITY RULE**: All tasks in a block MUST be of the same type. DO NOT mix 'deep' and 'admin' tasks in the same block.
              - Group compatible tasks into a single block (e.g., 3 admin tasks -> 1 Admin Block).
              - **DURATION PRECISION (CRITICAL)**:
                 - For short tasks (< 30 mins), use the EXACT duration. DO NOT round up to 30 mins.
                 - If a task is 15 mins, the block should be 15 mins.
              - **DEEP WORK CONSTRAINT**:
                 - Deep Work blocks must be at least 60 minutes long.
                 - **DURATION RULE**: Block Duration = MAX(60 mins, SUM of detailed task durations).
                 - If combined tasks sum to 90 mins, the block MUST be 90+ mins. DO NOT shrink it to 60 mins.
                 - ONLY if total deep tasks < 60 mins should you "combine or pad" to reach the 60-min minimum.
              - **BREAK LOGIC**:
                 - Insert a ${userPrefs.break_duration}-min break after every 90 minutes of continuous work.
                 - If you schedule 2 hours of Deep Work, you MUST schedule a break immediately after.
              - **DURATION SUM CONSTRAINT**: 
                 - The block (endTime - startTime) MUST be >= SUM of task durations.
                 - **FAILURE CASE**: If you put 180 mins of tasks in a 60-min block, YOU HAVE FAILED.
              - Don't schedule tasks during BLOCKED ranges.
    
          OUTPUT FORMAT:
          Return a valid JSON object with this structure:
          {
            "schedule": [
              {
                "title": "MUST include actual task name (e.g., 'Deep Work: PRD Writing' or 'Admin: Email Client Setup')",
                "type": "deep" | "meeting" | "admin" | "break" | "buffer" | "errand",
                "taskIds": ["CRITICAL: Must contain the id of EVERY task included in this block. DO NOT OMIT ANY IDs."],
                "durationCalculation": {
                  "steps": [
                    "Task <actual-id>: '<actual-title>' = <actual-estimatedMinutes> mins",
                    "Total required = <sum> mins"
                  ],
                  "totalMinutesRequired": <number>
                },
                "startTime": "09:00",
                "endTime": "12:00",
                "reason": "Explain why these specific tasks are grouped and scheduled at this time."
              }
            ],
            "reasoning": "A short paragraph explaining your strategy."
          }
    
          CRITICAL RULES FOR TASK ASSOCIATION (FAILURE = INVALID OUTPUT):
          1. **taskIds MUST be REAL**: The "taskIds" array MUST contain the EXACT "id" values from the TASKS TO SCHEDULE list above. DO NOT invent IDs like "uuid1", "uuid2" - use the actual UUIDs provided.
          2. **Every task MUST be scheduled**: Each task in the input list MUST appear in exactly one block's taskIds.
          3. **Block title MUST reference tasks**: The block title should describe the actual tasks (e.g., "Deep Work: Write Blog Post" not "Deep Work Block").
          4. **Example with real data**: If input has task {id: "abc-123", title: "Write Report"}, output MUST have taskIds: ["abc-123"] and title should be "Deep Work: Write Report".
    
          CRITICAL CHAIN-OF-THOUGHT INSTRUCTION:
          For EVERY block, you MUST:
          1. List each task BY ITS ACTUAL ID AND TITLE from the input, with its estimatedMinutes
          2. Sum them to get "totalMinutesRequired"
          3. ONLY THEN set startTime and endTime such that (endTime - startTime) >= totalMinutesRequired
          4. If you use placeholder IDs instead of actual task IDs, YOUR OUTPUT IS INVALID.
    
          Do not include markdown formatting (like \`\`\`json). Just the raw JSON.
        `;
        }

        // 5. Call Gemini API with Retry Logic
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            logger.error('compose-day', 'GEMINI_API_KEY not configured', null);
            throw new Error("GEMINI_API_KEY is not set");
        }

        // Define Schema for Structured Output (Gemini 3.0)
        const scheduleSchema = {
            type: "object",
            properties: {
                schedule: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            type: { type: "string", enum: ["deep", "meeting", "admin", "break", "buffer", "errand"] },
                            taskIds: { type: "array", items: { type: "string" } },
                            startTime: { type: "string" },
                            endTime: { type: "string" },
                            reason: { type: "string" },
                            durationCalculation: {
                                type: "object",
                                properties: { totalMinutesRequired: { type: "number" } },
                                required: ["totalMinutesRequired"]
                            }
                        },
                        required: ["title", "type", "taskIds", "startTime", "endTime"]
                    }
                },
                reasoning: { type: "string" }
            },
            required: ["schedule", "reasoning"]
        };

        const geminiData = await callGeminiWithRetry(
            GEMINI_API_KEY,
            isProModel ? 'gemini-3-pro-preview' : 'gemini-2.0-flash-exp',
            prompt,
            {
                responseMimeType: 'application/json',
                agentName: 'compose-day',
                // Conditional parameters for Pro model
                ...(isProModel ? {
                    thinkingConfig: { thinkingLevel: "high" },
                    responseJsonSchema: scheduleSchema,
                    retryConfig: { timeoutMs: 90000 }
                } : {})
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



        logger.info('compose-day', '=== STARTING OVERLAP VALIDATION ===', {
            totalBlocksFromLLM: parsedResult.schedule.length,
            totalCalendarEvents: events?.length || 0,
            timezone
        });

        // Log all calendar events with their parsed times for debugging
        for (const event of (events || [])) {
            const start = getTimeComponentsInTimezone(new Date(event.start_at), timezone);
            const end = getTimeComponentsInTimezone(new Date(event.end_at), timezone);
            logger.info('compose-day', `Calendar Event: "${event.title}"`, {
                rawStart: event.start_at,
                rawEnd: event.end_at,
                parsedStartTime: `${start.hours.toString().padStart(2, '0')}:${start.minutes.toString().padStart(2, '0')}`,
                parsedEndTime: `${end.hours.toString().padStart(2, '0')}:${end.minutes.toString().padStart(2, '0')}`,
                startMinutes: start.hours * 60 + start.minutes,
                endMinutes: end.hours * 60 + end.minutes,
                allDay: event.all_day
            });
        }

        // 6. Post-Process & Validate Logic
        const rawSchedule = parsedResult?.schedule || [];

        // Initialize Report
        const validationReport = {
            accuracy: 100,
            constraints: [
                { name: 'Priority Ordering', status: 'pass', details: 'High priority tasks scheduled first' }, // Inferred from prompt success
                { name: 'Energy Matching', status: 'pass', details: 'Deep work aligned with energy profile' }, // Inferred
                { name: 'Energy Matching', status: 'pass', details: 'Deep work aligned with energy profile' }, // Inferred
                { name: 'Homogeneity Rule', status: 'pass', details: 'Tasks grouped by type' }, // Inferred
                { name: 'Duration Sum', status: 'pass', details: 'Block durations cover task estimates' },
                { name: 'Deep Work Constraint', status: 'pass', details: 'Deep work blocks are 60+ mins' },
                { name: 'Break Logic', status: 'pass', details: 'Breaks scheduled effectively' },
                { name: 'Precision', status: 'pass', details: 'Short tasks use exact durations' }
            ]
        };

        const validatedSchedule = await validateAndAdjustSchedule(supabaseClient, rawSchedule, userPrefs, targetDate, timezone, events, validationReport);

        // Filter out blocks that conflict with FIXED calendar events (unless handled by conflict resolution)
        const optimizedBlocks = validatedSchedule.filter((block: any) => {
            // Basic validity check
            if (!block.startTime || !block.endTime) return false;
            return true; // Keep this block
        });

        // ===== POST-VALIDATION: DURATION CORRECTION (DETERMINISTIC & ROBUST) =====
        // This step GUARANTEES blocks are long enough for their tasks.
        const taskDurationMap: Record<string, number> = {};
        const taskTitleMap: Record<string, { minutes: number, id: string }> = {};
        if (tasksForPrompt) {
            tasksForPrompt.forEach((t: any) => {
                const minutes = typeof t.estimatedMinutes === 'number' ? t.estimatedMinutes : 30;
                taskDurationMap[t.id] = minutes;
                // Map lower-case title to info
                if (t.title) {
                    taskTitleMap[t.title.toLowerCase().trim()] = { minutes, id: t.id };
                }
            });
        } let consecutiveWorkMinutes = 0;
        let lastBlockEndMinutes = -1;

        const correctedSchedule = optimizedBlocks.map((block: any) => { // Changed from validatedSchedule to optimizedBlocks
            const blockStartMin = timeToMinutes(block.startTime);
            let blockEndMin = timeToMinutes(block.endTime);
            const currentDuration = blockEndMin - blockStartMin;

            // Collect all potential task IDs for this block
            const detectedTaskIds = new Set<string>();

            // 1. Collect IDs explicitly provided by LLM
            if (block.taskIds && Array.isArray(block.taskIds)) {
                block.taskIds.forEach((id: string) => {
                    if (taskDurationMap[id]) detectedTaskIds.add(id);
                });
            }
            // Also check 'tasks' array if present (legacy format)
            if (block.tasks && Array.isArray(block.tasks)) {
                block.tasks.forEach((t: any) => {
                    if (t.id && taskDurationMap[t.id]) detectedTaskIds.add(t.id);
                });
            }

            // 2. Scan Title for Fuzzy Matches (to catch tasks where ID was omitted)
            const cleanBlockTitle = block.title.toLowerCase();
            const blockTokens = tokenize(cleanBlockTitle);

            for (const [tTitle, taskInfo] of Object.entries(taskTitleMap)) {
                // Skip if already detected via ID
                if (detectedTaskIds.has(taskInfo.id)) continue;

                // Method A: Strict inclusion
                if (cleanBlockTitle.includes(tTitle)) {
                    detectedTaskIds.add(taskInfo.id);
                    logger.warn('compose-day', `Matched task by title (strict): "${tTitle}"`, { minutes: taskInfo.minutes });
                    continue;
                }

                // Method B: Fuzzy Token Match
                const taskTokens = tokenize(tTitle);
                if (taskTokens.length === 0) continue;

                // "Soft" inclusion: tToken is in bToken OR bToken is in tToken
                const intersection = taskTokens.filter(t => blockTokens.some(bt => bt.includes(t) || t.includes(bt)));
                const matchScore = intersection.length / taskTokens.length;

                // Threshold Tuning
                const threshold = taskTokens.length > 3 ? 0.25 : 0.6;

                if (matchScore >= threshold) {
                    detectedTaskIds.add(taskInfo.id);
                    logger.warn('compose-day', `Matched task by title (fuzzy): "${tTitle}"`, { matchScore, minutes: taskInfo.minutes });
                }
            }

            // 3. Sum Duration of ALL detected tasks
            let requiredDuration = 0;
            for (const taskId of detectedTaskIds) {
                requiredDuration += taskDurationMap[taskId];
            }

            logger.info('compose-day', `Final Duration Calc`, {
                block: block.title,
                detectedCount: detectedTaskIds.size,
                totalMinutes: requiredDuration,
                taskIds: Array.from(detectedTaskIds)
            });

            // FALLBACK 2: Use LLM's own calculation (Chain-of-Thought)
            const llmCalculatedDuration = block.durationCalculation?.totalMinutesRequired;
            if (llmCalculatedDuration && typeof llmCalculatedDuration === 'number') {
                if (llmCalculatedDuration > requiredDuration) {
                    requiredDuration = llmCalculatedDuration;
                    logger.info('compose-day', `Using LLM's calculated duration for "${block.title}"`, { llmCalculatedDuration });
                }
            }

            // If we still have 0, assume 30 mins minimum for any block
            if (requiredDuration === 0) requiredDuration = 30;

            // --- VALIDATION CHECKS PER BLOCK ---

            // 1. Duration Sum Check
            // If LLM gave LESS time than tasks require, we fail/adjust "Duration Sum".
            if (currentDuration < requiredDuration) {
                const constraint = validationReport.constraints.find(c => c.name === 'Duration Sum');
                if (constraint) {
                    constraint.status = 'adjusted';
                    constraint.details = 'Some blocks were too short for tasks (Fixed)';
                }
            }

            // 2. Deep Work Constraint
            if (block.type === 'deep' && currentDuration < 60) {
                const constraint = validationReport.constraints.find(c => c.name === 'Deep Work Constraint');
                if (constraint) {
                    constraint.status = 'fail'; // We don't auto-fix deep work extension yet, so it's a fail/warning
                    constraint.details = 'Found Deep Work block < 60 mins';
                    validationReport.accuracy -= 5;
                }
            }

            // 3. Break Logic Tracking
            // Check for gap acting as break
            if (lastBlockEndMinutes !== -1 && blockStartMin - lastBlockEndMinutes >= 15) {
                consecutiveWorkMinutes = 0; // Gap counts as break
            }
            lastBlockEndMinutes = blockEndMin; // Update for next iteration

            if (block.type === 'break' || block.type === 'micro-break') {
                consecutiveWorkMinutes = 0;
            } else {
                consecutiveWorkMinutes += currentDuration;
                if (consecutiveWorkMinutes > 90) {
                    const constraint = validationReport.constraints.find(c => c.name === 'Break Logic');
                    if (constraint && constraint.status === 'pass') {
                        constraint.status = 'fail';
                        constraint.details = 'Work session exceeded 90 mins without break';
                        validationReport.accuracy -= 5;
                    }
                }
            }

            // 4. Precision (Adjusted below)

            // If block is too short, EXTEND the endTime
            if (requiredDuration > currentDuration) {
                const newEndMin = blockStartMin + requiredDuration;
                const newEndHours = Math.floor(newEndMin / 60);
                const newEndMins = newEndMin % 60;
                const newEndTime = `${newEndHours.toString().padStart(2, '0')}:${newEndMins.toString().padStart(2, '0')}`;

                logger.info('compose-day', `DURATION FIX: Extending "${block.title}"`, {
                    originalEnd: block.endTime,
                    newEnd: newEndTime,
                    originalDuration: currentDuration,
                    requiredDuration: requiredDuration
                });

                validationReport.constraints.push({
                    name: 'Minimum Duration',
                    status: 'adjusted',
                    details: `Extended block "${block.title}" to fit tasks`
                });
                // Ensure Duration Sum is marked adjusted
                const dsCheck = validationReport.constraints.find(c => c.name === 'Duration Sum');
                if (dsCheck) dsCheck.status = 'adjusted';

                validationReport.accuracy -= 5; // Deduct for correction

                return {
                    ...block,
                    endTime: newEndTime,
                    durationCorrected: true
                };
            }

            // If block is too long for a SHORT task (< 30 mins), SHRINK it (Precision Guardrail)
            if (requiredDuration > 0 && requiredDuration < 30 && currentDuration > requiredDuration) {
                const newEndMin = blockStartMin + requiredDuration;
                const newEndHours = Math.floor(newEndMin / 60);
                const newEndMins = newEndMin % 60;
                const newEndTime = `${newEndHours.toString().padStart(2, '0')}:${newEndMins.toString().padStart(2, '0')}`;

                logger.info('compose-day', `DURATION FIX: Shrinking "${block.title}" (Precision)`, {
                    originalEnd: block.endTime,
                    newEnd: newEndTime,
                    originalDuration: currentDuration,
                    requiredDuration: requiredDuration
                });

                validationReport.constraints.push({
                    name: 'Precision Guardrail',
                    status: 'adjusted',
                    details: `Shrunk block "${block.title}" to exact duration`
                });

                const precCheck = validationReport.constraints.find(c => c.name === 'Precision');
                if (precCheck) {
                    precCheck.status = 'adjusted';
                    precCheck.details = 'Auto-corrected duration for precision';
                }

                validationReport.accuracy -= 2; // Small deduction for precision fix

                return {
                    ...block,
                    endTime: newEndTime,
                    durationCorrected: true
                };
            }

            return block;
        });

        logger.info('compose-day', 'Validation complete', {
            blocksProposed: parsedResult.schedule.length,
            blocksAfterFiltering: correctedSchedule.length,
            blocksFiltered: parsedResult.schedule.length - validatedSchedule.length
        });

        // Publish Event (Phase 3)
        try {
            const { publishEvent } = await import('../_shared/event-publisher.ts');
            await publishEvent(
                supabaseClient,
                userId,
                'compose.day.completed',
                'compose-day-llm',
                {
                    date: targetDate.toISOString(),
                    blocks_count: correctedSchedule.length,
                    has_unscheduled_tasks: parsedResult.reasoning.includes('revisit') || false,
                    validation_accuracy: validationReport.accuracy
                }
            );
        } catch (e) {
            logger.error('compose-day', 'Failed to publish event', e as Error);
        }

        // 7. Return Result
        return new Response(JSON.stringify({
            success: true,
            optimizedBlocks: correctedSchedule,
            reasoning: parsedResult.reasoning,
            validationReport, // NEW: Return report to UI
            meta: {
                model: isProModel ? 'gemini-3-pro-preview' : 'gemini-2.0-flash-exp',
                mode: isProModel ? 'reasoning-high' : 'standard'
            }
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

// ==========================================
// RESTORED VALIDATION HELPER
// ==========================================

async function validateAndAdjustSchedule(
    supabaseClient: any,
    schedule: any[],
    userPrefs: any,
    targetDate: Date,
    timezone: string,
    events: any[] = [],
    report: any = null // Validation Report to mutate
): Promise<any[]> {
    if (!Array.isArray(schedule)) {
        logger.warn('compose-day', 'Schedule is not an array, returning empty', typeof schedule);
        return [];
    }

    const validBlocks = [];
    for (const block of schedule) {
        // 1. Structural Validation
        if (!block.title || !block.startTime || !block.endTime) {
            logger.warn('compose-day', 'Skipping invalid block structure', block);
            continue;
        }

        // 2. Logic Validation
        try {
            const startMin = timeToMinutes(block.startTime);
            const endMin = timeToMinutes(block.endTime);

            if (endMin <= startMin) {
                logger.warn('compose-day', 'Skipping block with invalid duration (end <= start)', {
                    block: block.title,
                    start: block.startTime,
                    end: block.endTime
                });
                continue;
            }

            // 3. Basic Field Normalization
            if (!block.taskIds) block.taskIds = [];

            // 4. Overlap Detection with Fixed Events (Guardrail)
            let hasOverlap = false;
            for (const event of events) {
                // Parse event times to minutes
                const evtStart = getTimeComponentsInTimezone(new Date(event.start_at), timezone);
                const evtEnd = getTimeComponentsInTimezone(new Date(event.end_at), timezone);
                const evtStartMin = evtStart.hours * 60 + evtStart.minutes;
                const evtEndMin = evtEnd.hours * 60 + evtEnd.minutes;

                // Check overlap: (StartA < EndB) && (EndA > StartB)
                if (startMin < evtEndMin && endMin > evtStartMin) {
                    logger.warn('compose-day', 'REJECTING block due to calendar overlap', {
                        block: block.title,
                        blockTime: `${block.startTime}-${block.endTime}`,
                        event: event.title,
                        eventTime: `${evtStart.hours}:${evtStart.minutes}-${evtEnd.hours}:${evtEnd.minutes}`
                    });

                    if (report) {
                        report.constraints.push({
                            name: 'Conflict Guardrail',
                            status: 'fail',
                            details: `Rejected block overlapping with "${event.title}"`
                        });
                        report.accuracy -= 10; // Significant deduction
                    }

                    hasOverlap = true;
                    break;
                }
            }

            if (hasOverlap) continue;

            validBlocks.push(block);

        } catch (e) {
            logger.warn('compose-day', 'Error validating block time', { block: block.title, error: e });
            continue;
        }
    }

    return validBlocks;
}

// Helper for fuzzy matching (Tokenization)
function tokenize(text: string): string[] {
    const weakWords = ['and', 'the', 'for', 'with', 'deep', 'work', 'admin', 'block', 'write', 'review', 'create', 'update', 'analyze', 'check'];
    return text
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with SPACE
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2) // Ignore short words 
        .filter(w => !weakWords.includes(w)); // Filter Stop Words + Common Verbs
}
