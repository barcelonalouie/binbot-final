const express = require('express');
const mqtt = require('mqtt');
const app = express();

const PORT = process.env.PORT || 8080;

// Universal Sanitizer: Scrubs out any quotes injected by cloud environments
const AIO_USERNAME = (process.env.AIO_USERNAME || "").replace(/[\"\']/g, '').trim();
const AIO_KEY = (process.env.AIO_KEY || "").replace(/[\"\']/g, '').trim();

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 35; 
let client = null;

if (AIO_USERNAME && AIO_KEY) {
    console.log(`LOG INITIALIZATION: Spawning tunnel network path for: [${AIO_USERNAME}]`);
    
    client = mqtt.connect(`wss://io.adafruit.com/mqtt`, {
        port: 443,
        username: AIO_USERNAME,
        password: AIO_KEY,
        rejectUnauthorized: false,
        reconnectPeriod: 4000
    });

    client.on('connect', () => {
        console.log(`SUCCESS: Cloud WebSocket Tunnel Established for feed path: ${AIO_USERNAME}/feeds/`);
        client.subscribe(`${AIO_USERNAME}/feeds/+`, (err) => {
            if (err) console.error("Subscription Flag Denied:", err.message);
        });
    });

    client.on('message', (topic, msg) => {
        let payload = msg.toString().toUpperCase().trim();
        console.log(`Incoming Stream -> [${topic}] : ${payload}`);
        
        if (topic.toLowerCase().includes('binbot')) {
            if (payload === "CLOSE") payload = "CLOSED";
            
            if (payload === "OPEN" && lastLidState !== "OPEN") {
                usageCount++;
                currentFill += 5; 
                if (currentFill > 100) currentFill = 100; 
            }
            lastLidState = payload;
        }
    });

    client.on('error', (err) => {
        console.error("Adafruit Broker Exception:", err.message);
    });
} else {
    console.error("CONFIGURATION ERROR: Credentials missing or unreadable.");
}

app.use(express.static('public'));
app.use(express.json());

app.get('/analytics', (req, res) => {
    res.json({ 
        usage: usageCount, 
        fill: currentFill, 
        state: lastLidState, 
        mqtt: client ? client.connected : false 
    });
});

app.post('/command', (req, res) => {
    const cmd = req.body.command;
    if (!cmd || !client || !client.connected) {
        return res.status(400).json({ error: "Core MQTT pipeline is offline." });
    }

    let upperCmd = cmd.toUpperCase().trim();
    if (upperCmd === "CLOSE") upperCmd = "CLOSED";

    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, upperCmd, () => {
        res.json({ status: "Success", commandSent: upperCmd });
    });
});

app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0; 
    res.json({ status: "Telemetry cleared." });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot Terminal Live on port ${PORT}`));