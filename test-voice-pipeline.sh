#!/bin/bash

# Voice Pipeline Test Script
# Tests the complete backend AI conversation flow

API_BASE="http://localhost:3002"

echo "🧪 Testing Opportunity OS Voice Pipeline Backend"
echo "=========================================="

# Test 1: AI Provider Connection
echo ""
echo "📡 Test 1: AI Provider Connection"
echo "--------------------------------"
curl -s -X POST "$API_BASE/ai/test" \
  -H "Content-Type: application/json" | jq '.'

# Test 2: Basic Conversation (New Session)
echo ""
echo "💬 Test 2: Basic Conversation (New Session)"
echo "-----------------------------------------"
RESPONSE1=$(curl -s -X POST "$API_BASE/ai/converse" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, I need help with job opportunities",
    "history": [],
    "context": {
      "workspaceState": "next_action",
      "nextAction": {
        "title": "Find opportunities",
        "reason": "User needs job opportunities",
        "recommendedAction": "Search for relevant positions"
      }
    }
  }')

echo "$RESPONSE1" | jq '.'

# Extract session ID for next test
SESSION_ID=$(echo "$RESPONSE1" | jq -r '.sessionId')

# Test 3: Continue Conversation (Existing Session)
echo ""
echo "🔄 Test 3: Continue Conversation (Existing Session)"
echo "------------------------------------------------"
curl -s -X POST "$API_BASE/ai/converse" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"What specific steps should I take next?\",
    \"history\": [
      {\"role\": \"user\", \"text\": \"Hello, I need help with job opportunities\"},
      {\"role\": \"assistant\", \"text\": \"I can help you find relevant opportunities\"}
    ],
    \"context\": {
      \"workspaceState\": \"next_action\"
    }
  }" | jq '.'

# Test 4: Streaming Conversation
echo ""
echo "🌊 Test 4: Streaming Conversation"
echo "--------------------------------"
echo "Streaming response (NDJSON format):"
curl -X POST "$API_BASE/ai/converse-stream" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"Can you summarize our conversation?\",
    \"history\": [
      {\"role\": \"user\", \"text\": \"Hello, I need help with job opportunities\"},
      {\"role\": \"assistant\", \"text\": \"I can help you find relevant opportunities\"},
      {\"role\": \"user\", \"text\": \"What specific steps should I take next?\"},
      {\"role\": \"assistant\", \"text\": \"Here are the specific steps...\"}
    ],
    \"context\": {
      \"workspaceState\": \"next_action\"
    }
  }"

echo ""
echo "✅ All backend tests completed!"
echo ""
echo "🔍 Debugging Tips:"
echo "- Check API server logs for detailed conversation flow"
echo "- Verify session IDs are maintained across requests"
echo "- Monitor streaming chunks for proper chunking"
echo "- Test with real OpenRouter API key for production responses"
