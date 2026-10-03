"use client";

import { useState } from "react";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import { cn } from "@/lib/utils";
import {
  FLOW_STAGES,
  stageRate,
  type ChannelFlow,
  type FlowChannelKey,
} from "@/lib/analytics/channel-flow";

/*
 * Every channel as a band from Captured to Won. Inside a stage the bands are
 * to scale; between stages the column height steps down on a log scale, so
 * forty wins stay visible beside four thousand captures. Hover, focus or tap
 * a channel to follow it alone; tap again to let go.
 */

export const FLOW_COLORS: Record<FlowChannelKey, string> = {
  webinar: "var(--ui-chart-1)",
  youtube: "var(--ui-chart-2)",
  instagram: "var(--ui-chart-3)",
  website: "var(--ui-chart-4)",
  "google-ads": "var(--ui-chart-5)",
  "meta-ads": "var(--ui-chart-6)",
  email: "var(--ui-chart-7)",
  social: "var(--ui-chart-8)",
  reactivation: "var(--ui-chart-9)",
  other: "var(--ui-chart-10)",
};

const W = 1000;
const MIN_H = 280;
const NODE = 7;
const GAP = 6;
const LABEL_GAP = 36;
/** Tall enough that every band's two-line label fits beside it. */
const heightFor = (bands: number) => Math.max(MIN_H, bands * LABEL_GAP + 16);
const COLS = FLOW_STAGES.length;

const RATE_WORDS = [
  "booked ÷ captured",
  "showed, of booked",
  "qualified, of booked",
  "won, of booked",
];

const num = (n: number) => n.toLocaleString("en-US");
const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const pct = (n: number | null) => (n === null ? "–" : `${n.toFixed(1)}%`);
const colX = (c: number) => (c / (COLS - 1)) * (W - NODE);

type Seg = [top: number, bottom: number];

/**
 * Columns hang from the top so the flow reads as one block and the log step
 * shows as the column shortening. A band only earns the full gap when it is
 * tall enough to need separating; a sliver sits almost flush with the next.
 */
function layout(flow: ChannelFlow, H: number): Seg[][] {
  const maxLog = Math.log10(Math.max(...flow.totals) + 1);
  const inner = H - GAP * (flow.bands.length - 1);
  return flow.totals.map((total, c) => {
    const colH = maxLog > 0 ? inner * (Math.log10(total + 1) / maxLog) : 0;
    let y = 0;
    return flow.bands.map((b) => {
      const v = b.values[c]!;
      const h = v > 0 ? Math.max(2, (colH * v) / Math.max(total, 1)) : 0;
      const seg: Seg = [y, y + h];
      if (h > 0) y += h + (h < 8 ? 1.5 : GAP);
      return seg;
    });
  });
}

/** Left labels sit at their band's first visible segment, nudged apart. */
function labelYs(segs: Seg[][], count: number, H: number): number[] {
  const ys = Array.from({ length: count }, (_, i) => {
    const first = segs.find((col) => col[i]![1] > col[i]![0]) ?? segs[0]!;
    return (first[i]![0] + first[i]![1]) / 2;
  });
  ys[0] = Math.max(ys[0]!, 16);
  for (let i = 1; i < ys.length; i++)
    ys[i] = Math.max(ys[i]!, ys[i - 1]! + LABEL_GAP);
  for (let i = ys.length - 1; i >= 0; i--) {
    ys[i] = Math.min(ys[i]!, H - 12 - (ys.length - 1 - i) * LABEL_GAP);
  }
  return ys;
}

function ribbon(segs: Seg[][], c: number, i: number): string {
  const [a0, b0] = segs[c]![i]!;
  const [a1, b1] = segs[c + 1]![i]!;
  const x0 = colX(c) + NODE;
  const x1 = colX(c + 1);
  const xm = (x0 + x1) / 2;
  return `M${x0},${a0} C${xm},${a0} ${xm},${a1} ${x1},${a1} L${x1},${b1} C${xm},${b1} ${xm},${b0} ${x0},${b0} Z`;
}

export function ChannelFlowChart({ flow }: { flow: ChannelFlow }) {
  const [hovered, setHovered] = useState<FlowChannelKey | null>(null);
  const [pinned, setPinned] = useState<FlowChannelKey | null>(null);
  const focus = hovered ?? pinned;
  const band = flow.bands.find((b) => b.key === focus) ?? null;
  const vals = band ? band.values : flow.totals;
  const revenue = band ? band.revenue : flow.revenue;
  const H = heightFor(flow.bands.length);
  const segs = layout(flow, H);
  const ys = labelYs(segs, flow.bands.length, H);
  const toggle = (key: FlowChannelKey) =>
    setPinned((p) => (p === key ? null : key));
  const bind = (key: FlowChannelKey) => ({
    onMouseEnter: () => setHovered(key),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(key),
    onBlur: () => setHovered(null),
    onClick: () => toggle(key),
  });

  return (
    <div>
      <div className="flex gap-3 sm:gap-5">
        <div className="w-7 shrink-0 sm:w-40">
          <div className="h-14 sm:h-12" />
          <div className="relative" style={{ height: H }}>
            {flow.bands.map((b, i) => (
              <button
                key={b.key}
                type="button"
                aria-pressed={pinned === b.key}
                aria-label={`${b.label}: ${num(b.values[0])} captured, ${num(b.values[1])} booked, ${num(b.values[4])} won`}
                {...bind(b.key)}
                className={cn(
                  "hover:bg-ui-canvas rounded-ui absolute inset-x-0 flex -translate-y-1/2 items-start gap-2 py-1 text-left transition-opacity sm:-mx-2 sm:px-2",
                  focus && focus !== b.key && "opacity-40",
                )}
                style={{ top: ys[i] }}
              >
                <span className="mt-0.5 shrink-0">
                  <ChannelLogo label={b.label} />
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="text-ui-text block truncate text-[0.8125rem] leading-tight font-medium">
                    {b.label}
                  </span>
                  <span className="text-ui-text-subtle block text-xs leading-snug whitespace-nowrap tabular-nums">
                    {b.values[0] > 0
                      ? `${num(b.values[0])} captured`
                      : `${num(b.values[1])} booked`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="relative h-14 sm:h-12">
            {FLOW_STAGES.map((stage, c) => (
              <div
                key={stage}
                className={cn(
                  "absolute top-0 flex flex-col",
                  c === 0
                    ? "items-start"
                    : c === COLS - 1
                      ? "-translate-x-full items-end"
                      : "-translate-x-1/2 items-center",
                )}
                style={{ left: `${(colX(c) / W) * 100}%` }}
              >
                <span className="text-ui-text text-sm font-semibold tabular-nums sm:text-lg">
                  {num(vals[c]!)}
                </span>
                <span className="text-ui-text-subtle hidden text-xs whitespace-nowrap sm:block">
                  {stage}
                </span>
              </div>
            ))}
          </div>
          <div
            className="relative"
            style={{ height: H }}
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label={FLOW_STAGES.map(
                (s, c) => `${num(flow.totals[c]!)} ${s.toLowerCase()}`,
              ).join(", ")}
            >
              {flow.bands.map((b, i) =>
                Array.from({ length: COLS - 1 }, (_, c) => (
                  <path
                    key={`${b.key}${c}`}
                    d={ribbon(segs, c, i)}
                    fill={FLOW_COLORS[b.key]}
                    className="cursor-pointer transition-opacity duration-200 motion-reduce:transition-none"
                    opacity={focus ? (focus === b.key ? 0.85 : 0.08) : 0.45}
                    onMouseEnter={() => setHovered(b.key)}
                    onClick={() => toggle(b.key)}
                  />
                )),
              )}
              {segs.map((col, c) =>
                col.map(([a, z], i) =>
                  z > a ? (
                    <rect
                      key={`${c}-${i}`}
                      x={colX(c)}
                      y={a}
                      width={NODE}
                      height={z - a}
                      rx={1.5}
                      fill={FLOW_COLORS[flow.bands[i]!.key]}
                      opacity={focus && focus !== flow.bands[i]!.key ? 0.2 : 1}
                    />
                  ) : null,
                ),
              )}
            </svg>
            {segs.slice(1).map((col, c1) =>
              col.map(([a, z], i) => {
                const c = c1 + 1;
                const b = flow.bands[i]!;
                if (
                  !(focus ? focus === b.key : z - a >= 18) ||
                  b.values[c] === 0
                )
                  return null;
                return (
                  <span
                    key={`${c}-${i}`}
                    className={cn(
                      "bg-ui-surface/90 text-ui-text pointer-events-none absolute hidden -translate-y-1/2 rounded px-1 text-[0.6875rem] font-medium tabular-nums sm:block",
                      c === COLS - 1 && "-translate-x-full",
                    )}
                    style={{
                      top: (a + z) / 2,
                      left:
                        c === COLS - 1
                          ? `calc(${(colX(c) / W) * 100}% - 4px)`
                          : `calc(${((colX(c) + NODE) / W) * 100}% + 4px)`,
                    }}
                  >
                    {num(b.values[c]!)}
                  </span>
                );
              }),
            )}
          </div>
          <div className="relative mt-3 h-9">
            {RATE_WORDS.map((word, c) => (
              <div
                key={word}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap"
                style={{
                  left: `${((colX(c) + colX(c + 1) + NODE) / 2 / W) * 100}%`,
                }}
              >
                <span className="text-ui-accent text-xs font-medium tabular-nums">
                  {pct(stageRate(vals[c + 1]!, vals[c === 0 ? 0 : 1]!))}
                </span>
                <span className="text-ui-text-subtle hidden text-[0.6875rem] sm:block">
                  {word}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-ui-line hidden w-80 shrink-0 flex-col border-l pl-5 lg:flex">
          <p className="text-ui-text-subtle text-xs">
            {band
              ? `Won to date, ${band.label}`
              : "Won to date from these calls"}
          </p>
          <p className="text-ui-text mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {money(revenue)}
          </p>
          <p className="text-ui-text-subtle mt-0.5 text-xs tabular-nums">
            {num(vals[COLS - 1]!)} won
            {vals[COLS - 1]! > 0
              ? `, ${money(Math.round(revenue / vals[COLS - 1]!))} average`
              : ""}
          </p>
          <ChannelTotals flow={flow} focus={focus} bind={bind} />
          <p className="text-ui-text-subtle mt-auto pt-4 text-xs">
            Hover or tap a channel to follow it through.
          </p>
        </aside>
      </div>

      <p className="text-ui-text-subtle mt-1 text-[0.6875rem] sm:hidden">
        {FLOW_STAGES.join(" → ")}
      </p>
      <div className="border-ui-line mt-4 border-t pt-3 lg:hidden">
        <p className="text-ui-text-muted text-sm tabular-nums">
          <span className="text-ui-text font-semibold">{money(revenue)}</span>{" "}
          won to date from {num(vals[COLS - 1]!)} deals
          {band ? `, ${band.label}` : ""}. Tap a channel to follow it.
        </p>
        <ChannelTotals flow={flow} focus={focus} bind={bind} />
      </div>
    </div>
  );
}

function ChannelTotals({
  flow,
  focus,
  bind,
}: {
  flow: ChannelFlow;
  focus: FlowChannelKey | null;
  bind: (key: FlowChannelKey) => Record<string, () => void>;
}) {
  return (
    <ul
      className="border-ui-line mt-4 flex flex-col gap-2 border-t pt-3"
      aria-label="Totals by channel"
    >
      <li className="text-ui-text-subtle grid grid-cols-[minmax(0,1fr)_2.5rem_2rem_3rem] gap-2 text-[0.6875rem]">
        <span>Channel</span>
        <span className="text-right">Booked</span>
        <span className="text-right">Won</span>
        <span className="text-right">Revenue</span>
      </li>
      {flow.bands.map((b) => (
        <li key={b.key}>
          <button
            type="button"
            {...bind(b.key)}
            className={cn(
              "grid w-full grid-cols-[minmax(0,1fr)_2.5rem_2rem_3rem] items-center gap-2 text-left text-[0.8125rem] transition-opacity",
              focus && focus !== b.key && "opacity-40",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ background: FLOW_COLORS[b.key] }}
                aria-hidden="true"
              />
              <ChannelLogo label={b.label} />
              <span className="text-ui-text-muted truncate">{b.label}</span>
            </span>
            <span className="text-ui-text text-right tabular-nums">
              {num(b.values[1])}
            </span>
            <span className="text-ui-text text-right tabular-nums">
              {num(b.values[4])}
            </span>
            <span className="text-ui-text text-right font-medium tabular-nums">
              {b.revenue >= 1000
                ? `$${Math.round(b.revenue / 1000)}k`
                : money(b.revenue)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
