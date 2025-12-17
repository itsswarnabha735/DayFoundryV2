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
        const url = new URL(req.url);
        const action = url.pathname.split("/").pop();

        const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
        const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
        const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI");

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !REDIRECT_URI) {
            throw new Error("Missing Google OAuth credentials in environment variables");
        }

        // GET /url: Return the Google OAuth URL
        if (action === "url") {
            const url = new URL(req.url);
            const returnUrl = url.searchParams.get("return_url"); // Client passes its URL
            if (!returnUrl) throw new Error('Missing return_url parameter');

            console.log('calendar-auth: Generating OAuth URL for return_url:', returnUrl);

            const scope = [
                "https://www.googleapis.com/auth/calendar.readonly",
                "https://www.googleapis.com/auth/calendar.events.readonly",
            ].join(" ");

            // Encode return_url in state so we get it back
            const state = returnUrl ? encodeURIComponent(returnUrl) : "";

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

            return new Response(JSON.stringify({ url: authUrl }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // GET /callback: Handle Google Redirect (Browser -> Function)
        if (action === "callback" && req.method === "GET") {
            console.log('calendar-auth: Received callback from Google');

            const url = new URL(req.url);
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");
            const error = url.searchParams.get("error");

            console.log('Callback params:', { hasCode: !!code, hasState: !!state, error });

            if (error) {
                console.error('Google OAuth error:', error);
                return new Response(`OAuth error: ${error}`, { status: 400 });
            }

            if (!code) {
                console.error('Missing authorization code');
                return new Response("Missing code", { status: 400 });
            }

            // If we have a return_url in state, redirect there
            if (state) {
                const returnUrl = decodeURIComponent(state);
                const redirectUrl = `${returnUrl}?code=${code}&provider=google`;

                console.log('Redirecting to:', redirectUrl);

                return new Response(null, {
                    status: 302,
                    headers: {
                        "Location": redirectUrl,
                        ...corsHeaders
                    }
                });
            }

            console.error('Missing state parameter');
            return new Response("Missing state parameter. Cannot redirect back to app.", { status: 400 });
        }

        // POST /callback: Exchange code for tokens (Client -> Function)
        if (action === "callback" && req.method === "POST") {
            console.log('calendar-auth: POST callback - exchanging code for tokens');

            // Verify User via Auth Header (Required since we must disable Gateway JWT enforcement)
            const authHeader = req.headers.get('Authorization');
            if (!authHeader) {
                console.error('Missing Authorization header');
                throw new Error('Missing Authorization header');
            }

            // Create client (auth header in global is sometimes not enough for getUser)
            const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            );

            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

            if (userError || !user) {
                console.error('Invalid user token:', userError);
                throw new Error(`Auth Error: ${userError?.message || 'User is null'} (Header len: ${authHeader.length})`);
            }

            const { code } = await req.json();

            if (!code) {
                console.error('Missing authorization code');
                throw new Error('Missing authorization code');
            }

            const user_id = user.id; // Use trusted ID from verified token
            console.log('Exchanging code for verified user:', user_id);

            const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    code,
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    grant_type: "authorization_code",
                }),
            });

            const tokens = await tokenResponse.json();
            if (tokens.error) {
                console.error('Google token error:', tokens.error_description);
                throw new Error(`Google Token Error: ${tokens.error_description} (URI: ${REDIRECT_URI}, Client: ${GOOGLE_CLIENT_ID?.substring(0, 10)}...)`);
            }

            console.log('Successfully exchanged code for tokens');

            // Use service role key for database operations
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            );

            // Delete any existing connection for this user/provider
            await supabaseAdmin
                .from('calendar_connections')
                .delete()
                .eq('user_id', user_id)
                .eq('provider', 'google');

            // Insert the new connection
            const { data: connection, error: dbError } = await supabaseAdmin
                .from('calendar_connections')
                .insert({
                    user_id: user_id,
                    provider: 'google',
                    external_id: 'primary',
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (dbError) {
                console.error('Database error:', dbError);
                throw dbError;
            }

            console.log('Calendar connection saved to database');

            // Register Webhook (Watch)
            let webhookResult = { success: false, error: null as string | null };
            try {
                console.log('Registering Google Calendar webhook...');
                const channelId = crypto.randomUUID();
                const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-webhook`;

                console.log('Webhook URL:', webhookUrl);

                const watchResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/watch', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: channelId,
                        type: 'web_hook',
                        address: webhookUrl,
                        params: {
                            ttl: '604800' // 7 days (max allowed usually)
                        }
                    })
                });

                if (!watchResponse.ok) {
                    const errorText = await watchResponse.text();
                    console.error('Failed to register webhook:', watchResponse.status, errorText);
                    webhookResult = { success: false, error: `Status: ${watchResponse.status}, Body: ${errorText}` };
                } else {
                    const watchData = await watchResponse.json();
                    console.log('Webhook registered successfully:', watchData);

                    // Update connection with webhook details
                    await supabaseAdmin
                        .from('calendar_connections')
                        .update({
                            resource_id: watchData.resourceId,
                            channel_id: channelId,
                            channel_expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Approx 7 days
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', connection.id);

                    console.log('Connection updated with webhook details');
                    webhookResult = { success: true, error: null };
                }

            } catch (webhookError) {
                console.error('Error registering webhook:', webhookError);
                webhookResult = { success: false, error: (webhookError as Error).message };
            }

            return new Response(JSON.stringify({ success: true, webhook: webhookResult }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
