import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API_BASE = "/api";

function formatTime(value) {
  if (!value) return "unknown time";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [sensorToDelete, setSensorToDelete] = useState(null);
  const [status, setStatus] = useState("Loading...");

  const loadData = useCallback(async () => {
    try {
      const eventPath =
        selectedSensor === "all"
          ? `${API_BASE}/events/`
          : `${API_BASE}/events/?node_id=${encodeURIComponent(selectedSensor)}`;

      const [devicesRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/devices/`),
        fetch(eventPath),
      ]);

      if (!devicesRes.ok || !eventsRes.ok) throw new Error("API failed");

      const devicesData = await devicesRes.json();
      const eventsData = await eventsRes.json();

      setDevices(devicesData.devices || []);
      setEvents(eventsData.events || []);
      setStatus("Connected");
    } catch {
      setStatus("API offline");
    }
  }, [selectedSensor]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  async function removeDevice(nodeId) {
    await fetch(`${API_BASE}/devices/${encodeURIComponent(nodeId)}/`, {
      method: "DELETE",
    });
    if (selectedSensor === nodeId) setSelectedSensor("all");
    setSensorToDelete(null);
    setDeleteMode(false);
    loadData();
  }

  const selectedDevice = devices.find((d) => d.node_id === selectedSensor);

  return (
    <div className="app">
      <div className="settings-container">
        <button onClick={() => setShowSettings(!showSettings)}>⚙️</button>
        {showSettings && (
          <div className="dropdown">
            <button
              onClick={() => {
                setDeleteMode(!deleteMode);
                setShowSettings(false);
              }}
            >
              {deleteMode ? "Done deleting" : "Delete Sensor"}
            </button>
          </div>
        )}
      </div>

      <div className="sidebar">
        <button
          className="sensor-button"
          onClick={() => setSelectedSensor("all")}
        >
          <span>All Sensors</span>
          <span className="status online" />
        </button>

        {devices.map((device) => (
          <button
            key={device.node_id}
            className="sensor-button"
            onClick={() => setSelectedSensor(device.node_id)}
          >
            <span>
              {device.name}
              <small style={{ display: "block", fontSize: "0.7em", color: "#aaa" }}>
                {device.node_id}
              </small>
            </span>
            {deleteMode ? (
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSensorToDelete(device.node_id);
                }}
              >
                ❌
              </button>
            ) : (
              <span className={`status ${device.is_online ? "online" : "offline"}`} />
            )}
          </button>
        ))}
      </div>

      <div className="main">
        <h2>{selectedDevice ? selectedDevice.name : "All Sensors"}</h2>
        <p style={{ color: "#888", fontSize: "0.85em", marginBottom: "12px" }}>
          {status}
        </p>

        {events.length === 0 ? (
          <p>No motion events yet.</p>
        ) : (
          <ul>
            {events.map((event) => (
              <li key={event.event_id || event.id}>
                <strong>{event.device_name}</strong>: Motion detected
                {event.location ? ` at ${event.location}` : ""} at{" "}
                {formatTime(event.detected_at)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {sensorToDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <p>Are you sure you want to delete {sensorToDelete}?</p>
            <button onClick={() => removeDevice(sensorToDelete)}>Yes, Delete</button>
            <button onClick={() => setSensorToDelete(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
