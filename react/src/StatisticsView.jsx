/*
 * StatisticsView.jsx — Statistics tab for the dashboard
 * -------------------------------------------------------
 * Renders one of two views depending on which sensor is selected:
 *
 *   "All Sensors"  -> bar chart of total activations per node (last 24 h)
 *   single sensor  -> line chart of activation count per hour (last 24 h)
 *                     plus an "Average Activation in 24 hrs" summary card
 *
 * Charts use a shared layout (margins, ticks, grid) for consistent spacing.
 */

const HOURS_IN_WINDOW = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

/** Shared SVG dimensions and margins (room for labels outside the plot). */
const CHART = {
  width: 640,
  height: 300,
  margin: { top: 32, right: 40, bottom: 64, left: 72 },
  tickGap: 12,
  titleGap: 20,
};

function getPlot() {
  const { width, height, margin } = CHART;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  return {
    left: margin.left,
    top: margin.top,
    right: margin.left + plotW,
    bottom: margin.top + plotH,
    width: plotW,
    height: plotH,
  };
}

/** Y scale with headroom so peaks are not clipped against the top edge. */
function yScale(maxCount, plot) {
  const dataMax = Math.max(0, maxCount);
  const displayMax =
    dataMax === 0 ? 1 : Math.max(dataMax + 1, Math.ceil(dataMax * 1.12));
  const toY = (value) =>
    plot.bottom - (value / displayMax) * plot.height;
  const ticks =
    displayMax <= 1
      ? [0, 1]
      : [0, Math.ceil(displayMax / 2), displayMax];
  return { displayMax, toY, ticks: [...new Set(ticks)] };
}

function ChartGrid({ plot, ticks, toY }) {
  return (
    <g className="stat-grid" aria-hidden="true">
      <rect
        x={plot.left}
        y={plot.top}
        width={plot.width}
        height={plot.height}
        className="stat-plot-area"
      />
      {ticks.map((t) => (
        <line
          key={t}
          x1={plot.left}
          y1={toY(t)}
          x2={plot.right}
          y2={toY(t)}
          className="stat-grid-line"
        />
      ))}
    </g>
  );
}

function YAxis({ plot, ticks, toY, title }) {
  const { margin, tickGap } = CHART;
  const labelX = plot.left - tickGap;
  const titleX = margin.left / 2;

  return (
    <g className="stat-y-axis">
      <line
        x1={plot.left}
        y1={plot.top}
        x2={plot.left}
        y2={plot.bottom}
        className="stat-axis"
      />
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={plot.left - 6}
            y1={toY(t)}
            x2={plot.left}
            y2={toY(t)}
            className="stat-axis-tick"
          />
          <text
            x={labelX}
            y={toY(t)}
            className="stat-axis-label"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {t}
          </text>
        </g>
      ))}
      <text
        x={titleX}
        y={plot.top + plot.height / 2}
        className="stat-axis-title"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(-90 ${titleX} ${plot.top + plot.height / 2})`}
      >
        {title}
      </text>
    </g>
  );
}

function XAxisBaseline({ plot }) {
  return (
    <line
      x1={plot.left}
      y1={plot.bottom}
      x2={plot.right}
      y2={plot.bottom}
      className="stat-axis"
    />
  );
}

function buildHourlyBuckets(events, now = Date.now()) {
  const buckets = Array.from({ length: HOURS_IN_WINDOW }, (_, i) => ({
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

function ActivationLineChart({ buckets }) {
  const plot = getPlot();
  const maxCount = Math.max(0, ...buckets.map((b) => b.count));
  const { toY, ticks } = yScale(maxCount, plot);
  const stepX = plot.width / (buckets.length - 1);
  const toX = (i) => plot.left + i * stepX;

  const points = buckets.map((b, i) => `${toX(i)},${toY(b.count)}`).join(" ");
  const clipId = "stat-line-clip";
  const tickY = plot.bottom + CHART.tickGap + 4;
  const timeTitleY = plot.bottom + CHART.titleGap + 22;

  return (
    <svg
      className="stat-chart"
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label="Line chart of activations per hour over the last 24 hours"
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={plot.left}
            y={plot.top}
            width={plot.width}
            height={plot.height}
          />
        </clipPath>
      </defs>

      <ChartGrid plot={plot} ticks={ticks} toY={toY} />
      <YAxis plot={plot} ticks={ticks} toY={toY} title="Activation" />
      <XAxisBaseline plot={plot} />

      <g className="stat-x-axis">
        {[
          { x: plot.left, label: "-24h", anchor: "start" },
          { x: plot.left + plot.width / 2, label: "-12h", anchor: "middle" },
          { x: plot.right, label: "now", anchor: "end" },
        ].map(({ x, label, anchor }) => (
          <text
            key={label}
            x={x}
            y={tickY}
            className="stat-axis-label"
            textAnchor={anchor}
            dominantBaseline="hanging"
          >
            {label}
          </text>
        ))}
        <text
          x={plot.left + plot.width / 2}
          y={timeTitleY}
          className="stat-axis-title"
          textAnchor="middle"
          dominantBaseline="hanging"
        >
          Time
        </text>
      </g>

      <g clipPath={`url(#${clipId})`}>
        <polyline points={points} className="stat-line" />
        {buckets.map((b, i) => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(b.count)}
            r={4}
            className="stat-point"
          >
            <title>{`${b.hoursAgo}h ago: ${b.count} activations`}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}

function ActivationBarChart({ counts }) {
  const plot = getPlot();
  const entries = Object.entries(counts);
  const maxCount = Math.max(0, ...entries.map(([, c]) => c));
  const { toY, ticks } = yScale(maxCount, plot);
  const slotW = entries.length > 0 ? plot.width / entries.length : plot.width;
  const barW = Math.max(12, slotW * 0.55);
  const categoryY = plot.bottom + CHART.tickGap + 6;
  const sensorsTitleY = plot.bottom + CHART.titleGap + 24;
  const clipId = "stat-bar-clip";

  return (
    <svg
      className="stat-chart"
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label="Bar chart of activations per sensor over the last 24 hours"
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={plot.left}
            y={plot.top}
            width={plot.width}
            height={plot.height}
          />
        </clipPath>
      </defs>

      <ChartGrid plot={plot} ticks={ticks} toY={toY} />
      <YAxis plot={plot} ticks={ticks} toY={toY} title="Activation" />
      <XAxisBaseline plot={plot} />

      <text
        x={plot.left + plot.width / 2}
        y={sensorsTitleY}
        className="stat-axis-title"
        textAnchor="middle"
        dominantBaseline="hanging"
      >
        Sensors
      </text>

      <g clipPath={`url(#${clipId})`}>
        {entries.map(([name, count], i) => {
          const slotCenter = plot.left + i * slotW + slotW / 2;
          const x = slotCenter - barW / 2;
          const y = toY(count);
          const h = plot.bottom - y;
          return (
            <rect
              key={name}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              className="stat-bar"
            >
              <title>{`${name}: ${count} activations (24h)`}</title>
            </rect>
          );
        })}
      </g>

      {entries.map(([name], i) => {
        const slotCenter = plot.left + i * slotW + slotW / 2;
        return (
          <text
            key={`${name}-label`}
            x={slotCenter}
            y={categoryY}
            className="stat-axis-label stat-bar-label"
            textAnchor="middle"
            dominantBaseline="hanging"
          >
            {name}
          </text>
        );
      })}
    </svg>
  );
}

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
        <h3 className="stat-title">
          Overview - Activations per Sensor (last 24h)
        </h3>
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
