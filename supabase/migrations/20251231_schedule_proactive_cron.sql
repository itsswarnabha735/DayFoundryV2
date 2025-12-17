-- Migration: 20251231_schedule_proactive_cron.sql

-- 1. Schedule Proactive Scheduler
-- Run every hour (at minute 0)
-- The function itself checks if it's the "Right Time" (Morning) for the user.

SELECT cron.schedule(
  'proactive-scheduler',
  '0 * * * *', -- Every hour
  $$
  select
    net.http_post(
        url:='https://dmtuhobmqzdlwcpnjuli.supabase.co/functions/v1/proactive-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- 2. Schedule Pattern Recognition Agent
-- Run weekly (e.g., Sunday at midnight)
SELECT cron.schedule(
  'pattern-recognition',
  '0 0 * * 0', -- Every Sunday at 00:00
  $$
  select
    net.http_post(
        url:='https://dmtuhobmqzdlwcpnjuli.supabase.co/functions/v1/pattern-recognition',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{"mode": "weekly_cron"}'::jsonb
    ) as request_id;
  $$
);

-- 2. "Run Now" Helper (For Verification)
-- Copy/Paste this part separately to trigger immediate check
/*
select
net.http_post(
    url:='https://dmtuhobmqzdlwcpnjuli.supabase.co/functions/v1/proactive-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{}'::jsonb
) as request_id;
*/
