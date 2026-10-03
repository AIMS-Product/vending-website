import type { Metadata } from "next";
import { Suspense } from "react";
import { adminCardClass } from "@/components/admin/AdminUi";
import {
  AnalyticsDrillDown,
  drillDownParams,
  singleParam,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import {
  YouTubeCohortTable,
  YouTubeCoverageNote,
  YouTubeStageFunnel,
  YouTubeTimeToCloseChart,
  YouTubeVideoTable,
  parseYouTubeVideoSort,
  sortYouTubeVideos,
  type YouTubeVideoSort,
} from "@/components/admin/YouTubeAttributionPanels";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { getYouTubeAttribution } from "@/lib/services/youtube-attribution";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "YouTube",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AnalyticsYouTubePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { range, includeInternal } = drillDownParams(params);
  const { user, role } = await requireReadAccess();
  const sort = parseYouTubeVideoSort(singleParam(params.sort));
  const youtube = await getYouTubeAttribution({ range, includeInternal });
  const sortHref = (next: YouTubeVideoSort) => {
    const query = new URLSearchParams({ range, sort: next });
    if (includeInternal) query.set("internal", "1");
    return `/admin/analytics/youtube?${query.toString()}`;
  };
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/youtube"
      tab="youtube"
      title="YouTube"
      description="Which videos bring leads, calls and sales, and how long they take to close."
      user={{ email: user.email, role }}
      range={range}
      includeInternal={includeInternal}
      internalExcluded={youtube.internalExcluded}
      trust={getTrustBar("youtube")}
    >
      <Suspense
        fallback={
          <div
            aria-busy="true"
            className={`${adminCardClass} bg-ui-canvas h-96 animate-pulse`}
          />
        }
      >
        <YouTubeCoverageNote
          coverage={youtube.coverage}
          range={youtube.range}
        />
        <div className="grid gap-5 xl:grid-cols-3">
          <YouTubeStageFunnel stages={youtube.stages} />
          <YouTubeTimeToCloseChart timeToClose={youtube.timeToClose} />
          <YouTubeCohortTable
            cohorts={youtube.cohorts}
            outcomesConnected={youtube.coverage.outcomesConnected}
          />
        </div>
        <div className="mt-5">
          <YouTubeVideoTable
            rows={sortYouTubeVideos(youtube.videos, sort)}
            sortHref={sortHref}
            activeSort={sort}
          />
        </div>
      </Suspense>
    </AnalyticsDrillDown>
  );
}
