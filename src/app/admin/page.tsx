import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCardClass } from "@/components/admin/AdminUi";
import { AnalyticsRangeTabs } from "@/components/admin/AnalyticsPanels";
import {
  ChannelLeaderboard,
  NeedsAttention,
  OverviewHeadline,
  PerformanceRead,
  StudioStrip,
} from "@/components/admin/OverviewPanels";
import { getAdminOverview } from "@/lib/services/admin-overview";
import { getChannelsTab } from "@/lib/services/channel-report";
import { parseAdminAnalyticsRange } from "@/lib/services/admin-analytics-range";
import {
  rankChannelMoves,
  rateWithSample,
} from "@/lib/services/overview-highlights";
import { canEditAdmin, requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false, follow: false },
};

// Same reason as the analytics page: a command center that serves a cached
// count is a command center nobody checks twice.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range = parseAdminAnalyticsRange(singleParam(params.range));

  const [{ user, role }, channels, overview] = await Promise.all([
    requireReadAccess(),
    getChannelsTab({ range }),
    getAdminOverview(),
  ]);

  const { report } = channels;
  const moves = rankChannelMoves(report.rows);
  const canEdit = canEditAdmin(role);

  // The funnel's own booked share, which is measured only on links carrying
  // both stages. Taken only when the stage above it really is Lead: when no
  // connector reported leads the share falls through to visits, and a
  // booked-per-visit number under a "leads who booked" label is a lie.
  const bookedStage = report.funnel.find((stage) => stage.key === "booked");
  const bookingRatePct = rateWithSample(
    bookedStage?.ofPreviousLabel === "Lead" ? bookedStage.ofPreviousPct : null,
    report.totals.leads,
  );

  return (
    <AdminShell
      activeSection="overview"
      eyebrow="Command center"
      title="Overview"
      description="Where the leads came from, what is moving, and what is stuck. Every number opens the page behind it."
      userEmail={user.email}
      userRole={role}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ui-text-subtle text-xs">
          {channels.range.label} ({channels.range.startDay} to{" "}
          {channels.range.endDay}). A dash means not observed, never zero.
        </p>
        <AnalyticsRangeTabs
          active={range}
          hrefFor={(key) => `/admin?range=${key}`}
        />
      </div>

      {channels.connected ? (
        <>
          <OverviewHeadline
            canEdit={canEdit}
            leads={report.totals.leads}
            booked={report.totals.booked}
            won={report.totals.won}
            prior={{
              leads: report.priorTotals.leads,
              booked: report.priorTotals.booked,
              won: report.priorTotals.won,
            }}
            bookingRatePct={bookingRatePct}
            days={channels.range.days}
            range={range}
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChannelLeaderboard
                canEdit={canEdit}
                rows={report.rows}
                tailCount={report.tail.length}
                range={range}
              />
            </div>
            <PerformanceRead
              canEdit={canEdit}
              moves={moves}
              days={channels.range.days}
              range={range}
            />
          </div>
        </>
      ) : (
        <div className={`${adminCardClass} mb-5`}>
          <p className="text-ui-text-muted text-sm">
            The channel spine is not connected yet, so there are no lead or
            channel numbers to show. {overview.leadsThisWeek} leads arrived in
            the last 7 days ({overview.leadsTotal} all time).
          </p>
        </div>
      )}

      <div className="mt-5">
        <NeedsAttention
          canEdit={canEdit}
          overview={overview}
          syncHealth={channels.syncHealth}
          range={range}
        />
      </div>

      <div className="mt-5">
        <StudioStrip canEdit={canEdit} overview={overview} range={range} />
      </div>
    </AdminShell>
  );
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
