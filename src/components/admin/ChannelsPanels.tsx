import Link from "next/link";
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
import type { ChannelsTabData } from "@/lib/services/channel-report";

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
  data,
  range,
  includeInternal,
}: {
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
        <ChannelFunnel stages={report.funnel} days={data.range.days} />
        <div className="xl:col-span-2">
          <ChannelTable
            title={data.channel ? "By campaign" : "By channel"}
            rows={report.rows}
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
        <div className="mt-5">
          <GoingOutTable rows={data.goingOut} days={data.range.days} />
        </div>
      )}

      <div className="mt-5">
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
  stages,
  days,
}: {
  stages: FunnelStage[];
  days: number;
}) {
  const observed = stages.filter((stage) => stage.value != null);
  const top = observed[0]?.value ?? null;
  return (
    <section className={adminCardClass} aria-label="Channel funnel">
      <h2 className={adminEyebrowClass}>Across every channel</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Each stage as a share of the nearest observed stage above it. Deltas are
        against the prior {days} days.
      </p>
      <ol className="mt-3 space-y-2.5">
        {stages.map((stage) => (
          <li key={stage.key} className="flex flex-col gap-1">
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
                {stage.ofPreviousPct}% of the stage above
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
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
  rowHref,
}: {
  title: string;
  rows: ChannelReportRow[];
  rowHref?: (row: ChannelReportRow) => string;
}) {
  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className={adminEyebrowClass}>{title}</h2>
      {rows.length === 0 ? (
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
                <tr key={row.key}>
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
                      <Cell
                        value={row.metrics[column.key]}
                        format={column.format}
                      />
                      {column.key === "leads" && row.metrics.leads != null ? (
                        <span className="ml-1 inline-block align-middle">
                          <Delta
                            current={row.metrics.leads}
                            prior={row.prior.leads}
                          />
                        </span>
                      ) : null}
                    </td>
                  ))}
                  <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
                    <Cell value={row.rates.leadPct} format="percent" />
                  </td>
                  <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
                    <Cell value={row.rates.bookPct} format="percent" />
                  </td>
                  <td className="text-ui-text py-2.5 text-right font-semibold tabular-nums">
                    <Cell value={row.costPerLead} format="money" />
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

export function GoingOutTable({
  rows,
  days,
}: {
  rows: GoingOutRow[];
  days: number;
}) {
  return (
    <section className={adminCardClass} aria-label="Going out">
      <h2 className={adminEyebrowClass}>Going out</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Every link built at{" "}
        <Link
          href="/admin/links"
          className="text-ui-accent underline-offset-2 hover:underline"
        >
          /admin/links
        </Link>
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
