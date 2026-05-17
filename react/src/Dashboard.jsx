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
 * Live motion events come from GET /api/events/ (Django, proxied by nginx).
 * The sidebar's sensor list is persisted to localStorage; the events feed
 * itself is fetched fresh on mount and refreshed on a short interval.
 */

import { useState, useEffect } from "react";
import "./App.css";
import StatisticsView from "./StatisticsView.jsx";

const EVENT_REFRESH_MS = 10_000;

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

  useEffect(() => {
    localStorage.setItem("sensors", JSON.stringify(sensors));
  }, [sensors]);

  // Pull the latest motion events on mount and on a polling interval so the
  // dashboard stays roughly live without needing a websocket.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/events/");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setEvents(Array.isArray(json.events) ? json.events : []);
        setEventsError(null);
      } catch (err) {
        if (cancelled) return;
        setEventsError(err.message || "Failed to load events");
      }
    };

    load();
    const id = setInterval(load, EVENT_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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
        <h2>{selectedSensor}</h2>

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
