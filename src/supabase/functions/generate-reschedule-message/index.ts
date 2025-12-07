import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

interface RescheduleMessageRequest {
  conflicts: Array<{
    conflictType: string
    severity: string
    description: string
    estimatedDelay: number
  }>
  strategy: {
    id: string
    title: string
    description: string
  }
  changes: Array<{
    type: string
    blockTitle: string
    oldStartTime?: string
    oldEndTime?: string
    newStartTime?: string
    newEndTime?: string
    reason: string
  }>
}

interface RescheduleMessageResponse {
  message: string
  tone: 'professional' | 'casual' | 'apologetic'
  urgency: 'low' | 'medium' | 'high'
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

    const { conflicts, strategy, changes }: RescheduleMessageRequest = await req.json()

    if (!conflicts || !strategy) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Conflicts and strategy are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high')
    const totalDelayMinutes = conflicts.reduce((sum, c) => sum + c.estimatedDelay, 0)
    const movedItems = changes.filter(c => c.type === 'moved').length
    const majorChanges = changes.filter(c => c.type === 'split' || c.type === 'moved').length

    const prompt = `You are an AI assistant that generates polite, professional reschedule messages for business communications. 

Context:
- Schedule conflicts detected: ${conflicts.length} issues
- High severity conflicts: ${highSeverityConflicts.length}
- Strategy chosen: ${strategy.title} - ${strategy.description}
- Items being rescheduled: ${movedItems}
- Total estimated delay: ${totalDelayMinutes} minutes
- Major changes: ${majorChanges}

Conflict details:
${conflicts.map(c => `- ${c.description}`).join('\n')}

Changes being made:
${changes.slice(0, 3).map(c => `- ${c.blockTitle}: ${c.reason}`).join('\n')}

Generate a brief, professional message (2-3 sentences max) that:
1. Acknowledges the need for schedule changes without going into technical details
2. Shows consideration for others' time
3. Offers to provide updated details
4. Maintains a positive, solution-oriented tone
5. Is appropriate for text message, email, or Slack

The message should be:
- Concise and clear
- Professional but friendly
- Apologetic if there are significant changes
- Proactive in offering solutions

Respond in this exact JSON format:
{
  "message": "Brief, polite reschedule message",
  "tone": "professional" | "casual" | "apologetic",
  "urgency": "low" | "medium" | "high"
}`

    console.log('Calling Gemini API to generate reschedule message...')
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
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
          temperature: 0.3,
          topK: 1,
          topP: 1,
          maxOutputTokens: 512,
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
    let messageData: RescheduleMessageResponse
    try {
      // Clean up the response text (remove markdown code blocks if present)
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      messageData = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError)
      console.error('Raw response:', generatedText)
      
      // Fallback to a simple message based on the context
      const fallbackMessage = generateFallbackMessage(conflicts, movedItems, totalDelayMinutes)
      messageData = {
        message: fallbackMessage,
        tone: totalDelayMinutes > 60 ? 'apologetic' : 'professional',
        urgency: highSeverityConflicts.length > 0 ? 'high' : 'medium'
      }
    }

    // Validate the response
    if (!messageData.message) {
      throw new Error('Generated message is empty')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: messageData 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error generating reschedule message:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to generate reschedule message' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function generateFallbackMessage(conflicts: any[], movedItems: number, totalDelayMinutes: number): string {
  if (totalDelayMinutes > 60) {
    return `Hi! I need to make some adjustments to our schedule due to conflicts that came up. ${movedItems > 0 ? `This will affect ${movedItems} item${movedItems > 1 ? 's' : ''}.` : ''} I'll send updated times shortly and appreciate your flexibility!`
  } else if (movedItems > 2) {
    return `Quick schedule update needed due to some timing conflicts. I'll need to shift a few items around and will share the revised schedule shortly. Thanks for understanding!`
  } else {
    return `Hi! Need to make a small schedule adjustment due to a conflict. I'll send the updated timing shortly. Thanks for your flexibility!`
  }
}