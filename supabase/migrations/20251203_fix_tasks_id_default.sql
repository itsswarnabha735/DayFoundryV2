-- Fix tasks table to add default UUID generation for id column
-- This fixes the "null value in column id" error
-- Run this in Supabase SQL Editor BEFORE the previous migration

-- First, check if tasks table exists and what its structure is
-- If tasks table doesn't have proper id default, add it

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure id column has default UUID generation
ALTER TABLE tasks 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify the change
SELECT column_name, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name = 'id';
