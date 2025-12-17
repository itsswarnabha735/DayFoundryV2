// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const { content, context } = await req.json()

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'content required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Context Injection
    const currentTime = context?.current_time || new Date().toISOString();
    const timezone = context?.timezone || 'UTC';
    const userProfile = context?.user_profile || 'General User';

    // Construct System Prompt with CoT and Few-Shot
    const systemPrompt = `
Role: You are an expert productivity assistant for the "Day Foundry" app.
Your goal is to extract a structured Task Draft from the user's captured content and Assign a CATEGORY based on strict definitions.

Context:
- Current Time: ${currentTime}
- User Timezone: ${timezone}
- User Profile: ${userProfile}

Definitions (GLOSSARY OF TYPES):
1. **DEEP WORK ('deep_work')**:
   - High cognitive load. Creative/Analytical work. Minimum effective dose ~45 mins.
   - Examples: "Write Strategy", "Debug Code", "Design UI".
   - Default Energy: "deep"

2. **ADMIN ('admin')**:
   - Low cognitive load. Quick, routine maintenance. Fragmentable.
   - Examples: "Email reply", "Pay bill", "File taxes".
   - Default Energy: "shallow"

3. **COMMUNICATION ('meeting')**:
   - Synchronous talk with humans. Fixed time or coordination required.
   - Examples: "Call Mom", "Sync with Devs", "Interview candidate".
   - Note: If it's just "Email Mom", that's ADMIN. If it's "Call", it's MEETING.

4. **ERRAND ('errand')**:
   - Requires physical movement/travel outside primary workspace.
   - Examples: "Buy groceries", "Go to gym", "Pick up package".
   - Default Energy: "shallow"

Instructions:
1. **Analyze Intent**: Determine if this is a single task, a project, or a note. Treat it as a single actionable task.
2. **Assign Category**: Use the Glossary above. This is CRITICAL.
3. **Determine Energy**: 'deep' or 'shallow' (align with category defaults unless specified).
4. **Estimate Time (Bottom-Up)**: Estimate time for *each step* and sum them up to get the total range.
5. **Draft Steps**: Create 3-7 logical, chronological steps.
6. **Output JSON**: Return ONLY the final JSON object.

JSON Schema:
{
  "title": "Clear, actionable task title (start with verb)",
  "category": "deep_work" | "admin" | "meeting" | "errand",  // <--- NEW FIELD
  "steps": ["Step 1", "Step 2"],
  "acceptance": "Clear completion criteria",
  "est_range": {"min": number, "most": number, "max": number}, // in minutes
  "energy": "deep" | "shallow",
  "deps": ["Dependency 1"],
  "tags": ["tag1", "tag2"],
  "est_confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of category, energy and estimate"
}

Few-Shot Examples:

Input: "Buy milk"
Output:
{
  "title": "Buy milk",
  "category": "errand",
  "steps": ["Go to grocery store", "Locate milk section", "Purchase milk", "Return home"],
  "acceptance": "Milk is in the fridge",
  "est_range": {"min": 15, "most": 30, "max": 45},
  "energy": "shallow",
  "est_confidence": "high",
  "reasoning": "Requires physical travel (errand), low cognitive load."
}

Input: "Write Q3 strategy doc"
Output:
{
  "title": "Draft Q3 Strategy Document",
  "category": "deep_work",
  "steps": ["Review Q2 performance data", "Outline key strategic pillars", "Draft executive summary", "Write main body content", "Review and edit"],
  "acceptance": "Document shared with team for review",
  "est_range": {"min": 90, "most": 120, "max": 180},
  "energy": "deep",
  "est_confidence": "medium",
  "reasoning": "High cognitive load (deep_work), requires focus."
}

Input: "Call Mom to wish happy birthday"
Output:
{
  "title": "Call Mom: Happy Birthday",
  "category": "meeting",
  "steps": ["Check timezone if necessary", "Dial number", "Have conversation"],
  "acceptance": "Call completed",
  "est_range": {"min": 15, "most": 30, "max": 60},
  "energy": "shallow",
  "est_confidence": "high",
  "reasoning": "Synchronous communication (meeting), even if personal."
}
`;

    const userPrompt = `Content captured: "${content}"\n\nJSON:`;

    // Call Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: systemPrompt + '\n' + userPrompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const apiResult = await response.json();
    const extractedContent = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedContent) {
      throw new Error('No content returned from Gemini API');
    }

    let taskData;
    try {
      taskData = JSON.parse(extractedContent);
    } catch (e) {
      // Simple repair attempt: find first { and last }
      const firstBrace = extractedContent.indexOf('{');
      const lastBrace = extractedContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        taskData = JSON.parse(extractedContent.substring(firstBrace, lastBrace + 1));
      } else {
        throw e;
      }
    }

    // Sanity Checks / Guardrails
    if (!taskData.title) taskData.title = content.substring(0, 50);
    if (!taskData.steps || taskData.steps.length === 0) taskData.steps = ["Review task"];

    // Cap estimate
    if (taskData.est_range?.max > 480) { // > 8 hours
      taskData.est_range.max = 480;
      taskData.tags = [...(taskData.tags || []), "needs-breakdown"];
    }

    return new Response(JSON.stringify({ task: taskData }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (e) {
    console.error('Extract task error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})