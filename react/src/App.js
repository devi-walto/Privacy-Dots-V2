/*
 * App.js — Root React Component
 * --------------------------------
 * This is the entry point for the React frontend.
 * Every page and component in the app starts here.
 *
 * Current state: Sprint 1 placeholder
 * This page confirms the React container is running and
 * reachable via Nginx. The actual dashboard UI will be
 * built in a later sprint.
 *
 * Works with:
 *   - nginx/nginx.conf — proxies all non-api requests here
 *   - django/event_handler/views.py — will fetch event data from here
 */


import { useState, useEffect } from "react";
import "./App.css";

function App() {
  // list of sensors
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

  const addSensor = () => {
    const sensorNumber = sensors.length; 
    const newSensor = {
      name: `Sensor ${sensorNumber}`,
      status: "offline"
    };

  setSensors([...sensors, newSensor]);
  };

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem("sensors", JSON.stringify(sensors));
  }, [sensors]);

  const [logs, setLogs] = useState({
  "Sensor 1": [
    { message: "Motion detected", time: "2:14 PM" },
    { message: "No motion", time: "2:20 PM" }
  ],
  "Sensor 2": [
    { message: "Motion detected", time: "1:02 PM" }
  ]
  });
  
  const [deleteMode, setDeleteMode] = useState(false);

  const deleteSensor = (sensorName) => {
  // prevent deleting "All Sensors"
  if (sensorName === "All Sensors") return;

  const updatedSensors = sensors.filter(
    (sensor) => sensor.name !== sensorName
  );

  setSensors(updatedSensors);

  // reset selection if needed
  if (selectedSensor === sensorName) {
    setSelectedSensor("All Sensors");
  }
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

  const cancelDelete = () => {
    setSensorToDelete(null);
  };

  return (
    <div className="app">

      <div className="settings-container">
        <button onClick={() => setShowSettings(!showSettings)}>
          ⚙️
        </button>

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
        <ul>
          {(selectedSensor === "All Sensors"
            ? Object.entries(logs).flatMap(([sensorName, sensorLogs]) =>
                sensorLogs.map((log) => ({
                  ...log,
                  sensorName
                }))
              )
            : (logs[selectedSensor] || []).map((log) => ({
                ...log,
                sensorName: selectedSensor
              }))
          ).map((log, index) => (
            <li key={index}>
              <strong>{log.sensorName}</strong>: {log.message} at {log.time}
            </li>
          ))}
        </ul>
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
                               
export default App;
