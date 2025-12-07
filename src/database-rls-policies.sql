-- Day Foundry Database RLS Policies Setup
-- Run this script in your Supabase SQL editor to set up Row Level Security

-- Enable RLS on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can CRUD their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can CRUD their own events" ON events;
DROP POLICY IF EXISTS "Users can CRUD their own outcomes" ON outcomes;
DROP POLICY IF EXISTS "Users can CRUD their own schedule_blocks" ON schedule_blocks;
DROP POLICY IF EXISTS "Users can CRUD their own history" ON history;
DROP POLICY IF EXISTS "Users can CRUD their own settings" ON settings;
DROP POLICY IF EXISTS "Users can CRUD their own captured_items" ON captured_items;

-- Create policies for tasks
CREATE POLICY "Users can CRUD their own tasks" ON tasks
FOR ALL USING (auth.uid() = user_id);

-- Create policies for events
CREATE POLICY "Users can CRUD their own events" ON events
FOR ALL USING (auth.uid() = user_id);

-- Create policies for outcomes
CREATE POLICY "Users can CRUD their own outcomes" ON outcomes
FOR ALL USING (auth.uid() = user_id);

-- Create policies for schedule_blocks
CREATE POLICY "Users can CRUD their own schedule_blocks" ON schedule_blocks
FOR ALL USING (auth.uid() = user_id);

-- Create policies for history
CREATE POLICY "Users can CRUD their own history" ON history
FOR ALL USING (auth.uid() = user_id);

-- Create policies for settings (note: user_id is text in settings table)
CREATE POLICY "Users can CRUD their own settings" ON settings
FOR ALL USING (auth.uid()::text = user_id);

-- Create policies for captured_items
CREATE POLICY "Users can CRUD their own captured_items" ON captured_items
FOR ALL USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON events TO authenticated;
GRANT ALL ON outcomes TO authenticated;
GRANT ALL ON schedule_blocks TO authenticated;
GRANT ALL ON history TO authenticated;
GRANT ALL ON settings TO authenticated;
GRANT ALL ON captured_items TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;