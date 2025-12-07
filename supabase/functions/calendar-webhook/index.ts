import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Verify Webhook Headers OR Manual Sync Body
        const channelId = req.headers.get("x-goog-channel-id");
        const resourceId = req.headers.get("x-goog-resource-id");
        const resourceState = req.headers.get("x-goog-resource-state");

        let connectionId = null;
        let isManualSync = false;

        console.log(`Webhook received: state=${resourceState}, channel=${channelId}, resource=${resourceId}`);

        // Google sends a "sync" notification when webhook is first registered
        if (resourceState === "sync") {
            console.log("Received initial sync notification from Google");
            return new Response(JSON.stringify({ message: "Sync OK" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Check if this is a manual sync (has JSON body) vs Google webhook (headers only)
        if (!channelId && !resourceId) {
            // No Google headers, must be manual sync - try to parse body
            try {
                const body = await req.json();
                if (body.manual_sync && body.calendar_connection_id) {
                    connectionId = body.calendar_connection_id;
                    isManualSync = true;
                    console.log(`Manual sync requested for connection ${connectionId}`);
                } else {
                    return new Response(JSON.stringify({ error: "Missing manual_sync parameters" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
            } catch (e) {
                return new Response(JSON.stringify({ error: "Invalid request format" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        } else {
            // Has Google headers - this is a real webhook notification
            console.log("Processing Google webhook notification");
        }

        // 2. Initialize Supabase Admin Client (needed to search all connections)
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 3. Find the connection
        let connection;
        let dbError;

        if (isManualSync) {
            const result = await supabaseAdmin
                .from("calendar_connections")
                .select("*")
                .eq("id", connectionId)
                .single();
            connection = result.data;
            dbError = result.error;
        } else {
            const result = await supabaseAdmin
                .from("calendar_connections")
                .select("*")
                .eq("channel_id", channelId)
                .eq("resource_id", resourceId)
                .single();
            connection = result.data;
            dbError = result.error;
        }

        if (dbError || !connection) {
            console.error("Connection not found for webhook:", channelId);
            return new Response(JSON.stringify({ error: "Connection not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 4. Refresh Token if needed (simplified check)
        // In a real app, check expiration and refresh. For now, assume access_token is valid or handle 401.
        let accessToken = connection.access_token;

        // 5. Fetch Changes from Google
        const GOOGLE_API_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
        const params = new URLSearchParams();
        params.append("singleEvents", "true"); // Expand recurring events

        // Force full sync for manual requests to ensure we get past events
        if (connection.sync_token && !isManualSync) {
            params.append("syncToken", connection.sync_token);
        } else {
            // Full sync if no token OR if manual sync
            // Fetch from 1 month ago to ensure we get recent history
            console.log("Performing full sync (ignoring sync token if present)...");
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            params.append("timeMin", oneMonthAgo.toISOString());
        }

        let googleRes = await fetch(`${GOOGLE_API_URL}?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        console.log(`Google API Status: ${googleRes.status} ${googleRes.statusText}`);

        // Handle Token Expiry (401)
        if (googleRes.status === 401) {
            console.log("Access token expired, attempting refresh...");

            const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
            const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

            if (!connection.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
                console.error("Cannot refresh token: Missing refresh_token or credentials");
                return new Response(JSON.stringify({ error: "Token expired and cannot refresh" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    refresh_token: connection.refresh_token,
                    grant_type: "refresh_token",
                }),
            });

            if (!refreshRes.ok) {
                const refreshError = await refreshRes.text();
                console.error("Token refresh failed:", refreshError);
                return new Response(JSON.stringify({ error: "Failed to refresh token", details: refreshError }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const newTokens = await refreshRes.json();
            console.log("Token refreshed successfully");

            // Update database with new token
            await supabaseAdmin
                .from("calendar_connections")
                .update({
                    access_token: newTokens.access_token,
                    token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq("id", connection.id);

            // Retry request with new token
            accessToken = newTokens.access_token;
            googleRes = await fetch(`${GOOGLE_API_URL}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            console.log(`Retry Google API Status: ${googleRes.status} ${googleRes.statusText}`);
        }

        if (!googleRes.ok) {
            const errorBody = await googleRes.text();
            console.error("Google API Error Body:", errorBody);
            return new Response(JSON.stringify({
                error: `Google API Error: ${googleRes.status}`,
                details: errorBody
            }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const googleData = await googleRes.json();
        console.log("Google API Response Keys:", Object.keys(googleData));
        if (googleData.items) {
            console.log(`Found ${googleData.items.length} items in response.`);
        } else {
            console.log("No 'items' field in Google response.");
        }

        let upsertedCount = 0;
        let deletedCount = 0;

        if (googleData.items) {
            // 6. Process Events - separate active and cancelled
            const activeEvents = googleData.items.filter((e: any) => e.status !== 'cancelled');
            const cancelledEvents = googleData.items.filter((e: any) => e.status === 'cancelled');

            // Handle cancelled/deleted events
            if (cancelledEvents.length > 0) {
                console.log(`Deleting ${cancelledEvents.length} cancelled events`);
                const cancelledIds = cancelledEvents.map((e: any) => e.id);

                const { error: deleteError, count } = await supabaseAdmin
                    .from("calendar_events")
                    .delete({ count: 'exact' })
                    .eq("calendar_connection_id", connection.id)
                    .in("external_id", cancelledIds);

                if (deleteError) {
                    console.error("Error deleting cancelled events:", deleteError);
                } else {
                    deletedCount = count || 0;
                    console.log(`Successfully deleted ${deletedCount} events`);
                }
            }

            // Upsert active events into calendar_events table
            const eventsToUpsert = activeEvents
                .map((event: any) => ({
                    calendar_connection_id: connection.id,
                    user_id: connection.user_id,
                    external_id: event.id,
                    title: event.summary || '(No Title)',
                    description: event.description || '',
                    start_at: event.start?.dateTime || event.start?.date, // Handle all-day
                    end_at: event.end?.dateTime || event.end?.date,
                    location: event.location || '',
                    all_day: !event.start?.dateTime, // If no dateTime, it's all-day
                    event_data: event, // Store raw data just in case
                    updated_at: new Date().toISOString()
                }));

            if (eventsToUpsert.length > 0) {
                console.log(`Upserting ${eventsToUpsert.length} events for user ${connection.user_id}`);

                // Perform upsert
                const { error: upsertError } = await supabaseAdmin
                    .from("calendar_events")
                    .upsert(eventsToUpsert, {
                        onConflict: 'calendar_connection_id,external_id',
                        ignoreDuplicates: false
                    });

                if (upsertError) {
                    console.error("Error upserting events:", upsertError);
                } else {
                    upsertedCount = eventsToUpsert.length;
                }
            }

            // Update sync token
            if (googleData.nextSyncToken) {
                await supabaseAdmin
                    .from("calendar_connections")
                    .update({ sync_token: googleData.nextSyncToken, last_synced_at: new Date().toISOString() })
                    .eq("id", connection.id);
            }

            // 7. Trigger Guardian Check (Async)
            if (eventsToUpsert.length > 0) {
                console.log("Triggering Guardian for new events...");
                // We don't await this to avoid blocking the webhook response
                // In production, use a queue. Here we just fire and forget.
                const PROJECT_REF = Deno.env.get("SUPABASE_URL")?.split("://")[1].split(".")[0];
                const GUARDIAN_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/guardian-check`;
                const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

                // Trigger for the first event as a sample (or loop all if needed)
                // For MVP, just check the first one to avoid spamming
                const firstEvent = eventsToUpsert[0];

                // We need the ID of the inserted event. Since we did upsert, we might not have it easily
                // without a return. Let's fetch it or rely on external_id lookup in guardian.
                // Actually guardian takes event_id. Let's fetch the ID first.
                const { data: insertedEvent } = await supabaseAdmin
                    .from("calendar_events")
                    .select("id")
                    .eq("calendar_connection_id", connection.id)
                    .eq("external_id", firstEvent.external_id)
                    .single();

                if (insertedEvent) {
                    fetch(GUARDIAN_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${SERVICE_KEY}`
                        },
                        body: JSON.stringify({
                            event_id: insertedEvent.id,
                            user_id: connection.user_id
                        })
                    }).catch(err => console.error("Failed to trigger guardian:", err));
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Webhook processed",
            eventsSynced: upsertedCount,
            eventsDeleted: deletedCount
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Webhook error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
