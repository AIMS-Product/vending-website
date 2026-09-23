import Link from "next/link";
import {
  AdminBar,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  AdminStatusDot,
  adminCardClass,
  adminEyebrowClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  ON_PACE_TOLERANCE_PCT,
  type Pace,
  type PaceStatus,
} from "@/lib/services/goal-pace";
import type { GoalReport, GoalRow } from "@/lib/services/goal-report";
import {
  BASELINE_MONTH,
  MONTHLY_GROWTH,
  OTHER_TARGETS_IN_CIRCULATION,
} from "@/lib/services/channel-targets";

/**
 * Target, pace and actual for one period. Pace is the point: "ahead or behind,
 * by how much" sits in the headline and on every row, computed once in
 * goal-pace.ts so the two never disagree. A dash is "not observed" and a row
 * with no target says so in words rather than printing a zero.
 */

const DASH = (
  <span className="text-ui-text-subtle" title="No data">
    —
  </span>
);

function num(value: number | null, digits = 0): React.ReactNode {
  if (value == null) return DASH;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function signed(value: number | null): string {
  if (value == null) return "—";
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

const STATUS_TONE: Record<PaceStatus, "ok" | "warn" | "bad" | "idle"> = {
  ahead: "ok",
  "on pace": "ok",
  behind: "bad",
  "not started": "idle",
  "no target": "idle",
  "not measured": "idle",
};

function PaceLabel({ pace }: { pace: Pace }) {
  const detail =
    pace.status === "ahead" || pace.status === "behind"
      ? `${signed(pace.variance)} calls${pace.variancePct == null ? "" : `, ${signed(pace.variancePct)}%`}`
      : pace.status === "on pace"
        ? `${signed(pace.variance)} calls`
        : null;
  const word = pace.status.charAt(0).toUpperCase() + pace.status.slice(1);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <AdminStatusBadge
        status={pace.status}
        tone={STATUS_TONE[pace.status]}
        label={word}
      />
      {detail ? (
        <span className="text-ui-text-muted tabular-nums">{detail}</span>
      ) : null}
    </span>
  );
}

export function GoalHeadline({ report }: { report: GoalReport }) {
  const { pace } = report.total;
  const elapsedPct = Math.round(pace.elapsedShare * 100);
  return (
    <AdminMetricStrip>
      <AdminMetricPanel
        label="Target"
        value={pace.target == null ? "—" : pace.target.toLocaleString()}
        caption={
          pace.target == null
            ? "no target set for this period"
            : `booked calls, ${report.periodLabel}`
        }
      />
      <AdminMetricPanel
        label="Expected by today"
        value={
          pace.expected == null
            ? "—"
            : Math.round(pace.expected).toLocaleString()
        }
        caption={`${elapsedPct}% of the period has passed`}
      />
      <AdminMetricPanel
        label="Booked so far"
        value={pace.actual == null ? "—" : pace.actual.toLocaleString()}
        caption={
          report.total.week == null
            ? "not observed"
            : `${report.total.week.booked.toLocaleString()} so far this week`
        }
      />
      <AdminMetricPanel
        label="Ahead or behind"
        value={
          pace.status === "ahead" ||
          pace.status === "behind" ||
          pace.status === "on pace"
            ? `${signed(pace.variance)}`
            : "—"
        }
        caption={
          pace.projected == null
            ? pace.status
            : `${pace.status}, on track for ${pace.projected.toLocaleString()}`
        }
        delta={<AdminStatusDot tone={STATUS_TONE[pace.status]} />}
      />
    </AdminMetricStrip>
  );
}

export function GoalTable({ report }: { report: GoalReport }) {
  const rows = [...report.rows, report.other];
  const maxTarget = Math.max(
    1,
    ...rows.map((row) => Math.max(row.pace.target ?? 0, row.pace.actual ?? 0)),
  );
  return (
    <section className={adminPanelClass} aria-label="Channels against target">
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>Channels against target</h2>
        <p className="text-ui-text-subtle text-xs">
          Whether each channel is on track for its booked-call target. Weeks run
          Friday to Thursday. Lane 2 (sales reactivation) and Marketing
          Reactivation count workdays only.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="bg-ui-canvas text-ui-text-subtle text-left text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
              <th className="px-4 py-2.5 font-semibold">Channel</th>
              <th className="px-3 py-2.5 text-right font-semibold">Target</th>
              <th className="px-3 py-2.5 text-right font-semibold">By today</th>
              <th className="px-3 py-2.5 text-right font-semibold">Booked</th>
              <th className="px-3 py-2.5 font-semibold">Ahead or behind</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Weekly target
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                This week
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Need per week
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Projected
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Outcome logged
              </th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {rows.map((row) => (
              <GoalTableRow key={row.key} row={row} maxTarget={maxTarget} />
            ))}
            <GoalTableRow row={report.total} maxTarget={maxTarget} total />
          </tbody>
        </table>
      </div>
      <p className="text-ui-text-subtle border-ui-line border-t px-4 py-3 text-xs">
        By today: the target times the share of the period that has passed. On
        pace means within {ON_PACE_TOLERANCE_PCT}% of that. Need per week:
        booked calls a week needed from today to still hit the target.
        Projected: where the period ends if the current rate holds. Outcome
        logged: share of booked calls with a show or no-show logged in Close.
      </p>
      <p className="text-ui-text-muted border-ui-line border-t px-4 py-3 text-xs">
        The total is the channels the plan sets a number for, so it counts the
        same calls the target does.{" "}
        {report.allBooked == null ? null : (
          <>
            Every booked call in this period, plan channels and all, comes to{" "}
            <span className="text-ui-text font-semibold tabular-nums">
              {report.allBooked.toLocaleString()}
            </span>
            .{" "}
          </>
        )}
        {report.untracked > 0 ? (
          <>
            <span className="text-ui-text font-semibold tabular-nums">
              {report.untracked.toLocaleString()}
            </span>{" "}
            of {report.untracked === 1 ? "those belongs" : "those belong"} to a
            lead with no funnel in Close and{" "}
            {report.untracked === 1 ? "is" : "are"} in no channel row.
          </>
        ) : null}
      </p>
    </section>
  );
}

function GoalTableRow({
  row,
  maxTarget,
  total = false,
}: {
  row: GoalRow;
  maxTarget: number;
  total?: boolean;
}) {
  const { pace } = row;
  const weight = total ? "font-semibold" : "";
  return (
    <tr className={total ? "bg-ui-canvas" : "hover:bg-ui-canvas"}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {total ? null : <ChannelLogo label={row.label} />}
          <div className="min-w-0">
            <div className={`text-ui-text truncate ${weight}`}>{row.label}</div>
            {row.note ? (
              <div className="text-ui-text-subtle max-w-xs text-xs leading-snug">
                {row.note}
              </div>
            ) : (
              <div className="mt-1 w-32">
                <AdminBar share={(pace.actual ?? 0) / Math.max(maxTarget, 1)} />
              </div>
            )}
          </div>
        </div>
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${weight}`}>
        {num(pace.target)}
      </td>
      <td className="text-ui-text-muted px-3 py-2.5 text-right tabular-nums">
        {pace.expected == null ? DASH : num(Math.round(pace.expected))}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${weight}`}>
        {num(pace.actual)}
      </td>
      <td className="px-3 py-2.5">
        <PaceLabel pace={pace} />
      </td>
      <td className="text-ui-text-muted px-3 py-2.5 text-right tabular-nums">
        {num(pace.weeklyTarget)}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {row.week == null ? DASH : num(row.week.booked)}
      </td>
      <td className="text-ui-text-muted px-3 py-2.5 text-right tabular-nums">
        {num(pace.neededPerWeek)}
      </td>
      <td className="text-ui-text-muted px-3 py-2.5 text-right tabular-nums">
        {num(pace.projected)}
      </td>
      <td className="text-ui-text-muted px-3 py-2.5 text-right tabular-nums">
        <Logged logged={row.outcomeLogged} />
      </td>
    </tr>
  );
}

function Logged({
  logged,
}: {
  logged: { known: number; total: number } | null;
}) {
  if (!logged || logged.total === 0) return DASH;
  const pct = Math.round((logged.known / logged.total) * 100);
  return (
    <span
      title={`${logged.known} of ${logged.total} booked calls have a show or no-show logged in Close`}
    >
      {pct}%
    </span>
  );
}

export function GoalBasis({ report }: { report: GoalReport }) {
  const lane2 = report.rows.find((row) => row.key === "lane-2");
  const setter = lane2?.setterNamed;
  const setterPct =
    setter && setter.total > 0
      ? Math.round((setter.known / setter.total) * 100)
      : null;
  const outcome = report.total.outcomeLogged;
  const outcomePct =
    outcome && outcome.total > 0
      ? Math.round((outcome.known / outcome.total) * 100)
      : null;
  return (
    <section
      className={adminCardClass}
      aria-label="How these numbers are counted"
    >
      <h2 className={adminEyebrowClass}>How these numbers are counted</h2>
      <dl className="text-ui-text-muted mt-3 grid gap-3 text-[0.8125rem] sm:grid-cols-2">
        <div>
          <dt className="text-ui-text font-medium">Booked call</dt>
          <dd>{report.basis}</dd>
        </div>
        <div>
          <dt className="text-ui-text font-medium">The plan</dt>
          <dd>
            Every priority channel grows{" "}
            {Math.round((MONTHLY_GROWTH - 1) * 100)}% a month, compounding, as
            the Q4 Growth Plan tab sets out. Each channel counts up from what it
            actually booked in {monthName(BASELINE_MONTH)}, so October, November
            and December are three different numbers and a quarter is the sum of
            its months. Marketing Reactivation is fixed at 44 a month rather
            than grown, because {monthName(BASELINE_MONTH)} booked none.
          </dd>
        </div>
        <div>
          <dt className="text-ui-text font-medium">Freshness</dt>
          <dd>
            {report.updatedAt
              ? `Copied from Close, last updated ${new Date(report.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Updates every hour.`
              : "Our copy of Close has not finished its first update yet."}
          </dd>
        </div>
        <div>
          <dt className="text-ui-text font-medium">Show rate</dt>
          <dd>
            {outcomePct == null
              ? "No booked calls in this period yet."
              : `${outcomePct}% of this period's booked calls have a show or no-show logged in Close. A show rate would be a guess about the rest, so none is shown here.`}
          </dd>
        </div>
        <div>
          <dt className="text-ui-text font-medium">
            Lane 2 (sales reactivation) credit
          </dt>
          <dd>
            {setterPct == null
              ? "No Lane 2 calls in this period yet."
              : `${setterPct}% of Lane 2 calls name a setter in Close. Per-setter credit, including calls Calendly shows a rep booked, is on `}
            {setterPct == null ? null : (
              <Link
                href="/admin/bookings"
                className="text-ui-accent underline-offset-2 hover:underline"
              >
                Bookings
              </Link>
            )}
            {setterPct == null ? null : "."}
          </dd>
        </div>
      </dl>
      <div className="border-ui-line mt-4 border-t pt-4">
        <h3 className="text-ui-text text-[0.8125rem] font-medium">
          Other targets you may have seen
        </h3>
        <p className="text-ui-text-subtle mt-1 text-xs">
          None of these is what this page counts against. They are named so a
          number quoted from somewhere else can be placed rather than argued
          with.
        </p>
        <dl className="text-ui-text-muted mt-3 grid gap-3 text-[0.8125rem]">
          {OTHER_TARGETS_IN_CIRCULATION.map((entry) => (
            <div key={entry.label}>
              <dt className="text-ui-text font-medium">
                {entry.label}{" "}
                <span className="text-ui-text-subtle font-normal">
                  — {entry.value}
                </span>
              </dt>
              <dd>{entry.why}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** "August 2026" from "2026-08". */
function monthName(month: string): string {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
