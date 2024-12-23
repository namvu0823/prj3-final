const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Set up multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Toggle Python Process endpoint
router.post('/toggle-python', (req, res) => {
    const {msg} = req.query;
    if(msg === 'true') {
        global.msg_camera = 'camera_enable';
        global.pythonProcess = spawn('python', [
            path.join(__dirname, '../Fire_Detection_Yolo/fire_detect.py'),
        ]);
        global.pythonProcess.stdout.on('data', (data) => {
            console.log(`Python output: ${data.toString()}`);
        });
        
        global.pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error: ${data.toString()}`);
        });
        
        global.pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
        });
    }
    else if(msg === 'false') {
        global.msg_camera = 'camera_disable';
        if (global.pythonProcess) {
            global.pythonProcess.kill('SIGINT');
            console.log('Python process stopped');
            global.pythonProcess = null;
            res.status(200).json({ message: 'Python script stopped' });
        } else {
            res.status(400).json({ message: 'Python script is not running' });
        }
    }
    else {
        res.status(400).json({ message: 'Invalid action' });
    }
});

// Upload image endpoint
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).send('No file uploaded');
    }
    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, 'uploads', 'latest.jpg');

    fs.rename(tempPath, targetPath, (err) => {
        if (err) return res.sendStatus(500);
        global.latestImage = '/uploads/latest.jpg';
        res.sendStatus(200);
    });
});

// Process image endpoint
router.post('/processed', upload.single('file'), (req, res) => {
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

router.post('/fire-detection', upload.single('file'), async (req, res) => {//lưu ảnh phát hiện lửa lên db
    if (!req.file) {
        console.error('No file received');
        return res.status(400).send('No file received');
    }
    const tempPath = req.file.path;

    try {
        const now = new Date();
        const filename = now.toISOString();
        filename = filename.replace(/[^a-zA-Z0-9]/g, '_');
        const fileContent = fs.readFileSync(tempPath);
        const imageDocument = {
            filename,
            contentType: req.file.mimetype || 'image/jpeg',
            data: fileContent,
        };

        const result = await req.app.locals.db.collection('fire_images').insertOne(imageDocument);
        console.log('Image saved to MongoDB:', result.insertedId);

        fs.unlinkSync(tempPath);
        res.status(200).send('Image saved to MongoDB');
    } catch (error) {
        console.error('Error saving image to MongoDB:', error);
        res.status(500).send('Error saving image to MongoDB');
    }
});

// Login endpoint
router.post('/login', async(req, res) => {
    const { email, password } = req.body;
    try {
        const user = await req.app.locals.db.collection('users').findOne({ email: email });
        if(user) {
            if(user.password === password) {
                res.json({message: 'Đăng nhập thành công', user_id: user.id});
            } else {
                res.status(401).json({message: 'Mật khẩu không đúng'});
            }
        } else {
            res.status(401).json({message: 'Email không đúng'});
        }
    } catch(error) {
        console.error('Lỗi khi đăng nhập:', error);
        res.status(500).json({message: 'Lỗi server'});
    }
});

// List images endpoint
router.get('/list-images', async (req, res) => {//lấy danh sách ảnh
    try {
        const images = await req.app.locals.db.collection('fire_images').find(
            {}, 
            { projection: { _id: 1, filename: 1 } }
        ).toArray();
        res.json(images);
    } catch (error) {
        console.error('Error fetching image list:', error);
        res.status(500).send('Error fetching image list');
    }
});

router.get('/graph-data', async (req, res) => {
    try {
        const collection = req.app.locals.db.collection('fire_images'); 

        // Thực hiện truy vấn
        const results = await collection.aggregate([
            {
                $addFields: {
                    timestamp: {
                        $dateFromString: {
                            dateString: {
                                $substr: ["$filename", 0, 23] // Trích xuất phần timestamp từ filename
                            },
                            format: "%Y_%m_%dT%H_%M_%S_%LZ"
                        }
                    }
                }
            },
            {
                $match: {
                    timestamp: {
                        $gte: new Date(new Date() - 25 * 60 * 60 * 1000) // Lọc trong 25 giờ qua
                    }
                }
            },
            {
                $project: {
                    hours_difference: {
                        $floor: {
                            $divide: [
                                { $subtract: [new Date(), "$timestamp"] }, // Thời gian hiện tại - timestamp
                                1000 * 60 * 60 // Chuyển đổi từ milliseconds sang giờ
                            ]
                        }
                    }
                }
            },
            {
                $match: {
                    hours_difference: { $ne: 0 } // Loại bỏ nhóm `_id = 0`
                }
            },
            {
                $group: {
                    _id: "$hours_difference", // Nhóm theo độ chênh lệch giờ
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sắp xếp theo độ chênh lệch giờ
            }
        ]).toArray();

        // Trả dữ liệu về client
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching graph data:', error);
        res.status(500).send('Error fetching graph data');
    }
});


// Sensor data endpoint
router.get('/sensor-data', (req, res) => {
    res.json(req.app.locals.sensorData);
});

// Main routes
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'login', 'login.html'));
});

router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'app', 'app.html'));
});

module.exports = router;