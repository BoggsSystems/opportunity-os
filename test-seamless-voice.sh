#!/bin/bash

# Seamless Voice AI Test Script
# Tests complete ChatGPT-like voice conversation flow

echo "🎯 Testing Seamless Voice AI Assistant"
echo "=================================="

echo ""
echo "📱 Step 1: Start Backend with Enhanced Logging"
OPENROUTER_API_KEY="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" \
AI_PROVIDER="openrouter" \
OPENROUTER_MODEL="anthropic/claude-3-haiku" \
pnpm start:dev &
BACKEND_PID=$!
echo "🖥 Backend started with PID: $BACKEND_PID"
sleep 3

echo ""
echo "📱 Step 2: Test Complete Voice Flow"
echo "Testing the complete voice conversation pipeline..."

echo ""
echo "🎤 Test 1: Simple Voice Input"
echo "Testing basic voice recognition and API flow..."
curl -X POST http://localhost:3001/ai/converse \
  -H "Content-Type: application/json" \
  -H "User-Agent: OpportunityOS/1.0 (iOS)" \
  -d '{
    "message": "Hello AI assistant",
    "history": [],
    "context": {
      "workspaceState": "next_action"
    }
  }' | jq '.'

echo ""
echo "🎤 Test 2: Context-Aware Voice Input"
echo "Testing with conversation context..."
curl -X POST http://localhost:3001/ai/converse \
  -H "Content-Type: application/json" \
  -H "User-Agent: OpportunityOS/1.0 (iOS)" \
  -d '{
    "message": "What should I do next?",
    "history": [
      {"role": "user", "text": "Hello AI assistant"},
      {"role": "assistant", "text": "I can help you with various tasks. What would you like to do?"}
    ],
    "context": {
      "workspaceState": "next_action",
      "nextAction": {
        "title": "Continue conversation",
        "reason": "User wants to continue",
        "recommendedAction": "Provide guidance"
      }
    }
  }' | jq '.'

echo ""
echo "🎤 Test 3: Streaming Voice Input"
echo "Testing streaming conversation..."
curl -X POST http://localhost:3001/ai/converse-stream \
  -H "Content-Type: application/json" \
  -H "User-Agent: OpportunityOS/1.0 (iOS)" \
  -d '{
    "message": "Tell me about business outreach",
    "history": [
      {"role": "user", "text": "Hello AI assistant"},
      {"role": "assistant", "text": "I can help you with various tasks. What would you like to do?"},
      {"role": "user", "text": "What should I do next?"}
    ],
    "context": {
      "workspaceState": "drafting"
    }
  }' | while read -r line; do
    echo "📦 $line"
    sleep 0.1
done

echo ""
echo "✅ Voice Pipeline Tests Complete!"
echo ""
echo "🎯 Expected iOS App Behavior:"
echo "- Voice recognition should capture speech"
echo "- Transcript should be sent to backend API"
echo "- AI response should be spoken back to user"
echo "- Conversation should flow seamlessly like ChatGPT"
echo ""
echo "📱 Next Steps:"
echo "1. Run iOS app in simulator"
echo "2. Speak into app using test phrases above"
echo "3. Monitor Xcode console for 🎤 VOICE PIPELINE logs"
echo "4. Verify complete end-to-end flow"
echo ""
echo "🔍 Backend logs should show:"
echo "- 🔍 DEBUG: converse endpoint called"
echo "- 🎤 VOICE PIPELINE: converse request"
echo "- 🎤 VOICE PIPELINE: converse response"
