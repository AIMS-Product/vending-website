import type { CSSProperties } from "react";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import {
  DAILY_NEW_CALL_GOAL,
  type BookedMetricResult,
  type ChannelGrid as ChannelGridData,
} from "@/lib/services/booked-metrics";
import type { BookedPace } from "@/lib/services/booked-metrics-data";

/**
 * The daily booked-call pace.
 *
 * Every number carries its definition, because "booked today" had seven
 * defensible answers and the wrong one nearly went to the marketing lead. The
 * definition rides in the `Counts` column and under each label, never only in
 * a tooltip, which a phone never shows — the table is what people read.
 */

const DASH = (
  <span className="text-ui-text-subtle" title="No data">
    —
  </span>
);

function num(value: number | null) {
  if (value == null) return DASH;
  return value.toLocaleString("en-US");
}

/** Same as `num`, as a plain string, for props that take text not nodes. */
function numText(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("en-US");
}

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Short basis chip: does this number count when a call was booked, or when it happens. */
function BasisChip({ basis }: { basis: "booked-on" | "lands-on" }) {
  return (
    <span
      className={`rounded-ui inline-flex w-fit items-center px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap ${
        basis === "booked-on"
          ? "bg-ui-idle-fill text-ui-idle-ink"
          : "bg-ui-warn-fill text-ui-warn-ink"
      }`}
      title={
        basis === "booked-on"
          ? "Counted on the day the booking was made. This is what marketing produced that day."
          : "Counted on the day the call happens. This is who the closers are talking to that day."
      }
    >
      {basis === "booked-on" ? "Booked on" : "Lands on"}
    </span>
  );
}

/** The four numbers people actually ask for, with the pace one leading. */
export function BookedPaceStrip({ pace }: { pace: BookedPace }) {
  const value = pace.newBooked.value;
  const gap = value == null ? null : value - DAILY_NEW_CALL_GOAL;
  const byKey = new Map(pace.context.map((r) => [r.metric.key, r]));
  const all = byKey.get("allBookedOn");
  const onCalendar = byKey.get("firstCallsOnCalendar");
  const followUp = byKey.get("followUpBookedOn");

  return (
    <AdminMetricStrip>
      <AdminMetricPanel
        tone={gap != null && gap >= 0 ? "green" : "amber"}
        label="New calls booked"
        value={numText(value)}
        caption={`of ${DAILY_NEW_CALL_GOAL} goal${gap == null ? "" : `, ${gap >= 0 ? "+" : ""}${gap}`} · ${dayLabel(pace.day)}`}
      />
      <AdminMetricPanel
        tone="slate"
        label="All bookings made"
        value={numText(all?.value ?? null)}
        caption="Every type, same day"
      />
      <AdminMetricPanel
        tone="slate"
        label="Follow-ups booked"
        value={numText(followUp?.value ?? null)}
        caption="Not new demand"
      />
      <AdminMetricPanel
        tone="slate"
        label="First calls on calendar"
        value={numText(onCalendar?.value ?? null)}
        caption="Who closers see today"
      />
    </AdminMetricStrip>
  );
}

/**
 * Every booked number for the day, in one table. When someone quotes "34" from
 * another screen it is findable here and nameable, instead of argued about.
 */
export function BookedDefinitions({ pace }: { pace: BookedPace }) {
  const rows = [pace.newBooked, ...pace.context];
  return (
    <section
      className={adminPanelClass}
      aria-label="Every booked number, defined"
    >
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>
          Every booked number for {dayLabel(pace.day)}
        </h2>
        <p className="text-ui-text-subtle text-xs">
          Each counts something different, and all are correct. Only the
          highlighted line counts toward the {DAILY_NEW_CALL_GOAL}-a-day goal.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="bg-ui-canvas text-ui-text-subtle text-left text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
              <th className="px-4 py-2.5 font-semibold">Number</th>
              <th className="px-3 py-2.5 text-right font-semibold">Value</th>
              <th className="px-3 py-2.5 font-semibold">Basis</th>
              <th className="px-3 py-2.5 font-semibold">Counts</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {rows.map((row) => {
              const isPace = row.metric.key === "newBookedOn";
              return (
                <tr
                  key={row.metric.key}
                  className={isPace ? "bg-ui-ok-fill/40" : undefined}
                  title={row.metric.definition}
                >
                  <td
                    className={`px-4 py-2.5 ${isPace ? "text-ui-text font-semibold" : "text-ui-text"}`}
                  >
                    {row.metric.label}
                    <span className="text-ui-text-subtle mt-0.5 block text-xs font-normal">
                      {row.metric.definition}
                    </span>
                  </td>
                  <td className="text-ui-text px-3 py-2.5 text-right font-semibold tabular-nums">
                    {num(row.value)}
                  </td>
                  <td className="px-3 py-2.5">
                    <BasisChip basis={row.metric.basis} />
                  </td>
                  <td className="text-ui-text-muted px-3 py-2.5">
                    {row.unavailableReason ? (
                      <span title={row.unavailableReason}>
                        Not in our data. {row.unavailableReason}
                      </span>
                    ) : (
                      row.metric.includes
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-ui-text-subtle border-ui-line border-t px-4 py-2.5 text-xs">
        Booked on: counted on the day the booking was made, which is what
        marketing produced that day. Lands on: counted on the day the call
        happens, which is who the closers talk to that day.
      </p>
      <Coverage result={pace.newBooked} />
    </section>
  );
}

/** What the pace number does not cover. One line, never folded into the value. */
function Coverage({ result }: { result: BookedMetricResult }) {
  const { coverage } = result;
  const parts: string[] = [];
  if (coverage.unreviewed > 0) {
    parts.push(
      `${coverage.unreviewed} left out because nobody has sorted their calendar type yet (${coverage.unreviewedNames.join(", ")})`,
    );
  }
  if (coverage.laneTwoExcluded > 0) {
    parts.push(
      `${coverage.laneTwoExcluded} sales reactivation (Lane 2) calls removed`,
    );
  }
  if (coverage.noCloseMatch > 0) {
    parts.push(
      `${coverage.noCloseMatch} counted with no Close lead, so the channel is unknown`,
    );
  }
  if (coverage.undatable > 0) {
    parts.push(
      `${coverage.undatable} across the whole window have no booking date, so they are in no daily number`,
    );
  }
  if (parts.length === 0) return null;
  return (
    <p className="text-ui-text-muted border-ui-line border-t px-4 py-2.5 text-xs">
      New calls booked: {parts.join(" · ")}.
    </p>
  );
}

/** A cell's shade: stronger as the count nears the busiest cell in the grid. */
function heat(count: number, max: number): CSSProperties | undefined {
  if (count === 0) return undefined;
  const pct = Math.round(12 + (count / max) * 48);
  return {
    backgroundColor: `color-mix(in srgb, var(--color-ui-accent) ${pct}%, transparent)`,
  };
}

function gapClass(gap: number): string {
  if (gap >= 0) return "text-ui-ok";
  return gap >= -8 ? "text-ui-warn" : "text-ui-bad";
}

function isWeekend(day: string): boolean {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

const GRID_COPY = {
  "booked-on": {
    title: "New calls booked, by channel",
    label: "New calls booked by channel",
    blurb:
      "What marketing produced: new first calls counted on the day the person booked, whatever day the call is for. Cancellations still count, since the booking happened. Each day's total is the pace number above.",
  },
  "lands-on": {
    title: "Daily call capacity, by channel",
    label: "Daily call capacity by channel",
    blurb:
      "How full each day is: new first calls counted on the day the call happens, cancellations removed, one person once a day. Past days show what was held, future days what is booked so far.",
  },
} as const;

/**
 * A channel x day grid for one basis. Days run left to right with today
 * highlighted; the total row carries the goal colour so a bad day reads at a
 * glance, and weekends are dimmed because nobody staffs them to the goal.
 */
export function ChannelGrid({
  grid,
  today,
  siteFormsRead,
}: {
  grid: ChannelGridData | null;
  today: string;
  siteFormsRead: boolean;
}) {
  if (grid == null) {
    return (
      <section className={adminPanelClass}>
        <p className="text-ui-text-muted px-4 py-3 text-[0.8125rem]">
          The booking tables could not be read, so there is no grid to show.
        </p>
      </section>
    );
  }
  const copy = GRID_COPY[grid.basis];
  const max = Math.max(1, ...grid.channels.flatMap((row) => row.counts));
  const cell = (day: string) =>
    `px-2 py-2 text-center tabular-nums ${isWeekend(day) ? "opacity-50" : ""}`;
  const notes = [
    grid.creditedFromTags > 0
      ? `${grid.creditedFromTags} calls had no funnel in Close and are credited from the booking link's tracking tag or the person's website form.`
      : null,
    siteFormsRead
      ? null
      : "Website forms could not be read, so fewer calls than usual are credited from them.",
    grid.unreviewed > 0
      ? `${grid.unreviewed} bookings on calendars nobody has sorted as new or follow-up yet are not counted: ${grid.unreviewedNames.join(", ")}.`
      : null,
    "Marketing channels only: Lane 2 books first calls on follow-up calendars this data cannot tell apart, so it is left out. A few calls a week are booked outside the Calendly calendars this site hears from.",
  ].filter(Boolean);
  return (
    <section className={adminPanelClass} aria-label={copy.label}>
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>
          {copy.title}{" "}
          <span className="align-middle">
            <BasisChip basis={grid.basis} />
          </span>
        </h2>
        <p className="text-ui-text-subtle max-w-3xl text-xs">
          {copy.blurb} Goal: {DAILY_NEW_CALL_GOAL} a day.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="bg-ui-canvas text-ui-text-subtle text-[0.6875rem] tracking-[0.06em] uppercase">
              <th
                scope="col"
                className="bg-ui-canvas sticky left-0 px-4 py-2.5 text-left font-semibold"
              >
                Channel
              </th>
              {grid.days.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className={`min-w-[3.25rem] px-2 py-2.5 text-center font-semibold ${
                    day === today
                      ? "bg-ui-accent text-white"
                      : isWeekend(day)
                        ? "opacity-50"
                        : ""
                  }`}
                >
                  {dayLabel(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {grid.channels.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className="bg-ui-surface text-ui-text sticky left-0 px-4 py-2 text-left font-medium whitespace-nowrap"
                >
                  {row.label}
                </th>
                {row.counts.map((count, index) => (
                  <td
                    key={grid.days[index]}
                    className={`${cell(grid.days[index])} ${count ? "text-ui-text" : "text-ui-text-subtle"}`}
                    style={heat(count, max)}
                  >
                    {count || "·"}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-ui-canvas font-semibold">
              <th
                scope="row"
                className="bg-ui-canvas text-ui-text sticky left-0 px-4 py-2 text-left whitespace-nowrap"
              >
                Total vs {DAILY_NEW_CALL_GOAL}
              </th>
              {grid.totals.map((total, index) => {
                const gap = total - DAILY_NEW_CALL_GOAL;
                return (
                  <td
                    key={grid.days[index]}
                    className={`${cell(grid.days[index])} text-ui-text`}
                  >
                    {total}
                    <span
                      className={`block text-[0.6875rem] font-medium ${gapClass(gap)}`}
                    >
                      {gap >= 0 ? `+${gap}` : gap}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-ui-text-muted border-ui-line border-t px-4 py-2.5 text-xs">
        {notes.join(" ")}
      </p>
    </section>
  );
}

/** How much of the classification a human has actually signed off. */
export function BookedMappingReview({ pace }: { pace: BookedPace }) {
  const { review } = pace;
  if (review.draft === 0) return null;
  // Biggest first, capped: 20 open questions is a backlog, not a panel.
  const SHOWN = 8;
  const ranked = [...review.needsDecision].sort(
    (a, b) => b.observed - a.observed,
  );
  const shown = ranked.slice(0, SHOWN);
  const hidden = ranked.length - shown.length;
  const hiddenBookings = ranked
    .slice(SHOWN)
    .reduce((sum, entry) => sum + entry.observed, 0);
  return (
    <section
      className={adminPanelClass}
      aria-label="Event-type mapping review status"
    >
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>
          Calendar types are still a draft
        </h2>
        <AdminStatusBadge
          status="draft"
          tone="warn"
          label={`${review.reviewed} of ${review.total} signed off`}
        />
      </div>
      <p className="text-ui-text-subtle px-4 pt-3 text-xs">
        Each Calendly calendar is sorted as a new call, follow-up, reschedule or
        other type, and that decides which booked numbers it counts in.
        Calendars nobody has signed off count under their draft type.
      </p>
      {shown.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="bg-ui-canvas text-ui-text-subtle text-left text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
                <th className="px-4 py-2.5 font-semibold">
                  Calendar needing a decision
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">Booked</th>
                <th className="px-3 py-2.5 font-semibold">Drafted as</th>
                <th className="px-3 py-2.5 font-semibold">Question</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {shown.map((entry) => (
                <tr key={entry.name}>
                  <td className="text-ui-text px-4 py-2.5">{entry.name}</td>
                  <td className="text-ui-text px-3 py-2.5 text-right tabular-nums">
                    {entry.observed}
                  </td>
                  <td className="px-3 py-2.5">
                    <AdminStatusBadge
                      status={entry.class}
                      tone={entry.class === "new" ? "ok" : "idle"}
                      label={entry.class.replace("_", " ")}
                    />
                  </td>
                  <td className="text-ui-text-muted px-3 py-2.5">
                    {entry.note?.replace(/^CONFIRM:\s*/, "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-ui-text-muted border-ui-line border-t px-4 py-2.5 text-xs">
            {hidden > 0
              ? `${hidden} more ${hidden === 1 ? "calendar needs" : "calendars need"} a decision, covering ${hiddenBookings.toLocaleString()} bookings. `
              : ""}
            The &ldquo;Next Steps&rdquo; family is the big one: 987 bookings,
            95.7% Reactivation Scrapers, behaving like sales reactivation (Lane
            2) first calls rather than follow-ups. Evidence in
            .claude/specs/2026-09-14-calendly-event-type-review.md.
          </p>
        </div>
      ) : null}
    </section>
  );
}
