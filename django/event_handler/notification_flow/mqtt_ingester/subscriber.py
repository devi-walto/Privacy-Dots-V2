import os
import paho.mqtt.client as mqtt

from event_handler.notification_flow.mqtt_ingester.parser import parse_motion_payload
from event_handler.notification_flow.event_processor.process_motion import process_motion_event

# CONSTANTS

# Use os.getenv to lookup env variables from built in env dictionary
MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")             # search for "MQTT_HOST". Use mosquitto as host by default
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))             # search for "MQTT_PORT". Use 1883 by default.
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "privacydots/motion")  # topic (channel) for motion data to move on
MQTT_QOS = int(os.getenv("MQTT_QOS", "1"))                  # QoS lvl 1; make sure data is validated


def on_connect(client: mqtt.Client, userdata: object, flags: dict, rc: int) -> None:
    """Handle broker connection; subscribes to topic on success. 
    @param client MQTT client instance @param userdata user context ;
    @param flags connection flags ; @param rc result code (0=success)"""
    if rc == 0:
        print(f"[MQTT] Connected to broker at {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC, qos=MQTT_QOS) #subscribe to topic with qos of 1
        print(f"[MQTT] Subscribed to topic: {MQTT_TOPIC}")

    else:
        print(f"[MQTT] Failed to connect. Return code: {rc}")

def on_message(client: mqtt.Client, userdata: object, msg: mqtt.MQTTMessage) -> None:
    """Handle incoming MQTT message; parses payload and forwards for processing.
    @param client MQTT client instance 
    @param userdata user context ; @param msg received MQTT message"""
    try:
        print(f"[MQTT] Message received on topic: {msg.topic}")

        payload = parse_motion_payload(msg.payload)
        process_motion_event(payload)

    except Exception as error:
        print(f"[MQTT] Failed to process message: {error}")


def start_mqtt_subscriber() -> None:
    """Initialize MQTT client, register callbacks, and start listening loop."""
    client = mqtt.Client()

    # mqtt library only needs finction name not params
    # on_connect and on_message are explicitly required names in docs
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"[MQTT] Connecting to {MQTT_HOST}:{MQTT_PORT}")

    # connect to client instance
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_forever()