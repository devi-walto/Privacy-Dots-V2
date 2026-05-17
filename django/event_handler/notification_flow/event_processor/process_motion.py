from typing import Optional

from event_handler.models import Device, MotionEvent
from event_handler.notification_flow.notification_dispatcher.dispatcher import (
    dispatch_motion_notification,
)


def get_device_for_node(node_id: str) -> Optional[Device]:
    """Find registered device by node ID. @param node_id unique ID sent by the motion node"""
    return Device.objects.filter(node_id=node_id).first()


def process_motion_event(payload: dict) -> Optional[MotionEvent]:
    """Save parsed motion event and dispatch alert. ; @param payload normalized data from parser"""
    try:
        if payload["event_type"] != "motion":          # Ignore non-motion events
            print(f"[EVENT] Ignored non-motion event: {payload['event_type']}")
            return None

        node_id = payload["node_id"]                   # Required node identifier
        location = payload.get("location")             # Optional physical location
        device = get_device_for_node(node_id)          # Link to Device if registered

        motion_event = MotionEvent.objects.create(
            node_id=node_id,
            device=device,
            location=location,
        )

        print(f"[EVENT] Motion event saved: {motion_event}")

        dispatch_motion_notification(motion_event)     # Notify only after DB save succeeds

        return motion_event

    except Exception as error:
        print(f"[EVENT] Failed to process motion event: {error}")
        return None