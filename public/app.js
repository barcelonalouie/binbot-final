const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let lastAnnouncedState = "CLOSED";
let standardFillAlertTriggered = false;

// Audio Speak-Back Mechanism
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
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

    window.addEventListener('DOMContentLoaded', () => {
        // Enable the microbutton display immediately
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.removeAttribute('disabled');
        
        try {
            recognition.start();
        } catch(e) {
            console.log("Speech initialization error:", e);
        }
    });

    recognition.onstart = () => {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.innerText = "AUDIT LINE LISTENING [ALWAYS-ON]";
            micBtn.className = "btn btn-voice listening";
        }
        document.getElementById('voice-status').innerText = "System: Hands-Free Interrogation Active";
    };

    // FIXED: Added a 200ms delay window to prevent the cloud browser from blocking the audio loop
    recognition.onend = () => {
        setTimeout(() => {
            try {
                recognition.start();
            } catch(e) {
                // Prevents crash loops if browser is busy
            }
        }, 200);
    };

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        addLogEntry(`Voice Input Decoded: "${transcript}"`, 'user-cmd');

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
    if (!consoleBox) return;
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

        const currentFill = data.fill;
        document.getElementById('fill-text').innerText = currentFill;
        document.getElementById('fill-bar').style.height = `${currentFill}%`;

        if (currentFill >= 85 && !standardFillAlertTriggered) {
            speak("Logistical Warning. Storage capacity limits are reaching critical volume thresholds.");
            standardFillAlertTriggered = true;
        } else if (currentFill < 85) {
            standardFillAlertTriggered = false;
        }

        document.getElementById('usage-count').innerText = data.usage;

        const currentLidState = data.state;
        if (currentLidState !== lastAnnouncedState) {
            addLogEntry(`Telemetry Shift Detected: Partition State flipped to ${currentLidState}`, 'system');
            lastAnnouncedState = currentLidState;
        }
        document.getElementById('lid-state').innerText = currentLidState;

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

setInterval(fetchAnalytics, 2000);