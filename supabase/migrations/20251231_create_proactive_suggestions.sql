-- Migration: 20251231_create_proactive_suggestions.sql

CREATE TABLE IF NOT EXISTS proactive_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'morning_briefing', 'unsynced_calendar'
    message TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'compose_day', 'sync_calendar'
    action_payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE proactive_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions"
    ON proactive_suggestions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
    ON proactive_suggestions FOR UPDATE
    USING (auth.uid() = user_id);

-- Service Role full access
CREATE POLICY "Service Role full access"
    ON proactive_suggestions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
