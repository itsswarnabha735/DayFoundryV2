-- Create estimate_multipliers table for storing learned estimation multipliers
-- This powers the Learning Section in the Review tab

CREATE TABLE IF NOT EXISTS public.estimate_multipliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'deep_work', 'admin', 'meetings', 'shallow', etc.
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')) DEFAULT 'low',
  confidence_band_low DECIMAL(4,2),
  confidence_band_high DECIMAL(4,2),
  sample_size INTEGER DEFAULT 0,
  last_7_day_trend DECIMAL(4,2), -- positive = overrun, negative = underrun
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_estimate_multipliers_user_id ON public.estimate_multipliers(user_id);
CREATE INDEX IF NOT EXISTS idx_estimate_multipliers_category ON public.estimate_multipliers(category);

-- Enable Row Level Security
ALTER TABLE public.estimate_multipliers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migration)
DROP POLICY IF EXISTS "Users can view own multipliers" ON public.estimate_multipliers;
DROP POLICY IF EXISTS "Users can insert own multipliers" ON public.estimate_multipliers;
DROP POLICY IF EXISTS "Users can update own multipliers" ON public.estimate_multipliers;
DROP POLICY IF EXISTS "Users can delete own multipliers" ON public.estimate_multipliers;

-- RLS Policies
CREATE POLICY "Users can view own multipliers" ON public.estimate_multipliers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own multipliers" ON public.estimate_multipliers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own multipliers" ON public.estimate_multipliers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own multipliers" ON public.estimate_multipliers
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_estimate_multipliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_estimate_multipliers_updated_at ON public.estimate_multipliers;

CREATE TRIGGER set_estimate_multipliers_updated_at
  BEFORE UPDATE ON public.estimate_multipliers
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_multipliers_updated_at();

-- RPC function to upsert multiplier and set as default
CREATE OR REPLACE FUNCTION upsert_estimate_multiplier(
  p_category TEXT,
  p_multiplier DECIMAL,
  p_confidence TEXT DEFAULT 'low',
  p_sample_size INTEGER DEFAULT 0,
  p_is_default BOOLEAN DEFAULT false
) RETURNS public.estimate_multipliers AS $$
DECLARE
  v_result public.estimate_multipliers;
BEGIN
  INSERT INTO public.estimate_multipliers (
    user_id, 
    category, 
    multiplier, 
    confidence,
    sample_size,
    is_default
  )
  VALUES (
    auth.uid(), 
    p_category, 
    p_multiplier, 
    p_confidence,
    p_sample_size,
    p_is_default
  )
  ON CONFLICT (user_id, category) 
  DO UPDATE SET 
    multiplier = EXCLUDED.multiplier,
    confidence = EXCLUDED.confidence,
    sample_size = EXCLUDED.sample_size,
    is_default = EXCLUDED.is_default,
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_estimate_multiplier TO authenticated;
