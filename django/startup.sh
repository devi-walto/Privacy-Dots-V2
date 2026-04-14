#!/bin/bash

# startup.sh — Privacy Dots Boot Script
# ---------------------------------------
# This script runs automatically on Pi boot via systemd.
# It waits for the access point to be ready then starts
# the entire Docker stack in the background.
#
# Lives on the Pi host at:
#   /home/pi/privacy-dots-v2/startup.sh
#
# Enabled via systemd service:
#   /etc/systemd/system/privacydots.service


# Runs on Pi boot via systemd after hostapd and dnsmasq are ready.
# Starts the full Docker stack in the background.

# Give the access point 5 seconds to fully initialize
sleep 5

# Move to the project directory so docker compose can find docker-compose.yml
cd /home/pi/privacy-dots-v2

# Start all containers in the background
docker compose up -d