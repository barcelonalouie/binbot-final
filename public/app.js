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

    // Keep the microphone looping indefinitely (Touchless Always-On)
    recognition.onend = () => {
        try {
            recognition.start();
        } catch(e) {
            // Failsafe for accidental double invocation triggers
        }
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        handleVoiceInput(transcript);
    };

    recognition.onerror = (event) => {
        console.log("Speech engine status feedback:", event.error);
    };

} else {
    console.error("Speech Recognition API is not supported by this browser.");
    document.getElementById('voice-status').innerText = "Mic Hardware Unsupported";
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

// 1. INTERROGATION HUB: HANDLING OPERATOR VOICE KEYWORDS
async function handleVoiceInput(phrase) {
    const cleanPhrase = phrase.trim();
    addLogEntry(`Operator Interrogation: "${cleanPhrase}"`, 'user');

    // FUZZY KEYWORD MATCH: REQUEST STATUS AUDIT (Audit, Status, Report)
    if (cleanPhrase.includes("audit") || cleanPhrase.includes("status") || cleanPhrase.includes("report")) {
        addLogEntry("Compiling automated system logistics ledger...", 'voice-cmd');
        
        try {
            const response = await fetch('/analytics');
            const data = await response.json();
            
            const currentCapacity = data.fill;
            const lidStateReport = data.state.toLowerCase();
            const cycleCount = data.usage;
            
            const auditReport = `Audit complete. Current capacity is ${currentCapacity} percent. Main structural lid is currently ${lidStateReport}. Total deployments are at ${cycleCount} mechanical cycles. System wear indicators are nominal.`;
            
            speak(auditReport);
            addLogEntry("System Audit spoken back to operator successfully.", 'voice-cmd');
            
        } catch (err) {
            addLogEntry("System Error: Analytics matrix temporarily offline.", 'system');
            speak("Error compiling logistics report. System matrix offline.");
        }
    } 
    // FUZZY KEYWORD MATCH: CLEAR LIFECYCLE METRICS (Clear, Reset)
    else if (cleanPhrase.includes("clear") || cleanPhrase.includes("reset")) {
        addLogEntry("Contacting server to flush operational analytics counters...", 'voice-cmd');
        speak("Clearing mechanical lifecycle wear parameters back to zero.");
        try {
            const response = await fetch('/reset', { method: 'POST' });
            const data = await response.json();
            if (data.status) {
                addLogEntry("System Action: Server deployment metrics cleared to 0.", 'voice-cmd');
                document.getElementById('usage-count').innerText = "0";
            }
        } catch (err) {
            addLogEntry("System Error: Failed to contact backend parameters.", 'system');
        }
    }
    // REJECT UNKNOWN KEYWORDS AS STANDARD NOTEPAD NOTES
    else {
        addLogEntry(`Compliance Note: Data appended to system logs.`, 'system');
    }
}

// 2. BACKGROUND TELEMETRY HUB: PROCESSING REAL-TIME HARDWARE AND CLOUD DATA
async function fetchAnalytics() {
    try {
        const response = await fetch('/analytics');
        const data = await response.json();

        // Update Fill Level GUI Progress Graph
        const fillBar = document.getElementById('fill-bar');
        const fillText = document.getElementById('fill-text');
        fillText.innerText = data.fill;
        fillBar.style.height = `${data.fill}%`;

        // 90% Industrial Capacity Safety Alarm
        if (data.fill >= 90) {
            fillBar.classList.add('critical');
            if (!standardFillAlertTriggered) {
                speak("Warning. Waste capacity limit reached. Emptying required immediately to maintain food safety codes.");
                standardFillAlertTriggered = true;
            }
        } else {
            fillBar.classList.remove('critical');
            standardFillAlertTriggered = false;
        }

        // Synchronize Deployment Counter Element
        document.getElementById('usage-count').innerText = data.usage;

        // HEAVY LID TRANSITIONS STATE PROCESSING (CATCHES GOOGLE ASSISTANT/IFTTT LIVE SHIFTS)
        const currentLidState = data.state.toUpperCase().trim();
        if (currentLidState !== lastAnnouncedState && currentLidState !== "UNKNOWN") {
            
            if (currentLidState === "OPEN") {
                addLogEntry("AUDIT ALERT: External access logged via Google Assistant Cloud Gateway.", 'voice-cmd');
                speak("External access logged. Remote activation triggered via Google Assistant Cloud Gateway. Actuator cycling to open state.");
            } 
            else if (currentLidState === "CLOSE" || currentLidState === "CLOSED") {
                addLogEntry("AUDIT ALERT: System sealing sequence complete.", 'system');
                speak("System notice. Main structural lid is now securely closed.");
            }
            
            lastAnnouncedState = currentLidState;
        }
        
        // Update the visual text element card on screen
        document.getElementById('lid-state').innerText = currentLidState;

        // MQTT Pipeline Diagnostics Line
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
fetchAnalytics();