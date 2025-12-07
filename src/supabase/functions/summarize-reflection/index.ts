// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js'

const LLM_BASE_URL = Deno.env.get('LLM_BASE_URL')!
const LLM_API_KEY = Deno.env.get('LLM_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

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
    const { wins, blockers, change } = await req.json()
    
    if (!wins && !blockers && !change) {
      return new Response(JSON.stringify({ error: 'At least one reflection field required' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { 
      global: { 
        headers: { Authorization: authHeader } 
      } 
    })

    const system = `Summarize reflections in 3 bullets: wins, blockers, change. Output plain text only.`
    const user = `Wins: ${wins || 'None'}\nBlockers: ${blockers || 'None'}\nChange: ${change || 'None'}`

    const r = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${LLM_API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system }, 
          { role: 'user', content: user }
        ],
        temperature: 0.2
      })
    })

    if (!r.ok) {
      throw new Error(`LLM API error: ${r.status} ${r.statusText}`)
    }

    const data = await r.json()
    const summary = data?.choices?.[0]?.message?.content ?? ''

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
        'Access-Control-Allow-Origin': '*',
      } 
    })
  } catch (e) {
    console.error('Summarize reflection error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})