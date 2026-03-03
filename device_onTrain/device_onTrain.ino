#include <WiFi.h>
#include <HTTPClient.h>

// ── CONFIGURE THIS FOR EACH TRAIN ──────────────────────────────
// Set TRAIN_ID to match this train's ID in the database.
// Flash each physical ESP32 with its own unique TRAIN_ID.
const int TRAIN_ID = 1;  // <-- Change this per device (1, 2, 3, ...)
// ───────────────────────────────────────────────────────────────

const char* ssid     = "Galaxy A05 AL";
const char* password = "whywifi1";

// API Gateway base IP (update if your server IP changes)
const char* API_BASE = "http://10.236.80.50:4000/data/esp32/command";

#define ALARM_RELAY_PIN 26
#define BRAKE_RELAY_PIN 27

// Full URL with train_id query param (built in setup)
String API_URL;

void setup() {
  Serial.begin(115200);

  pinMode(ALARM_RELAY_PIN, OUTPUT);
  pinMode(BRAKE_RELAY_PIN, OUTPUT);

  // Default relays OFF on boot
  digitalWrite(ALARM_RELAY_PIN, HIGH);
  digitalWrite(BRAKE_RELAY_PIN, HIGH);

  // Build the train-specific polling URL
  API_URL = String(API_BASE) + "?train_id=" + String(TRAIN_ID);

  WiFi.begin(ssid, password);
  Serial.print("[SEIDS] Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[SEIDS] WiFi Connected");
  Serial.print("[SEIDS] This device is Train ID: ");
  Serial.println(TRAIN_ID);
  Serial.print("[SEIDS] Polling: ");
  Serial.println(API_URL);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(API_URL);

    int httpCode = http.GET();

    if (httpCode == 200) {
      String payload = http.getString();
      Serial.println(payload);

      // ALARM CONTROL
      if (payload.indexOf("\"ALARM\":\"ON\"") >= 0) {
        digitalWrite(ALARM_RELAY_PIN, LOW);
        Serial.println("[SEIDS] ALARM ON");
      } else if (payload.indexOf("\"ALARM\":\"OFF\"") >= 0) {
        digitalWrite(ALARM_RELAY_PIN, HIGH);
        Serial.println("[SEIDS] ALARM OFF");
      }

      // BRAKE CONTROL
      if (payload.indexOf("\"BRAKE\":\"ON\"") >= 0) {
        digitalWrite(BRAKE_RELAY_PIN, LOW);
        Serial.println("[SEIDS] BRAKE ON");
      } else if (payload.indexOf("\"BRAKE\":\"OFF\"") >= 0) {
        digitalWrite(BRAKE_RELAY_PIN, HIGH);
        Serial.println("[SEIDS] BRAKE OFF");
      }
    } else {
      Serial.print("[SEIDS] HTTP Error: ");
      Serial.println(httpCode);
    }

    http.end();
  } else {
    Serial.println("[SEIDS] WiFi disconnected, reconnecting...");
    WiFi.reconnect();
  }

  delay(700); // poll every 700ms
}
