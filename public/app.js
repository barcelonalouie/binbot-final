// ===============================
// BINBOT FRONTEND SYSTEM
// FULLY FIXED VERSION
// ===============================

// Speech Recognition
const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition;

// System State
let lastAnnouncedState = "CLOSED";
let standardFillAlertTriggered = false;
let isSpeaking = false;

// ===============================
// SPEECH ENGINE
// ===============================

function speak(text) {

    if ('speechSynthesis' in window) {

        // Prevent speech overlap
        window.speechSynthesis.cancel();

        // STOP LISTENING WHILE TALKING
        if (recognition) {

            try {
                recognition.stop();
            } catch (e) {}
        }

        isSpeaking = true;

        const utterance =
            new SpeechSynthesisUtterance(text);

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // SPEECH FINISHED
        utterance.onend = () => {

            isSpeaking = false;

            // Restart mic safely
            setTimeout(() => {

                if (recognition) {

                    try {
                        recognition.start();
                    } catch (e) {}
                }

            }, 1000);
        };

        window.speechSynthesis.speak(utterance);
    }
}

// ===============================
// SPEECH RECOGNITION
// ===============================

if (SpeechRecognition) {

    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    // START LISTENING ON PAGE LOAD
    window.addEventListener('DOMContentLoaded', () => {

        try {

            recognition.start();

        } catch (e) {

            console.log("Speech start error:", e);
        }
    });

    // MIC STARTED
    recognition.onstart = () => {

        document.getElementById('mic-btn').innerText =
            "AUDIT LINE LISTENING [ALWAYS-ON]";

        document.getElementById('mic-btn').className =
            "btn btn-voice listening";

        document.getElementById('voice-status').innerText =
            "System Active";
    };

    // MIC ENDED
    recognition.onend = () => {

        // DO NOT RESTART IF SPEAKING
        if (!isSpeaking) {

            try {

                recognition.start();

            } catch (e) {}
        }
    };

    // USER SPOKE
    recognition.onresult = (event) => {

        const transcript =
            event.results[0][0].transcript
            .toLowerCase()
            .trim();

        handleVoiceInput(transcript);
    };

    // ERRORS
    recognition.onerror = (event) => {

        console.log("Speech recognition error:",
            event.error);
    };

} else {

    console.error(
        "Speech Recognition not supported."
    );

    document.getElementById('voice-status').innerText =
        "Mic Unsupported";
}

// ===============================
// LOG SYSTEM
// ===============================

function addLogEntry(text, type = 'user') {

    const logOutput =
        document.getElementById('log-output');

    const entry =
        document.createElement('div');

    const timestamp =
        new Date().toLocaleTimeString();

    entry.className =
        `log-entry ${type}`;

    entry.innerText =
        `[${timestamp}] ${text}`;

    logOutput.appendChild(entry);

    logOutput.scrollTop =
        logOutput.scrollHeight;
}

// ===============================
// VOICE COMMAND HANDLER
// ===============================

async function handleVoiceInput(phrase) {

    const cleanPhrase = phrase.trim();

    addLogEntry(
        `Operator Input: "${cleanPhrase}"`,
        'user'
    );

    // STATUS / AUDIT
    if (
        cleanPhrase.includes("audit") ||
        cleanPhrase.includes("status") ||
        cleanPhrase.includes("report")
    ) {

        addLogEntry(
            "Generating system audit...",
            'voice-cmd'
        );

        try {

            const response =
                await fetch('/analytics');

            const data =
                await response.json();

            const auditReport =
                `Audit complete. Current capacity is ${data.fill} percent. Main lid is currently ${data.state.toLowerCase()}. Total deployments are ${data.usage}.`;

            speak(auditReport);

        } catch (err) {

            addLogEntry(
                "Analytics server offline.",
                'system'
            );

            speak(
                "System analytics unavailable."
            );
        }
    }

    // RESET / CLEAR
    else if (
        cleanPhrase.includes("clear") ||
        cleanPhrase.includes("reset")
    ) {

        addLogEntry(
            "Resetting system counters...",
            'voice-cmd'
        );

        try {

            const response =
                await fetch('/reset', {

                    method: 'POST'
                });

            const data =
                await response.json();

            if (data.success) {

                document.getElementById(
                    'usage-count'
                ).innerText = "0";

                document.getElementById(
                    'fill-text'
                ).innerText = "0";

                document.getElementById(
                    'fill-bar'
                ).style.height = "0%";

                speak(
                    "System counters reset successfully."
                );

                addLogEntry(
                    "Counters reset completed.",
                    'system'
                );
            }

        } catch (err) {

            addLogEntry(
                "Reset failed.",
                'system'
            );

            speak(
                "Reset failed."
            );
        }
    }

    // UNKNOWN COMMAND
    else {

        addLogEntry(
            "Unknown voice command detected.",
            'system'
        );
    }
}

// ===============================
// ANALYTICS FETCHER
// ===============================

async function fetchAnalytics() {

    try {

        const response =
            await fetch('/analytics');

        const data =
            await response.json();

        // FILL LEVEL
        const fillBar =
            document.getElementById('fill-bar');

        const fillText =
            document.getElementById('fill-text');

        fillText.innerText = data.fill;

        fillBar.style.height =
            `${data.fill}%`;

        // CRITICAL WARNING
        if (data.fill >= 90) {

            fillBar.classList.add('critical');

            if (!standardFillAlertTriggered) {

                speak(
                    "Warning. Waste capacity critically high."
                );

                standardFillAlertTriggered = true;
            }

        } else {

            fillBar.classList.remove('critical');

            standardFillAlertTriggered = false;
        }

        // USAGE COUNT
        document.getElementById(
            'usage-count'
        ).innerText = data.usage;

        // LID STATE
        const currentLidState =
            data.state
            .toUpperCase()
            .trim();

        document.getElementById(
            'lid-state'
        ).innerText = currentLidState;

        // DETECT STATE CHANGES
        if (
            currentLidState !==
            lastAnnouncedState
        ) {

            if (currentLidState === "OPEN") {

                addLogEntry(
                    "Remote lid opening detected.",
                    'voice-cmd'
                );

                speak(
                    "Lid opened remotely."
                );

            } else if (
                currentLidState === "CLOSED"
            ) {

                addLogEntry(
                    "Lid closed successfully.",
                    'system'
                );

                speak(
                    "Lid closed successfully."
                );
            }

            lastAnnouncedState =
                currentLidState;
        }

        // MQTT STATUS
        const mqttStatus =
            document.getElementById(
                'mqtt-status'
            );

        const statusText =
            mqttStatus.querySelector(
                '.status-text'
            );

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

        console.error(
            "Analytics fetch failed:",
            error
        );
    }
}

// ===============================
// START ANALYTICS LOOP
// ===============================

setInterval(fetchAnalytics, 2000);

fetchAnalytics();