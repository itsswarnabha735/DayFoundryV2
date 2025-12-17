-- Migration: Update tasks category constraint for "Category First" extraction
-- 1. Drop the old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;

-- 2. Migrate existing data (Best effort mapping)
-- Map old 'appointment' -> 'meeting'
UPDATE tasks SET category = 'meeting' WHERE category = 'appointment';
-- Map old 'shopping', 'pickup', 'dropoff' -> 'errand'
UPDATE tasks SET category = 'errand' WHERE category IN ('shopping', 'pickup', 'dropoff');
-- Map 'other' -> 'admin' (assuming 'other' was mostly misc tasks)
UPDATE tasks SET category = 'admin' WHERE category = 'other';

-- 3. Add the new constraint with "Glossary of Types"
-- deep_work: High cognitive load
-- admin: Low cognitive load, routine
-- meeting: Synchronous communication
-- errand: Physical movement/travel
ALTER TABLE tasks 
ADD CONSTRAINT tasks_category_check 
CHECK (category IN ('deep_work', 'admin', 'meeting', 'errand') OR category IS NULL);

-- 4. Verify
-- Select distinct categories to ensure no invalid data remains (though the check constraint would fail if so, unless we did it after)
-- We run updates first, then add constraint.
