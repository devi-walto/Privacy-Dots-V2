#include <WiFi.h>
#include <PubSubClient.h>

// ---------- Wi-Fi ----------
const char* WIFI_SSID = "MyPiAP";
const char* WIFI_PASSWORD = "ChangeMe123!";

// ---------- MQTT ----------
const char* MQTT_HOST = "192.168.4.1";
const int MQTT_PORT = 1883;

const char* MOTION_TOPIC = "privacydots/events/motion";
const char* HEARTBEAT_TOPIC = "privacydots/nodes/heartbeat";
const char* REGISTER_TOPIC = "privacydots/nodes/register";

// ---------- Node Info ----------
const char* NODE_ID = "dot-01";
const char* DEVICE_NAME = "dot-01";
const char* LOCATION = "unassigned";
const char* FIRMWARE_VERSION = "v0.1.0";

// ---------- Motion Sensor ----------
const int MOTION_PIN = 4;

// Prevent motion spam
const unsigned long MOTION_COOLDOWN_MS = 5000;
unsigned long lastMotionPublish = 0;

// Heartbeat timing
const unsigned long HEARTBEAT_INTERVAL_MS = 30000;
unsigned long lastHeartbeat = 0;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

void connectToWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi connected");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Signal strength: ");
  Serial.println(WiFi.RSSI());
}

void connectToMQTT() {
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);

  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT at ");
    Serial.print(MQTT_HOST);
    Serial.print(":");
    Serial.println(MQTT_PORT);

    String clientId = String(NODE_ID) + "-" + String(random(10000, 99999));

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("MQTT connected");
      publishRegister();
    } else {
      Serial.print("MQTT failed, rc=");
      Serial.println(mqttClient.state());
      delay(2000);
    }
  }
}

String buildPayload(const char* eventType, bool motionValue) {
  unsigned long nowMs = millis();

  String payload = "{";
  payload += "\"event_id\":\"";
  payload += NODE_ID;
  payload += "-";
  payload += String(nowMs);
  payload += "\",";

  payload += "\"node_id\":\"";
  payload += NODE_ID;
  payload += "\",";

  payload += "\"device_name\":\"";
  payload += DEVICE_NAME;
  payload += "\",";

  payload += "\"location\":\"";
  payload += LOCATION;
  payload += "\",";

  payload += "\"event_type\":\"";
  payload += eventType;
  payload += "\",";

  payload += "\"motion\":";
  payload += motionValue ? "true" : "false";
  payload += ",";

  payload += "\"timestamp\":\"";
  payload += String(nowMs);
  payload += "\",";

  payload += "\"timezone\":\"uptime_ms\",";

  payload += "\"connection\":{";
  payload += "\"interrupted\":false,";
  payload += "\"signal_strength\":";
  payload += String(WiFi.RSSI());
  payload += "},";

  payload += "\"device_status\":{";
  payload += "\"battery\":-1,";
  payload += "\"firmware_version\":\"";
  payload += FIRMWARE_VERSION;
  payload += "\"}";

  payload += "}";

  return payload;
}

void publishRegister() {
  String payload = buildPayload("register", false);

  Serial.println("Publishing register:");
  Serial.println(payload);

  mqttClient.publish(REGISTER_TOPIC, payload.c_str());
}

void publishHeartbeat() {
  String payload = buildPayload("heartbeat", false);

  Serial.println("Publishing heartbeat:");
  Serial.println(payload);

  mqttClient.publish(HEARTBEAT_TOPIC, payload.c_str());
}

void publishMotion() {
  String payload = buildPayload("motion", true);

  Serial.println("Publishing motion:");
  Serial.println(payload);

  mqttClient.publish(MOTION_TOPIC, payload.c_str());
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(MOTION_PIN, INPUT);

  randomSeed(esp_random());

  connectToWiFi();
  connectToMQTT();

  publishHeartbeat();
  lastHeartbeat = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  if (!mqttClient.connected()) {
    connectToMQTT();
  }

  mqttClient.loop();

  unsigned long now = millis();

  int motionDetected = digitalRead(MOTION_PIN);

  if (motionDetected == HIGH && now - lastMotionPublish > MOTION_COOLDOWN_MS) {
    publishMotion();
    lastMotionPublish = now;
  }

  if (now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
    publishHeartbeat();
    lastHeartbeat = now;
  }
}
