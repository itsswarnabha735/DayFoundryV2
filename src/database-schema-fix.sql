-- Day Foundry Database Schema Fixes
-- Execute this SQL in your Supabase SQL Editor to fix RLS policies

-- Fix RLS policies for tables with TEXT user_id columns
-- These need to cast auth.uid() to TEXT for comparison

-- Tasks policies (user_id is TEXT)
DROP POLICY IF EXISTS "tasks_policy" ON tasks;
CREATE POLICY "tasks_policy" ON tasks FOR ALL USING (auth.uid()::TEXT = user_id);

-- Events policies (user_id is TEXT)
DROP POLICY IF EXISTS "events_policy" ON events;
CREATE POLICY "events_policy" ON events FOR ALL USING (auth.uid()::TEXT = user_id);

-- Outcomes policies (user_id is TEXT)
DROP POLICY IF EXISTS "outcomes_policy" ON outcomes;
CREATE POLICY "outcomes_policy" ON outcomes FOR ALL USING (auth.uid()::TEXT = user_id);

-- Captured items policies (user_id is UUID) - keep as is but make more explicit
DROP POLICY IF EXISTS "captured_items_policy" ON captured_items;
CREATE POLICY "captured_items_policy" ON captured_items FOR ALL USING (auth.uid() = user_id);

-- Schedule blocks policies (user_id is UUID) - keep as is
DROP POLICY IF EXISTS "schedule_blocks_policy" ON schedule_blocks;
CREATE POLICY "schedule_blocks_policy" ON schedule_blocks FOR ALL USING (auth.uid() = user_id);

-- History policies (user_id is UUID) - keep as is
DROP POLICY IF EXISTS "history_policy" ON history;
CREATE POLICY "history_policy" ON history FOR ALL USING (auth.uid() = user_id);

-- Settings policies (user_id is UUID) - keep as is
DROP POLICY IF EXISTS "settings_policy" ON settings;
CREATE POLICY "settings_policy" ON settings FOR ALL USING (auth.uid() = user_id);

-- Add additional policies for authenticated users to ensure they can insert/update their own data
-- These policies are more explicit about INSERT permissions

-- Tasks - Allow authenticated users to insert/update their own tasks
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
CREATE POLICY "tasks_insert_policy" ON tasks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
CREATE POLICY "tasks_update_policy" ON tasks FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

-- Events - Allow authenticated users to insert/update their own events
DROP POLICY IF EXISTS "events_insert_policy" ON events;
CREATE POLICY "events_insert_policy" ON events FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

DROP POLICY IF EXISTS "events_update_policy" ON events;
CREATE POLICY "events_update_policy" ON events FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

-- Outcomes - Allow authenticated users to insert/update their own outcomes
DROP POLICY IF EXISTS "outcomes_insert_policy" ON outcomes;
CREATE POLICY "outcomes_insert_policy" ON outcomes FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

DROP POLICY IF EXISTS "outcomes_update_policy" ON outcomes;
CREATE POLICY "outcomes_update_policy" ON outcomes FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

-- Captured items - Allow authenticated users to insert/update their own captured items
DROP POLICY IF EXISTS "captured_items_insert_policy" ON captured_items;
CREATE POLICY "captured_items_insert_policy" ON captured_items FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "captured_items_update_policy" ON captured_items;
CREATE POLICY "captured_items_update_policy" ON captured_items FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Schedule blocks - Allow authenticated users to insert/update their own schedule blocks
DROP POLICY IF EXISTS "schedule_blocks_insert_policy" ON schedule_blocks;
CREATE POLICY "schedule_blocks_insert_policy" ON schedule_blocks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "schedule_blocks_update_policy" ON schedule_blocks;
CREATE POLICY "schedule_blocks_update_policy" ON schedule_blocks FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- History - Allow authenticated users to insert their own history
DROP POLICY IF EXISTS "history_insert_policy" ON history;
CREATE POLICY "history_insert_policy" ON history FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- Settings - Allow authenticated users to insert/update their own settings
DROP POLICY IF EXISTS "settings_insert_policy" ON settings;
CREATE POLICY "settings_insert_policy" ON settings FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_update_policy" ON settings;
CREATE POLICY "settings_update_policy" ON settings FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add RPC function to save schedule blocks atomically
-- This function replaces all blocks for a given date
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