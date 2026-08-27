"use client";

import { useId, useState } from "react";
import type { ChatbotDailyTrendRow } from "@/lib/chatbot/analytics";

/**
 * Conversations per day as a smooth blue area, with the prior window as a
 * dashed grey line on the same axis so a dip reads as a dip and not as noise.
 * Hover any day for the exact counts. Pure SVG, sized by its container.
 */
const W = 1000;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 28 };

export function ChatbotTrendChart({
  rows,
  prior,
}: {
  rows: ChatbotDailyTrendRow[];
  prior: ChatbotDailyTrendRow[];
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (rows.length < 2) {
    return (
      <p className="text-ui-text-subtle mt-3 text-xs">Not enough days yet.</p>
    );
  }

  const max = Math.max(
    2,
    ...rows.map((r) => r.count),
    ...prior.map((r) => r.count),
  );
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (rows.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const currentPts = rows.map((r, i) => [x(i), y(r.count)] as const);
  const priorPts = prior
    .slice(0, rows.length)
    .map((r, i) => [x(i), y(r.count)] as const);
  const currentPath = smoothPath(currentPts);
  const areaPath = `${currentPath} L${x(rows.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const ticks = niceTicks(max);
  const labelEvery = Math.max(1, Math.ceil(rows.length / 7));
  const active = hover === null ? null : rows[hover];
  const activePrior = hover === null ? null : prior[hover];

  return (
    <div className="relative mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full"
        role="img"
        aria-label="Conversations per day, current window against the prior one"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD.left) / innerW) * (rows.length - 1));
          setHover(Math.max(0, Math.min(rows.length - 1, i)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--ui-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--ui-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--ui-line)"
              strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 3}
              textAnchor="end"
              fontSize="10"
              fill="var(--ui-text-subtle)"
            >
              {tick}
            </text>
          </g>
        ))}

        {priorPts.length > 1 ? (
          <path
            d={smoothPath(priorPts)}
            fill="none"
            stroke="var(--ui-line-strong)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={currentPath}
          fill="none"
          stroke="var(--ui-accent)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {rows.map((row, i) =>
          i % labelEvery === 0 ? (
            <text
              key={row.date}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ui-text-subtle)"
            >
              {formatDate(row.date)}
            </text>
          ) : null,
        )}

        {hover !== null ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--ui-line-strong)"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(hover)}
              cy={y(rows[hover].count)}
              r={5}
              fill="var(--ui-surface)"
              stroke="var(--ui-accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>

      {active ? (
        <div
          className="rounded-ui border-ui-line bg-ui-surface shadow-ui pointer-events-none absolute top-2 border px-3 py-2 text-xs"
          style={{
            left: `${(x(hover!) / W) * 100}%`,
            transform:
              hover! > rows.length / 2
                ? "translateX(calc(-100% - 12px))"
                : "translateX(12px)",
          }}
        >
          <p className="text-ui-text font-semibold">
            {formatDate(active.date)}
          </p>
          <p className="text-ui-text-muted mt-1 tabular-nums">
            Conversations:{" "}
            <span className="text-ui-text font-medium">{active.count}</span>
          </p>
          <p className="text-ui-text-muted tabular-nums">
            Booked:{" "}
            <span className="text-ui-text font-medium">{active.booked}</span>
            {" · "}
            Captured:{" "}
            <span className="text-ui-text font-medium">{active.captured}</span>
          </p>
          {activePrior ? (
            <p className="text-ui-text-subtle mt-1 tabular-nums">
              Prior period: {activePrior.count}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Small area sparkline for a KPI card. Same curve, no axes. */
export function Sparkline({
  values,
  tone = "accent",
}: {
  values: number[];
  tone?: "accent" | "ok";
}) {
  const gradientId = useId();
  if (values.length < 2) return <div className="h-10" />;
  const w = 200;
  const h = 40;
  const max = Math.max(1, ...values);
  const pts = values.map(
    (v, i) =>
      [(i / (values.length - 1)) * w, h - 2 - (v / max) * (h - 6)] as const,
  );
  const path = smoothPath(pts);
  const color = tone === "ok" ? "var(--ui-ok)" : "var(--ui-accent)";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-10 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#${gradientId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Catmull-Rom to cubic bezier, clamped so the curve never dips below zero. */
function smoothPath(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length < 2) return "";
  const floor = Math.max(...pts.map((p) => p[1]));
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function niceTicks(max: number): number[] {
  const step = max <= 4 ? 1 : max <= 8 ? 2 : max <= 20 ? 5 : Math.ceil(max / 4);
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][Number(m) - 1];
  return `${month} ${Number(d)}`;
}
