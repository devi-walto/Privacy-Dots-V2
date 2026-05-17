/*
 * StatisticsView.jsx — Statistics tab for the dashboard
 * -------------------------------------------------------
 * Renders one of two views depending on which sensor is selected:
 *
 *   "All Sensors"  -> bar chart of total activations per node (last 24 h)
 *   single sensor  -> line chart of activation count per hour (last 24 h)
 *                     plus an "Average Activation in 24 hrs" summary card
 *
 * Props:
 *   events           Array of motion events from /api/events/
 *                    Each event:
 *                      { id, node_id, location, detected_at (ISO string), device_name }
 *   selectedSensor   Name of the currently selected sensor in the sidebar.
 *                    Matches event.device_name. Use "All Sensors" for the overview.
 *
 * The charts are hand-drawn SVG so the dashboard stays dependency-free.
 */

const HOURS_IN_WINDOW = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Build 24 hourly buckets ending at `now`, count how many of the supplied
 * events fall into each bucket, and return them oldest -> newest so the
 * line chart reads left (24h ago) to right (now).
 */
function buildHourlyBuckets(events, now = Date.now()) {
  const buckets = Array.from({ length: HOURS_IN_WINDOW }, (_, i) => ({
    // hoursAgo = 23 for the oldest bucket, 0 for the most recent
    hoursAgo: HOURS_IN_WINDOW - 1 - i,
    bucketEnd: now - (HOURS_IN_WINDOW - 1 - i) * MS_PER_HOUR,
    count: 0,
  }));

  for (const event of events) {
    const t = new Date(event.detected_at).getTime();
    const ageHours = Math.floor((now - t) / MS_PER_HOUR);
    if (ageHours < 0 || ageHours >= HOURS_IN_WINDOW) continue;
    const idx = HOURS_IN_WINDOW - 1 - ageHours;
    buckets[idx].count += 1;
  }

  return buckets;
}

/**
 * SVG line chart of activations per hour over the last 24 hours.
 * Plots a polyline plus a dot for each hourly bucket.
 */
function ActivationLineChart({ buckets }) {
  const width = 600;
  const height = 240;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const stepX = plotW / (buckets.length - 1);

  const toX = (i) => padLeft + i * stepX;
  const toY = (count) => padTop + plotH - (count / maxCount) * plotH;

  const points = buckets.map((b, i) => `${toX(i)},${toY(b.count)}`).join(" ");

  // y-axis tick labels: 0, mid, max
  const ticks = [0, Math.ceil(maxCount / 2), maxCount];

  return (
    <svg
      className="stat-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Line chart of activations per hour over the last 24 hours"
    >
      {/* axes */}
      <line
        x1={padLeft} y1={padTop}
        x2={padLeft} y2={padTop + plotH}
        className="stat-axis"
      />
      <line
        x1={padLeft} y1={padTop + plotH}
        x2={padLeft + plotW} y2={padTop + plotH}
        className="stat-axis"
      />

      {/* y-axis ticks + labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padLeft - 4} y1={toY(t)}
            x2={padLeft}     y2={toY(t)}
            className="stat-axis"
          />
          <text
            x={padLeft - 6}
            y={toY(t) + 4}
            className="stat-axis-label"
            textAnchor="end"
          >
            {t}
          </text>
        </g>
      ))}

      {/* x-axis labels: 24h ago, 12h ago, now */}
      <text
        x={padLeft}
        y={height - 10}
        className="stat-axis-label"
        textAnchor="start"
      >
        -24h
      </text>
      <text
        x={padLeft + plotW / 2}
        y={height - 10}
        className="stat-axis-label"
        textAnchor="middle"
      >
        -12h
      </text>
      <text
        x={padLeft + plotW}
        y={height - 10}
        className="stat-axis-label"
        textAnchor="end"
      >
        now
      </text>

      {/* axis titles */}
      <text
        x={padLeft - 28}
        y={padTop + plotH / 2}
        className="stat-axis-title"
        transform={`rotate(-90 ${padLeft - 28} ${padTop + plotH / 2})`}
        textAnchor="middle"
      >
        Activation
      </text>
      <text
        x={padLeft + plotW / 2}
        y={height - 0}
        className="stat-axis-title"
        textAnchor="middle"
      >
        Time
      </text>

      {/* line + points */}
      <polyline points={points} className="stat-line" />
      {buckets.map((b, i) => (
        <circle
          key={i}
          cx={toX(i)}
          cy={toY(b.count)}
          r={3}
          className="stat-point"
        >
          <title>{`${b.hoursAgo}h ago: ${b.count} activations`}</title>
        </circle>
      ))}
    </svg>
  );
}

/**
 * SVG bar chart of total activations per node over the last 24 hours.
 * Used on the All Sensors view (the "Overview" bar chart from the board).
 */
function ActivationBarChart({ counts }) {
  const width = 600;
  const height = 240;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const entries = Object.entries(counts); // [[name, count], ...]
  const maxCount = Math.max(1, ...entries.map(([, c]) => c));
  const slotW = entries.length > 0 ? plotW / entries.length : plotW;
  const barW = Math.max(8, slotW * 0.6);

  const ticks = [0, Math.ceil(maxCount / 2), maxCount];
  const toY = (count) => padTop + plotH - (count / maxCount) * plotH;

  return (
    <svg
      className="stat-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Bar chart of activations per sensor over the last 24 hours"
    >
      <line
        x1={padLeft} y1={padTop}
        x2={padLeft} y2={padTop + plotH}
        className="stat-axis"
      />
      <line
        x1={padLeft} y1={padTop + plotH}
        x2={padLeft + plotW} y2={padTop + plotH}
        className="stat-axis"
      />

      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padLeft - 4} y1={toY(t)}
            x2={padLeft}     y2={toY(t)}
            className="stat-axis"
          />
          <text
            x={padLeft - 6}
            y={toY(t) + 4}
            className="stat-axis-label"
            textAnchor="end"
          >
            {t}
          </text>
        </g>
      ))}

      <text
        x={padLeft - 28}
        y={padTop + plotH / 2}
        className="stat-axis-title"
        transform={`rotate(-90 ${padLeft - 28} ${padTop + plotH / 2})`}
        textAnchor="middle"
      >
        Activation
      </text>
      <text
        x={padLeft + plotW / 2}
        y={height - 4}
        className="stat-axis-title"
        textAnchor="middle"
      >
        Sensors
      </text>

      {entries.map(([name, count], i) => {
        const slotCenter = padLeft + i * slotW + slotW / 2;
        const x = slotCenter - barW / 2;
        const y = toY(count);
        const h = padTop + plotH - y;
        return (
          <g key={name}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              className="stat-bar"
            >
              <title>{`${name}: ${count} activations (24h)`}</title>
            </rect>
            <text
              x={slotCenter}
              y={padTop + plotH + 16}
              className="stat-axis-label"
              textAnchor="middle"
            >
              {name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Card shown beneath the per-node line chart. Reports the total activations
 * in the last 24 hours and the average activations per hour (total / 24).
 */
function AverageActivationCard({ total }) {
  const perHour = total / HOURS_IN_WINDOW;
  return (
    <div className="stat-card">
      <div className="stat-card-label">Average Activation in 24 hrs</div>
      <div className="stat-card-value">{total}</div>
      <div className="stat-card-sub">
        ~{perHour.toFixed(1)} activations / hour
      </div>
    </div>
  );
}

function StatisticsView({ events, selectedSensor }) {
  const now = Date.now();
  const cutoff = now - HOURS_IN_WINDOW * MS_PER_HOUR;

  // Keep only events from the last 24 hours; sensor filtering happens below.
  const recent = events.filter(
    (e) => new Date(e.detected_at).getTime() >= cutoff
  );

  if (selectedSensor === "All Sensors") {
    const counts = {};
    for (const e of recent) {
      const name = e.device_name || `Node ${e.node_id}`;
      counts[name] = (counts[name] || 0) + 1;
    }

    return (
      <div className="stat-view">
        <h3 className="stat-title">Overview - Activations per Sensor (last 24h)</h3>
        {Object.keys(counts).length === 0 ? (
          <p className="stat-empty">No activations in the last 24 hours.</p>
        ) : (
          <ActivationBarChart counts={counts} />
        )}
      </div>
    );
  }

  const forSensor = recent.filter((e) => e.device_name === selectedSensor);
  const buckets = buildHourlyBuckets(forSensor, now);
  const total = forSensor.length;

  return (
    <div className="stat-view">
      <h3 className="stat-title">{selectedSensor} - Activation over Time</h3>
      <ActivationLineChart buckets={buckets} />
      <AverageActivationCard total={total} />
    </div>
  );
}

export default StatisticsView;
