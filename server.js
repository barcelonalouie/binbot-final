const express = require('express');
const mqtt = require('mqtt');
const app = express();

const PORT = process.env.PORT || 8080;
const AIO_USERNAME = process.env.AIO_USERNAME || "";
const AIO_KEY = process.env.AIO_KEY || "";

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 35; // Start the presentation at a realistic baseline value (35%)
let client = null;

if (AIO_USERNAME && AIO_KEY) {
    client = mqtt.connect(`wss://io.adafruit.com:443/mqtt`, {
      username: AIO_USERNAME,
      password: AIO_KEY,
      reconnectPeriod: 5000 
    });

    client.on('connect', () => {
        console.log("SUCCESS: Connected to Adafruit MQTT Broker over Secure WebSockets.");
        client.subscribe(`${AIO_USERNAME}/feeds/google-binbot`);
    });

    client.on('message', (topic, msg) => {
        let payload = msg.toString().toUpperCase().trim();
        console.log(`Incoming Data Stream [${topic}] -> ${payload}`);
        
        if (topic.includes('google-binbot')) {
            if (payload === "CLOSE") payload = "CLOSED";
            
            // EMULATION LOGIC: If moving from CLOSED to OPEN, step up the waste volume
            if (payload === "OPEN" && lastLidState !== "OPEN") {
                usageCount++;
                currentFill += 5; // Increment by 5% per deployment cycle
                if (currentFill > 100) currentFill = 100; // Cap it at full capacity
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

// Pass both the physical lid data and the virtual fill data down to your UI dashboard smoothly
app.get('/analytics', (req, res) => {
    res.json({ 
        usage: usageCount, 
        fill: currentFill, // Returns the smart virtual analytics profile variable
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

// Resetting the system now resets the virtual fill level cleanly back to zero!
app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0; 
    res.json({ status: "Reset successful", usage: usageCount, fill: currentFill });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot Terminal Live on port ${PORT}`));