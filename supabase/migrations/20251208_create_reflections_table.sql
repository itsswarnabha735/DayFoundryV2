-- Create reflections table for daily review entries
-- This stores user reflections on wins, blockers, and improvements

CREATE TABLE IF NOT EXISTS public.reflections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  wins TEXT,
  blockers TEXT,
  change_for_tomorrow TEXT,
  blocker_tags TEXT[] DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON public.reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_date ON public.reflections(date);
CREATE INDEX IF NOT EXISTS idx_reflections_user_date ON public.reflections(user_id, date);

-- Enable Row Level Security
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migration)
DROP POLICY IF EXISTS "Users can view own reflections" ON public.reflections;
DROP POLICY IF EXISTS "Users can insert own reflections" ON public.reflections;
DROP POLICY IF EXISTS "Users can update own reflections" ON public.reflections;
DROP POLICY IF EXISTS "Users can delete own reflections" ON public.reflections;

-- RLS Policies: Users can only access their own reflections
CREATE POLICY "Users can view own reflections" ON public.reflections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflections" ON public.reflections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflections" ON public.reflections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reflections" ON public.reflections
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_reflections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotent migration)
DROP TRIGGER IF EXISTS set_reflections_updated_at ON public.reflections;

CREATE TRIGGER set_reflections_updated_at
  BEFORE UPDATE ON public.reflections
  FOR EACH ROW
  EXECUTE FUNCTION update_reflections_updated_at();

-- RPC Function: insert_reflection
-- This function handles upserting reflections (one per user per day)
CREATE OR REPLACE FUNCTION insert_reflection(
  p_wins TEXT,
  p_blockers TEXT,
  p_change TEXT,
  p_summary TEXT,
  p_blocker_tags TEXT[] DEFAULT '{}'
) RETURNS public.reflections AS $$
DECLARE
  v_result public.reflections;
BEGIN
  INSERT INTO public.reflections (
    user_id, 
    date, 
    wins, 
    blockers, 
    change_for_tomorrow, 
    summary,
    blocker_tags
  )
  VALUES (
    auth.uid(), 
    CURRENT_DATE, 
    p_wins, 
    p_blockers, 
    p_change, 
    p_summary,
    COALESCE(p_blocker_tags, '{}')
  )
  ON CONFLICT (user_id, date) 
  DO UPDATE SET 
    wins = EXCLUDED.wins,
    blockers = EXCLUDED.blockers,
    change_for_tomorrow = EXCLUDED.change_for_tomorrow,
    summary = EXCLUDED.summary,
    blocker_tags = EXCLUDED.blocker_tags,
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_reflection TO authenticated;
