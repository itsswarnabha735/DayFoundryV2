
-- Migration: 20251230_create_agent_events.sql
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,  -- 'sync', 'guardian', 'negotiator', 'compose', 'bundler'
  payload JSONB NOT NULL,
  processed_by JSONB DEFAULT '[]'::jsonb,  -- Array of agents that have consumed this
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for unprocessed events per user
CREATE INDEX IF NOT EXISTS idx_agent_events_pending ON agent_events(user_id, created_at DESC) 
  WHERE NOT (processed_by ? 'all');

-- RLS
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON agent_events 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all events" ON agent_events 
  FOR ALL USING (auth.role() = 'service_role');

-- Auto-delete events older than 7 days
CREATE OR REPLACE FUNCTION delete_old_events() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM agent_events WHERE created_at < NOW() - INTERVAL '7 days';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_old_events ON agent_events;
CREATE TRIGGER cleanup_old_events AFTER INSERT ON agent_events
  FOR EACH STATEMENT EXECUTE FUNCTION delete_old_events();
