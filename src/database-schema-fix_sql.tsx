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
CREATE POLICY "tasks_insert_policy" ON tasks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "tasks_update_policy" ON tasks FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

-- Events - Allow authenticated users to insert/update their own events
CREATE POLICY "events_insert_policy" ON events FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "events_update_policy" ON events FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

-- Outcomes - Allow authenticated users to insert/update their own outcomes
CREATE POLICY "outcomes_insert_policy" ON outcomes FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "outcomes_update_policy" ON outcomes FOR UPDATE 
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

-- Captured items - Allow authenticated users to insert/update their own captured items
CREATE POLICY "captured_items_insert_policy" ON captured_items FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "captured_items_update_policy" ON captured_items FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Schedule blocks - Allow authenticated users to insert/update their own schedule blocks
CREATE POLICY "schedule_blocks_insert_policy" ON schedule_blocks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "schedule_blocks_update_policy" ON schedule_blocks FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- History - Allow authenticated users to insert their own history
CREATE POLICY "history_insert_policy" ON history FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- Settings - Allow authenticated users to insert/update their own settings
CREATE POLICY "settings_insert_policy" ON settings FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "settings_update_policy" ON settings FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);