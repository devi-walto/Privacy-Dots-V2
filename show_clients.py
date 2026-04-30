#!/usr/bin/env python3
import json
import os

STATE_FILE = "clients.json"


def load_clients(path: str):
    if not os.path.exists(path):
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def get_display_state(client: dict) -> str:
    state = client.get("state", "unknown")
    ip = client.get("ip", "unknown")

    if state == "connected" and ip == "unknown":
        return "associated, no IP yet"

    return state


def main():
    clients = load_clients(STATE_FILE)

    connected_clients = [
        client for client in clients
        if client.get("state") == "connected"
    ]

    print("Connected Clients:")
    print("--------------------------------")

    if not connected_clients:
        print("No connected clients.")
        return

    for client in connected_clients:
        mac = client.get("mac", "unknown")
        ip = client.get("ip", "unknown")
        state = get_display_state(client)

        print(f"MAC: {mac}")
        print(f"IP: {ip}")
        print(f"State: {state}")
        print()


if __name__ == "__main__":
    main()
