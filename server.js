const express = require('express');
const mqtt = require('mqtt');
const app = express();

const PORT = process.env.PORT || 8080;
const AIO_USERNAME = process.env.AIO_USERNAME;
const AIO_KEY = process.env.AIO_KEY;

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 0;

// Establish secure MQTT highway connection directly to Adafruit
const client = mqtt.connect(`mqtts://io.adafruit.com`, {
  username: AIO_USERNAME,
  password: AIO_KEY
});

app.use(express.static('public'));
app.use(express.json());

client.on('connect', () => {
    console.log("Connected to Adafruit MQTT Broker successfully.");
    client.subscribe(`${AIO_USERNAME}/feeds/google-binbot`);
    client.subscribe(`${AIO_USERNAME}/feeds/fill-level`);
});

// Intercept streams from the physical ESP32 device or external API applets (like IFTTT)
client.on('message', (topic, msg) => {
    const payload = msg.toString().toUpperCase().trim();
    if (topic.includes('google-binbot')) {
        lastLidState = payload;
        // Automatically track deployment cycles whenever the state transitions to open
        if (payload === "OPEN") {
            usageCount++;
        }
    }
    if (topic.includes('fill-level')) {
        currentFill = parseInt(payload) || 0;
    }
});

// Route for your app frontend to poll metrics
app.get('/analytics', (req, res) => {
    res.json({ 
        usage: usageCount, 
        fill: currentFill, 
        state: lastLidState, 
        mqtt: client.connected 
    });
});

// Manual command gateway endpoint
app.post('/command', (req, res) => {
    const start = Date.now();
    const cmd = req.body.command;
    
    if (!cmd) {
        return res.status(400).json({ error: "Missing command parameter" });
    }

    const upperCmd = cmd.toUpperCase().trim();

    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, upperCmd, () => {
        res.json({ 
            status: "Success",
            commandSent: upperCmd,
            latency: Date.now() - start 
        });
    });
});

// Counter wipe endpoint
app.post('/reset', (req, res) => {
    usageCount = 0;
    res.json({ status: "Reset successful", usage: usageCount });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot CMS Live on port ${PORT}`));