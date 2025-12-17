import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (!GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set");
        }

        const { content, context } = await req.json();

        // Construct the prompt with the "Glossary of Types"
        const prompt = `You are an expert Task Analyst. Your job is to extract task details and Assign a CATEGORY based on these strict definitions.
      
GLOSSARY OF TYPES:
1. DEEP WORK ('deep_work'):
   - High cognitive load. Creative / Analytical work.
   - Examples: "Write Strategy", "Debug Code", "Design UI", "Research topic".
   - Default Energy: "deep"
2. ADMIN ('admin'):
   - Low cognitive load. Quick, routine maintenance.
   - Key distinction: ASYNCHRONOUS (email, text, paying bills, filing).
   - Examples: "Email reply", "Pay bill", "File taxes", "Book flight".
   - Default Energy: "shallow"
3. COMMUNICATION ('meeting'):
   - SYNCHRONOUS interaction with humans.
   - ANY phone call, video call, or physical meeting is a MEETING.
   - Examples: "Call Mom", "Sync with Devs", "Interview candidate", "Coffee with John".
   - Note: "Email Mom" -> ADMIN. "Call Mom" -> MEETING.
4. ERRAND ('errand'):
   - Requires physical movement / travel outside.
   - Examples: "Buy groceries", "Go to gym", "Pick up package".

FEW-SHOT EXAMPLES:
Input: "Call Vinit about the contract"
Output Category: "meeting" (Reason: It is a phone call)

Input: "Email Vinit about the contract"
Output Category: "admin" (Reason: It is asynchronous communication)

Input: "Draft the quarterly report"
Output Category: "deep_work" (Reason: Requires focus and creation)

Input: "Pick up milk"
Output Category: "errand" (Reason: Requires going to store)

INPUT CONTENT: "${content}"
CONTEXT: Current Time: ${context?.current_time}, Timezone: ${context?.timezone}

EXTRACT AND RETURN JSON:
{
    "title": "Clear, actionable title",
    "description": "Brief description if needed",
    "steps": ["Step 1", "Step 2"],
    "acceptance": "Definition of done",
    "est_range": "30-60 min",
    "energy": "deep" | "shallow",
    "category": "deep_work" | "admin" | "meeting" | "errand",
    "deadline": "ISO date string or null",
    "tags": ["tag1", "tag2"]
}

RULES:
- 'est_range' must be one of: "15-30 min", "30-60 min", "1-2 hours", "2-4 hours", "4+ hours".
- If 'category' is 'deep_work', force energy = 'deep'.
- If 'category' is 'admin' or 'errand', force energy = 'shallow'.
- Return ONLY raw JSON.`;

        // Call Gemini
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { response_mime_type: "application/json" }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text;
        const taskData = JSON.parse(generatedText);

        return new Response(JSON.stringify({ success: true, data: taskData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
