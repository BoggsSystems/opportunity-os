#!/bin/bash

# iOS API Debug Script
# Tests iOS app API communication step by step

echo "🔍 iOS API Communication Debug"
echo "================================="

echo ""
echo "📱 Step 1: Test iOS App API Configuration"
echo "Testing if iOS app can reach backend..."
curl -X GET http://127.0.0.1:3001/health 2>/dev/null || echo "❌ Health check failed"
echo "✅ Health check passed"
echo ""

echo "📤 Step 2: Test Direct API Call from iOS Network Context"
echo "Simulating iOS app making API call..."
curl -X POST http://127.0.0.1:3001/ai/converse \
  -H "Content-Type: application/json" \
  -H "User-Agent: OpportunityOS/1.0" \
  -d '{
    "message": "test from ios network context",
    "history": [],
    "context": {
      "workspaceState": "next_action"
    }
  }' \
  -w "\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" \
  -o /dev/null \
  -s

echo ""
echo "📊 Step 3: Check iOS App Network Permissions"
echo "iOS apps may need network permissions. Check:"
echo "- Settings → Privacy & Security → Network"
echo "- Ensure 'opportunity-os.com' is allowed"
echo ""

echo "🎯 Step 4: Test Voice Pipeline End-to-End"
echo "Run this test while monitoring iOS logs:"
echo "1. Start this script"
echo "2. Run iOS app in simulator"
echo "3. Speak into app: 'test voice pipeline'"
echo "4. Watch for 🎤 VOICE PIPELINE logs in both places"
echo ""

echo "🔧 Expected Log Sequence:"
echo "iOS: 🎤 VOICE PIPELINE: captured utterance='test voice pipeline'"
echo "iOS: 🎤 VOICE PIPELINE: processing user message shouldSpeak=true message='test voice pipeline'"
echo "iOS: 🎤 VOICE PIPELINE: respond starting sessionId=... message='test voice pipeline'"
echo "Backend: 🎤 VOICE PIPELINE: converse request sessionId=... message='test voice pipeline'"
echo "Backend: 🎤 VOICE PIPELINE: converse response sessionId=... reply='...'"
echo "iOS: 🎤 VOICE PIPELINE: respond completed sessionId=... reply='...'"
echo ""

echo "If you see iOS logs but no backend logs, the issue is:"
echo "- Network connectivity from iOS simulator"
echo "- API base URL mismatch"
echo "- Firewall blocking connection"
