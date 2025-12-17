
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
    getUserPatterns,
    updateUserPattern,
    UserPatterns
} from "../_shared/context-helper.ts";
import { publishEvent } from "../_shared/event-publisher.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

        // Can be triggered manually or via cron
        const { user_id } = await req.json().catch(() => ({}));

        // If no specific user, we might want to run for all active users (Cron mode)
        // For Phase 5 MVP, we'll assume per-user trigger or loop through users here.
        // Let's implement single-user logic first for testing.
        if (!user_id) {
            return new Response(JSON.stringify({ error: "user_id required for Phase 5 MVP" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`[Pattern Recognition] Analyzing behavior for ${user_id}...`);

        // 1. Fetch Recent Decisions (Last 14 days)
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const { data: decisions, error } = await supabaseClient
            .from('agent_decisions')
            .select('*')
            .eq('user_id', user_id)
            .gte('created_at', twoWeeksAgo.toISOString());

        if (error) throw error;

        if (!decisions || decisions.length === 0) {
            return new Response(JSON.stringify({ message: "No decisions to analyze" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`[Pattern Recognition] Found ${decisions.length} decisions`);

        // 2. Fetch Current Patterns
        const currentPatterns = await getUserPatterns(supabaseClient, user_id);
        const newPatterns: Partial<UserPatterns> = {};
        const insights: string[] = [];

        // 3. ANALYSIS LOGIC

        // A. Conflict Resolution Style
        // Look for 'negotiator' decisions where user picked a strategy
        const resolutionDecisions = decisions.filter(
            d => d.agent_name === 'negotiator' && d.decision_type === 'conflict_resolution_generated' && d.option_chosen
        );

        if (resolutionDecisions.length >= 3) {
            const styleCounts: Record<string, number> = {};

            resolutionDecisions.forEach(d => {
                // Heuristic: Check if chosen option title/id maps to a style
                // (This relies on how Negotiator names strategies)
                const chosenId = d.option_chosen;
                // We'd need to look at options_presented to know what 'strategy_1' implies if IDs are generic.
                // Assuming strategy IDs might contain keywords like 'protect', 'compromise', 'reschedule'
                // Or we look at the 'impact' field in the presented options.

                const chosenOption = (d.options_presented as any[])?.find((opt: any) => opt.id === chosenId);
                if (chosenOption) {
                    if (chosenOption.title.toLowerCase().includes('protect') || chosenOption.impact === 'High') {
                        styleCounts['protect_focus'] = (styleCounts['protect_focus'] || 0) + 1;
                    } else if (chosenOption.title.toLowerCase().includes('reschedule') || chosenOption.title.toLowerCase().includes('move')) {
                        styleCounts['hit_deadlines'] = (styleCounts['hit_deadlines'] || 0) + 1;
                    } else {
                        styleCounts['balanced'] = (styleCounts['balanced'] || 0) + 1;
                    }
                }
            });

            // Find dominant style
            const dominant = Object.entries(styleCounts).reduce((a, b) => a[1] > b[1] ? a : b);

            if (dominant[1] >= 3 && dominant[0] !== currentPatterns.conflict_resolution_style) {
                newPatterns.conflict_resolution_style = dominant[0] as any;
                insights.push(`User prefers '${dominant[0]}' resolution style (${dominant[1]} recent choices).`);
            }
        }

        // B. Deep Work Preference
        // Look for 'compose-day' edits or feedback (if we had specific logs for task moves)
        // For now, let's infer from 'guardian' warnings ignored vs acted upon? 
        // Or simpler: Average Task Duration from 'extract-task' decisions if we logged them.

        // Placeholder for Deep Work refinement
        // if (extractedTasks.length > 10) { ... }

        // 4. Update Context & Notify
        if (Object.keys(newPatterns).length > 0) {
            console.log('Detected new patterns:', newPatterns);

            for (const [key, value] of Object.entries(newPatterns)) {
                await updateUserPattern(
                    supabaseClient,
                    user_id,
                    key,
                    value,
                    'pattern-recognition',
                    0.8 // High confidence derived from data
                );
            }

            // Publish Event
            await publishEvent(
                supabaseClient,
                user_id,
                'user.pattern.updated',
                'pattern-recognition',
                {
                    updates: newPatterns,
                    insights
                }
            );

            // Create a Proactive Suggestion to inform the user (Positive Reinforcement)
            await supabaseClient.from('proactive_suggestions').insert({
                user_id,
                type: 'pattern_update',
                message: `I've noticed your preference for ${insights[0].split(' ')[2]}. I've updated your settings.`,
                action_type: 'view_settings',
                action_payload: {},
                status: 'pending'
            });
        }

        return new Response(JSON.stringify({
            success: true,
            analyzed: decisions.length,
            updates: newPatterns,
            insights
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('Pattern recognition failed:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
