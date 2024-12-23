
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
        sensorStatus.style.color = 'black';
    });

    // Cập nhật ảnh động nếu camera đang bật
    
}, 500); // Cập nhật mỗi 0.5 giây

function updateSensorStatus(sensorData) {
    // Cập nhật trạng thái cảm biến gas và flame
    gasStatus.textContent = sensorData.gas ? 'Phát hiện khí ga' : 'Không phát hiện khí ga';
    flameStatus.textContent = sensorData.flame ? 'Phát hiện lửa' : 'Không phát hiện ngọn lửa';

    // Cập nhật màu sắc trạng thái
    gasStatus.style.backgroundColor = sensorData.gas ? 'orange' : '';
    flameStatus.style.backgroundColor = sensorData.flame ? 'orange' : '';

    // Cập nhật thông báo trạng thái chung
    let statusMessage = 'Hệ thống an toàn';
    //let statusColor = 'green';
    let backgroundColor = '';

    if (sensorData.gas && sensorData.flame) {
        statusMessage = 'Phát hiện có lửa, có khói!';
        backgroundColor = 'red';
        
    } else if (sensorData.gas) {
        statusMessage = 'Phát hiện có khói!';
        backgroundColor = 'orange';
        
    } else if (sensorData.flame) {
        statusMessage = 'Phát hiện có lửa!';
        backgroundColor = 'orange';
        
    }

    // Cập nhật trạng thái vào giao diện
    sensorStatus.textContent = `Trạng thái: ${statusMessage}`;
    const sensorDiv = document.getElementById('time');
    if (sensorDiv) {
        sensorDiv.style.backgroundColor = backgroundColor;
    }
   

    // Cập nhật thời gian
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    time.textContent = ' Thời gian: ' + timeString;
}


// Khởi tạo biến chart để lưu trữ đối tượng đồ thị
let fireDetectionChart;

// Hàm khởi tạo đồ thị
function initChart() {
    const ctx = document.getElementById('fireDetectionChart').getContext('2d');
    fireDetectionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Số lần phát hiện',
                data: [],
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    position: 'right', // Hiển thị số giờ ở bên phải
                    title: {
                        display: false,
                        text: 'giờ trước'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Biểu đồ theo dõi số lần hệ thống phát hiện dấu hiệu cháy theo giờ',
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                }
            }
        }
    });
}

// Hàm cập nhật dữ liệu đồ thị
function updateChart() {
    fetch('/graph-data')
        .then(response => response.json())
        .then(response => {
            // Tạo mảng đầy đủ 25 giờ với giá trị mặc định là 0
            const fullData = Array(25).fill(0);
            
            // Cập nhật giá trị cho các giờ có dữ liệu
            response.data.forEach(item => {
                if (item._id >= 0 && item._id <= 24) {
                    fullData[item._id] = item.count;
                }
            });

            // Tạo labels từ 0 đến 24
            const labels = Array.from({length: 25}, (_, i) => `${i}`);

            // Cập nhật dữ liệu cho đồ thị
            fireDetectionChart.data.labels = labels;
            fireDetectionChart.data.datasets[0].data = fullData;
            
            // Cập nhật đồ thị
            fireDetectionChart.update();
        })
        .catch(error => {
            console.error('Error fetching graph data:', error);
        });
}

// Khởi tạo đồ thị khi trang web được tải
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    updateChart(); // Cập nhật dữ liệu lần đầu
    
    // Cập nhật đồ thị mỗi giờ
    setInterval(updateChart, 3600000); // 3600000 ms = 1 giờ
});