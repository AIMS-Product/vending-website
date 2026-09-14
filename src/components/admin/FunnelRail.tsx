"use client";

import { useMemo, useState } from "react";
import {
  adminEyebrowClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import {
  biggestLeak,
  delta,
  project,
  seedScenario,
  sensitivity,
  STAGE_KEYS,
  STEPS,
  type FunnelActuals,
  type RateKey,
  type Scenario,
  type StageKey,
} from "@/lib/services/funnel-forecast";

/**
 * The measured funnel, as a strip: visits -> leads -> booked -> showed -> won,
 * with the rate and the people lost printed on every step between them.
 *
 * This is deliberately not drawn on the canvas above. The canvas is a wiring
 * diagram and three separate paths converge on the calendar, so a rate written
 * on any one of its edges would be a share of a number that edge does not
 * carry. The rail is linear because the funnel is linear; the canvas is
 * branched because the plumbing is branched. Both are true, and neither can be
 * made to do the other's job without lying.
 *
 * Scenario values are a proposal and are labelled as one everywhere they
 * appear. Nothing here writes: the engine is pure and the state is local.
 */

const STAGE_LABELS: Record<StageKey, string> = {
  visits: "Visited",
  leads: "Lead",
  booked: "Booked a call",
  showed: "Showed",
  won: "Won",
};

type Mode = "actual" | "scenario" | "delta";

const MODES: ReadonlyArray<{ key: Mode; label: string; hint: string }> = [
  { key: "actual", label: "Actual", hint: "What the connectors observed." },
  { key: "scenario", label: "Forecast", hint: "What the assumptions imply." },
  { key: "delta", label: "Change", hint: "Forecast minus actual." },
];

export function FunnelRail({
  actuals,
  rangeLabel,
  basis,
}: {
  actuals: FunnelActuals;
  rangeLabel: string;
  /** Where these numbers come from, printed under the rail. */
  basis: string;
}) {
  const seeded = useMemo(() => seedScenario(actuals), [actuals]);
  const [scenario, setScenario] = useState<Scenario>(seeded);
  const [mode, setMode] = useState<Mode>("actual");

  const projection = useMemo(() => project(scenario), [scenario]);
  const change = useMemo(
    () => delta(actuals, projection),
    [actuals, projection],
  );
  const points = useMemo(() => sensitivity(scenario), [scenario]);
  const leak = useMemo(() => biggestLeak(actuals), [actuals]);
  const dirty = RATE_FIELDS.some(
    (field) => scenario[field.key] !== seeded[field.key],
  );

  return (
    <section className="border-ui-line bg-ui-surface shadow-ui rounded-ui-lg border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className={adminEyebrowClass}>The funnel, measured</p>
          <h3 className={adminSectionTitleClass}>
            Visit to won · {rangeLabel}
          </h3>
        </div>
        <div
          className="border-ui-line flex rounded-md border"
          role="group"
          aria-label="Which numbers to show"
        >
          {MODES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setMode(entry.key)}
              aria-pressed={mode === entry.key}
              title={entry.hint}
              className={`px-3 py-1.5 text-xs font-medium first:rounded-l-md last:rounded-r-md ${
                mode === entry.key
                  ? "bg-ui-accent/10 text-ui-accent"
                  : "text-ui-text-subtle hover:text-ui-text"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {STAGE_KEYS.map((key, index) => {
          const step = index > 0 ? STEPS[index - 1]! : null;
          return (
            <li
              key={key}
              className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-center"
            >
              {step ? (
                <StepRate
                  label={step.label}
                  actualPct={observedPct(actuals, step.from, step.to)}
                  scenarioPct={scenario[step.rate]}
                  lost={observedLost(actuals, step.from, step.to)}
                  mode={mode}
                />
              ) : null}
              <StageBox
                label={STAGE_LABELS[key]}
                actual={actuals[key]}
                scenario={projection[key]}
                change={change[key]}
                mode={mode}
              />
            </li>
          );
        })}
      </ol>

      <RevenueLine
        actual={
          actuals.won != null && actuals.revenuePerWin != null
            ? actuals.won * actuals.revenuePerWin
            : null
        }
        scenario={projection.revenue}
        change={change.revenue}
        mode={mode}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className={adminEyebrowClass}>Assumptions</p>
          <p className="text-ui-text-subtle mt-1 text-xs">
            Seeded from the range above. Changing one recomputes the forecast
            and nothing else — this never writes to Close.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {RATE_FIELDS.map((field) => (
              <RateInput
                key={field.key}
                label={field.label}
                suffix={field.suffix}
                value={scenario[field.key]}
                observed={seeded[field.key]}
                onChange={(value) =>
                  setScenario((prior) => ({ ...prior, [field.key]: value }))
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setScenario(seeded)}
            disabled={!dirty}
            className="border-ui-line text-ui-text-subtle hover:text-ui-text mt-3 rounded-md border px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Reset to actuals
          </button>
        </div>

        <div>
          <p className={adminEyebrowClass}>Where the people go</p>
          {leak ? (
            <p className="text-ui-text mt-1 text-sm">
              The biggest loss is <strong>{leak.label.toLowerCase()}</strong>:{" "}
              {Math.round(leak.lost).toLocaleString()} people got as far as{" "}
              {STAGE_LABELS[leak.from]} and no further. It is a {pct(leak.pct)}{" "}
              step.
            </p>
          ) : (
            <p className="text-ui-text-subtle mt-1 text-sm">
              No step has both of its stages observed in this range, so there is
              nothing to rank yet.
            </p>
          )}
          <p className="text-ui-text-subtle mt-3 text-xs">
            What one percentage point is worth, everything else held still:
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {points.map((point) => (
              <li
                key={point.rate}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="text-ui-text-subtle">{point.label}</span>
                <span className="text-ui-text tabular-nums">
                  +{point.wins.toFixed(1)} won ·{" "}
                  {point.revenue > 0 ? money(point.revenue) : "—"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-ui-text-subtle mt-2 text-xs">
            Arithmetic, not advice: it says where a point is worth most, not
            that the point is available.
          </p>
        </div>
      </div>

      <p className="text-ui-text-subtle border-ui-line mt-5 border-t pt-3 text-xs">
        {basis}
      </p>
    </section>
  );
}

const RATE_FIELDS: ReadonlyArray<{
  key: RateKey | "visits" | "revenuePerWin";
  label: string;
  suffix: string;
}> = [
  { key: "visits", label: "Visits", suffix: "" },
  { key: "leadPct", label: "Visit to lead", suffix: "%" },
  { key: "bookPct", label: "Lead to booked", suffix: "%" },
  { key: "showPct", label: "Booked to showed", suffix: "%" },
  { key: "winPct", label: "Showed to won", suffix: "%" },
  { key: "revenuePerWin", label: "Revenue per win", suffix: "$" },
];

function RateInput({
  label,
  suffix,
  value,
  observed,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  observed: number;
  onChange: (value: number) => void;
}) {
  const moved = value !== observed;
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="text-ui-text-subtle">{label}</span>
      <span className="flex items-center gap-2">
        {moved ? (
          <span className="text-ui-text-subtle tabular-nums line-through">
            {suffix === "%" ? pct(observed) : Math.round(observed)}
          </span>
        ) : null}
        <input
          type="number"
          value={round(value)}
          min={0}
          max={suffix === "%" ? 100 : undefined}
          step={suffix === "%" ? 0.1 : 1}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isNaN(next) || next < 0) return;
            onChange(suffix === "%" ? Math.min(next, 100) : next);
          }}
          className={`border-ui-line w-24 rounded-md border px-2 py-1 text-right tabular-nums ${
            moved ? "border-ui-accent text-ui-accent" : "text-ui-text"
          }`}
        />
      </span>
    </label>
  );
}

function StageBox({
  label,
  actual,
  scenario,
  change,
  mode,
}: {
  label: string;
  actual: number | null;
  scenario: number;
  change: number | null;
  mode: Mode;
}) {
  return (
    <div className="border-ui-line bg-ui-canvas flex-1 rounded-md border px-3 py-2.5">
      <p className="text-ui-text-subtle text-[11px] tracking-[0.06em] uppercase">
        {label}
      </p>
      <p className="text-ui-text mt-0.5 text-lg font-semibold tabular-nums">
        {mode === "actual"
          ? count(actual)
          : mode === "scenario"
            ? scenario.toFixed(1)
            : signed(change)}
      </p>
      {mode !== "actual" && actual != null ? (
        <p className="text-ui-text-subtle text-[11px] tabular-nums">
          was {count(actual)}
        </p>
      ) : null}
      {mode === "actual" && actual == null ? (
        <p className="text-ui-text-subtle text-[11px]">not observed</p>
      ) : null}
    </div>
  );
}

function StepRate({
  label,
  actualPct,
  scenarioPct,
  lost,
  mode,
}: {
  label: string;
  actualPct: number | null;
  scenarioPct: number;
  lost: number | null;
  mode: Mode;
}) {
  const showScenario = mode !== "actual";
  return (
    <div
      className="flex shrink-0 flex-col items-center px-2 py-1 lg:w-28"
      title={label}
    >
      <span className="text-ui-text text-xs font-medium tabular-nums">
        {showScenario
          ? pct(scenarioPct)
          : actualPct == null
            ? "—"
            : pct(actualPct)}
      </span>
      {!showScenario && lost != null && lost > 0 ? (
        <span className="text-ui-text-subtle text-[11px] tabular-nums">
          −{Math.round(lost).toLocaleString()} lost
        </span>
      ) : null}
      {showScenario && actualPct != null ? (
        <span className="text-ui-text-subtle text-[11px] tabular-nums">
          was {pct(actualPct)}
        </span>
      ) : null}
      <span aria-hidden className="text-ui-text-subtle text-xs leading-none">
        <span className="hidden lg:inline">→</span>
        <span className="lg:hidden">↓</span>
      </span>
    </div>
  );
}

function RevenueLine({
  actual,
  scenario,
  change,
  mode,
}: {
  actual: number | null;
  scenario: number;
  change: number | null;
  mode: Mode;
}) {
  return (
    <p className="text-ui-text-subtle mt-3 text-xs">
      Revenue:{" "}
      <span className="text-ui-text font-semibold tabular-nums">
        {mode === "actual"
          ? actual == null
            ? "not observed"
            : money(actual)
          : mode === "scenario"
            ? money(scenario)
            : change == null
              ? "—"
              : `${change >= 0 ? "+" : "−"}${money(Math.abs(change))}`}
      </span>
      {actual == null ? (
        <>
          {" "}
          — no deal value is mirrored from Close yet, so every revenue figure
          here is a forecast, never a measurement.
        </>
      ) : null}
    </p>
  );
}

/** The observed rate of a step, or null when either side was unobserved. */
function observedPct(
  actuals: FunnelActuals,
  from: StageKey,
  to: StageKey,
): number | null {
  const above = actuals[from];
  const below = actuals[to];
  if (above == null || below == null || above <= 0) return null;
  return (below / above) * 100;
}

function observedLost(
  actuals: FunnelActuals,
  from: StageKey,
  to: StageKey,
): number | null {
  const above = actuals[from];
  const below = actuals[to];
  if (above == null || below == null) return null;
  return above - below;
}

function count(value: number | null): string {
  return value == null ? "—" : value.toLocaleString();
}

function signed(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
}

function pct(value: number): string {
  return `${round(value)}%`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}
