const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3002/assistant';
const SESSION_ID = "narrative-session-" + Date.now();

// The "Script" we want the user to follow
const narrative = [
    { 
        input: "Hi, I'm a barista and I'm ready to move into a management role at a high-end specialty coffee shop.",
        expectText: "management",
        delay: 1000 
    },
    { 
        input: "I'm looking in Seattle, specifically around the tech hubs like South Lake Union.",
        expectText: "Seattle",
        delay: 2000 
    },
    { 
        input: "Yes, that's exactly right. Let's set that as my goal.",
        expectAction: "PROPOSE_GOAL",
        delay: 2000 
    }
];

let currentTurn = 0;

console.log(`🎬 STARTING NARRATIVE: ${SESSION_ID}`);
const ws = new WebSocket(WS_URL);

function sendTurn() {
    if (currentTurn >= narrative.length) {
        console.log("\n🏁 Narrative Complete!");
        ws.close();
        return;
    }

    const turn = narrative[currentTurn];
    const payload = {
        event: 'converse',
        data: {
            message: turn.input,
            sessionId: SESSION_ID,
            history: [] // We could track history locally if needed
        }
    };

    console.log(`\n👤 USER: "${turn.input}"`);
    ws.send(JSON.stringify(payload));
}

ws.on('open', () => {
    console.log('✅ Connected. Beginning turn 1...');
    sendTurn();
});

ws.on('message', (data) => {
    const message = data.toString();
    if (message.startsWith('{')) {
        const json = JSON.parse(message);
        
        if (json.type === 'text_chunk') {
            process.stdout.write(`🤖 ASSISTANT: ${json.text}\n`);
        } else if (json.type === 'ui_event') {
            console.log(`✨ [UI SIGNAL]: ${json.event}`);
        } else if (json.type === 'converse_done') {
            console.log(`🏁 [TURN DONE] Action: ${json.suggestedAction || 'None'}`);
            if (json.strategicPlan) {
                console.log("📝 PLAN EXTRACTED:", json.strategicPlan.assistantSummary);
            }
            
            currentTurn++;
            if (currentTurn < narrative.length) {
                console.log(`\n--- Waiting ${narrative[currentTurn].delay}ms for next turn ---`);
                setTimeout(sendTurn, narrative[currentTurn].delay);
            } else {
                sendTurn();
            }
        }
    } else {
        // Binary audio
        // console.log(`🔊 [AUDIO]`);
    }
});

ws.on('error', (err) => console.error('❌ Error:', err.message));
ws.on('close', () => console.log('🔌 Disconnected'));
