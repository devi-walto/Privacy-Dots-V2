#!/bin/bash
set -e

# startup.sh — Privacy Dots Boot Script
# ---------------------------------------
# Runs automatically on Pi boot via systemd.
# Sets up Wi-Fi access point, then starts the full Docker system.
#
# Location:
#   /home/pi/privacy-dots-v2/startup.sh
#
# Service:
#   /etc/systemd/system/privacydots.service

# For this file to run on boot, you must:
# 1. Create the service file at the path above
# 2. Paste this or similar (make sure ExecStart is startup.sh dir):
        # [Unit]
        # Description=Privacy Dots Startup Service
        # After=network.target

        # [Service]
        # ExecStart=/home/pi/privacy-dots-v2/startup.sh
        # Restart=always
        # User=root

        # [Install]
        # WantedBy=multi-user.target
# 3. Enable the service so it runs on startup
        # sudo systemctl daemon-reload
        # sudo systemctl enable privacydots.service
# 4. Make sure this script is executable (chmod +x startup.sh)



##################################### BEGIN SCRIPT ###################################

# Define all system settings (Wi-Fi name, password, paths, et...)
AP_NAME="MyPiAP"                 # Wi-Fi name users will see
AP_PASSWORD="ChangeMe123!"       # Wi-Fi password
WIFI_IFACE="wlan0"               # Physical Wi-Fi device
CONNECTION_NAME="Pi-AP"          # Internal name used by the system
AP_IP_CIDR="192.168.4.1/24"      # IP range for connected devices
PROJECT_DIR="/home/pi/privacy-dots-v2"

# Create flags to track setup and default password state
STATE_DIR="/var/lib/privacydots" # directory in linux var files to track which state sys is in
SETUP_COMPLETE_FLAG="$STATE_DIR/setup_complete.flag"
DEFAULT_FLAG="$STATE_DIR/default_ap_password.flag"

mkdir -p "$STATE_DIR"

# Run only once: mark that default password is active on first setup
if [ ! -f "$SETUP_COMPLETE_FLAG" ]; then         # Check if we completed init setup
    echo "[*] First boot detected"

    touch "$DEFAULT_FLAG"                       # Flag that default password is still being used
    touch "$SETUP_COMPLETE_FLAG"                # Flag that init setup has been completed (doesnt rerun)
fi

# Start NetworkManager to control network connections
echo "[1] Starting NetworkManager..."
systemctl restart NetworkManager
sleep 2

# Bring up existing Wi-Fi access point, or create it if missing
echo "[2] Bringing up AP mode..."
# nmcli - Network command line interface
nmcli connection up "$CONNECTION_NAME" || {
    echo "[!] AP profile not found. Creating it now..."

    # Create new Wi-Fi access point profile
    nmcli connection add type wifi ifname "$WIFI_IFACE" con-name "$CONNECTION_NAME" autoconnect yes ssid "$AP_NAME"

    # Configure Wi-Fi settings (mode, password, IP range, etc.)
    nmcli connection modify "$CONNECTION_NAME" \
      802-11-wireless.mode ap \
      802-11-wireless.band bg \
      802-11-wireless.channel 6 \
      802-11-wireless-security.key-mgmt wpa-psk \
      802-11-wireless-security.psk "$AP_PASSWORD" \
      ipv4.method shared \
      ipv4.addresses "$AP_IP_CIDR" \
      ipv6.method ignore \
      connection.autoconnect yes \
      connection.permissions ""

    # Activate the access point
    nmcli connection up "$CONNECTION_NAME"
}

# Give the network time to fully come online
echo "[3] Waiting for AP/network to fully initialize..."
sleep 5

# Start all backend services (Django, React, DB, etc.)
echo "[4] Starting Privacy Dots Docker stack..."
cd "$PROJECT_DIR" || {
    echo "[!] Project directory not found: $PROJECT_DIR"
    exit 1
}
docker compose up -d

# Confirm system is running
echo "[✔] Privacy Dots V2 startup complete"
nmcli connection show --active