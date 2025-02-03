// Arduino Code
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <Base64.h>

const char* ssid = "Squad 06";
const char* password = "yarasfm@2026";
const char* apiURL = "https://new-erp-cyan.vercel.app/api/fingerprint";

HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

void setup() {
  Serial.begin(115200);
  mySerial.begin(57600, SERIAL_8N1, 16, 17);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");

  finger.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("Fingerprint sensor initialized successfully!");
  } else {
    Serial.println("Failed to initialize fingerprint sensor.");
    while (1);
  }
}

void loop() {
  Serial.println("Press 'e' to enroll:");
  if (Serial.available() && Serial.read() == 'e') {
    enrollFingerprint();
  }
  delay(2000);
}

void enrollFingerprint() {
  int id;
  Serial.println("Enter ID (1-127):");
  while (!Serial.available());
  id = Serial.parseInt();

  Serial.println("Place your finger...");
  while (finger.getImage() != FINGERPRINT_OK);
  finger.image2Tz(1);

  Serial.println("Remove finger...");
  delay(2000);

  Serial.println("Place the same finger again...");
  while (finger.getImage() != FINGERPRINT_OK);
  finger.image2Tz(2);

  if (finger.createModel() == FINGERPRINT_OK && finger.storeModel(id) == FINGERPRINT_OK) {
    Serial.println("Fingerprint enrolled successfully!");

    if (finger.loadModel(id) == FINGERPRINT_OK && finger.getModel() == FINGERPRINT_OK) {
      uint8_t templateBuffer[512];
      memset(templateBuffer, 0, sizeof(templateBuffer));

      int bytesRead = 0;
      unsigned long startTime = millis();

      while (bytesRead < 512 && (millis() - startTime) < 3000) {
        if (mySerial.available()) {
          templateBuffer[bytesRead++] = mySerial.read();
        } else {
          delay(5);
        }
      }

      Serial.print("Raw Template Data (First 20 bytes): ");
      for (int i = 0; i < 20; i++) {
        Serial.print(templateBuffer[i], HEX);
        Serial.print(" ");
      }
      Serial.println();

      if (bytesRead == 512) {
        Serial.println("Template downloaded successfully!");
        String encodedTemplate = base64::encode(templateBuffer, bytesRead);
        Serial.println("Encoded Template:");
        Serial.println(encodedTemplate);
        sendFingerprintData(id, encodedTemplate);
      } else {
        Serial.print("Incomplete template data received. Bytes read: ");
        Serial.println(bytesRead);
      }
    } else {
      Serial.println("Failed to load fingerprint model.");
    }
  } else {
    Serial.println("Enrollment failed.");
  }
}

void sendFingerprintData(int id, String encodedTemplate) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(apiURL);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<512> doc;
    doc["fingerprint_id"] = id;
    doc["template"] = encodedTemplate;

    String payload;
    serializeJson(doc, payload);

    int httpResponseCode = http.POST(payload);
    Serial.print("Server Response: ");
    Serial.println(http.getString());

    http.end();
  } else {
    Serial.println("WiFi not connected.");
  }
}
