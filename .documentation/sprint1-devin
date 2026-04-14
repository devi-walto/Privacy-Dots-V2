# Sprint 1 — Devin Walton (AI GENERATED SUMMARY OF STREAM OF CONSCIOUSNESS)
## Story: System launches automatically with a single setup command

---

## Overview

This document covers everything completed in Sprint 1 for the infrastructure
owner role. The goal of this sprint was to build the foundation that every
other teammate's work runs on — a fully containerized Docker stack that starts
with a single command and recovers automatically from crashes.

V1 had no containerization. Django ran on a teammate's laptop, dependencies
were installed manually, and the system fell apart the moment it moved to a
different machine. V2 fixes all of this.

---

## What Was Built

### 1. Docker Compose Stack (`docker-compose.yml`)

Located at the repo root. Defines all six services and their relationships.

**Services:**
- `postgres` — PostgreSQL 15 database with healthcheck and named volume
- `mosquitto` — Eclipse Mosquitto MQTT broker on port 1883
- `ntfy` — Push notification service on port 8080
- `django` — Django backend built from `./django/Dockerfile`
- `react` — React frontend built from `./react/Dockerfile`
- `nginx` — Reverse proxy routing traffic on port 80

**Key decisions:**
- `restart: unless-stopped` on every service for automatic crash recovery
- `depends_on` with `condition: service_healthy` on postgres ensures Django
  waits for the database to actually accept connections before starting
- Only three ports exposed to the host: 80 (nginx), 1883 (mosquitto), 8080 (ntfy)
- PostgreSQL port 5432 intentionally not exposed — only reachable internally
- Named volumes for postgres and ntfy data persistence across restarts

**Boot order:**
postgres (healthy) → django → react → nginx
mosquitto (independent)
ntfy (independent)


---

### 2. Environment Variables (`.env` and `.env.example`)

Located at the repo root.

`.env` contains all sensitive configuration and is never committed to the repo.
`.env.example` contains the same keys with empty values and is committed so
teammates know what variables are needed.

**Variables defined:**

SECRET_KEY          — Django cryptographic key
DEBUG               — Development vs production mode
ALLOWED_HOSTS       — Hosts Django responds to
POSTGRES_DB         — Database name
POSTGRES_USER       — Database username
POSTGRES_PASSWORD   — Database password
DATABASE_URL        — Full PostgreSQL connection string
MQTT_HOST           — Mosquitto service hostname
MQTT_PORT           — Mosquitto port
NTFY_URL            — Ntfy service URL
NTFY_TOPIC          — Ntfy notification topic
REACT_APP_API_URL   — API base URL for React
No hardcoded values exist anywhere in any committed file.

---

### 3. Service Configuration Files

**`mosquitto/mosquitto.conf`**
Minimal MQTT broker configuration:
- Listens on port 1883
- Anonymous connections allowed for Sprint 1 (authentication added later)

**`nginx/nginx.conf`**
Reverse proxy configuration:
- Routes `/api/` requests to Django on port 8000
- Routes everything else to React on port 3000
- Passes original hostname and client IP to downstream services

---

### 4. Django Backend (`django/`)

Fresh Django project built from scratch. Structure:
django/
├── Dockerfile
├── requirements.txt
├── manage.py
├── basestation_config/       — Project config (settings, urls, wsgi, asgi)
│   ├── settings.py           — All config read from .env, PostgreSQL configured
│   ├── urls.py               — Routes /api/ to event_handler, /admin/ to admin panel
│   ├── wsgi.py
│   └── asgi.py
└── event_handler/            — Main application app
├── models.py             — MotionEvent model (node_id, location, detected_at)
├── views.py              — motion_detected() POST, get_events() GET
├── urls.py               — /api/motion/ and /api/events/ endpoints
├── admin.py              — MotionEvent registered in admin panel
└── migrations/

**Key decisions:**
- SQLite replaced with PostgreSQL — reads credentials from .env
- All settings read from environment variables via `os.environ.get()`
- `rest_framework` installed for React API consumption
- V1 code not reused — started fresh due to hardcoded values and broken architecture
- `event_handler` app handles the full motion event pipeline:
  ESP32 → MQTT → Django → PostgreSQL + Ntfy

**`django/Dockerfile`:**
```dockerfile
FROM python:3.11-slim
WORKDIR /backend_container
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8000
COPY . .
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
```

Layer caching implemented — `requirements.txt` copied before app code so
package reinstall is skipped on code-only changes.

**`requirements.txt`:**
django==5.1.2
djangorestframework==3.15.2
psycopg2-binary==2.9.9
requests==2.31.0

---

### 5. React Frontend (`react/`)

Scaffolded using `create-react-app` with a Sprint 1 placeholder page.
Shows container status and system architecture for teammate reference.

**`react/Dockerfile`:**
```dockerfile
FROM node:20-alpine
WORKDIR /frontend_container
COPY package*.json .
RUN npm install
EXPOSE 3000
COPY . .
CMD ["npm", "start"]
```

---

### 6. Boot Automation (`startup.sh`)

Located at repo root. Deployed to Pi host at `/home/pi/privacy-dots-v2/startup.sh`.

Runs on Pi boot via systemd after the access point services are ready.
Waits 5 seconds then starts the full Docker stack in detached mode.

**To deploy on Pi:**
```bash
chmod +x /home/pi/privacy-dots-v2/startup.sh
sudo cp /etc/systemd/system/privacydots.service
sudo systemctl enable privacydots.service
```

**Systemd service file** (`/etc/systemd/system/privacydots.service`):
```ini
[Unit]
Description=Privacy Dots Stack
After=network.target hostapd.service dnsmasq.service

[Service]
ExecStart=/home/pi/privacy-dots-v2/startup.sh
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Note: Confirm exact hostapd and dnsmasq service names with Braydon before
deploying to Pi. Update the `After=` line accordingly.

---

## API Endpoints

| Method | URL | Description |
|---|---|---|
| POST | `/api/motion/` | Receive motion event from ESP32 |
| GET | `/api/events/` | Return 50 most recent events as JSON |

---

## How to Run

```bash
# Start the full stack
docker compose up

# Start in background
docker compose up -d

# Stop everything
docker compose down

# View logs for a specific service
docker logs privacydots-django

# Run a command inside a container
docker exec privacydots-django python manage.py makemigrations
docker exec privacydots-django python manage.py migrate
```

---

## Important Notes for Teammates

**Carl (Database):**
When you add new models run these commands and commit the generated
migration files:
```bash
docker exec privacydots-django python manage.py makemigrations
docker exec privacydots-django python manage.py migrate
```

**Derrilon (MQTT):**
Mosquitto is running and reachable at `mosquitto:1883` from inside
any container. Use `MQTT_HOST` and `MQTT_PORT` from `.env`.

**Braydon + Lane (AP):**
The systemd service `After=` line needs your exact hostapd and
dnsmasq service names. Send them to Devin before Pi deployment.

**Everyone:**
Copy `.env.example` to `.env` and fill in your own values before
running `docker compose up`. Never commit `.env`.

---

## Sprint 1 Completion Checklist

- [x] `docker compose up` starts all six containers with no errors
- [x] Nginx reachable at `http://localhost` and proxies correctly
- [x] Django runs migrations on startup and dev server is up
- [x] PostgreSQL running, persists data, not exposed outside Docker network
- [x] Mosquitto running and reachable at `mosquitto:1883`
- [x] Ntfy running and reachable at `http://localhost:8080`
- [x] No hardcoded values anywhere in any committed file
- [x] `.env.example` committed and documented
- [ ] Pi boots and automatically brings up AP then Docker stack
      (pending Braydon's service names and Pi deployment)