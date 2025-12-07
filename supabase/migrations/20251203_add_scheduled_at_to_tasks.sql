-- Add scheduled_at column to tasks table to track when errands are scheduled
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Add index for filtering scheduled tasks
CREATE INDEX IF NOT EXISTS tasks_scheduled_at_idx ON tasks(scheduled_at);
