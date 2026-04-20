// ================================================================
// Privacy Dots V2 — Sprint 1
// Node firmware
//
// Tasks covered:
// [x] Auto-reconnect to Pi AP with graceful retry before reboot
// [x] Pending motion flag — events survive connection outages
// [x] Timestamped payload with node ID and location for logging
// [ ] Log persistence across reboots — Carl's responsibility via
//     Docker Volumes. Confirm his MotionEvent table matches the
//     payload format in sendMotionNotification() below.
// ================================================================

#include <WiFi.h>                 //Wifi library
#include <HTTPClient.h>

// ================================================================
// NETWORK CONFIG
// Get SSID and password from Lane / Braydon once their Pi AP is
// running and drop them in here.
// V2 change: switched from WPA2 Enterprise (Eduroam/PEAP) to
// standard WPA2 Personal — no EAP identity or cert files needed.
// ================================================================
const char* ssid = "PI_AP_SSID";      // TODO: get from Lane/Braydon
const char* password = "PI_AP_PASSWORD";  // TODO: get from Lane/Braydon

// ================================================================
// NODE CONFIG
// Change these per physical node at flash time.
// Each physical Dot gets its own name_id and location flashed in.
// ================================================================
const char* nodeId = "PDN#000001";
const char* nodeLocation = "Office";

// ================================================================
// SERVER CONFIG
// ================================================================
const char* piServerUrl = "http://192.168.4.1:5000/motion";  // Raspberry Pi URL — confirm gateway IP with Lane/Braydon

// ================================================================
// HARDWARE
// ================================================================
const int motionSensorPin = D1;  // Pin connected to the motion sensor (PIR)

// ================================================================
// TIMING / RECONNECT
// ================================================================
unsigned long debounceDelay = 5000;  // 5 seconds debounce time — prevents event spam
const int reconnectRetries = 10;   // graceful attempts before hard restart (was immediate ESP.restart() in V1)
const int reconnectWaitMs = 1000; // ms between each retry

// ================================================================
// RUNTIME STATE
// ================================================================
unsigned long lastMotionDetectedTime = 0; // Store the last motion detection time
bool motionPending = false; // set true when motion fires during an outage; cleared on successful POST
int  counter = 0;


// ================================================================
// WiFi helpers
// ================================================================

// Attempt a single WiFi connection with a retry limit.
// Returns true if connected, false if all retries exhausted (30 second timeout).
bool connectWiFi() { // - connectes to the pi ap at boot and returns true or false depending on whether it succeeded.
  Serial.print("Connecting to network: ");
  Serial.println(ssid);

  WiFi.disconnect(true); //disconnect from wifi to set new wifi connection
  WiFi.mode(WIFI_STA); //init wifi mode
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    counter++;
    if (counter >= 60) { //after 30 seconds timeout - reset board
      return false;
    }
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address set: ");
  Serial.println(WiFi.localIP());  //print LAN IP
  return true;
}

// Try to reconnect reconnectRetries times before restarting the board.
// V1 went straight to ESP.restart() after 30s — this tries gracefully first
// to avoid unnecessary reboots on brief signal drops.
void reconnectWiFi() { // - tries to reconnect up to 10 times gracefully before rebooting the board.
  Serial.println("WiFi lost — attempting graceful reconnect...");  //if we lost connection, retry

  for (int i = 1; i <= reconnectRetries; i++) {
    Serial.printf("  Reconnect attempt %d / %d\n", i, reconnectRetries);
    WiFi.begin(ssid, password);
    delay(reconnectWaitMs);

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Wifi is still connected with IP: ");
      Serial.println(WiFi.localIP());  //inform user about his IP address
      return;  // success — caller will handle pending events
    }
  }

  // All graceful attempts failed — last resort
  Serial.println("All reconnect attempts failed. Restarting board...");  //30 seconds timeout - reset board
  ESP.restart();
}


// ================================================================
// Motion event sender
// ================================================================

void sendMotionNotification() { // - tries to reconnect up to 10 times gracefully before rebooting the board. 
  if (WiFi.status() != WL_CONNECTED) {
    // Can't send right now — flag it so we retry after reconnect
    motionPending = true;
    Serial.println("No connection — motion event queued (motionPending = true)");
    return;
  }

  // Build payload.
  // timestamp: millis() gives a relative uptime value — Django applies
  // the real wall-clock timestamp on receipt. Field is included so the
  // payload structure is consistent (aligns with Carl's DB tables).
  String jsonData = "{";
  jsonData += "\"timestamp\": "  + String(millis())  + ",";
  jsonData += "\"event\": \"Motion Detected\",";
  jsonData += "\"name_id\": \""  + String(nodeId) + "\",";
  jsonData += "\"location\": \"" + String(nodeLocation)  + "\"";
  jsonData += "}";

  HTTPClient http;
  http.begin(piServerUrl);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(jsonData);
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

void setup() { // - initializes the board, sets the PIR pin, and connects to WiFi on startup.
  Serial.begin(115200);
  delay(10);
  Serial.println();

  pinMode(motionSensorPin, INPUT);  // Set PIR sensor pin as input

  if (!connectWiFi()) {
    // If we can't connect at boot, restart and try again
    Serial.println("Boot-time connect failed. Restarting...");
    ESP.restart();
  }
}


// ================================================================
// Loop
// ================================================================

void loop() { // - continuously checks Wifi status and PIR sensor, reconnecting or sending motion events as needed. 
  unsigned long currentMillis = millis();

  // --- Check WiFi, reconnect gracefully if needed ---
  if (WiFi.status() != WL_CONNECTED) {  //if we lost connection, retry
    reconnectWiFi();

    // After a successful reconnect, flush any event that was
    // queued during the outage before going back to normal sensing.
    if (WiFi.status() == WL_CONNECTED && motionPending) {
      Serial.println("Reconnected — flushing pending motion event...");
      sendMotionNotification();
    }
  }

  // --- PIR sensing with debounce ---
  if (digitalRead(motionSensorPin) == HIGH) {  // Motion detected
    if (currentMillis - lastMotionDetectedTime > debounceDelay) {
      sendMotionNotification();
      lastMotionDetectedTime = currentMillis;  // Update the last motion detection time
      Serial.println("Motion detected and notification sent");
    }
  }
}
