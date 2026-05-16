const express = require('express');
const mqtt = require('mqtt');

const app = express();

const PORT = process.env.PORT || 8080;

// Railway Environment Variables
const AIO_USERNAME = (process.env.AIO_USERNAME || "").trim();
const AIO_KEY = (process.env.AIO_KEY || "").trim();

// System Variables
let usageCount = 0;
let lastLidState = "CLOSED";
let currentFill = 0;

let client = null;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Start Express Server FIRST
app.listen(PORT, '0.0.0.0', () => {

    console.log(`BINBOT SERVER RUNNING ON PORT ${PORT}`);

    initializeMQTT();
});

// =========================
// MQTT INITIALIZATION
// =========================

function initializeMQTT() {

    if (!AIO_USERNAME || !AIO_KEY) {

        console.error("ERROR: Missing Adafruit IO credentials.");
        return;
    }

    console.log("CONNECTING TO ADAFRUIT IO MQTT...");

    client = mqtt.connect('wss://io.adafruit.com:443/mqtt/', {

        username: AIO_USERNAME,
        password: AIO_KEY,

        protocol: 'wss',

        reconnectPeriod: 5000,

        connectTimeout: 30000,

        clean: true
    });

    // SUCCESSFUL CONNECTION
    client.on('connect', () => {

        console.log("MQTT CONNECTED SUCCESSFULLY");

        const lidFeed = `${AIO_USERNAME}/feeds/google-binbot`;

        client.subscribe(lidFeed, (err) => {

            if (err) {

                console.error("SUBSCRIBE ERROR:", err);

            } else {

                console.log(`SUBSCRIBED TO: ${lidFeed}`);
            }
        });
    });

    // INCOMING DATA
    client.on('message', (topic, message) => {

        const payload = message.toString().trim().toUpperCase();

        console.log(`MESSAGE RECEIVED -> ${topic}: ${payload}`);

        // GOOGLE BINBOT FEED
        if (topic === `${AIO_USERNAME}/feeds/google-binbot`) {

            // OPEN
            if (payload === "OPEN") {

                if (lastLidState !== "OPEN") {

                    usageCount++;

                    // Simulated Fill Increase
                    currentFill += 5;

                    if (currentFill > 100) {
                        currentFill = 100;
                    }
                }

                lastLidState = "OPEN";
            }

            // CLOSE
            else if (payload === "CLOSE" || payload === "CLOSED") {

                lastLidState = "CLOSED";
            }

            console.log("CURRENT STATE:", lastLidState);
            console.log("CURRENT FILL:", currentFill);
            console.log("TOTAL USAGE:", usageCount);
        }
    });

    // ERROR HANDLING
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

// =========================
// API ROUTES
// =========================

// ANALYTICS
app.get('/analytics', (req, res) => {

    res.json({

        usage: usageCount,

        fill: currentFill,

        state: lastLidState,

        mqtt: client ? client.connected : false
    });
});

// COMMAND
app.post('/command', (req, res) => {

    const command = req.body.command;

    if (!command) {

        return res.status(400).json({

            error: "No command provided."
        });
    }

    if (!client || !client.connected) {

        return res.status(500).json({

            error: "MQTT is offline."
        });
    }

    const upperCommand = command.toUpperCase().trim();

    client.publish(

        `${AIO_USERNAME}/feeds/google-binbot`,
        upperCommand,

        (err) => {

            if (err) {

                console.error("PUBLISH ERROR:", err);

                return res.status(500).json({

                    error: "Failed to publish command."
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

        success: true,

        usage: usageCount,

        fill: currentFill
    });
});