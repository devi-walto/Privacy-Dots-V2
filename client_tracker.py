#!/usr/bin/env python3
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone

INTERFACE = "wlan0"
STATE_FILE = "clients.json"
POLL_SECONDS = 5


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_command(cmd: list[str]) -> str:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        return result.stdout.strip()
    except Exception:
        return ""


def get_connected_macs(interface: str) -> list[str]:
    output = run_command(["iw", "dev", interface, "station", "dump"])
    macs = []
    for line in output.splitlines():
        line = line.strip()
        match = re.match(r"^Station\s+([0-9a-fA-F:]{17})\s+\(on", line)
        if match:
            macs.append(match.group(1).lower())
    return macs


def get_ip_map(interface: str) -> dict[str, str]:
    output = run_command(["ip", "neigh", "show", "dev", interface])
    ip_map: dict[str, str] = {}

    for line in output.splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue

        ip = parts[0]
        mac = None

        for i, part in enumerate(parts):
            if part == "lladdr" and i + 1 < len(parts):
                mac = parts[i + 1].lower()
                break

        if mac:
            ip_map[mac] = ip

    return ip_map


def load_state(path: str) -> dict[str, dict]:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {entry["mac"]: entry for entry in data}
    except Exception:
        return {}


def save_state(path: str, state: dict[str, dict]) -> None:
    data = sorted(state.values(), key=lambda x: x["mac"])
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def print_status(state: dict[str, dict]) -> None:
    print("\n=== Client Status ===")
    connected = [entry for entry in state.values() if entry["state"] == "connected"]

    if not connected:
        print("No connected clients.")
        return

    for entry in sorted(connected, key=lambda x: x["mac"]):
        print(f"MAC: {entry['mac']}")
        print(f"IP: {entry.get('ip', 'unknown')}")
        print(f"state: {entry['state']}")
        print(f"first_seen: {entry['first_seen']}")
        print(f"last_seen: {entry['last_seen']}")
        print()


def update_state(interface: str, state: dict[str, dict]) -> dict[str, dict]:
    timestamp = now_iso()
    connected_macs = set(get_connected_macs(interface))
    ip_map = get_ip_map(interface)

    for mac in connected_macs:
        if mac not in state:
            state[mac] = {
                "mac": mac,
                "ip": ip_map.get(mac, "unknown"),
                "state": "connected",
                "first_seen": timestamp,
                "last_seen": timestamp,
            }
        else:
            state[mac]["ip"] = ip_map.get(mac, state[mac].get("ip", "unknown"))
            state[mac]["state"] = "connected"
            state[mac]["last_seen"] = timestamp

    for mac, entry in state.items():
        if mac not in connected_macs:
            entry["state"] = "disconnected"

    return state


def main() -> None:
    print(f"Starting client tracker on {INTERFACE}")
    print(f"Saving state to {STATE_FILE}")
    state = load_state(STATE_FILE)

    while True:
        state = update_state(INTERFACE, state)
        save_state(STATE_FILE, state)
        print_status(state)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
