import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_BASE = '/api';

function formatTime(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

function formatClock(value) {
  if (!value) return 'unknown time';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function eventKey(event) {
  return event.event_id || event.id;
}

function App() {
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedNode, setSelectedNode] = useState('all');
  const [status, setStatus] = useState('Loading dashboard...');
  const [notificationStatus, setNotificationStatus] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [dashboardAlerts, setDashboardAlerts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNode, setNewNode] = useState({ node_id: '', name: '', location: '' });
  const seenEventIds = useRef(new Set());

  const loadDashboard = useCallback(async () => {
    try {
      const eventPath = selectedNode === 'all'
        ? `${API_BASE}/events/`
        : `${API_BASE}/events/?node_id=${encodeURIComponent(selectedNode)}`;

      const [devicesResponse, eventsResponse] = await Promise.all([
        fetch(`${API_BASE}/devices/`),
        fetch(eventPath),
      ]);

      if (!devicesResponse.ok || !eventsResponse.ok) {
        throw new Error('API request failed');
      }

      const devicesData = await devicesResponse.json();
      const eventsData = await eventsResponse.json();
      const nextEvents = eventsData.events || [];

      nextEvents.forEach((event) => {
        const key = eventKey(event);
        const isNewEvent = !seenEventIds.current.has(key) && seenEventIds.current.size > 0;
        if (isNewEvent) {
          const message = `${event.device_name} at ${event.location || 'unassigned'} - ${formatTime(event.detected_at)}`;
          if (notificationStatus === 'granted') {
            new Notification('Motion detected', {
              body: message,
            });
          } else {
            setDashboardAlerts((currentAlerts) => [
              { id: key, message },
              ...currentAlerts.filter((alert) => alert.id !== key),
            ].slice(0, 3));
          }
        }
      });

      nextEvents.forEach((event) => seenEventIds.current.add(eventKey(event)));
      setDevices(devicesData.devices || []);
      setEvents(nextEvents);
      setStatus('Connected');
    } catch (error) {
      setStatus('Dashboard API offline');
    }
  }, [notificationStatus, selectedNode]);

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 5000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  const selectedDevice = useMemo(() => {
    return devices.find((device) => device.node_id === selectedNode);
  }, [devices, selectedNode]);

  async function addDevice(event) {
    event.preventDefault();
    const nodeId = newNode.node_id.trim();
    if (!nodeId) return;

    const response = await fetch(`${API_BASE}/devices/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: nodeId,
        name: newNode.name.trim() || nodeId,
        location: newNode.location.trim() || 'unassigned',
      }),
    });

    if (response.ok) {
      setNewNode({ node_id: '', name: '', location: '' });
      setShowAddForm(false);
      loadDashboard();
    }
  }

  async function removeDevice(nodeId) {
    const response = await fetch(`${API_BASE}/devices/${encodeURIComponent(nodeId)}/`, {
      method: 'DELETE',
    });

    if (response.ok) {
      if (selectedNode === nodeId) setSelectedNode('all');
      loadDashboard();
    }
  }

  async function changeDeviceStatus(nodeId, nextStatus) {
    const response = await fetch(`${API_BASE}/devices/${encodeURIComponent(nodeId)}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (response.ok) {
      loadDashboard();
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
  }

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <button
          className={selectedNode === 'all' ? 'sensor-row selected' : 'sensor-row'}
          onClick={() => setSelectedNode('all')}
        >
          <span>All Sensors</span>
          <span className="status-dot online" />
          <strong>{devices.length}</strong>
        </button>

        <div className="sensor-list">
          {devices.map((device) => (
            <button
              className={selectedNode === device.node_id ? 'sensor-row selected' : 'sensor-row'}
              key={device.node_id}
              onClick={() => setSelectedNode(device.node_id)}
            >
              <span>
                {device.name}
                <small>{device.node_id} - {device.status}</small>
              </span>
              <span className={device.is_online ? 'status-dot online' : 'status-dot offline'} />
              <strong>{device.signal_strength ?? '--'}</strong>
            </button>
          ))}
        </div>

        {showAddForm ? (
          <form className="add-node open" onSubmit={addDevice}>
            <h2>Add Node</h2>
            <input
              placeholder="node id"
              value={newNode.node_id}
              onChange={(event) => setNewNode({ ...newNode, node_id: event.target.value })}
            />
            <input
              placeholder="name"
              value={newNode.name}
              onChange={(event) => setNewNode({ ...newNode, name: event.target.value })}
            />
            <input
              placeholder="location"
              value={newNode.location}
              onChange={(event) => setNewNode({ ...newNode, location: event.target.value })}
            />
            <button className="primary-button" type="submit">Add Sensor</button>
            <button className="cancel-button" type="button" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button className="primary-button add-node-button" type="button" onClick={() => setShowAddForm(true)}>
            Add Sensor
          </button>
        )}
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>{selectedDevice ? selectedDevice.name : 'All Sensors'}</h1>
            <p className="eyebrow">{status}</p>
          </div>
          <button className="settings-button" onClick={enableNotifications} title={`Notifications: ${notificationStatus}`}>
            ⚙
          </button>
        </header>

        {dashboardAlerts.length > 0 && (
          <section className="alert-stack">
            {dashboardAlerts.map((alert) => (
              <div className="dashboard-alert" key={alert.id}>
                <strong>Motion detected</strong>
                <span>{alert.message}</span>
                <button onClick={() => setDashboardAlerts((alerts) => alerts.filter((item) => item.id !== alert.id))}>
                  Dismiss
                </button>
              </div>
            ))}
          </section>
        )}

        {selectedDevice && (
          <section className="device-panel">
            <div>
              <span className={selectedDevice.is_online ? 'status-dot online' : 'status-dot offline'} />
              <strong>{selectedDevice.status}</strong>
            </div>
            <p>Location: {selectedDevice.location || 'unassigned'}</p>
            <p>Last seen: {formatTime(selectedDevice.last_seen)}</p>
            <p>Signal: {selectedDevice.signal_strength ?? '--'} dBm</p>
            <p>Firmware: {selectedDevice.firmware_version || 'unknown'}</p>
            <button
              className="secondary-button"
              onClick={() => changeDeviceStatus(
                selectedDevice.node_id,
                selectedDevice.status === 'disabled' ? 'pending' : 'disabled'
              )}
            >
              {selectedDevice.status === 'disabled' ? 'Enable sensor' : 'Disable sensor'}
            </button>
            <button className="danger-button" onClick={() => removeDevice(selectedDevice.node_id)}>
              Remove sensor
            </button>
          </section>
        )}

        <section className="event-feed">
          <div className="feed-heading">
            <h2>Recent Activity</h2>
            <button className="secondary-button" onClick={loadDashboard}>Refresh</button>
          </div>

          {events.length === 0 && (
            <div className="empty-state">No motion events yet.</div>
          )}

          {events.map((event) => (
            <article className="event-row" key={event.event_id || event.id}>
              <div className="event-icon">•</div>
              <div>
                <p>
                  <strong>{event.device_name}:</strong> Motion detected
                  {event.location ? ` at ${event.location}` : ''} at {formatClock(event.detected_at)}
                </p>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

export default App;
