const express = require('express');
const path = require('path');
const {MongoClient} = require('mongodb');
const WebSocket = require('ws');
const routes = require('./routes');

const uri = "mongodb+srv://vuvannamb1:hxruOlLP2VlAsXK0@cluster0.2kdmx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const app = express();
const port = 3000;
const wsPort = 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/client/login'));
app.use(express.static(__dirname + '/client/app'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global variables
global.latestImage = '';
global.pythonProcess = null;
global.msg_camera = 'camera_disable';
global.sensorData = {};

// Database connection
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Đã kết nối đến MongoDB Atlas");
        app.locals.db = client.db('prj3_data');
    } catch (error) {
        console.error("Không thể kết nối MongoDB:", error);
    }
}
connectToDatabase();

// WebSocket server
const wss = new WebSocket.Server({ port: wsPort });
wss.on('connection', (ws) => {
    console.log('ESP32 connected');
    setInterval(() => {
        ws.send(JSON.stringify(global.msg_camera));
    }, 100);

    ws.on('message', async (message) => {
        try {
            const rec_sensorData = JSON.parse(message);
            global.sensorData = rec_sensorData;
            app.locals.sensorData = rec_sensorData;
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
    });
});

// Routes
app.use('/', routes);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

console.log(`WebSocket server running at ws://localhost:${wsPort}`);