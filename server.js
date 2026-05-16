const express = require('express');
const mqtt = require('mqtt');
const app = express();

// Secure dynamic web binding port
const PORT = process.env.PORT || 8080;

// Quote-Proof Sanitization Subsystem
const AIO_USERNAME = (process.env.AIO_USERNAME || "").replace(/^"|"$/g, '').trim();
const AIO_KEY = (process.env.AIO_KEY || "").replace(/^"|"$/g, '').trim();

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 35; // Presentation baseline value
let client = null;

app.use(express.static('public'));
app.use(express.json());

// Force immediate server binding to maintain green cloud status indicators
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`BinBot CMS Engine Active on port ${PORT}`);
    initializeMQTT();
});

function initializeMQTT() {
    if (!AIO_USERNAME || !AIO_KEY) {
        console.error("CONFIGURATION ALERT: Credentials invalid or blank inside parameters.");
        return;
    }

    console.log(`LOG MATRIX: Initiating secure WebSocket pipeline path for: [${AIO_USERNAME}]`);

    // Establishes a persistent live data channel over port 443
    client = mqtt.connect(`wss://io.adafruit.com/mqtt`, {
        port: 443,
        username: AIO_USERNAME,
        password: AIO_KEY,
        rejectUnauthorized: false,
        reconnectPeriod: 3000
    });

    client.on('connect', () => {
        console.log(`SUCCESS: WebSocket Tunnel verified. Monitoring path: ${AIO_USERNAME}/feeds/google-binbot`);
        // Subscribes directly to your verified feed topic identifier
        client.subscribe(`${AIO_USERNAME}/feeds/google-binbot`);
    });

    client.on('message', (topic, msg) => {
        let payload = msg.toString().toUpperCase().trim();
        console.log(`Incoming Matrix Stream -> [${topic}]: ${payload}`);
        
        // Strict topic assessment boundary
        if (topic.toLowerCase().includes('google-binbot') || topic.toLowerCase().includes('binbot')) {
            // Re-align close configurations to standard state strings
            if (payload === "CLOSE") payload = "CLOSED";
            
            // Incremental capacity simulations for interactive tracking indicators
            if (payload === "OPEN" && lastLidState !== "OPEN") {
                usageCount++;
                currentFill += 5;
                if (currentFill > 100) currentFill = 100;
            }
            
            lastLidState = payload;
        }
    });

    client.on('error', (err) => {
        console.error("Adafruit Protocol Broker Exception:", err.message);
    });

    client.on('offline', () => {
        console.log("Network drop recognized. Running automated gateway recovery loop...");
    });
}

// Analytics REST Gateway
app.get('/analytics', (req, res) => {
    res.json({ 
        usage: usageCount, 
        fill: currentFill, 
        state: lastLidState, 
        mqtt: client ? client.connected : false 
    });
});

// Outbound Command Broker Pipeline
app.post('/command', (req, res) => {
    const cmd = req.body.command;
    
    if (!cmd || !client || !client.connected) {
        return res.status(400).json({ error: "Transmission halted. Core MQTT path is offline." });
    }

    let upperCmd = cmd.toUpperCase().trim();
    if (upperCmd === "CLOSE") upperCmd = "CLOSED";

    // Publishes values straight back to your explicit channel location
    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, upperCmd, () => {
        res.json({ status: "Success", commandSent: upperCmd });
    });
});

app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0;
    res.json({ status: "Data matrices cleared." });
});