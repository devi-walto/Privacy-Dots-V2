
/*
first push: new file, arranged everything and added a lot of comments for understanding

*/


#include <WiFi.h>                 // WiFi library
#include <HTTPClient.h>

// ================================================================
// NETWORK CONFIG
// Get SSID and password from Lane / Braydon once their Pi AP is
// running and drop them in here.
// V2 change: switched from WPA2 Enterprise (Eduroam/PEAP) to
// standard WPA2 Personal no EAP identity or cert files needed.
// ================================================================
const char* WIFI_SSID     = "PI_AP_SSID";        // TODO: get from Lane/Braydon
const char* WIFI_PASSWORD = "PI_AP_PASSWORD";    // TODO: get from Lane/Braydon

// ================================================================
// NODE CONFIG
// Change these per physical node at flash time.
// Each physical Dot gets its own name_id and location flashed in.
// ================================================================
const char* NODE_ID       = "PDN#000001";
const char* NODE_LOCATION = "Office";

// ================================================================
// SERVER CONFIG
// ================================================================
const char* SERVER_URL = "http://192.168.4.1:5000/motion";  // Raspberry Pi URL confirm gateway IP with Lane/Braydon

// ================================================================
// HARDWARE
// ================================================================
const int PIR_PIN = D1;  // Pin connected to the motion sensor (PIR)

// ================================================================
// TIMING / RECONNECT
// ================================================================
const unsigned long DEBOUNCE_MS       = 5000;   // 5 seconds debounce time prevents event spam
const int           RECONNECT_RETRIES = 10;     // graceful attempts before hard restart (was immediate ESP.restart() in V1)
const unsigned long RECONNECT_WAIT_MS = 1000;   // ms between each retry

// ================================================================
// RUNTIME STATE
// ================================================================
unsigned long lastMotionTime = 0;  // Store the last motion detection time
bool          motionPending  = false;   // set true when motion fires during an outage; cleared on successful POST


// ================================================================
// WiFi helpers
// ================================================================

// Attempt a single WiFi connection with a retry limit.
// Returns true if connected, false if all retries exhausted (30 second timeout).
bool connectWiFi() {
  Serial.print("Connecting to network: ");
  Serial.println(WIFI_SSID);

  WiFi.disconnect(true);  // disconnect from wifi to set new wifi connection
  WiFi.mode(WIFI_STA);    // init wifi mode
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  for (int attempt = 0; attempt < 60; attempt++) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("");
      Serial.println("WiFi connected");
      Serial.println("IP address set: ");
      Serial.println(WiFi.localIP());  // print LAN IP
      return true;
    }
    delay(500);
    Serial.print(".");
  }

  // after 30 seconds timeout
  Serial.println("\nInitial connect timed out.");
  return false;
}

// Try to reconnect RECONNECT_RETRIES times before restarting the board.
// V1 went straight to ESP.restart() after 30s this tries gracefully first
// to avoid unnecessary reboots on brief signal drops.
void reconnectWiFi() {
  Serial.println("WiFi lost attempting graceful reconnect...");  // if we lost connection, retry

  for (int i = 1; i <= RECONNECT_RETRIES; i++) {
    Serial.printf("  Reconnect attempt %d / %d\n", i, RECONNECT_RETRIES);
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(RECONNECT_WAIT_MS);

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Wifi is still connected with IP: ");
      Serial.println(WiFi.localIP());  // inform user about their IP address
      return;  // success caller will handle pending events
    }
  }

  // All graceful attempts failed last resort
  Serial.println("All reconnect attempts failed. Restarting board...");  // 30 seconds timeout - reset board
  ESP.restart();
}


// ================================================================
// Motion event sender
// ================================================================

void sendMotionEvent() {
  if (WiFi.status() != WL_CONNECTED) {
    // Can't send right now — flag it so we retry after reconnect
    motionPending = true;
    Serial.println("No connection motion event queued (motionPending = true)");
    return;
  }

  // Build payload.
  // timestamp: millis() gives a relative uptime value Django applies
  // the real wall-clock timestamp on receipt. Field is included so the
  // payload structure is consistent (aligns with Carl's DB tables).
  String payload = "{";
  payload += "\"timestamp\": "   + String(millis())      + ",";
  payload += "\"event\": \"Motion Detected\","                  ;
  payload += "\"name_id\": \""   + String(NODE_ID)       + "\",";
  payload += "\"location\": \""  + String(NODE_LOCATION) + "\"";
  payload += "}";

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(payload);
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Response from server: " + response);
    motionPending = false;  // clear flag on successful send
  } else {
    Serial.println("Error on sending POST: " + String(httpResponseCode));
    motionPending = true;   // keep flag set so we retry after next reconnect
  }

  http.end();
}


// ================================================================
// Setup
// ================================================================

void setup() {
  Serial.begin(115200);
  delay(10);

  pinMode(PIR_PIN, INPUT);  // Set PIR sensor pin as input

  if (!connectWiFi()) {
    // If we can't connect at boot, restart and try again
    Serial.println("Boot-time connect failed. Restarting...");
    ESP.restart();
  }
}


// ================================================================
// Loop
// ================================================================

void loop() {
  unsigned long now = millis();

  // --- Check WiFi, reconnect gracefully if needed ---
  if (WiFi.status() != WL_CONNECTED) {  // if we lost connection, retry
    reconnectWiFi();

    // After a successful reconnect, flush any event that was
    // queued during the outage before going back to normal sensing.
    if (WiFi.status() == WL_CONNECTED && motionPending) {
      Serial.println("Reconnected flushing pending motion event...");
      sendMotionEvent();
    }
  }

  // --- PIR sensing with debounce ---
  if (digitalRead(PIR_PIN) == HIGH) {  // Motion detected
    if (now - lastMotionTime > DEBOUNCE_MS) {
      lastMotionTime = now;  // Update the last motion detection time
      Serial.println("Motion detected and notification sent");
      sendMotionEvent();  // sets motionPending = true if currently offline
    }
  }
}
