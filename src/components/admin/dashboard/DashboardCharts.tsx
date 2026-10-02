"use client";

import { useState } from "react";

/*
 * Small SVG charts for the analytics dashboard. No chart library: the marks
 * are SVG with non-scaling strokes, every label is HTML so it never stretches,
 * and colour comes from the --ui-chart-* tokens.
 */

export type TrendSeries = { name: string; data: number[]; color: string };

/** An axis top that splits into four round steps (0, 60, 120, 180, 240). */
export function niceMax(value: number): number {
  if (value <= 0) return 4;
  const raw = value / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * power >= raw)! * power;
  return step * 4;
}

function tick(value: number): string {
  if (value >= 1000) return `${+(value / 1000).toFixed(1)}k`;
  return String(+value.toFixed(value < 10 ? 1 : 0));
}

export function ChartLegend({
  items,
}: {
  items: ReadonlyArray<{ name: string; color: string }>;
}) {
  return (
    <div className="text-ui-text-muted flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {items.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.name}
        </span>
      ))}
    </div>
  );
}

/** Daily series with a hover (or tap) readout. `labels` match each series' length. */
export function TrendChart({
  series,
  labels,
  height = 220,
}: {
  series: readonly TrendSeries[];
  labels: readonly string[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const n = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.data)));
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * (H - 8) - 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(n / 7));
  const pick = (clientX: number, rect: DOMRect) =>
    setHover(
      Math.max(
        0,
        Math.min(
          n - 1,
          Math.round(((clientX - rect.left) / rect.width) * (n - 1)),
        ),
      ),
    );

  return (
    <div className="min-w-0">
      {series.length > 1 ? (
        <div className="mb-3">
          <ChartLegend items={series} />
        </div>
      ) : null}
      <div className="flex gap-2">
        <div
          className="text-ui-text-subtle relative w-9 shrink-0 text-right text-[0.6875rem] tabular-nums"
          style={{ height }}
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: y(t) }}
            >
              {tick(t)}
            </span>
          ))}
        </div>
        <div
          className="relative min-w-0 flex-1 touch-pan-y"
          style={{ height }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) =>
            pick(e.clientX, e.currentTarget.getBoundingClientRect())
          }
          onTouchStart={(e) =>
            pick(e.touches[0]!.clientX, e.currentTarget.getBoundingClientRect())
          }
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label={series
              .map(
                (s) =>
                  `${s.name}: ${s.data.reduce((a, b) => a + b, 0).toLocaleString("en-US")} over ${n} days`,
              )
              .join("; ")}
          >
            {ticks.map((t) => (
              <line
                key={t}
                x1="0"
                x2={W}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--ui-line)"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {series.map((s, si) => (
              <polyline
                key={s.name}
                points={s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={si === 0 ? 2 : 1.75}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {hover !== null ? (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1="0"
                y2={H}
                stroke="var(--ui-line-strong)"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          {hover !== null
            ? series.map((s) => (
                <span
                  key={s.name}
                  className="border-ui-surface pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${(x(hover) / W) * 100}%`,
                    top: y(s.data[hover] ?? 0),
                    background: s.color,
                  }}
                />
              ))
            : null}
          {hover !== null ? (
            <div
              className="border-ui-line bg-ui-surface shadow-ui-raised rounded-ui-lg pointer-events-none absolute top-0 z-10 min-w-[8rem] border px-3 py-2 text-xs"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                transform: `translateX(${hover > n / 2 ? "calc(-100% - 10px)" : "10px"})`,
              }}
            >
              <div className="text-ui-text mb-1 font-medium tabular-nums">
                {labels[hover]}
              </div>
              {series.map((s) => (
                <div
                  key={s.name}
                  className="text-ui-text-muted flex items-center justify-between gap-3"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: s.color }}
                    />
                    {s.name}
                  </span>
                  <span className="text-ui-text font-medium tabular-nums">
                    {(s.data[hover] ?? 0).toLocaleString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="text-ui-text-subtle relative mt-2 ml-11 h-4 text-[0.6875rem]"
        aria-hidden="true"
      >
        {labels.map((label, i) => {
          const last = i === n - 1;
          if (!last && (i % every !== 0 || n - 1 - i <= Math.max(1, every / 2)))
            return null;
          return (
            <span
              key={label}
              className={`absolute top-0 whitespace-nowrap ${(i / every) % 2 === 1 && !last ? "hidden sm:inline" : ""}`}
              style={{
                left: `${(x(i) / W) * 100}%`,
                transform:
                  i === 0
                    ? "none"
                    : last
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A trend line with its last point marked. Decoration: the number beside it carries the value. */
export function Sparkline({
  data,
  color = "var(--ui-chart-1)",
}: {
  data: readonly number[];
  color?: string;
}) {
  if (data.length < 2) return <div className="h-8" aria-hidden="true" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map(
    (v, i) =>
      [
        (i / (data.length - 1)) * 100,
        4 + ((max - v) / (max - min || 1)) * 24,
      ] as const,
  );
  const [lx, ly] = pts[pts.length - 1]!;
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-8 w-full overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={pts.map(([px, py]) => `${px},${py}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={lx}
        cy={ly}
        r="2.5"
        fill={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
