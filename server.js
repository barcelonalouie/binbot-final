const express = require('express');
const mqtt = require('mqtt');
const app = express();

const PORT = process.env.PORT || 8080;

// Auto-Clean Environment Variables (Strips Railway's forced quotation marks)
const AIO_USERNAME = (process.env.AIO_USERNAME || "").replace(/^"|"$/g, '').trim();
const AIO_KEY = (process.env.AIO_KEY || "").replace(/^"|"$/g, '').trim();

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 35; // Presentation baseline value (35%)
let client = null;

// Cloud-Proof WebSocket Profile
if (AIO_USERNAME && AIO_KEY) {
    console.log(`LOG INITIALIZATION: Spawning tunnel for account: [${AIO_USERNAME}]`);
    
    client = mqtt.connect(`wss://io.adafruit.com/mqtt`, {
      port: 443, // Disguises stream over standard HTTPS web traffic to slip through firewalls
      username: AIO_USERNAME,
      password: AIO_KEY,
      rejectUnauthorized: false,
      reconnectPeriod: 4000
    });

    client.on('connect', () => {
        console.log("SUCCESS: Cloud WebSocket Tunnel Established on Railway.");
        client.subscribe(`${AIO_USERNAME}/feeds/+`); // Wildcard captures your feed dynamically
    });

    client.on('message', (topic, msg) => {
        let payload = msg.toString().toUpperCase().trim();
        console.log(`Incoming Data Stream [${topic}] -> ${payload}`);
        
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
        console.error("Adafruit WebSocket Alert:", err.message);
    });
} else {
    console.error("CONFIGURATION ERROR: Missing AIO credentials in your environment variables.");
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

app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0; 
    res.json({ status: "Reset successful", usage: usageCount, fill: currentFill });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot Terminal Live on port ${PORT}`));