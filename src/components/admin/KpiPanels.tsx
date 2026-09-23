import {
  adminCardClass,
  adminEyebrowClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import { FreezeTableHead } from "@/components/admin/FreezeTableHead";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import type { KpiTabData } from "@/lib/services/kpi-report-data";
import type {
  KpiColumn,
  KpiFormat,
  KpiReport,
  KpiRow,
  KpiSection,
} from "@/lib/services/kpi-report";

/**
 * The KPI tab: the Lead Gen KPI Framework as four tables. Reads only what
 * `getKpiTab` returns. A null renders as a dash, which means no data.
 */
export function KpiTab({ data }: { data: KpiTabData }) {
  if (!data.connected) {
    return (
      <div className={adminCardClass}>
        <p className="text-ui-text-muted text-sm">
          The daily channel data is not connected yet, so there is nothing to
          report.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Freshness report={data.report} endDay={data.range.endDay} />
      <p className="text-ui-text-subtle text-xs">
        Each channel&rsquo;s numbers from first view to sale, for{" "}
        {data.range.label} ({data.range.startDay} to {data.range.endDay}). A
        dash means no data, not zero.{" "}
        <Method>
          Opt-in and Conv % divide by every visit in the range, including days
          that produced no leads. Other rates only use days where both numbers
          were recorded. A rate that came out above 100% shows as a dash,
          because its two numbers counted different people.
        </Method>
      </p>
      {data.report.sections.map((section) => (
        <KpiSectionTable key={section.key} section={section} />
      ))}
    </div>
  );
}

/** Connectors that run when a platform posts to us, not on the cron. */
const EVENT_DRIVEN = new Set(["manychat-ingest"]);

function isEventDriven(sourceOfTruth: string): boolean {
  const connectors = sourceOfTruth.split(" + ");
  return connectors.every((connector) => EVENT_DRIVEN.has(connector));
}

/**
 * How old the numbers are, said once at the top. Every row already carries a
 * "Last verified", but that column sits past 18 others -- nobody scrolls to
 * it, so a page whose connectors stopped running last week reads exactly like
 * a fresh one. This is the oldest run behind anything on the page.
 */
function Freshness({ report, endDay }: { report: KpiReport; endDay: string }) {
  const rows = report.sections.flatMap((section) => section.rows);
  const verified = rows
    // A webhook connector's "last run" is the last event it received. A quiet
    // Instagram DM week is not a stale page, so it does not set the date here.
    .filter((row) => !isEventDriven(row.sourceOfTruth))
    .map((row) => row.lastVerified)
    .filter((value): value is string => value != null)
    .sort();
  const oldest = verified[0]?.slice(0, 10);
  if (!oldest) return null;

  // Measured against the range's own end day, not the clock: a component that
  // reads Date.now() is impure, and the server already stamped today here.
  const cutoff = new Date(`${endDay}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  const stale = oldest < cutoff.toISOString().slice(0, 10);
  return (
    <p
      className={`text-xs ${stale ? "text-ui-bad font-medium" : "text-ui-text-subtle"}`}
    >
      {stale
        ? `Out of date: the oldest data feed behind this page last ran ${oldest}. Numbers below have not moved since.`
        : `Up to date as of ${oldest}, the last run of the oldest data feed behind this page.`}
    </p>
  );
}

/**
 * Long methodology, folded away. Every word of it earns its place when a
 * number is being challenged and none of it does on the way past, and a
 * paragraph nobody reads above a table nobody trusts is the worst of both.
 */
function Method({ children }: { children: React.ReactNode }) {
  return (
    <details className="inline">
      <summary className="text-ui-text-muted hover:text-ui-text cursor-pointer list-none underline decoration-dotted underline-offset-2">
        How this is measured
      </summary>
      <span className="mt-1 block">{children}</span>
    </details>
  );
}

/**
 * Columns where every row in this section is null.
 *
 * Three columns of nothing but dashes (Revenue, Spend, Cost/booked before the
 * money connectors landed) pushed the columns that DO have numbers off-screen,
 * and a reader who has to scroll past empty space to reach a figure trusts it
 * less. A column comes back on its own the day one row observes a value.
 */
function observedColumns(section: KpiSection): KpiColumn[] {
  return section.columns.filter((column) =>
    section.rows.some((row) => row.values[column.key] != null),
  );
}

/** The first column's heading, by section. Anything else is "Name". */
const FIRST_COLUMN: Record<string, string> = {
  funnels: "Channel",
  webinar: "Webinar",
};

/**
 * What each shorthand column head means, on screen. The heads are short so 18
 * columns fit; a phone never shows a tooltip, so the meaning goes under the
 * table instead. Keyed by column key, so a renamed head keeps its meaning.
 */
const COLUMN_HINTS: Record<string, string> = {
  ctr: "clicks out of impressions",
  visits: "visits to our landing pages",
  thankYouConv: "thank-you page visits out of site visits",
  optIn: "leads out of site visits",
  leadToBook: "booked calls out of leads",
  showRate:
    "shown as a share of booked calls; only calls a rep logged as a show count",
  closeRate: "won out of shown",
  leadToClose: "won out of leads",
  costPerBooked: "spend divided by booked calls",
  attendanceRate: "attendees out of registrations",
  regToBook: "booked calls out of registrations",
  regToClose: "won out of registrations",
  bookedNightOf: "booked on the night of the webinar",
  bookedEver:
    "people who booked and still carry this webinar's tag in Close; not used in any rate",
  showNoBooking:
    "marked shown in Close with no booking date; not added to Shown",
  deliveryRate: "delivered out of sent",
  replyRate: "replies out of delivered",
  outcomeKnown:
    "share of calls that were due with a show or no-show logged in Close",
};

function ColumnLegend({ columns }: { columns: KpiColumn[] }) {
  const hints = columns.filter((column) => COLUMN_HINTS[column.key]);
  if (hints.length === 0) return null;
  return (
    <p className="text-ui-text-subtle mt-2 text-xs leading-5">
      {hints.map((column, index) => (
        <span key={column.key}>
          {index > 0 ? " · " : null}
          <span className="text-ui-text-muted font-medium">{column.label}</span>
          : {COLUMN_HINTS[column.key]}
        </span>
      ))}
    </p>
  );
}

function KpiSectionTable({ section }: { section: KpiSection }) {
  const columns = observedColumns(section);
  const emptied = section.columns.length - columns.length;
  return (
    <section className={adminCardClass} aria-label={section.title}>
      <h2 className={adminEyebrowClass}>{section.title}</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        <Method>{section.basis}</Method>
      </p>
      {section.rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No data in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <FreezeTableHead />
          <table className="w-full min-w-[64rem] text-[0.8125rem]">
            <thead className={adminStickyHeadClass}>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                {/* The row label stays put while the table scrolls: at 18
                    columns the numbers that matter (Leads, Won, Revenue) sit
                    off-screen, and a number you cannot name a channel for is
                    worse than no number. */}
                <th className="bg-ui-surface border-ui-line sticky left-0 z-10 border-r py-2 pr-4 pl-0 font-semibold">
                  {FIRST_COLUMN[section.key] ?? "Name"}
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="py-2 pr-3 text-right font-semibold whitespace-nowrap"
                  >
                    {column.label}
                  </th>
                ))}
                <th className="py-2 font-semibold whitespace-nowrap">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {section.rows.map((row) => (
                <KpiTableRow key={row.key} row={row} columns={columns} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.rows.length > 0 ? <ColumnLegend columns={columns} /> : null}
      {emptied > 0 ? (
        <p className="text-ui-text-subtle mt-2 text-xs">
          {emptied} {emptied === 1 ? "column is" : "columns are"} hidden because{" "}
          {emptied === 1 ? "it has" : "they have"} no data in this range.{" "}
          {emptied === 1 ? "It comes" : "They come"} back once data arrives.
        </p>
      ) : null}
      {section.hidden > 0 ? (
        <p className="text-ui-text-subtle mt-2 text-xs">
          {section.hidden} more {section.hidden === 1 ? "row" : "rows"}{" "}
          {section.hiddenNote}.
        </p>
      ) : null}
    </section>
  );
}

function KpiTableRow({ row, columns }: { row: KpiRow; columns: KpiColumn[] }) {
  return (
    <tr>
      {/* The plumbing that used to sit under every row -- which connectors
          feed it, when they last ran -- is on hover now. It is worth keeping
          and was never worth a second line of grey text on all eighteen
          rows. */}
      <td
        className="bg-ui-surface border-ui-line sticky left-0 z-10 min-w-[13rem] border-r py-2.5 pr-4 pl-0 align-middle"
        title={`Source: ${row.sourceOfTruth}${row.lastVerified ? ` · last verified ${row.lastVerified.slice(0, 10)}` : " · no connector has run"}`}
      >
        <div className="flex items-center gap-2">
          <ChannelLogo label={row.label} />
          <span className="text-ui-text font-medium whitespace-nowrap">
            {row.label}
          </span>
          {row.detail ? (
            <span className="text-ui-text-subtle text-xs whitespace-nowrap">
              {row.detail}
            </span>
          ) : null}
        </div>
      </td>
      {columns.map((column) => (
        <td
          key={column.key}
          className="py-2.5 pr-3 text-right align-middle whitespace-nowrap tabular-nums"
        >
          <Cell value={row.values[column.key] ?? null} format={column.format} />
        </td>
      ))}
      <td className="text-ui-text-muted py-2.5 align-middle text-xs whitespace-nowrap">
        {row.owner ? (
          <span title={`Reviewed ${row.cadence.toLowerCase()}`}>
            {row.owner}
          </span>
        ) : (
          <span className="text-ui-text-subtle" title="No owner assigned">
            —
          </span>
        )}
      </td>
    </tr>
  );
}

function Cell({ value, format }: { value: number | null; format: KpiFormat }) {
  if (value == null) {
    return (
      <span className="text-ui-text-subtle" title="No data">
        —
      </span>
    );
  }
  if (format === "money") return <>${Math.round(value).toLocaleString()}</>;
  if (format === "percent") return <>{value}%</>;
  return <>{value.toLocaleString()}</>;
}
