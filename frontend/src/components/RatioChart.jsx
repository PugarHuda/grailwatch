import React, { useMemo, useState } from "react";
import { formatRatio, formatTime } from "../format.js";

const W = 860;
const H = 260;
const PAD = { top: 18, right: 16, bottom: 28, left: 56 };

/**
 * Inline-SVG area/line chart of the backing ratio over all attestations.
 * Dashed reference line at 100%; points colored green (>= 100%) / red.
 */
export default function RatioChart({ attestations }) {
  const [hover, setHover] = useState(null);

  const chart = useMemo(() => {
    const pts = attestations.map((a) => Number(a.ratioBps) / 100);
    let lo = Math.min(...pts, 100);
    let hi = Math.max(...pts, 100);
    const span = Math.max(hi - lo, 0.4);
    lo -= span * 0.25;
    hi += span * 0.25;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i) =>
      attestations.length === 1
        ? PAD.left + innerW / 2
        : PAD.left + (i / (attestations.length - 1)) * innerW;
    const y = (v) => PAD.top + ((hi - v) / (hi - lo)) * innerH;

    const points = attestations.map((a, i) => ({
      a,
      px: x(i),
      py: y(Number(a.ratioBps) / 100),
      ok: Number(a.ratioBps) >= 10000,
      pct: Number(a.ratioBps) / 100,
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(2)},${p.py.toFixed(2)}`)
      .join(" ");
    const baseY = PAD.top + innerH;
    const areaPath =
      `${linePath} L${points[points.length - 1].px.toFixed(2)},${baseY} ` +
      `L${points[0].px.toFixed(2)},${baseY} Z`;

    // 4 horizontal gridlines + the values they sit at
    const ticks = [0, 1, 2, 3, 4].map((t) => {
      const v = lo + ((hi - lo) * t) / 4;
      return { v, py: y(v) };
    });

    return { points, linePath, areaPath, ticks, refY: y(100), baseY };
  }, [attestations]);

  function onMove(evt) {
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = ((evt.clientX - rect.left) / rect.width) * W;
    let best = null;
    let bestDist = Infinity;
    for (const p of chart.points) {
      const d = Math.abs(p.px - mx);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    setHover(best);
  }

  const allOk = chart.points.every((p) => p.ok);
  const strokeColor = allOk ? "var(--green)" : "var(--accent-bright)";

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label="Backing ratio history"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={allOk ? "#22c55e" : "#345D9D"} stopOpacity="0.28" />
            <stop offset="100%" stopColor={allOk ? "#22c55e" : "#345D9D"} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {chart.ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.py}
              y2={t.py}
              className="chart-grid"
            />
            <text x={PAD.left - 8} y={t.py + 3.5} className="chart-axis" textAnchor="end">
              {t.v.toFixed(1)}%
            </text>
          </g>
        ))}

        {/* 100% reference line */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={chart.refY}
          y2={chart.refY}
          className="chart-ref"
        />
        <text
          x={W - PAD.right}
          y={chart.refY - 5}
          className="chart-ref-label"
          textAnchor="end"
        >
          1:1 backing (100%)
        </text>

        {/* area + line */}
        <path d={chart.areaPath} fill="url(#areaFill)" />
        <path d={chart.linePath} fill="none" stroke={strokeColor} strokeWidth="2" />

        {/* data points */}
        {chart.points.map((p) => (
          <circle
            key={p.a.id}
            cx={p.px}
            cy={p.py}
            r={hover && hover.a.id === p.a.id ? 5.5 : 3.5}
            fill={p.ok ? "var(--green)" : "var(--red)"}
            stroke="#0b0e14"
            strokeWidth="1.5"
          />
        ))}

        {/* hover crosshair + tooltip */}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={hover.px}
              x2={hover.px}
              y1={PAD.top}
              y2={chart.baseY}
              className="chart-crosshair"
            />
            <g
              transform={`translate(${Math.min(
                Math.max(hover.px - 78, PAD.left),
                W - PAD.right - 156
              )}, ${PAD.top})`}
            >
              <rect width="156" height="44" rx="6" className="chart-tooltip-bg" />
              <text x="10" y="18" className="chart-tooltip-title">
                #{hover.a.id} · {formatTime(hover.a.timestamp)}
              </text>
              <text
                x="10"
                y="35"
                className={`chart-tooltip-value ${hover.ok ? "tt-ok" : "tt-bad"}`}
              >
                {formatRatio(hover.a.ratioBps)}% backed
              </text>
            </g>
          </g>
        )}

        {/* x axis labels: first + last */}
        <text x={PAD.left} y={H - 8} className="chart-axis" textAnchor="start">
          #{chart.points[0].a.id}
        </text>
        <text x={W - PAD.right} y={H - 8} className="chart-axis" textAnchor="end">
          #{chart.points[chart.points.length - 1].a.id} (latest)
        </text>
      </svg>
    </div>
  );
}
