-- Add ai_preferences column to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS ai_preferences JSONB NOT NULL DEFAULT '{"model": "standard"}';

-- Add comment for documentation
COMMENT ON COLUMN user_preferences.ai_preferences IS 'Stores AI model preferences e.g. { "model": "standard" | "pro" }';
