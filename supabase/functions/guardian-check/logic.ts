import { callGeminiWithRetry } from "../_shared/error-recovery.ts";
import { validateTimezone } from "../_shared/validation-helpers.ts";
import { logger } from "../_shared/logger.ts";

export interface GuardianInput {
    event: { title: string; start_at: string; end_at: string };
    conflictingBlocks: any[];
    userPrefs: any;
    timezone: string;
    geminiApiKey: string;
}

export interface GuardianOutput {
    type: "conflict" | "warning" | "critical";
    severity: number;
    message: string;
    recommendedAction?: string;
    modelUsed?: string;
}

export async function runGuardianCheck(input: GuardianInput): Promise<GuardianOutput> {
    const { event, conflictingBlocks, userPrefs, timezone, geminiApiKey } = input;

    // Deterministic Rule: Valid Timezone
    const validTz = validateTimezone(timezone);

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            timeZone: validTz,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const isProModel = (userPrefs as any)?.ai_preferences?.model === 'pro';
    const modelName = isProModel ? 'gemini-3-pro-preview' : 'gemini-2.0-flash-exp';

    logger.info('guardian', `Using model: ${modelName}`, { isProModel });

    const prompt = `
      You are the Guardian Agent for a high-performance daily planner.
      Your responsibility is to Protect the User's Focus and Schedule Integrity.
      
      A new calendar event has invaded the schedule and conflicts with existing blocks.
      
      NEW EVENT:
      Title: "${event.title}"
      Time: ${formatTime(event.start_at)} - ${formatTime(event.end_at)}
      
      CONFLICTING BLOCKS (The victims):
      ${JSON.stringify(conflictingBlocks.map(b => ({
        title: b.title,
        type: b.block_type,
        start: formatTime(b.start_time),
        end: formatTime(b.end_time)
    })))}
      
      USER PREFERENCES:
      - Work Hours: ${userPrefs.working_hours_start || '09:00'} - ${userPrefs.working_hours_end || '17:00'}
      - Priority: ${userPrefs.conflict_resolution_style || 'Balance Focus and Flexibility'}
      
      YOUR GOAL:
      Analyze the SEVERITY of this conflict and generate a user-facing alert.
      
      SEVERITY CALIBRATION MATRIX (0-10):
      
      [CRITICAL RANGE: 9-10]
      - 10: Immutable External Conflict (e.g., Board Meeting vs Client Call).
      - 9: Project Deadlines / Critical Focus Blocks (e.g., "Deep Work" vs "Team Sync").
      
      [HIGH RANGE: 7-8]
      - 8: Significant Interruption to Focus (e.g., "Deep Work" vs "Quick Chat").
      - 7: Double Booking of Standard Work blocks.
      
      [MEDIUM RANGE: 4-6]
      - 6: Conflict with Flexible Task (e.g., "Admin" vs "Errand").
      - 5: Partial Overlap (e.g., 15 mins into a meeting).
      - 4: "All Day" Event overlap (if just a reminder/placeholder).
      
      [LOW RANGE: 1-3]
      - 3: Conflict with Break / Buffer / Commute.
      - 2: Adjacent blocks (0 min overlap).
      - 1: Zero-duration events or purely informational blocks.

      EDGE CASE RULES:
      1. IF "All Day" event: Cap severity at 4 unless it's explicitly "OOO" or "Travel".
      2. IF "Deep Work" is impacted: Minimum severity 8.
      3. IF "Buffer" or "Break" is impacted: Max severity 3.
      
      OUTPUT GUIDELINES:
      - Message: Concise (max 2 sentences). Clear call to action.
      - Type: "conflict" (Generic) | "warning" (Serious) | "critical" (Severe).
      
      OUTPUT JSON:
      {
        "type": "conflict" | "warning" | "critical",
        "severity": <number 0-10>,
        "message": "User friendly message explaining what is at risk.",
        "recommendedAction": "reject" | "reschedule_event" | "reschedule_block"
      }
    `;

    const geminiData = await callGeminiWithRetry(
        geminiApiKey,
        modelName,
        prompt,
        {
            responseMimeType: 'application/json',
            agentName: 'guardian',
            thinkingConfig: isProModel ? { thinkingLevel: "low" } : undefined
        }
    );

    const generatedText = geminiData.candidates[0].content.parts[0].text;
    let analysis;
    try {
        analysis = JSON.parse(generatedText);
    } catch (e) {
        logger.error('guardian', 'Failed to parse LLM response', e as Error);
        // Fallback
        analysis = { type: 'conflict', severity: 5, message: `Conflict detected with ${conflictingBlocks.length} blocks.` };
    }

    //  GUARDRAIL: Validate alert type
    if (!['conflict', 'warning', 'critical'].includes(analysis.type)) {
        analysis.type = 'warning';
    }

    return { ...analysis, modelUsed: modelName };
}
