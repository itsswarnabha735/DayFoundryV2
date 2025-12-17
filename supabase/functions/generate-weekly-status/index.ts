// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

const LLM_API_KEY = Deno.env.get('LLM_API_KEY')

interface WeeklyData {
    completedOutcomes: Array<{
        title: string;
        category: 'work' | 'personal' | 'health' | 'learning';
        completedDate: string;
        keySteps: string[];
    }>;
    reflections: Array<{
        date: string;
        wins: string;
        blockers: string;
        improvements: string;
    }>;
    stats: {
        totalOutcomes: number;
        completedOutcomes: number;
        focusHours: number;
        meetingsCount: number;
    };
}

async function generateWorkUpdate(weeklyData: WeeklyData): Promise<string> {
    const workOutcomes = weeklyData.completedOutcomes.filter(o => o.category === 'work')
    const allWins = weeklyData.reflections.map(r => r.wins).join('. ')
    const allImprovements = weeklyData.reflections.map(r => r.improvements).join('. ')

    const prompt = `Generate a professional work update for stakeholders based on this week's data:

COMPLETED WORK OUTCOMES:
${workOutcomes.map(o => `- ${o.title}: ${o.keySteps.join(', ')}`).join('\n')}

WEEKLY STATS:
- Completed ${weeklyData.stats.completedOutcomes}/${weeklyData.stats.totalOutcomes} planned outcomes
- ${weeklyData.stats.focusHours} hours of focused work
- ${weeklyData.stats.meetingsCount} meetings/touchpoints

KEY WINS:
${allWins}

IMPROVEMENTS IDENTIFIED:
${allImprovements}

Generate a concise, professional update (200-300 words) that:
1. Highlights key deliverables completed
2. Shows progress metrics
3. Mentions key wins and learnings
4. Sets context for next week
5. Uses a confident, results-oriented tone
6. Includes relevant emojis for visual appeal

Format as markdown with clear sections.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${LLM_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional communication assistant specializing in clear, concise status updates for work stakeholders.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7,
        }),
    })

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
}

async function generatePersonalUpdate(weeklyData: WeeklyData): Promise<string> {
    const personalOutcomes = weeklyData.completedOutcomes.filter(o =>
        o.category === 'personal' || o.category === 'health' || o.category === 'learning'
    )
    const allWins = weeklyData.reflections.map(r => r.wins).join('. ')

    const prompt = `Generate a warm, personal update for family/friends based on this week's activities:

PERSONAL ACCOMPLISHMENTS:
${personalOutcomes.map(o => `- ${o.title}: ${o.keySteps.join(', ')}`).join('\n')}

WEEKLY HIGHLIGHTS:
${allWins}

WORK-LIFE BALANCE:
- ${weeklyData.stats.focusHours} hours focused work
- Completed ${weeklyData.stats.completedOutcomes}/${weeklyData.stats.totalOutcomes} personal/work goals

Generate a friendly, personal update (150-250 words) that:
1. Shares personal wins and growth
2. Shows balance between work and personal life
3. Mentions lessons learned or insights
4. Expresses gratitude or positive outlook
5. Uses a warm, conversational tone
6. Includes friendly emojis
7. Ends with looking forward to connecting

Format as markdown with a personal, authentic voice.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${LLM_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a personal communication assistant helping craft warm, authentic updates for family and friends.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 400,
            temperature: 0.8,
        }),
    })

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { weeklyData } = await req.json()

        if (!weeklyData) {
            throw new Error('Weekly data is required')
        }

        console.log('Generating weekly status updates for:', {
            completedOutcomes: weeklyData.completedOutcomes?.length || 0,
            reflections: weeklyData.reflections?.length || 0,
            stats: weeklyData.stats
        })

        // Generate both work and personal updates
        const [workUpdate, personalUpdate] = await Promise.all([
            generateWorkUpdate(weeklyData),
            generatePersonalUpdate(weeklyData)
        ])

        const result = {
            workUpdate,
            personalUpdate,
            generatedAt: new Date().toISOString()
        }

        console.log('Generated weekly status updates successfully')

        return new Response(
            JSON.stringify(result),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            }
        )

    } catch (error: any) {
        console.error('Error generating weekly status:', error)

        return new Response(
            JSON.stringify({
                error: 'Failed to generate weekly status',
                details: error.message
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            }
        )
    }
})
