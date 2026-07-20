import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
} from "@/components/admin/AdminUi";
import {
  getAdminAnalytics,
  type AdminAnalyticsBreakdownRow,
  type AdminAnalyticsDailyTrendRow,
} from "@/lib/services/admin-analytics";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage() {
  const [{ user, role }, analytics] = await Promise.all([
    requireAdmin(),
    getAdminAnalytics(),
  ]);

  return (
    <AdminShell
      activeSection="analytics"
      eyebrow="Reporting"
      title="Analytics"
      description="Leads, bookings, and conversion by source, funnel, and calendar."
      userEmail={user.email}
      userRole={role}
    >
      <AdminMetricStrip>
        <AdminMetricPanel
          icon="mail"
          tone="blue"
          label="Leads (90d)"
          value={analytics.totals.leads90d}
          caption="last 90 days"
        />
        <AdminMetricPanel
          icon="target"
          tone="green"
          label="Bookings (90d)"
          value={analytics.totals.bookings90d}
          caption="last 90 days"
        />
        <AdminMetricPanel
          icon="check"
          tone="purple"
          label="Booking rate"
          value={`${formatPercent(analytics.totals.bookingRatePct)}%`}
          caption="bookings / leads"
        />
        <AdminMetricPanel
          icon="list"
          tone="slate"
          label="Leads (all-time)"
          value={analytics.totals.leadsAllTime}
          caption="since launch"
        />
      </AdminMetricStrip>

      {!analytics.bookingsConnected ? (
        <div className={`${adminCardClass} mb-5`}>
          <p className="text-sm text-slate-600">
            Booking tracking isn&apos;t connected yet — bookings will appear
            here once the Calendly webhook is live.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <BreakdownBars
          title="Leads by source page"
          rows={analytics.leadsBySourcePath}
        />
        <BreakdownBars
          title="Leads by traffic source"
          rows={analytics.leadsByUtmSource}
        />
        <BreakdownBars
          title="Bookings by calendar"
          rows={analytics.bookingsByCalendar}
          emptyLabel={
            analytics.bookingsConnected
              ? "No bookings in the last 90 days."
              : "Bookings not connected yet."
          }
        />
      </div>

      <div className="mt-5">
        <DailyTrend rows={analytics.dailyTrend} />
      </div>
    </AdminShell>
  );
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function BreakdownBars({
  title,
  rows,
  emptyLabel = "No data in the last 90 days.",
}: {
  title: string;
  rows: AdminAnalyticsBreakdownRow[];
  emptyLabel?: string;
}) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className="mb-4 text-sm font-semibold text-slate-500 uppercase">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="grid gap-2.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-700">
                  {row.label}
                </span>
                <span className="shrink-0 font-semibold text-slate-950">
                  {row.count}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[#0b63f6]"
                  style={{ width: `${(row.count / maxCount) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DailyTrend({ rows }: { rows: AdminAnalyticsDailyTrendRow[] }) {
  const maxValue = Math.max(1, ...rows.map((row) => row.leads + row.bookings));

  return (
    <section className={adminCardClass} aria-label="14-day trend">
      <h2 className="mb-4 text-sm font-semibold text-slate-500 uppercase">
        14-day trend
      </h2>
      <div className="flex items-end gap-2 overflow-x-auto pb-1">
        {rows.map((row) => (
          <div
            key={row.date}
            className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex h-24 w-full items-end justify-center gap-0.5">
              <div
                className="w-2.5 rounded-t bg-[#0b63f6]"
                style={{
                  height: `${Math.max(2, (row.leads / maxValue) * 100)}%`,
                }}
                title={`${row.leads} leads on ${row.date}`}
              />
              <div
                className="w-2.5 rounded-t bg-emerald-400"
                style={{
                  height: `${Math.max(2, (row.bookings / maxValue) * 100)}%`,
                }}
                title={`${row.bookings} bookings on ${row.date}`}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-500">
              {formatShortDate(row.date)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full bg-[#0b63f6]"
            aria-hidden="true"
          />
          Leads
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full bg-emerald-400"
            aria-hidden="true"
          />
          Bookings
        </span>
      </div>
    </section>
  );
}

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${month}/${day}`;
}
