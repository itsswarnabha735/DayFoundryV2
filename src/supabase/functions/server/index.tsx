import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js";

const app = new Hono();

// Initialize Supabase client for server operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper function to create authenticated Supabase client
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
}

// Helper function to verify user authentication with better token validation
async function verifyUserAuth(accessToken: string) {
  if (!accessToken) {
    return { success: false, error: 'No access token provided', user: null, client: null };
  }

  // Validate JWT format first
  const tokenParts = accessToken.split('.');
  if (tokenParts.length !== 3) {
    console.error('Invalid JWT format - not 3 parts');
    return { success: false, error: 'Invalid token format', user: null, client: null };
  }

  try {
    // Try to decode the JWT payload to check basic structure
    const payload = JSON.parse(atob(tokenParts[1]));
    if (!payload.sub) {
      console.error('JWT missing sub claim');
      return { success: false, error: 'Invalid token claims', user: null, client: null };
    }
  } catch (decodeError) {
    console.error('JWT decode error:', decodeError);
    return { success: false, error: 'Token decode failed', user: null, client: null };
  }

  // Create auth client and verify user
  try {
    const authClient = createAuthenticatedClient(accessToken);
    const { data: { user }, error: getUserError } = await authClient.auth.getUser();

    if (getUserError) {
      console.error('Auth verification failed:', getUserError.message);

      // More specific error messages
      if (getUserError.message.includes('invalid claim')) {
        return { success: false, error: 'Token expired or invalid', user: null, client: null };
      } else if (getUserError.message.includes('bad_jwt')) {
        return { success: false, error: 'Malformed token', user: null, client: null };
      }

      return { success: false, error: 'Authentication failed', user: null, client: null };
    }

    if (!user) {
      console.error('No user found for valid token');
      return { success: false, error: 'User not found', user: null, client: null };
    }

    return { success: true, error: null, user, client: authClient };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { success: false, error: 'Authentication error', user: null, client: null };
  }
}

// Health check endpoint
app.get("/make-server-72dfd380/health", (c) => {
  return c.json({ status: "ok" });
});

// Auth endpoints
app.post("/make-server-72dfd380/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({
        success: false,
        error: 'Email, password, and name are required'
      }, 400);
    }

    console.log(`Creating user account for: ${email}`);

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: { name: name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('Supabase signup error:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to create account'
      }, 400);
    }

    if (!data.user) {
      return c.json({
        success: false,
        error: 'Failed to create user account'
      }, 500);
    }

    console.log('User created successfully:', data.user.id);

    // Initialize user settings in KV store
    await kv.set(`user_settings_${data.user.id}`, {
      work_hours: { start: '09:00', end: '17:00' },
      no_meeting_windows: [],
      energy_prefs: { deep_start: '09:00', deep_end: '12:00' },
      break_prefs: { interval_min: 90, break_min: 15 },
      interruption_budget_min: 60,
      privacy_mode: false,
      created_at: new Date().toISOString()
    });

    return c.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      }
    });

  } catch (error) {
    console.error('Signup endpoint error:', error);
    return c.json({
      success: false,
      error: 'Internal server error during signup'
    }, 500);
  }
});

app.post("/make-server-72dfd380/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({
        success: false,
        error: 'Email and password are required'
      }, 400);
    }

    console.log(`Authenticating user: ${email}`);

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error('Supabase signin error:', error);
      let errorMessage = 'Authentication failed';

      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address';
      }

      return c.json({
        success: false,
        error: errorMessage
      }, 401);
    }

    if (!data.user || !data.session) {
      return c.json({
        success: false,
        error: 'Authentication failed'
      }, 401);
    }

    console.log('User authenticated successfully:', data.user.id);

    return c.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Signin endpoint error:', error);
    return c.json({
      success: false,
      error: 'Internal server error during signin'
    }, 500);
  }
});

app.post("/make-server-72dfd380/auth/signout", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];

    if (!accessToken) {
      return c.json({
        success: false,
        error: 'No access token provided'
      }, 401);
    }

    // Verify the user exists before signing out
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken);

    if (getUserError || !user) {
      return c.json({
        success: false,
        error: 'Invalid access token'
      }, 401);
    }

    console.log(`Signing out user: ${user.id}`);

    // Sign out the user
    const { error } = await supabase.auth.admin.signUserOut(user.id);

    if (error) {
      console.error('Supabase signout error:', error);
      return c.json({
        success: false,
        error: 'Failed to sign out'
      }, 500);
    }

    console.log('User signed out successfully');

    return c.json({
      success: true,
      message: 'Signed out successfully'
    });

  } catch (error) {
    console.error('Signout endpoint error:', error);
    return c.json({
      success: false,
      error: 'Internal server error during signout'
    }, 500);
  }
});

// Extract task endpoint
app.post("/make-server-72dfd380/extract-task", async (c) => {
  try {
    const { content, source, context } = await c.req.json();

    if (!content) {
      return c.json({
        success: false,
        error: 'Content is required'
      }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      return c.json({
        success: false,
        error: 'Gemini API key not configured. Please upload your API key in the environment variable settings.'
      }, 500);
    }

    // Context Injection
    const currentTime = context?.current_time || new Date().toISOString();
    const timezone = context?.timezone || 'UTC';
    const userProfile = context?.user_profile || 'General User';

    // Construct System Prompt with CoT and Few-Shot
    const systemPrompt = `
Role: You are an expert productivity assistant for the "Day Foundry" app.
Your goal is to extract a structured Task Draft from the user's captured content.

Context:
- Current Time: ${currentTime}
- User Timezone: ${timezone}
- User Profile: ${userProfile}

Definitions:
- **DEEP Energy**: Requires flow state, no interruptions, high cognitive load. Examples: Coding, Writing, Strategic Planning, Complex Analysis.
- **SHALLOW Energy**: Can be done with low focus, while listening to music, or in short bursts. Examples: Email, Scheduling, Data Entry, Errands.

Instructions:
1. **Analyze Intent**: Determine if this is a single task, a project, or a note. Treat it as a single actionable task.
2. **Determine Energy**: Use the definitions above.
3. **Estimate Time (Bottom-Up)**: Estimate time for *each step* and sum them up to get the total range.
4. **Draft Steps**: Create 3-7 logical, chronological steps.
5. **Output JSON**: Return ONLY the final JSON object.

JSON Schema:
{
  "title": "Clear, actionable task title (start with verb)",
  "steps": ["Step 1", "Step 2"],
  "acceptance": "Clear completion criteria",
  "est_range": {"min": number, "most": number, "max": number}, // in minutes
  "energy": "deep" | "shallow",
  "deps": ["Dependency 1"],
  "tags": ["tag1", "tag2"],
  "est_confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of energy and estimate"
}

Few-Shot Examples:

Input: "Buy milk"
Output:
{
  "title": "Buy milk",
  "steps": ["Go to grocery store", "Locate milk section", "Purchase milk", "Return home"],
  "acceptance": "Milk is in the fridge",
  "est_range": {"min": 15, "most": 30, "max": 45},
  "energy": "shallow",
  "est_confidence": "high",
  "reasoning": "Simple errand, low cognitive load."
}

Input: "Write Q3 strategy doc"
Output:
{
  "title": "Draft Q3 Strategy Document",
  "steps": ["Review Q2 performance data", "Outline key strategic pillars", "Draft executive summary", "Write main body content", "Review and edit"],
  "acceptance": "Document shared with team for review",
  "est_range": {"min": 90, "most": 120, "max": 180},
  "energy": "deep",
  "est_confidence": "medium",
  "reasoning": "Requires synthesis of data and creative thinking. High focus needed."
}

Input: "Project Phoenix"
Output:
{
  "title": "Define scope for Project Phoenix",
  "steps": ["Identify stakeholders", "Schedule kickoff meeting", "Draft initial requirements list"],
  "acceptance": "Scope document created",
  "est_range": {"min": 30, "most": 60, "max": 90},
  "energy": "deep",
  "est_confidence": "low",
  "reasoning": "Vague input, assuming initial scoping phase."
}
`;

    const userPrompt = `Content captured: "${content}"\n\nJSON:`;

    // Call Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: systemPrompt + '\n' + userPrompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorData}`);

      let errorMessage = `Gemini API error: ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'Invalid Gemini API key. Please check your API key is correct.';
      } else if (response.status === 403) {
        errorMessage = 'Gemini API access forbidden. Please check your API key permissions.';
      } else if (response.status === 429) {
        errorMessage = 'Gemini API rate limit exceeded. Please try again in a moment.';
      }

      return c.json({
        success: false,
        error: errorMessage
      }, 500);
    }

    const apiResult = await response.json();
    const extractedContent = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedContent) {
      console.error('No content returned from Gemini API');
      return c.json({
        success: false,
        error: 'No response from Gemini API'
      }, 500);
    }

    // Parse the JSON response
    let taskData;
    try {
      taskData = JSON.parse(extractedContent);
    } catch (parseError) {
      console.error(`JSON parse error: ${parseError.message}. Content: ${extractedContent}`);
      // Simple repair attempt
      const firstBrace = extractedContent.indexOf('{');
      const lastBrace = extractedContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        try {
          taskData = JSON.parse(extractedContent.substring(firstBrace, lastBrace + 1));
        } catch (e) {
          return c.json({ success: false, error: 'Invalid response format from LLM' }, 500);
        }
      } else {
        return c.json({ success: false, error: 'Invalid response format from LLM' }, 500);
      }
    }

    // Minimal schema validation & Sanity Checks
    if (!taskData.title) {
      taskData.title = content.substring(0, 50);
    }

    if (!taskData.steps || taskData.steps.length === 0) {
      taskData.steps = ["Review task"];
    }

    // Cap estimate > 8 hours
    if (taskData.est_range?.max > 480) {
      taskData.est_range.max = 480;
      taskData.tags = [...(taskData.tags || []), "needs-breakdown"];
    }

    return c.json({
      success: true,
      data: taskData
    });

  } catch (error) {
    console.error('Extract task error:', error);
    return c.json({
      success: false,
      error: 'Internal server error during task extraction'
    }, 500);
  }
});

// Propose outcomes endpoint
app.post("/make-server-72dfd380/propose-outcomes", async (c) => {
  try {
    const { tasks, constraints } = await c.req.json();

    if (!tasks || !Array.isArray(tasks)) {
      return c.json({
        success: false,
        error: 'Tasks array is required'
      }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      return c.json({
        success: false,
        error: 'Gemini API key not configured'
      }, 500);
    }

    // Create the prompt for outcome generation
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
          maxOutputTokens: 800,
          topP: 0.8,
          topK: 10
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorData}`);

      return c.json({
        success: false,
        error: `Gemini API error: ${response.status}`
      }, 500);
    }

    const apiResult = await response.json();
    const extractedContent = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedContent) {
      console.error('No content returned from Gemini API');
      return c.json({
        success: false,
        error: 'No response from Gemini API'
      }, 500);
    }

    // Parse the JSON response
    let outcomes;
    try {
      const cleanContent = extractedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      outcomes = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error(`JSON parse error: ${parseError.message}. Content: ${extractedContent}`);
      return c.json({
        success: false,
        error: 'Invalid response format from LLM'
      }, 500);
    }

    if (!Array.isArray(outcomes)) {
      return c.json({
        success: false,
        error: 'Invalid response - expected array of outcomes'
      }, 500);
    }

    return c.json({
      success: true,
      outcomes: outcomes
    });

  } catch (error) {
    console.error('Propose outcomes error:', error);
    return c.json({
      success: false,
      error: 'Internal server error during outcome proposal'
    }, 500);
  }
});

// Database setup endpoint 
app.post("/make-server-72dfd380/setup-database", async (c) => {
  try {
    console.log('Database setup check requested');

    // List of required tables
    const requiredTables = [
      'tasks', 'events', 'outcomes', 'schedule_blocks',
      'history', 'settings', 'captured_items'
    ];

    // First, check if tables exist
    let missingTables = [];

    for (const table of requiredTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          console.log(`Table ${table} missing or inaccessible:`, error.message);
          missingTables.push(table);
        }
      } catch (tableError) {
        console.log(`Table ${table} error:`, tableError);
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      console.log(`Missing tables: ${missingTables.join(', ')}`);
      return c.json({
        success: false,
        action_required: 'manual_table_creation',
        message: `Missing database tables: ${missingTables.join(', ')}. Please create them using the SQL schema and run the RLS policies script.`,
        missing_tables: missingTables,
        instructions: 'Please run the database-rls-policies.sql script in your Supabase SQL editor to set up Row Level Security policies.'
      });
    }

    console.log('All database tables are present');
    return c.json({
      success: true,
      message: 'Database is properly configured. If you encounter RLS errors, run the database-rls-policies.sql script.'
    });

  } catch (error) {
    console.error('Database setup check error:', error);
    return c.json({
      success: false,
      error: 'Failed to check database configuration'
    }, 500);
  }
});

// Data operations endpoints with proper authentication

// Get captured items
app.get("/make-server-72dfd380/captured-items", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    const authResult = await verifyUserAuth(accessToken);
    if (!authResult.success) {
      return c.json({
        success: false,
        error: authResult.error
      }, 401);
    }

    const { user, client } = authResult;

    // Query captured items for this user
    const { data, error } = await client!
      .from('captured_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch captured items:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch captured items'
      }, 500);
    }

    return c.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Get captured items error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Create captured item
app.post("/make-server-72dfd380/captured-items", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    const authResult = await verifyUserAuth(accessToken);
    if (!authResult.success) {
      return c.json({
        success: false,
        error: authResult.error
      }, 401);
    }

    const { user, client } = authResult;
    const body = await c.req.json();
    const { content, source = 'text', processed = false, task_draft } = body;

    if (!content) {
      return c.json({
        success: false,
        error: 'Content is required'
      }, 400);
    }

    const newItem = {
      id: body.id || crypto.randomUUID(),
      user_id: user!.id,
      content,
      source,
      processed,
      task_draft,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert the captured item using the authenticated client
    const { data, error } = await client!
      .from('captured_items')
      .insert(newItem)
      .select()
      .single();

    if (error) {
      console.error('Failed to create captured item:', error);
      return c.json({
        success: false,
        error: 'Failed to create captured item'
      }, 500);
    }

    return c.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Create captured item error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Update captured item
app.put("/make-server-72dfd380/captured-items/:id", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    const authResult = await verifyUserAuth(accessToken);
    if (!authResult.success) {
      return c.json({
        success: false,
        error: authResult.error
      }, 401);
    }

    const { user, client } = authResult;
    const id = c.req.param('id');
    const updates = await c.req.json();

    // Update the captured item
    const { data, error } = await client!
      .from('captured_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update captured item:', error);
      return c.json({
        success: false,
        error: 'Failed to update captured item'
      }, 500);
    }

    return c.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Update captured item error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Delete captured item
app.delete("/make-server-72dfd380/captured-items/:id", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    const authResult = await verifyUserAuth(accessToken);
    if (!authResult.success) {
      return c.json({
        success: false,
        error: authResult.error
      }, 401);
    }

    const { user, client } = authResult;
    const id = c.req.param('id');

    // Delete the captured item
    const { error } = await client!
      .from('captured_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete captured item:', error);
      return c.json({
        success: false,
        error: 'Failed to delete captured item'
      }, 500);
    }

    return c.json({
      success: true,
      message: 'Captured item deleted successfully'
    });

  } catch (error) {
    console.error('Delete captured item error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Start the server
Deno.serve(app.fetch);

// Calendar Events Endpoint
app.get("/make-server-72dfd380/calendar/events", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    const dateStr = c.req.query('date');

    if (!dateStr) {
      return c.json({ success: false, error: 'Date parameter is required' }, 400);
    }

    const authResult = await verifyUserAuth(accessToken);
    if (!authResult.success) {
      return c.json({ success: false, error: authResult.error }, 401);
    }

    const { client } = authResult;

    // Parse date range (full day in user's timezone - approximating as UTC day for now)
    const startDate = new Date(dateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateStr);
    endDate.setHours(23, 59, 59, 999);

    const { data, error } = await client!
      .from('events')
      .select('*')
      .gte('start_at', startDate.toISOString())
      .lte('end_at', endDate.toISOString())
      .is('deleted_at', null);

    if (error) {
      console.error('Failed to fetch calendar events:', error);
      return c.json({ success: false, error: 'Failed to fetch events' }, 500);
    }

    // Map to frontend format
    const events = (data || []).map(event => ({
      id: event.id,
      sourceId: event.calendar_id || 'primary',
      title: event.title,
      start: event.start_at,
      end: event.end_at,
      location: event.location,
      description: event.description,
      isAllDay: false, // TODO: Add is_all_day column to schema if needed
      isTravel: false
    }));

    return c.json({ success: true, events });

  } catch (error) {
    console.error('Calendar events error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get Schedule Blocks Endpoint
app.get("/make-server-72dfd380/schedule/get", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    const dateStr = c.req.query('date');

    if (!dateStr) {
      return c.json({ success: false, error: 'Date parameter is required' }, 400);
    }

    const authResult = await verifyUserAuth(accessToken);
    if (!authResult.success) {
      return c.json({ success: false, error: authResult.error }, 401);
    }

    const { client } = authResult;

    const { data, error } = await client!
      .from('schedule_blocks')
      .select('*')
      .eq('date', dateStr)
      .order('start_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch schedule blocks:', error);
      return c.json({ success: false, error: 'Failed to fetch schedule' }, 500);
    }

    // Map to frontend format
    const blocks = (data || []).map(block => {
      // Extract HH:MM from TIMESTAMPTZ
      const start = new Date(block.start_at);
      const end = new Date(block.end_at);

      const formatTime = (d: Date) => {
        return d.toISOString().split('T')[1].substring(0, 5);
      };

      return {
        id: block.id,
        title: block.rationale || 'Untitled Block',
        type: block.block_type === 'deep_work' ? 'deep' :
          block.block_type === 'micro_break' ? 'micro-break' :
            block.block_type,
        startTime: formatTime(start),
        endTime: formatTime(end),
        isPinned: block.pinned,
        taskId: block.task_id,
        eventId: block.event_id,
        energy: 'medium' // Default
      };
    });

    return c.json({ success: true, blocks });

  } catch (error) {
    console.error('Get schedule error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Save Schedule Blocks Endpoint
app.post("/make-server-72dfd380/schedule/save", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    const { date, blocks } = await c.req.json();

    if (!date || !blocks || !Array.isArray(blocks)) {
      return c.json({ success: false, error: 'Invalid request body' }, 400);
    }

    const authResult = await verifyUserAuth(accessToken);
    if (!authResult.success) {
      return c.json({ success: false, error: authResult.error }, 401);
    }

    const { user, client } = authResult;

    // 1. Delete existing blocks for this date
    const { error: deleteError } = await client!
      .from('schedule_blocks')
      .delete()
      .eq('date', date);

    if (deleteError) {
      console.error('Failed to clear existing blocks:', deleteError);
      return c.json({ success: false, error: 'Failed to update schedule' }, 500);
    }

    if (blocks.length === 0) {
      return c.json({ success: true, savedBlocks: 0 });
    }

    // 2. Prepare new blocks
    const newBlocks = blocks.map((block: any) => {
      // Construct TIMESTAMPTZ strings
      // Assuming date is YYYY-MM-DD and startTime is HH:MM
      const startAt = `${date}T${block.startTime}:00Z`; // UTC assumption for simplicity, ideally handle TZ
      const endAt = `${date}T${block.endTime}:00Z`;

      // Map types
      let blockType = block.type;
      if (blockType === 'deep') blockType = 'deep_work';
      if (blockType === 'micro-break') blockType = 'micro_break';

      return {
        id: block.id, // Keep existing ID if possible, or generate new if needed
        user_id: user!.id,
        date: date,
        block_type: blockType,
        task_id: block.taskId,
        event_id: block.eventId,
        start_at: startAt,
        end_at: endAt,
        pinned: block.isPinned || false,
        rationale: block.rationale || block.title,
        explain: block.explain || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // 3. Insert new blocks
    const { data, error: insertError } = await client!
      .from('schedule_blocks')
      .insert(newBlocks)
      .select();

    if (insertError) {
      console.error('Failed to insert schedule blocks:', insertError);
      return c.json({ success: false, error: 'Failed to save blocks' }, 500);
    }

    return c.json({ success: true, savedBlocks: (data || []).length });

  } catch (error) {
    console.error('Save schedule error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default app;