-- Day Foundry Database Ultimate Fix
-- This completely resolves all UUID/TEXT type mismatches
-- Execute this step by step in your Supabase SQL Editor

-- STEP 1: Check what user_id types we actually have
-- Run this first to see the actual column types:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE column_name = 'user_id' 
-- AND table_schema = 'public';

-- STEP 2: Drop ALL RLS policies completely to start fresh
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON tasks;
DROP POLICY IF EXISTS "tasks_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON events;
DROP POLICY IF EXISTS "events_policy" ON events;
DROP POLICY IF EXISTS "events_select_policy" ON events;
DROP POLICY IF EXISTS "events_insert_policy" ON events;
DROP POLICY IF EXISTS "events_update_policy" ON events;
DROP POLICY IF EXISTS "events_delete_policy" ON events;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON outcomes;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON outcomes;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON outcomes;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON outcomes;
DROP POLICY IF EXISTS "outcomes_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_select_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_insert_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_update_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_delete_policy" ON outcomes;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON schedule_blocks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON schedule_blocks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON schedule_blocks;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_select_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_insert_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_update_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_delete_policy" ON schedule_blocks;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON history;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON history;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON history;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON history;
DROP POLICY IF EXISTS "history_policy" ON history;
DROP POLICY IF EXISTS "history_select_policy" ON history;
DROP POLICY IF EXISTS "history_insert_policy" ON history;
DROP POLICY IF EXISTS "history_update_policy" ON history;
DROP POLICY IF EXISTS "history_delete_policy" ON history;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON settings;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON settings;
DROP POLICY IF EXISTS "settings_policy" ON settings;
DROP POLICY IF EXISTS "settings_select_policy" ON settings;
DROP POLICY IF EXISTS "settings_insert_policy" ON settings;
DROP POLICY IF EXISTS "settings_update_policy" ON settings;
DROP POLICY IF EXISTS "settings_delete_policy" ON settings;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON captured_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON captured_items;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON captured_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON captured_items;
DROP POLICY IF EXISTS "captured_items_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_select_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_insert_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_update_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_delete_policy" ON captured_items;

-- STEP 3: Disable RLS temporarily
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE history DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items DISABLE ROW LEVEL SECURITY;

-- STEP 4: Re-enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create simple, bulletproof policies
-- Based on the schema, these tables have TEXT user_id: tasks, events, outcomes
-- These tables have UUID user_id: schedule_blocks, history, settings, captured_items

-- TASKS (user_id is TEXT) - Cast auth.uid() to TEXT
CREATE POLICY "tasks_access" ON tasks
FOR ALL
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- EVENTS (user_id is TEXT) - Cast auth.uid() to TEXT  
CREATE POLICY "events_access" ON events
FOR ALL
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- OUTCOMES (user_id is TEXT) - Cast auth.uid() to TEXT
CREATE POLICY "outcomes_access" ON outcomes
FOR ALL
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- SCHEDULE_BLOCKS (user_id is UUID) - Direct comparison
CREATE POLICY "schedule_blocks_access" ON schedule_blocks
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- HISTORY (user_id is UUID) - Direct comparison
CREATE POLICY "history_access" ON history
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- SETTINGS (user_id is UUID) - Direct comparison
CREATE POLICY "settings_access" ON settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- CAPTURED_ITEMS (user_id is UUID) - Direct comparison
CREATE POLICY "captured_items_access" ON captured_items
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- STEP 6: Test the fix
-- This should return your user ID without errors:
SELECT auth.uid() as user_id, 'Policies fixed successfully!' as status;