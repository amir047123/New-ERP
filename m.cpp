#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <Base64.h>
#include <U8g2lib.h>

// OLED Display Initialization
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

// Function Prototype
void displayMessage(const String& message, bool center = false);

// WiFi Credentials & API URL
const char* ssid = "Squad 06";
const char* password = "yarasfm@2026";
const char* apiURL = "https://new-erp-cyan.vercel.app/api/fingerprint/attendance"; // API for attendance

// Fingerprint Sensor Initialization
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

void setup() {
  Serial.begin(115200);
  mySerial.begin(57600, SERIAL_8N1, 16, 17);

  // OLED Setup
  u8g2.begin();
  displayMessage("Welcome!", true);
  delay(2000);

  displayMessage("Connecting...", true);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }

  displayMessage("WiFi Connected!", true);
  Serial.println("WiFi Connected!");
  delay(2000);

  finger.begin(57600);
  if (finger.verifyPassword()) {
    displayMessage("Sensor Ready", true);
    Serial.println("Fingerprint sensor ready!");
  } else {
    displayMessage("Sensor Error!", true);
    Serial.println("Fingerprint sensor error!");
    while (1);
  }
}

void loop() {
  displayMessage("Place Finger", true);

  if (finger.getImage() == FINGERPRINT_OK) {
    registerFingerprint();
    delay(3000);
  }
}

// Display Message on OLED
void displayMessage(const String& message, bool center) {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  if (center) {
    int16_t x = (128 - u8g2.getStrWidth(message.c_str())) / 2;
    u8g2.drawStr(x, 32, message.c_str());
  } else {
    u8g2.drawStr(0, 20, message.c_str());
  }
  u8g2.sendBuffer();
}

// Fingerprint Registration
void registerFingerprint() {
  displayMessage("Capturing...", true);

  for (int attempt = 1; attempt <= 2; attempt++) {
    displayMessage("Scan #" + String(attempt), true);

    mySerial.flush();
    delay(500);

    int retries = 0;
    while (finger.getImage() != FINGERPRINT_OK && retries < 3) {
      retries++;
      delay(1000);
    }

    if (retries == 3) {
      displayMessage("Scan Failed!", true);
      return;
    }

    if (finger.image2Tz(attempt) != FINGERPRINT_OK) {
      displayMessage("Conversion Error", true);
      return;
    }
    delay(2000);
  }

  if (finger.createModel() != FINGERPRINT_OK) {
    displayMessage("Model Error!", true);
    return;
  }

  if (finger.getModel() == FINGERPRINT_OK) {
    uint8_t templateBuffer[512] = {0};
    mySerial.flush();
    delay(100);

    int bytesRead = 0;
    unsigned long startTime = millis();
    const int TIMEOUT = 5000;

    while (bytesRead < 512 && (millis() - startTime) < TIMEOUT) {
      if (mySerial.available()) {
        templateBuffer[bytesRead++] = mySerial.read();
      } else {
        delay(5);
      }
    }

    if (bytesRead == 512) {
      displayMessage("Template Ready!", true);

      String encodedTemplate = base64::encode(templateBuffer, bytesRead);
      sendFingerprintToServer(encodedTemplate);
    } else {
      displayMessage("Download Error!", true);
    }
  } else {
    displayMessage("Template Error!", true);
  }
}

// Send Fingerprint Template to Server
void sendFingerprintToServer(const String& encodedTemplate) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(apiURL);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<512> doc;
    doc["template"] = encodedTemplate;

    String payload;
    serializeJson(doc, payload);

    int httpResponseCode = http.POST(payload);
    Serial.print("HTTP Response Code: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Server Response: ");
      Serial.println(response);

      if (httpResponseCode == 200) {
        displayMessage("Attendance Marked!", true);
      } else {
        displayMessage("Invalid Fingerprint!", true);
      }
    } else {
      displayMessage("Attendance Failed!", true);
      Serial.println("Attendance failed, check connection or server.");
    }

    http.end();
    mySerial.flush();
    while (mySerial.available()) mySerial.read();
  } else {
    displayMessage("WiFi Error!", true);
    Serial.println("WiFi not connected!");
  }
}