const express = require('express');
const axios = require('axios'); // We use axios to fetch Adafruit data reliably over HTTP

const app = express();
const PORT = process.env.PORT || 8080;

// CREDENTIAL SANITIZATION
const AIO_USERNAME = (process.env.AIO_USERNAME || "").replace(/^["']|["']$/g, '').trim();
const AIO_KEY = (process.env.AIO_KEY || "").replace(/^["']|["']$/g, '').trim();
const FEED_KEY = "google-binbot";

// SYSTEM VARIABLES
let usageCount = 0;
let currentFill = 35; // Default placeholder or matching current level
let lastLidState = "CLOSED";

app.use(express.static('public'));
app.use(express.json());

// ANALYTICS ENDPOINT (Dynamically syncs with Adafruit on every frontend request)
app.get('/analytics', async (req, res) => {
    let mqttConnectedStatus = false;

    if (AIO_USERNAME && AIO_KEY) {
        try {
            // Fetch the exact current live data directly from Adafruit's API
            const response = await axios.get(
                `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${FEED_KEY}`,
                { headers: { 'X-AIO-Key': AIO_KEY } }
            );

            if (response.data) {
                mqttConnectedStatus = true; // Adafruit API answered successfully
                const adafruitValue = response.data.last_value ? response.data.last_value.toUpperCase().trim() : "CLOSE";

                // Map CLOSE to CLOSED for frontend display consistency
                let newLidState = (adafruitValue === "CLOSE") ? "CLOSED" : "OPEN";

                // If state switched to OPEN via Google Assistant / IFTTT, update logic metrics
                if (newLidState === "OPEN" && lastLidState !== "OPEN") {
                    usageCount++;
                    currentFill += 5;
                    if (currentFill > 100) currentFill = 100;
                }

                lastLidState = newLidState;
            }
        } catch (error) {
            console.error("Error fetching live data from Adafruit REST API:", error.message);
            mqttConnectedStatus = false;
        }
    }

    // Serve accurate calculations straight to your UI
    res.json({
        usage: usageCount,
        fill: currentFill,
        state: lastLidState,
        mqtt: mqttConnectedStatus // Map API connectivity as your green link connection!
    });
});

// SEND COMMAND (Pushes lid manual triggers straight up to Adafruit)
app.post('/command', async (req, res) => {
    const command = req.body.command;

    if (!command) {
        return res.status(400).json({ error: "No command provided." });
    }

    let upperCommand = command.toUpperCase().trim();
    if (upperCommand === "CLOSED") upperCommand = "CLOSE"; // Align with IFTTT payload text

    try {
        await axios.post(
            `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${FEED_KEY}/data`,
            { value: upperCommand },
            { headers: { 'X-AIO-Key': AIO_KEY } }
        );

        res.json({ success: true, command: upperCommand });
    } catch (error) {
        console.error("Publish failed via REST API:", error.message);
        res.status(500).json({ error: "Failed to forward command to cloud service." });
    }
});

// RESET COUNTERS
app.post('/reset', (req, res) => {
    usageCount = 0;
    currentFill = 0;
    res.json({ success: true });
});

// START EXPRESS
app.listen(PORT, '0.0.0.0', () => {
    console.log(`BinBot Terminal Live and Server Running on port ${PORT}`);
});