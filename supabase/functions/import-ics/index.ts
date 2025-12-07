// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js'
import * as ical from 'npm:node-ical'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// KV Store operations
const kvClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function kvSet(key: string, value: any) {
  const { error } = await kvClient
    .from('kv_store_72dfd380')
    .upsert({ key, value: JSON.stringify(value) })
  if (error) throw new Error(`KV set error: ${error.message}`)
}

async function kvGet(key: string) {
  const { data, error } = await kvClient
    .from('kv_store_72dfd380')
    .select('value')
    .eq('key', key)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`KV get error: ${error.message}`)
  }
  
  return data ? JSON.parse(data.value) : null
}

async function kvGetByPrefix(prefix: string) {
  const { data, error } = await kvClient
    .from('kv_store_72dfd380')
    .select('key, value')
    .like('key', `${prefix}%`)
  
  if (error) throw new Error(`KV getByPrefix error: ${error.message}`)
  
  return (data || []).map(row => ({
    key: row.key,
    value: JSON.parse(row.value)
  }))
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
    const { ics_url, calendar_id } = await req.json()
    
    if (!ics_url || !calendar_id) {
      return new Response(JSON.stringify({ error: 'ics_url and calendar_id required' }), { 
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

    // Get user from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    // Fetch ICS data
    let text: string
    try {
      const response = await fetch(ics_url)
      if (!response.ok) {
        throw new Error(`Failed to fetch ICS: ${response.status} ${response.statusText}`)
      }
      text = await response.text()
    } catch (error) {
      throw new Error(`ICS fetch error: ${error.message}`)
    }

    // Parse ICS data
    let parsed: any
    try {
      parsed = ical.sync.parseICS(text)
    } catch (error) {
      throw new Error(`ICS parse error: ${error.message}`)
    }

    const events = []
    for (const k in parsed) {
      const e: any = (parsed as any)[k]
      if (e?.type === 'VEVENT' && e.start && e.end) {
        try {
          const startDate = new Date(e.start)
          const endDate = new Date(e.end)
          
          // Skip invalid dates
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn(`Skipping event with invalid dates: ${k}`)
            continue
          }

          events.push({
            id: crypto.randomUUID(),
            title: e.summary ?? 'Event',
            description: e.description ?? null,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            location: e.location ?? null,
            isAllDay: e.start.dateOnly || false,
            sourceId: calendar_id,
            externalId: e.uid ?? `${calendar_id}:${k}`
          })
        } catch (error) {
          console.warn(`Skipping problematic event ${k}:`, error)
          continue
        }
      }
    }

    console.log(`Parsed ${events.length} events from ICS`)

    // Store events in KV store
    let importCount = 0
    for (const event of events) {
      try {
        await kvSet(`calendar_events:${user.id}:${calendar_id}:${event.id}`, event)
        importCount++
      } catch (error) {
        console.error(`Error storing event ${event.id}:`, error)
        continue
      }
    }

    // Update calendar sync timestamp and event count
    try {
      const calendar = await kvGet(`calendars:${user.id}:${calendar_id}`)
      if (calendar) {
        calendar.last_sync_at = new Date().toISOString()
        calendar.event_count = importCount
        calendar.status = 'active'
        await kvSet(`calendars:${user.id}:${calendar_id}`, calendar)
      }
    } catch (error) {
      console.error('Error updating calendar sync time:', error)
      // Don't fail the whole operation for this
    }

    return new Response(JSON.stringify({ 
      imported: importCount,
      total_parsed: rows.length 
    }), { 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      } 
    })
  } catch (e) {
    console.error('Import ICS error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})