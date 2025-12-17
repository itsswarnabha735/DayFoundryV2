
-- Migration: 20251231_setup_cron.sql

-- 1. Enable Extensions
-- pg_cron allows scheduling jobs inside Postgres
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- pg_net allows making HTTP requests from Postgres (to call Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule Event Processor
-- Run every 1 minute (or 30 seconds if supported, but cron min is 1 min)
-- NOTE: You MUST replace 'YOUR_PROJECT_REF' and 'YOUR_SERVICE_ROLE_KEY' below!

-- First, unschedule if exists to allow updates
SELECT cron.unschedule('agent-event-processor');

-- Schedule job
SELECT cron.schedule(
  'agent-event-processor',
  '* * * * *', -- Every minute
  $$
  select
    net.http_post(
        url:='https://dmtuhobmqzdlwcpnjuli.supabase.co/functions/v1/agent-event-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Note: dmtuhobmqzdlwcpnjuli is your project ID from previous logs.
-- You just need to provide the Service Role Key.
