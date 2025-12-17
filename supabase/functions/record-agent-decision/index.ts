
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { recordDecision } from "../_shared/context-helper.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { user_id, agent_name, decision_type, context, options_presented, option_chosen } = await req.json();

        // Basic validation
        if (!user_id || !agent_name || !decision_type) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
        }

        await recordDecision(
            supabaseClient,
            user_id,
            agent_name,
            decision_type,
            context || {},
            options_presented || null,
            option_chosen || null
        );

        // Publish Event (Phase 3)
        try {
            const { publishEvent } = await import('../_shared/event-publisher.ts');
            await publishEvent(
                supabaseClient,
                user_id,
                'decision.recorded',
                'record-agent-decision',
                {
                    agent_name,
                    decision_type,
                    option_chosen
                }
            );
        } catch (e) {
            console.error('Failed to publish decision event:', e);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('Error recording decision:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
