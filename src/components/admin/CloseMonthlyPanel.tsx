import Link from "next/link";
import {
  adminEyebrowClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  FUNNEL_GROUPS,
  MATURE_AFTER_DAYS,
  pctOf,
  type MonthlyCell,
  type MonthlyFunnelRow,
  type MonthlyMonth,
} from "@/lib/services/close-monthly-funnel";
import type { CloseMonthlyReport } from "@/lib/services/close-monthly-funnel-data";

/**
 * Sources down the side, months across the top, in the shape of the sheet the
 * floor already reads. Every number is ours, and the header says how ours is
 * counted so the gap against that sheet is arguable rather than mysterious.
 */

const TH = "px-2.5 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-2.5 py-2 text-right tabular-nums whitespace-nowrap";
const STICKY =
  "bg-ui-surface border-ui-line sticky left-0 z-10 min-w-[13rem] border-r px-4 py-2 text-left";

function money(value: number): string {
  return value === 0 ? "$0" : `$${Math.round(value).toLocaleString("en-US")}`;
}

/** A rate, or a dash when there is nothing behind it to divide. */
function rate(part: number, whole: number): string {
  const pct = pctOf(part, whole);
  return pct === null ? "—" : `${pct}%`;
}

/**
 * A cell nothing happened in prints dashes, never a row of zeros. Form fills
 * count as something happening: a source producing leads and booking nobody is
 * the row worth looking at, not one to blank out.
 */
function isEmpty(cell: MonthlyCell | undefined): cell is undefined {
  return !cell || (cell.booked === 0 && cell.won === 0 && !cell.leads);
}

/** "July 2026" for a YYYY-MM-DD day. */
function monthNameOf(day: string): string {
  return new Date(`${day.slice(0, 7)}-01T00:00:00Z`).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthsHref(
  months: readonly MonthlyMonth[],
  toggled: string,
  shown: ReadonlySet<string>,
): string {
  const next = new Set(shown);
  if (next.has(toggled)) next.delete(toggled);
  else next.add(toggled);
  // Every month shown is the default, so it needs no parameter at all.
  if (next.size === months.length || next.size === 0) return "?tab=mom";
  const ordered = months
    .filter((month) => next.has(month.key))
    .map((month) => month.key);
  return `?tab=mom&months=${ordered.join(",")}`;
}

/** The months to render: those named in `months=`, or all of them. */
export function parseShownMonths(
  value: string | null | undefined,
  all: readonly MonthlyMonth[],
): Set<string> {
  const keys = new Set(all.map((month) => month.key));
  const asked = (value ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => keys.has(key));
  return asked.length > 0 ? new Set(asked) : keys;
}

export function CloseMonthlyPanel({
  report,
  shown,
}: {
  report: CloseMonthlyReport;
  shown: string | null;
}) {
  if (!report.ok) {
    return (
      <section className={`${adminPanelClass} p-4`}>
        <h2 className={adminSectionTitleClass}>Month over month</h2>
        <p className="text-ui-bad mt-2 text-sm">
          The monthly funnel could not be read, so it is not shown:{" "}
          {report.error}
        </p>
      </section>
    );
  }

  const { funnel } = report;
  const visible = parseShownMonths(shown, funnel.months);
  const months = funnel.months.filter((month) => visible.has(month.key));
  const immature = months.filter((month) => !month.mature);

  return (
    <div className="space-y-5">
      <section className={`${adminPanelClass} p-4`}>
        <h2 className={adminSectionTitleClass}>
          Month over month, by Close funnel
        </h2>
        <dl className="text-ui-text-subtle mt-2 grid max-w-[80ch] gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="text-ui-text font-medium">Leads</dt>
          <dd>
            Form fills on our own site, one per person. Close only holds people
            who booked, so this is the one column from our tables, and it is
            blank for a source with no form behind it.
          </dd>
          <dt className="text-ui-text font-medium">Booked</dt>
          <dd>
            The lead&rsquo;s <em>first</em> sales call, by Close&rsquo;s
            &ldquo;First Sales Call Booked Date&rdquo;, one row per lead,
            leaving out leads now &ldquo;Canceled (by Lead)&rdquo; or
            &ldquo;Outside the US&rdquo;.
          </dd>
          <dt className="text-ui-text font-medium">Show %</dt>
          <dd>
            &ldquo;First Call Show Up (Opp)&rdquo; = Yes &mdash; the outcome
            field for that meeting. Not the call disposition, which mostly
            describes a later follow-up or reschedule.
          </dd>
          <dt className="text-ui-text font-medium">Qual %</dt>
          <dd>&ldquo;Qualified (Opp)&rdquo; = Yes, the rep&rsquo;s call.</dd>
          <dt className="text-ui-text font-medium">CW %</dt>
          <dd>
            The lead&rsquo;s stage being &ldquo;Closed / Won&rdquo;. All three
            rates are over booked, never over each other.
          </dd>
          <dt className="text-ui-text font-medium">Revenue</dt>
          <dd>The Close deal value those won leads carry.</dd>
        </dl>
        <p className="text-ui-text-subtle mt-3 max-w-[80ch] text-xs">
          Every column reads off one lead row, so a win counts in the month that
          lead&rsquo;s call was <em>booked</em>, not the month the deal closed.
          The sheet counts meeting activities rather than leads, so a lead who
          rescheduled twice appears in it three times and its booked totals run
          roughly 1.7&times; these across every source.
        </p>
        <p className="text-ui-text-subtle mt-2 text-xs">
          {report.mirrorSyncedAt ? (
            <>
              Close mirror last synced{" "}
              <time dateTime={report.mirrorSyncedAt}>
                {new Date(report.mirrorSyncedAt).toLocaleString("en-US")}
              </time>
              . It runs hourly.
            </>
          ) : (
            "The Close mirror has not recorded a sync time."
          )}
          {report.leadsError ? (
            <span className="text-ui-bad">
              {" "}
              The Leads column could not be read, so it is blank:{" "}
              {report.leadsError}
            </span>
          ) : funnel.leadsFrom ? (
            <>
              {" "}
              Form fills are held from {funnel.leadsFrom} onward only, so{" "}
              {monthNameOf(funnel.leadsFrom)} is a partial month in the Leads
              column and every month before it is blank.
            </>
          ) : null}
        </p>

        <div className={`${adminEyebrowClass} mt-4`}>Show months</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {funnel.months.map((month) => {
            const on = visible.has(month.key);
            return (
              <Link
                key={month.key}
                href={monthsHref(funnel.months, month.key, visible)}
                aria-pressed={on}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  on
                    ? "bg-ui-accent text-white"
                    : "border-ui-line-strong text-ui-text-muted hover:bg-ui-canvas border"
                }`}
              >
                {month.label}
              </Link>
            );
          })}
        </div>
      </section>

      {immature.length > 0 ? (
        <p className="text-ui-text-subtle px-1 text-xs">
          {immature.map((month) => month.label).join(", ")}{" "}
          {immature.length === 1 ? "is" : "are"} younger than{" "}
          {MATURE_AFTER_DAYS} days, so the closed-won and revenue columns there
          are still filling in. Read them as a floor, not a result.
        </p>
      ) : null}

      <section className={adminPanelClass} aria-label="Funnel by month">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ui-canvas text-ui-text-muted text-xs">
              <tr>
                <th
                  scope="col"
                  rowSpan={2}
                  className={`${STICKY} align-bottom`}
                >
                  Funnel
                </th>
                {months.map((month) => (
                  <th
                    key={month.key}
                    scope="colgroup"
                    colSpan={6}
                    className="border-ui-line border-l px-2.5 py-2 text-center font-semibold whitespace-nowrap"
                  >
                    {month.label}
                  </th>
                ))}
              </tr>
              <tr>
                {months.map((month) => (
                  <ColumnHeads key={month.key} />
                ))}
              </tr>
            </thead>
            {FUNNEL_GROUPS.map((group) => {
              const rows = funnel.rows.filter((row) => row.group === group.key);
              if (rows.length === 0) return null;
              return (
                <tbody key={group.key}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={1 + months.length * 6}
                      className="bg-ui-canvas text-ui-text-muted border-ui-line border-t px-4 py-1.5 text-left text-[0.6875rem] font-semibold tracking-[0.06em] uppercase"
                    >
                      {group.label}
                      <span className="text-ui-text-subtle ml-2 font-normal tracking-normal normal-case">
                        {group.note}
                      </span>
                    </th>
                  </tr>
                  {rows.map((row) => (
                    <Row key={row.label} row={row} months={months} />
                  ))}
                  {/* The subtotal is the point of the grouping: nobody should
                      have to subtract one lane from the total by hand. */}
                  <tr className="border-ui-line bg-ui-canvas/40 border-t font-semibold">
                    <th scope="row" className={`${STICKY} bg-ui-canvas/40`}>
                      {group.subtotal}
                    </th>
                    {months.map((month) => (
                      <Cells key={month.key} cell={month.byGroup[group.key]} />
                    ))}
                  </tr>
                </tbody>
              );
            })}
            <tbody>
              <tr className="border-ui-line border-t-2 font-semibold">
                <th scope="row" className={STICKY}>
                  Every first call
                </th>
                {months.map((month) => (
                  <Cells key={month.key} cell={month.totals} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-ui-text-subtle border-ui-line border-t px-4 py-2.5 text-xs">
          Booked = first calls. Show % and Qual % = share of those booked calls
          a rep logged as held and as qualified. CW % = share that has closed
          won so far. Revenue = the value Close carries on those wins.
          {months.some((month) => month.excluded > 0) ? (
            <>
              {" "}
              Excluded first calls (canceled by lead, outside the US, quiz
              funnel):{" "}
              {months
                .filter((month) => month.excluded > 0)
                .map((month) => `${month.label} ${month.excluded}`)
                .join(", ")}
              .
            </>
          ) : null}
        </p>
      </section>
    </div>
  );
}

function ColumnHeads() {
  return (
    <>
      <th scope="col" className={`${TH} border-ui-line border-l`}>
        Leads
      </th>
      <th scope="col" className={TH}>
        Booked
      </th>
      <th scope="col" className={TH}>
        Show %
      </th>
      <th scope="col" className={TH}>
        Qual %
      </th>
      <th scope="col" className={TH}>
        CW %
      </th>
      <th scope="col" className={TH}>
        Revenue
      </th>
    </>
  );
}

function Cells({ cell }: { cell: MonthlyCell | undefined }) {
  if (isEmpty(cell)) {
    return (
      <>
        <td className={`${TD} text-ui-text-subtle border-ui-line border-l`}>
          —
        </td>
        <td className={`${TD} text-ui-text-subtle`}>—</td>
        <td className={`${TD} text-ui-text-subtle`}>—</td>
        <td className={`${TD} text-ui-text-subtle`}>—</td>
        <td className={`${TD} text-ui-text-subtle`}>—</td>
        <td className={`${TD} text-ui-text-subtle`}>—</td>
      </>
    );
  }
  return (
    <>
      <td
        className={`${TD} border-ui-line border-l ${cell.leads === null ? "text-ui-text-subtle" : "text-ui-text-muted"}`}
        title={
          cell.leads === null
            ? "No form behind this source, or before form fills were captured."
            : undefined
        }
      >
        {cell.leads === null ? "—" : cell.leads.toLocaleString()}
      </td>
      <td className={TD}>{cell.booked.toLocaleString()}</td>
      <td className={`${TD} text-ui-text-muted`}>
        {rate(cell.showed, cell.booked)}
      </td>
      <td className={`${TD} text-ui-text-muted`}>
        {rate(cell.qualified, cell.booked)}
      </td>
      <td className={`${TD} text-ui-text-muted`}>
        {rate(cell.won, cell.booked)}
      </td>
      <td
        className={`${TD} ${cell.revenue > 0 ? "text-ui-good" : "text-ui-text-subtle"}`}
      >
        {money(cell.revenue)}
      </td>
    </>
  );
}

function Row({
  row,
  months,
}: {
  row: MonthlyFunnelRow;
  months: readonly MonthlyMonth[];
}) {
  return (
    <tr className="border-ui-line/60 border-t">
      <th scope="row" className={`${STICKY} font-normal`}>
        <span className="flex items-center gap-2">
          <ChannelLogo label={row.label} />
          <span className="truncate">{row.label}</span>
        </span>
      </th>
      {months.map((month) => (
        <Cells key={month.key} cell={row.byMonth[month.key]} />
      ))}
    </tr>
  );
}
