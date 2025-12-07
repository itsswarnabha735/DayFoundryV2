// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SOLVER_URL = Deno.env.get('SOLVER_URL') || ''
const ENABLE_FALLBACK = (Deno.env.get('ENABLE_GREEDY_FALLBACK') || 'true').toLowerCase() === 'true'

type Block = { 
  id?: string
  block_type: string
  task_id?: string | null
  event_id?: string | null
  start_at: string
  end_at: string
  pinned?: boolean
  rationale?: string
  explain?: any 
}

function toISO(d: Date) { return d.toISOString() }

/** Simple greedy fallback: pack tasks into free windows, insert micro-breaks & buffers */
function greedyPlan(input: any): { date: string; blocks: Block[]; explain: string[] } {
  const { date, tasks = [], events = [], constraints = {} } = input
  const workStart = new Date(constraints.day_start || `${date}T09:00:00Z`)
  const workEnd   = new Date(constraints.day_end   || `${date}T17:00:00Z`)
  
  // Prep busy spans from events
  const busy: [Date, Date][] = events.map((e: any) => [new Date(e.start_at), new Date(e.end_at)])
  busy.sort((a,b) => +a[0] - +b[0])

  // Build free windows
  const windows: [Date, Date][] = []
  let cursor = new Date(workStart)
  for (const [s,e] of busy) {
    if (+s > +cursor) windows.push([new Date(cursor), new Date(s)])
    if (+e > +cursor) cursor = new Date(e)
  }
  if (+cursor < +workEnd) windows.push([new Date(cursor), new Date(workEnd)])

  const blocks: Block[] = []
  
  // Place meetings as fixed blocks
  for (const e of events) {
    blocks.push({ 
      block_type: 'meeting', 
      event_id: e.id ?? null, 
      start_at: e.start_at, 
      end_at: e.end_at, 
      pinned: true, 
      rationale: 'fixed meeting' 
    })
  }

  // Fill tasks greedily
  const mbEvery = constraints.micro_break_every_min ?? 50
  const mbDur   = constraints.micro_break_min ?? 5
  const bufMin  = constraints.interruption_budget_min ?? 60
  let bufLeft   = bufMin

  for (const t of tasks) {
    const need = (t.est_most ?? t.est_min ?? 30)
    let remaining = need
    let placed = false

    for (let w = 0; w < windows.length && !placed; w++) {
      let [ws, we] = windows[w]
      let cursorW = new Date(ws)
      
      while (+cursorW < +we && remaining > 0) {
        const slot = Math.min(remaining, mbEvery)
        const end = new Date(Math.min(+cursorW + slot*60_000, +we))
        
        if (+end <= +we) {
          blocks.push({
            block_type: t.energy === 'deep' ? 'deep_work' : 'admin',
            task_id: t.id ?? null,
            start_at: toISO(cursorW),
            end_at: toISO(end),
            rationale: 'greedy placement'
          })
          remaining -= slot
          cursorW = new Date(+end)
          
          // Insert micro-break if time left
          if (remaining > 0 && (+cursorW + (mbDur*60_000)) <= +we) {
            const mbEnd = new Date(+cursorW + mbDur*60_000)
            blocks.push({ 
              block_type: 'micro_break', 
              start_at: toISO(cursorW), 
              end_at: toISO(mbEnd) 
            })
            cursorW = mbEnd
          }
        } else break
      }
      
      // update window
      windows[w] = [new Date(cursorW), we]
      if (remaining <= 0) placed = true
    }

    if (!placed && bufLeft >= (need/2)) {
      // Use some buffer minutes to "pretend" partial completion today
      bufLeft -= Math.floor(need/2)
      blocks.push({ 
        block_type: 'buffer', 
        start_at: toISO(workEnd), 
        end_at: toISO(workEnd), 
        rationale: 'insufficient time; consumed buffer' 
      })
    }
  }

  // Normalize ordering
  blocks.sort((a,b) => +new Date(a.start_at) - +new Date(b.start_at))
  return { date, blocks, explain: ['Greedy fallback used'] }
}

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
    
    const body = await req.json()
    const date = body.date
    
    if (!date) {
      return new Response(JSON.stringify({ error: 'date required (YYYY-MM-DD)' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    let plan
    if (SOLVER_URL) {
      try {
        const r = await fetch(SOLVER_URL, { 
          method: 'POST', 
          headers: { 'Content-Type':'application/json' }, 
          body: JSON.stringify(body) 
        })
        
        if (!r.ok && !ENABLE_FALLBACK) {
          throw new Error(`Solver error: ${r.status}`)
        }
        
        plan = r.ok ? await r.json() : greedyPlan(body)
      } catch (error) {
        if (!ENABLE_FALLBACK) {
          throw error
        }
        console.warn('Solver failed, using greedy fallback:', error)
        plan = greedyPlan(body)
      }
    } else if (ENABLE_FALLBACK) {
      plan = greedyPlan(body)
    } else {
      throw new Error('No solver configured and fallback disabled')
    }

    // Persist via RPC (atomic replace)
    const { data, error } = await supabase.rpc('save_schedule', { 
      p_date: date, 
      p_blocks: plan.blocks 
    })
    
    if (error) {
      console.error('Database error saving schedule:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    return new Response(JSON.stringify({ 
      blocks: data, 
      explain: plan.explain ?? [], 
      strategy: SOLVER_URL ? 'solver' : 'greedy' 
    }), { 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      } 
    })
  } catch (e) {
    console.error('Solve schedule proxy error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})