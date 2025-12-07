-- Migration: Update Alert Status Enum
-- Description: Adds 'resolved' to the allowed values for schedule_alerts.status

ALTER TABLE public.schedule_alerts DROP CONSTRAINT IF EXISTS schedule_alerts_status_check;

ALTER TABLE public.schedule_alerts 
ADD CONSTRAINT schedule_alerts_status_check 
CHECK (status IN ('pending', 'dismissed', 'accepted', 'resolved'));
