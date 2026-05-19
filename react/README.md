# Privacy Dots V2 Frontend
React + Vite frontend for the Privacy Dots V2 Base Station dashboard.
## Architecture
Frontend Stack:
```text
Browser
→ Nginx Reverse Proxy
→ React + Vite Frontend
→ Django REST API
→ PostgreSQL

ESP32 Event Flow:

ESP32 Nodes
→ Mosquitto MQTT Broker
→ Django Event Handler
→ PostgreSQL / Ntfy Notifications

⸻

Frontend Features

* React + Vite development environment
* Docker containerized frontend
* nginx reverse proxy integration
* Dashboard UI for node monitoring
* Sensor activity timeline
* Local storage sensor persistence
* Diagnostic connection test page

⸻

Project Structure

react/
├── public/             # Static frontend assets
├── src/
│   ├── assets/         # Images/icons
│   ├── App.jsx         # Frontend route controller
│   ├── Dashboard.jsx   # Main dashboard UI
│   ├── ConnectionTest.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx        # React mount entrypoint
├── Dockerfile
├── package.json
└── vite.config.js

⸻

Available Routes

/                   → Main dashboard
/connection-test   → Service diagnostics page
/api/              → Django backend API
/admin/            → Django admin panel

⸻

Development Commands

Run containers:

docker compose up --build

Restart frontend only:

docker compose restart react

Rebuild frontend image:

docker compose build react

⸻

Vite Development Server

The frontend uses Vite instead of Create React App.

Benefits:

* Faster startup times
* Faster hot reload (HMR)
* Simpler configuration
* Better Docker development workflow

nginx proxies frontend traffic to the internal Vite server running on:

react:5173

⸻

Django Migration Commands

Run after changing Django models:

docker exec privacydots-django python manage.py makemigrations
docker exec privacydots-django python manage.py migrate

⸻

Connectivity Tests

http://localhost
http://localhost/connection-test
http://localhost/api/
http://localhost/admin/
http://localhost:8080