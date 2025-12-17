-- Create task_time_logs table for tracking actual task duration
-- This enables estimate accuracy calculations by comparing actual vs estimated time

CREATE TABLE IF NOT EXISTS public.task_time_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_time_logs_user_id ON public.task_time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_started_at ON public.task_time_logs(started_at);

-- Enable Row Level Security
ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migration)
DROP POLICY IF EXISTS "Users can view own time logs" ON public.task_time_logs;
DROP POLICY IF EXISTS "Users can insert own time logs" ON public.task_time_logs;
DROP POLICY IF EXISTS "Users can update own time logs" ON public.task_time_logs;
DROP POLICY IF EXISTS "Users can delete own time logs" ON public.task_time_logs;

-- RLS Policies
CREATE POLICY "Users can view own time logs" ON public.task_time_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time logs" ON public.task_time_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time logs" ON public.task_time_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time logs" ON public.task_time_logs
  FOR DELETE USING (auth.uid() = user_id);

-- View to calculate duration in minutes
CREATE OR REPLACE VIEW public.task_time_logs_with_duration AS
SELECT 
  id,
  user_id,
  task_id,
  started_at,
  ended_at,
  notes,
  CASE 
    WHEN ended_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
    ELSE NULL
  END AS duration_minutes,
  created_at
FROM public.task_time_logs;

-- Grant access to the view
GRANT SELECT ON public.task_time_logs_with_duration TO authenticated;
