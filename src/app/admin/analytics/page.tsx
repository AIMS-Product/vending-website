import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminMetricStrip, adminCardClass } from "@/components/admin/AdminUi";
import {
  AnalyticsBreakdown,
  AnalyticsCampaignTable,
  AnalyticsFunnel,
  AnalyticsInternalToggle,
  AnalyticsKpiCard,
  AnalyticsRangeTabs,
  AnalyticsTabs,
  AnalyticsTrend,
  parseAnalyticsTab,
  type AnalyticsTabKey,
} from "@/components/admin/AnalyticsPanels";
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
import {
  getAdminAnalytics,
  type AdminAnalytics,
} from "@/lib/services/admin-analytics";
import {
  getYouTubeAttribution,
  type YouTubeAttribution,
} from "@/lib/services/youtube-attribution";
import { ChannelsTab } from "@/components/admin/ChannelsPanels";
import { KpiTab } from "@/components/admin/KpiPanels";
import { getKpiTab } from "@/lib/services/kpi-report-data";
import { getChannelsTab } from "@/lib/services/channel-report";
import { parseAdminAnalyticsRange } from "@/lib/services/admin-analytics-range";
import { canEditAdmin, requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

// Reporting must reflect the database on every load. Without this the page
// served counts that disagreed with /admin/leads and did not move after rows
// were deleted — a dashboard nobody can trust is worse than no dashboard.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range = parseAdminAnalyticsRange(singleParam(params.range));
  const includeInternal = singleParam(params.internal) === "1";
  const tab = parseAnalyticsTab(singleParam(params.tab));
  const videoSort = parseYouTubeVideoSort(singleParam(params.sort));

  // The YouTube and Channels tabs read different tables, so each fetches its
  // own data instead of paying for the four-tab rollup it would not use.
  const isYouTubeTab = tab === "youtube";
  const isChannelsTab = tab === "channels";
  const isKpiTab = tab === "kpi";
  const [{ user, role }, analytics, youtube, channels, kpi] = await Promise.all(
    [
      requireReadAccess(),
      isYouTubeTab || isChannelsTab || isKpiTab
        ? null
        : getAdminAnalytics({ range, includeInternal }),
      isYouTubeTab ? getYouTubeAttribution({ range, includeInternal }) : null,
      isChannelsTab
        ? getChannelsTab({ range, channel: singleParam(params.channel) })
        : null,
      isKpiTab ? getKpiTab({ range }) : null,
    ],
  );
  const internalExcluded =
    youtube?.internalExcluded ?? analytics?.internalExcluded ?? 0;

  return (
    <AdminShell
      activeSection="analytics"
      eyebrow="Reporting"
      title="Analytics"
      description="Leads, qualification, and bookings by source, page, and campaign."
      userEmail={user.email}
      userRole={role}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <AnalyticsInternalToggle
          range={range}
          includeInternal={includeInternal}
          excludedCount={internalExcluded}
          tab={tab}
        />
        <AnalyticsRangeTabs
          active={range}
          includeInternal={includeInternal}
          tab={tab}
        />
      </div>

      <AnalyticsTabs
        active={tab}
        range={range}
        includeInternal={includeInternal}
      />

      {kpi ? (
        <KpiTab data={kpi} />
      ) : channels ? (
        <ChannelsTab
          canEdit={canEditAdmin(role)}
          data={channels}
          range={range}
          includeInternal={includeInternal}
        />
      ) : youtube ? (
        <YouTubeTab
          youtube={youtube}
          sort={videoSort}
          range={range}
          includeInternal={includeInternal}
        />
      ) : analytics ? (
        <TabContent tab={tab} analytics={analytics} />
      ) : null}
    </AdminShell>
  );
}

function TabContent({
  tab,
  analytics,
}: {
  tab: AnalyticsTabKey;
  analytics: AdminAnalytics;
}) {
  if (tab === "acquisition") return <AcquisitionTab analytics={analytics} />;
  if (tab === "pages") return <PagesTab analytics={analytics} />;
  if (tab === "quality") return <QualityTab analytics={analytics} />;
  return <OverviewTab analytics={analytics} />;
}

function YouTubeTab({
  youtube,
  sort,
  range,
  includeInternal,
}: {
  youtube: YouTubeAttribution;
  sort: YouTubeVideoSort;
  range: string;
  includeInternal: boolean;
}) {
  const sortHref = (next: YouTubeVideoSort) => {
    const params = new URLSearchParams({ range, tab: "youtube", sort: next });
    if (includeInternal) params.set("internal", "1");
    return `/admin/analytics?${params.toString()}`;
  };

  return (
    <>
      <YouTubeCoverageNote coverage={youtube.coverage} range={youtube.range} />

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
    </>
  );
}

function OverviewTab({ analytics }: { analytics: AdminAnalytics }) {
  const { metrics } = analytics;
  return (
    <>
      <AdminMetricStrip>
        <AnalyticsKpiCard
          label="Leads"
          metric={metrics.leads}
          caption={`vs prior ${analytics.range.days} days`}
        />
        <AnalyticsKpiCard
          label="Qualified"
          metric={metrics.qualified}
          caption="completed the questions"
        />
        <AnalyticsKpiCard
          label="Booked a call"
          metric={metrics.bookedFromLeads}
          caption="bookings traced to a lead"
        />
        <AnalyticsKpiCard
          label="Booking rate"
          metric={metrics.bookingRatePct}
          caption="of leads who booked"
          format="percent"
        />
      </AdminMetricStrip>

      <BookingContext
        connected={analytics.bookingsConnected}
        total={analytics.bookingsTotal}
        unattributed={analytics.bookingsUnattributed}
        leadsAllTime={analytics.leadsAllTime}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <AnalyticsBreakdown
          title="Leads by page"
          rows={analytics.leadsBySourcePath}
        />
        <AnalyticsBreakdown
          title="Leads by channel"
          logos
          rows={analytics.leadsByChannel}
        />
        <AnalyticsBreakdown
          title="Bookings by calendar"
          rows={analytics.bookingsByCalendar}
          emptyLabel={
            analytics.bookingsConnected
              ? "No bookings in this range."
              : "Bookings not connected yet."
          }
        />
      </div>

      <div className="mt-5">
        <AnalyticsTrend rows={analytics.dailyTrend} />
      </div>
    </>
  );
}

function AcquisitionTab({ analytics }: { analytics: AdminAnalytics }) {
  const { acquisition } = analytics;
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-3">
        <AnalyticsBreakdown
          title="Channel"
          rows={acquisition.channelMix}
          logos
        />
        <AnalyticsBreakdown
          title="Source (utm_source)"
          logos
          rows={acquisition.bySource}
        />
        <AnalyticsBreakdown
          title="Medium (utm_medium)"
          rows={acquisition.byMedium}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <AnalyticsBreakdown
          title="Campaign (utm_campaign)"
          rows={acquisition.byCampaign}
        />
        <AnalyticsBreakdown
          title="Ad / creative (utm_content)"
          rows={acquisition.byContent}
        />
        <AnalyticsBreakdown
          title="Keyword (utm_term)"
          rows={acquisition.byTerm}
        />
      </div>
      <div className="mt-5">
        <AnalyticsCampaignTable rows={acquisition.topCampaigns} />
      </div>
    </>
  );
}

function PagesTab({ analytics }: { analytics: AdminAnalytics }) {
  const { pages } = analytics;
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsFunnel steps={pages.funnel} context={pages.funnelContext} />
        <AnalyticsBreakdown
          title="Landing page (first page seen)"
          rows={pages.byLandingPage}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AnalyticsBreakdown
          title="Form page (where they submitted)"
          rows={pages.bySubmitPage}
        />
        <AnalyticsBreakdown
          title="Referring site"
          rows={pages.byReferrer}
          emptyLabel="No referrers recorded in this range."
        />
      </div>
    </>
  );
}

function QualityTab({ analytics }: { analytics: AdminAnalytics }) {
  const { quality } = analytics;
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-3">
        <AnalyticsBreakdown
          title="Fit result shown"
          rows={quality.byFitResult}
        />
        <AnalyticsBreakdown
          title="Purchase timeline"
          rows={quality.byTimeline}
        />
        <AnalyticsBreakdown title="Capital ready" rows={quality.byBudget} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <AnalyticsBreakdown
          title="Business stage"
          rows={quality.byBusinessStage}
        />
        <AnalyticsBreakdown title="State / region" rows={quality.byState} />
        <AnalyticsBreakdown title="Close CRM sync" rows={quality.syncHealth} />
      </div>
    </>
  );
}

/**
 * Bookings that never came through this site (Saleskick, phone, direct Calendly
 * links) are real but are not website conversions. They are reported here, next
 * to the rate, so the number is visible without silently inflating it.
 */
function BookingContext({
  connected,
  total,
  unattributed,
  leadsAllTime,
}: {
  connected: boolean;
  total: number;
  unattributed: number;
  leadsAllTime: number;
}) {
  if (!connected) {
    return (
      <div className={`${adminCardClass} mb-5`}>
        <p className="text-ui-text-muted text-sm">
          Booking tracking isn&apos;t connected yet — bookings will appear here
          once the Calendly webhook is live.
        </p>
      </div>
    );
  }

  return (
    <div className={`${adminCardClass} mb-5`}>
      <p className="text-ui-text-muted text-sm">
        <span className="text-ui-text font-semibold">{total}</span> calls were
        booked in this range.{" "}
        {unattributed > 0 ? (
          <>
            <span className="text-ui-text font-semibold">{unattributed}</span>{" "}
            of those came from outside this website (phone, Saleskick, or a
            direct Calendly link), so they are excluded from the booking rate
            above.
          </>
        ) : (
          <>Every one of them traces back to a lead this site captured.</>
        )}{" "}
        <span className="text-ui-text-subtle">
          {leadsAllTime.toLocaleString()} leads captured all time.
        </span>
      </p>
    </div>
  );
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
