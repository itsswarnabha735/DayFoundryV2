-- Migration: 20251231_add_insert_policy_suggestions.sql

CREATE POLICY "Users can insert their own suggestions"
    ON proactive_suggestions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
