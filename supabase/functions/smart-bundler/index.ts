import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

// Helper: Validate timezone
function validateTimezone(timezone: string | undefined | null): string {
    if (!timezone) return 'Asia/Kolkata';
    try {
        new Date().toLocaleString('en-US', { timeZone: timezone });
        return timezone;
    } catch (e) {
        return 'Asia/Kolkata';
    }
}

// Helper: Call Gemini with retry
async function callGeminiWithRetry(apiKey: string, model: string, prompt: string, config: any) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: config
            })
        }
    );

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }

    return await response.json();
}

// Google Places API Helper
async function resolveLocation(query: string, nearLat?: number, nearLng?: number, apiKey?: string) {
    if (!query || !apiKey) return null;

    try {
        let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;

        if (nearLat && nearLng) {
            url += `&location=${nearLat},${nearLng}&radius=5000`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
            const place = data.results[0];
            return {
                name: place.name,
                address: place.formatted_address,
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                place_id: place.place_id,
                opening_hours: place.opening_hours,
                business_status: place.business_status,
                types: place.types
            };
        }
        return null;
    } catch (error) {
        console.error('Error resolving location:', error);
        return null;
    }
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { date, user_location, preferences } = await req.json();
        console.log(`[Smart Bundler] Request received for date: ${date}`);
        console.log(`[Smart Bundler] User location: ${JSON.stringify(user_location)}`);

        const targetDate = date ? new Date(date) : new Date();
        const timezone = validateTimezone(preferences?.timezone);

        const queryStart = new Date(targetDate);
        queryStart.setHours(0, 0, 0, 0);
        const queryEnd = new Date(targetDate);
        queryEnd.setHours(23, 59, 59, 999);

        // Fetch Events
        const { data: events, error: eventsError } = await supabaseClient
            .from("calendar_events")
            .select("*")
            .gte("start_at", queryStart.toISOString())
            .lte("end_at", queryEnd.toISOString());

        if (eventsError) throw eventsError;

        // Fetch Tasks (exclude already scheduled ones)
        const { data: tasks, error: tasksError } = await supabaseClient
            .from("tasks")
            .select("*")
            .is("deleted_at", null)
            .is("scheduled_at", null);  // UPDATED: Exclude scheduled tasks

        if (tasksError) {
            console.error('[Smart Bundler] Error fetching tasks:', tasksError);
            throw tasksError;
        }

        console.log(`[Smart Bundler] Fetched ${tasks?.length || 0} potential tasks`);

        const errandTasks = tasks?.filter((t: any) => {
            const hasLocation = t.context?.toLowerCase().includes('location:') ||
                t.tags?.some((tag: string) => ['errand', 'shopping', 'pickup', 'dropoff'].includes(tag.toLowerCase()));
            return hasLocation;
        }) || [];

        console.log(`[Smart Bundler] Filtered down to ${errandTasks.length} errand tasks`);

        if (errandTasks.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                bundles: [],
                message: "No errand tasks found to bundle."
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Resolve Locations
        const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
        if (!GOOGLE_MAPS_API_KEY) {
            throw new Error("Missing GOOGLE_MAPS_API_KEY environment variable");
        }

        console.log('[Smart Bundler] Resolving locations...');
        const resolvedTasks: any[] = [];

        for (const task of errandTasks) {
            let query = task.title;
            if (task.context?.startsWith('location:')) {
                query = task.context.replace('location:', '').trim();
            }

            const resolved = await resolveLocation(query, user_location?.lat, user_location?.lng, GOOGLE_MAPS_API_KEY);

            if (resolved) {
                resolvedTasks.push({ ...task, resolvedLocation: resolved });
            } else {
                resolvedTasks.push({ ...task, resolvedLocation: null });
            }
        }

        console.log(`[Smart Bundler] Resolved ${resolvedTasks.length} locations`);
        console.log('[Smart Bundler] Calling Gemini API...');

        // Construct Prompt
        const prompt = `
        You are an expert Logistics and Productivity Agent.
        Your goal is to optimize the user's schedule by bundling errands efficiently around their existing commitments.

        CURRENT CONTEXT:
        - Date: ${targetDate.toDateString()}
        - User Preferences: ${JSON.stringify(preferences || {})}
        
        ANCHORS (Fixed Meetings):
        ${JSON.stringify((events || []).map((e: any) => ({
            id: e.id,
            title: e.title,
            start: e.start_at,
            end: e.end_at,
            location: e.location
        })))}

        FLOATERS (Errands to Bundle):
        ${JSON.stringify(resolvedTasks.map(t => ({
            id: t.id,
            title: t.title,
            location: t.resolvedLocation ? t.resolvedLocation.address : "Unknown",
            coordinates: t.resolvedLocation ? { lat: t.resolvedLocation.lat, lng: t.resolvedLocation.lng } : null,
            opening_hours: t.resolvedLocation?.opening_hours,
            is_frozen: t.tags?.includes('frozen'),
            is_urgent: t.priority === 'high'
        })))}

        INSTRUCTIONS:
        1. **Identify Anchors**: Find fixed points in the day.
        2. **Cluster**: Group tasks that are geographically close to anchors (within 5 miles).
        3. **Sequence**: Order stops to minimize travel time (TSP).
        4. **Validate**:
            - Ensure all stops are OPEN during the proposed time window.
            - Ensure "Frozen" items are the last stop.
            - Always add a 15-minute buffer between travel and the next meeting.

        OUTPUT FORMAT:
        Return a valid JSON object with this structure:
        {
            "reasoning": "Explanation of your strategy...",
            "bundles": [
                {
                    "anchor_event_id": "uuid (optional)",
                    "included_item_ids": ["task_id_1", "task_id_2"],
                    "suggested_start_at": "ISO String",
                    "suggested_end_at": "ISO String",
                    "total_duration_min": 45,
                    "route_sequence": ["Location A", "Location B"],
                    "reasoning": "Why this bundle?",
                    "confidence_score": 0.9
                }
            ]
        }
        `;

        // Call Gemini
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

        const geminiData = await callGeminiWithRetry(
            GEMINI_API_KEY,
            'gemini-2.0-flash-exp',
            prompt,
            { responseMimeType: 'application/json' }
        );

        const generatedText = geminiData.candidates[0].content.parts[0].text;
        const parsedResult = JSON.parse(generatedText);

        // Hydrate bundles
        const enrichedBundles = parsedResult.bundles.map((b: any) => {
            const items = b.included_item_ids.map((id: string) =>
                resolvedTasks.find(t => t.id === id) || { id, title: 'Unknown Task' }
            );
            const anchor = events?.find((e: any) => e.id === b.anchor_event_id);
            return { ...b, items, anchor };
        });

        // Insert into DB
        const authHeader = req.headers.get('Authorization');
        const { data: { user } } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', ''));

        if (user && parsedResult.bundles.length > 0) {
            const bundlesToInsert = parsedResult.bundles.map((b: any) => ({
                user_id: user.id,
                anchor_event_id: b.anchor_event_id,
                included_item_ids: b.included_item_ids,
                suggested_start_at: b.suggested_start_at,
                suggested_end_at: b.suggested_end_at,
                total_duration_min: b.total_duration_min,
                route_sequence: b.route_sequence,
                reasoning: b.reasoning,
                confidence_score: b.confidence_score,
                status: 'pending'
            }));

            await supabaseClient.from("bundle_suggestions").insert(bundlesToInsert);
        }

        return new Response(JSON.stringify({
            success: true,
            bundles: enrichedBundles,
            reasoning: parsedResult.reasoning
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('Smart bundler error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
