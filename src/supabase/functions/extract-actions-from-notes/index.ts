import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

interface ExtractActionsRequest {
  notes: string
  meetingTitle: string
  attendees: string[]
}

interface ExtractedTask {
  title: string
  description: string
  acceptanceCriteria: string[]
  estimatedMinutes: number
  dueDate: string | null
  assignedTo: string | null
  priority: 'low' | 'medium' | 'high'
  category: string
}

interface ExtractActionsResponse {
  tasks: ExtractedTask[]
  summary: string
  keyDecisions: string[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API key not configured'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { notes, meetingTitle, attendees }: ExtractActionsRequest = await req.json()

    if (!notes || !notes.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Notes are required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const prompt = `You are an AI assistant that extracts actionable tasks from meeting notes. Analyze the following meeting notes and extract specific, actionable tasks with clear acceptance criteria.

Meeting: "${meetingTitle}"
Attendees: ${attendees.join(', ')}

Meeting Notes:
${notes}

Extract actionable tasks following these guidelines:
1. Focus on concrete action items mentioned in the notes
2. Include "follow up", "research", "prepare", "review", "schedule", "send", "create", "update" type actions
3. Provide clear acceptance criteria for each task
4. Estimate time required (in minutes: 15, 30, 45, 60, 90, 120, 180, 240)
5. Suggest due dates based on urgency mentioned in notes
6. Assign to specific people when mentioned
7. Set priority based on importance/urgency signals
8. Categorize tasks (meeting-prep, communication, research, development, admin)

Also provide:
- A brief summary of the meeting
- Key decisions made

Respond in this exact JSON format:
{
  "tasks": [
    {
      "title": "Clear, actionable task title",
      "description": "Detailed description of what needs to be done",
      "acceptanceCriteria": ["Specific criteria 1", "Specific criteria 2"],
      "estimatedMinutes": 60,
      "dueDate": "YYYY-MM-DD" or null,
      "assignedTo": "Person Name" or null,
      "priority": "low" | "medium" | "high",
      "category": "meeting-prep" | "communication" | "research" | "development" | "admin"
    }
  ],
  "summary": "Brief meeting summary",
  "keyDecisions": ["Decision 1", "Decision 2"]
}`

    console.log('Calling Gemini API to extract actions from notes...')

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
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      throw new Error(`Gemini API request failed: ${response.status}`)
    }

    const data = await response.json()
    console.log('Gemini API response received')

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response generated from Gemini API')
    }

    const generatedText = data.candidates[0].content.parts[0].text
    console.log('Generated text:', generatedText)

    // Parse the JSON response
    let extractedData: ExtractActionsResponse
    try {
      // Clean up the response text (remove markdown code blocks if present)
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extractedData = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError)
      console.error('Raw response:', generatedText)
      throw new Error('Failed to parse extracted actions')
    }

    // Validate the response structure
    if (!extractedData.tasks || !Array.isArray(extractedData.tasks)) {
      extractedData.tasks = []
    }

    if (!extractedData.summary) {
      extractedData.summary = 'Meeting completed'
    }

    if (!extractedData.keyDecisions || !Array.isArray(extractedData.keyDecisions)) {
      extractedData.keyDecisions = []
    }

    // Store extracted tasks in the data store (simulate task creation)
    // In a real implementation, you would save these to the database
    console.log(`Extracted ${extractedData.tasks.length} tasks from meeting notes`)

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error extracting actions from notes:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to extract actions from notes'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})