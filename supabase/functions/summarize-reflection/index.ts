// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: corsHeaders,
        })
    }

    try {
        const { wins, blockers, change } = await req.json()

        if (!wins && !blockers && !change) {
            return new Response(JSON.stringify({ error: 'At least one reflection field required' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                }
            })
        }

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                }
            })
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                headers: { Authorization: authHeader }
            }
        })

        const prompt = `Summarize these daily reflections in 3 concise bullets (wins, blockers, change). Output plain text only, no markdown.

Wins: ${wins || 'None'}
Blockers: ${blockers || 'None'}
Change for tomorrow: ${change || 'None'}`

        // Call Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`

        const r = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 500
                }
            })
        })

        if (!r.ok) {
            const errorText = await r.text()
            console.error('Gemini API error:', r.status, errorText)
            throw new Error(`Gemini API error: ${r.status} ${r.statusText}`)
        }

        const data = await r.json()
        const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

        const { data: inserted, error } = await supabase.rpc('insert_reflection', {
            p_wins: wins || '',
            p_blockers: blockers || '',
            p_change: change || '',
            p_summary: summary
        })

        if (error) {
            console.error('Database error inserting reflection:', error)
            throw new Error(`Database error: ${error.message}`)
        }

        return new Response(JSON.stringify({ reflection: inserted, summary }), {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            }
        })
    } catch (e) {
        console.error('Summarize reflection error:', e)
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            }
        })
    }
})
