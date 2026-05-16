async function fetchAnalytics() {
    try {
        const response = await fetch('/analytics');
        const data = await response.json();

        // Update Fill Level
        const fillBar = document.getElementById('fill-bar');
        const fillText = document.getElementById('fill-text');
        
        fillText.innerText = data.fill;
        fillBar.style.height = `${data.fill}%`;

        // Add visual alarm color context if trash bin is nearly full (>= 85%)
        if (data.fill >= 85) {
            fillBar.classList.add('critical');
        } else {
            fillBar.classList.remove('critical');
        }

        // Update Metrics
        document.getElementById('lid-state').innerText = data.state;
        document.getElementById('usage-count').innerText = data.usage;

        // Update MQTT Connection Status
        const mqttStatus = document.getElementById('mqtt-status');
        const statusText = mqttStatus.querySelector('.status-text');
        if (data.mqtt) {
            mqttStatus.classList.add('connected');
            statusText.innerText = "MQTT CONNECTED";
        } else {
            mqttStatus.classList.remove('connected');
            statusText.innerText = "MQTT DISCONNECTED";
        }

    } catch (error) {
        console.error("Error updating dashboard analytics:", error);
    }
}

async function sendControl(commandString) {
    try {
        const response = await fetch('/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: commandString })
        });
        const data = await response.json();
        
        // Show command execution speed
        document.getElementById('latency-value').innerHTML = `${data.latency} <span class="unit">ms</span>`;
        
        // Immediately fetch updates after command execution
        setTimeout(fetchAnalytics, 300);
    } catch (error) {
        console.error("Error dispatching manual override command:", error);
    }
}

// Continual background telemetry poll loop
setInterval(fetchAnalytics, 2000);
fetchAnalytics();