"use client";

import { useState } from "react";

/*
 * Small SVG charts for the analytics dashboard. No chart library: the marks
 * are SVG with non-scaling strokes, every label is HTML so it never stretches,
 * and colour comes from the --ui-chart-* tokens.
 */

export type TrendSeries = { name: string; data: number[]; color: string };

/** An axis top that splits into four round steps (0, 60, 120, 180, 240). */
function niceMax(value: number): number {
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

function ChartLegend({
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

/**
 * Daily counts as bars, one group per day, zero-based, with a hover (or tap)
 * readout. Counts are discrete days, so a bar says "this many that day" where
 * a line would invent the values between them. `labels` match each series.
 */
export function DailyBarChart({
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
  const k = series.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.data)));
  const slot = W / Math.max(n, 1);
  // A day's bars take 70% of its slot, so the gaps mark the days apart.
  const barW = (slot * 0.7) / Math.max(k, 1);
  const x = (i: number) => (i + 0.5) * slot;
  const y = (v: number) => H - (v / max) * (H - 8);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(n / 7));
  const pick = (clientX: number, rect: DOMRect) =>
    setHover(
      Math.max(
        0,
        Math.min(
          n - 1,
          Math.floor(((clientX - rect.left) / rect.width) * Math.max(n, 1)),
        ),
      ),
    );

  return (
    <div className="min-w-0">
      {k > 1 ? (
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
            {hover !== null ? (
              <rect
                x={hover * slot}
                y="0"
                width={slot}
                height={H}
                fill="var(--ui-canvas)"
              />
            ) : null}
            {ticks.map((t) => (
              <line
                key={t}
                x1="0"
                x2={W}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "var(--ui-line-strong)" : "var(--ui-line)"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {series.map((s, si) =>
              s.data.map((v, i) =>
                v > 0 ? (
                  <rect
                    key={`${s.name}${i}`}
                    x={x(i) - (barW * k) / 2 + si * barW}
                    y={y(v)}
                    width={Math.max(barW - 1, 1)}
                    height={H - y(v)}
                    fill={s.color}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                ) : null,
              ),
            )}
          </svg>
          {hover !== null ? (
            <div
              className="border-ui-line bg-ui-surface shadow-ui-raised rounded-ui-lg pointer-events-none absolute top-0 z-10 min-w-[8rem] border px-3 py-2 text-xs"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                transform: `translateX(${hover > n / 2 ? "calc(-100% - 14px)" : "14px"})`,
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
              className={`absolute top-0 -translate-x-1/2 whitespace-nowrap ${(i / every) % 2 === 1 && !last ? "hidden sm:inline" : ""}`}
              style={{ left: `${(x(i) / W) * 100}%` }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A row of small zero-based bars, the newest one in full colour. Built for
 * short series (a KPI's days, a card's months): a min-max line over five
 * points turns a $20 move into a cliff, a bar from zero shows it as $20.
 * `null` is a gap, not a zero. Decoration: the number beside it carries the
 * value, so the bars are hidden from screen readers.
 */
export function MiniBars({
  data,
  labels,
  color = "var(--ui-chart-1)",
  height = 32,
}: {
  data: ReadonlyArray<number | null>;
  /** Optional caption under each bar, e.g. month names; "" leaves one blank. */
  labels?: readonly string[];
  color?: string;
  height?: number;
}) {
  if (data.length === 0) return <div style={{ height }} aria-hidden="true" />;
  const max = Math.max(1, ...data.map((v) => v ?? 0));
  const last = data.length - 1;
  return (
    <div aria-hidden="true">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((v, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 rounded-t-[2px]"
            style={{
              height: v ? `${Math.max(4, (v / max) * 100)}%` : 0,
              background: color,
              opacity: i === last ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      {labels ? (
        <div className="text-ui-text-subtle mt-1 flex gap-[3px] text-[0.625rem] leading-none">
          {labels.map((label, i) => (
            <span
              key={i}
              className={`min-w-0 flex-1 text-center whitespace-nowrap ${i === last ? "text-ui-text-muted font-medium" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
