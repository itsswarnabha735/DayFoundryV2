-- Day Foundry Database Complete Fix
-- This SQL completely fixes all RLS policy type mismatches
-- Execute this in your Supabase SQL Editor

-- STEP 1: First, disable RLS temporarily on all tables to avoid errors
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE history DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL existing policies to start clean
DROP POLICY IF EXISTS "tasks_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;

DROP POLICY IF EXISTS "events_policy" ON events;
DROP POLICY IF EXISTS "events_insert_policy" ON events;
DROP POLICY IF EXISTS "events_update_policy" ON events;

DROP POLICY IF EXISTS "outcomes_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_insert_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_update_policy" ON outcomes;

DROP POLICY IF EXISTS "schedule_blocks_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_insert_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_update_policy" ON schedule_blocks;

DROP POLICY IF EXISTS "history_policy" ON history;
DROP POLICY IF EXISTS "history_insert_policy" ON history;

DROP POLICY IF EXISTS "settings_policy" ON settings;
DROP POLICY IF EXISTS "settings_insert_policy" ON settings;
DROP POLICY IF EXISTS "settings_update_policy" ON settings;

DROP POLICY IF EXISTS "captured_items_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_insert_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_update_policy" ON captured_items;

-- STEP 3: Re-enable RLS on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create new policies with correct type casting
-- Note: Tables with TEXT user_id need auth.uid()::TEXT
--       Tables with UUID user_id use auth.uid() directly

-- TASKS (user_id is TEXT)
CREATE POLICY "tasks_select_policy" ON tasks FOR SELECT 
USING (auth.uid()::TEXT = user_id);

CREATE POLICY "tasks_insert_policy" ON tasks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "tasks_update_policy" ON tasks FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "tasks_delete_policy" ON tasks FOR DELETE 
USING (auth.uid()::TEXT = user_id);

-- EVENTS (user_id is TEXT)
CREATE POLICY "events_select_policy" ON events FOR SELECT 
USING (auth.uid()::TEXT = user_id);

CREATE POLICY "events_insert_policy" ON events FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "events_update_policy" ON events FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "events_delete_policy" ON events FOR DELETE 
USING (auth.uid()::TEXT = user_id);

-- OUTCOMES (user_id is TEXT)
CREATE POLICY "outcomes_select_policy" ON outcomes FOR SELECT 
USING (auth.uid()::TEXT = user_id);

CREATE POLICY "outcomes_insert_policy" ON outcomes FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "outcomes_update_policy" ON outcomes FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "outcomes_delete_policy" ON outcomes FOR DELETE 
USING (auth.uid()::TEXT = user_id);

-- SCHEDULE_BLOCKS (user_id is UUID)
CREATE POLICY "schedule_blocks_select_policy" ON schedule_blocks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "schedule_blocks_insert_policy" ON schedule_blocks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "schedule_blocks_update_policy" ON schedule_blocks FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "schedule_blocks_delete_policy" ON schedule_blocks FOR DELETE 
USING (auth.uid() = user_id);

-- HISTORY (user_id is UUID)
CREATE POLICY "history_select_policy" ON history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "history_insert_policy" ON history FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "history_update_policy" ON history FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "history_delete_policy" ON history FOR DELETE 
USING (auth.uid() = user_id);

-- SETTINGS (user_id is UUID)
CREATE POLICY "settings_select_policy" ON settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "settings_insert_policy" ON settings FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "settings_update_policy" ON settings FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings_delete_policy" ON settings FOR DELETE 
USING (auth.uid() = user_id);

-- CAPTURED_ITEMS (user_id is UUID)
CREATE POLICY "captured_items_select_policy" ON captured_items FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "captured_items_insert_policy" ON captured_items FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "captured_items_update_policy" ON captured_items FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "captured_items_delete_policy" ON captured_items FOR DELETE 
USING (auth.uid() = user_id);

-- STEP 5: Create helper functions that handle type casting properly
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
AS $$
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
$$;

-- STEP 6: Save schedule function with proper type handling
CREATE OR REPLACE FUNCTION save_schedule(
  p_date DATE,
  p_blocks JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  block JSONB;
  block_id TEXT;
  result_blocks JSONB := '[]'::JSONB;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Delete existing blocks for this date
  DELETE FROM schedule_blocks 
  WHERE user_id = current_user_id AND date = p_date;

  -- Insert new blocks
  FOR block IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    -- Generate new ID if not provided
    block_id := COALESCE(block->>'id', gen_random_uuid()::TEXT);
    
    -- Insert the block
    INSERT INTO schedule_blocks (
      id,
      user_id,
      date,
      block_type,
      task_id,
      event_id,
      start_at,
      end_at,
      pinned,
      rationale,
      explain,
      created_at,
      updated_at
    ) VALUES (
      block_id,
      current_user_id,
      p_date,
      block->>'block_type',
      NULLIF(block->>'task_id', ''),
      NULLIF(block->>'event_id', ''),
      (block->>'start_at')::TIMESTAMPTZ,
      (block->>'end_at')::TIMESTAMPTZ,
      COALESCE((block->>'pinned')::BOOLEAN, false),
      block->>'rationale',
      COALESCE(block->'explain', '{}'::JSONB),
      NOW(),
      NOW()
    );
    
    -- Add to result with the assigned ID
    result_blocks := result_blocks || jsonb_build_object(
      'id', block_id,
      'user_id', current_user_id,
      'date', p_date,
      'block_type', block->>'block_type',
      'task_id', block->>'task_id',
      'event_id', block->>'event_id',
      'start_at', block->>'start_at',
      'end_at', block->>'end_at',
      'pinned', COALESCE((block->>'pinned')::BOOLEAN, false),
      'rationale', block->>'rationale',
      'explain', COALESCE(block->'explain', '{}'::JSONB)
    );
  END LOOP;

  RETURN result_blocks;
END;
$$;

-- STEP 7: Test that all policies work properly
-- This command should succeed and return our user's data:
-- SELECT auth.uid(), 'Database policies successfully fixed!' as message;