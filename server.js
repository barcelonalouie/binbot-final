const express = require('express');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================================
// BULLETPROOF CREDENTIAL SANITIZATION
// ==========================================
const AIO_USERNAME = (process.env.AIO_USERNAME || "")
    .replace(/^["']|["']$/g, '')
    .replace(/[\r\n\t]/g, '')
    .trim();

const AIO_KEY = (process.env.AIO_KEY || "")
    .replace(/^["']|["']$/g, '')
    .replace(/[\r\n\t]/g, '')
    .trim();

// SYSTEM VARIABLES
let usageCount = 0;
let currentFill = 0;
let lastLidState = "CLOSED";

// MQTT CLIENT
let client = null;

// EXPRESS CONFIG
app.use(express.static('public'));
app.use(express.json());

// ==========================================
// START SERVER (IMMEDIATE BINDING FIX)
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
    console.log(`PORT BIND SECURED. DEFERRING MQTT STARTUP TO PASS HEALTH CHECKS...`);
    
    // Defer MQTT initialization by 1 second so Railway registers the server as healthy
    setTimeout(() => {
        initializeMQTT();
    }, 1000);
});

// ============================
// MQTT CONNECTION (WSS)
// ============================
function initializeMQTT() {
    if (!AIO_USERNAME || !AIO_KEY) {
        console.error("Adafruit credentials missing.");
        return;
    }

    console.log(`CONNECTING TO ADAFRUIT IO AS USER: [${AIO_USERNAME}]`);
    console.log(`KEY LENGTH DETECTED: ${AIO_KEY.length} characters`);

    // Using stable Secure WebSockets over Port 443
    client = mqtt.connect('wss://io.adafruit.com/mqtt', {
        port: 443,
        username: AIO_USERNAME,
        password: AIO_KEY,
        reconnectPeriod: 5000,
        connectTimeout: 15000, // Reduced timeout to prevent thread blocking
        rejectUnauthorized: false,
        clean: true
    });

    // CONNECTED
    client.on('connect', () => {
        console.log("MQTT CONNECTED SUCCESSFULLY TO ADAFRUIT!");
        const topic = `${AIO_USERNAME}/feeds/google-binbot`;

        client.subscribe(topic, (err) => {
            if (err) {
                console.error("SUBSCRIBE FAILED:", err);
            } else {
                console.log(`SUBSCRIBED TO TOPIC: ${topic}`);
            }
        });
    });

    // MESSAGE RECEIVED
    client.on('message', (topic, message) => {
        const payload = message.toString().trim().toUpperCase();
        console.log(`MESSAGE RECEIVED: ${topic} -> ${payload}`);

        if (topic === `${AIO_USERNAME}/feeds/google-binbot`) {
            if (payload === "OPEN") {
                if (lastLidState !== "OPEN") {
                    usageCount++;
                    currentFill += 5;
                    if (currentFill > 100) currentFill = 100;
                }
                lastLidState = "OPEN";
            }
            else if (payload === "CLOSE" || payload === "CLOSED") {
                lastLidState = "CLOSED";
            }
            console.log("CURRENT STATE RECORDED:", lastLidState);
        }
    });

    // ERROR MANAGEMENT
    client.on('error', (err) => {
        console.error("MQTT ERROR ALERT:", err.message);
    });

    client.on('offline', () => {
        console.log("MQTT CLIENT IS OFFLINE");
    });

    client.on('reconnect', () => {
        console.log("MQTT RECONNECTING...");
    });
}

// ============================
// API ROUTES
// ============================

app.get('/analytics', (req, res) => {
    res.json({
        usage: usageCount,
        fill: currentFill,
        state: lastLidState,
        mqtt: client ? client.connected : false
    });
});

app.post('/command', (req, res) => {
    const command = req.body.command;

    if (!command) {
        return res.status(400).json({ error: "No command provided." });
    }

    if (!client || !client.connected) {
        return res.status(500).json({ error: "MQTT offline." });
    }

    const upperCommand = command.toUpperCase().trim();

    client.publish(
        `${AIO_USERNAME}/feeds/google-binbot`,
        upperCommand,
        (err) => {
            if (err) {
                console.error("PUBLISH FAILED:", err);
                return res.status(500).json({ error: "Publish failed." });
            }
            res.json({ success: true, command: upperCommand });
        }
    );
});

app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0;
    res.json({ success: true });
});