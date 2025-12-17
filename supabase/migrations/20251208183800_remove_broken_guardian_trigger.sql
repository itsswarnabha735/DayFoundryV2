-- Migration: Remove Broken Guardian Trigger
-- Description: Drops the trigger_guardian_check function and trigger which depend on missing pg_net extension and invalid keys.
-- The coordination is now handled by the calendar-webhook Edge Function directly.

DROP TRIGGER IF EXISTS on_calendar_event_created ON public.calendar_events;
DROP FUNCTION IF EXISTS public.trigger_guardian_check();
