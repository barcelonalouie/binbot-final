// Native Web Speech Recognition Initialization
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let lastAnnouncedState = "CLOSED";
let standardFillAlertTriggered = false;

// Voice Synthesis Engine (The Web App Talks Back)
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Clear any active speech queues
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0; 
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    // Automatically start listening on page boot
    window.addEventListener('DOMContentLoaded', () => {
        try {
            recognition.start();
        } catch(e) {
            console.log("Speech initialization trace:", e);
        }
    });

    recognition.onstart = () => {
        document.getElementById('mic-btn').innerText = "AUDIT LINE LISTENING [ALWAYS-ON]";
        document.getElementById('mic-btn').className = "btn btn-voice listening";
        document.getElementById('voice-status').innerText = "System: Hands-Free Interrogation Active";
    };

    // Keep the microphone looping indefinitely
    recognition.onend = () => {
        try {
            recognition.start();
        } catch(e) {
            // Context protection for trace overruns
        }
    };

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        addLogEntry(`Voice Input Decoded: "${transcript}"`, 'user-cmd');

        // Core Command Routing Rules
        if (transcript.includes('open') || transcript.includes('activate bin')) {
            addLogEntry("Executing Automated System Command: OPENING LID", 'system');
            speak("Compliance order received. Moving mechanical partition to open configuration.");
            await sendHardwareCommand('OPEN');
        } 
        else if (transcript.includes('close') || transcript.includes('shut bin')) {
            addLogEntry("Executing Automated System Command: CLOSING LID", 'system');
            speak("Compliance order received. Returning mechanical partition to sealed configuration.");
            await sendHardwareCommand('CLOSE');
        }
        else if (transcript.includes('status') || transcript.includes('check level')) {
            const currentLevel = document.getElementById('fill-text').innerText;
            speak(`Current tracking matrices state waste volume stands at ${currentLevel} percent capacity.`);
        }
        else if (transcript.includes('flush system') || transcript.includes('reset logs')) {
            addLogEntry("Voice Command Authorization Verified. Wiping diagnostic values...", 'system');
            speak("Executing complete logistical database purge.");
            await fetch('/reset', { method: 'POST' });
            fetchAnalytics();
        }
    };
}

function addLogEntry(text, type) {
    const consoleBox = document.getElementById('log-output');
    const timestamp = new Date().toLocaleTimeString();
    const logLine = document.createElement('div');
    logLine.className = `log-entry ${type}`;
    logLine.innerText = `[${timestamp}] ${text}`;
    consoleBox.appendChild(logLine);
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

async function sendHardwareCommand(action) {
    try {
        await fetch('/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: action })
        });
    } catch(err) {
        addLogEntry("Network Exception: Control channel synchronization lost.", 'system');
    }
}

async function fetchAnalytics() {
    try {
        const res = await fetch('/analytics');
        const data = await res.json();

        // Render Fill Level Metrics
        const currentFill = data.fill;
        document.getElementById('fill-text').innerText = currentFill;
        document.getElementById('fill-bar').style.height = `${currentFill}%`;

        // Volume Escalation Voice Warning Triggers
        if (currentFill >= 85 && !standardFillAlertTriggered) {
            speak("Logistical Warning. Storage capacity limits are reaching critical volume thresholds.");
            standardFillAlertTriggered = true;
        } else if (currentFill < 85) {
            standardFillAlertTriggered = false;
        }

        // Render Counter Data
        document.getElementById('usage-count').innerText = data.usage;

        // Sync Lid Status Text
        const currentLidState = data.state;
        if (currentLidState !== lastAnnouncedState) {
            addLogEntry(`Telemetry Shift Detected: Partition State flipped to ${currentLidState}`, 'system');
            lastAnnouncedState = currentLidState;
        }
        document.getElementById('lid-state').innerText = currentLidState;

        // FIXED: Target 'mqtt-status' exactly to match the index.html structure
        const mqttStatus = document.getElementById('mqtt-status');
        const statusText = mqttStatus.querySelector('.status-text');
        
        if (data.mqtt) {
            mqttStatus.className = "status-badge connected";
            statusText.innerText = "MQTT CONNECTOR ONLINE";
        } else {
            mqttStatus.className = "status-badge";
            statusText.innerText = "MQTT CONNECTOR OFFLINE";
        }
    } catch (error) {
        console.error("Data pipeline processing error:", error);
    }
}

// Backup Manual Click Action to Directly Push Commands via API Gateway
async function sendHardwareOverride(command) {
    addLogEntry(`Manual UI Press ➔ Pushing state: ${command}...`, 'voice-cmd');
    speak(`Manual web override deployed. Cycling hardware to ${command}.`);
    try {
        await fetch('/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: command })
        });
    } catch (err) {
        addLogEntry("System Error: Local override gateway down.", 'system');
    }
}

// Query the backend server memory parameters every 2 seconds
setInterval(fetchAnalytics, 2000);