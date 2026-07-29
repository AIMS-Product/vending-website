import Link from "next/link";
import {
  AdminBar,
  AdminDeltaChip,
  AdminMetricPanel,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import type {
  AdminAnalyticsBreakdownRow,
  AdminAnalyticsDailyTrendRow,
  AdminAnalyticsMetric,
} from "@/lib/services/admin-analytics";
import type {
  AnalyticsCampaignRow,
  AnalyticsFunnelContext,
  AnalyticsFunnelStep,
} from "@/lib/services/admin-analytics-detail";
import {
  ADMIN_ANALYTICS_RANGES,
  ADMIN_ANALYTICS_RANGE_KEYS,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";

/** Segmented range switcher. Plain links so the page stays a Server Component. */
export function AnalyticsRangeTabs({
  active,
  includeInternal,
  tab,
}: {
  active: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  tab: string;
}) {
  return (
    <div
      className="border-ui-line rounded-ui bg-ui-surface shadow-ui inline-flex border p-0.5"
      role="group"
      aria-label="Date range"
    >
      {ADMIN_ANALYTICS_RANGE_KEYS.map((key) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={analyticsHref(key, includeInternal, tab)}
            aria-current={isActive ? "page" : undefined}
            // Selection is a soft fill. A filled dark segment would be a second
            // filled control competing with the page's primary button.
            className={`rounded-[4px] px-2.5 py-1 text-[0.8125rem] font-medium transition ${
              isActive
                ? "bg-ui-accent-soft text-ui-accent"
                : "text-ui-text-muted hover:text-ui-text"
            }`}
          >
            {ADMIN_ANALYTICS_RANGES[key].label}
          </Link>
        );
      })}
    </div>
  );
}

export function AnalyticsInternalToggle({
  range,
  includeInternal,
  excludedCount,
  tab,
}: {
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  excludedCount: number;
  tab: string;
}) {
  return (
    <Link
      href={analyticsHref(range, !includeInternal, tab)}
      className="border-ui-line text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text rounded-ui bg-ui-surface shadow-ui inline-flex items-center gap-2 border px-2.5 py-1.5 text-[0.8125rem] font-medium transition"
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded-[3px] border ${
          includeInternal
            ? "border-ui-accent bg-ui-accent text-white"
            : "border-ui-line-strong bg-ui-surface"
        }`}
      >
        {includeInternal ? (
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
            <path
              d="M3.5 8.5l3 3 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      Include test &amp; internal leads
      {!includeInternal && excludedCount > 0 ? (
        <span className="text-ui-text-subtle">({excludedCount} hidden)</span>
      ) : null}
    </Link>
  );
}

/**
 * A headline number, rendered through the shared metric strip so the analytics
 * row is the same object as the one on Leads, News and Libraries.
 *
 * There is no sparkline. The series behind these numbers is plotted full width
 * by `AnalyticsTrend` further down the same page; a 72px copy of it beside the
 * value was a near-flat line that could not carry the shape, and the booking
 * rate is a ratio of two windows with no per-day series to plot at all, so one
 * of the four was always blank.
 */
export function AnalyticsKpiCard({
  label,
  metric,
  caption,
  format = "number",
}: {
  label: string;
  metric: AdminAnalyticsMetric;
  caption: string;
  format?: "number" | "percent";
}) {
  const suffix = format === "percent" ? "%" : "";
  return (
    <AdminMetricPanel
      label={label}
      value={`${formatNumber(metric.value)}${suffix}`}
      caption={caption}
      delta={<DeltaChip metric={metric} format={format} />}
    />
  );
}

/**
 * Percentage change against the prior window. When the prior window was zero a
 * percentage is undefined, so the state is named instead — this is the
 * difference between an honest "new" and a fake "+300%".
 *
 * The sign carries the direction as well as the colour, so the chip still reads
 * in greyscale. The prior value moves to the tooltip: it is context for a
 * number you are already looking at, not something to scan a row of cards for.
 */
function DeltaChip({
  metric,
  format,
}: {
  metric: AdminAnalyticsMetric;
  format: "number" | "percent";
}) {
  const suffix = format === "percent" ? "%" : "";
  const priorLabel = `Prior window: ${formatNumber(metric.prior)}${suffix}`;

  if (metric.value === 0 && metric.prior === 0) {
    return <AdminDeltaChip tone="neutral">no activity</AdminDeltaChip>;
  }
  if (metric.deltaPct === null) {
    return (
      <span title={priorLabel}>
        <AdminDeltaChip tone="up">new</AdminDeltaChip>
      </span>
    );
  }
  if (metric.deltaPct === 0) {
    return (
      <span title={priorLabel}>
        <AdminDeltaChip tone="neutral">flat</AdminDeltaChip>
      </span>
    );
  }

  const rising = metric.deltaPct > 0;
  return (
    <span title={priorLabel}>
      <AdminDeltaChip tone={rising ? "up" : "down"}>
        {rising ? "+" : "−"}
        {Math.abs(metric.deltaPct)}%
      </AdminDeltaChip>
    </span>
  );
}

/**
 * A ranked list. Rows are already sorted by count, so the job here is to make
 * the decline from first to last legible: an explicit rank, one line of text
 * per row, and a bar with nothing behind it.
 */
export function AnalyticsBreakdown({
  title,
  rows,
  emptyLabel = "No data in this range.",
}: {
  title: string;
  rows: AdminAnalyticsBreakdownRow[];
  emptyLabel?: string;
}) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className={adminEyebrowClass}>{title}</h2>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">{emptyLabel}</p>
      ) : (
        <ol className="mt-3 grid gap-1.5">
          {rows.map((row, index) => (
            <li key={row.label} className="grid gap-1">
              <div className="flex items-baseline gap-2 text-[0.8125rem]">
                <span className="text-ui-text-subtle w-5 shrink-0 tabular-nums">
                  {index + 1}
                </span>
                <span
                  className="text-ui-text min-w-0 flex-1 truncate"
                  title={row.label}
                >
                  {row.label}
                </span>
                <span className="text-ui-text shrink-0 font-semibold tabular-nums">
                  {row.count}
                </span>
                <span className="text-ui-text-subtle w-9 shrink-0 text-right text-xs tabular-nums">
                  {sharePct(row.count, total)}
                </span>
              </div>
              <AdminBar share={row.count / maxCount} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Rounding a real row down to "0%" reads as "nothing happened here", which is
 * not what the row says. Anything that happened at least once floors at "<1%".
 */
function sharePct(count: number, total: number): string {
  if (total <= 0) return "";
  const pct = (count / total) * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

export function AnalyticsTrend({
  rows,
}: {
  rows: AdminAnalyticsDailyTrendRow[];
}) {
  const maxValue = Math.max(
    1,
    ...rows.map((row) => Math.max(row.leads, row.bookings)),
  );

  return (
    <section className={adminCardClass} aria-label="Daily trend">
      <h2 className={adminEyebrowClass}>Leads and bookings per day</h2>
      <div className="mt-3 flex items-end gap-1.5 overflow-x-auto pb-1">
        {rows.map((row) => (
          <div
            key={row.date}
            className="flex min-w-[1.75rem] flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex h-24 w-full items-end justify-center gap-0.5">
              <Bar
                value={row.leads}
                max={maxValue}
                fill="bg-ui-accent"
                title={`${row.leads} leads on ${row.date}`}
              />
              <Bar
                value={row.bookings}
                max={maxValue}
                fill="bg-ui-ok"
                title={`${row.bookings} bookings on ${row.date}`}
              />
            </div>
            <span className="text-ui-text-subtle text-[10px] tabular-nums">
              {formatShortDate(row.date)}
            </span>
          </div>
        ))}
      </div>
      {/* Two series, so a key is doing real work here: it is the only thing
          naming which column is which. */}
      <div className="text-ui-text-muted mt-3 flex items-center gap-4 text-xs">
        <LegendDot fill="bg-ui-accent" label="Leads" />
        <LegendDot fill="bg-ui-ok" label="Bookings from leads" />
      </div>
    </section>
  );
}

function Bar({
  value,
  max,
  fill,
  title,
}: {
  value: number;
  max: number;
  fill: string;
  title: string;
}) {
  return (
    <div
      className={`w-2.5 rounded-t-[2px] ${value > 0 ? fill : "bg-ui-line"}`}
      style={{ height: `${Math.max(2, (value / max) * 100)}%` }}
      title={title}
    />
  );
}

function LegendDot({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`size-2 shrink-0 rounded-full ${fill}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function analyticsHref(
  range: AdminAnalyticsRangeKey,
  includeInternal: boolean,
  tab?: string,
): string {
  const params = new URLSearchParams({ range });
  if (includeInternal) params.set("internal", "1");
  if (tab && tab !== "overview") params.set("tab", tab);
  return `/admin/analytics?${params.toString()}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${month}/${day}`;
}

export const ANALYTICS_TABS = [
  { key: "overview", label: "Overview" },
  { key: "acquisition", label: "Acquisition" },
  { key: "pages", label: "Pages & funnel" },
  { key: "quality", label: "Lead quality" },
] as const;

export type AnalyticsTabKey = (typeof ANALYTICS_TABS)[number]["key"];

export function parseAnalyticsTab(
  value: string | null | undefined,
): AnalyticsTabKey {
  const trimmed = value?.trim();
  const match = ANALYTICS_TABS.find((tab) => tab.key === trimmed);
  return match ? match.key : "overview";
}

export function AnalyticsTabs({
  active,
  range,
  includeInternal,
}: {
  active: AnalyticsTabKey;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
}) {
  return (
    <nav
      className="border-ui-line mb-5 flex flex-wrap gap-1 border-b"
      aria-label="Analytics sections"
    >
      {ANALYTICS_TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={analyticsHref(range, includeInternal, tab.key)}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-[0.8125rem] font-medium transition ${
              isActive
                ? "text-ui-text border-ui-accent"
                : "text-ui-text-subtle hover:text-ui-text border-transparent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Funnel with drop-off between consecutive steps. */
export function AnalyticsFunnel({
  steps,
  context,
}: {
  steps: AnalyticsFunnelStep[];
  context: AnalyticsFunnelContext;
}) {
  return (
    <section className={adminCardClass} aria-label="Conversion funnel">
      <h2 className={adminEyebrowClass}>From question to booked call</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        {context.contactsCaptured} contacts captured ·{" "}
        <span className="text-ui-text-muted font-medium">
          {context.offeredQuestions} were offered the questions
        </span>{" "}
        · {context.neverOfferedQuestions} came from booking or contact pages
        that never show them. Only the offered group is measured below.
      </p>
      <ol className="mt-3 grid gap-2.5">
        {steps.map((step, index) => (
          <li key={step.label} className="grid gap-1">
            <div className="flex items-baseline gap-2 text-[0.8125rem]">
              <span className="text-ui-text min-w-0 flex-1 truncate">
                {step.label}
              </span>
              <span className="text-ui-text shrink-0 font-semibold tabular-nums">
                {step.count}
              </span>
              <span className="text-ui-text-subtle w-9 shrink-0 text-right text-xs tabular-nums">
                {step.ofTopPct}%
              </span>
            </div>
            <AdminBar share={step.ofTopPct / 100} />
            {index > 0 ? (
              <p className="text-ui-text-subtle text-xs">
                {step.ofPreviousPct}% continued from the step above
                {step.ofPreviousPct < 100 ? (
                  <span className="text-ui-bad">
                    {" "}
                    · {round1(100 - step.ofPreviousPct)}% dropped off
                  </span>
                ) : null}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AnalyticsCampaignTable({
  rows,
}: {
  rows: AnalyticsCampaignRow[];
}) {
  return (
    <section className={adminCardClass} aria-label="Campaign performance">
      <h2 className={adminEyebrowClass}>Campaign performance</h2>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No campaigns in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-[0.8125rem]">
            <thead>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-3 font-semibold">Campaign</th>
                <th className="py-2 pr-3 font-semibold">Source</th>
                <th className="py-2 pr-3 text-right font-semibold">Leads</th>
                <th className="py-2 pr-3 text-right font-semibold">
                  Qualified
                </th>
                <th className="py-2 pr-3 text-right font-semibold">Booked</th>
                <th className="py-2 text-right font-semibold">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {rows.map((row) => (
                <tr key={`${row.campaign}-${row.source}`}>
                  <td className="text-ui-text py-2.5 pr-3 font-medium">
                    {row.campaign}
                  </td>
                  <td className="text-ui-text-muted py-2.5 pr-3">
                    {row.source}
                  </td>
                  <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
                    {row.leads}
                  </td>
                  <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
                    {row.qualified}
                  </td>
                  <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
                    {row.booked}
                  </td>
                  <td className="text-ui-text py-2.5 text-right font-semibold tabular-nums">
                    {row.bookingRatePct}%
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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
