#include <WiFi.h>
#include <PubSubClient.h>

// ===== Wi-Fi settings =====
const char* ssid = "MyPiAP";
const char* password = "ChangeMe123!";
const char* hostname = "dot-01";

// ===== MQTT settings =====
const char* mqtt_server = "192.168.4.1";
const int mqtt_port = 1883;

const char* register_topic = "privacydots/nodes/register";
const char* heartbeat_topic = "privacydots/nodes/heartbeat";
const char* motion_topic = "privacydots/events/motion";

// ===== Motion sensor settings =====
const int MOTION_PIN = D2;

// Send heartbeat every 10 seconds
const unsigned long heartbeatInterval = 10000;

// Do not send more than one motion event every 5 seconds
const unsigned long motionCooldown = 5000;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastHeartbeat = 0;oi
unsigned long lastMotionPublish = 0;

int lastMotionState = LOW;

void connectToWiFi() {
  Serial.println();
  Serial.println("Starting Wi-Fi...");

  WiFi.mode(WIFI_STA);
  WiFi.setHostname(hostname);
  WiFi.begin(ssid, password);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;

    if (attempts >= 40) {
      Serial.println();
      Serial.println("Wi-Fi connection timeout. Retrying...");
      WiFi.disconnect(true, true);
      delay(1000);
      WiFi.begin(ssid, password);
      attempts = 0;
    }
  }

  Serial.println();
  Serial.println("Wi-Fi connected");
  Serial.print("Hostname: ");
  Serial.println(hostname);
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.print("Gateway: ");
  Serial.println(WiFi.gatewayIP());
  Serial.print("RSSI: ");
  Serial.println(WiFi.RSSI());
}

void connectToMQTT() {
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setSocketTimeout(10);

  // Important: default PubSubClient buffer is small.
  // The motion JSON is larger than the heartbeat JSON, so increase it.
  mqttClient.setBufferSize(1024);

  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT at ");
    Serial.print(mqtt_server);
    Serial.print(":");
    Serial.print(mqtt_port);
    Serial.print(" ... ");

    if (mqttClient.connect(hostname)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 2 seconds");
      delay(2000);
    }
  }
}

String buildBasicPayload(const char* statusMessage) {
  String payload = "{";

  payload += "\"device_id\":\"";
  payload += hostname;
  payload += "\",";

  payload += "\"node_id\":\"";
  payload += hostname;
  payload += "\",";

  payload += "\"mac_address\":\"";
  payload += WiFi.macAddress();
  payload += "\",";

  payload += "\"firmware_version\":\"v0.1.0\",";
  payload += "\"node_type\":\"motion_sensor\",";

  payload += "\"status\":\"";
  payload += statusMessage;
  payload += "\",";

  payload += "\"ip_address\":\"";
  payload += WiFi.localIP().toString();
  payload += "\",";

  payload += "\"rssi\":";
  payload += String(WiFi.RSSI());
  payload += ",";

  payload += "\"uptime_ms\":";
  payload += String(millis());

  payload += "}";

  return payload;
}

void publishRegistration() {
  String payload = buildBasicPayload("online");

  Serial.println();
  Serial.println("Publishing registration message:");
  Serial.println(payload);

  bool success = mqttClient.publish(register_topic, payload.c_str());

  if (success) {
    Serial.println("Registration publish success");
  } else {
    Serial.println("Registration publish failed");
    Serial.print("Payload length: ");
    Serial.println(payload.length());
    Serial.print("MQTT connected: ");
    Serial.println(mqttClient.connected() ? "yes" : "no");
  }
}

void publishHeartbeat() {
  String payload = buildBasicPayload("heartbeat");

  Serial.println();
  Serial.println("Publishing heartbeat message:");
  Serial.println(payload);

  bool success = mqttClient.publish(heartbeat_topic, payload.c_str());

  if (success) {
    Serial.println("Heartbeat publish success");
  } else {
    Serial.println("Heartbeat publish failed");
    Serial.print("Payload length: ");
    Serial.println(payload.length());
    Serial.print("MQTT connected: ");
    Serial.println(mqttClient.connected() ? "yes" : "no");
  }
}

void publishMotionEvent() {
  String uptime = String(millis());

  String payload = "{";

  payload += "\"event_id\":\"";
  payload += hostname;
  payload += "-";
  payload += uptime;
  payload += "\",";

  payload += "\"node_id\":\"";
  payload += hostname;
  payload += "\",";

  payload += "\"device_name\":\"";
  payload += hostname;
  payload += "\",";

  payload += "\"location\":\"unassigned\",";

  payload += "\"event_type\":\"motion\",";
  payload += "\"motion\":true,";

  payload += "\"timestamp\":\"";
  payload += uptime;
  payload += "\",";

  payload += "\"timezone\":\"uptime_ms\",";

  payload += "\"connection\":{";
  payload += "\"interrupted\":false,";
  payload += "\"signal_strength\":";
  payload += String(WiFi.RSSI());
  payload += "},";

  payload += "\"device_status\":{";
  payload += "\"battery\":-1,";
  payload += "\"firmware_version\":\"v0.1.0\"";
  payload += "}";

  payload += "}";

  Serial.println();
  Serial.println("Publishing MOTION event:");
  Serial.println(payload);

  bool success = mqttClient.publish(motion_topic, payload.c_str());

  if (success) {
    Serial.println("Motion publish success");
  } else {
    Serial.println("Motion publish failed");
    Serial.print("Payload length: ");
    Serial.println(payload.length());
    Serial.print("MQTT connected: ");
    Serial.println(mqttClient.connected() ? "yes" : "no");
  }
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  pinMode(MOTION_PIN, INPUT);

  Serial.println("Booting Privacy Dot motion node...");

  connectToWiFi();
  delay(2000);
  connectToMQTT();

  publishRegistration();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi lost. Reconnecting...");
    connectToWiFi();
  }

  if (!mqttClient.connected()) {
    Serial.println("MQTT disconnected. Reconnecting...");
    connectToMQTT();
  }

  mqttClient.loop();

  unsigned long now = millis();

  if (now - lastHeartbeat >= heartbeatInterval) {
    lastHeartbeat = now;
    publishHeartbeat();
  }

  int motionState = digitalRead(MOTION_PIN);

  if (motionState == HIGH && lastMotionState == LOW) {
    Serial.println("Motion detected on sensor pin.");

    if (now - lastMotionPublish >= motionCooldown) {
      lastMotionPublish = now;
      publishMotionEvent();
    } else {
      Serial.println("Motion ignored because cooldown is active.");
    }
  }

  lastMotionState = motionState;

  delay(100);
}
