"use client";

import { useMemo, useState } from "react";

/**
 * Daily series over the whole history as lines, stacked areas or bars, with
 * dashed markers for dated events (the site cutover, each publish). Weekly
 * mode sums counts per Monday week (and averages a position series).
 *
 * Drawn the dashboard's way (`dashboard/DashboardCharts.tsx`): the plot fills
 * the card's width from the left edge, marks are SVG stretched to the box
 * with non-scaling strokes, and every label is HTML so text never scales
 * with the chart. Counts read as bars, cumulative or rate series as lines.
 */

export type ChartSeries = {
  label: string;
  color: string;
  values: Array<number | null>;
};

const W = 1000;
const H = 240;

export function SeoTrendChart({
  days,
  series,
  markers = [],
  stacked = false,
  invert = false,
  bars = false,
  ariaLabel,
  grain = "toggle",
  height = H,
}: {
  days: string[];
  series: ChartSeries[];
  markers?: Array<{ day: string; label: string }>;
  stacked?: boolean;
  /** Position: 1 at the top. */
  invert?: boolean;
  /** Counts per day or week: bars from zero (stacked when `stacked`). */
  bars?: boolean;
  ariaLabel: string;
  /** "fixed" hides the daily / weekly toggle (points are already weeks). */
  grain?: "toggle" | "fixed";
  height?: number;
}) {
  const [weekly, setWeekly] = useState(grain === "toggle" && days.length > 120);
  const [hover, setHover] = useState<number | null>(null);
  const view = useMemo(
    () => (weekly ? toWeeks(days, series, invert) : { days, series }),
    [weekly, days, series, invert],
  );

  if (view.days.length < 2) {
    return (
      <p className="text-ui-text-subtle mt-3 text-xs">Not enough days yet.</p>
    );
  }
  const n = view.days.length;
  const tops = view.days.map((_, i) =>
    stacked
      ? view.series.reduce((s, x) => s + (x.values[i] ?? 0), 0)
      : Math.max(0, ...view.series.map((x) => x.values[i] ?? 0)),
  );
  const nonNull = view.series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null),
  );
  const rawMax = invert ? Math.max(10, ...nonNull) : Math.max(1, ...tops);
  const min = invert ? 1 : 0;
  const ticks = niceTicks(min, rawMax);
  const max = Math.max(rawMax, ticks[ticks.length - 1] ?? rawMax);
  const slot = W / n;
  // Bars sit in slots; lines run edge to edge.
  const x = (i: number) => (bars ? (i + 0.5) * slot : (i / (n - 1)) * W);
  const top = 6;
  const y = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return invert ? top + t * (height - top) : height - t * (height - top);
  };
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const pct = (px: number) => `${(px / W) * 100}%`;

  const shapes = bars ? [] : buildShapes(view.series, stacked, x, y);
  const markerIdx = markers
    .map((m) => ({ ...m, i: indexOf(view.days, m.day) }))
    .filter((m): m is typeof m & { i: number } => m.i !== null);
  const active = hover;
  const barW = stacked ? slot * 0.72 : (slot * 0.72) / view.series.length;

  return (
    <div className="mt-3 min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        {view.series.length > 1 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {view.series.map((s) => (
              <li
                key={s.label}
                className="text-ui-text-muted flex items-center gap-1.5"
              >
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        {grain === "toggle" ? (
          <div
            className="flex gap-1 text-xs"
            role="group"
            aria-label="Chart grain"
          >
            {(["Daily", "Weekly"] as const).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={(g === "Weekly") === weekly}
                onClick={() => setWeekly(g === "Weekly")}
                className={`rounded-ui border px-2 py-0.5 transition-colors ${(g === "Weekly") === weekly ? "border-ui-accent text-ui-accent bg-ui-accent-soft" : "border-ui-line text-ui-text-muted hover:text-ui-text"}`}
              >
                {g}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <div
          className="text-ui-text-subtle relative w-10 shrink-0 text-right text-[0.6875rem] tabular-nums"
          style={{ height }}
          aria-hidden="true"
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: y(tick) }}
            >
              {compact(tick)}
            </span>
          ))}
        </div>
        <div
          className="relative min-w-0 flex-1 touch-pan-y"
          style={{ height }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const t = (event.clientX - rect.left) / rect.width;
            const i = bars ? Math.floor(t * n) : Math.round(t * (n - 1));
            setHover(Math.max(0, Math.min(n - 1, i)));
          }}
        >
          <svg
            viewBox={`0 0 ${W} ${height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label={ariaLabel}
          >
            {bars && active !== null ? (
              <rect
                x={active * slot}
                y="0"
                width={slot}
                height={height}
                fill="var(--ui-canvas)"
              />
            ) : null}
            {ticks.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2={W}
                y1={y(tick)}
                y2={y(tick)}
                stroke={
                  tick === min && !invert
                    ? "var(--ui-line-strong)"
                    : "var(--ui-line)"
                }
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {bars
              ? view.series.map((s, k) =>
                  s.values.map((v, i) => {
                    if (!v || v <= 0) return null;
                    const below = stacked
                      ? view.series
                          .slice(0, k)
                          .reduce((acc, p) => acc + (p.values[i] ?? 0), 0)
                      : 0;
                    const x0 = stacked
                      ? x(i) - barW / 2
                      : x(i) - (barW * view.series.length) / 2 + k * barW;
                    return (
                      <rect
                        key={`${s.label}${i}`}
                        x={x0}
                        y={y(below + v)}
                        width={Math.max(barW - (stacked ? 0 : 1), 0.5)}
                        height={y(below) - y(below + v)}
                        fill={s.color}
                        opacity={active === null || active === i ? 1 : 0.6}
                      />
                    );
                  }),
                )
              : shapes.map(({ s, line, area }) => (
                  <g key={s.label}>
                    {area ? (
                      <path d={area} fill={s.color} fillOpacity={0.18} />
                    ) : null}
                    <path
                      d={line}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
            {markerIdx.map((m) => (
              <line
                key={`${m.day}-${m.label}`}
                x1={x(m.i)}
                x2={x(m.i)}
                y1="0"
                y2={height}
                stroke="var(--ui-warn)"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${m.day}: ${m.label}`}</title>
              </line>
            ))}
            {!bars && active !== null ? (
              <line
                x1={x(active)}
                x2={x(active)}
                y1="0"
                y2={height}
                stroke="var(--ui-line-strong)"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          {active !== null ? (
            <div
              className="rounded-ui-lg border-ui-line bg-ui-surface shadow-ui-raised pointer-events-none absolute top-0 z-10 min-w-[9rem] border px-3 py-2 text-xs"
              style={{
                left: pct(x(active)),
                transform:
                  active > n / 2
                    ? "translateX(calc(-100% - 14px))"
                    : "translateX(14px)",
              }}
            >
              <p className="text-ui-text mb-1 font-medium">
                {weekly || grain === "fixed" ? "Week of " : ""}
                {formatDay(view.days[active], true)}
              </p>
              {view.series.map((s) => (
                <p
                  key={s.label}
                  className="text-ui-text-muted flex items-center justify-between gap-3 tabular-nums"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: s.color }}
                    />
                    {s.label}
                  </span>
                  <span className="text-ui-text font-medium">
                    {s.values[active] === null
                      ? "none"
                      : (s.values[active] ?? 0).toLocaleString("en-US", {
                          maximumFractionDigits: 1,
                        })}
                  </span>
                </p>
              ))}
              {markerIdx
                .filter((m) => m.i === active)
                .map((m) => (
                  <p key={m.label} className="text-ui-warn mt-1">
                    {m.label}
                  </p>
                ))}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="text-ui-text-subtle relative mt-2 ml-12 h-4 text-[0.6875rem]"
        aria-hidden="true"
      >
        {view.days.map((day, i) =>
          i % labelEvery === 0 && n - 1 - i >= labelEvery / 2 ? (
            <span
              key={i}
              className={`absolute top-0 whitespace-nowrap ${i === 0 && !bars ? "" : "-translate-x-1/2"}`}
              style={{ left: pct(x(i)) }}
            >
              {formatDay(day)}
            </span>
          ) : null,
        )}
        <span
          className={`absolute top-0 whitespace-nowrap ${bars ? "-translate-x-1/2" : "-translate-x-full"}`}
          style={{ left: pct(x(n - 1)) }}
        >
          {formatDay(view.days[n - 1])}
        </span>
      </div>
    </div>
  );
}

type Point = [number, number];

/** Line (and, stacked, area) paths per series. Pure: no render-time mutation. */
function buildShapes(
  series: ChartSeries[],
  stacked: boolean,
  x: (i: number) => number,
  y: (v: number) => number,
) {
  if (!stacked) {
    return series.map((s) => ({
      s,
      area: null,
      line: linePath(
        s.values.map((v, i): Point | null =>
          v === null ? null : [x(i), y(v)],
        ),
      ),
    }));
  }
  const cumulative = series.map((_, k) =>
    series[0].values.map((_, i) =>
      series.slice(0, k + 1).reduce((acc, s) => acc + (s.values[i] ?? 0), 0),
    ),
  );
  return series.map((s, k) => {
    const upper = cumulative[k];
    const lower = k === 0 ? upper.map(() => 0) : cumulative[k - 1];
    const top = upper.map((v, i): Point => [x(i), y(v)]);
    const base = lower.map((v, i): Point => [x(i), y(v)]).reverse();
    return {
      s,
      line: linePath(top),
      area: `M${top.map((p) => p.join(",")).join(" L")} L${base.map((p) => p.join(",")).join(" L")} Z`,
    };
  });
}

function toWeeks(days: string[], series: ChartSeries[], average: boolean) {
  const weekOf = (day: string) => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const weeks = [...new Set(days.map(weekOf))];
  const index = new Map(weeks.map((w, i) => [w, i]));
  return {
    days: weeks,
    series: series.map((s) => {
      const sums = weeks.map(() => 0);
      const counts = weeks.map(() => 0);
      s.values.forEach((v, i) => {
        if (v === null) return;
        const w = index.get(weekOf(days[i]))!;
        sums[w] += v;
        counts[w] += 1;
      });
      return {
        ...s,
        values: sums.map((v, i) =>
          counts[i] === 0 ? null : average ? v / counts[i] : v,
        ),
      };
    }),
  };
}

function indexOf(days: string[], day: string): number | null {
  if (day < days[0] || day > days[days.length - 1]) return null;
  const i = days.findIndex((d) => d >= day);
  return i === -1 ? null : i;
}

function linePath(points: Array<[number, number] | null>): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? " L" : " M"}${p[0]},${p[1]}`;
    pen = true;
  }
  return d.trim();
}

function niceTicks(min: number, max: number): number[] {
  const span = max - min;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
  return ticks;
}

export function compact(v: number): string {
  if (v >= 1_000_000) return `${Math.round(v / 100_000) / 10}M`;
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(Math.round(v * 10) / 10);
}

const MONTHS = [
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
];
function formatDay(iso: string, withYear = false): string {
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}${withYear ? `, ${y}` : ""}`;
}
