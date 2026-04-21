const WebSocket = require('ws');

// Configuration
const WS_URL = 'ws://localhost:3002/assistant';
const TEST_MESSAGE = "Yes, finding a barista job is my goal.";
const SESSION_ID = "test-session-" + Date.now();

console.log(`🚀 Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected to Assistant Gateway');
    
    const payload = {
        event: 'converse',
        data: {
            message: TEST_MESSAGE,
            sessionId: SESSION_ID,
            history: [
                { role: 'user', text: "I'm looking for a barista job" },
                { role: 'assistant', text: "To confirm, is finding barista jobs the objective we're setting today?" }
            ]
        }
    };

    console.log('📤 Sending Payload:', JSON.stringify(payload, null, 2));
    ws.send(JSON.stringify(payload));
});

ws.on('message', (data) => {
    try {
        const message = data.toString();
        // Try to parse as JSON
        if (message.startsWith('{')) {
            const json = JSON.parse(message);
            console.log(`\n📥 RECEIVED EVENT [${json.type}]:`);
            console.log(JSON.stringify(json, null, 2));
            
            if (json.type === 'converse_done') {
                console.log('\n✅ Conversation Finished. Closing connection.');
                ws.close();
                process.exit(0);
            }
        } else {
            // Binary audio chunk
            console.log(`\n🔊 RECEIVED AUDIO CHUNK: ${data.length} bytes`);
        }
    } catch (e) {
        console.log('📥 RECEIVED RAW:', data.toString().substring(0, 100));
    }
});

ws.on('error', (err) => {
    console.error('❌ Socket Error:', err.message);
});

ws.on('close', () => {
    console.log('🔌 Connection Closed');
});

// Timeout safety
setTimeout(() => {
    console.log('⏰ Test timed out after 30s');
    ws.close();
    process.exit(1);
}, 30000);
