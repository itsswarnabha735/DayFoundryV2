-- Create user_preferences table with all preference columns
-- This table stores all user scheduling preferences set during onboarding
-- and configurable via Settings > Work & Scheduling

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Privacy settings
    privacy_mode TEXT DEFAULT 'cloud' CHECK (privacy_mode IN ('local', 'cloud')),
    
    -- Working hours
    working_hours_start TEXT DEFAULT '09:00',
    working_hours_end TEXT DEFAULT '17:00',
    
    -- Break preferences
    break_duration INTEGER DEFAULT 15 CHECK (break_duration >= 5 AND break_duration <= 60),
    break_frequency INTEGER DEFAULT 90 CHECK (break_frequency >= 30 AND break_frequency <= 180),
    interruption_budget INTEGER DEFAULT 3 CHECK (interruption_budget >= 0 AND interruption_budget <= 10),
    
    -- Protected time windows (no meetings allowed)
    no_meeting_windows JSONB DEFAULT '[]'::jsonb,
    
    -- Scheduling preferences
    conflict_resolution_style TEXT DEFAULT 'balanced' 
        CHECK (conflict_resolution_style IN ('aggressive', 'balanced', 'conservative')),
    
    -- Notifications
    notifications_enabled BOOLEAN DEFAULT false,
    
    -- Timezone
    timezone TEXT DEFAULT 'UTC',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint: one preferences row per user
    CONSTRAINT unique_user_preferences UNIQUE (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Add table comments
COMMENT ON TABLE public.user_preferences IS 'Stores user scheduling preferences from onboarding and settings';
COMMENT ON COLUMN public.user_preferences.privacy_mode IS 'local = device only, cloud = synced';
COMMENT ON COLUMN public.user_preferences.no_meeting_windows IS 'Array of {start, end, label} for protected focus time';
COMMENT ON COLUMN public.user_preferences.conflict_resolution_style IS 'aggressive=prioritize deadlines, conservative=minimize changes';
