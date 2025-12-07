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
    const { tasks, constraints } = await req.json()
    if (!Array.isArray(tasks)) {
      return new Response(JSON.stringify({ error: 'tasks[] required' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      console.log('GEMINI_API_KEY environment variable is not set or empty');
      return new Response(JSON.stringify({ 
        error: 'Gemini API key not configured. Please upload your API key in the environment variable settings.' 
      }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // Build context for the LLM
    const tasksContext = tasks.map(task => `
Task: ${task.title}
Steps: ${task.steps?.map((s: any) => s.text || s).join(', ') || 'None specified'}
Deadline: ${task.deadline || 'None'}
Energy: ${task.energy}
Estimate: ${task.est_min || task.est_most || 'Not specified'} minutes`).join('\n\n');

    const constraintsContext = `
Work Hours: ${JSON.stringify(constraints?.work_hours || {})}
No-Meeting Windows: ${JSON.stringify(constraints?.no_meeting_windows || [])}
Break Preferences: ${JSON.stringify(constraints?.break_prefs || {})}`;

    const prompt = `You are a productivity AI that helps plan daily outcomes. Based on the tasks and constraints below, propose 3-5 realistic outcomes for today.

TASKS:
${tasksContext}

CONSTRAINTS:
${constraintsContext}

Generate 3-5 outcomes that:
1. Are achievable within today's constraints
2. Balance deep work with administrative tasks
3. Consider energy levels and deadlines
4. Include realistic risk assessments

Return a JSON object with this exact structure:
{
  "outcomes": [
    {
      "title": "Clear, specific outcome description",
      "risks": ["Brief note about potential risks or blockers"],
      "linked_task_ids": []
    }
  ]
}

Important:
- Each outcome should be a meaningful result, not just a task
- Risk notes should be brief but helpful
- Return only valid JSON, no additional text

JSON:`;

    // Call Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
          topP: 0.9,
          topK: 20
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.log(`Gemini API error: ${response.status} - ${errorData}`);
      
      let errorMessage = `Gemini API error: ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'Invalid Gemini API key. Please check your API key is correct.';
      } else if (response.status === 429) {
        errorMessage = 'Gemini API rate limit exceeded. Please try again in a moment.';
      } else if (response.status === 403) {
        errorMessage = 'Gemini API access forbidden. Please check your API key permissions.';
      }
      
      return new Response(JSON.stringify({ error: errorMessage }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const apiResult = await response.json();
    const extractedContent = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedContent) {
      console.log('No content returned from Gemini API');
      console.log('Full API response:', JSON.stringify(apiResult, null, 2));
      return new Response(JSON.stringify({ error: 'No response from Gemini API' }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // Parse the JSON response
    let outcomesData;
    try {
      // Clean up the response (remove any markdown formatting)
      const cleanContent = extractedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      outcomesData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.log(`JSON parse error: ${parseError.message}. Content: ${extractedContent}`);
      return new Response(JSON.stringify({ error: 'Invalid response format from LLM' }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // Validate the response structure
    if (!outcomesData.outcomes || !Array.isArray(outcomesData.outcomes)) {
      return new Response(JSON.stringify({ error: 'Invalid outcomes structure from LLM' }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    return new Response(JSON.stringify(outcomesData), { 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      } 
    })
  } catch (e) {
    console.error('Propose outcomes error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})