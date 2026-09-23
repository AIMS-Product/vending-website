import {
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { UnverifiedMark } from "@/components/admin/TrustMarks";
import { flagFor, type UnverifiedFlag } from "@/lib/analytics/data-trust-bar";
import type { BookedCallsReport, WeekRow } from "@/lib/services/booked-calls";

/**
 * Marketing's weekly scoreboard: first calls booked, by the day they were
 * booked. One basis, one system of record — see `booked-calls.ts` for why this
 * is dated differently from every other booking number on this site.
 *
 * There is no target line on purpose. The only booking target on record is the
 * 42-a-weekday call capacity, and that covers reactivation as well as
 * marketing, so printing it here would show marketing missing a number it was
 * never asked to carry alone. Week over week is the comparison that is honest
 * today; a target lands here when marketing has one of its own.
 */

const TH = "px-3 py-2.5 text-right font-semibold whitespace-nowrap";
const TH_LEFT = "px-4 py-2.5 text-left font-semibold whitespace-nowrap";
const TD = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";
const TD_LEFT = "px-4 py-2.5 text-left whitespace-nowrap";

/** The Sunday a Monday-start week ends on, YYYY-MM-DD. */
function weekEnd(weekStart: string): string {
  const end = new Date(`${weekStart}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toISOString().slice(0, 10);
}

function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (date: Date) => `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function Change({ week, previous }: { week: WeekRow; previous?: WeekRow }) {
  if (!previous) return <span className="text-ui-text-subtle">—</span>;
  const delta = week.marketing - previous.marketing;
  if (delta === 0) return <span className="text-ui-text-muted">even</span>;
  const tone = delta > 0 ? "text-ui-ok" : "text-ui-warn";
  return (
    <span className={tone}>
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

export function BookedCallsPanel({
  report,
  unverified,
}: {
  report: BookedCallsReport;
  unverified?: readonly UnverifiedFlag[];
}) {
  const weeks = report.weeks;
  const current = weeks.at(-1);
  const funnels = [
    ...new Set(weeks.flatMap((week) => week.byFunnel.map((row) => row.funnel))),
  ].sort((a, b) => {
    const total = (name: string) =>
      weeks.reduce(
        (sum, week) =>
          sum + (week.byFunnel.find((row) => row.funnel === name)?.booked ?? 0),
        0,
      );
    return total(b) - total(a) || a.localeCompare(b);
  });

  return (
    <section className={adminPanelClass} aria-label="Booked calls by week">
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>Booked calls by week</h2>
        <p className="text-ui-text-subtle max-w-2xl text-xs">
          How many first strategy calls marketing booked each week, counted on
          the day the booking was made in Calendly, not the day of the call.
          Weeks run Monday to Sunday; the last line is the week in progress.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="text-ui-text-muted border-ui-line border-b text-xs">
            <tr>
              <th className={TH_LEFT}>Week</th>
              <th className={TH}>
                Marketing booked
                <UnverifiedMark
                  flag={
                    current
                      ? flagFor(unverified, "calendly", {
                          from: weeks[0].weekStart,
                          to: weekEnd(current.weekStart),
                        })
                      : undefined
                  }
                />
              </th>
              <th className={TH}>vs prior week</th>
              <th className={TH}>Reactivation (partial)</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {weeks.map((week, index) => (
              <tr key={week.weekStart}>
                <td className={TD_LEFT}>{weekLabel(week.weekStart)}</td>
                <td className={`${TD} font-semibold`}>
                  {week.marketing.toLocaleString("en-US")}
                </td>
                <td className={TD}>
                  <Change week={week} previous={weeks[index - 1]} />
                </td>
                <td className={`${TD} text-ui-text-muted`}>
                  {week.reactivationSeen.toLocaleString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-ui-line border-t">
        <div className="border-ui-line flex items-baseline justify-between gap-2 border-b px-4 py-3">
          <h3 className={adminSectionTitleClass}>By funnel</h3>
          <p className="text-ui-text-subtle text-xs">
            The lead&apos;s funnel in Close, matched on the email used to book.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="text-ui-text-muted border-ui-line border-b text-xs">
              <tr>
                <th className={TH_LEFT}>Funnel</th>
                {weeks.map((week) => (
                  <th key={week.weekStart} className={TH}>
                    {weekLabel(week.weekStart)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {funnels.length === 0 ? (
                <tr>
                  <td
                    className="text-ui-text-subtle px-4 py-6 text-sm"
                    colSpan={weeks.length + 1}
                  >
                    No first calls booked in this window.
                  </td>
                </tr>
              ) : (
                funnels.map((funnel) => (
                  <tr key={funnel}>
                    <td className={TD_LEFT}>{funnel}</td>
                    {weeks.map((week) => {
                      const booked =
                        week.byFunnel.find((row) => row.funnel === funnel)
                          ?.booked ?? 0;
                      return (
                        <td
                          key={week.weekStart}
                          className={
                            booked === 0 ? `${TD} text-ui-text-subtle` : TD
                          }
                        >
                          {booked}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-ui-text-muted border-ui-line space-y-1 border-t px-4 py-3 text-xs">
        <p>
          Reactivation (partial) is the sales reactivation team&apos;s bookings.
          It is not marketing&apos;s number, so it is not added in. Most of that
          team books on calendars that never report to this site (229 of their
          257 bookings since 2026-08-24 never reached us), so the column shows
          only the few that do.
        </p>
        {current && report.notInCloseYet > 0 ? (
          <p>
            {report.notInCloseYet} booking
            {report.notInCloseYet === 1 ? "" : "s"} this week has no Close lead
            yet, so it has no funnel. It will appear once Close catches up.
          </p>
        ) : null}
        <p>
          Cancellations are not shown. Calendly only tells us about a cancel as
          it happens, and several August weeks have none on record, so a zero
          would read as &ldquo;none&rdquo; when it means &ldquo;never
          recorded&rdquo;.
        </p>
      </div>
    </section>
  );
}
