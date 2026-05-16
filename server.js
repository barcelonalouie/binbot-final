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

// Serve your frontend assets from the public folder
app.use(express.static('public'));
app.use(express.json());

// Listen for hardware updates from Adafruit IO
client.on('connect', () => {
    console.log("Connected to Adafruit MQTT Broker successfully.");
    client.subscribe(`${AIO_USERNAME}/feeds/google-binbot`);
    client.subscribe(`${AIO_USERNAME}/feeds/fill-level`);
});

client.on('message', (topic, msg) => {
    if(topic.includes('google-binbot')) lastLidState = msg.toString();
    if(topic.includes('fill-level')) currentFill = parseInt(msg.toString());
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

// POST gateway endpoint supporting both JSON and URL query param triggers
app.post('/command', (req, res) => {
    const start = Date.now();
    
    // Look for the command in the JSON body OR a URL parameter (?cmd=OPEN)
    const cmd = (req.body && req.body.command) ? req.body.command : req.query.cmd;
    
    if (!cmd) {
        return res.status(400).json({ error: "Missing command parameter" });
    }

    const upperCmd = cmd.toUpperCase();

    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, upperCmd, () => {
        if(upperCmd === "OPEN") usageCount++;
        res.json({ 
            status: "Success",
            commandSent: upperCmd,
            latency: Date.now() - start 
        });
    });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot CMS Live on port ${PORT}`));