// Interactive charts built with the Recharts library.
// Every chart shows a tooltip on hover, and can call onSelect when a part is clicked
// (the dashboards use that to jump to the matching page, already filtered).

// ===== Imports =====
import { useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, AreaChart, Area, Legend,
} from "recharts";

const AXIS = { fontSize: 12, fill: "#64748b" };

// ===== ChartCard: the white box around every chart =====
function ChartCard({ title, hint, children, action }) {
  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <h3 className="card-title">{title}</h3>
          {hint && <p className="muted small">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ===== DonutChart: parts of a whole (e.g. orders by status) =====
// data: [{ name: "Pending", value: 4, color: "#f59e0b" }, ...]
export function DonutChart({ title, hint, data, onSelect, centerLabel = "Total" }) {
  const [hovered, setHovered] = useState(null); // which slice the mouse is over
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const shown = hovered === null ? null : data[hovered];

  return (
    <ChartCard title={title} hint={hint}>
      <div className="donut-wrap">
        <div className="donut">
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={data.filter((d) => d.value > 0)}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={92}
                paddingAngle={2}
                stroke="none"
                animationDuration={600}
                onMouseLeave={() => setHovered(null)}
                onClick={(slice) => onSelect && onSelect(slice.name)}
              >
                {data.filter((d) => d.value > 0).map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.color}
                    cursor={onSelect ? "pointer" : "default"}
                    opacity={hovered === null || data[hovered].name === d.name ? 1 : 0.35}
                    onMouseEnter={() => setHovered(data.findIndex((x) => x.name === d.name))}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <div className="donut-value">{shown ? shown.value : total}</div>
            <div className="donut-label">{shown ? shown.name : centerLabel}</div>
          </div>
        </div>
        <ul className="legend">
          {data.map((d, index) => (
            <li key={d.name}>
              <button
                type="button"
                className={hovered === index ? "legend-item hover" : "legend-item"}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect && onSelect(d.name)}
                disabled={!onSelect}
              >
                <span className="legend-dot" style={{ background: d.color }} />
                <span className="legend-name">{d.name}</span>
                <span className="legend-value">{d.value}</span>
                <span className="legend-pct">{total ? Math.round((d.value / total) * 100) : 0}%</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

// ===== BarChartCard: compare amounts across items =====
// data:   [{ name: "Sneha", Pending: 2, Completed: 1 }, ...]
// series: [{ key: "Pending", color: "#f59e0b" }, ...]
// stacked = true piles the series on top of each other; false puts them side by side.
export function BarChartCard({ title, hint, data, xKey = "name", series, onSelect, height = 260, horizontal = false, stacked = false, valueFormat }) {
  const several = series.length > 1;
  return (
    <ChartCard title={title} hint={hint}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, left: horizontal ? 8 : -8, bottom: 0 }}
          onClick={(e) => onSelect && e && e.activePayload && onSelect(e.activePayload[0].payload)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={valueFormat} />
              <YAxis type="category" dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} width={130} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={valueFormat} />
            </>
          )}
          <Tooltip cursor={{ fill: "rgba(79,70,229,0.06)" }} contentStyle={{ borderRadius: 10, border: "1px solid #e4e8f1" }} formatter={valueFormat ? (v) => valueFormat(v) : undefined} />
          {several && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name || s.key}
              stackId={stacked ? "stack" : undefined}
              fill={s.color}
              cursor={onSelect ? "pointer" : "default"}
              radius={!stacked || index === series.length - 1 ? (horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]) : 0}
              maxBarSize={44}
              isAnimationActive={false}
            >
              {/* Single-series charts may colour each bar on its own (row.color). */}
              {!several && data.map((row) => <Cell key={row[xKey]} fill={row.color || s.color} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ===== TrendChart: a value over time (e.g. order value per week) =====
// data: [{ label: "12 Oct", value: 25000 }, ...]
export function TrendChart({ title, hint, data, valueFormat, color = "#4f46e5", action }) {
  return (
    <ChartCard title={title} hint={hint} action={action}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={valueFormat} width={60} />
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e4e8f1" }} formatter={(v) => [valueFormat ? valueFormat(v) : v, "Value"]} />
          <Area isAnimationActive={false} type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill="url(#trendFill)" activeDot={{ r: 6 }} dot={{ r: 3, fill: color }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
