// main dashboard page - sidebar, event feed, stats tab, test button

import { useState, useEffect } from "react";
import "./App.css";
import StatisticsView from "./StatisticsView.jsx";

const REFRESH_MS = 10000;

const DEFAULT_SENSORS = [
  { name: "All Sensors", status: "online" },
  { name: "Sensor 1", status: "online" },
  { name: "Sensor 2", status: "offline" },
];

// backend wants a node_id - "Sensor 1" becomes "1"
function getNodeId(sensorName) {
  const match = sensorName.match(/Sensor\s*(\d+)/i);
  if (match) return match[1];
  return sensorName.replace(/\s+/g, "-").toLowerCase();
}

function loadSensorsFromStorage() {
  const saved = localStorage.getItem("sensors");
  if (saved) return JSON.parse(saved);
  return DEFAULT_SENSORS;
}

function Dashboard() {
  const [sensors, setSensors] = useState(loadSensorsFromStorage);
  const [selectedSensor, setSelectedSensor] = useState("All Sensors");
  const [activeTab, setActiveTab] = useState("overview");

  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [sensorToDelete, setSensorToDelete] = useState(null);

  const [testLoading, setTestLoading] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  // save sensor list when it changes
  useEffect(() => {
    localStorage.setItem("sensors", JSON.stringify(sensors));
  }, [sensors]);

  // clear test message when user picks a different sensor
  useEffect(() => {
    setTestMessage("");
  }, [selectedSensor]);

  // fetch events from django, keep refreshing
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events/");
        if (!res.ok) throw new Error("bad response " + res.status);
        const data = await res.json();
        setEvents(data.events || []);
        setEventsError(null);
      } catch (err) {
        setEventsError(err.message);
      }
    }

    fetchEvents();
    const timer = setInterval(fetchEvents, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  async function fetchEventsNow() {
    const res = await fetch("/api/events/");
    const data = await res.json();
    setEvents(data.events || []);
  }

  async function addTestEvent() {
    if (selectedSensor === "All Sensors") return;

    setTestLoading(true);
    setTestMessage("");

    try {
      const payload = {
        event_id: "test-" + Date.now(),
        node_id: getNodeId(selectedSensor),
        device_name: selectedSensor,
        location: "Dashboard test",
        connection: { interrupted: false, signal_strength: -55 },
        device_status: { battery: 88, firmware_version: "test" },
      };

      const res = await fetch("/api/motion/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "request failed");

      await fetchEventsNow();
      setTestMessage("ok");
      setTimeout(() => setTestMessage(""), 3000);
    } catch (err) {
      setTestMessage(err.message);
    } finally {
      setTestLoading(false);
    }
  }

  function addSensor() {
    const num = sensors.length;
    setSensors([...sensors, { name: "Sensor " + num, status: "offline" }]);
  }

  function confirmDelete() {
    const updated = sensors.filter((s) => s.name !== sensorToDelete);
    setSensors(updated);
    if (selectedSensor === sensorToDelete) setSelectedSensor("All Sensors");
    setSensorToDelete(null);
  }

  // what to show on overview tab
  let eventsToShow = [...events];
  if (selectedSensor !== "All Sensors") {
    eventsToShow = eventsToShow.filter(
      (e) => e.device_name === selectedSensor
    );
  }
  eventsToShow.sort(
    (a, b) => new Date(b.detected_at) - new Date(a.detected_at)
  );

  const canAddTest =
    selectedSensor !== "All Sensors" && !testLoading;

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
        {sensors.map((sensor, i) => (
          <button
            key={i}
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
              <span className={"status " + sensor.status}></span>
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
            className="test-event-button"
            disabled={!canAddTest}
            onClick={addTestEvent}
          >
            {testLoading ? "Sending..." : "Add Test Event"}
          </button>
        </div>

        {testMessage && (
          <p className={testMessage === "ok" ? "test-event-hint ok" : "test-event-hint err"}>
            {testMessage === "ok"
              ? "Test event added."
              : testMessage}
          </p>
        )}

        <div className="tab-bar">
          <button
            className={"tab" + (activeTab === "overview" ? " active" : "")}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={"tab" + (activeTab === "statistics" ? " active" : "")}
            onClick={() => setActiveTab("statistics")}
          >
            Statistics
          </button>
        </div>

        {eventsError && (
          <p className="events-error">Could not load events: {eventsError}</p>
        )}

        {activeTab === "overview" ? (
          <ul className="event-log">
            {eventsToShow.length === 0 ? (
              <li className="event-empty">No motion events yet.</li>
            ) : (
              eventsToShow.map((ev) => (
                <li key={ev.id}>
                  <strong>{ev.device_name}</strong>: Motion detected at{" "}
                  {new Date(ev.detected_at).toLocaleString()}
                  {ev.location && " (" + ev.location + ")"}
                </li>
              ))
            )}
          </ul>
        ) : (
          <StatisticsView events={events} selectedSensor={selectedSensor} />
        )}
      </div>

      {sensorToDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <p>Delete {sensorToDelete}?</p>
            <button onClick={confirmDelete}>Yes</button>
            <button onClick={() => setSensorToDelete(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
