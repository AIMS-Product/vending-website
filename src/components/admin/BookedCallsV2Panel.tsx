import {
  adminEyebrowClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { formatPacificStampShort } from "@/lib/admin/format-time";
import type { BookedBy } from "@/lib/booked-calls-v2/rules";
import type { Reason } from "@/lib/booked-calls-v2/engine";
import type { BookedCallsV2Report } from "@/lib/services/booked-calls-v2-data";

/**
 * Booked calls under Dom's shared V2 rule, beside the legacy month-to-date
 * view, not instead of it: Dom's own plan runs both for two weeks before any
 * switch. Every candidate meeting is counted, excluded or held, and the three
 * always add up to the candidates.
 */

const BUCKETS: readonly BookedBy[] = ["Marketing", "Lane 2", "Social DMs"];

const REASON_LABEL: Record<Reason, string> = {
  counted: "Counted",
  canceled: "Canceled, declined or rescheduled",
  follow_up_title: "Follow-up or reschedule title",
  unapproved_title: "Title not an approved first call",
  repeat_within_60_days: "Within 60 days of the previous meeting",
  not_sales_call: "Not a sales call (setter-only or excluded caller)",
  source_unavailable: "Held: no supported lead source",
  unlinked_reschedule: "Held: reschedule with no link to the original",
  ambiguous_simultaneous: "Held: two meetings at the same time",
  missing_timestamp: "Held: missing scheduled time",
};

const TD = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";
const TD_LEFT = "px-4 py-1.5 text-left whitespace-nowrap";

export function BookedCallsV2Panel({
  report,
}: {
  report: BookedCallsV2Report;
}) {
  if (!report.ok) {
    return (
      <section className={adminPanelClass}>
        <p className="text-ui-bad text-sm">
          Booked calls V2 could not be read, so it is not shown: {report.error}
        </p>
      </section>
    );
  }
  const { summary: s } = report;
  if (s.candidates === 0) {
    return (
      <section className={adminPanelClass}>
        <p className="text-ui-text-subtle px-4 py-4 text-sm">
          Booked calls V2: no Close meetings mirrored for this month yet. The
          meetings sync runs hourly once its tables exist.
        </p>
      </section>
    );
  }
  const origins = Object.entries(s.byOrigin).sort(
    ([, a], [, b]) => total(b) - total(a),
  );
  const reasons = (Object.entries(s.byReason) as Array<[Reason, number]>)
    .filter(([reason]) => reason !== "counted")
    .sort(([, a], [, b]) => b - a);

  return (
    <section className={adminPanelClass} aria-label="Booked calls V2">
      <div className="px-4 pt-4">
        <h2 className={adminSectionTitleClass}>
          Booked calls V2 (Dom&apos;s shared rule), month to date
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          One credit per qualifying Close meeting, dated by the day it was
          created (Pacific). A lead can earn another credit 60 days after its
          previous scheduled meeting. Booked By comes from the meeting title;
          the lead source is shown separately and never adds calls. Rule{" "}
          {report.ruleVersion}, meetings created up to{" "}
          {formatPacificStampShort(report.to)}.
        </p>
      </div>

      <dl className="divide-ui-line border-ui-line mt-3 grid grid-cols-2 divide-x border-t sm:grid-cols-4">
        {[
          ["Counted", s.counted],
          ...BUCKETS.map((b) => [b, s.byBookedBy[b]] as const),
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <dt className={adminEyebrowClass}>{label}</dt>
            <dd className="text-ui-text mt-1 text-2xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-ui-text-subtle border-ui-line border-t px-4 py-2 text-xs">
        {s.candidates} meetings created this month: {s.counted} counted,{" "}
        {s.excluded} excluded, {s.held} held for review (held are never
        counted). Of the counted: {s.unknownOrigin} with no known source,{" "}
        {s.unknownOffer} with no business line, {s.historicalExceptions} via a
        historical title exception. {s.setterDisagreements} meetings name a
        different setter in Close than their title does.
      </p>

      <div className="border-ui-line grid gap-0 border-t lg:grid-cols-2 lg:divide-x">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className={`${adminEyebrowClass} px-4 pt-3 text-left`}>
              Lead source by who booked (counted only)
            </caption>
            <thead className="text-ui-text-subtle text-xs">
              <tr>
                <th className={`${TD_LEFT} font-semibold`}>Source</th>
                {BUCKETS.map((b) => (
                  <th key={b} className={`${TD} font-semibold`}>
                    {b}
                  </th>
                ))}
                <th className={`${TD} font-semibold`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {origins.map(([origin, row]) => (
                <tr key={origin}>
                  <td className={TD_LEFT}>{origin}</td>
                  {BUCKETS.map((b) => (
                    <td key={b} className={TD}>
                      {row[b] ?? 0}
                    </td>
                  ))}
                  <td className={`${TD} font-semibold`}>{total(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className={`${adminEyebrowClass} px-4 pt-3 text-left`}>
              Why the rest were not counted
            </caption>
            <tbody className="divide-ui-line divide-y">
              {reasons.map(([reason, count]) => (
                <tr key={reason}>
                  <td className={TD_LEFT}>{REASON_LABEL[reason]}</td>
                  <td className={TD}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function total(row: Partial<Record<BookedBy, number>>): number {
  return BUCKETS.reduce((sum, b) => sum + (row[b] ?? 0), 0);
}
