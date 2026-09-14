import {
  AdminBar,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import {
  DAILY_CAPACITY_GOAL,
  DAILY_NEW_CALL_GOAL,
  type BookedMetricResult,
} from "@/lib/services/booked-metrics";
import type { BookedPace } from "@/lib/services/booked-metrics-data";

/**
 * The daily booked-call pace.
 *
 * Every number carries its definition, because "booked today" had seven
 * defensible answers and the wrong one nearly went to the marketing lead. The
 * definition rides in the `Counts` column and the `title` tooltip, not in
 * paragraphs — the table is the artifact people read.
 */

const DASH = (
  <span className="text-ui-text-subtle" title="Not observed">
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
          All correct, all different. Only the highlighted row is the pace goal.
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
                        Not in this database
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
      `${coverage.unreviewed} held out as unclassified (${coverage.unreviewedNames.join(", ")})`,
    );
  }
  if (coverage.laneTwoExcluded > 0) {
    parts.push(`${coverage.laneTwoExcluded} Lane 2 removed`);
  }
  if (coverage.noCloseMatch > 0) {
    parts.push(
      `${coverage.noCloseMatch} with no Close lead, so channel unknown`,
    );
  }
  if (coverage.undatable > 0) {
    parts.push(
      `${coverage.undatable} undatable across the whole window, in no daily number`,
    );
  }
  if (parts.length === 0) return null;
  return (
    <p className="text-ui-text-muted border-ui-line border-t px-4 py-2.5 text-xs">
      New calls booked: {parts.join(" · ")}.
    </p>
  );
}

/** Where the day's new calls came from, ranked. */
export function BookedAttribution({ pace }: { pace: BookedPace }) {
  const max = Math.max(1, ...pace.attribution.map((row) => row.booked));
  return (
    <section className={adminPanelClass} aria-label="New calls by channel">
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>New calls booked, by channel</h2>
        <p className="text-ui-text-subtle text-xs">
          Close lead by email first, then UTM. Outbound never carries a UTM.
        </p>
      </div>
      {pace.attribution.length === 0 ? (
        <p className="text-ui-text-muted px-4 py-3 text-[0.8125rem]">
          No new calls booked yet on {dayLabel(pace.day)}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="bg-ui-canvas text-ui-text-subtle text-left text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
                <th className="px-4 py-2.5 font-semibold">Channel</th>
                <th className="px-3 py-2.5 text-right font-semibold">Booked</th>
                <th className="w-[38%] px-3 py-2.5 font-semibold">Share</th>
                <th className="px-3 py-2.5 font-semibold">Resolved by</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {pace.attribution.map((row) => (
                <tr key={row.label}>
                  <td className="text-ui-text px-4 py-2.5">{row.label}</td>
                  <td className="text-ui-text px-3 py-2.5 text-right font-semibold tabular-nums">
                    {row.booked}
                  </td>
                  <td className="px-3 py-2.5">
                    <AdminBar share={row.booked / max} />
                  </td>
                  <td className="px-3 py-2.5">
                    <AdminStatusBadge
                      status={row.via}
                      tone={
                        row.via === "close-funnel"
                          ? "ok"
                          : row.via === "utm"
                            ? "warn"
                            : "idle"
                      }
                      label={
                        row.via === "close-funnel"
                          ? "Close funnel"
                          : row.via === "utm"
                            ? "UTM only"
                            : "Unattributed"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** What is already on the calendar, looking ahead. */
export function BookedForward({ pace }: { pace: BookedPace }) {
  const max = Math.max(
    DAILY_CAPACITY_GOAL,
    ...pace.forward.map((row) => row.allMeetings ?? 0),
  );
  return (
    <section className={adminPanelClass} aria-label="Calendar, looking ahead">
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>Already on the calendar</h2>
        <p className="text-ui-text-subtle text-xs">
          Lands-on basis. Goal of {DAILY_CAPACITY_GOAL} a day is the capacity
          dashboard&rsquo;s, and is a weak yardstick for days whose booking
          window has barely opened.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="bg-ui-canvas text-ui-text-subtle text-left text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
              <th className="px-4 py-2.5 font-semibold">Day</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                First calls
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                All meetings
              </th>
              <th className="w-[34%] px-3 py-2.5 font-semibold">Fill</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                vs {DAILY_CAPACITY_GOAL}
              </th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {pace.forward.map((row) => {
              const gap =
                row.firstCalls == null
                  ? null
                  : row.firstCalls - DAILY_CAPACITY_GOAL;
              return (
                <tr
                  key={row.day}
                  className={row.day === pace.day ? "bg-ui-canvas" : undefined}
                >
                  <td className="text-ui-text px-4 py-2.5 whitespace-nowrap">
                    {dayLabel(row.day)}
                    {row.day === pace.day ? (
                      <span className="text-ui-text-subtle"> · today</span>
                    ) : null}
                  </td>
                  <td className="text-ui-text px-3 py-2.5 text-right font-semibold tabular-nums">
                    {num(row.firstCalls)}
                  </td>
                  <td className="text-ui-text-muted px-3 py-2.5 text-right tabular-nums">
                    {num(row.allMeetings)}
                  </td>
                  <td className="px-3 py-2.5">
                    <AdminBar share={(row.firstCalls ?? 0) / max} />
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-medium tabular-nums ${
                      gap == null
                        ? ""
                        : gap >= 0
                          ? "text-ui-ok"
                          : gap >= -15
                            ? "text-ui-warn"
                            : "text-ui-bad"
                    }`}
                  >
                    {gap == null ? DASH : gap >= 0 ? `+${gap}` : gap}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-ui-text-muted border-ui-line border-t px-4 py-2.5 text-xs">
        Open slots are not available — no Calendly credentials in this
        environment. Demand against goal, not against capacity.
      </p>
    </section>
  );
}

/** How much of the classification a human has actually signed off. */
export function BookedMappingReview({ pace }: { pace: BookedPace }) {
  const { review } = pace;
  if (review.draft === 0) return null;
  return (
    <section
      className={adminPanelClass}
      aria-label="Event-type mapping review status"
    >
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>
          Calendar classification is a draft
        </h2>
        <AdminStatusBadge
          status="draft"
          tone="warn"
          label={`${review.reviewed} of ${review.total} signed off`}
        />
      </div>
      {review.needsDecision.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="bg-ui-canvas text-ui-text-subtle text-left text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
                <th className="px-4 py-2.5 font-semibold">
                  Calendar needing a ruling
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">Booked</th>
                <th className="px-3 py-2.5 font-semibold">Drafted as</th>
                <th className="px-3 py-2.5 font-semibold">Question</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {review.needsDecision.map((entry) => (
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
        </div>
      ) : null}
    </section>
  );
}
