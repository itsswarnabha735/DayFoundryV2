-- Day Foundry Database Schema
-- Execute this SQL in your Supabase SQL Editor

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL, -- Changed to TEXT to support anonymous users
  title TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  acceptance TEXT,
  est_min INTEGER,
  est_most INTEGER,
  est_max INTEGER,
  energy TEXT NOT NULL CHECK (energy IN ('deep', 'shallow')),
  deadline TIMESTAMPTZ,
  tags JSONB NOT NULL DEFAULT '[]',
  context TEXT,
  location TEXT,
  source TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL, -- Changed to TEXT to support anonymous users
  calendar_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  tz TEXT,
  hard BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL,
  external_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Outcomes table
CREATE TABLE IF NOT EXISTS outcomes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL, -- Changed to TEXT to support anonymous users
  title TEXT NOT NULL,
  risks JSONB NOT NULL DEFAULT '[]',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schedule blocks table
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('deep_work', 'meeting', 'admin', 'buffer', 'micro_break', 'errand', 'travel', 'prep', 'debrief')),
  task_id TEXT REFERENCES tasks(id),
  event_id TEXT REFERENCES events(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  rationale TEXT,
  explain JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History table
CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id),
  planned_dur_min INTEGER,
  actual_dur_min INTEGER,
  deviation_min INTEGER,
  blockers JSONB NOT NULL DEFAULT '[]',
  occurred_on DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  work_hours JSONB NOT NULL DEFAULT '{}',
  no_meeting_windows JSONB NOT NULL DEFAULT '[]',
  energy_prefs JSONB NOT NULL DEFAULT '{}',
  break_prefs JSONB NOT NULL DEFAULT '{"interval_min": 90, "break_min": 15}',
  interruption_budget_min INTEGER NOT NULL DEFAULT 60,
  privacy_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Captured items table for Inbox
CREATE TABLE IF NOT EXISTS captured_items (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('text', 'voice', 'camera')),
  processed BOOLEAN NOT NULL DEFAULT false,
  task_draft JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at);

CREATE INDEX IF NOT EXISTS idx_outcomes_user_id ON outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_deleted_at ON outcomes(deleted_at);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_user_id ON schedule_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(date);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_start_at ON schedule_blocks(start_at);

CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_occurred_on ON history(occurred_on);

CREATE INDEX IF NOT EXISTS idx_captured_items_user_id ON captured_items(user_id);
CREATE INDEX IF NOT EXISTS idx_captured_items_processed ON captured_items(processed);
CREATE INDEX IF NOT EXISTS idx_captured_items_created_at ON captured_items(created_at);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Tasks policies
DROP POLICY IF EXISTS "tasks_policy" ON tasks;
CREATE POLICY "tasks_policy" ON tasks FOR ALL USING (auth.uid() = user_id);

-- Events policies
DROP POLICY IF EXISTS "events_policy" ON events;
CREATE POLICY "events_policy" ON events FOR ALL USING (auth.uid() = user_id);

-- Outcomes policies
DROP POLICY IF EXISTS "outcomes_policy" ON outcomes;
CREATE POLICY "outcomes_policy" ON outcomes FOR ALL USING (auth.uid() = user_id);

-- Schedule blocks policies
DROP POLICY IF EXISTS "schedule_blocks_policy" ON schedule_blocks;
CREATE POLICY "schedule_blocks_policy" ON schedule_blocks FOR ALL USING (auth.uid() = user_id);

-- History policies
DROP POLICY IF EXISTS "history_policy" ON history;
CREATE POLICY "history_policy" ON history FOR ALL USING (auth.uid() = user_id);

-- Settings policies
DROP POLICY IF EXISTS "settings_policy" ON settings;
CREATE POLICY "settings_policy" ON settings FOR ALL USING (auth.uid() = user_id);

-- Captured items policies
DROP POLICY IF EXISTS "captured_items_policy" ON captured_items;
CREATE POLICY "captured_items_policy" ON captured_items FOR ALL USING (auth.uid() = user_id);

-- Create RPC function to record plan vs actual
CREATE OR REPLACE FUNCTION record_plan_actual(
  p_user_id UUID,
  p_task_id TEXT,
  p_planned_min INTEGER,
  p_actual_min INTEGER,
  p_blockers JSONB DEFAULT '[]',
  p_notes TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  history_id TEXT;
  deviation_min INTEGER;
BEGIN
  -- Check if user is authorized
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  -- Calculate deviation
  deviation_min := p_actual_min - p_planned_min;

  -- Generate history ID
  history_id := gen_random_uuid()::TEXT;

  -- Insert history record
  INSERT INTO history (
    id,
    user_id,
    task_id,
    planned_dur_min,
    actual_dur_min,
    deviation_min,
    blockers,
    occurred_on,
    notes,
    created_at
  ) VALUES (
    history_id,
    p_user_id,
    p_task_id,
    p_planned_min,
    p_actual_min,
    deviation_min,
    p_blockers,
    CURRENT_DATE,
    p_notes,
    NOW()
  );

  RETURN history_id;
END;
$;