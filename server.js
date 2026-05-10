const express = require('express');
const mqtt = require('mqtt');
const app = express();

const PORT = process.env.PORT || 8080;
const AIO_USERNAME = "barce";
const AIO_KEY = "aio_sHIJ366ZvkXzLuGTYGorSfMPJOCH";

let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 0;

const client = mqtt.connect(`mqtts://io.adafruit.com`, {
  username: AIO_USERNAME,
  password: AIO_KEY
});

app.use(express.static('public'));
app.use(express.json());

// Listen for hardware updates
client.on('connect', () => {
    client.subscribe(`${AIO_USERNAME}/feeds/google-binbot`);
    client.subscribe(`${AIO_USERNAME}/feeds/fill-level`);
});

client.on('message', (topic, msg) => {
    if(topic.includes('google-binbot')) lastLidState = msg.toString();
    if(topic.includes('fill-level')) currentFill = parseInt(msg.toString());
});

app.get('/analytics', (req, res) => {
    res.json({ usage: usageCount, fill: currentFill, state: lastLidState, mqtt: client.connected });
});

app.post('/command', (req, res) => {
    const start = Date.now();
    const cmd = req.body.command;
    client.publish(`${AIO_USERNAME}/feeds/google-binbot`, cmd, () => {
        if(cmd === "OPEN") usageCount++;
        res.json({ latency: Date.now() - start });
    });
});

app.listen(PORT, "0.0.0.0", () => console.log(`BinBot CMS Live`));