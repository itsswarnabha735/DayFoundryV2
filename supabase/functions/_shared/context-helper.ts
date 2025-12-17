import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface UserPatterns {
    preferred_deep_work_hours: string[];
    conflict_resolution_style: 'protect_focus' | 'hit_deadlines' | 'balanced';
    typical_errand_days: string[];
    meeting_buffer_minutes: number;
    average_task_duration_minutes: number;
    // Add other dynamic keys as allowed by the flexible schema
    [key: string]: any;
}

const DEFAULT_PATTERNS: UserPatterns = {
    preferred_deep_work_hours: ['09:00-11:00', '14:00-16:00'],
    conflict_resolution_style: 'protect_focus',
    typical_errand_days: ['Saturday'],
    meeting_buffer_minutes: 15,
    average_task_duration_minutes: 60
};

/**
 * Fetches user patterns from agent_context and merges with defaults.
 */
export async function getUserPatterns(
    supabase: SupabaseClient,
    userId: string
): Promise<UserPatterns> {
    const { data, error } = await supabase
        .from('agent_context')
        .select('context_key, context_value')
        .eq('user_id', userId)
        .eq('context_type', 'pattern');

    if (error) {
        console.error('Error fetching user patterns:', error);
        return DEFAULT_PATTERNS;
    }

    // Merge learned patterns over defaults
    const learnedPatterns = (data || []).reduce((acc: any, curr: any) => {
        acc[curr.context_key] = curr.context_value;
        return acc;
    }, {});

    return { ...DEFAULT_PATTERNS, ...learnedPatterns };
}

/**
 * Updates or creates a user pattern with provenance tracking.
 */
export async function updateUserPattern(
    supabase: SupabaseClient,
    userId: string,
    key: string,
    value: any,
    agentName: string,
    confidence: number = 0.5
): Promise<void> {
    const { error } = await supabase.from('agent_context').upsert({
        user_id: userId,
        context_type: 'pattern',
        context_key: key,
        context_value: value,
        confidence_score: confidence,
        last_updated_by: agentName,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,context_type,context_key' });

    if (error) {
        console.error(`Error updating pattern ${key}:`, error);
    }
}

/**
 * Records an agent decision for future learning (RLHF).
 */
export async function recordDecision(
    supabase: SupabaseClient,
    userId: string,
    agentName: string,
    decisionType: string,
    context: object,
    optionsPresented: object[] | null,
    optionChosen: string | null
): Promise<void> {
    const { error } = await supabase.from('agent_decisions').insert({
        user_id: userId,
        agent_name: agentName,
        decision_type: decisionType,
        context,
        options_presented: optionsPresented,
        option_chosen: optionChosen
    });

    if (error) {
        console.error('Error recording decision:', error);
    }
}
