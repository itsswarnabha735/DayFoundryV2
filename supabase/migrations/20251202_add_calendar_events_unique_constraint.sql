-- Add unique constraint for calendar events
-- This allows us to upsert events based on calendar_connection_id + external_id
alter table public.calendar_events
  add constraint calendar_events_connection_external_unique
  unique (calendar_connection_id, external_id);
