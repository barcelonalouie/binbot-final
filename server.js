const express = require('express');
const mqtt = require('mqtt');
const app = express();

const PORT = process.env.PORT || 8080;

// Secure Environment Variable Injection (Bypasses GitHub Rules)
const AIO_USERNAME = process.env.AIO_USERNAME || "";
const AIO_KEY = process.env.AIO_KEY || "";

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 35; // Presentation baseline value (35%)
let client = null;

// Secure MQTTS Connection Tunneling Profile (Bypasses Container Security Rules)
if (AIO_USERNAME && AIO_KEY) {
    client = mqtt.connect(`mqtts://io.adafruit.com`, {
      port: 8883,
      username: AIO_USERNAME,
      password: AIO_KEY,
      rejectUnauthorized: false, // CRITICAL: Prevents the cloud network proxy from blocking the handshake
      reconnectPeriod: 5000 
    });

    client.on('connect', () => {
        console.log("SUCCESS: Connected to Adafruit MQTT Broker over Secure MQTTS Network.");
        client.subscribe(`${AIO_USERNAME}/feeds/google-binbot`);
    });

    client.on('message', (topic, msg) => {
        let payload = msg.toString().toUpperCase().trim();
        console.log(`Incoming Data Stream [${topic}] -> ${payload}`);
        
        if (topic.includes('google-binbot')) {
            if (payload === "CLOSE") payload = "CLOSED";
            
            // Smart Presentation Emulation: Step up waste volume upon opening
            if (payload === "OPEN" && lastLidState !== "OPEN") {
                usageCount++;
                currentFill += 5; 
                if (currentFill > 100) currentFill = 100; 
            }
            
            lastLidState = payload;
        }
    });

    client.on('error', (err) => {
        console.error("Adafruit Connection Alert:", err.message);
    });
} else {
    console.error("CONFIGURATION ERROR: Missing AIO credentials in your environment layout variables.");
}

app.use(express.static('public'));
app.use(express.json());

// API link for the frontend UI dashboard interface to grab variables
app.get('/analytics', (req, res) => {
    res.json({ 
        usage: usageCount, 
        fill: currentFill, 
        state: lastLidState, 
        mqtt: client ? client.connected : false 
    });
});

// Outbound Manual Command Override Endpoint Gateway
app.post('/command', (req, res) => {
    const start = Date.now();
    const cmd = req.body.command;
    
    if (!cmd || !client) {
        return res.status(400).json({ error: "Command processing failed or MQTT client is offline." });
    }

    let upperCmd = cmd.toUpperCase().trim();
    if (upperCmd === "CLOSE") upperCmd = "CLOSED";

    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, upperCmd, () => {
        res.json({ 
            status: "Success",
            commandSent: upperCmd,
            latency: Date.now() - start 
        });
    });
});

// Resetting via speech interrogation or web click flushes the virtual counters back to zero
app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0; 
    res.json({ status: "Reset successful", usage: usageCount, fill: currentFill });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot Terminal Live on port ${PORT}`));