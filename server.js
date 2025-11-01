const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files

// Helper function to read data.json
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is corrupted, return default data
        const defaultData = {
            channels: [],
            directMessages: [],
            users: [],
            admin: {
                password: 'admin123',
                customUsername: null,
                isLoggedIn: false
            },
            announcements: []
        };
        // Write default data to file
        await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
}

// Helper function to write data.json
async function writeData(data) {
    try {
        // Ensure admin object exists
        if (!data.admin) {
            data.admin = {
                password: 'admin123',
                customUsername: null,
                isLoggedIn: false
            };
        }
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing data:', error);
        return false;
    }
}

// GET endpoint to fetch all data
app.get('/api/data', async (req, res) => {
    try {
        const data = await readData();
        res.json(data);
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// POST endpoint to save all data
app.post('/api/data', async (req, res) => {
    try {
        const data = req.body;
        const success = await writeData(data);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to save data' });
        }
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Data file: ${DATA_FILE}`);
});

