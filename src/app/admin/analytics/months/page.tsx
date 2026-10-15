import type { Metadata } from "next";
import { Suspense } from "react";
import { adminCardClass, adminLinkClass } from "@/components/admin/AdminUi";
import { BookedCallsV2Panel } from "@/components/admin/BookedCallsV2Panel";
import { CloseMonthlyPanel } from "@/components/admin/CloseMonthlyPanel";
import { CloseMtdFunnelPanel } from "@/components/admin/CloseMtdFunnelPanel";
import { CloseWeekTab } from "@/components/admin/CloseWeekPanel";
import {
  AnalyticsDrillDown,
  singleParam,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { getBookedCallsV2 } from "@/lib/services/booked-calls-v2-data";
import { getCloseMonthlyFunnel } from "@/lib/services/close-monthly-funnel-data";
import { getDomMtdFunnel } from "@/lib/services/close-mtd-funnel-data";
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
  const mtd = getDomMtdFunnel();
  const weeks = getCloseWeekView();
  const v2 = getBookedCallsV2();
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/months"
      tab="months"
      title="Month over month"
      description="Booked calls on Dom's rule, shows, qualified calls and sales by source, month by month and week by week."
      user={{ email: user.email, role }}
      trust={trust}
    >
      <div className="space-y-5">
        {/* Dom and the sales floor compare this page against the MTD
            dashboard and SteelTrap; say up front which rule it counts. */}
        <p className={`${adminCardClass} text-ui-text-muted text-sm`}>
          Every panel on this page counts booked calls on Dom&apos;s rule (
          <a href="#booked-v2" className={adminLinkClass}>
            Booked calls V2
          </a>
          ), the same as the main dashboard: one credit per qualifying Close
          meeting, dated by the day it was booked. The company MTD dashboard and
          SteelTrap count first calls by the day they are scheduled, so their
          totals differ by design.
        </p>
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
        <section id="booked-v2" className="scroll-mt-6">
          <Suspense fallback={<Skeleton label="booked calls V2" />}>
            <V2Body report={v2} />
          </Suspense>
        </section>
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
  report: ReturnType<typeof getDomMtdFunnel>;
  trust: ReturnType<typeof getTrustBar>;
}) {
  const [data, { flags }] = await Promise.all([report, trust]);
  return <CloseMtdFunnelPanel report={data} unverified={flags} />;
}

async function V2Body({
  report,
}: {
  report: ReturnType<typeof getBookedCallsV2>;
}) {
  return <BookedCallsV2Panel report={await report} />;
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
