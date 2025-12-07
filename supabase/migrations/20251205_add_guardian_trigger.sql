-- Migration: Add Guardian Agent Trigger
-- Description: Triggers the guardian-check Edge Function when a new calendar event is inserted.

-- 1. Create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.trigger_guardian_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url text;
  service_role_key text;
  payload jsonb;
  request_id bigint;
BEGIN
  -- Get project URL and key from secrets (or hardcode if necessary, but secrets are better)
  -- For this environment, we'll assume we can construct the URL or it's stored in a config table.
  -- However, pg_net is the standard way.
  
  -- Construct the payload matching the webhook format or our custom format
  -- We'll send the standard webhook format to match our updated Edge Function logic
  payload = jsonb_build_object(
    'type', 'INSERT',
    'table', 'calendar_events',
    'record', row_to_json(NEW)
  );

  -- Call the Edge Function using pg_net
  -- Note: You need to enable the pg_net extension in your Supabase dashboard if not already enabled.
  -- create extension if not exists pg_net;

  -- Replace with your actual Edge Function URL
  -- We can try to dynamically get it or use a placeholder that the user needs to replace.
  -- Since we don't have the exact URL in SQL, we'll use a placeholder.
  -- BUT, for a smoother experience, we can try to infer it if we knew the project ref.
  -- Let's use a generic URL structure and ask the user to verify.
  
  -- ACTUALLY, a better approach for Supabase is to use the "Database Webhooks" feature in the Dashboard.
  -- But since we need to do this via code/migration:
  
  -- Using pg_net to call the function
  -- We need the ANON_KEY or SERVICE_ROLE_KEY. 
  -- Since we can't easily access env vars in SQL, we will assume the user has set up vault or we'll use a placeholder.
  
  -- ALTERNATIVE: Use `supabase_functions.http_request` if available (newer Supabase versions).
  
  -- Let's try the most standard `net.http_post` approach.
  -- We will assume the URL is standard: https://<project_ref>.supabase.co/functions/v1/guardian-check
  
  -- IMPORTANT: This migration might fail if pg_net is not enabled.
  -- We will wrap it in a DO block to check or just create the function.

  -- For now, let's create the function but comment out the actual http call 
  -- and instruct the user to enable the webhook in the dashboard if this is too complex for SQL.
  
  -- WAIT, the user asked for "Database webhook/trigger". 
  -- The best way is to use `pg_net`.
  
  -- Let's assume the user will replace PROJECT_REF and SERVICE_ROLE_KEY.
  
  PERFORM
    net.http_post(
      url := 'https://dmtuhobmqzdlwcpnjuli.supabase.co/functions/v1/guardian-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := payload
    );

  RETURN NEW;
END;
$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_calendar_event_created ON public.calendar_events;

CREATE TRIGGER on_calendar_event_created
AFTER INSERT ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_guardian_check();

-- NOTE: You must replace <PROJECT_REF> and <SERVICE_ROLE_KEY> in the function above.
-- Alternatively, you can set up this webhook via the Supabase Dashboard:
-- Database -> Webhooks -> Create Webhook -> Table: calendar_events, Event: Insert, Type: HTTP Request
