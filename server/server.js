const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {MongoClient} = require('mongodb');
const uri="mongodb+srv://vuvannamb1:hxruOlLP2VlAsXK0@cluster0.2kdmx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);


//giao tiếp esp32
const WebSocket = require('ws');
const wsPort = 8080;
const wss = new WebSocket.Server({ port: wsPort });

const app = express();
const port = 3000;
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/client/login'));
app.use(express.static(__dirname + '/client/app'));

let latestImage = ''; // ảnh mới nhất nhận được

let db;
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Đã kết nối đến MongoDB Atlas");

        // Lấy database
        db = client.db('prj3_data'); 
    } catch (error) {
        console.error("Không thể kết nối MongoDB:", error);
    }
}
connectToDatabase();// Kết nối đến database khi khởi động server

// Khởi động tiến trình Python

let pythonProcess=null;
let msg_camera='camera_disable';
app.post('/toggle-python', (req, res) => {//endpoint bật tắt python process và camera
    const {msg}=req.query;
    if(msg==='true'){
        msg_camera='camera_enable';
        pythonProcess = spawn('python', [
            path.join(__dirname, '../Fire_Detection_Yolo/fire_detect.py'),
        ]);
        pythonProcess.stdout.on('data', (data) => {
            console.log(`Python output: ${data.toString()}`);
        });
        
        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error: ${data.toString()}`);
        });
        
        pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
        });
    }
    else if(msg==='false') {
        msg_camera='camera_disable';
        if (pythonProcess) {
            pythonProcess.kill('SIGINT');
            console.log('Python process stopped');
            pythonProcess = null;
            res.status(200).json({ message: 'Python script stopped' });
        } else {
        res.status(400).json({ message: 'Python script is not running' });
        }
    }
    else {
        res.status(400).json({ message: 'Invalid action' });
    }
    
});

// Nhận hình ảnh từ ESP32
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).send('No file uploaded');
    }
    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, 'uploads', 'latest.jpg');

    fs.rename(tempPath, targetPath, (err) => {
        if (err) return res.sendStatus(500);
        latestImage = '/uploads/latest.jpg';
        res.sendStatus(200);
    });
});

app.post('/processed', upload.single('file'), (req, res) => {
    if (!req.file) {
        console.error('No file received');
        return res.status(400).send('No file received');
    }

    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, 'uploads', 'processed.jpg');

    fs.rename(tempPath, targetPath, (err) => {
        if (err) return res.sendStatus(500);
        console.log('Processed image received and saved');
        res.sendStatus(200);
    });
});

app.post('/login', async(req, res) => {//endpoint login 
    const { email, password } = req.body;
    try{
        const user = await db.collection('users').findOne({ email :email});
        if(user){
            if(user.password===password){
                res.json({message: 'Đăng nhập thành công',user_id:user.id});
                }
            else{
                res.status(401).json({message: 'Mật khẩu không đúng'});
            }
        }
        else{
            res.status(401).json({message: 'Email không đúng'});
        }
    }
    catch(error){
        console.error('Lỗi khi đăng nhập:', error);
        res.status(500).json({message: 'Lỗi server'});
    }
});



app.use('/uploads', express.static(path.join(__dirname, 'uploads')));//uploads ảnh mới nhất vào thư mục uploads

app.get('/', (req, res) => {res.sendFile(path.join(__dirname,'client','login', 'login.html'));});
app.get('/app', (req, res) => { res.sendFile(path.join(__dirname,'client', 'app', 'app.html'));});
  
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

let sensorData = {}; 

wss.on('connection', (ws) => {
    console.log('ESP32 connected');
   // ws.send(JSON.stringify(msg_camera));
    setInterval(() => {ws.send(JSON.stringify(msg_camera));}, 100);//gửi thông tin bật/tắt camera mỗi 100ms

    ws.on('message', async (message) => {
    
    try {
        const rec_sensorData = JSON.parse(message);//nhận sensor data từ esp32
        sensorData = rec_sensorData;
    } 
    catch (error) {
        console.error('Error parsing message:', error);
        return;
    }
    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
    });
});
app.get('/sensor-data', (req, res) => {res.json(sensorData);});// gửi sensor data tới app

console.log(`WebSocket server running at ws://localhost:${wsPort}`);