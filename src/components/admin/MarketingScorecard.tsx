import {
  adminLinkClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import {
  pct,
  rangeLabel,
  TD,
  TH,
} from "@/components/admin/marketing-mtd-format";
import { formatUsd as money } from "@/lib/admin/format-number";
import type { MarketingMtd } from "@/lib/services/marketing-mtd";
import {
  scorecardCsv,
  WEBINAR_SOURCE,
  webinarTotals,
  type Scorecard,
  type WebinarEvent,
} from "@/lib/services/marketing-scorecard";

/** Q4 sheet rows on Jess's field rule, Monday-Friday weeks, newest on the right. */
export function MarketingScorecardTab({
  card,
  today,
}: {
  card: Scorecard;
  today: string;
}) {
  const format = (kind: "count" | "money", v: number | null) =>
    v === null ? "—" : kind === "money" ? money(v) : String(v);
  return (
    <section className={adminPanelClass} aria-label="Q4 scorecard rows">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4">
        <div>
          <h2 className={adminSectionTitleClass}>Q4 scorecard rows</h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            The Marketing MTD rule, one per lead by First Sales Call Booked
            Date, Monday to Friday. Weekend bookings are in no week; their own
            row counts them. Spend covers the same five days. The current week
            runs to today.
          </p>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(scorecardCsv(card))}`}
          download={`q4-scorecard-${today}.csv`}
          className={`${adminLinkClass} text-xs print:hidden`}
        >
          Download CSV
        </a>
      </div>
      <div className="mt-3 overflow-x-auto print:overflow-visible">
        <table className="w-full text-sm print:text-[10px]">
          <thead className="bg-ui-canvas text-ui-text-muted text-xs">
            <tr>
              <th
                scope="col"
                className="bg-ui-canvas sticky left-0 z-10 px-4 py-2.5 text-left font-semibold"
              >
                Row
              </th>
              {card.weeks.map((week, i) => (
                <th key={week.from} scope="col" className={TH}>
                  W{i + 1}
                  <span className="block font-normal">{rangeLabel(week)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {card.rows.map((row) => (
              <tr
                key={row.label}
                className={`border-ui-line/60 border-t ${row.track ? "text-ui-text-muted" : ""}`}
              >
                <th
                  scope="row"
                  className={`bg-ui-surface sticky left-0 z-10 px-4 py-2 text-left font-medium whitespace-nowrap ${row.child ? "pl-8 font-normal" : ""}`}
                >
                  {row.label}
                  {row.track && (
                    <span className="text-ui-text-subtle ml-1.5 text-xs">
                      track
                    </span>
                  )}
                </th>
                {row.values.map((v, i) => (
                  <td key={card.weeks[i]!.from} className={TD}>
                    {format(row.kind, v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Webinar rooms this month against the same dates last month. */
export function MarketingWebinars({
  events,
  mtd,
}: {
  events: readonly WebinarEvent[];
  mtd: MarketingMtd;
}) {
  const now = webinarTotals(events, mtd.current);
  const then = webinarTotals(events, mtd.prior);
  const webinarRow = mtd.rows.find((r) => r.label === WEBINAR_SOURCE);
  const booked = (f: { booked: number } | undefined) => (f ? f.booked : 0);
  const lines: Array<[string, string, string]> = [
    ["Webinars", String(now.events), String(then.events)],
    ["Registrations", String(now.registrations), String(then.registrations)],
    ["Attendees", String(now.attendees), String(then.attendees)],
    [
      "Attendance",
      pct(now.registrations ? now.attendees / now.registrations : null),
      pct(then.registrations ? then.attendees / then.registrations : null),
    ],
    [
      "Booked, Internal Webinar row",
      String(booked(webinarRow?.current)),
      String(booked(webinarRow?.prior)),
    ],
    [
      "Booked from the room link",
      String(now.roomBooked),
      String(then.roomBooked),
    ],
    ["Won (board)", String(now.won), String(then.won)],
    ["Revenue (board)", money(now.revenue), money(then.revenue)],
    ["Ad spend", money(now.spend), money(then.spend)],
    [
      "Cost per registration",
      now.registrations ? money(now.spend / now.registrations) : "—",
      then.registrations ? money(then.spend / then.registrations) : "—",
    ],
  ];
  const rooms = events.filter(
    (e) => e.date >= mtd.current.from && e.date <= mtd.current.to,
  );

  return (
    <section className={adminPanelClass} aria-label="Webinars">
      <div className="px-4 pt-4">
        <h2 className={adminSectionTitleClass}>Webinars</h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          From the webinar board (webinar_events). Booked from the room link is
          the board&apos;s own count; the Internal Webinar row line is the
          month-to-date table above.
        </p>
      </div>
      <div className="mt-3 grid gap-4 px-4 pb-4 lg:grid-cols-2">
        <table className="w-full text-sm">
          <thead className="text-ui-text-muted text-xs">
            <tr>
              <th scope="col" className="py-2 text-left font-semibold" />
              <th scope="col" className={TH}>
                {rangeLabel(mtd.current)}
              </th>
              <th scope="col" className={TH}>
                {rangeLabel(mtd.prior)}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map(([label, a, b]) => (
              <tr key={label} className="border-ui-line/60 border-t">
                <th scope="row" className="py-2 text-left font-medium">
                  {label}
                </th>
                <td className={TD}>{a}</td>
                <td className={`${TD} text-ui-text-subtle`}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ui-text-muted text-xs">
              <tr>
                <th scope="col" className="py-2 text-left font-semibold">
                  Room
                </th>
                <th scope="col" className={TH}>
                  Reg.
                </th>
                <th scope="col" className={TH}>
                  Attended
                </th>
                <th scope="col" className={TH}>
                  Booked (link)
                </th>
                <th scope="col" className={TH}>
                  Spend
                </th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-ui-text-muted py-2">
                    No webinar on the board this month yet.
                  </td>
                </tr>
              )}
              {rooms.map((e) => (
                <tr
                  key={`${e.date}-${e.label}`}
                  className="border-ui-line/60 border-t"
                >
                  <th
                    scope="row"
                    className="py-2 text-left font-normal whitespace-nowrap"
                  >
                    {e.date.slice(5)} {e.label}
                  </th>
                  <td className={TD}>{e.registrations ?? "—"}</td>
                  <td className={TD}>{e.attendees ?? "—"}</td>
                  <td className={TD}>{e.booked_calls ?? "—"}</td>
                  <td className={TD}>
                    {e.spend === null ? "—" : money(e.spend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
