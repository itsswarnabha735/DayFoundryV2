-- Migration: 20251216_create_shared_context_tables.sql

-- 1. Create table for storing learned User Patterns and Context
CREATE TABLE IF NOT EXISTS agent_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,  -- e.g., 'pattern', 'session', 'decision'
  context_key TEXT NOT NULL,   -- e.g., 'preferred_deep_work_hours'
  context_value JSONB NOT NULL,
  confidence_score FLOAT DEFAULT 0.5,
  last_updated_by TEXT,        -- Which agent wrote this
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, context_type, context_key)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_agent_context_user_type ON agent_context(user_id, context_type);
CREATE INDEX IF NOT EXISTS idx_agent_context_updated ON agent_context(updated_at DESC);

-- RLS for agent_context
ALTER TABLE agent_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own context" ON agent_context 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all context" ON agent_context 
  FOR ALL USING (auth.role() = 'service_role');


-- 2. Create table for tracking Agent Decisions (for future learning/RLHF)
CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,     -- e.g., 'guardian', 'negotiator', 'compose', 'bundler'
  decision_type TEXT NOT NULL,  -- e.g., 'conflict_resolution', 'bundle_acceptance'
  context JSONB NOT NULL,       -- What was the situation (inputs)
  options_presented JSONB,      -- What options were generated
  option_chosen TEXT,           -- Which option was selected (by user or auto)
  was_modified BOOLEAN DEFAULT false, -- Did user modify the suggestion?
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_agent_decisions_user_agent ON agent_decisions(user_id, agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_type ON agent_decisions(decision_type);

-- RLS for agent_decisions
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decisions" ON agent_decisions 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own decisions" ON agent_decisions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all decisions" ON agent_decisions 
  FOR ALL USING (auth.role() = 'service_role');
