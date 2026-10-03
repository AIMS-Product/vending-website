import type { Metadata } from "next";
import { Suspense } from "react";
import { adminCardClass } from "@/components/admin/AdminUi";
import { CloseMonthlyPanel } from "@/components/admin/CloseMonthlyPanel";
import { CloseMtdFunnelPanel } from "@/components/admin/CloseMtdFunnelPanel";
import { CloseWeekTab } from "@/components/admin/CloseWeekPanel";
import {
  AnalyticsDrillDown,
  singleParam,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { getCloseMonthlyFunnel } from "@/lib/services/close-monthly-funnel-data";
import { getCloseMtdFunnel } from "@/lib/services/close-mtd-funnel-data";
import { getCloseWeekView } from "@/lib/services/close-week-view-data";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Month over month",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The sales floor's view of Close: every month by funnel, this month as the
 * MTD funnel counts it, and the Friday-to-Thursday weeks SteelTrap reports.
 * A fixed series, so no date range.
 */
export default async function AnalyticsMonthsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { user, role } = await requireReadAccess();
  const trust = getTrustBar("mom");
  const monthly = getCloseMonthlyFunnel();
  const mtd = getCloseMtdFunnel();
  const weeks = getCloseWeekView();
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/months"
      tab="months"
      title="Month over month"
      description="Close first calls, shows, qualified calls and sales by funnel, month by month and week by week."
      user={{ email: user.email, role }}
      trust={trust}
    >
      <div className="space-y-5">
        <Suspense fallback={<Skeleton label="months" />}>
          <MonthlyBody
            report={monthly}
            trust={trust}
            shown={singleParam(params.months) ?? null}
          />
        </Suspense>
        <Suspense fallback={<Skeleton label="this month" />}>
          <MtdBody report={mtd} trust={trust} />
        </Suspense>
        <section id="weeks" className="scroll-mt-6">
          <Suspense fallback={<Skeleton label="weeks" />}>
            <WeeksBody
              report={weeks}
              selected={singleParam(params.week) ?? null}
            />
          </Suspense>
        </section>
      </div>
    </AnalyticsDrillDown>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={`Loading ${label}`}
      className={`${adminCardClass} bg-ui-canvas h-72 animate-pulse`}
    />
  );
}

async function MonthlyBody({
  report,
  trust,
  shown,
}: {
  report: ReturnType<typeof getCloseMonthlyFunnel>;
  trust: ReturnType<typeof getTrustBar>;
  shown: string | null;
}) {
  const [data, { flags }] = await Promise.all([report, trust]);
  return <CloseMonthlyPanel report={data} shown={shown} unverified={flags} />;
}

async function MtdBody({
  report,
  trust,
}: {
  report: ReturnType<typeof getCloseMtdFunnel>;
  trust: ReturnType<typeof getTrustBar>;
}) {
  const [data, { flags }] = await Promise.all([report, trust]);
  return <CloseMtdFunnelPanel report={data} unverified={flags} />;
}

async function WeeksBody({
  report,
  selected,
}: {
  report: ReturnType<typeof getCloseWeekView>;
  selected: string | null;
}) {
  return <CloseWeekTab report={await report} selected={selected} />;
}
