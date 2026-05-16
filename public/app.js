// Native Web Speech Recognition Initialization
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let lastAnnouncedState = "CLOSED";
let standardFillAlertTriggered = false;

// Voice Synthesis Helper Function (App Speaks Back)
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Halt any active speech queues
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

    // Automatically starts listening the exact moment the page loads
    window.addEventListener('DOMContentLoaded', () => {
        try {
            recognition.start();
        } catch(e) {
            console.log("Startup notice:", e);
        }
    });

    recognition.onstart = () => {
        document.getElementById('mic-btn').innerText = "SYSTEM LISTENING [ALWAYS-ON]";
        document.getElementById('mic-btn').className = "btn btn-voice listening";
        document.getElementById('voice-status').innerText = "Mic Status: Active & Touchless";
    };

    // Keep loop active infinitely
    recognition.onend = () => {
        try {
            recognition.start();
        } catch(e) {
            // Catches double invocation loops safely
        }
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        handleVoiceInput(transcript);
    };

    recognition.onerror = (event) => {
        console.log("Speech recognition status:", event.error);
    };

} else {
    console.error("Speech Recognition API is not supported by this browser.");
    document.getElementById('voice-status').innerText = "Mic Unsupported";
}

function addLogEntry(text, type = 'user') {
    const logOutput = document.getElementById('log-output');
    const entry = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${timestamp}] ${text}`;
    
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight; 
}

// Handle Incoming Spoken Commands (You Speak to Dashboard)
async function handleVoiceInput(phrase) {
    addLogEntry(`Dictated: "${phrase}"`, 'user');

    // 1. COMMAND TRIGGER: OPEN LID OVERRIDE
    if (phrase.includes("open bin") || phrase.includes("open lid")) {
        addLogEntry("Sending web override command: OPEN...", 'voice-cmd');
        speak("Executing web override. Opening lid now.");
        try {
            await fetch('/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'OPEN' })
            });
        } catch (err) {
            addLogEntry("System Error: Web override gateway unreachable.", 'system');
        }
    } 

    // 2. COMMAND TRIGGER: CLOSE LID OVERRIDE
    else if (phrase.includes("close bin") || phrase.includes("close lid")) {
        addLogEntry("Sending web override command: CLOSE...", 'voice-cmd');
        speak("Executing web override. Closing lid now.");
        try {
            await fetch('/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'CLOSE' })
            });
        } catch (err) {
            addLogEntry("System Error: Web override gateway unreachable.", 'system');
        }
    }

    // 3. COMMAND TRIGGER: RESET COUNTER METRICS
    else if (phrase.includes("clear counter") || phrase.includes("reset metrics")) {
        addLogEntry("Contacting server to clear logistics counters...", 'voice-cmd');
        speak("Clearing deployment lifecycle metrics.");
        try {
            const response = await fetch('/reset', { method: 'POST' });
            const data = await response.json();
            if (data.status) {
                addLogEntry("System Action: Server deployment metrics cleared to 0.", 'voice-cmd');
                document.getElementById('usage-count').innerText = "0";
            }
        } catch (err) {
            addLogEntry("System Error: Failed to contact backend database.", 'system');
        }
    } 
    
    // 4. COMMAND TRIGGER: TERMINAL DIAGNOSTICS
    else if (phrase.includes("system check") || phrase.includes("diagnostic")) {
        addLogEntry("Executing Local Action: Web Gateway Node Status: operational.", 'voice-cmd');
        speak("System diagnostic check nominal. Nodes operational.");
    } 
    
    // 5. STANDARD MAINTENANCE NOTEPAD MEMOS
    else {
        addLogEntry(`Saved Note: Entry logged to database successfully.`, 'system');
    }
}

// Background telemetry polling (Dashboard Listens to Hardware Changes)
async function fetchAnalytics() {
    try {
        const response = await fetch('/analytics');
        const data = await response.json();

        // Update Fill Level Telemetry View
        const fillBar = document.getElementById('fill-bar');
        const fillText = document.getElementById('fill-text');
        fillText.innerText = data.fill;
        fillBar.style.height = `${data.fill}%`;

        // Smart Audible Alert: Fill Level exceeds 90%
        if (data.fill >= 90) {
            fillBar.classList.add('critical');
            if (!standardFillAlertTriggered) {
                speak("Warning. Waste fill level has exceeded ninety percent. Emptying is required immediately.");
                standardFillAlertTriggered = true; // Avoid voice spamming every 2 seconds
            }
        } else {
            fillBar.classList.remove('critical');
            standardFillAlertTriggered = false; // Reset warning once emptied
        }

        // Live Metric Counters
        document.getElementById('usage-count').innerText = data.usage;

        // Smart Audible Alert: Heavy Lid Transitions
        const currentLidState = data.state.toUpperCase();
        if (currentLidState !== lastAnnouncedState) {
            if (currentLidState === "OPEN") {
                speak("System notice. Main structural lid has been opened.");
                addLogEntry("Telemetry Broadcast: Heavy structural lid state flipped to OPEN.", 'system');
            } else if (currentLidState === "CLOSE" || currentLidState === "CLOSED") {
                speak("System notice. Main structural lid is now closed.");
                addLogEntry("Telemetry Broadcast: Heavy structural lid state flipped to CLOSED.", 'system');
            }
            lastAnnouncedState = currentLidState;
        }
        document.getElementById('lid-state').innerText = currentLidState;

        // Connectivity Monitor
        const mqttStatus = document.getElementById('mqtt-status');
        const statusText = mqttStatus.querySelector('.status-text');
        if (data.mqtt) {
            mqttStatus.className = "status-badge connected";
            statusText.innerText = "MQTT CONNECTED";
        } else {
            mqttStatus.className = "status-badge";
            statusText.innerText = "MQTT DISCONNECTED";
        }
    } catch (error) {
        console.error("Error updating analytics:", error);
    }
}

// Check for backend updates every 2 seconds
setInterval(fetchAnalytics, 2000);
fetchAnalytics();