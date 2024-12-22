const WebSocket = require('ws');
const axios = require('axios');

const wsPort = 8080;
const serverUrl = 'http://localhost:3000/receive_sensor_data';

const wss = new WebSocket.Server({ port: wsPort });

wss.on('connection', (ws) => {
    console.log('ESP32 connected');

    ws.on('message', async (message) => {
        //console.log('Received data from ESP32:', message);

        // Parse the received data (assuming it's JSON)
        let sensorData;
        try {
            sensorData = JSON.parse(message);
        } catch (error) {
            console.error('Error parsing message:', error);
            return;
        }
        // Send the data to the server
        try {
            const response = await axios.post(serverUrl, sensorData);
            //console.log('Data sent to server:', response.status);
        } catch (error) {
            //console.error('Error sending data to server:', error);
        }
    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
    });
});

console.log(`WebSocket server running at ws://localhost:${wsPort}`);