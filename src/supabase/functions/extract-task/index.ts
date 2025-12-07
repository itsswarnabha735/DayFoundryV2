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
Your goal is to extract a structured Task Draft from the user's captured content.

Context:
- Current Time: ${currentTime}
- User Timezone: ${timezone}
- User Profile: ${userProfile}

Definitions:
- **DEEP Energy**: Requires flow state, no interruptions, high cognitive load. Examples: Coding, Writing, Strategic Planning, Complex Analysis.
- **SHALLOW Energy**: Can be done with low focus, while listening to music, or in short bursts. Examples: Email, Scheduling, Data Entry, Errands.

Instructions:
1. **Analyze Intent**: Determine if this is a single task, a project, or a note. Treat it as a single actionable task.
2. **Determine Energy**: Use the definitions above.
3. **Estimate Time (Bottom-Up)**: Estimate time for *each step* and sum them up to get the total range.
4. **Draft Steps**: Create 3-7 logical, chronological steps.
5. **Output JSON**: Return ONLY the final JSON object.

JSON Schema:
{
  "title": "Clear, actionable task title (start with verb)",
  "steps": ["Step 1", "Step 2"],
  "acceptance": "Clear completion criteria",
  "est_range": {"min": number, "most": number, "max": number}, // in minutes
  "energy": "deep" | "shallow",
  "deps": ["Dependency 1"],
  "tags": ["tag1", "tag2"],
  "est_confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of energy and estimate"
}

Few-Shot Examples:

Input: "Buy milk"
Output:
{
  "title": "Buy milk",
  "steps": ["Go to grocery store", "Locate milk section", "Purchase milk", "Return home"],
  "acceptance": "Milk is in the fridge",
  "est_range": {"min": 15, "most": 30, "max": 45},
  "energy": "shallow",
  "est_confidence": "high",
  "reasoning": "Simple errand, low cognitive load."
}

Input: "Write Q3 strategy doc"
Output:
{
  "title": "Draft Q3 Strategy Document",
  "steps": ["Review Q2 performance data", "Outline key strategic pillars", "Draft executive summary", "Write main body content", "Review and edit"],
  "acceptance": "Document shared with team for review",
  "est_range": {"min": 90, "most": 120, "max": 180},
  "energy": "deep",
  "est_confidence": "medium",
  "reasoning": "Requires synthesis of data and creative thinking. High focus needed."
}

Input: "Project Phoenix"
Output:
{
  "title": "Define scope for Project Phoenix",
  "steps": ["Identify stakeholders", "Schedule kickoff meeting", "Draft initial requirements list"],
  "acceptance": "Scope document created",
  "est_range": {"min": 30, "most": 60, "max": 90},
  "energy": "deep",
  "est_confidence": "low",
  "reasoning": "Vague input, assuming initial scoping phase."
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