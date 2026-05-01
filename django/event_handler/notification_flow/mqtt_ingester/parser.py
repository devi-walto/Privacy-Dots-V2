"""
parser.py — MQTT Payload Parser
--------------------------------
Parses and validates incoming MQTT motion payloads into a normalized format
used by the event processing layer.

Expected payload structure:
{
  "event_id": str,
  "node_id": str,
  "device_name": str,
  "location": str,
  "event_type": "motion",
  "motion": bool,
  "timestamp": str (ISO 8601),
  "timezone": str,
  "connection": {
    "interrupted": bool,
    "signal_strength": int
  },
  "device_status": {
    "battery": int,
    "firmware_version": str
  }
}
"""

import json
from typing import Any


def parse_motion_payload(raw_payload: bytes) -> dict[str, Any]:
    """Decode, validate, and normalize MQTT motion payload. @param raw_payload raw MQTT message bytes"""
    
    # Decode and parse JSON
    try:
        data = json.loads(raw_payload.decode("utf-8"))
    except Exception as error:
        raise ValueError(f"Invalid payload format: {error}")

    # Ensure payload is a JSON object
    if not isinstance(data, dict):
        raise ValueError("Payload must be a JSON object")

    # Validate required fields
    required_fields = ["node_id", "event_type", "timestamp"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")

    # Normalize core fields
    node_id = str(data["node_id"]).strip()
    event_type = str(data["event_type"]).strip()
    timestamp = str(data["timestamp"]).strip()

    # Optional fields
    location = data.get("location")
    if location is not None:
        location = str(location).strip()

    # Nested optional fields
    connection = data.get("connection", {})
    connection_interrupted = connection.get("interrupted", False)

    # Return normalized payload
    return {
        "node_id": node_id,
        "location": location,
        "event_type": event_type,
        "timestamp": timestamp,
        "connection_interrupted": connection_interrupted,
        "raw": data  # keep full payload for future use
    }
