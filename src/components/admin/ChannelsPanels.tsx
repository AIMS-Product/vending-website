import Link from "next/link";
import { AdminViewerLink } from "@/components/admin/AdminViewerLink";
import { CloseWinsPanel } from "@/components/admin/CloseWinsPanel";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  AdminDeltaChip,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import { FreezeTableHead } from "@/components/admin/FreezeTableHead";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";
import type {
  ChannelReport,
  ChannelReportRow,
  FunnelStage,
  GoingOutRow,
  SyncHealthRow,
} from "@/lib/services/channel-report-rollup";
import { connectorLabel } from "@/lib/services/channel-report-rollup";
import type {
  ChannelsTabData,
  FixLinkRow,
} from "@/lib/services/channel-report";
import {
  COVERAGE_KEYS,
  type ConfidenceReport,
  type CheckStatus,
} from "@/lib/services/channel-confidence";

/**
 * The Channels tab: one funnel across every channel, one row per channel, and
 * the health of every connector feeding them. Reads only what
 * `getChannelsTab` returns; every number here came from `channel_daily`.
 *
 * A null is rendered as "—" with "No data" on hover. It is never a zero.
 */

export function channelsHref(
  range: AdminAnalyticsRangeKey,
  includeInternal: boolean,
  channel?: string | null,
) {
  const params = new URLSearchParams({ range, tab: "channels" });
  if (includeInternal) params.set("internal", "1");
  if (channel) params.set("channel", channel);
  return `/admin/analytics?${params.toString()}`;
}

export function ChannelsTab({
  canEdit,
  data,
  range,
  includeInternal,
}: {
  canEdit: boolean;
  data: ChannelsTabData;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
}) {
  if (!data.connected) {
    return (
      <div className={adminCardClass}>
        <p className="text-ui-text-muted text-sm">
          Channel numbers are not set up in this environment yet. An engineer
          needs to apply the
          <code className="mx-1">channel_daily</code>migration and run
          <code className="mx-1">/api/admin/channel-sync/run?days=400</code>
          once to load the history.
        </p>
      </div>
    );
  }

  const { report } = data;
  return (
    <>
      {data.channel ? (
        <p className="text-ui-text-muted mb-4 text-sm">
          <Link
            href={channelsHref(range, includeInternal)}
            className="text-ui-accent underline-offset-2 hover:underline"
          >
            All channels
          </Link>
          <span className="text-ui-text-subtle"> / </span>
          <span className="text-ui-text inline-flex items-center gap-2 align-middle font-semibold">
            <ChannelLogo label={data.channel} />
            {data.channel}
          </span>
        </p>
      ) : null}

      <ChannelKpis report={report} days={data.range.days} />

      <FunnelStrip report={report} days={data.range.days} />

      <ChannelTable
        title={data.channel ? "By campaign" : "By channel"}
        rows={report.rows}
        tail={report.tail}
        logos={!data.channel}
        legend
        rowHref={
          data.channel
            ? undefined
            : (row) => channelsHref(range, includeInternal, row.key)
        }
      />

      <div className="mt-5">
        <CloseWinsPanel
          report={data.closeWins}
          columns={[{ key: "range", label: data.range.label }]}
          caption="Every sale Close recorded in this range, by the day it was won. The Won column above counts only buyers we can trace to a site lead or a webinar registration, so it runs lower; this is the full count."
        />
      </div>

      {data.drill ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <ChannelTable title="By content" rows={data.drill.byContent.rows} />
          <ChannelTable
            title="By destination"
            rows={data.drill.byDestination.rows}
          />
        </div>
      ) : null}

      {data.channel ? null : (
        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <GoingOutTable
              canEdit={canEdit}
              rows={data.goingOut}
              days={data.range.days}
            />
          </div>
          <FixLinksPanel rows={data.fixLinks} days={data.range.days} />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ConfidencePanel report={data.confidence} />
        </div>
        <SyncHealthPanel rows={data.syncHealth} />
      </div>
    </>
  );
}

function ChannelKpis({
  report,
  days,
}: {
  report: ChannelReport;
  days: number;
}) {
  const { totals, priorTotals } = report;
  const kpi = (
    label: string,
    value: number | null,
    prior: number | null,
    format: "number" | "money" = "number",
  ) => (
    <AdminMetricPanel
      label={label}
      value={value == null ? "—" : formatValue(value, format)}
      caption={
        value == null ? "no data for this range" : `vs prior ${days} days`
      }
      delta={
        value == null ? undefined : <Delta current={value} prior={prior} />
      }
    />
  );
  return (
    <AdminMetricStrip>
      {kpi("Spend", totals.spend, priorTotals.spend, "money")}
      {kpi("Leads", totals.leads, priorTotals.leads)}
      {kpi("Registrations & contacts", totals.contacts, priorTotals.contacts)}
      {kpi("Booked", totals.booked, priorTotals.booked)}
      {kpi("Won", totals.won, priorTotals.won)}
    </AdminMetricStrip>
  );
}

/**
 * The funnel as one row of cells under the KPIs, not a column beside the
 * table. Five stages on the site, then what the platforms report upstream,
 * separated because Seen and Clicked cover different channels and are not a
 * stage of the funnel to their left. The table below gets the full width.
 */
function FunnelStrip({
  report,
  days,
}: {
  report: ChannelReport;
  days: number;
}) {
  return (
    <section className={`${adminCardClass} mb-5`} aria-label="Channel funnel">
      <div className="divide-ui-line grid gap-y-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 xl:divide-x">
        {report.funnel.map((stage) => (
          <StageCell
            key={stage.key}
            stage={stage}
            caption={
              stage.ofPreviousPct != null
                ? `${stage.ofPreviousPct}% of ${stage.ofPreviousLabel?.toLowerCase()}`
                : stage.value != null && stage.ofPreviousLabel
                  ? "no share: counted on different links"
                  : "on the site"
            }
            captionTitle={
              stage.ofPreviousPct == null &&
              stage.value != null &&
              stage.ofPreviousLabel
                ? "No link carried both stages, so there is no fair share to show."
                : undefined
            }
          />
        ))}
        {report.reach.map((stage) => (
          <StageCell
            key={stage.key}
            stage={stage}
            upstream
            caption={
              stage.value == null
                ? "no platform reports this yet"
                : `${stage.channels} of ${stage.totalChannels} channels report it`
            }
          />
        ))}
      </div>
      <p className="text-ui-text-subtle mt-3 text-xs">
        Each percentage compares two stages on the same links only, so both
        numbers cover the same traffic. The +/− chips compare with the {days}{" "}
        days before. Showed counts only calls a rep marked as a show in Close,
        so it is a minimum while logging is incomplete. Seen (views,
        impressions, emails sent) and Clicked are what each platform reports
        about its own posts, ads and emails, before anyone reaches our site.
      </p>
    </section>
  );
}

function StageCell({
  stage,
  caption,
  captionTitle,
  upstream = false,
}: {
  stage: FunnelStage;
  caption: string;
  captionTitle?: string;
  upstream?: boolean;
}) {
  return (
    <div className="px-4 first:pl-0">
      <p className={adminEyebrowClass}>
        {upstream ? `${stage.label} (on platform)` : stage.label}
      </p>
      {stage.value == null ? (
        <p
          className="text-ui-text-subtle mt-2 text-xl leading-none font-semibold"
          title="No data for this stage in this range."
        >
          &mdash;
        </p>
      ) : (
        <p className="text-ui-text mt-2 flex flex-wrap items-baseline gap-2 text-xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
          {stage.value.toLocaleString()}
          <Delta current={stage.value} prior={stage.prior} />
        </p>
      )}
      <p className="text-ui-text-subtle mt-1.5 text-xs" title={captionTitle}>
        {stage.value == null ? "no data for this range" : caption}
      </p>
    </div>
  );
}

const COLUMNS: ReadonlyArray<{
  key: keyof ChannelReportRow["metrics"];
  label: string;
  format: "number" | "money";
}> = [
  { key: "spend", label: "Spend", format: "money" },
  { key: "impressions", label: "Seen", format: "number" },
  { key: "clicks", label: "Clicks", format: "number" },
  { key: "visits", label: "Visits", format: "number" },
  { key: "leads", label: "Leads", format: "number" },
  // Webinar registrations, off-site GHL forms, ManyChat: not site leads.
  { key: "contacts", label: "Registrations & contacts", format: "number" },
  { key: "booked", label: "Booked", format: "number" },
  { key: "showed", label: "Showed", format: "number" },
  { key: "won", label: "Won", format: "number" },
];

/**
 * One total over every source the table stands for, collapsed tail included,
 * so the footer can never disagree with the rows above it.
 *
 * A column stays a dash when no source reported it: summing unobserved as zero
 * is how a connector outage comes to look like a real number.
 *
 * The rate columns are deliberately empty. A rate over the totals is a
 * different measure from the per-row rates above it — totals-over-totals moves
 * Chatbot from 53.7% to 82.9% (REPORTING.md section 4) — and two definitions
 * under one column heading is the mistake this dashboard keeps making.
 */
export function totalMetric(
  rows: ChannelReportRow[],
  key: keyof ChannelReportRow["metrics"],
): number | null {
  const seen = rows
    .map((row) => row.metrics[key])
    .filter((value): value is number => value != null);
  return seen.length === 0 ? null : seen.reduce((a, b) => a + b, 0);
}

function ChannelTotals({ rows }: { rows: ChannelReportRow[] }) {
  if (rows.length === 0) return null;
  const sum = (key: keyof ChannelReportRow["metrics"]) =>
    totalMetric(rows, key);
  return (
    <tfoot>
      <tr className="border-ui-line text-ui-text border-t-2 font-semibold">
        <td className="py-2.5 pr-3">Total ({rows.length})</td>
        {COLUMNS.map((column) => (
          <td key={column.key} className="py-2.5 pr-3 text-right tabular-nums">
            <Cell value={sum(column.key)} format={column.format} />
          </td>
        ))}
        <td
          className="text-ui-text-subtle py-2.5 pr-3 text-right font-normal"
          title="A rate over the totals is a different measure from the per-row rates. Read the rates on the rows."
        >
          —
        </td>
        <td
          className="text-ui-text-subtle py-2.5 pr-3 text-right font-normal"
          title="A rate over the totals is a different measure from the per-row rates. Read the rates on the rows."
        >
          —
        </td>
        <td className="text-ui-text-subtle py-2.5 text-right font-normal">—</td>
      </tr>
    </tfoot>
  );
}

export function ChannelTable({
  title,
  rows,
  tail = [],
  logos = false,
  rowHref,
  legend = false,
}: {
  title: string;
  rows: ChannelReportRow[];
  /** Rows with visits only, shown collapsed under the table. */
  tail?: ChannelReportRow[];
  /** True when every row is a channel and so has a mark. Campaign rows do not. */
  logos?: boolean;
  rowHref?: (row: ChannelReportRow) => string;
  /** Prints the column key under the table. Once per tab is enough. */
  legend?: boolean;
}) {
  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className={adminEyebrowClass}>{title}</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Sorted by leads, then calls booked, then visits. Booked credits the
        channel that brought the person in, not the rep who set the call; the
        Booked calls tab shows that. &ldquo;Skipped form&rdquo; next to a booked
        count is how many of those people went straight to the calendar from a
        link (bio, DM, email) without filling in a lead form first: they count
        as booked, never as a lead.
      </p>
      {rows.length === 0 && tail.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No data in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <FreezeTableHead />
          <table className="w-full min-w-[52rem] text-[0.8125rem]">
            <thead className={adminStickyHeadClass}>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-3 font-semibold">
                  {title.replace(/^By /, "")}
                </th>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="py-2 pr-3 text-right font-semibold"
                  >
                    {column.label}
                  </th>
                ))}
                <th className="py-2 pr-3 text-right font-semibold">Lead %</th>
                <th className="py-2 pr-3 text-right font-semibold">Book %</th>
                <th className="py-2 text-right font-semibold">Cost / lead</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {rows.map((row) => (
                <ChannelRow
                  key={row.key}
                  row={row}
                  logos={logos}
                  rowHref={rowHref}
                />
              ))}
            </tbody>
            <ChannelTotals rows={[...rows, ...tail]} />
          </table>
          {tail.length > 0 ? (
            <details className="border-ui-line mt-2 border-t pt-2">
              <summary className="text-ui-text-muted cursor-pointer text-xs select-none">
                {tail.length} more {tail.length === 1 ? "source" : "sources"}{" "}
                with visits only (
                {tail
                  .reduce((sum, row) => sum + (row.metrics.visits ?? 0), 0)
                  .toLocaleString()}{" "}
                visits, no leads, bookings or spend recorded)
              </summary>
              <table className="mt-2 w-full min-w-[52rem] text-[0.8125rem]">
                <tbody className="divide-ui-line divide-y">
                  {tail.map((row) => (
                    <ChannelRow
                      key={row.key}
                      row={row}
                      logos={logos}
                      rowHref={rowHref}
                    />
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </div>
      )}
      {legend ? <ChannelTableKey /> : null}
    </section>
  );
}

/** The column key, on screen: a `title` never shows on a phone. */
function ChannelTableKey() {
  return (
    <dl className="text-ui-text-subtle mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
      {CHANNEL_TABLE_KEY.map(([term, meaning]) => (
        <div key={term}>
          <dt className="text-ui-text-muted inline font-semibold">{term}: </dt>
          <dd className="inline">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

const CHANNEL_TABLE_KEY: ReadonlyArray<readonly [string, string]> = [
  ["Seen", "views, impressions or emails sent, as the platform reports them."],
  [
    "Registrations & contacts",
    "webinar registrations, off-site GHL forms and ManyChat contacts. Not counted as leads.",
  ],
  ["Lead %", "leads out of site visits."],
  [
    "Book %",
    "calls booked out of leads plus registrations & contacts, on links that brought in a sign-up. Skipped-form bookings are left out.",
  ],
  [
    "Cost / lead",
    "spend divided by leads. “/ sign-up” means spend divided by leads plus registrations, used where most of the spend bought registrations.",
  ],
  [
    "n/a",
    "both numbers exist but were mostly counted on different links (leads taken off our site, or bookings with no form), so there is no fair rate.",
  ],
  [
    "Total row",
    "rates are left blank, because a rate over the totals is a different measure. Read the rates on each row.",
  ],
  ["—", "no data, which is different from zero."],
];

function ChannelRow({
  row,
  logos,
  rowHref,
}: {
  row: ChannelReportRow;
  logos: boolean;
  rowHref?: (row: ChannelReportRow) => string;
}) {
  return (
    <tr>
      <td className="text-ui-text py-2.5 pr-3 font-medium whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          {logos ? <ChannelLogo label={row.label} /> : null}
          {rowHref ? (
            <Link
              href={rowHref(row)}
              className="text-ui-accent underline-offset-2 hover:underline"
            >
              {row.label}
            </Link>
          ) : (
            row.label
          )}
        </span>
      </td>
      {COLUMNS.map((column) => (
        <td
          key={column.key}
          className="text-ui-text py-2.5 pr-3 text-right tabular-nums"
        >
          <Cell value={row.metrics[column.key]} format={column.format} />
          {column.key === "leads" && row.metrics.leads != null ? (
            <span className="ml-1 inline-block align-middle">
              <Delta current={row.metrics.leads} prior={row.prior.leads} />
            </span>
          ) : null}
          {column.key === "booked" && row.directBooked ? (
            <span
              className="text-ui-text-subtle ml-1 text-xs"
              title="Booked straight from a Calendly link (bio, DM, email) without filling in a lead form first. Counted as booked, never as a lead."
            >
              ({row.directBooked} skipped form)
            </span>
          ) : null}
        </td>
      ))}
      <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
        <RateCell
          value={row.rates.leadPct}
          numerator={row.metrics.leads}
          denominator={row.metrics.visits}
          why="No link carried both visits and leads, so leads and visits are different populations here (leads captured off-site, say)."
        />
      </td>
      <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
        <RateCell
          value={row.rates.bookPct}
          numerator={row.metrics.booked}
          denominator={row.metrics.leads}
          why="No link carried both leads and bookings; the bookings here came without a lead form."
        />
      </td>
      <td className="text-ui-text py-2.5 text-right font-semibold tabular-nums">
        {row.costPerSignup != null ? (
          <span title="Most of this spend bought registrations or off-site sign-ups, not site leads, so it is divided by site leads plus sign-ups.">
            {formatValue(row.costPerSignup, "money")}
            <span className="text-ui-text-subtle ml-1 text-xs font-normal">
              / sign-up
            </span>
          </span>
        ) : (
          <Cell value={row.costPerLead} format="money" />
        )}
      </td>
    </tr>
  );
}

/** A rate, or why there is none although both numbers exist. */
function RateCell({
  value,
  numerator,
  denominator,
  why,
}: {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  why: string;
}) {
  if (value != null) return <>{formatValue(value, "percent")}</>;
  if (numerator != null && denominator != null) {
    return (
      <span className="text-ui-text-subtle" title={why}>
        n/a
      </span>
    );
  }
  return <Cell value={null} format="percent" />;
}

const CHECK_TONE: Record<CheckStatus, string> = {
  ok: "active",
  warn: "pending",
  fail: "failed",
  info: "idle",
};

const CHECK_LABEL: Record<CheckStatus, string> = {
  ok: "Matches",
  warn: "Check",
  fail: "Off",
  info: "Note",
};

export function ConfidencePanel({ report }: { report: ConfidenceReport }) {
  return (
    <section className={adminCardClass} aria-label="Data confidence">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className={adminEyebrowClass}>Data confidence</h2>
        <AdminStatusBadge
          status={CHECK_TONE[report.status]}
          label={
            report.status === "ok"
              ? "Numbers match their sources"
              : report.status === "fail"
                ? "A number is off from its source"
                : report.status === "warn"
                  ? "Gaps to look at"
                  : "Notes"
          }
        />
      </div>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Checks the numbers on this tab against the original records they came
        from, then checks that each channel is reporting everything it should.
      </p>
      <ul className="divide-ui-line mt-3 divide-y">
        {report.checks.map((check) => (
          <li
            key={check.id}
            className="flex flex-wrap items-baseline gap-3 py-2 text-[0.8125rem]"
          >
            <AdminStatusBadge
              status={CHECK_TONE[check.status]}
              label={CHECK_LABEL[check.status]}
            />
            <span className="text-ui-text min-w-[14rem] font-medium">
              {check.label}
            </span>
            <span className="text-ui-text-muted min-w-0 flex-1 text-xs">
              {check.detail}
            </span>
          </li>
        ))}
      </ul>

      <h3 className={`${adminEyebrowClass} mt-5`}>What each channel reports</h3>
      <p className="text-ui-text-subtle mt-2 text-xs">
        A filled dot means we have data for it in this range. A hollow red dot
        is something the channel should report but nothing came in; the reason
        is listed under the table. A dash means that channel does not report it.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-[0.8125rem]">
          <thead>
            <tr
              className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
            >
              <th className="py-2 pr-3 font-semibold">Channel</th>
              {COVERAGE_KEYS.map((column) => (
                <th
                  key={column.key}
                  className="py-2 pr-3 text-center font-semibold"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {report.coverage.map((row) => (
              <tr key={row.channel}>
                <td className="text-ui-text py-2 pr-3 font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <ChannelLogo label={row.channel} />
                    {row.channel}
                  </span>
                </td>
                {COVERAGE_KEYS.map((column) => {
                  const cell = row.cells[column.key];
                  return (
                    <td
                      key={column.key}
                      className="py-2 pr-3 text-center"
                      title={
                        cell.observed
                          ? "Data in this range."
                          : cell.expected
                            ? (cell.cause ?? "Expected, but no data came in.")
                            : "This channel does not report it."
                      }
                    >
                      {cell.observed ? (
                        <span className="bg-ui-accent inline-block h-2.5 w-2.5 rounded-full" />
                      ) : cell.expected ? (
                        <span className="border-ui-bad inline-block h-2.5 w-2.5 rounded-full border-2" />
                      ) : (
                        <span className="text-ui-text-subtle">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CoverageGaps report={report} />
    </section>
  );
}

/** The cause behind each hollow dot, on screen rather than only on hover. */
function CoverageGaps({ report }: { report: ConfidenceReport }) {
  const gaps = report.coverage.flatMap((row) =>
    COVERAGE_KEYS.filter(
      ({ key }) => row.cells[key].expected && !row.cells[key].observed,
    ).map(({ key, label }) => ({
      id: `${row.channel}-${key}`,
      text: `${row.channel}, ${label}: ${row.cells[key].cause ?? "Expected, but no data came in."}`,
    })),
  );
  if (gaps.length === 0) return null;
  return (
    <ul className="text-ui-text-subtle mt-3 space-y-0.5 text-xs">
      {gaps.map((gap) => (
        <li key={gap.id}>{gap.text}</li>
      ))}
    </ul>
  );
}

export function GoingOutTable({
  canEdit,
  rows,
  days,
}: {
  canEdit: boolean;
  rows: GoingOutRow[];
  days: number;
}) {
  return (
    <section className={adminCardClass} aria-label="Going out">
      <h2 className={adminEyebrowClass}>Going out</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Every link built at{" "}
        <AdminViewerLink
          canEdit={canEdit}
          href="/admin/links"
          className="text-ui-accent underline-offset-2 hover:underline"
        >
          /admin/links
        </AdminViewerLink>
        , with its Bitly clicks in the last {days} days. A link without a Bitly
        short link has no click count. &ldquo;Sends to&rdquo; is where the link
        takes people.
      </p>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No links in the registry yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <FreezeTableHead />
          <table className="w-full min-w-[52rem] text-[0.8125rem]">
            <thead className={adminStickyHeadClass}>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-3 font-semibold">Link</th>
                <th className="py-2 pr-3 font-semibold">Source</th>
                <th className="py-2 pr-3 font-semibold">Campaign</th>
                <th className="py-2 pr-3 font-semibold">Content</th>
                <th className="py-2 pr-3 font-semibold">Sends to</th>
                <th className="py-2 text-right font-semibold">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="text-ui-text max-w-[16rem] py-2.5 pr-3 font-medium">
                    <a
                      href={row.bitly_url ?? row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ui-accent block truncate underline-offset-2 hover:underline"
                      title={row.url}
                    >
                      {row.label ?? row.bitly_url ?? row.url}
                    </a>
                  </td>
                  <td className="text-ui-text py-2.5 pr-3">
                    {row.utm_source}
                    <span className="text-ui-text-subtle">
                      {" "}
                      · {row.utm_medium}
                    </span>
                  </td>
                  <td className="text-ui-text py-2.5 pr-3">
                    {row.utm_campaign}
                  </td>
                  <td className="text-ui-text-muted py-2.5 pr-3">
                    {row.utm_content}
                  </td>
                  <td className="text-ui-text py-2.5 pr-3">{row.utm_term}</td>
                  <td className="text-ui-text py-2.5 text-right font-semibold tabular-nums">
                    {row.clicks == null ? (
                      <span
                        className="text-ui-text-subtle font-normal"
                        title="No short link, so Bitly has nothing to count."
                      >
                        no short link
                      </span>
                    ) : (
                      <>
                        <span className="mr-1 inline-block align-middle">
                          <Delta current={row.clicks} prior={row.priorClicks} />
                        </span>
                        {row.clicks.toLocaleString()}
                      </>
                    )}
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

export function FixLinksPanel({
  rows,
  days,
}: {
  rows: FixLinkRow[];
  days: number;
}) {
  return (
    <section className={adminCardClass} aria-label="Fix these links">
      <h2 className={adminEyebrowClass}>Fix these links</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Posts from the last {days} days whose link is missing the tracking tags
        we require. Rebuild the link at /admin/links and edit the post.
      </p>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          Every posted link in this range has the required tracking tags.
        </p>
      ) : (
        <ul className="divide-ui-line mt-3 divide-y">
          {rows.map((row) => (
            <li key={row.post_id} className="py-2.5 text-[0.8125rem]">
              <div className="flex items-baseline gap-2">
                <span className="text-ui-text font-medium capitalize">
                  {row.network}
                </span>
                <span className="text-ui-text-subtle text-xs">
                  {String(row.published_at).slice(0, 10)}
                </span>
                {row.permalink ? (
                  <a
                    href={row.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ui-accent ml-auto text-xs underline-offset-2 hover:underline"
                  >
                    Open post
                  </a>
                ) : null}
              </div>
              {row.link ? (
                <p
                  className="text-ui-text-muted mt-0.5 truncate text-xs"
                  title={row.link}
                >
                  {row.link}
                </p>
              ) : null}
              <ul className="text-ui-text-muted mt-1 list-disc pl-4 text-xs">
                {row.link_problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const HEALTH_TONE: Record<SyncHealthRow["status"], string> = {
  ok: "active",
  empty: "pending",
  skipped: "idle",
  failed: "failed",
  stale: "pending",
  never: "idle",
};

const HEALTH_LABEL: Record<SyncHealthRow["status"], string> = {
  ok: "Synced",
  empty: "No new data",
  skipped: "Not connected",
  failed: "Failed",
  stale: "Out of date",
  never: "Never ran",
};

export function SyncHealthPanel({ rows }: { rows: SyncHealthRow[] }) {
  return (
    <section className={adminCardClass} aria-label="Connector health">
      <h2 className={adminEyebrowClass}>Data feeds</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        When each source last sent us data, and how many records it saved. A red
        line means the numbers above stopped updating for that source.
      </p>
      <ul className="divide-ui-line mt-3 divide-y">
        {rows.map((row) => (
          <li
            key={row.connector}
            className="flex flex-wrap items-center gap-3 py-2 text-[0.8125rem]"
          >
            <span className="text-ui-text inline-flex min-w-[10rem] items-center gap-2 font-medium">
              <ChannelLogo label={row.connector} />
              {connectorLabel(row.connector)}
            </span>
            <AdminStatusBadge
              status={HEALTH_TONE[row.status]}
              label={HEALTH_LABEL[row.status]}
            />
            <span className="text-ui-text-muted">
              {row.finishedAt
                ? `${relativeTime(row.finishedAt)} · ${row.rowsWritten.toLocaleString()} records`
                : ""}
            </span>
            {row.note ? (
              <span className="text-ui-text-subtle min-w-0 flex-1 truncate text-xs">
                {row.note}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Cell({
  value,
  format,
}: {
  value: number | null;
  format: "number" | "money" | "percent";
}) {
  if (value == null) {
    return (
      <span className="text-ui-text-subtle" title="No data">
        —
      </span>
    );
  }
  return <>{formatValue(value, format)}</>;
}

function Delta({ current, prior }: { current: number; prior: number | null }) {
  if (prior == null || prior === 0) {
    return <AdminDeltaChip tone="neutral">no prior</AdminDeltaChip>;
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  const tone = pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
  return (
    <AdminDeltaChip tone={tone}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </AdminDeltaChip>
  );
}

function formatValue(value: number, format: "number" | "money" | "percent") {
  if (format === "money") {
    return `$${Math.round(value).toLocaleString()}`;
  }
  if (format === "percent") return `${value}%`;
  return value.toLocaleString();
}

/** "3h ago" / "2d ago". The exact timestamp is in the title attribute upstream. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
