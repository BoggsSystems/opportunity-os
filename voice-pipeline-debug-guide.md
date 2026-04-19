# Voice Pipeline Debug Guide

## 🎯 Complete Logging Setup

Both frontend and backend now have comprehensive voice pipeline logging with 🎤 VOICE PIPELINE tags.

## 📱 iOS App Logs

### Where to View:
- **Xcode Console**: Open with `Cmd+Shift+C` while app is running
- **Simulator**: Debug → Open System Log
- **Device**: Use Console.app and filter by "opportunity-os"

### Key Log Points:
1. **Voice Recognition**: `🎤 VOICE PIPELINE: captured utterance="..."`
2. **Message Processing**: `🎤 VOICE PIPELINE: processing user message shouldSpeak=... message="..."`
3. **API Request**: `🎤 VOICE PIPELINE: respond starting sessionId=... message="..."`
4. **API Response**: `🎤 VOICE PIPELINE: respond completed sessionId=... reply="..."`

## 🖥 Backend Logs

### Where to View:
- **Terminal**: Where you started `pnpm start:dev`
- **Log File**: `/tmp/backend.log` (when using monitor script)

### Key Log Points:
1. **Incoming Request**: `🎤 VOICE PIPELINE: converse request sessionId=... message="..."`
2. **Session Established**: `🎤 VOICE PIPELINE: converse-stream session established sessionId=...`
3. **Stream Chunks**: `🎤 VOICE PIPELINE: converse-stream chunk sessionId=... text="..."`
4. **Stream Complete**: `🎤 VOICE PIPELINE: converse-stream done sessionId=... reply="..."`

## 🧪 Testing the Complete Flow

### Option 1: Use Monitor Script
```bash
./monitor-voice-pipeline.sh
```
This will:
- Start backend with logging
- Monitor iOS logs in real-time
- Show both logs side-by-side

### Option 2: Manual Testing
1. **Start Backend**:
   ```bash
   OPENROUTER_API_KEY="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" \
   AI_PROVIDER="openrouter" \
   pnpm start:dev
   ```

2. **Start iOS App** in Xcode simulator

3. **Speak into App** and watch for log flow

## 🔍 Debugging Checklist

### Voice Not Working?
- Check iOS: `🎤 VOICE PIPELINE: captured utterance` appears?
- Check iOS: Microphone permission granted?
- Check iOS: Speech recognizer available?

### API Not Working?
- Check Backend: `🎤 VOICE PIPELINE: converse request` appears?
- Check Backend: API key configured?
- Check Network: Can curl backend from iOS device?

### Response Not Working?
- Check Backend: `🎤 VOICE PIPELINE: converse response` appears?
- Check Backend: OpenRouter API responding?
- Check iOS: `🎤 VOICE PIPELINE: respond completed` appears?

## 🎯 Expected Flow

When working correctly, you should see:

1. **iOS**: `🎤 VOICE PIPELINE: captured utterance="Hello, help me find jobs"`
2. **iOS**: `🎤 VOICE PIPELINE: processing user message shouldSpeak=true message="Hello, help me find jobs"`
3. **iOS**: `🎤 VOICE PIPELINE: respond starting sessionId=... message="Hello, help me find jobs"`
4. **Backend**: `🎤 VOICE PIPELINE: converse request sessionId=... message="Hello, help me find jobs"`
5. **Backend**: `🎤 VOICE PIPELINE: converse response sessionId=... reply="I'll help you find jobs..."`
6. **iOS**: `🎤 VOICE PIPELINE: respond completed sessionId=... reply="I'll help you find jobs..."`

## 🛠 Common Issues & Solutions

### Issue: No iOS logs
- **Solution**: Enable debug logging in Xcode scheme settings
- **Check**: Product → Scheme → Edit Scheme → Run → Info → Environment Variables

### Issue: No backend logs
- **Solution**: Check LOG_LEVEL environment variable
- **Set**: `LOG_LEVEL="debug"` in backend environment

### Issue: API timeout
- **Solution**: Check network connectivity
- **Test**: `curl http://127.0.0.1:3001/ai/test` from iOS simulator
