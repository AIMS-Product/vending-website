import type { Metadata } from "next";
import { Suspense } from "react";
import { adminCardClass } from "@/components/admin/AdminUi";
import {
  AnalyticsDrillDown,
  drillDownParams,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { SiteVideosPanel } from "@/components/admin/SiteVideosPanel";
import { VideoEngagementTab } from "@/components/admin/VideoEngagementPanels";
import { resolveAdminAnalyticsRange } from "@/lib/services/admin-analytics-range";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { getSiteVideoReport } from "@/lib/services/site-video-report";
import { getVideoEngagementReport } from "@/lib/services/video-engagement-report";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Video",
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
  const { days } = resolveAdminAnalyticsRange(range);
  // Windowed on when the call was BOOKED, matching the bookings ledger.
  const report = getVideoEngagementReport({ days });
  // Windowed on when the video was first played.
  const siteVideos = getSiteVideoReport({ days });
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/video"
      tab="video"
      title="Video"
      description="Every video on the site (our plays next to YouTube's own numbers), then who watched the pre-call videos before their call."
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
        <VideoBody report={report} siteVideos={siteVideos} />
      </Suspense>
    </AnalyticsDrillDown>
  );
}

async function VideoBody({
  report,
  siteVideos,
}: {
  report: ReturnType<typeof getVideoEngagementReport>;
  siteVideos: ReturnType<typeof getSiteVideoReport>;
}) {
  const [engagement, site] = await Promise.all([report, siteVideos]);
  return (
    <>
      <SiteVideosPanel report={site} />
      <h2 className="text-ui-text mb-2 text-sm font-semibold">
        Pre-call videos, for people who booked
      </h2>
      <VideoEngagementTab report={engagement} />
    </>
  );
}
