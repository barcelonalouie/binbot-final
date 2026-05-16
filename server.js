const express = require('express');
const mqtt = require('mqtt');
const app = express();

const PORT = process.env.PORT || 8080;
const AIO_USERNAME = process.env.AIO_USERNAME;
const AIO_KEY = process.env.AIO_KEY;

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 0;

// Connect to Adafruit IO via Secure MQTT broker
const client = mqtt.connect(`mqtts://io.adafruit.com`, {
  username: AIO_USERNAME,
  password: AIO_KEY
});

app.use(express.static('public'));
app.use(express.json());

// Listen for hardware and cloud triggers from Adafruit IO
client.on('connect', () => {
    console.log("Connected to Adafruit MQTT Broker successfully.");
    client.subscribe(`${AIO_USERNAME}/feeds/google-binbot`);
    client.subscribe(`${AIO_USERNAME}/feeds/fill-level`);
});

client.on('message', (topic, msg) => {
    let payload = msg.toString().toUpperCase().trim();
    
    if (topic.includes('google-binbot')) {
        // Normalize "CLOSE" to "CLOSED" so frontend matching is 100% reliable
        if (payload === "CLOSE") payload = "CLOSED";
        
        // Track a new deployment cycle ONLY when shifting from CLOSED to OPEN
        if (payload === "OPEN" && lastLidState !== "OPEN") {
            usageCount++;
        }
        
        lastLidState = payload;
    }
    
    if (topic.includes('fill-level')) {
        currentFill = parseInt(payload) || 0;
    }
});

// GET endpoint to stream fresh analytics data to the web app terminal
app.get('/analytics', (req, res) => {
    res.json({ 
        usage: usageCount, 
        fill: currentFill, 
        state: lastLidState, 
        mqtt: client.connected 
    });
});

// POST gateway endpoint supporting web app dashboard button overrides
app.post('/command', (req, res) => {
    const start = Date.now();
    const cmd = req.body.command;
    
    if (!cmd) {
        return res.status(400).json({ error: "Missing command parameter" });
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

// API route to allow the web terminal to clear metrics via voice or button
app.post('/reset', (req, res) => {
    usageCount = 0;
    res.json({ status: "Reset successful", usage: usageCount });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot CMS Live on port ${PORT}`));