import Link from "next/link";
import { adminCardClass } from "@/components/admin/AdminUi";
import type {
  AdminAnalyticsBreakdownRow,
  AdminAnalyticsDailyTrendRow,
  AdminAnalyticsMetric,
} from "@/lib/services/admin-analytics";
import type {
  AnalyticsCampaignRow,
  AnalyticsFunnelStep,
} from "@/lib/services/admin-analytics-detail";
import {
  ADMIN_ANALYTICS_RANGES,
  ADMIN_ANALYTICS_RANGE_KEYS,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";

const ACCENT = "#0b63f6";

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
      className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
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
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
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
      className="inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          includeInternal
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-300 bg-white"
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
        <span className="text-slate-500">({excludedCount} hidden)</span>
      ) : null}
    </Link>
  );
}

export function AnalyticsKpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="mb-5 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Headline metrics"
    >
      {children}
    </section>
  );
}

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
  const display =
    format === "percent"
      ? `${formatNumber(metric.value)}%`
      : formatNumber(metric.value);

  return (
    <div className="bg-white px-5 py-4">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-slate-950">
          {display}
        </p>
        {metric.spark.length > 0 ? <Sparkline values={metric.spark} /> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DeltaChip metric={metric} format={format} />
        <span className="text-xs text-slate-500">{caption}</span>
      </div>
    </div>
  );
}

/**
 * Percentage change against the prior window. When the prior window was zero a
 * percentage is undefined, so the absolute change is shown instead — this is
 * the difference between an honest "+3 vs 0" and a fake "+300%".
 */
function DeltaChip({
  metric,
  format,
}: {
  metric: AdminAnalyticsMetric;
  format: "number" | "percent";
}) {
  const suffix = format === "percent" ? "%" : "";

  if (metric.value === 0 && metric.prior === 0) {
    return <Chip tone="neutral">no activity</Chip>;
  }
  if (metric.deltaPct === null) {
    return (
      <Chip tone="up">
        new · {formatNumber(metric.value)}
        {suffix} vs 0
      </Chip>
    );
  }
  if (metric.deltaPct === 0) {
    return <Chip tone="neutral">flat vs prior</Chip>;
  }

  const rising = metric.deltaPct > 0;
  return (
    <Chip tone={rising ? "up" : "down"}>
      {rising ? "▲" : "▼"} {Math.abs(metric.deltaPct)}% vs{" "}
      {formatNumber(metric.prior)}
      {suffix}
    </Chip>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "up" | "down" | "neutral";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "up"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "down"
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 72;
  const height = 26;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={`Trend: ${values.join(", ")}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      <h2 className="mb-4 text-sm font-semibold text-slate-500 uppercase">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="grid gap-2.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-700">
                  {row.label}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-slate-950">
                    {row.count}
                  </span>
                  {total > 0 ? (
                    <span className="ml-1.5 text-xs text-slate-500">
                      {Math.round((row.count / total) * 100)}%
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${(row.count / maxCount) * 100}%`,
                    backgroundColor: ACCENT,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
      <h2 className="mb-4 text-sm font-semibold text-slate-500 uppercase">
        Leads and bookings per day
      </h2>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
        {rows.map((row) => (
          <div
            key={row.date}
            className="flex min-w-[1.75rem] flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex h-28 w-full items-end justify-center gap-0.5">
              <Bar
                value={row.leads}
                max={maxValue}
                color={ACCENT}
                title={`${row.leads} leads on ${row.date}`}
              />
              <Bar
                value={row.bookings}
                max={maxValue}
                color="#34d399"
                title={`${row.bookings} bookings on ${row.date}`}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-500">
              {formatShortDate(row.date)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <LegendDot color={ACCENT} label="Leads" />
        <LegendDot color="#34d399" label="Bookings from leads" />
      </div>
    </section>
  );
}

function Bar({
  value,
  max,
  color,
  title,
}: {
  value: number;
  max: number;
  color: string;
  title: string;
}) {
  return (
    <div
      className="w-2.5 rounded-t"
      style={{
        height: `${Math.max(2, (value / max) * 100)}%`,
        backgroundColor: value > 0 ? color : "#e2e8f0",
      }}
      title={title}
    />
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
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
      className="mb-5 flex flex-wrap gap-1 border-b border-slate-200"
      aria-label="Analytics sections"
    >
      {ANALYTICS_TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={analyticsHref(range, includeInternal, tab.key)}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
              isActive
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
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
export function AnalyticsFunnel({ steps }: { steps: AnalyticsFunnelStep[] }) {
  return (
    <section className={adminCardClass} aria-label="Conversion funnel">
      <h2 className="mb-4 text-sm font-semibold text-slate-500 uppercase">
        From visitor to booked call
      </h2>
      <ol className="grid gap-3">
        {steps.map((step, index) => (
          <li key={step.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">{step.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold text-slate-950">
                  {step.count}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {step.ofTopPct}% of all
                </span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
              <div
                className="h-2.5 rounded-full"
                style={{
                  width: `${Math.max(step.ofTopPct, step.count > 0 ? 2 : 0)}%`,
                  backgroundColor: ACCENT,
                }}
              />
            </div>
            {index > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                {step.ofPreviousPct}% continued from the step above
                {step.ofPreviousPct < 100 ? (
                  <span className="text-rose-600">
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
      <h2 className="mb-4 text-sm font-semibold text-slate-500 uppercase">
        Campaign performance
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No campaigns in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3 text-right">Leads</th>
                <th className="py-2 pr-3 text-right">Qualified</th>
                <th className="py-2 pr-3 text-right">Booked</th>
                <th className="py-2 text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.campaign}-${row.source}`}>
                  <td className="py-2 pr-3 font-medium text-slate-800">
                    {row.campaign}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{row.source}</td>
                  <td className="py-2 pr-3 text-right text-slate-900 tabular-nums">
                    {row.leads}
                  </td>
                  <td className="py-2 pr-3 text-right text-slate-900 tabular-nums">
                    {row.qualified}
                  </td>
                  <td className="py-2 pr-3 text-right text-slate-900 tabular-nums">
                    {row.booked}
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-950 tabular-nums">
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
