#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "Galaxy A05 AL";
const char* password = "whywifi1";

//  API GATEWAY IP 
const char* API_URL = "http://10.22.68.50:4000/data/esp32/command";


#define ALARM_RELAY_PIN 26
#define BRAKE_RELAY_PIN 27

void setup() {
  Serial.begin(115200);

  pinMode(ALARM_RELAY_PIN, OUTPUT);
  pinMode(BRAKE_RELAY_PIN, OUTPUT);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n WiFi Connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(API_URL);

    int httpCode = http.GET();

    if (httpCode == 200) {
      String payload = http.getString();
      Serial.println(payload);

      //  ALARM CONTROL
      if (payload.indexOf("\"ALARM\":\"ON\"") > 0) {
        digitalWrite(ALARM_RELAY_PIN, LOW);
        Serial.println(" ALARM ON");
      }
      if (payload.indexOf("\"ALARM\":\"OFF\"") > 0) {
        digitalWrite(ALARM_RELAY_PIN, HIGH);
        Serial.println(" ALARM OFF");
      }

      //  BRAKE CONTROL
      if (payload.indexOf("\"BRAKE\":\"ON\"") > 0) {
        digitalWrite(BRAKE_RELAY_PIN, LOW);
        Serial.println(" BRAKE ON");
      }
      if (payload.indexOf("\"BRAKE\":\"OFF\"") > 0) {
        digitalWrite(BRAKE_RELAY_PIN, HIGH);
        Serial.println(" BRAKE OFF");
      }
    }

    http.end();
  }

  delay(700); // poll every 700 mseconds
}
