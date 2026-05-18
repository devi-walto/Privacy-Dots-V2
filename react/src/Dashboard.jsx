/*
 * Dashboard.jsx — Main dashboard page
 * ------------------------------------
 * The main panel has two tabs:
 *
 *   Overview    -> reverse-chronological feed of motion events,
 *                  filtered by the sensor selected in the sidebar.
 *   Statistics  -> activation-over-time line chart and 24h average for the
 *                  selected sensor, or a per-sensor bar chart for All Sensors.
 *
 * The "Add Test Event" button POSTs a synthetic motion payload to /api/motion/
 * for whichever sensor is selected in the sidebar (for local QA).
 */

import { useState, useEffect, useCallback } from "react";
import "./App.css";
import StatisticsView from "./StatisticsView.jsx";

const EVENT_REFRESH_MS = 10_000;

/** Map sidebar label to API node_id; keeps "Sensor 1" -> "1" for ESP-style ids. */
function nodeIdForSensorName(name) {
  const t = name.trim();
  const m = /^Sensor\s*(\d+)$/i.exec(t);
  if (m) return m[1];
  const slug = t.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");
  if (slug) return slug;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return "n" + Math.abs(h).toString(36);
}

function Dashboard() {
  const [sensors, setSensors] = useState(() => {
    const saved = localStorage.getItem("sensors");
    return saved
      ? JSON.parse(saved)
      : [
          { name: "All Sensors", status: "online" },
          { name: "Sensor 1", status: "online" },
          { name: "Sensor 2", status: "offline" },
        ];
  });

  const [selectedSensor, setSelectedSensor] = useState("All Sensors");
  const [sensorToDelete, setSensorToDelete] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  // Tab selection for the main panel: "overview" (event feed) | "statistics"
  const [activeTab, setActiveTab] = useState("overview");

  // Live motion events from the Django API.
  // Each entry: { id, node_id, location, detected_at (ISO), device_name }
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState(null);
  const [testEventPending, setTestEventPending] = useState(false);
  const [testEventHint, setTestEventHint] = useState(null);

  useEffect(() => {
    setTestEventHint(null);
  }, [selectedSensor]);

  useEffect(() => {
    localStorage.setItem("sensors", JSON.stringify(sensors));
  }, [sensors]);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events/");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEvents(Array.isArray(json.events) ? json.events : []);
      setEventsError(null);
    } catch (err) {
      setEventsError(err.message || "Failed to load events");
    }
  }, []);

  // Pull the latest motion events on mount and on a polling interval so the
  // dashboard stays roughly live without needing a websocket.
  useEffect(() => {
    loadEvents();
    const id = setInterval(loadEvents, EVENT_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadEvents]);

  const addTestEvent = async () => {
    if (selectedSensor === "All Sensors") return;
    setTestEventPending(true);
    setTestEventHint(null);
    try {
      const body = {
        event_id: `ui-test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        node_id: nodeIdForSensorName(selectedSensor),
        device_name: selectedSensor,
        location: "Dashboard test",
        connection: { interrupted: false, signal_strength: -55 },
        device_status: { battery: 88, firmware_version: "test" },
      };
      const res = await fetch("/api/motion/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let json = {};
      try {
        json = await res.json();
      } catch {
        /* non-JSON body */
      }
      if (!res.ok) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }
      await loadEvents();
      setTestEventHint("Test event logged for this sensor.");
      window.setTimeout(() => setTestEventHint(null), 3000);
    } catch (err) {
      setTestEventHint(err.message || "Failed to add test event");
    } finally {
      setTestEventPending(false);
    }
  };

  const addSensor = () => {
    const sensorNumber = sensors.length;
    const newSensor = {
      name: `Sensor ${sensorNumber}`,
      status: "offline",
    };
    setSensors([...sensors, newSensor]);
  };

  const confirmDelete = () => {
    if (!sensorToDelete) return;
    const updatedSensors = sensors.filter(
      (sensor) => sensor.name !== sensorToDelete
    );
    setSensors(updatedSensors);
    if (selectedSensor === sensorToDelete) {
      setSelectedSensor("All Sensors");
    }
    setSensorToDelete(null);
  };

  const cancelDelete = () => setSensorToDelete(null);

  // Events to render on the Overview tab:
  //   - filtered by the selected sensor (matched against device_name)
  //   - sorted reverse-chronologically (newest first)
  const visibleEvents = events
    .filter((e) =>
      selectedSensor === "All Sensors" ? true : e.device_name === selectedSensor
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    );

  return (
    <div className="app">
      <div className="settings-container">
        <button onClick={() => setShowSettings(!showSettings)}>⚙️</button>

        {showSettings && (
          <div className="dropdown">
            <button>Node Health Check</button>
            <button>Add Host</button>
            <button onClick={() => setDeleteMode(!deleteMode)}>
              Delete Sensor
            </button>
          </div>
        )}
      </div>

      <div className="sidebar">
        {sensors.map((sensor, index) => (
          <button
            key={index}
            className="sensor-button"
            onClick={() => setSelectedSensor(sensor.name)}
          >
            <span>{sensor.name}</span>

            {deleteMode ? (
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSensorToDelete(sensor.name);
                }}
              >
                ❌
              </button>
            ) : (
              <span className={`status ${sensor.status}`}></span>
            )}
          </button>
        ))}

        <button className="add-button" onClick={addSensor}>
          + Add Sensor
        </button>
      </div>

      <div className="main">
        <div className="main-header">
          <h2 className="main-title">{selectedSensor}</h2>
          <button
            type="button"
            className="test-event-button"
            disabled={
              selectedSensor === "All Sensors" || testEventPending
            }
            title={
              selectedSensor === "All Sensors"
                ? "Select a sensor in the sidebar first"
                : "POST a motion event for the selected sensor"
            }
            onClick={addTestEvent}
          >
            {testEventPending ? "Sending…" : "Add Test Event"}
          </button>
        </div>
        {testEventHint && (
          <p
            className={
              testEventHint.startsWith("Test event")
                ? "test-event-hint ok"
                : "test-event-hint err"
            }
          >
            {testEventHint}
          </p>
        )}

        <div className="tab-bar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "overview"}
            className={`tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "statistics"}
            className={`tab ${activeTab === "statistics" ? "active" : ""}`}
            onClick={() => setActiveTab("statistics")}
          >
            Statistics
          </button>
        </div>

        {eventsError && (
          <p className="events-error">
            Could not load live events: {eventsError}
          </p>
        )}

        {activeTab === "overview" ? (
          <ul className="event-log">
            {visibleEvents.length === 0 ? (
              <li className="event-empty">No motion events yet.</li>
            ) : (
              visibleEvents.map((log) => (
                <li key={log.id}>
                  <strong>{log.device_name}</strong>: Motion detected at{" "}
                  {new Date(log.detected_at).toLocaleString()}
                  {log.location ? ` (${log.location})` : ""}
                </li>
              ))
            )}
          </ul>
        ) : (
          <StatisticsView
            events={events}
            selectedSensor={selectedSensor}
          />
        )}
      </div>

      {sensorToDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <p>Are you sure you want to delete {sensorToDelete}?</p>
            <button onClick={confirmDelete}>Yes, Delete</button>
            <button onClick={cancelDelete}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
