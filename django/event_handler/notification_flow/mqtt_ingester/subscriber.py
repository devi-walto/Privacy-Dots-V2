import os
import paho.mqtt.client as mqtt

# MOTION PAYLOADS
from event_handler.notification_flow.mqtt_ingester.parser import parse_motion_payload
from event_handler.notification_flow.event_processor.process_motion import process_motion_event

# PULSE PAYLOADS
from event_handler.notification_flow.mqtt_ingester.parser import parse_pulse_payload
# TODO: @Brayd-n implement process_pulse_event in event_handler/notification_flow/event_processor_process_pulse
from event_handler.notification_flow.event_processor.process_pulse import process_pulse_event

# CONSTANTS

# Use os.getenv to lookup env variables from built in env dictionary
MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")             # search for "MQTT_HOST". Use mosquitto as host by default
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))             # search for "MQTT_PORT". Use 1883 by default.
MQTT_MOTION_TOPIC = os.getenv("MQTT_MOTION_TOPIC", "privacydots/motion")
MQTT_PULSE_TOPIC = os.getenv("MQTT_PULSE_TOPIC", "privacydots/pulse")
MQTT_QOS = int(os.getenv("MQTT_QOS", "1"))                  # QoS lvl 1; make sure data is validated


def on_connect(client: mqtt.Client, userdata: object, flags: dict, rc: int) -> None:
    """Handle broker connection; subscribes to topic on success. 
    @param client MQTT client instance @param userdata user context ;
    @param flags connection flags ; @param rc result code (0=success)"""
    if rc == 0:
        print(f"[MQTT] Connected to broker at {MQTT_HOST}:{MQTT_PORT}")
         #subscribe to topics with qos of 1
        client.subscribe(MQTT_MOTION_TOPIC, qos=MQTT_QOS)
        client.subscribe(MQTT_PULSE_TOPIC, qos=MQTT_QOS)
        print(f"[MQTT] Subscribed to topics: {MQTT_MOTION_TOPIC} {MQTT_PULSE_TOPIC}")

    else:
        print(f"[MQTT] Failed to connect. Return code: {rc}")

def on_message(client: mqtt.Client, userdata: object, msg: mqtt.MQTTMessage) -> None:
    """Handle incoming MQTT message; parses payload and forwards for processing.
    @param client MQTT client instance 
    @param userdata user context ; @param msg received MQTT message"""
    try:
        print(f"[MQTT] Message received on topic: {msg.topic}")

        # MOTION EVENT
        if msg.topic == MQTT_MOTION_TOPIC:
            payload = parse_motion_payload(msg.payload)
            process_motion_event(payload)
        
        # HEALTH PULSE
        elif msg.topic == MQTT_PULSE_TOPIC:
            print("[MQTT] Pulse received")
            payload = parse_pulse_payload(msg.payload)
            process_pulse_event(payload)

        # OTHER FUTURE IMPLEMENTATIONS
        else:
            pass

    except Exception as error:
        print(f"[MQTT] Failed to process message: {error}")


def start_mqtt_subscriber() -> None:
    """Initialize MQTT client, register callbacks, and start listening loop."""
    client = mqtt.Client()

    # mqtt library only needs finction name not params
    # on_connect and on_message
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"[MQTT] Connecting to {MQTT_HOST}:{MQTT_PORT}")

    # connect to client instance
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()  # non-blocking