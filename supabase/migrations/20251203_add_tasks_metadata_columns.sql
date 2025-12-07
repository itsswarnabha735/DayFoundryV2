-- Add tags, category, and priority columns to tasks table
-- These columns are required by the smart-bundler Edge Function
-- Run this in Supabase SQL Editor

-- 1. Add tags column (array of text)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Add category column (text with check constraint)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS category text;

-- Drop existing constraints if they exist, then recreate
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;

-- Add check constraint for valid categories
ALTER TABLE tasks
ADD CONSTRAINT tasks_category_check 
CHECK (category IN ('shopping', 'pickup', 'dropoff', 'appointment', 'other') OR category IS NULL);

-- 3. Add priority column (text with check constraint)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';

-- Add check constraint for valid priorities
ALTER TABLE tasks  
ADD CONSTRAINT tasks_priority_check 
CHECK (priority IN ('low', 'medium', 'high'));

-- 4. Create index on tags for faster filtering
CREATE INDEX IF NOT EXISTS tasks_tags_idx ON tasks USING GIN (tags);

-- 5. Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('tags', 'category', 'priority');
