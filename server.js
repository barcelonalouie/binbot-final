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

// Use the explicit wss engine configuration but load the keys from the environment securely
if (AIO_USERNAME && AIO_KEY) {
    client = mqtt.connect(`wss://io.adafruit.com:443/mqtt`, {
      username: AIO_USERNAME,
      password: AIO_KEY,
      protocol: 'wss', // CRITICAL: Explicitly forces the library to use WebSockets
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

// Leave the rest of the code underneath completely untouched!