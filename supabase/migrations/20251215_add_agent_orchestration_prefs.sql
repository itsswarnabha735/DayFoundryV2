-- Migration: 20251215_add_agent_orchestration_prefs.sql

ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS auto_resolve_conflicts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_resolution_strategy TEXT DEFAULT 'protect_focus', -- 'protect_focus', 'hit_deadlines', 'balanced'
ADD COLUMN IF NOT EXISTS auto_bundle_errands BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN user_preferences.auto_resolve_conflicts IS 'If true, Guardian + Orchestrator will automatically apply strategies.';
COMMENT ON COLUMN user_preferences.preferred_resolution_strategy IS 'Guidance for Orchestrator on which Negotiator strategy to pick.';
