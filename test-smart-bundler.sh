#!/bin/bash

# Test script to manually trigger the smart-bundler Edge Function
# This helps verify if the agent is working correctly

echo "Testing Smart Bundling Agent..."
echo "================================"

# Get the user's JWT token from Supabase
# You'll need to replace this with your actual JWT token
AUTH_TOKEN="YOUR_JWT_TOKEN_HERE"

# Get your Supabase project URL
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2)
ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2)

echo "Supabase URL: $SUPABASE_URL"
echo ""

# Call the smart-bundler function
curl -X POST \
  "${SUPABASE_URL}/functions/v1/smart-bundler" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "user_location": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "preferences": {
      "transport_mode": "driving",
      "max_stops": 3,
      "timezone": "Asia/Kolkata"
    }
  }'

echo ""
echo "================================"
echo "Check the output above for bundle suggestions!"
