const express = require('express');
const mqtt = require('mqtt');

const app = express();

const PORT = process.env.PORT || 8080;

// ==========================================
// HARDCODED ADAFRUIT IO CONFIGURATION
// ==========================================
const AIO_USERNAME = "barce";
const AIO_KEY = "aio_jlSc07fp3pidz2O8Epb2OuNcYzD8"; 

// SYSTEM VARIABLES
let usageCount = 0;
let currentFill = 0;
let lastLidState = "CLOSED";

let client = null;

app.use(express.static('public'));
app.use(express.json());

// START SERVER
app.listen(PORT, '0.0.0.0', () => {

    console.log(`SERVER RUNNING ON PORT ${PORT}`);

    // Non-blocking timeout clears Railway health check instantly
    setTimeout(() => {
        initializeMQTT();
    }, 1000);
});

// ==========================================
// MQTT BROKER CONNECTION (WEB-SAFE WSS)
// ==========================================
function initializeMQTT() {

    if (!AIO_USERNAME || !AIO_KEY) {
        console.error("Adafruit credentials missing.");
        return;
    }

    console.log("CONNECTING TO ADAFRUIT IO OVER SECURE WEBSOCKETS...");

    client = mqtt.connect('wss://io.adafruit.com/mqtt', {
        port: 443,
        username: AIO_USERNAME,
        password: AIO_KEY,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        rejectUnauthorized: false,
        clean: true
    });

    client.on('connect', () => {

        console.log("MQTT BROKER CONNECTED SUCCESSFULLY!");
        const topic = `${AIO_USERNAME}/feeds/google-binbot`;

        client.subscribe(topic, (err) => {
            if (err) {
                console.error("SUBSCRIBE FAILED:", err);
            } else {
                console.log(`SUBSCRIBED TO FEED: ${topic}`);
            }
        });
    });

    client.on('message', (topic, message) => {

        const payload = message.toString().trim().toUpperCase();
        console.log(`FEED UPDATE RECEIVED: ${topic} -> ${payload}`);

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
            console.log("LOCAL CURRENT STATE:", lastLidState);
        }
    });

    client.on('error', (err) => {
        console.error("MQTT ERROR:", err.message);
    });
}

// ==========================================
// WEB CMS API ROUTES
// ==========================================

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
    if (!command) return res.status(400).json({ error: "No command provided." });
    if (!client || !client.connected) return res.status(500).json({ error: "MQTT broker offline." });

    const upperCommand = command.toUpperCase().trim();

    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, upperCommand, (err) => {
        if (err) return res.status(500).json({ error: "Publish failed." });
        res.json({ success: true, command: upperCommand });
    });
});

app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0;
    res.json({ success: true });
});