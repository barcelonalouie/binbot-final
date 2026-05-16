const express = require('express');
const mqtt = require('mqtt');
const app = express();

const PORT = process.env.PORT || 8080;

// Clean up any forced quotation marks from Railway's JSON panel
const AIO_USERNAME = (process.env.AIO_USERNAME || "").replace(/^"|"$/g, '').trim();
const AIO_KEY = (process.env.AIO_KEY || "").replace(/^"|"$/g, '').trim();

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 35; 
let client = null;

// Connect to Adafruit immediately
if (AIO_USERNAME && AIO_KEY) {
    console.log(`LOG: Connecting to Adafruit IO for user: [${AIO_USERNAME}]`);
    
    client = mqtt.connect(`wss://io.adafruit.com/mqtt`, {
        port: 443,
        username: AIO_USERNAME,
        password: AIO_KEY,
        rejectUnauthorized: false,
        reconnectPeriod: 3000
    });

    client.on('connect', () => {
        console.log("SUCCESS: Connected to Adafruit IO via WebSockets!");
        client.subscribe(`${AIO_USERNAME}/feeds/+`);
    });

    client.on('message', (topic, msg) => {
        let payload = msg.toString().toUpperCase().trim();
        console.log(`Stream -> [${topic}]: ${payload}`);
        
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
        console.error("Adafruit Error:", err.message);
    });
} else {
    console.error("ERROR: Credentials missing in Environment Variables.");
}

app.use(express.static('public'));
app.use(express.json());

app.get('/analytics', (req, res) => {
    // Dynamically checks if the client exists and is currently connected
    const isConnected = client ? client.connected : false;
    res.json({ 
        usage: usageCount, 
        fill: currentFill, 
        state: lastLidState, 
        mqtt: isConnected 
    });
});

app.post('/command', (req, res) => {
    const cmd = req.body.command;
    if (!cmd || !client || !client.connected) return res.status(400).json({ error: "Offline." });

    let upperCmd = cmd.toUpperCase().trim();
    if (upperCmd === "CLOSE") upperCmd = "CLOSED";

    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, upperCmd, () => {
        res.json({ status: "Success", commandSent: upperCmd });
    });
});

app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0; 
    res.json({ status: "Reset successful" });
});

// Bind port instantly so Railway registers the application as healthy
app.listen(PORT, "0.0.0.0", () => {
    console.log(`BinBot Terminal Live on port ${PORT}`);
});