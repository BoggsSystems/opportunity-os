# iOS API Logging Setup for Xcode Console

## 🎯 Goal
See every voice conversation API call in Xcode console with complete request/response details.

## 📱 Current iOS Logging

The iOS app already has some logging, but we need to enhance it to show:
- Complete API request details
- Full response content
- Error handling
- Network status

## 🔧 Enhanced Logging Implementation

### 1. Update RemoteAssistantConversationService
Add detailed logging for every API call:

```swift
// In RemoteAssistantConversationService.swift - enhance existing debugTrace calls:

debugTrace("AssistantAPI", "🌐 API CALL: /ai/converse")
debugTrace("AssistantAPI", "📤 REQUEST: \(message)")
debugTrace("AssistantAPI", "📊 SESSION: \(sessionId ?? "new")")
debugTrace("AssistantAPI", "📚 HISTORY: \(history.count) messages")
debugTrace("AssistantAPI", "🎯 CONTEXT: \(context.workspaceState)")

// After successful response:
debugTrace("AssistantAPI", "✅ RESPONSE: \(response.reply.prefix(200))")
debugTrace("AssistantAPI", "🔄 SESSION: \(response.sessionId)")

// For streaming:
debugTrace("AssistantAPI", "🌊 STREAM START: /ai/converse-stream")
debugTrace("AssistantAPI", "📤 REQUEST: \(message)")
// For each chunk:
debugTrace("AssistantAPI", "📦 CHUNK: \(chunk.text.prefix(100))")
// On completion:
debugTrace("AssistantAPI", "🏁 STREAM DONE: \(response.reply.prefix(200))")
```

### 2. Update HomeViewModel
Enhance voice pipeline logging:

```swift
// In HomeViewModel.swift - add more detailed logging:

debugTrace("HomeConversation", "🎤 VOICE START: Beginning voice capture")
debugTrace("HomeConversation", "🎤 VOICE CAPTURED: \"\(transcript)\"")
debugTrace("HomeConversation", "📤 SENDING TO API: message=\"\(message)\"")
debugTrace("HomeConversation", "🔄 API CALLING: /ai/converse")
debugTrace("HomeConversation", "📥 API RESPONSE: \"\(response.prefix(200))\"")
debugTrace("HomeConversation", "🔊 SPEAKING: Response will be spoken")
```

### 3. Xcode Console Filter
In Xcode console, use these filters to see voice pipeline:

```
🎤 VOICE PIPELINE
🌐 API CALL
📤 REQUEST
📊 SESSION
📚 HISTORY
🎯 CONTEXT
✅ RESPONSE
🔄 SESSION
🌊 STREAM START
📦 CHUNK
🏁 STREAM DONE
🔊 SPEAKING
```

## 🧪 Testing the Enhanced Logging

### Step 1: Apply Enhanced Logging
1. Open `RemoteAssistantConversationService.swift`
2. Find all existing `debugTrace` calls
3. Add the enhanced logging patterns above
4. Open `HomeViewModel.swift`
5. Enhance voice pipeline logging
6. Rebuild and run iOS app

### Step 2: Test in Xcode
1. Run iOS app in simulator
2. Open Xcode Console (Cmd+Shift+C)
3. Filter by: `🎤 VOICE PIPELINE`
4. Speak into app: "test voice pipeline"
5. Watch for complete API call flow

### Step 3: Expected Console Output
You should see this sequence:
```
🎤 VOICE START: Beginning voice capture
🎤 VOICE CAPTURED: "test voice pipeline"
📤 SENDING TO API: message="test voice pipeline"
🌐 API CALL: /ai/converse
📤 REQUEST: test voice pipeline
📊 SESSION: new
📚 HISTORY: 0 messages
🎯 CONTEXT: next_action
🔍 DEBUG: converse endpoint called
🎤 VOICE PIPELINE: converse request sessionId=new...
📥 API RESPONSE: "I can hear you loud and clear..."
🔄 SESSION: [session-id]
🔊 SPEAKING: Response will be spoken
```

## 🎯 Benefits
- **Complete visibility**: Every API call with full details
- **Easy debugging**: Clear tags for filtering
- **Request tracking**: See exact data being sent
- **Response monitoring**: Verify AI responses
- **Error detection**: Spot failures immediately

This setup will give you complete visibility into the voice pipeline from iOS app perspective!
