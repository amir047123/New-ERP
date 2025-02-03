#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <Base64.h>

const char* ssid2 = "Squad 06";
const char* password2 = "yarasfm@2026";
const char* matchURL = "https://new-erp-cyan.vercel.app/api/fingerprint/match";

HardwareSerial mySerial2(2);
Adafruit_Fingerprint finger2 = Adafruit_Fingerprint(&mySerial2);

void setup() {
  Serial.begin(115200);
  mySerial2.begin(57600, SERIAL_8N1, 16, 17);

  WiFi.begin(ssid2, password2);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");

  finger2.begin(57600);
  if (finger2.verifyPassword()) {
    Serial.println("Fingerprint sensor initialized successfully!");
  } else {
    Serial.println("Failed to initialize fingerprint sensor.");
    while (1);
  }
}

void loop() {
  Serial.println("Press 'm' to match:");
  if (Serial.available() && Serial.read() == 'm') {
    matchFingerprint();
  }
  delay(2000);
}

void matchFingerprint() {
  Serial.println("Place your finger to match...");

  if (finger2.getImage() == FINGERPRINT_OK && finger2.image2Tz() == FINGERPRINT_OK) {
    uint8_t templateBuffer[512];
    memset(templateBuffer, 0, sizeof(templateBuffer));

    if (finger2.getModel() == FINGERPRINT_OK) {
      for (int i = 0; i < 512; i++) {
        templateBuffer[i] = mySerial2.read();
      }

      String encodedTemplate = base64::encode(templateBuffer, sizeof(templateBuffer));
      sendMatchTemplate(encodedTemplate);
    } else {
      Serial.println("Failed to download fingerprint template.");
    }
  } else {
    Serial.println("Failed to capture fingerprint.");
  }
}

void sendMatchTemplate(String encodedTemplate) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(matchURL);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<512> doc;
    doc["template"] = encodedTemplate;

    String payload;
    serializeJson(doc, payload);

    int httpResponseCode = http.POST(payload);
    Serial.print("Match Response: ");
    Serial.println(http.getString());

    http.end();
  }
}
