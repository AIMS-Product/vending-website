import Link from "next/link";
import { AdminViewerLink } from "@/components/admin/AdminViewerLink";
import {
  AdminDeltaChip,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";
import type {
  ChannelReport,
  ChannelReportRow,
  FunnelStage,
  GoingOutRow,
  SyncHealthRow,
} from "@/lib/services/channel-report-rollup";
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
 * A null is rendered as "—" with "not observed" on hover. It is never a zero.
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
          The channel spine is not connected yet. Apply the
          <code className="mx-1">channel_daily</code>migration and run
          <code className="mx-1">/api/admin/channel-sync/run?days=400</code>
          once to backfill.
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
          <span className="text-ui-text font-semibold">{data.channel}</span>
        </p>
      ) : null}

      <ChannelKpis report={report} days={data.range.days} />

      <div className="grid gap-5 xl:grid-cols-3">
        <ChannelFunnel report={report} days={data.range.days} />
        <div className="xl:col-span-2">
          <ChannelTable
            title={data.channel ? "By campaign" : "By channel"}
            rows={report.rows}
            tail={report.tail}
            rowHref={
              data.channel
                ? undefined
                : (row) => channelsHref(range, includeInternal, row.key)
            }
          />
        </div>
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
      caption={value == null ? "not observed" : `vs prior ${days} days`}
      delta={
        value == null ? undefined : <Delta current={value} prior={prior} />
      }
    />
  );
  return (
    <AdminMetricStrip>
      {kpi("Spend", totals.spend, priorTotals.spend, "money")}
      {kpi("Leads", totals.leads, priorTotals.leads)}
      {kpi("Booked", totals.booked, priorTotals.booked)}
      {kpi("Won", totals.won, priorTotals.won)}
    </AdminMetricStrip>
  );
}

function ChannelFunnel({
  report,
  days,
}: {
  report: ChannelReport;
  days: number;
}) {
  const observed = report.funnel.filter((stage) => stage.value != null);
  const top = observed[0]?.value ?? null;
  return (
    <section className={adminCardClass} aria-label="Channel funnel">
      <h2 className={adminEyebrowClass}>On the site</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Each share is measured only where both stages were observed for the same
        link, so the two sides are one population. Deltas are against the prior{" "}
        {days} days. Showed is an upper bound: a booked call counts as shown
        unless its Close outcome says no-show or cancelled, so a call nobody
        logged an outcome for counts as shown.
      </p>
      <ol className="mt-3 space-y-2.5">
        {report.funnel.map((stage) => (
          <li key={stage.key} className="flex flex-col gap-1">
            <StageLine stage={stage} />
            {stage.value != null && top ? (
              <div className="h-1.5 w-full" aria-hidden="true">
                <div
                  className="bg-ui-accent h-1.5 rounded-r-[3px]"
                  style={{
                    width: `max(2px, ${Math.min(100, (stage.value / top) * 100)}%)`,
                  }}
                />
              </div>
            ) : null}
            {stage.ofPreviousPct != null ? (
              <p className="text-ui-text-subtle text-xs">
                {stage.ofPreviousPct}% of {stage.ofPreviousLabel?.toLowerCase()}
              </p>
            ) : stage.value != null && stage.ofPreviousLabel ? (
              <p
                className="text-ui-text-subtle text-xs"
                title="No link key carried both stages, so there is no honest share."
              >
                share not measurable
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      <h2 className={`${adminEyebrowClass} mt-6`}>Upstream, off the site</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        What the platforms report about their own surface. Each covers a
        different set of channels, so neither is a stage of the funnel above.
      </p>
      <ol className="mt-3 space-y-2.5">
        {report.reach.map((stage) => (
          <li key={stage.key} className="flex flex-col gap-0.5">
            <StageLine stage={stage} />
            <p className="text-ui-text-subtle text-xs">
              {stage.value == null
                ? "no connector reports this yet"
                : `reported by ${stage.channels} of ${stage.totalChannels} channels`}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StageLine({ stage }: { stage: FunnelStage }) {
  return (
    <div className="flex items-baseline gap-2 text-[0.8125rem]">
      <span className="text-ui-text min-w-0 flex-1 truncate">
        {stage.label}
      </span>
      {stage.value == null ? (
        <span
          className="text-ui-text-subtle shrink-0 text-xs"
          title="No connector observed this stage in the range."
        >
          not observed
        </span>
      ) : (
        <>
          <Delta current={stage.value} prior={stage.prior} />
          <span className="text-ui-text shrink-0 font-semibold tabular-nums">
            {stage.value.toLocaleString()}
          </span>
        </>
      )}
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
  { key: "booked", label: "Booked", format: "number" },
  { key: "showed", label: "Showed", format: "number" },
  { key: "won", label: "Won", format: "number" },
];

export function ChannelTable({
  title,
  rows,
  tail = [],
  rowHref,
}: {
  title: string;
  rows: ChannelReportRow[];
  /** Rows with visits only, shown collapsed under the table. */
  tail?: ChannelReportRow[];
  rowHref?: (row: ChannelReportRow) => string;
}) {
  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className={adminEyebrowClass}>{title}</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Sorted by leads, then bookings, then visits. Lead % is over every visit
        in the range; Book % is measured only on links where both sides were
        observed. Booked counts the channel that brought the person in, not who
        set the call — Bookings answers that.
      </p>
      {rows.length === 0 && tail.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          Nothing observed in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-[0.8125rem]">
            <thead>
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
                <ChannelRow key={row.key} row={row} rowHref={rowHref} />
              ))}
            </tbody>
          </table>
          {tail.length > 0 ? (
            <details className="border-ui-line mt-2 border-t pt-2">
              <summary className="text-ui-text-muted cursor-pointer text-xs select-none">
                {tail.length} more {tail.length === 1 ? "source" : "sources"}{" "}
                with visits only (
                {tail
                  .reduce((sum, row) => sum + (row.metrics.visits ?? 0), 0)
                  .toLocaleString()}{" "}
                visits, no leads, bookings or spend observed)
              </summary>
              <table className="mt-2 w-full min-w-[52rem] text-[0.8125rem]">
                <tbody className="divide-ui-line divide-y">
                  {tail.map((row) => (
                    <ChannelRow key={row.key} row={row} rowHref={rowHref} />
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ChannelRow({
  row,
  rowHref,
}: {
  row: ChannelReportRow;
  rowHref?: (row: ChannelReportRow) => string;
}) {
  return (
    <tr>
      <td className="text-ui-text py-2.5 pr-3 font-medium">
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
              title="Bookings from a Calendly link with no lead form behind them. Counted as booked, never as a lead."
            >
              ({row.directBooked} direct)
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
        <Cell value={row.costPerLead} format="money" />
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
              ? "Spine matches its sources"
              : report.status === "fail"
                ? "Spine is off from a source"
                : report.status === "warn"
                  ? "Gaps to look at"
                  : "Notes"
          }
        />
      </div>
      <p className="text-ui-text-subtle mt-2 text-xs">
        The numbers above, checked against the tables they were built from, then
        every channel against what its connectors should report.
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

      <h3 className={`${adminEyebrowClass} mt-5`}>Coverage by channel</h3>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Filled means a connector observed it in range. A hollow mark is a metric
        the channel should report but nothing did; hover for the cause. A dash
        is not expected for that channel.
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
                <td className="text-ui-text py-2 pr-3 font-medium">
                  {row.channel}
                </td>
                {COVERAGE_KEYS.map((column) => {
                  const cell = row.cells[column.key];
                  return (
                    <td
                      key={column.key}
                      className="py-2 pr-3 text-center"
                      title={
                        cell.observed
                          ? "Observed in range."
                          : cell.expected
                            ? (cell.cause ?? "Expected, not observed.")
                            : "Not expected for this channel."
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
    </section>
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
        , with Bitly clicks in the last {days} days. A link with no short link
        has no click count to observe.
      </p>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No links in the registry yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-[0.8125rem]">
            <thead>
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
        Posts from the last {days} days whose link is missing the standard.
        Rebuild the link at /admin/links and edit the post.
      </p>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          Every posted link in this range carries the standard.
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
  skipped: "idle",
  failed: "failed",
  stale: "pending",
  never: "idle",
};

const HEALTH_LABEL: Record<SyncHealthRow["status"], string> = {
  ok: "Synced",
  skipped: "Not connected",
  failed: "Failed",
  stale: "Stale",
  never: "Never run",
};

export function SyncHealthPanel({ rows }: { rows: SyncHealthRow[] }) {
  return (
    <section className={adminCardClass} aria-label="Connector health">
      <h2 className={adminEyebrowClass}>Connectors</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        A red row means the numbers above stopped updating for that source.
      </p>
      <ul className="divide-ui-line mt-3 divide-y">
        {rows.map((row) => (
          <li
            key={row.connector}
            className="flex flex-wrap items-center gap-3 py-2 text-[0.8125rem]"
          >
            <span className="text-ui-text min-w-[9rem] font-medium">
              {row.connector}
            </span>
            <AdminStatusBadge
              status={HEALTH_TONE[row.status]}
              label={HEALTH_LABEL[row.status]}
            />
            <span className="text-ui-text-muted">
              {row.finishedAt
                ? `${relativeTime(row.finishedAt)} · ${row.rowsWritten.toLocaleString()} rows`
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
      <span className="text-ui-text-subtle" title="Not observed">
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
