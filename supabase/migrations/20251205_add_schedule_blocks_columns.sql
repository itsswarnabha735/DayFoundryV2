-- Migration: Add missing columns to schedule_blocks table
-- Run this in Supabase SQL Editor

-- Add date column if it doesn't exist
ALTER TABLE schedule_blocks 
ADD COLUMN IF NOT EXISTS date DATE;

-- Update existing rows to set date from start_at
UPDATE schedule_blocks 
SET date = DATE(start_at AT TIME ZONE 'UTC')
WHERE date IS NULL;

-- Make date NOT NULL after populating existing rows
ALTER TABLE schedule_blocks 
ALTER COLUMN date SET NOT NULL;

-- Add pinned column if it doesn't exist
ALTER TABLE schedule_blocks 
ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

-- Add rationale column if it doesn't exist
ALTER TABLE schedule_blocks 
ADD COLUMN IF NOT EXISTS rationale TEXT;

-- Add explain column if it doesn't exist  
ALTER TABLE schedule_blocks 
ADD COLUMN IF NOT EXISTS explain JSONB NOT NULL DEFAULT '{}';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'schedule_blocks'
ORDER BY ordinal_position;
