import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCardClass } from "@/components/admin/AdminUi";
import {
  AnalyticsBreakdown,
  AnalyticsInternalToggle,
  AnalyticsKpiCard,
  AnalyticsKpiGrid,
  AnalyticsRangeTabs,
  AnalyticsTrend,
} from "@/components/admin/AnalyticsPanels";
import { getAdminAnalytics } from "@/lib/services/admin-analytics";
import { parseAdminAnalyticsRange } from "@/lib/services/admin-analytics-range";
import { requireAdmin } from "@/lib/supabase/auth";

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

  const [{ user, role }, analytics] = await Promise.all([
    requireAdmin(),
    getAdminAnalytics({ range, includeInternal }),
  ]);

  const { metrics } = analytics;

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
          excludedCount={analytics.internalExcluded}
        />
        <AnalyticsRangeTabs active={range} includeInternal={includeInternal} />
      </div>

      <AnalyticsKpiGrid>
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
      </AnalyticsKpiGrid>

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
          title="Leads by traffic source"
          rows={analytics.leadsByUtmSource}
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
    </AdminShell>
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
        <p className="text-sm text-slate-600">
          Booking tracking isn&apos;t connected yet — bookings will appear here
          once the Calendly webhook is live.
        </p>
      </div>
    );
  }

  return (
    <div className={`${adminCardClass} mb-5`}>
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{total}</span> calls were
        booked in this range.{" "}
        {unattributed > 0 ? (
          <>
            <span className="font-semibold text-slate-900">{unattributed}</span>{" "}
            of those came from outside this website (phone, Saleskick, or a
            direct Calendly link), so they are excluded from the booking rate
            above.
          </>
        ) : (
          <>Every one of them traces back to a lead this site captured.</>
        )}{" "}
        <span className="text-slate-500">
          {leadsAllTime.toLocaleString()} leads captured all time.
        </span>
      </p>
    </div>
  );
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
