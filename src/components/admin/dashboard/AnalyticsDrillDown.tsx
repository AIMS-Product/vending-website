import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCardClass, adminLinkClass } from "@/components/admin/AdminUi";
import {
  AnalyticsCustomRange,
  AnalyticsInternalToggle,
  AnalyticsRangeTabs,
  AnalyticsWeekPicker,
} from "@/components/admin/AnalyticsPanels";
import { DataTrustBar } from "@/components/admin/DataTrustBar";
import { pacificToday } from "@/lib/admin/format-time";
import type { TrustBarModel } from "@/lib/analytics/data-trust-bar";
import {
  parseAdminAnalyticsRange,
  toCustomRangeKey,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";

export type SearchParams = Record<string, string | string[] | undefined>;

export function singleParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The range and internal-leads toggle every drill-down carries in its URL. */
export function drillDownParams(params: SearchParams): {
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
} {
  return {
    range: parseAdminAnalyticsRange(
      toCustomRangeKey(singleParam(params.from), singleParam(params.to)) ??
        singleParam(params.range),
    ),
    includeInternal: singleParam(params.internal) === "1",
  };
}

/**
 * The frame of an analytics drill-down: the way back to the dashboard, its
 * own date controls (when the view is windowed), and the trust bar for the
 * feeds it reads.
 */
export function AnalyticsDrillDown({
  path,
  tab,
  title,
  description,
  user,
  range,
  includeInternal = false,
  internalExcluded,
  trust,
  children,
}: {
  path: string;
  /** The view key the shared range links route by. */
  tab: "channels" | "youtube" | "video" | "months";
  title: string;
  description: string;
  user: { email?: string | null; role: string | null };
  /** Omitted for views that are a fixed series (month over month). */
  range?: AdminAnalyticsRangeKey;
  includeInternal?: boolean;
  internalExcluded?: number;
  trust: Promise<TrustBarModel>;
  children: ReactNode;
}) {
  const today = pacificToday();
  return (
    <AdminShell
      activeSection="analytics"
      eyebrow="Analytics"
      title={title}
      description={description}
      userEmail={user.email}
      userRole={user.role}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/analytics"
          className={`${adminLinkClass} text-[0.8125rem]`}
        >
          Back to the dashboard
        </Link>
        {range ? (
          <div className="flex flex-wrap items-center gap-2">
            {internalExcluded !== undefined ? (
              <AnalyticsInternalToggle
                range={range}
                includeInternal={includeInternal}
                excludedCount={internalExcluded}
                tab={tab}
              />
            ) : null}
            <AnalyticsWeekPicker
              active={range}
              includeInternal={includeInternal}
              tab="overview"
              today={today}
              action={path}
            />
            <AnalyticsCustomRange
              active={range}
              includeInternal={includeInternal}
              tab="overview"
              today={today}
              action={path}
            />
            <AnalyticsRangeTabs
              active={range}
              includeInternal={includeInternal}
              tab={tab}
            />
          </div>
        ) : null}
      </div>
      <Suspense
        fallback={
          <div
            aria-busy="true"
            aria-label="Checking the data"
            className={`${adminCardClass} bg-ui-canvas mb-5 h-28 animate-pulse`}
          />
        }
      >
        <TrustSlot trust={trust} />
      </Suspense>
      {children}
    </AdminShell>
  );
}

async function TrustSlot({ trust }: { trust: Promise<TrustBarModel> }) {
  return <DataTrustBar model={await trust} />;
}
