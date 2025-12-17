-- Fix for task category constraint violation with data cleanup

-- 1. Drop the existing constraint so we can clean up data
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;

-- 2. Clean up existing data:
-- Update any NULLs or invalid categories to 'task' (safe default)
-- This fixes the "violated by some row" error by ensuring all rows satisfy the new condition BEFORE we apply it.
UPDATE tasks 
SET category = 'task' 
WHERE category IS NULL 
   OR category NOT IN ('deep_work', 'admin', 'meeting', 'errand', 'task');

-- 3. Add the correct constraint ensuring all current types are included
ALTER TABLE tasks 
ADD CONSTRAINT tasks_category_check 
CHECK (category IN ('deep_work', 'admin', 'meeting', 'errand', 'task'));

-- 4. Add comment explanation
COMMENT ON CONSTRAINT tasks_category_check ON tasks IS 'Ensures task category is one of the valid types';
