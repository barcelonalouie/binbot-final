const express = require('express');
const mqtt = require('mqtt');

const app = express();

const PORT = process.env.PORT || 8080;

// ADAFRUIT IO CREDENTIALS
const AIO_USERNAME = process.env.AIO_USERNAME;
const AIO_KEY = process.env.AIO_KEY;

// SYSTEM VARIABLES
let usageCount = 0;
let currentFill = 0;
let lastLidState = "CLOSED";

// MQTT CLIENT
let client = null;

// EXPRESS
app.use(express.static('public'));
app.use(express.json());

// START SERVER
app.listen(PORT, '0.0.0.0', () => {

    console.log(`SERVER RUNNING ON PORT ${PORT}`);

    initializeMQTT();
});

// ============================
// MQTT CONNECTION
// ============================

function initializeMQTT() {
    if (!AIO_USERNAME || !AIO_KEY) {
        console.error("Adafruit credentials missing.");
        return;
    }

    console.log("CONNECTING TO ADAFRUIT IO VIA SECURE WEBSOCKETS...");

    // Using wss:// on Port 443 bypasses cloud environment port blocking entirely
    client = mqtt.connect('wss://io.adafruit.com/mqtt', {
        port: 443,
        username: AIO_USERNAME,
        password: AIO_KEY,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        rejectUnauthorized: false, // Prevents cloud SSL handshake failures
        clean: true
    });

    // CONNECTED
    client.on('connect', () => {
        console.log("MQTT CONNECTED SUCCESSFULLY!");

        const topic = `${AIO_USERNAME}/feeds/google-binbot`;

        client.subscribe(topic, (err) => {
            if (err) {
                console.error("SUBSCRIBE FAILED:", err);
            } else {
                console.log(`SUBSCRIBED TO ${topic}`);
            }
        });
    });

    // MESSAGE RECEIVED
    client.on('message', (topic, message) => {
        const payload = message.toString().trim().toUpperCase();
        console.log(`MESSAGE RECEIVED: ${topic} -> ${payload}`);

        if (topic === `${AIO_USERNAME}/feeds/google-binbot`) {
            if (payload === "OPEN") {
                if (lastLidState !== "OPEN") {
                    usageCount++;
                    currentFill += 5;
                    if (currentFill > 100) currentFill = 100;
                }
                lastLidState = "OPEN";
            }
            else if (payload === "CLOSE" || payload === "CLOSED") {
                lastLidState = "CLOSED";
            }
            console.log("STATE:", lastLidState);
        }
    });

    client.on('error', (err) => {
        console.error("MQTT ERROR:", err.message);
    });

    client.on('offline', () => {
        console.log("MQTT OFFLINE");
    });

    client.on('reconnect', () => {
        console.log("MQTT RECONNECTING...");
    });
}

// ============================
// API ROUTES
// ============================

// ANALYTICS
app.get('/analytics', (req, res) => {

    res.json({

        usage: usageCount,

        fill: currentFill,

        state: lastLidState,

        mqtt: client ? client.connected : false
    });
});

// SEND COMMAND
app.post('/command', (req, res) => {

    const command =
        req.body.command;

    if (!command) {

        return res.status(400).json({

            error: "No command provided."
        });
    }

    if (!client || !client.connected) {

        return res.status(500).json({

            error: "MQTT offline."
        });
    }

    const upperCommand =
        command.toUpperCase().trim();

    client.publish(

        `${AIO_USERNAME}/feeds/google-binbot`,

        upperCommand,

        (err) => {

            if (err) {

                console.error(
                    "PUBLISH FAILED:",
                    err
                );

                return res.status(500).json({

                    error: "Publish failed."
                });
            }

            res.json({

                success: true,

                command: upperCommand
            });
        }
    );
});

// RESET
app.post('/reset', (req, res) => {

    usageCount = 0;

    currentFill = 0;

    res.json({

        success: true
    });
});