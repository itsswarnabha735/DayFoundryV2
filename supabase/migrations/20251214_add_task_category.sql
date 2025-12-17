-- Add category column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('deep_work', 'admin', 'meeting', 'errand', 'task'));

-- Add comment
COMMENT ON COLUMN tasks.category IS 'The type/category of the task extracted by AI or set by user';
