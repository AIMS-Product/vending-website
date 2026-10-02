import type { Metadata } from "next";
import { Suspense } from "react";
import { adminCardClass } from "@/components/admin/AdminUi";
import {
  AnalyticsDrillDown,
  drillDownParams,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { VideoEngagementTab } from "@/components/admin/VideoEngagementPanels";
import { resolveAdminAnalyticsRange } from "@/lib/services/admin-analytics-range";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { getVideoEngagementReport } from "@/lib/services/video-engagement-report";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Pre-call video",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AnalyticsVideoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { range } = drillDownParams(params);
  const { user, role } = await requireReadAccess();
  // Windowed on when the call was BOOKED, matching the bookings ledger.
  const report = getVideoEngagementReport({
    days: resolveAdminAnalyticsRange(range).days,
  });
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/video"
      tab="video"
      title="Pre-call video"
      description="Who watched the pre-call videos before their call, and whether watchers show up."
      user={{ email: user.email, role }}
      range={range}
      trust={getTrustBar("video")}
    >
      <Suspense
        key={range}
        fallback={
          <div
            aria-busy="true"
            aria-label="Loading video"
            className={`${adminCardClass} bg-ui-canvas h-96 animate-pulse`}
          />
        }
      >
        <VideoBody report={report} />
      </Suspense>
    </AnalyticsDrillDown>
  );
}

async function VideoBody({
  report,
}: {
  report: ReturnType<typeof getVideoEngagementReport>;
}) {
  return <VideoEngagementTab report={await report} />;
}
