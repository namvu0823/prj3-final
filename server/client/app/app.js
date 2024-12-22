
const streamImage = document.getElementById('cameraStream');
const toggleButton = document.getElementById('toggleButton');
const sensorStatus = document.getElementById('sensorStatus');
const time = document.getElementById('time');
const gasStatus = document.getElementById('gasStatus'); // Thêm các phần tử cần cập nhật
const flameStatus = document.getElementById('flameStatus');
const defaultImage = 'default_image.jpg';

let isStreaming = false;

// Xử lý khi click nút bật/tắt camera
toggleButton.addEventListener('click', () => {
    isStreaming = !isStreaming;
    toggleButton.textContent = isStreaming ? 'Tắt camera' : 'Bật camera';
    // Bật/tắt camera và Python process
    fetch(`/toggle-python?msg=${isStreaming ? 'true' : 'false'}`, {
        method: 'POST',
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Server error');
            }
            return response.json();
        })
        .then((data) => {
            console.log(data.message);
        })
        .catch((error) => {
            console.error(error);
        });

    // Khi tắt camera, trả về ảnh mặc định
    if (!isStreaming) {
        streamImage.src = defaultImage;
    }
});

setInterval(() => {
    if (isStreaming) {
        streamImage.src = `/uploads/processed.jpg?timestamp=${new Date().getTime()}`;
    }
}, 5); // Cập nhật ảnh mỗi 5ms 

// Cập nhật trạng thái cảm biến định kỳ
setInterval(() => {
    // Gửi yêu cầu GET đến server để lấy dữ liệu cảm biến
    fetch('/sensor-data', {
        method: 'GET',
    })

    .then((response) => response.json())
    .then((sensorData) => {
        if (sensorData.hasOwnProperty('gas') && sensorData.hasOwnProperty('flame')) {
            updateSensorStatus(sensorData); // Cập nhật giao diện dựa trên dữ liệu
        }
    })
    .catch((error) => {
        console.error('Error fetching sensor data:', error);
        sensorStatus.textContent = 'Không thể lấy dữ liệu cảm biến.';
        sensorStatus.style.color = 'red';
    });

    // Cập nhật ảnh động nếu camera đang bật
    
}, 500); // Cập nhật mỗi 0.5 giây

function updateSensorStatus(sensorData) {
    // Cập nhật trạng thái cảm biến gas và flame
    gasStatus.textContent = sensorData.gas ? 'Phát hiện khí ga' : 'Không phát hiện khí ga';
    flameStatus.textContent = sensorData.flame ? 'Phát hiện lửa' : 'Không phát hiện ngọn lửa';

    // Cập nhật màu sắc trạng thái
    gasStatus.style.color = sensorData.gas ? 'orange' : 'green';
    flameStatus.style.color = sensorData.flame ? 'orange' : 'green';

    // Cập nhật thông báo trạng thái chung
    let statusMessage = 'Hệ thống an toàn';
    let statusColor = 'green';

    if (sensorData.gas && sensorData.flame) {
        statusMessage = 'Phát hiện có lửa, có khói!';
        statusColor = 'red';
    } else if (sensorData.gas) {
        statusMessage = 'Phát hiện có khói!';
        statusColor = 'orange';
    } else if (sensorData.flame) {
        statusMessage = 'Phát hiện có lửa!';
        statusColor = 'orange';
    }

    // Cập nhật trạng thái vào giao diện
    sensorStatus.textContent = `Trạng thái: ${statusMessage}`;
    sensorStatus.style.color = statusColor;

    // Cập nhật thời gian
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    time.textContent = ' Thời gian: ' + timeString;
}
