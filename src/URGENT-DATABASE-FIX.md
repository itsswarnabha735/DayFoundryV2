# URGENT: Database RLS Policy Fix Required

## Issue
The captured_items table has Row Level Security (RLS) policy violations because of a type mismatch between the `auth.uid()` function (which returns UUID) and some user_id columns (which are TEXT).

## Quick Fix
**IMMEDIATELY run this SQL in your Supabase SQL Editor:**

```sql
-- Fix RLS policies for tables with TEXT user_id columns
DROP POLICY IF EXISTS "tasks_policy" ON tasks;
CREATE POLICY "tasks_policy" ON tasks FOR ALL USING (auth.uid()::TEXT = user_id);

DROP POLICY IF EXISTS "events_policy" ON events;
CREATE POLICY "events_policy" ON events FOR ALL USING (auth.uid()::TEXT = user_id);

DROP POLICY IF EXISTS "outcomes_policy" ON outcomes;
CREATE POLICY "outcomes_policy" ON outcomes FOR ALL USING (auth.uid()::TEXT = user_id);

-- Add explicit INSERT policies for all tables
CREATE POLICY "tasks_insert_policy" ON tasks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "events_insert_policy" ON events FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "outcomes_insert_policy" ON outcomes FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::TEXT = user_id);

CREATE POLICY "captured_items_insert_policy" ON captured_items FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "schedule_blocks_insert_policy" ON schedule_blocks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "history_insert_policy" ON history FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "settings_insert_policy" ON settings FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
```

## After Running the SQL
1. The captured_items RLS errors should stop
2. All database operations should work properly
3. The app should be able to save captured items

## What was fixed
- RLS policies now properly convert UUID to TEXT where needed
- Added explicit INSERT policies for all tables
- Fixed the user_id type mismatch issue