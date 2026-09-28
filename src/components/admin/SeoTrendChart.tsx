"use client";

import { useMemo, useState } from "react";

/**
 * Daily series over the whole history as lines, or stacked areas, with
 * dashed markers for dated events (the site cutover, each publish). Weekly
 * mode sums counts per Monday week (and averages a position series). Pure
 * SVG, the same drawing rules as ChatbotTrendChart.
 */

export type ChartSeries = {
  label: string;
  color: string;
  values: Array<number | null>;
};

const H = 240;
const PAD = { top: 14, right: 14, bottom: 28, left: 44 };

export function SeoTrendChart({
  days,
  series,
  markers = [],
  stacked = false,
  invert = false,
  ariaLabel,
  width: W = 1000,
  grain = "toggle",
}: {
  days: string[];
  series: ChartSeries[];
  markers?: Array<{ day: string; label: string }>;
  stacked?: boolean;
  /** Position: 1 at the top. */
  invert?: boolean;
  ariaLabel: string;
  /** viewBox width: narrower for half-width cards so labels keep their size. */
  width?: number;
  /** "fixed" hides the daily / weekly toggle (points are already weeks). */
  grain?: "toggle" | "fixed";
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
  const max = invert ? Math.max(10, ...nonNull) : Math.max(1, ...tops);
  const min = invert ? 1 : 0;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (n - 1)) * innerW;
  const y = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return invert ? PAD.top + t * innerH : PAD.top + innerH - t * innerH;
  };
  const ticks = niceTicks(min, max);
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  const shapes = buildShapes(view.series, stacked, x, y);
  const markerIdx = markers
    .map((m) => ({ ...m, i: indexOf(view.days, m.day) }))
    .filter((m): m is typeof m & { i: number } => m.i !== null);
  const active = hover;

  return (
    <div className="relative mt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-3 text-xs">
          {view.series.map((s) => (
            <li
              key={s.label}
              className="text-ui-text-muted flex items-center gap-1.5"
            >
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
        <div
          className="flex gap-1 text-xs"
          role="group"
          aria-label="Chart grain"
        >
          {grain === "toggle" &&
            (["Daily", "Weekly"] as const).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={(g === "Weekly") === weekly}
                onClick={() => setWeekly(g === "Weekly")}
                className={`rounded-ui border px-2 py-0.5 ${(g === "Weekly") === weekly ? "border-ui-accent text-ui-accent" : "border-ui-line text-ui-text-muted"}`}
              >
                {g}
              </button>
            ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-60 w-full"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD.left) / innerW) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
      >
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
              {compact(tick)}
            </text>
          </g>
        ))}
        {markerIdx.map((m) => (
          <g key={`${m.day}-${m.label}`}>
            <line
              x1={x(m.i)}
              x2={x(m.i)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--ui-warn)"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${m.day}: ${m.label}`}</title>
            </line>
          </g>
        ))}
        {shapes.map(({ s, line, area }) => (
          <g key={s.label}>
            {area ? <path d={area} fill={s.color} fillOpacity={0.18} /> : null}
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
        {view.days.map((day, i) =>
          i % labelEvery === 0 ? (
            <text
              key={day}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ui-text-subtle)"
            >
              {formatDay(day)}
            </text>
          ) : null,
        )}
        {active !== null ? (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="var(--ui-line-strong)"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {active !== null ? (
        <div
          className="rounded-ui border-ui-line bg-ui-surface shadow-ui pointer-events-none absolute top-8 border px-3 py-2 text-xs"
          style={{
            left: `${(x(active) / W) * 100}%`,
            transform:
              active > n / 2
                ? "translateX(calc(-100% - 12px))"
                : "translateX(12px)",
          }}
        >
          <p className="text-ui-text font-semibold">
            {weekly || grain === "fixed" ? "Week of " : ""}
            {formatDay(view.days[active], true)}
          </p>
          {view.series.map((s) => (
            <p key={s.label} className="text-ui-text-muted tabular-nums">
              {s.label}:{" "}
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

function compact(v: number): string {
  return v >= 1000
    ? `${Math.round(v / 100) / 10}k`
    : String(Math.round(v * 10) / 10);
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
