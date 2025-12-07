-- Day Foundry Database Final Fix
-- This standardizes all user_id columns to UUID and fixes all RLS policies
-- Execute this SQL in your Supabase SQL Editor

-- STEP 1: Completely disable RLS on all tables to prevent any conflicts
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY; 
ALTER TABLE outcomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE history DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL existing policies (comprehensive list)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on all tables
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- STEP 3: Standardize all user_id columns to UUID
-- Convert TEXT user_id columns to UUID (tasks, events, outcomes)

-- For tasks table
ALTER TABLE tasks ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- For events table  
ALTER TABLE events ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- For outcomes table
ALTER TABLE outcomes ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- The other tables (schedule_blocks, history, settings, captured_items) already have UUID user_id

-- STEP 4: Add foreign key constraints for data integrity
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE events ADD CONSTRAINT fk_events_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE outcomes ADD CONSTRAINT fk_outcomes_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Foreign keys already exist for the other tables, but let's ensure they're correct
ALTER TABLE schedule_blocks DROP CONSTRAINT IF EXISTS fk_schedule_blocks_user_id;
ALTER TABLE schedule_blocks ADD CONSTRAINT fk_schedule_blocks_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE history DROP CONSTRAINT IF EXISTS fk_history_user_id;
ALTER TABLE history ADD CONSTRAINT fk_history_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE settings DROP CONSTRAINT IF EXISTS fk_settings_user_id;
ALTER TABLE settings ADD CONSTRAINT fk_settings_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE captured_items DROP CONSTRAINT IF EXISTS fk_captured_items_user_id;
ALTER TABLE captured_items ADD CONSTRAINT fk_captured_items_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- STEP 5: Re-enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create simple, consistent RLS policies
-- Now ALL tables have UUID user_id, so we can use auth.uid() directly everywhere

-- Tasks policies
CREATE POLICY "tasks_access" ON tasks
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Events policies
CREATE POLICY "events_access" ON events
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Outcomes policies
CREATE POLICY "outcomes_access" ON outcomes
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Schedule blocks policies
CREATE POLICY "schedule_blocks_access" ON schedule_blocks
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- History policies
CREATE POLICY "history_access" ON history
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Settings policies
CREATE POLICY "settings_access" ON settings
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Captured items policies
CREATE POLICY "captured_items_access" ON captured_items
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- STEP 7: Update the helper functions to use UUID consistently
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

-- STEP 8: Test the fix
SELECT 
  'Database schema standardized successfully!' as message,
  auth.uid() as current_user_id,
  (SELECT COUNT(*) FROM information_schema.columns WHERE column_name = 'user_id' AND data_type = 'uuid') as uuid_columns,
  (SELECT COUNT(*) FROM information_schema.columns WHERE column_name = 'user_id' AND data_type = 'text') as text_columns;