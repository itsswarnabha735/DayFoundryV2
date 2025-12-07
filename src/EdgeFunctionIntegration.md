# Day Foundry Edge Function Integration Guide

## Overview

This document provides step-by-step instructions for deploying and integrating the 5 Supabase Edge Functions with the Day Foundry frontend application.

## 1. Prerequisites

- Supabase CLI installed and configured
- Day Foundry project deployed to Supabase
- Required API keys and environment variables

## 2. Deployment Steps

### Local Development Setup

1. Create a `.env` file in the project root (copy from `.env.example`).
2. Add your `GEMINI_API_KEY`.
3. The Supabase Edge Functions will automatically pick up this environment variable when running locally.

### Production Deployment

Set environment variables in your Supabase project:

```bash
# From your project root
supabase functions secrets set \
  GEMINI_API_KEY="your-gemini-api-key" \
  LLM_API_KEY="your-openai-api-key" \
  LLM_BASE_URL="https://api.openai.com/v1" \
  SOLVER_URL="" \
  ENABLE_GREEDY_FALLBACK="true" \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_ANON_KEY="your-anon-key" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Deploy Functions

```bash
supabase functions deploy extract-task
supabase functions deploy propose-outcomes
supabase functions deploy summarize-reflection
supabase functions deploy solve-schedule-proxy
supabase functions deploy import-ics
```

## 3. Testing Functions

### Test Task Extraction

```bash
curl -s -X POST 'https://your-project.supabase.co/functions/v1/extract-task' \
  -H 'Authorization: Bearer your-user-jwt' \
  -H 'Content-Type: application/json' \
  -d '{"raw_text":"Prep deck for Q3 review: outline, gather metrics, draft slides; due Fri."}'
```

### Test Outcome Proposal

```bash
curl -s -X POST 'https://your-project.supabase.co/functions/v1/propose-outcomes' \
  -H 'Authorization: Bearer your-user-jwt' \
  -H 'Content-Type: application/json' \
  -d '{
    "tasks":[{
      "id":"task-1",
      "title":"Draft slides",
      "est_most":90,
      "energy":"deep"
    }],
    "constraints":{
      "day_start":"2025-09-13T09:00:00Z",
      "day_end":"2025-09-13T17:00:00Z"
    }
  }'
```

### Test Schedule Solving

```bash
curl -s -X POST 'https://your-project.supabase.co/functions/v1/solve-schedule-proxy' \
  -H 'Authorization: Bearer your-user-jwt' \
  -H 'Content-Type: application/json' \
  -d '{
    "date":"2025-09-13",
    "tasks":[{
      "id":"task-1",
      "est_most":90,
      "energy":"deep"
    }],
    "events":[{
      "id":"event-1",
      "start_at":"2025-09-13T13:00:00Z",
      "end_at":"2025-09-13T14:00:00Z"
    }],
    "constraints":{
      "micro_break_every_min":50,
      "micro_break_min":5,
      "interruption_budget_min":60,
      "day_start":"2025-09-13T09:00:00Z",
      "day_end":"2025-09-13T17:00:00Z"
    }
  }'
```

### Test Reflection Summarization

```bash
curl -s -X POST 'https://your-project.supabase.co/functions/v1/summarize-reflection' \
  -H 'Authorization: Bearer your-user-jwt' \
  -H 'Content-Type: application/json' \
  -d '{
    "wins":"Finished spec",
    "blockers":"late start",
    "change":"start earlier"
  }'
```

### Test ICS Import

```bash
curl -s -X POST 'https://your-project.supabase.co/functions/v1/import-ics' \
  -H 'Authorization: Bearer your-user-jwt' \
  -H 'Content-Type: application/json' \
  -d '{
    "ics_url":"https://calendar.google.com/calendar/ical/your-calendar.ics",
    "calendar_id":"calendar-1"
  }'
```

## 4. Frontend Integration

### Service Layer

The `EdgeFunctionService` class provides a clean interface to all edge functions:

```typescript
import { EdgeFunctionService } from '../utils/services/EdgeFunctionService';

// Create service instance with authentication
const service = new EdgeFunctionService(userToken);

// Extract task from raw text
const result = await service.extractTask("Build login page with validation");

// Propose outcomes for tasks
const outcomes = await service.proposeOutcomes(tasks, constraints);

// Solve schedule
const schedule = await service.solveSchedule({
  date: "2025-09-13",
  tasks,
  events,
  constraints
});
```

### React Hook

The `useEdgeFunctions` hook provides a React-friendly interface:

```typescript
import { useEdgeFunctions } from '../hooks/useEdgeFunctions';

function MyComponent() {
  const { extractTask, isLoading, error } = useEdgeFunctions();
  
  const handleExtract = async () => {
    try {
      const task = await extractTask("Raw capture text");
      // Handle extracted task
    } catch (err) {
      // Handle error
    }
  };
}
```

## 5. Component Updates

### TaskDraftSheet

Updated to use EdgeFunctionService for task extraction:

- Automatically extracts tasks from captured text
- Handles validation and error states
- Fallback to manual editing if extraction fails

### ComposeSheet

Updated to use EdgeFunctionService for outcome proposal:

- Generates 3-5 realistic daily outcomes
- Maps edge function results to UI format
- Handles loading and error states

### Calendar Import

Uses EdgeFunctionService for ICS parsing and import:

- Fetches and parses ICS files
- Upserts events with conflict resolution
- Updates sync timestamps

## 6. Error Handling

All edge functions include comprehensive error handling:

- **Network Errors**: Timeout, connection issues
- **Authentication Errors**: Invalid or expired tokens
- **API Errors**: LLM rate limits, invalid responses
- **Validation Errors**: Missing required fields

Error responses include:
```json
{
  "error": "Descriptive error message",
  "details": "Additional context when available"
}
```

## 7. Performance Considerations

### Caching

- Cache extracted tasks to avoid re-processing
- Store outcome proposals for reuse during the day
- Cache schedule solutions until tasks/constraints change

### Rate Limiting

- Implement client-side rate limiting for LLM calls
- Show appropriate loading states
- Provide fallback options when APIs are unavailable

### Offline Support

- Queue function calls when offline
- Sync results when connection resumes
- Provide offline-first fallbacks where possible

## 8. Security Notes

- API keys are server-side only, never exposed to frontend
- User authentication required for all sensitive operations
- Row Level Security (RLS) enforced on database operations
- CORS properly configured for frontend origins

## 9. Monitoring and Logs

### Function Logs

Monitor function execution in Supabase Dashboard:
- Navigate to Edge Functions → Logs
- Filter by function name and date range
- Monitor error rates and response times

### Frontend Monitoring

Track integration health in your application:
- Success/failure rates for each function
- Average response times
- User error reports

## 10. Troubleshooting

### Common Issues

1. **"API key required" errors**
   - Verify LLM_API_KEY is set correctly
   - Check API key has sufficient credits/permissions

2. **"Authorization failed" errors**
   - Ensure user is authenticated
   - Check token hasn't expired
   - Verify RLS policies allow operation

3. **"Function timeout" errors**
   - Check network connectivity
   - Verify external API availability
   - Consider implementing retries

4. **"Invalid response" errors**
   - Check LLM response format
   - Verify input data validation
   - Review function logs for details

### Debug Mode

Enable debug logging in development:

```typescript
const service = new EdgeFunctionService(token, { debug: true });
```

This will log request/response details to browser console.

## 11. Next Steps

After successful deployment:

1. **Monitor Performance**: Track function response times and error rates
2. **Optimize Prompts**: Refine LLM prompts based on real usage
3. **Add Features**: Implement additional AI-powered features
4. **Scale Infrastructure**: Upgrade Supabase plan if needed
5. **User Feedback**: Collect and incorporate user feedback on AI features

## 12. Support

For issues with:
- **Edge Functions**: Check Supabase documentation and community
- **Day Foundry Integration**: Review this guide and component code
- **LLM Performance**: Adjust prompts and model parameters
- **Database Issues**: Check RLS policies and table schemas