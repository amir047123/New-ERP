// Arduino Code
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <Base64.h>

// Function Prototypes
void enrollFingerprint();
void matchFingerprint();
void sendFingerprintData(int id, String encodedTemplate);
void sendMatchTemplate(String encodedTemplate);
int readTemplateData(uint8_t* buffer, int length);

// Wi-Fi Credentials
const char* ssid = "Squad 06";
const char* password = "yarasfm@2026";

// Backend API URLs
const char* apiURL = "https://new-erp-cyan.vercel.app/api/fingerprint";
const char* matchURL = "https://new-erp-cyan.vercel.app/api/fingerprint/match";

// Fingerprint sensor setup (ESP32 UART2: GPIO16 -> RX, GPIO17 -> TX)
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
  Serial.println("Initializing fingerprint sensor...");

  if (finger.verifyPassword()) {
    Serial.println("Fingerprint sensor initialized successfully!");
  } else {
    Serial.println("Failed to initialize fingerprint sensor. Check wiring.");
    while (1);
  }
}

void loop() {
  Serial.println("Press 'e' to enroll or 'm' to match:");

  if (Serial.available()) {
    char key = Serial.read();
    if (key == 'e') {
      enrollFingerprint();
    } else if (key == 'm') {
      matchFingerprint();
    }
  }
  delay(2000);
}

// Function to read data in chunks
int readTemplateData(uint8_t* buffer, int length) {
  int bytesRead = 0;
  unsigned long startTime = millis();

  while (bytesRead < length && (millis() - startTime) < 3000) { // 3-second timeout
    if (mySerial.available()) {
      buffer[bytesRead++] = mySerial.read();
    } else {
      delay(5); // Small delay to allow buffer refill
    }
  }
  return bytesRead;
}

// Enroll Fingerprint
void enrollFingerprint() {
  int id;
  Serial.println("Enter an ID (1-127) to enroll:");
  while (!Serial.available());
  id = Serial.parseInt();

  Serial.println("Place your finger on the sensor...");
  while (finger.getImage() != FINGERPRINT_OK);
  Serial.println("Fingerprint image captured.");
  finger.image2Tz(1);
  Serial.println("Remove finger...");
  delay(2000);

  Serial.println("Place the same finger again...");
  while (finger.getImage() != FINGERPRINT_OK);
  Serial.println("Second fingerprint image captured.");
  finger.image2Tz(2);

  if (finger.createModel() == FINGERPRINT_OK) {
    Serial.println("Model created successfully.");
    if (finger.storeModel(id) == FINGERPRINT_OK) {
      Serial.println("Fingerprint enrolled successfully!");

      mySerial.flush();  // Clear buffer before reading
      delay(100);        // Give time to process

      if (finger.getModel() == FINGERPRINT_OK) {
        uint8_t templateBuffer[512];
        memset(templateBuffer, 0, sizeof(templateBuffer));  // Clear buffer

        int bytesRead = readTemplateData(templateBuffer, 512); // Read in chunks

        if (bytesRead == 512) {
          Serial.println("Template downloaded successfully!");

          // Base64 encode the fingerprint template
          String encodedTemplate = base64::encode(templateBuffer, sizeof(templateBuffer));
          Serial.println("Encoded Template:");
          Serial.println(encodedTemplate); // Debugging output
          sendFingerprintData(id, encodedTemplate);
        } else {
          Serial.print("Incomplete template data received. Bytes read: ");
          Serial.println(bytesRead);
        }
      } else {
        Serial.println("Failed to download fingerprint template.");
      }
    } else {
      Serial.println("Failed to store fingerprint model.");
    }
  } else {
    Serial.println("Fingerprint enrollment failed.");
  }
}

// Match Fingerprint
void matchFingerprint() {
  Serial.println("Place your finger to match...");

  mySerial.flush();  // Clear buffer before reading
  delay(100);        // Allow time for stabilization

  if (finger.getImage() != FINGERPRINT_OK) {
    Serial.println("No finger detected.");
    return;
  }

  if (finger.image2Tz() != FINGERPRINT_OK) {
    Serial.println("Failed to convert image to template.");
    return;
  }

  if (finger.getModel() == FINGERPRINT_OK) {
    uint8_t templateBuffer[512];
    memset(templateBuffer, 0, sizeof(templateBuffer));  // Clear buffer

    int bytesRead = readTemplateData(templateBuffer, 512); // Read in chunks

    if (bytesRead == 512) {
      Serial.println("Template downloaded successfully!");

      // Base64 encode the fingerprint template
      String encodedTemplate = base64::encode(templateBuffer, sizeof(templateBuffer));
      Serial.println("Encoded Template:");
      Serial.println(encodedTemplate); // Debugging output
      sendMatchTemplate(encodedTemplate);
    } else {
      Serial.print("Incomplete template data received. Bytes read: ");
      Serial.println(bytesRead);
    }
  } else {
    Serial.println("Failed to download fingerprint template.");
  }
}

// Send Match Template to Server
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
    Serial.print("HTTP Response Code: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
      Serial.print("Match Response: ");
      Serial.println(http.getString());
    } else {
      Serial.print("Match failed, error: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  } else {
    Serial.println("WiFi not connected.");
  }
}

// Send Fingerprint Data to Server
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
    Serial.print("HTTP Response Code: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
      Serial.print("Server Response: ");
      Serial.println(http.getString());
    } else {
      Serial.print("HTTP POST failed, error: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  } else {
    Serial.println("WiFi not connected.");
  }
}
