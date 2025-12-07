import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { calendar_connection_id } = await req.json();

        if (!calendar_connection_id) {
            throw new Error('Missing calendar_connection_id');
        }

        console.log('Syncing Google Calendar:', calendar_connection_id);

        // Initialize Supabase client with service role
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // Get calendar connection
        const { data: connection, error: connError } = await supabaseAdmin
            .from('calendar_connections')
            .select('*')
            .eq('id', calendar_connection_id)
            .single();

        if (connError || !connection) {
            console.error('Calendar connection not found:', connError);
            throw new Error('Calendar connection not found');
        }

        console.log('Found connection:', { provider: connection.provider, user_id: connection.user_id });

        if (connection.provider !== 'google') {
            throw new Error('This function only supports Google Calendar');
        }

        // Check if token is expired and refresh if needed
        let accessToken = connection.access_token;
        const expiresAt = new Date(connection.token_expires_at);
        const now = new Date();

        if (expiresAt <= now) {
            console.log('Access token expired, refreshing...');

            // Refresh the token
            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
                    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
                    refresh_token: connection.refresh_token,
                    grant_type: 'refresh_token',
                }),
            });

            const refreshData = await refreshResponse.json();

            if (refreshData.error) {
                console.error('Token refresh failed:', refreshData.error_description);
                throw new Error(`Token refresh failed: ${refreshData.error_description}`);
            }

            accessToken = refreshData.access_token;

            // Update the stored token
            await supabaseAdmin
                .from('calendar_connections')
                .update({
                    access_token: accessToken,
                    token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', calendar_connection_id);

            console.log('Token refreshed successfully');
        }

        // Fetch events from Google Calendar
        const calendarId = 'primary';
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 7); // Past 7 days
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 30); // Next 30 days

        const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?` + new URLSearchParams({
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '100'
        });

        console.log('Fetching events from Google Calendar...');
        const eventsResponse = await fetch(calendarUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!eventsResponse.ok) {
            const errorText = await eventsResponse.text();
            console.error('Google Calendar API error:', errorText);
            throw new Error(`Google Calendar API error: ${eventsResponse.status}`);
        }

        const eventsData = await eventsResponse.json();
        const events = eventsData.items || [];

        console.log(`Fetched ${events.length} events from Google Calendar`);

        // Delete existing events for this calendar
        await supabaseAdmin
            .from('calendar_events')
            .delete()
            .eq('calendar_connection_id', calendar_connection_id);

        // Insert new events
        const eventsToInsert = events.map((event: any) => ({
            calendar_connection_id: calendar_connection_id,
            user_id: connection.user_id,
            external_id: event.id,
            title: event.summary || 'Untitled Event',
            description: event.description || null,
            start_at: event.start.dateTime || event.start.date,
            end_at: event.end.dateTime || event.end.date,
            location: event.location || null,
            all_day: !event.start.dateTime,
            event_data: event,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        if (eventsToInsert.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('calendar_events')
                .insert(eventsToInsert);

            if (insertError) {
                console.error('Error inserting events:', insertError);
                throw insertError;
            }
        }

        // Update calendar connection with sync status
        await supabaseAdmin
            .from('calendar_connections')
            .update({
                last_synced_at: new Date().toISOString(),
                event_count: events.length,
                status: 'active',
                error_message: null
            })
            .eq('id', calendar_connection_id);

        console.log('Sync completed successfully');

        return new Response(
            JSON.stringify({
                success: true,
                events_synced: events.length
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );

    } catch (error) {
        console.error('Google Calendar sync error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : JSON.stringify(error)
            }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
