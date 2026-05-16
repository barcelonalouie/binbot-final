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

// Serve frontend assets from the public folder
app.use(express.static('public'));
app.use(express.json());

// Listen for hardware updates from Adafruit IO
client.on('connect', () => {
    console.log("Connected to Adafruit MQTT Broker successfully.");
    client.subscribe(`${AIO_USERNAME}/feeds/google-binbot`);
    client.subscribe(`${AIO_USERNAME}/feeds/fill-level`);
});

client.on('message', (topic, msg) => {
    const payload = msg.toString().toUpperCase().trim();
    if (topic.includes('google-binbot')) {
        lastLidState = payload;
    }
    if (topic.includes('fill-level')) {
        currentFill = parseInt(payload) || 0;
    }
});

// GET endpoint to stream data to your emerald dashboard terminal
app.get('/analytics', (req, res) => {
    res.json({ 
        usage: usageCount, 
        fill: currentFill, 
        state: lastLidState, 
        mqtt: client.connected 
    });
});

// POST gateway endpoint supporting web app overrides and voice commands
app.post('/command', (req, res) => {
    const start = Date.now();
    const cmd = req.body.command;
    
    if (!cmd) {
        return res.status(400).json({ error: "Missing command parameter" });
    }

    const upperCmd = cmd.toUpperCase().trim();

    // Publish directly to Adafruit feed where ESP32 is listening
    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, upperCmd, () => {
        if (upperCmd === "OPEN") usageCount++;
        res.json({ 
            status: "Success",
            commandSent: upperCmd,
            latency: Date.now() - start 
        });
    });
});

// API route allowing the web app terminal to reset metrics via voice/button
app.post('/reset', (req, res) => {
    usageCount = 0;
    res.json({ status: "Reset successful", usage: usageCount });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot CMS Live on port ${PORT}`));