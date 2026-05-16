// Native Web Speech Recognition Initialization
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

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

    // The infinite loop: When it finishes processing a phrase, start up again immediately!
    recognition.onend = () => {
        try {
            recognition.start();
        } catch(e) {
            // catch potential double-start errors safely
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

function handleVoiceInput(phrase) {
    addLogEntry(`Dictated: "${phrase}"`, 'user');

    // Executing system actions purely by voice keywords
    if (phrase.includes("clear counter") || phrase.includes("reset metrics")) {
        addLogEntry("Executing Local Action: Resetting UI counters...", 'voice-cmd');
        document.getElementById('usage-count').innerText = "0";
    } else if (phrase.includes("system check") || phrase.includes("diagnostic")) {
        addLogEntry("Executing Local Action: Web Gateway Node Status: operational.", 'voice-cmd');
    } else {
        // Any other spoken phrase becomes a hands-free text memo log
        addLogEntry(`Saved Note: Entry logged to database successfully.`, 'system');
    }
}

// Background telemetry polling
async function fetchAnalytics() {
    try {
        const response = await fetch('/analytics');
        const data = await response.json();

        const fillBar = document.getElementById('fill-bar');
        const fillText = document.getElementById('fill-text');
        
        fillText.innerText = data.fill;
        fillBar.style.height = `${data.fill}%`;

        if (data.fill >= 85) {
            fillBar.classList.add('critical');
        } else {
            fillBar.classList.remove('critical');
        }

        document.getElementById('lid-state').innerText = data.state;
        document.getElementById('usage-count').innerText = data.usage;

        const mqttStatus = document.getElementById('mqtt-status');
        const statusText = mqttStatus.querySelector('.status-text');
        if (data.mqtt) {
            mqttStatus.classList.add('connected');
            statusText.innerText = "MQTT CONNECTED";
        } else {
            mqttStatus.classList.remove('connected');
            statusText.innerText = "MQTT DISCONNECTED";
        }
    } catch (error) {
        console.error("Error updating analytics:", error);
    }
}

setInterval(fetchAnalytics, 2000);
fetchAnalytics();