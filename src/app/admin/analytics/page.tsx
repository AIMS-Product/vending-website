import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCardClass } from "@/components/admin/AdminUi";
import {
  singleParam,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import {
  AttentionChip,
  BookingsCard,
  CardSkeleton,
  CostCard,
  FlowCard,
  KpiStrip,
  SyncFooter,
  TodayStrip,
  TrendCard,
} from "@/components/admin/dashboard/DashboardPanels";
import { DashboardWindowControl } from "@/components/admin/dashboard/DashboardWindowControl";
import { ScorecardCard } from "@/components/admin/dashboard/ScorecardCard";
import {
  customWindowKey,
  parseDashboardWindow,
  reportingDay,
  resolveDashboardWindow,
} from "@/lib/analytics/dashboard-window";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

// Reporting must reflect the database on every load.
export const dynamic = "force-dynamic";

const DRILL_DOWNS = [
  { href: "/admin/analytics/board", label: "Funnel board" },
  { href: "/admin/analytics/channels", label: "Channels" },
  { href: "/admin/analytics/months", label: "Month over month" },
  { href: "/admin/analytics/youtube", label: "YouTube" },
  { href: "/admin/analytics/video", label: "Pre-call video" },
] as const;

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const key =
    customWindowKey(singleParam(params.from), singleParam(params.to)) ??
    parseDashboardWindow(singleParam(params.range));
  // Auth before any read, so nothing queries for a visitor about to be sent away.
  const { user, role } = await requireReadAccess();
  const window = resolveDashboardWindow(key, reportingDay());
  const longToday = new Date(`${window.today}T12:00:00Z`).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    },
  );

  return (
    <AdminShell
      activeSection="analytics"
      eyebrow="Analytics"
      title={longToday}
      description="Every channel from first capture to closed sale. Days are Eastern time, as the sales floor counts them."
      userEmail={user.email}
      userRole={role}
      actions={
        <Suspense
          fallback={
            <div
              aria-busy="true"
              aria-label="Loading what needs attention"
              className="bg-ui-canvas rounded-ui h-8 w-72 animate-pulse"
            />
          }
        >
          <AttentionChip window={window} />
        </Suspense>
      }
    >
      <Suspense fallback={<CardSkeleton label="today" height="h-32" />}>
        <TodayStrip window={window} />
      </Suspense>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DashboardWindowControl window={window} />
        <nav
          aria-label="Analytics detail"
          className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]"
        >
          {DRILL_DOWNS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="text-ui-text-muted hover:text-ui-accent font-medium"
            >
              {d.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Weekly, whatever the window: the sheet's rows, filled from here. */}
      <div className="mb-5">
        <Suspense
          fallback={<CardSkeleton label="leadership scorecard" height="h-80" />}
        >
          <ScorecardCard window={window} />
        </Suspense>
      </div>

      <Suspense
        key={`kpi-${window.key}`}
        fallback={<CardSkeleton label="key numbers" height="h-36" />}
      >
        <KpiStrip window={window} />
      </Suspense>

      <Suspense
        key={`flow-${window.key}`}
        fallback={<CardSkeleton label="channel flow" height="h-[26rem]" />}
      >
        <FlowCard window={window} />
      </Suspense>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <Suspense
            key={`bookings-${window.key}`}
            fallback={<CardSkeleton label="bookings" height="h-80" />}
          >
            <BookingsCard window={window} />
          </Suspense>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Suspense
            key={`cost-${window.key}`}
            fallback={
              <CardSkeleton label="cost per booked call" height="h-80" />
            }
          >
            <CostCard window={window} />
          </Suspense>
        </div>
      </div>

      <div className="mt-5">
        <Suspense
          key={`trend-${window.key}`}
          fallback={<CardSkeleton label="trend" height="h-72" />}
        >
          <TrendCard window={window} />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div
            aria-busy="true"
            aria-label="Loading data sources"
            className={`${adminCardClass} bg-ui-canvas mt-5 h-40 animate-pulse`}
          />
        }
      >
        <SyncFooter />
      </Suspense>
    </AdminShell>
  );
}
