# Pi Runbook

Run these commands from the project folder on the Raspberry Pi.

## 1. Make Sure `.env` Exists

If you do not already have one:

```bash
cp .env.example .env
nano .env
```

Make sure it has values like:

```env
SECRET_KEY=dev-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.4.1

POSTGRES_DB=privacydots
POSTGRES_USER=privacydots
POSTGRES_PASSWORD=privacydots

MQTT_HOST=mosquitto
MQTT_PORT=1883
```

## 2. Rebuild And Start The Stack

```bash
docker compose up --build -d
```

This should rebuild Django and React, run migrations, start Mosquitto, start Django, and start the `mqtt-listener` service.

## 3. Check That Everything Is Running

```bash
docker compose ps
```

You should see services like:

```text
privacydots-postgres
privacydots-mosquitto
privacydots-django
privacydots-mqtt-listener
privacydots-react
privacydots-nginx
```

## 4. Watch MQTT Listener Logs

```bash
docker logs -f privacydots-mqtt-listener
```

You want to see it connect and subscribe to:

```text
privacydots/events/motion
privacydots/nodes/heartbeat
privacydots/nodes/register
```

When the ESP32 sends messages, logs should show incoming MQTT messages.

## 5. Open The Dashboard

From the Pi or another device connected to `MyPiAP`, open:

```text
http://192.168.4.1
```

Or on the Pi itself:

```text
http://localhost
```

## 6. Test The API Quickly

```bash
curl http://localhost/api/devices/
curl http://localhost/api/events/
```

## 7. Physical ESP32 Test

Make sure the ESP32 publishes to:

```text
Broker: 192.168.4.1
Port: 1883
Motion topic: privacydots/events/motion
Heartbeat topic: privacydots/nodes/heartbeat
Register topic: privacydots/nodes/register
```

Then trigger motion. You should see:

- MQTT listener log receives the message
- `/api/events/` shows the event
- dashboard event feed updates within about 5 seconds
- node status changes to active/online
- browser notification works after pressing the notification button in the dashboard

## Clean Restart

If Docker gets weird, use:

```bash
docker compose down
docker compose up --build -d
```
