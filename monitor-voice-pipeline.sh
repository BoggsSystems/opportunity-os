#!/bin/bash

# Voice Pipeline Log Monitor
# Shows both iOS app and backend logs in real-time

echo "🎤 Voice Pipeline Log Monitor"
echo "============================="
echo ""
echo "📱 iOS App Logs (Console)     |     🖥 Backend Logs (API)"
echo "=============================================================="

# Function to get iOS simulator logs
get_ios_logs() {
    # Look for Opportunity OS app logs in Console
    log stream --predicate 'process == "opportunity-os" OR (subsystem == "com.opportunity-os")' --info --debug 2>/dev/null | \
    grep "🎤 VOICE PIPELINE\|HomeConversation\|AssistantAPI\|SpeechRecognition" | \
    while IFS= read -r line; do
        echo "📱 iOS: $line"
    done &
}

# Function to get backend logs
get_backend_logs() {
    # Look for voice pipeline logs in backend
    tail -f /tmp/backend.log 2>/dev/null | \
    grep "🎤 VOICE PIPELINE" | \
    while IFS= read -r line; do
        echo "🖥 API:  $line"
    done &
}

# Start backend log capture
echo "🔧 Starting backend log capture..."
OPENROUTER_API_KEY="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" \
AI_PROVIDER="openrouter" \
OPENROUTER_MODEL="anthropic/claude-3-haiku" \
pnpm start:dev 2>&1 | tee /tmp/backend.log &

BACKEND_PID=$!
echo "🖥 Backend started with PID: $BACKEND_PID"
sleep 3

# Start log monitoring
echo "📱 Starting iOS log monitoring..."
echo ""
echo "💡 Instructions:"
echo "- Speak into your iOS app to see the complete voice pipeline flow"
echo "- Watch for 🎤 VOICE PIPELINE tags in both logs"
echo "- Press Ctrl+C to stop monitoring"
echo ""

# Start both log monitors
get_ios_logs &
get_backend_logs &

# Wait for user interrupt
wait

# Cleanup
echo ""
echo "🛑 Stopping monitors..."
kill $BACKEND_PID 2>/dev/null
pkill -f "log stream" 2>/dev/null
echo "✅ Voice pipeline monitoring stopped"
