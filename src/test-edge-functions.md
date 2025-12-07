# Edge Function Test Suite

## Quick Test Commands

Copy these commands to test your deployed edge functions:

### 1. Extract Task
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/extract-task' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{"raw_text":"Build login form with email validation and password strength meter - needs to be done by Friday"}'
```

### 2. Propose Outcomes
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/propose-outcomes' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "tasks": [{
      "id": "task-1",
      "title": "Build login form",
      "est_most": 120,
      "energy": "deep"
    }],
    "constraints": {
      "day_start": "2025-09-13T09:00:00Z",
      "day_end": "2025-09-13T17:00:00Z"
    }
  }'
```

### 3. Solve Schedule
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/solve-schedule-proxy' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "date": "2025-09-13",
    "tasks": [{
      "id": "task-1",
      "est_most": 90,
      "energy": "deep"
    }],
    "events": [{
      "id": "event-1",
      "start_at": "2025-09-13T13:00:00Z",
      "end_at": "2025-09-13T14:00:00Z"
    }],
    "constraints": {
      "micro_break_every_min": 50,
      "micro_break_min": 5,
      "interruption_budget_min": 60,
      "day_start": "2025-09-13T09:00:00Z",
      "day_end": "2025-09-13T17:00:00Z"
    }
  }'
```

### 4. Summarize Reflection
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/summarize-reflection' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "wins": "Completed task extraction feature",
    "blockers": "API rate limits slowed testing",
    "change": "Add rate limiting and caching"
  }'
```

### 5. Import ICS Calendar
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/import-ics' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "ics_url": "https://calendar.google.com/calendar/ical/your-calendar.ics",
    "calendar_id": "main-calendar"
  }'
```

## Frontend Integration Status

✅ **EdgeFunctionService** - Created service class for all edge functions
✅ **useEdgeFunctions** - React hook with authentication handling
✅ **TaskDraftSheet** - Uses extract-task function for AI task extraction
✅ **ComposeSheet** - Uses propose-outcomes function for daily outcome generation
✅ **ReviewScreen** - Uses summarize-reflection function for reflection processing
✅ **CalendarImport** - Uses import-ics function for calendar imports

## Error Handling

All frontend integrations include:
- Loading states with visual indicators
- Error handling with user-friendly messages
- Fallback behavior when functions are unavailable
- Retry mechanisms for transient failures

## Next Steps

1. Deploy functions to your Supabase project
2. Set required environment variables
3. Test each function endpoint
4. Update frontend API URLs if needed
5. Monitor function logs for any issues