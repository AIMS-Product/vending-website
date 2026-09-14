import {
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import {
  DAILY_CAPACITY_GOAL,
  DAILY_NEW_CALL_GOAL,
  type BookedMetricResult,
} from "@/lib/services/booked-metrics";
import type { BookedPace } from "@/lib/services/booked-metrics-data";

/**
 * The daily booked-call pace, and every neighbouring number that has ever been
 * mistaken for it.
 *
 * The rule this file exists to enforce: a number never appears without the
 * sentence that says what it counts. On 2026-09-14 "booked today" was answered
 * 24, 34, 35, 12, 2 and 37 in one session, all correct, none labelled, and the
 * wrong one nearly went to the marketing lead. So the definition is not a
 * tooltip here — it is rendered beside the value, always.
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

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The headline: new calls booked today against the 25-a-day goal. */
export function BookedPaceHeadline({ pace }: { pace: BookedPace }) {
  const { newBooked } = pace;
  const value = newBooked.value;
  const behind = value == null ? null : value - DAILY_NEW_CALL_GOAL;
  const status =
    value == null
      ? "not measured"
      : behind! >= 0
        ? "ahead"
        : behind! >= -Math.ceil(DAILY_NEW_CALL_GOAL * 0.1)
          ? "on pace"
          : "behind";

  return (
    <section className={adminCardClass} aria-label="New calls booked today">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={adminEyebrowClass}>{newBooked.metric.label}</h2>
          <p className="text-ui-text mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {num(value)}
            </span>
            <span className="text-ui-text-muted text-sm">
              of {DAILY_NEW_CALL_GOAL} goal
            </span>
          </p>
          <p className="text-ui-text-muted mt-2 max-w-prose text-[0.8125rem]">
            {newBooked.metric.definition}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AdminStatusBadge
            status={status}
            tone={
              status === "behind"
                ? "bad"
                : status === "not measured"
                  ? "idle"
                  : "ok"
            }
            label={status.charAt(0).toUpperCase() + status.slice(1)}
          />
          <span className="text-ui-text-muted text-[0.75rem] tabular-nums">
            {behind == null
              ? "Not observed"
              : `${behind >= 0 ? "+" : ""}${behind} vs goal`}
          </span>
        </div>
      </div>
      <Coverage result={newBooked} />
      <p className="text-ui-text-subtle mt-3 text-[0.75rem]">
        Counts the day {pace.day} in {pace.timeZone.replace("_", " ")}, the
        business day. A UTC day would end at 8pm Eastern and push evening
        bookings onto tomorrow.
      </p>
    </section>
  );
}

/** What the number does not cover. Never folded into the value. */
function Coverage({ result }: { result: BookedMetricResult }) {
  const { coverage } = result;
  const notes: string[] = [];
  if (coverage.unreviewed > 0) {
    notes.push(
      `${coverage.unreviewed} booking${coverage.unreviewed === 1 ? "" : "s"} held out: ${coverage.unreviewedNames.join(", ")} ${coverage.unreviewedNames.length === 1 ? "is" : "are"} not in the reviewed event-type mapping yet, so ${coverage.unreviewedNames.length === 1 ? "it is" : "they are"} counted as nothing rather than guessed as new.`,
    );
  }
  if (coverage.laneTwoExcluded > 0) {
    notes.push(
      `${coverage.laneTwoExcluded} Lane 2 booking${coverage.laneTwoExcluded === 1 ? "" : "s"} removed as outbound, not marketing demand.`,
    );
  }
  if (coverage.noCloseMatch > 0) {
    notes.push(
      `${coverage.noCloseMatch} counted but not yet matched to a Close lead, so the channel is unknown — and any Lane 2 booking among them could not be removed.`,
    );
  }
  if (coverage.undatable > 0) {
    notes.push(
      `Across the whole window read, ${coverage.undatable} booking${coverage.undatable === 1 ? " carries" : "s carry"} no Calendly timestamp, so ${coverage.undatable === 1 ? "it belongs" : "they belong"} to no day and cannot appear in any daily number.`,
    );
  }
  if (notes.length === 0) return null;
  return (
    <ul className="text-ui-text-muted mt-3 space-y-1 text-[0.75rem]">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

/**
 * Every other booked number, each with its definition. This table is the actual
 * fix: when someone quotes "34" or "35" from another screen, it can be found
 * here and named instead of argued about.
 */
export function BookedDefinitions({ pace }: { pace: BookedPace }) {
  return (
    <section
      className={adminCardClass}
      aria-label="Every other booked number, defined"
    >
      <h2 className={adminEyebrowClass}>
        The other booked numbers, and what each one counts
      </h2>
      <p className="text-ui-text-muted mt-2 max-w-prose text-[0.8125rem]">
        These all describe {dayLabel(pace.day)} and they are all correct. They
        are different numbers because they count different things. None of them
        is the pace number above.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left text-[0.8125rem]">
          <thead>
            <tr className="border-ui-line-strong text-ui-text-muted border-b">
              <th className="py-2 pr-3 font-medium">Number</th>
              <th className="py-2 pr-3 text-right font-medium">Value</th>
              <th className="py-2 pr-3 font-medium">Dated by</th>
              <th className="py-2 font-medium">What it counts</th>
            </tr>
          </thead>
          <tbody>
            {pace.context.map((result) => (
              <tr
                key={result.metric.key}
                className="border-ui-line border-b align-top last:border-0"
              >
                <td className="text-ui-text py-2 pr-3 font-medium">
                  {result.metric.label}
                </td>
                <td className="text-ui-text py-2 pr-3 text-right tabular-nums">
                  {num(result.value)}
                </td>
                <td className="text-ui-text-muted py-2 pr-3 whitespace-nowrap">
                  {result.metric.basis === "booked-on"
                    ? "when it was booked"
                    : "when it happens"}
                </td>
                <td className="text-ui-text-muted py-2">
                  {result.metric.definition}
                  {result.unavailableReason ? (
                    <span className="text-ui-text-subtle block">
                      {result.unavailableReason}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Where today's new calls came from. Close funnel first, then UTM. */
export function BookedAttribution({ pace }: { pace: BookedPace }) {
  const total = pace.attribution.reduce((sum, row) => sum + row.booked, 0);
  return (
    <section className={adminCardClass} aria-label="New calls by channel">
      <h2 className={adminEyebrowClass}>New calls booked today, by channel</h2>
      <p className="text-ui-text-muted mt-2 max-w-prose text-[0.8125rem]">
        Resolved by matching the booking&rsquo;s email to its Close lead first,
        then falling back to the UTM. Most bookings never carry a UTM because
        outbound prospects have no tagged link to click, so a missing UTM is not
        a tracking failure and the email join recovers the channel anyway.
      </p>
      {total === 0 ? (
        <p className="text-ui-text-muted mt-3 text-[0.8125rem]">
          No new calls booked yet on {dayLabel(pace.day)}.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-[0.8125rem]">
          {pace.attribution.map((row) => (
            <li key={row.label} className="flex items-baseline gap-3">
              <span className="text-ui-text w-8 shrink-0 text-right font-medium tabular-nums">
                {row.booked}
              </span>
              <span className="text-ui-text">{row.label}</span>
              <span className="text-ui-text-subtle text-[0.75rem]">
                {row.via === "close-funnel"
                  ? "Close funnel"
                  : row.via === "utm"
                    ? "UTM only"
                    : "no Close lead and no UTM"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** What is already on the calendar, looking ahead. */
export function BookedForward({ pace }: { pace: BookedPace }) {
  return (
    <section className={adminCardClass} aria-label="Calendar, looking ahead">
      <h2 className={adminEyebrowClass}>Already on the calendar</h2>
      <p className="text-ui-text-muted mt-2 max-w-prose text-[0.8125rem]">
        Calls that exist now, by the day they happen. This is a different basis
        from the pace number above, which counts the day a booking was made. The
        capacity goal of {DAILY_CAPACITY_GOAL} a day comes from the
        call-capacity dashboard.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left text-[0.8125rem]">
          <thead>
            <tr className="border-ui-line-strong text-ui-text-muted border-b">
              <th className="py-2 pr-3 font-medium">Day</th>
              <th className="py-2 pr-3 text-right font-medium">First calls</th>
              <th className="py-2 pr-3 text-right font-medium">All meetings</th>
              <th className="py-2 text-right font-medium">
                First calls vs {DAILY_CAPACITY_GOAL}
              </th>
            </tr>
          </thead>
          <tbody>
            {pace.forward.map((row) => {
              const short =
                row.firstCalls == null
                  ? null
                  : row.firstCalls - DAILY_CAPACITY_GOAL;
              return (
                <tr
                  key={row.day}
                  className="border-ui-line border-b last:border-0"
                >
                  <td className="text-ui-text py-2 pr-3 whitespace-nowrap">
                    {dayLabel(row.day)}
                    {row.day === pace.day ? (
                      <span className="text-ui-text-subtle"> (today)</span>
                    ) : null}
                  </td>
                  <td className="text-ui-text py-2 pr-3 text-right tabular-nums">
                    {num(row.firstCalls)}
                  </td>
                  <td className="text-ui-text-muted py-2 pr-3 text-right tabular-nums">
                    {num(row.allMeetings)}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${short != null && short < 0 ? "text-ui-bad" : "text-ui-text-muted"}`}
                  >
                    {short == null ? DASH : short >= 0 ? `+${short}` : short}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-ui-text-subtle mt-3 max-w-prose text-[0.75rem]">
        A flat {DAILY_CAPACITY_GOAL} is a weak yardstick for a day that is still
        days out and whose booking window has barely opened — a Friday reading
        short next Tuesday is mostly the window, not a shortfall. The honest
        version compares each day against where days normally sit at the same
        lead time; that baseline is not built yet.
      </p>
      <p className="text-ui-text-subtle mt-2 max-w-prose text-[0.75rem]">
        Open slots are not shown because no Calendly credentials exist in this
        environment, so calendar availability cannot be read. This is demand
        against goal, not demand against capacity.
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
      className={adminCardClass}
      aria-label="Event-type mapping review status"
    >
      <h2 className={adminEyebrowClass}>
        This rests on a draft classification
      </h2>
      <p className="text-ui-text-muted mt-2 max-w-prose text-[0.8125rem]">
        Which Calendly calendars count as a new sales call is a mapping checked
        into the repo, not a pattern guessed from event names.{" "}
        <strong className="text-ui-text">
          {review.reviewed} of {review.total}
        </strong>{" "}
        entries have been signed off by someone who owns the calendars. The rest
        carry a draft classification and should be confirmed before this number
        is managed against.
      </p>
      {review.needsDecision.length > 0 ? (
        <>
          <p className="text-ui-text mt-3 text-[0.8125rem] font-medium">
            These need a decision:
          </p>
          <ul className="text-ui-text-muted mt-1.5 space-y-1.5 text-[0.75rem]">
            {review.needsDecision.map((entry) => (
              <li key={entry.name}>
                <span className="text-ui-text font-medium">{entry.name}</span>{" "}
                <span className="text-ui-text-subtle">
                  ({entry.observed} booked, drafted as {entry.class})
                </span>
                <span className="block">
                  {entry.note?.replace(/^CONFIRM:\s*/, "")}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
