const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Set up multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

function generateFileName() {//hàm tạo tên ảnh
    const now = new Date();
    return now.toISOString()
        .replace(/[:.]/g, '_')  // Replace : and . with _
        .replace('Z', '')       // Remove Z suffix
        .slice(0, 19);          // Take only YYYY_MM_DDThh_mm_ss
}

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

router.post('/fire-detection', upload.single('file'), async (req, res) => {
    if (!req.file) {
        console.error('No file received');
        return res.status(400).send('No file received');
    }
    const tempPath = req.file.path;

    try {
        const now = new Date();
        const filename = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        
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

router.get('/graph-data', async (req, res) => {
    try {
        const collection = req.app.locals.db.collection('fire_images'); 
        // Tính thời gian hiện tại UTC+7
        const currentUtc7Time = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
        
        const results = await collection.aggregate([
            {
                $addFields: {
                    timestamp: "$filename" // Sử dụng trực tiếp filename vì đã là Date
                }
            },
            {
                $match: {
                    timestamp: {
                        $gte: new Date(currentUtc7Time - 25 * 60 * 60 * 1000) // 25 giờ trước theo UTC+7
                    }
                }
            },
            {
                $project: {
                    hours_difference: {
                        $floor: {
                            $divide: [
                                { $subtract: [currentUtc7Time, "$timestamp"] },
                                1000 * 60 * 60
                            ]
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$hours_difference",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]).toArray();

        // Thêm thông tin về thời gian hiện tại và người dùng vào response
        const currentUtcTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const response = {
            data: results,
            currentTime: currentUtcTime,
            userLogin: 'namvu0823'
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching graph data:', error);
        res.status(500).send('Error fetching graph data');
    }
});


// Fetch images by filename substring endpoint
router.get('/history_image', async (req, res) => {
    const { substring } = req.query;

    if (!substring) {
        return res.status(400).json({ message: 'Substring query parameter is required' });
    }

    try {
        const collection = req.app.locals.db.collection('fire_images');
        // Create start and end date for the query
        const searchDate = new Date(substring);
        const nextDay = new Date(searchDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const images = await collection.find({
            filename: {
                $gte: searchDate,
                $lt: nextDay
            }
        }).toArray();

        res.status(200).json(images);
    } catch (error) {
        console.error('Error fetching images by substring:', error);
        res.status(500).json({ message: 'Error fetching images by substring' });
    }
});

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
router.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'history', 'history.html'));
});

module.exports = router;