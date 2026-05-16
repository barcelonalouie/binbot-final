// Native Web Speech Recognition Initialization
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let lastAnnouncedState = "CLOSED";
let standardFillAlertTriggered = false;

// Voice Synthesis Engine (The Web App Talks Back)
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Clear any trapped speech queues
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
        document.getElementById('voice-status').innerText = "System Active";
    };

    // Keep the microphone looping indefinitely
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

// 1. INTERROGATION HUB: HANDLING WHAT YOU SAY TO THE WEB APP
async function handleVoiceInput(phrase) {
    const cleanPhrase = phrase.trim();
    addLogEntry(`Operator Interrogation: "${cleanPhrase}"`, 'user');

    // FUZZY KEYWORD MATCH: REQUEST STATUS AUDIT
    if (cleanPhrase.includes("audit") || cleanPhrase.includes("status") || cleanPhrase.includes("report")) {
        addLogEntry("Compiling automated system logistics ledger...", 'voice-cmd');
        
        try {
            // Fetch the absolute freshest values currently held by our server variable stack
            const response = await fetch('/analytics');
            const data = await response.json();
            
            const currentCapacity = data.fill;
            const lidStateReport = data.state.toLowerCase();
            const cycleCount = data.usage;
            
            // Construct a highly professional, contextual spoken response
            const auditReport = `Audit complete. Current capacity is ${currentCapacity} percent. Main structural lid is currently ${lidStateReport}. Total deployments are at ${cycleCount} mechanical cycles. System wear indicators are nominal.`;
            
            speak(auditReport);
            addLogEntry("System Audit spoken back to operator successfully.", 'voice-cmd');
            
        } catch (err) {
            addLogEntry("System Error: Analytics matrix temporarily offline.", 'system');
            speak("Error compiling logistics report. System matrix offline.");
        }
    } 
    // FUZZY KEYWORD MATCH: CLEAR SYSTEM METRICS
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
    // REJECT EVERYTHING ELSE AS PASSIVE AUDITING TEXT NOTE
    else {
        addLogEntry(`Compliance Note: Data appended to system logs.`, 'system');
    }
}

async function fetchAnalytics() {

    try {

        const response = await fetch('/analytics');

        const data = await response.json();

        // FILL LEVEL
        const fillBar = document.getElementById('fill-bar');
        const fillText = document.getElementById('fill-text');

        fillText.innerText = data.fill;

        fillBar.style.height = `${data.fill}%`;

        // CRITICAL ALERT
        if (data.fill >= 90) {

            fillBar.classList.add('critical');

            if (!standardFillAlertTriggered) {

                speak("Warning. Waste capacity critically high.");

                standardFillAlertTriggered = true;
            }

        } else {

            fillBar.classList.remove('critical');

            standardFillAlertTriggered = false;
        }

        // USAGE
        document.getElementById('usage-count').innerText = data.usage;

        // LID STATE
        const currentLidState = data.state.toUpperCase().trim();

        document.getElementById('lid-state').innerText = currentLidState;

        // STATE CHANGE DETECTION
        if (currentLidState !== lastAnnouncedState) {

            if (currentLidState === "OPEN") {

                addLogEntry(
                    "REMOTE OPEN DETECTED FROM GOOGLE ASSISTANT",
                    'voice-cmd'
                );

                speak("Remote lid opening detected.");

            } else if (currentLidState === "CLOSED") {

                addLogEntry(
                    "LID SUCCESSFULLY CLOSED",
                    'system'
                );

                speak("Lid closed successfully.");
            }

            lastAnnouncedState = currentLidState;
        }

        // MQTT STATUS
        const mqttStatus = document.getElementById('mqtt-status');

        const statusText =
            mqttStatus.querySelector('.status-text');

        if (data.mqtt) {

            mqttStatus.className =
                "status-badge connected";

            statusText.innerText =
                "MQTT CONNECTED";

        } else {

            mqttStatus.className =
                "status-badge";

            statusText.innerText =
                "MQTT OFFLINE";
        }

    } catch (error) {

        console.error("FETCH ERROR:", error);
    }
}