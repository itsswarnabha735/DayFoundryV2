import { projectId, publicAnonKey } from '../supabase/info';
import { fetchWithTimeout, withRetry } from '../timeout';

export class EdgeFunctionService {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(userToken?: string) {
    this.baseUrl = `https://${projectId}.supabase.co/functions/v1`;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken || publicAnonKey}`,
    };
  }

  async extractTask(rawText: string, context?: {
    current_time?: string;
    timezone?: string;
    recent_tasks?: string[];
    user_profile?: string;
  }): Promise<{
    task: {
      title: string;
      steps: string[];
      acceptance?: string;
      est_range?: { min?: number; most?: number; max?: number };
      energy?: 'deep' | 'shallow';
      deps?: string[];
      deadline?: string | null;
      tags?: string[];
    };
  }> {
    return withRetry(async () => {
      // Use the unified server endpoint
      const url = `${this.baseUrl}/make-server-72dfd380/extract-task`;
      console.log('Calling extract-task at:', url);

      const payload = {
        content: rawText,
        source: 'text',
        context: {
          current_time: context?.current_time || new Date().toISOString(),
          timezone: context?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          recent_tasks: context?.recent_tasks || [],
          user_profile: context?.user_profile || ''
        }
      };

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        timeoutMs: 30000,
        timeoutMessage: 'Task extraction timed out. Please try again.'
      });

      console.log('Extract-task response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Extract-task error response:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(`Extract task failed: ${error.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('Extract-task result:', result);

      // The server endpoint returns { success: true, data: {...} } format
      if (result.success && result.data) {
        const taskData = result.data;

        // Map est_range string to min/most/max object if it's a string
        let est_range = taskData.est_range;
        if (typeof taskData.est_range === 'string') {
          const rangeMap: Record<string, { min: number; most: number; max: number }> = {
            '15-30 min': { min: 15, most: 22, max: 30 },
            '30-60 min': { min: 30, most: 45, max: 60 },
            '1-2 hours': { min: 60, most: 90, max: 120 },
            '2-4 hours': { min: 120, most: 180, max: 240 },
            '4+ hours': { min: 240, most: 300, max: 480 }
          };
          est_range = rangeMap[taskData.est_range] || { min: 30, most: 45, max: 60 };
        }

        return {
          task: {
            title: taskData.title,
            steps: taskData.steps || [],
            acceptance: taskData.acceptance,
            est_range,
            energy: taskData.energy?.toLowerCase() as 'deep' | 'shallow',
            deps: taskData.deps || [],
            deadline: taskData.deadline || null,
            tags: taskData.tags || []
          }
        };
      } else {
        throw new Error(result.error || 'No task returned from extraction');
      }
    }, { maxRetries: 0, initialDelayMs: 1000 });
  }

  async proposeOutcomes(tasks: any[], constraints: any): Promise<{
    outcomes: Array<{
      title: string;
      risks: string[];
      linked_task_ids: string[];
    }>;
  }> {
    return withRetry(async () => {
      // Use the unified server endpoint
      const response = await fetchWithTimeout(`${this.baseUrl}/make-server-72dfd380/propose-outcomes`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ tasks, constraints }),
        timeoutMs: 25000,
        timeoutMessage: 'Outcome proposal timed out. Please try again.'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Propose outcomes failed: ${error.error || response.statusText}`);
      }

      const result = await response.json();

      // The server endpoint returns { success: true, outcomes: [...] } format
      if (result.success && result.outcomes && Array.isArray(result.outcomes)) {
        return {
          outcomes: result.outcomes.map((outcome: any) => ({
            title: outcome.title,
            risks: outcome.risks || (outcome.risk_note ? [outcome.risk_note] : []),
            linked_task_ids: outcome.linked_task_ids || []
          }))
        };
      } else {
        throw new Error(result.error || 'No outcomes returned');
      }
    }, { maxRetries: 0, initialDelayMs: 1500 });
  }

  async summarizeReflection(wins: string, blockers: string, change: string): Promise<{
    reflection: any;
    summary: string;
  }> {
    // This function still uses standalone edge function as it may be working properly
    const response = await fetch(`${this.baseUrl}/summarize-reflection`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ wins, blockers, change }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Summarize reflection failed: ${error.error || response.statusText}`);
    }

    return response.json();
  }

  async solveSchedule(input: {
    date: string;
    tasks: any[];
    events: any[];
    constraints: any;
  }): Promise<{
    blocks: any[];
    explain: string[];
    strategy: 'solver' | 'greedy';
  }> {
    return withRetry(async () => {
      // Use the direct edge function for schedule solving
      const response = await fetchWithTimeout(`${this.baseUrl}/solve-schedule-proxy`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          date: input.date,
          tasks: input.tasks,
          events: input.events,
          constraints: input.constraints
        }),
        timeoutMs: 45000, // Schedule solving can take longer
        timeoutMessage: 'Schedule solving timed out. Please try again.'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Solve schedule failed: ${error.error || response.statusText}`);
      }

      const result = await response.json();

      if (result.blocks || result.success) {
        return {
          blocks: result.blocks || result.optimizedBlocks || [],
          explain: result.explain || result.changes?.map((c: any) => c.reason) || [],
          strategy: (result.strategy || 'solver') as 'solver' | 'greedy'
        };
      } else {
        throw new Error(result.error || 'No schedule solution returned');
      }
    }, { maxRetries: 0, initialDelayMs: 2000 }); // Only one retry for expensive operation
  }

  async importICS(icsUrl: string, calendarId: string): Promise<{
    imported: number;
    total_parsed?: number;
  }> {
    // This function still uses standalone edge function as it may be working properly
    const response = await fetch(`${this.baseUrl}/import-ics`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ ics_url: icsUrl, calendar_id: calendarId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Import ICS failed: ${error.error || response.statusText}`);
    }

    return response.json();
  }

  // Generic function caller for unified server endpoints
  async callFunction(functionName: string, payload: any): Promise<any> {
    return withRetry(async () => {
      // Map function names to server endpoints
      const endpointMap: Record<string, string> = {
        'extract-task': '/make-server-72dfd380/extract-task',
        'propose-outcomes': '/make-server-72dfd380/propose-outcomes',
        'summarize-reflection': '/summarize-reflection', // Keep standalone for now
        'solve-schedule-proxy': '/solve-schedule-proxy', // Keep standalone for now  
        'import-ics': '/import-ics', // Keep standalone for now
        'generate-weekly-status': '/generate-weekly-status', // Keep standalone for now
        'generate-reschedule-message': '/generate-reschedule-message', // Keep standalone for now
        'extract-actions-from-notes': '/extract-actions-from-notes' // Keep standalone for now
      };

      const endpoint = endpointMap[functionName] || `/${functionName}`;
      const response = await fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        timeoutMs: 30000,
        timeoutMessage: `${functionName} function call timed out`
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`${functionName} error response:`, errorText);

        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }

        throw new Error(`${functionName} failed: ${error.error || response.statusText}`);
      }

      return response.json();
    }, { maxRetries: 2, initialDelayMs: 1000 });
  }
}

import { supabase } from '../supabase/client';

// Create a fallback service that provides mock responses when edge functions fail
class FallbackEdgeFunctionService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  async extractTask(rawText: string): Promise<{
    task: {
      title: string;
      steps: string[];
      acceptance?: string;
      est_range?: { min?: number; most?: number; max?: number };
      energy?: 'deep' | 'shallow';
      deps?: string[];
      deadline?: string | null;
      tags?: string[];
    };
  }> {
    console.log('Using fallback task extraction (client-side)');

    if (this.apiKey && this.apiKey !== 'your_gemini_api_key_here') {
      try {
        console.log('Attempting client-side Gemini call for task extraction');
        const prompt = `Extract a structured task from this captured content. Return a JSON object with these exact fields:

{
  "title": "Clear, actionable task title (required)",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "acceptance": "Clear completion criteria (required)",
  "est_range": "30-60 min",
  "energy": "Deep",
  "deps": ["Dependency 1", "Dependency 2"],
  "tags": ["tag1", "tag2"]
}

Content captured: "${rawText}"

Important: 
- Return only valid JSON, no additional text
- Title should be clear and actionable
- Steps should be specific actions, not vague descriptions
- Acceptance should define "done" clearly
- est_range should be one of: "15-30 min", "30-60 min", "1-2 hours", "2-4 hours", "4+ hours"
- Energy should be "Deep" or "Shallow"
- Only include dependencies if the task truly depends on other tasks
- Use relevant, helpful tags

JSON:`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`, {
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
              maxOutputTokens: 1000,
              topP: 0.8,
              topK: 10
            }
          })
        });

        if (response.ok) {
          const apiResult = await response.json();
          const extractedContent = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;

          if (extractedContent) {
            const cleanContent = extractedContent
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();

            const taskData = JSON.parse(cleanContent);

            // Map est_range string to min/most/max object if it's a string
            let est_range = taskData.est_range;
            if (typeof taskData.est_range === 'string') {
              const rangeMap: Record<string, { min: number; most: number; max: number }> = {
                '15-30 min': { min: 15, most: 22, max: 30 },
                '30-60 min': { min: 30, most: 45, max: 60 },
                '1-2 hours': { min: 60, most: 90, max: 120 },
                '2-4 hours': { min: 120, most: 180, max: 240 },
                '4+ hours': { min: 240, most: 300, max: 480 }
              };
              est_range = rangeMap[taskData.est_range] || { min: 30, most: 45, max: 60 };
            }

            return {
              task: {
                title: taskData.title,
                steps: taskData.steps || [],
                acceptance: taskData.acceptance,
                est_range,
                energy: taskData.energy?.toLowerCase() === 'deep' ? 'deep' : 'shallow',
                deps: taskData.deps || [],
                deadline: null,
                tags: taskData.tags || []
              }
            };
          }
        } else {
          console.error('Gemini API client-side call failed:', response.status, await response.text());
        }
      } catch (error) {
        console.error('Client-side Gemini extraction error:', error);
      }
    }

    // Fallback to dummy data if API key missing or call fails
    const cleanText = rawText.trim();
    const words = cleanText.split(' ');

    return {
      task: {
        title: cleanText.length > 50 ? cleanText.substring(0, 47) + '...' : cleanText,
        steps: ['Review and break down this task', 'Complete the main work', 'Verify completion'],
        acceptance: 'Task completed successfully',
        est_range: { min: 30, most: 45, max: 60 },
        energy: words.some(w => ['research', 'analyze', 'design', 'write', 'plan'].includes(w.toLowerCase())) ? 'deep' : 'shallow',
        deps: [],
        deadline: null,
        tags: ['inbox']
      }
    };
  }

  async proposeOutcomes(tasks: any[], constraints: any): Promise<{
    outcomes: Array<{
      title: string;
      risks: string[];
      linked_task_ids: string[];
    }>;
  }> {
    console.log('Using fallback outcome generation (client-side)');

    if (this.apiKey && this.apiKey !== 'your_gemini_api_key_here') {
      try {
        console.log('Attempting client-side Gemini call for outcome proposal');
        const prompt = `Based on these tasks, suggest 3-5 key outcomes for today. Each outcome should be achievable and represent meaningful progress.

Tasks:
${tasks.map(task => `- ${task.title}`).join('\n')}

Return a JSON array of outcomes with this format:
[
  {
    "title": "Outcome title",
    "risk_note": "Brief risk or dependency note"
  }
]

Focus on outcomes that:
- Are specific and measurable
- Represent meaningful progress
- Can realistically be achieved today
- Have clear value

JSON:`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`, {
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
              maxOutputTokens: 800,
              topP: 0.8,
              topK: 10
            }
          })
        });

        if (response.ok) {
          const apiResult = await response.json();
          const extractedContent = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;

          if (extractedContent) {
            const cleanContent = extractedContent
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();

            const outcomes = JSON.parse(cleanContent);

            if (Array.isArray(outcomes)) {
              return {
                outcomes: outcomes.map((outcome: any) => ({
                  title: outcome.title,
                  risks: outcome.risks || (outcome.risk_note ? [outcome.risk_note] : []),
                  linked_task_ids: []
                }))
              };
            }
          }
        } else {
          console.error('Gemini API client-side call failed:', response.status, await response.text());
        }
      } catch (error) {
        console.error('Client-side Gemini outcome proposal error:', error);
      }
    }

    return {
      outcomes: [
        {
          title: 'Complete priority tasks',
          risks: ['May need more time than estimated'],
          linked_task_ids: []
        },
        {
          title: 'Make progress on ongoing projects',
          risks: ['Dependent on external factors'],
          linked_task_ids: []
        },
        {
          title: 'Clear inbox and capture new items',
          risks: ['New urgent items may arise'],
          linked_task_ids: []
        }
      ]
    };
  }

  async summarizeReflection(wins: string, blockers: string, change: string): Promise<{
    reflection: any;
    summary: string;
  }> {
    console.log('Using fallback reflection summary (client-side)');

    let summary = 'Wins: ' + (wins || 'None') + '\nBlockers: ' + (blockers || 'None') + '\nChange: ' + (change || 'None');

    if (this.apiKey && this.apiKey !== 'your_gemini_api_key_here') {
      try {
        console.log('Attempting client-side Gemini call for reflection summary');
        const system = `Summarize reflections in 3 bullets: wins, blockers, change. Output plain text only.`;
        const user = `Wins: ${wins || 'None'}\nBlockers: ${blockers || 'None'}\nChange: ${change || 'None'}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: system + '\n\n' + user }]
            }],
            generationConfig: { temperature: 0.2 }
          })
        });

        if (response.ok) {
          const apiResult = await response.json();
          const extractedContent = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;
          if (extractedContent) {
            summary = extractedContent.trim();
          }
        }
      } catch (error) {
        console.error('Client-side Gemini reflection summary error:', error);
      }
    }

    // Save to Supabase directly via RPC
    const { data: inserted, error } = await supabase.rpc('insert_reflection', {
      p_wins: wins || '',
      p_blockers: blockers || '',
      p_change: change || '',
      p_summary: summary
    });

    if (error) {
      console.error('Database error inserting reflection:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    return { reflection: inserted, summary };
  }

  async solveSchedule(input: {
    date: string;
    tasks: any[];
    events: any[];
    constraints: any;
  }): Promise<{
    blocks: any[];
    explain: string[];
    strategy: 'solver' | 'greedy';
  }> {
    console.log('Using fallback greedy scheduler (client-side)');

    // Greedy Plan Logic ported from Edge Function
    const { date, tasks = [], events = [], constraints = {} } = input;
    const workStart = new Date(constraints.day_start || `${date}T09:00:00`);
    const workEnd = new Date(constraints.day_end || `${date}T17:00:00`);

    // Prep busy spans from events
    const busy: [Date, Date][] = events.map((e: any) => [new Date(e.start_at), new Date(e.end_at)]);
    busy.sort((a, b) => +a[0] - +b[0]);

    // Build free windows
    const windows: [Date, Date][] = [];
    let cursor = new Date(workStart);
    for (const [s, e] of busy) {
      if (+s > +cursor) windows.push([new Date(cursor), new Date(s)]);
      if (+e > +cursor) cursor = new Date(e);
    }
    if (+cursor < +workEnd) windows.push([new Date(cursor), new Date(workEnd)]);

    const blocks: any[] = [];

    // Place meetings as fixed blocks
    for (const e of events) {
      blocks.push({
        block_type: 'meeting',
        event_id: e.id ?? null,
        start_at: e.start_at,
        end_at: e.end_at,
        pinned: true,
        rationale: 'fixed meeting'
      });
    }

    // Fill tasks greedily
    const mbEvery = constraints.micro_break_every_min ?? 50;
    const mbDur = constraints.micro_break_min ?? 5;
    const bufMin = constraints.interruption_budget_min ?? 60;
    let bufLeft = bufMin;

    for (const t of tasks) {
      const need = (t.est_most ?? t.est_min ?? 30);
      let remaining = need;
      let placed = false;

      for (let w = 0; w < windows.length && !placed; w++) {
        let [ws, we] = windows[w];
        let cursorW = new Date(ws);

        while (+cursorW < +we && remaining > 0) {
          const slot = Math.min(remaining, mbEvery);
          const end = new Date(Math.min(+cursorW + slot * 60_000, +we));

          if (+end <= +we) {
            blocks.push({
              block_type: t.energy === 'deep' ? 'deep_work' : 'admin',
              task_id: t.id ?? null,
              start_at: cursorW.toISOString(),
              end_at: end.toISOString(),
              rationale: 'greedy placement'
            });
            remaining -= slot;
            cursorW = new Date(+end);

            // Insert micro-break if time left
            if (remaining > 0 && (+cursorW + (mbDur * 60_000)) <= +we) {
              const mbEnd = new Date(+cursorW + mbDur * 60_000);
              blocks.push({
                block_type: 'micro_break',
                start_at: cursorW.toISOString(),
                end_at: mbEnd.toISOString()
              });
              cursorW = mbEnd;
            }
          } else break;
        }

        // update window
        windows[w] = [new Date(cursorW), we];
        if (remaining <= 0) placed = true;
      }

      if (!placed && bufLeft >= (need / 2)) {
        // Use some buffer minutes to "pretend" partial completion today
        bufLeft -= Math.floor(need / 2);
        blocks.push({
          block_type: 'buffer',
          start_at: workEnd.toISOString(),
          end_at: workEnd.toISOString(),
          rationale: 'insufficient time; consumed buffer'
        });
      }
    }

    // Normalize ordering
    blocks.sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));

    // Persist via RPC (atomic replace)
    try {
      const { data, error } = await supabase.rpc('save_schedule', {
        p_date: date,
        p_blocks: blocks
      });

      if (error) {
        console.error('Database error saving schedule:', error);
        // Don't throw here, return the calculated blocks anyway so UI works
      } else {
        // If save successful, return the saved blocks (which might have IDs)
        return {
          blocks: data,
          explain: ['Client-side greedy fallback used'],
          strategy: 'greedy'
        };
      }
    } catch (e) {
      console.error('RPC call failed:', e);
    }

    return { date, blocks, explain: ['Client-side greedy fallback used (unsaved)'], strategy: 'greedy' } as any;
  }
}

// Enhanced service that falls back gracefully
export class ResilientEdgeFunctionService extends EdgeFunctionService {
  private fallbackService = new FallbackEdgeFunctionService();
  private isServiceAvailable = false; // Start in fallback mode to avoid initial errors
  private lastServiceCheck = Date.now(); // Assume we just checked
  private readonly SERVICE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  async extractTask(rawText: string): Promise<{
    task: {
      title: string;
      steps: string[];
      acceptance?: string;
      est_range?: { min?: number; most?: number; max?: number };
      energy?: 'deep' | 'shallow';
      deps?: string[];
      deadline?: string | null;
      tags?: string[];
    };
  }> {
    // If service has been failing recently, try fallback first
    if (!this.isServiceAvailable && Date.now() - this.lastServiceCheck < this.SERVICE_CHECK_INTERVAL) {
      return this.fallbackService.extractTask(rawText);
    }

    try {
      const result = await super.extractTask(rawText);
      this.isServiceAvailable = true;
      return result;
    } catch (error) {
      console.warn('Edge function failed, using fallback:', error);
      this.isServiceAvailable = false;
      this.lastServiceCheck = Date.now();
      return this.fallbackService.extractTask(rawText);
    }
  }

  async proposeOutcomes(tasks: any[], constraints: any): Promise<{
    outcomes: Array<{
      title: string;
      risks: string[];
      linked_task_ids: string[];
    }>;
  }> {
    // If service has been failing recently, try fallback first
    if (!this.isServiceAvailable && Date.now() - this.lastServiceCheck < this.SERVICE_CHECK_INTERVAL) {
      return this.fallbackService.proposeOutcomes(tasks, constraints);
    }

    try {
      const result = await super.proposeOutcomes(tasks, constraints);
      this.isServiceAvailable = true;
      return result;
    } catch (error) {
      console.warn('Edge function failed, using fallback:', error);
      this.isServiceAvailable = false;
      this.lastServiceCheck = Date.now();
      return this.fallbackService.proposeOutcomes(tasks, constraints);
    }
  }
}

// Singleton instance for use throughout the app
export const edgeFunctionService = new ResilientEdgeFunctionService();