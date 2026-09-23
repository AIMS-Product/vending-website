import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminMetricStrip, adminCardClass } from "@/components/admin/AdminUi";
import {
  AnalyticsBreakdown,
  AnalyticsCampaignTable,
  AnalyticsFunnel,
  AnalyticsInternalToggle,
  AnalyticsKpiCard,
  AnalyticsCustomRange,
  AnalyticsRangeTabs,
  AnalyticsWeekPicker,
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
import { BookedCallsPanel } from "@/components/admin/BookedCallsPanel";
import { FunnelMapTab } from "@/components/admin/FunnelMapPanel";
import {
  FunnelMonthlyTab,
  parseFunnelGrouping,
  parseFunnelMetrics,
} from "@/components/admin/FunnelMonthlyPanel";
import { ChannelJourneysTab } from "@/components/admin/ChannelJourneyPanel";
import { KpiTab } from "@/components/admin/KpiPanels";
import { getKpiTab } from "@/lib/services/kpi-report-data";
import { getChannelsTab } from "@/lib/services/channel-report";
import { getBookedCalls } from "@/lib/services/booked-calls-data";
import { VideoEngagementTab } from "@/components/admin/VideoEngagementPanels";
import { getVideoEngagementReport } from "@/lib/services/video-engagement-report";
import { getFunnelMap } from "@/lib/services/funnel-map";
import { getFunnelMonthly } from "@/lib/services/funnel-monthly-data";
import { getFunnelExecutive } from "@/lib/services/funnel-executive";
import { FunnelExecutiveTab } from "@/components/admin/FunnelExecutivePanel";
import { CloseWeekTab } from "@/components/admin/CloseWeekPanel";
import { CloseMtdFunnelPanel } from "@/components/admin/CloseMtdFunnelPanel";
import { getCloseMtdFunnel } from "@/lib/services/close-mtd-funnel-data";
import { CloseMonthlyPanel } from "@/components/admin/CloseMonthlyPanel";
import { getCloseMonthlyFunnel } from "@/lib/services/close-monthly-funnel-data";
import { getCloseWeekView } from "@/lib/services/close-week-view-data";
import { getChannelJourneys } from "@/lib/services/channel-journeys-data";
import {
  parseAdminAnalyticsRange,
  type AdminAnalyticsRangeKey,
  resolveAdminAnalyticsRange,
  toCustomRangeKey,
} from "@/lib/services/admin-analytics-range";
import { canEditAdmin, requireReadAccess } from "@/lib/supabase/auth";
import { LEAD_DEFINITION } from "@/lib/analytics/lead-definition";
import { AnalyticsGlossary } from "@/components/admin/AnalyticsGlossary";
import { DataTrustBar } from "@/components/admin/DataTrustBar";
import { UnverifiedMark } from "@/components/admin/TrustMarks";
import {
  flagFor,
  type TrustBarModel,
  type UnverifiedFlag,
} from "@/lib/analytics/data-trust-bar";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";

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
  // A submitted from/to pair wins over `range`, then every link the page
  // renders carries the window as one `range=custom:...` key.
  const range = parseAdminAnalyticsRange(
    toCustomRangeKey(singleParam(params.from), singleParam(params.to)) ??
      singleParam(params.range),
  );
  const includeInternal = singleParam(params.internal) === "1";
  const tab = parseAnalyticsTab(singleParam(params.tab));

  // Auth first and on its own: it is fast, and nothing should query on behalf
  // of a visitor who is about to be redirected.
  const { user, role } = await requireReadAccess();

  // Not awaited. The shell, controls and tab bar render straight away and the
  // tab body streams in behind a skeleton (Adam, 2026-09-22): awaiting here
  // froze the page for the slowest query, up to five seconds, on every click.
  const data = loadTabData({ tab, range, includeInternal, params });
  // Freshness, last night's checks and unverified numbers for this tab. Never
  // rejects: a failed read comes back as a red bar.
  const trust = getTrustBar(tab);
  // A new key per view makes the skeleton show on every tab or range change;
  // without it the old tab sat on screen until the new one finished.
  const viewKey = JSON.stringify(params);

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
        <Suspense
          key={viewKey}
          fallback={
            <AnalyticsInternalToggle
              range={range}
              includeInternal={includeInternal}
              excludedCount={0}
              tab={tab}
            />
          }
        >
          <InternalToggleWithCount
            data={data}
            range={range}
            includeInternal={includeInternal}
            tab={tab}
          />
        </Suspense>
        <div className="flex flex-wrap items-center gap-2">
          <AnalyticsWeekPicker
            active={range}
            includeInternal={includeInternal}
            tab={tab}
            today={new Date().toISOString().slice(0, 10)}
          />
          <AnalyticsCustomRange
            active={range}
            includeInternal={includeInternal}
            tab={tab}
            today={new Date().toISOString().slice(0, 10)}
          />
          <AnalyticsRangeTabs
            active={range}
            includeInternal={includeInternal}
            tab={tab}
          />
        </div>
      </div>

      <AnalyticsTabs
        active={tab}
        range={range}
        includeInternal={includeInternal}
      />

      <Suspense
        fallback={
          <div
            aria-busy="true"
            aria-label="Checking the data"
            className={`${adminCardClass} bg-ui-canvas mb-5 h-28 animate-pulse`}
          />
        }
      >
        <TrustBarSlot trust={trust} />
      </Suspense>

      <LeadDefinitionNote />

      <Suspense key={viewKey} fallback={<TabSkeleton />}>
        <TabBody
          data={data}
          trust={trust}
          tab={tab}
          range={range}
          includeInternal={includeInternal}
          params={params}
          canEdit={canEditAdmin(role)}
        />
      </Suspense>
    </AdminShell>
  );
}

type TabData = Awaited<ReturnType<typeof loadTabData>>;

/** Fetches only what the active tab renders. */
async function loadTabData({
  tab,
  range,
  includeInternal,
  params,
}: {
  tab: AnalyticsTabKey;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  params: SearchParams;
}) {
  const videoSort = parseYouTubeVideoSort(singleParam(params.sort));

  // The YouTube and Channels tabs read different tables, so each fetches its
  // own data instead of paying for the four-tab rollup it would not use.
  const isYouTubeTab = tab === "youtube";
  const isChannelsTab = tab === "channels";
  const isKpiTab = tab === "kpi";
  const isMapTab = tab === "map";
  const isBookedTab = tab === "booked";
  const isFunnelsTab = tab === "funnels";
  const isJourneysTab = tab === "journeys";
  const isExecTab = tab === "exec";
  const isCloseTab = tab === "close";
  const isMomTab = tab === "mom";
  const isVideoTab = tab === "video";
  const [
    analytics,
    youtube,
    channels,
    kpi,
    map,
    booked,
    funnels,
    journeys,
    executive,
    closeWeeks,
    closeMtd,
    closeMonthly,
    videoEngagement,
  ] = await Promise.all([
    isYouTubeTab ||
    isChannelsTab ||
    isKpiTab ||
    isMapTab ||
    isBookedTab ||
    isFunnelsTab ||
    isJourneysTab ||
    isExecTab ||
    isCloseTab ||
    isMomTab ||
    isVideoTab
      ? null
      : getAdminAnalytics({ range, includeInternal }),
    isYouTubeTab ? getYouTubeAttribution({ range, includeInternal }) : null,
    isChannelsTab
      ? getChannelsTab({
          range,
          channel: singleParam(params.channel),
          includeInternal,
        })
      : null,
    isKpiTab ? getKpiTab({ range, includeInternal }) : null,
    isMapTab ? getFunnelMap({ range, includeInternal }) : null,
    isBookedTab ? getBookedCalls({ includeInternal }) : null,
    // Deliberately ignores `range`: this tab IS the month-by-month series,
    // and a 30-day window would render one partial month.
    isFunnelsTab
      ? getFunnelMonthly({
          includeInternal,
          grouping: parseFunnelGrouping(singleParam(params.group)),
        })
      : null,
    isJourneysTab ? getChannelJourneys({ range, includeInternal }) : null,
    // Same reason as the Funnels tab: this view IS the month series, so a
    // 30-day range would render one partial month and call it the trend.
    isExecTab ? getFunnelExecutive({ includeInternal }) : null,
    isCloseTab ? getCloseWeekView() : null,
    isCloseTab ? getCloseMtdFunnel() : null,
    // Deliberately ignores `range`: this view IS the month series, so a
    // 30-day window would render one partial month and call it a trend.
    isMomTab ? getCloseMonthlyFunnel() : null,
    // Windowed on when the call was BOOKED, matching the bookings ledger, so
    // "booked prospects" means the same population on both pages.
    isVideoTab
      ? getVideoEngagementReport({
          days: resolveAdminAnalyticsRange(range).days,
        })
      : null,
  ]);
  return {
    analytics,
    youtube,
    channels,
    kpi,
    map,
    booked,
    funnels,
    journeys,
    executive,
    closeWeeks,
    closeMtd,
    closeMonthly,
    videoEngagement,
    videoSort,
    internalExcluded:
      youtube?.internalExcluded ?? analytics?.internalExcluded ?? 0,
  };
}

async function InternalToggleWithCount({
  data,
  ...props
}: {
  data: Promise<TabData>;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  tab: AnalyticsTabKey;
}) {
  const { internalExcluded } = await data;
  return (
    <AnalyticsInternalToggle {...props} excludedCount={internalExcluded} />
  );
}

async function TrustBarSlot({ trust }: { trust: Promise<TrustBarModel> }) {
  return <DataTrustBar model={await trust} />;
}

async function TabBody({
  data,
  trust,
  tab,
  range,
  includeInternal,
  params,
  canEdit,
}: {
  data: Promise<TabData>;
  trust: Promise<TrustBarModel>;
  tab: AnalyticsTabKey;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  params: SearchParams;
  canEdit: boolean;
}) {
  const { flags } = await trust;
  const {
    analytics,
    youtube,
    channels,
    kpi,
    map,
    booked,
    funnels,
    journeys,
    executive,
    closeWeeks,
    closeMtd,
    closeMonthly,
    videoEngagement,
    videoSort,
  } = await data;

  return (
    <>
      {closeMonthly ? (
        <CloseMonthlyPanel
          report={closeMonthly}
          shown={singleParam(params.months) ?? null}
          unverified={flags}
        />
      ) : closeWeeks ? (
        <div className="space-y-5">
          {closeMtd ? (
            <CloseMtdFunnelPanel report={closeMtd} unverified={flags} />
          ) : null}
          <CloseWeekTab
            report={closeWeeks}
            selected={singleParam(params.week) ?? null}
          />
        </div>
      ) : executive ? (
        <FunnelExecutiveTab data={executive} />
      ) : journeys ? (
        <ChannelJourneysTab
          data={journeys}
          range={range}
          includeInternal={includeInternal}
          selected={singleParam(params.lane) ?? null}
        />
      ) : funnels ? (
        <FunnelMonthlyTab
          data={funnels}
          range={range}
          includeInternal={includeInternal}
          metrics={parseFunnelMetrics(singleParam(params.metric))}
        />
      ) : videoEngagement ? (
        <VideoEngagementTab report={videoEngagement} />
      ) : booked ? (
        <BookedCallsPanel report={booked} unverified={flags} />
      ) : map ? (
        <FunnelMapTab
          data={map}
          range={range}
          includeInternal={includeInternal}
        />
      ) : kpi ? (
        <KpiTab data={kpi} />
      ) : channels ? (
        <ChannelsTab
          canEdit={canEdit}
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
        <TabContent tab={tab} analytics={analytics} flags={flags} />
      ) : null}
    </>
  );
}

function TabSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${adminCardClass} bg-ui-canvas h-40 animate-pulse`}
          />
        ))}
      </div>
      <div className={`${adminCardClass} bg-ui-canvas h-72 animate-pulse`} />
    </div>
  );
}

function TabContent({
  tab,
  analytics,
  flags,
}: {
  tab: AnalyticsTabKey;
  analytics: AdminAnalytics;
  flags: UnverifiedFlag[];
}) {
  if (tab === "acquisition") return <AcquisitionTab analytics={analytics} />;
  if (tab === "pages") return <PagesTab analytics={analytics} />;
  if (tab === "quality") return <QualityTab analytics={analytics} />;
  return <OverviewTab analytics={analytics} flags={flags} />;
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

function OverviewTab({
  analytics,
  flags,
}: {
  analytics: AdminAnalytics;
  flags: UnverifiedFlag[];
}) {
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
          caption="leads who finished the qualifying questions"
        />
        <AnalyticsKpiCard
          label="Booked a call"
          metric={metrics.bookedFromLeads}
          caption="leads from this range who booked a call"
        />
        <AnalyticsKpiCard
          label="Booking rate"
          metric={metrics.bookingRatePct}
          caption="share of these leads who booked a call"
          format="percent"
        />
      </AdminMetricStrip>

      <BookingContext
        connected={analytics.bookingsConnected}
        total={analytics.bookingsTotal}
        unattributed={analytics.bookingsUnattributed}
        unverified={flagFor(flags, "calendly", {
          from: analytics.range.startIso.slice(0, 10),
          to: analytics.range.endIso.slice(0, 10),
        })}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <AnalyticsBreakdown
          title="Leads by sign-up page"
          rows={analytics.leadsBySourcePath}
          linkPaths
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
              : "Calendly bookings are not coming in yet."
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
      <p className="text-ui-text-subtle mb-3 text-xs">
        Where this range&apos;s leads came from, read from the UTM tags on the
        link each person clicked. &ldquo;booked&rdquo; next to a count is how
        many of those leads booked a call.
      </p>
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
          linkPaths
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AnalyticsBreakdown
          title="Form page (where they submitted)"
          rows={pages.bySubmitPage}
          linkPaths
        />
        <AnalyticsBreakdown
          title="Referring site"
          rows={pages.byReferrer}
          emptyLabel="No referring sites recorded in this range."
        />
      </div>
    </>
  );
}

function QualityTab({ analytics }: { analytics: AdminAnalytics }) {
  const { quality } = analytics;
  return (
    <>
      <p className="text-ui-text-subtle mb-3 text-xs">
        How this range&apos;s leads answered the qualifying questions, and
        whether each lead reached Close.
      </p>
      <div className="grid gap-5 xl:grid-cols-3">
        <AnalyticsBreakdown
          title="Result shown after the questions"
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
        <AnalyticsBreakdown
          title="Sent to Close CRM"
          rows={quality.syncHealth}
        />
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
  unverified,
}: {
  connected: boolean;
  total: number;
  unattributed: number;
  unverified: UnverifiedFlag | undefined;
}) {
  if (!connected) {
    return (
      <div className={`${adminCardClass} mb-5`}>
        <p className="text-ui-text-muted text-sm">
          Calendly bookings are not coming in yet. They will appear here once
          Calendly is connected.
        </p>
      </div>
    );
  }

  return (
    <div className={`${adminCardClass} mb-5`}>
      <p className="text-ui-text-muted text-sm">
        <span className="text-ui-text font-semibold">{total}</span>
        <UnverifiedMark flag={unverified} /> calls were booked on Calendly in
        this range.{" "}
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
      </p>
    </div>
  );
}

/**
 * Every tab counts a lead the same way (lib/analytics/lead-definition), so the
 * definition is stated once, above all of them.
 */
function LeadDefinitionNote() {
  return (
    <div className={`${adminCardClass} mb-5`}>
      <p className="text-ui-text text-sm">
        <span className="font-semibold">{LEAD_DEFINITION.title}:</span>{" "}
        {LEAD_DEFINITION.body}
      </p>
      <p className="text-ui-text-subtle mt-1 text-xs">
        {LEAD_DEFINITION.notLeads}
      </p>
      <AnalyticsGlossary />
    </div>
  );
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
