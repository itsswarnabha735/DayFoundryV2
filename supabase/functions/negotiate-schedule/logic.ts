import { callGeminiWithRetry } from "../_shared/error-recovery.ts";
import { validateTimezone, validateLLMResponse, GuardrailViolationError } from "../_shared/validation-helpers.ts";
import { logger } from "../_shared/logger.ts";

export interface NegotiatorInput {
  alert: any;
  conflictingBlocks: any[];
  freeSlots: any[];
  userPrefs: any;
  timezone: string;
  geminiApiKey: string;
}

export interface NegotiatorOutput {
  strategies: any[];
  modelUsed?: string;
}

export async function runNegotiator(input: NegotiatorInput): Promise<NegotiatorOutput> {
  const { alert, conflictingBlocks, freeSlots, userPrefs, timezone, geminiApiKey } = input;

  // GUARDRAIL: Timezone validation
  const validatedTimezone = validateTimezone(timezone);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      timeZone: validatedTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isProModel = (userPrefs as any)?.ai_preferences?.model === 'pro';
  const modelName = isProModel ? 'gemini-3-pro-preview' : 'gemini-2.0-flash-exp';

  logger.info('negotiator', `Using model: ${modelName}`, { isProModel });

  const prompt = `
      You are the Negotiator Agent for a daily schedule.
      A conflict has been detected: "${alert.message}"
      
      YOUR MISSION:
      Resolve this conflict using "Tetris-style" logic. Find fit for displaced blocks in the Available Free Slots.
      
      CONFLICTING BLOCKS (Must be resolved):
      ${JSON.stringify(conflictingBlocks.map(b => ({
    id: b.id,
    title: b.title,
    start: formatTime(b.start_time),
    end: formatTime(b.end_time),
    type: b.block_type,
    durationMin: Math.round((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000)
  })))}
      
      AVAILABLE FREE SLOTS (Your resource pool):
      ${JSON.stringify(freeSlots.map(s => ({
    start: formatTime(s.start),
    end: formatTime(s.end),
    durationMin: s.durationMinutes
  })))}

      USER PREFERENCES:
      - Resolution Style: ${userPrefs.conflict_resolution_style}
      
      YOUR GOAL:
      Propose EXACTLY 3 distinct strategies.
      
      STRATEGY TYPES:
      1. **The "Clean Solution"**: Move the conflicting block to a perfect free slot.
      2. **The "Compromise"**: Shorten the block to fit a smaller gap or current slot.
      3. **The "Hard Choice"**: Delete/Cancel the block if no slots exist or low priority.
      4. **The "Split"**: Divide a large block into two smaller available slots.
      5. **The "Swap"**: Exchange time with another flexible internal block (if efficient).
      
      GUIDELINES:
      - **FEASIBILITY**: Do NOT propose moving a 60-min block into a 30-min slot.
      - **REALISM**: Use specific times from the "Available Free Slots" list.
      - **RESPECT**: Try not to fragment Deep Work unless necessary.
      - **DEEP WORK GUARDRAIL**: Deep Work blocks MUST be at least 60 minutes. If only smaller slots exist, suggest 'delete' or 'reschedule_tomorrow' instead of 'shorten'.
      
      OUTPUT JSON:
      {
        "strategies": [
          {
            "id": "strategy_1",
            "title": "Short Title (e.g. 'Move Deep Work to 3pm')",
            "description": "One sentence explanation.",
            "impact": "High" | "Medium" | "Low",
            "action": "move" | "shorten" | "delete" | "split" | "swap",
            "operations": [
              {
                "type": "move",
                "targetBlockId": "UUID",
                "targetBlockTitle": "Title",
                "originalStart": "HH:MM",
                "originalEnd": "HH:MM",
                "params": { "shiftMinutes": 30, "newStartTime": "ISOString (optional but helpful)" }
              }
              // Add more operations if needed (e.g. resize)
            ]
          },
          ... (3 strategies total)
        ]
      }
    `;

  // GUARDRAIL: Use retry logic
  const geminiData = await callGeminiWithRetry(
    geminiApiKey,
    modelName,
    prompt,
    {
      responseMimeType: 'application/json',
      agentName: 'negotiator',
      thinkingConfig: isProModel ? { thinkingLevel: "high" } : undefined
    }
  );

  const generatedText = geminiData.candidates[0].content.parts[0].text;
  const result = JSON.parse(generatedText);

  // GUARDRAIL: Validate response structure (G3.1, GX.10)
  validateLLMResponse(result, {
    requiredFields: ['strategies'],
    arrayFields: [{ field: 'strategies', minLength: 3, maxLength: 3 }]
  });

  // Additional validation: Check each strategy has required fields
  for (const strategy of result.strategies) {
    if (!strategy.id || !strategy.title || !strategy.description || !strategy.impact || !strategy.action) {
      throw new GuardrailViolationError(
        'Strategy missing required fields',
        'INVALID_STRATEGY_STRUCTURE',
        { strategy }
      );
    }
    // Ensure operations array exists (even if empty)
    if (!strategy.operations || !Array.isArray(strategy.operations)) {
      strategy.operations = [];
    }
  }

  return { ...result, modelUsed: modelName };
}
