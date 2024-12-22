#include <WiFi.h>
#include <esp_camera.h>
#include <HTTPClient.h>
#include <ArduinoWebsockets.h>

// WiFi credentials
const char* ssid = "gianghomang";
const char* password = "07040904";

#define LED_PIN 12
#define MQ2_PIN 13
#define FL_PIN 14
// Camera configuration pins
#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM  0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM    5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22


const char* serverUrl = "http://192.168.1.3:3000/upload";//luồng gửi hình ảnh tới server
const char *server_host = "192.168.1.3";
const uint16_t server_port = 8080;//cổng websocket chờ kết nối
using namespace websockets;
WebsocketsClient client;
bool isCameraEnabled = false;

void onMessageCallback(WebsocketsMessage message);

void init_camera(){
   
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed");
    return;
  }
}

void init_wifi(){
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void conect_websockets(){
  client.onMessage(onMessageCallback);
  bool connected = client.connect(server_host,server_port, "/");
  if (!connected)
  {
    Serial.println("WebSocket connection failed");
    //return ESP_FAIL;
  }
}
void onMessageCallback(WebsocketsMessage message)
{
  String msg = message.data();
  Serial.printf("Received message: %s\n", msg.c_str());
  if (msg.startsWith("\"") && msg.endsWith("\"")) {
    msg = msg.substring(1, msg.length() - 1); //bỏ dấu ngoặc kép

    if (msg == "camera_enable")
    {
      isCameraEnabled = true;
      Serial.println("Camera streaming enabled");
    }
    else if (msg == "camera_disable")
    {
      isCameraEnabled = false;
      Serial.println("Camera streaming disabled");
    }
  }
  else
  {
    Serial.println("Unknown command");
  }
}

void stream(){
  // Capture frame
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "multipart/form-data");

    String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    String body = "--" + boundary + "\r\n";
    body += "Content-Disposition: form-data; name=\"file\"; filename=\"frame.jpg\"\r\n";
    body += "Content-Type: image/jpeg\r\n\r\n";
    
    http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

    int httpResponseCode = http.POST(body + String((const char*)fb->buf, fb->len) + "\r\n--" + boundary + "--\r\n");

    if (httpResponseCode > 0) {
      Serial.printf("POST Success, Response: %d\n", httpResponseCode);
    } else {
      Serial.printf("POST Failed, Error: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }
  // Return frame buffer to queue
  esp_camera_fb_return(fb);
  delay(100);
}

void sendSensorData()
{
  bool gasDetected = digitalRead(MQ2_PIN) == LOW;
  bool flameDetected = digitalRead(FL_PIN) == LOW;

  // Update LED state based on sensor readings
  digitalWrite(LED_PIN, (gasDetected || flameDetected) ? HIGH : LOW);

  // Only send data if we have a valid connection
  if (client.available())
  {
    String data = "{\"gas\":" + String(gasDetected ? "true" : "false") +
                  ",\"flame\":" + String(flameDetected ? "true" : "false") + "}";
    client.send(data);
    //Serial.println("Sent sensor data: " + data);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(MQ2_PIN, INPUT);
  pinMode(FL_PIN, INPUT);
  // Connect to WiFi
  init_wifi();
  init_camera();
  conect_websockets();
}

void loop() {
  
  client.poll();
  sendSensorData();
  if(isCameraEnabled){
    stream();
  }
}
