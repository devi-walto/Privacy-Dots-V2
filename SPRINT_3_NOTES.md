# Sprint 3 Notes

## Node Management

- A node is uniquely identified by `node_id`.
- Supported node states are `pending`, `active`, `disabled`, and `removed`.
- Manually added nodes start as `pending`.
- Nodes become `active` when Django receives a heartbeat, register, or motion MQTT message.
- Removing a node marks it as `removed` instead of deleting event history.
- Disabling a node marks it as `disabled` and keeps it visible in the dashboard.

## Node Health

The dashboard shows:

- online/offline status
- current node state
- last seen time
- signal strength
- firmware version
- location

A node is treated as online when it is `active` and has checked in within the last 120 seconds.

## Notifications

- Browser notifications can be enabled from the dashboard.
- New motion events include the sensor name, location, and timestamp in the notification.
- Duplicate notifications are prevented by tracking each event ID already shown in the dashboard.
- If browser notifications are unsupported, blocked, or not enabled, the dashboard shows an in-page alert instead.

## Testing Checklist

- Start the stack with `docker compose up --build`.
- Confirm `GET /api/devices/` lists registered nodes.
- Confirm `GET /api/events/` lists motion events.
- Add a node from the dashboard and confirm it appears as `pending`.
- Power on the ESP32 and confirm the node changes to `active`.
- Trigger motion and confirm a new event appears in the feed.
- Enable browser notifications and confirm a motion alert appears.
- Disable and remove a node from the dashboard and confirm its state changes.
