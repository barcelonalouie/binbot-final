app.post('/command', (req, res) => {
    const start = Date.now();
    
    // Fallback to query parameter if JSON body isn't parsed
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