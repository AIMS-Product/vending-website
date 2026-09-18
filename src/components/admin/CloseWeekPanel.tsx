import Link from "next/link";
import {
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  CLOSE_VIEW_SOURCE,
  type CloseWeek,
  type CloseWeekRow,
} from "@/lib/services/close-week-view";
import type { CloseWeekReport } from "@/lib/services/close-week-view-data";

/**
 * The week as Close (and SteelTrap) count it: every first call on the
 * closers' calendar, by the Close funnel. A different question from the site
 * funnel tabs, which follow people who filled a form on our site.
 */

const TH = "px-3 py-2.5 text-right font-semibold whitespace-nowrap";
const TH_LEFT = "px-4 py-2.5 text-left font-semibold whitespace-nowrap";
const TD = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
const TD_LEFT = "px-4 py-2 text-left whitespace-nowrap";

function short(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(month)}/${Number(date)}`;
}

function weekLabel(week: CloseWeek): string {
  return `${short(week.key)} – ${short(week.end)}${week.complete ? "" : " (so far)"}`;
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function Cells({ row }: { row: Omit<CloseWeekRow, "label"> }) {
  return (
    <>
      <td className={TD}>{row.booked}</td>
      <td className={TD}>{row.showed}</td>
      <td className={`${TD} text-ui-text-subtle`}>
        {pct(row.showed, row.booked)}
      </td>
      <td className={TD}>{row.qualified}</td>
      <td className={TD}>{row.won}</td>
      <td className={TD}>{money(row.revenue)}</td>
    </>
  );
}

function Head({ first }: { first: string }) {
  return (
    <thead className="bg-ui-canvas text-ui-text-muted text-xs">
      <tr>
        <th scope="col" className={TH_LEFT}>
          {first}
        </th>
        <th scope="col" className={TH}>
          First calls
        </th>
        <th scope="col" className={TH}>
          Showed
        </th>
        <th scope="col" className={TH}>
          Show rate
        </th>
        <th scope="col" className={TH}>
          Qualified (rep)
        </th>
        <th scope="col" className={TH}>
          Won
        </th>
        <th scope="col" className={TH}>
          Revenue
        </th>
      </tr>
    </thead>
  );
}

export function CloseWeekTab({
  report,
  selected,
}: {
  report: CloseWeekReport;
  selected: string | null;
}) {
  if (!report.ok) {
    return (
      <section className={adminPanelClass}>
        <p className="text-ui-bad text-sm">
          Close could not be read, so this view is not shown: {report.error}
        </p>
      </section>
    );
  }
  const week =
    report.weeks.find((entry) => entry.key === selected) ??
    report.weeks.find((entry) => entry.complete) ??
    report.weeks[0]!;

  return (
    <div className="space-y-5">
      <section className={adminPanelClass} aria-label="Close weeks">
        <div className="px-4 pt-4">
          <h2 className={adminSectionTitleClass}>
            Every first call in Close, by week
          </h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            Weeks run Friday to Thursday, the same weeks as the SteelTrap
            report. This counts everyone on the closers&apos; calendar,
            including reactivation and webinar people who never filled a form on
            our site, so it is larger than the site funnel on the other tabs.
            Test and internal filtering does not apply here.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <Head first="Week" />
            <tbody>
              {report.weeks.map((entry) => (
                <tr
                  key={entry.key}
                  className={`border-ui-line/60 border-t ${entry.key === week.key ? "bg-ui-canvas font-medium" : ""}`}
                >
                  <th scope="row" className={TD_LEFT}>
                    <Link
                      href={`/admin/analytics?tab=close&week=${entry.key}`}
                      className="hover:underline"
                    >
                      {weekLabel(entry)}
                    </Link>
                  </th>
                  <Cells row={entry.totals} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={adminPanelClass} aria-label="Close week by funnel">
        <div className="px-4 pt-4">
          <h2 className={adminSectionTitleClass}>
            {weekLabel(week)} by Close funnel
          </h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            Showed and qualified count only what a rep logged as Yes; an
            unlogged call is not counted as shown. Won and revenue are deals won
            this week, whenever the call happened. &ldquo;No source&rdquo; means
            Close has no funnel on the lead.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <Head first="Funnel (Close)" />
            <tbody>
              {week.rows.map((row) => (
                <tr key={row.label} className="border-ui-line/60 border-t">
                  <th scope="row" className={TD_LEFT}>
                    <span className="inline-flex items-center gap-1.5">
                      <ChannelLogo label={row.label} />
                      {row.label}
                    </span>
                  </th>
                  <Cells row={row} />
                </tr>
              ))}
              <tr className="border-ui-line border-t font-semibold">
                <th scope="row" className={TD_LEFT}>
                  All funnels
                </th>
                <Cells row={week.totals} />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-ui-text-subtle space-y-1 px-4 py-3 text-xs">
          {week.excluded > 0 ? (
            <p>
              {week.excluded} first{" "}
              {week.excluded === 1 ? "call is" : "calls are"} left out because
              the lead is now Canceled (by Lead) or Outside the US, or in the
              LTF Quiz Funnel. SteelTrap leaves the same calls out.
            </p>
          ) : null}
          {week.unvalued > 0 ? (
            <p>
              {week.unvalued} won{" "}
              {week.unvalued === 1 ? "deal has" : "deals have"} no value in
              Close; counted as won, left out of revenue.
            </p>
          ) : null}
          <p>Source: {CLOSE_VIEW_SOURCE}</p>
          {report.mirrorSyncedAt ? (
            <p>
              First calls copied from Close at{" "}
              {new Date(report.mirrorSyncedAt).toLocaleString("en-US", {
                timeZone: "America/New_York",
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              ET (refreshed hourly). Won deals are read from Close live.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
