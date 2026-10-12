import { AdminStatusBadge } from "@/components/admin/AdminUi";
import { readChannelValue } from "@/components/admin/dashboard/ChannelValueCard";
import {
  BarList,
  DashboardCard,
  bookedBars,
  dayLabel,
  failed,
  money,
  num,
} from "@/components/admin/dashboard/DashboardPanels";
import { focusLines } from "@/lib/analytics/channel-value";
import { inRange } from "@/lib/analytics/dashboard-metrics";
import {
  addDays,
  type DashboardWindow,
} from "@/lib/analytics/dashboard-window";
import {
  readCalls,
  readGoogleClickLeads,
} from "@/lib/services/analytics-dashboard-data";

interface GlanceCardProps {
  window: DashboardWindow;
}

/** Monday of the week `day` falls in (the scorecard's Mon-Sun weeks). */
function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/**
 * The top of the dashboard: booked calls by channel this week and this month,
 * then at most three lines on where to put money, from the value card's rows.
 */
export async function GlanceCard({ window }: GlanceCardProps) {
  const today = window.today;
  const week = { startDay: mondayOf(today), endDay: today };
  const month = { startDay: `${today.slice(0, 7)}-01`, endDay: today };
  const from = week.startDay < month.startDay ? week.startDay : month.startDay;
  const [calls, googleClicks, value] = await Promise.all([
    readCalls(from, today),
    readGoogleClickLeads(),
    readChannelValue(window),
  ]);
  const error = failed(calls, googleClicks);
  const periods =
    calls.ok && googleClicks.ok
      ? [
          { name: "This week", range: week },
          { name: "This month", range: month },
        ].map((p) => {
          const bars = bookedBars(
            calls.data.filter((c) => inRange(c.bookedDate, p.range)),
            googleClicks.data,
          );
          return { ...p, bars, total: bars.reduce((s, b) => s + b.value, 0) };
        })
      : [];
  const lines = focusLines(value.rows);
  return (
    <DashboardCard id="glance" help="glance" className="mb-4">
      {error ?? (
        <div className="grid gap-6 sm:grid-cols-2">
          {periods.map((p) => (
            <div key={p.name} className="min-w-0">
              <p className="text-ui-text-muted text-xs">
                {p.name} · {dayLabel(p.range.startDay)} –{" "}
                {dayLabel(p.range.endDay)}
              </p>
              <p className="text-ui-text mt-1 mb-3 text-3xl font-semibold tracking-tight tabular-nums">
                {num(p.total)}
              </p>
              <BarList rows={p.bars} total={p.total} logos />
            </div>
          ))}
        </div>
      )}
      {lines.length > 0 ? (
        <ul className="border-ui-line mt-5 grid gap-2 border-t pt-4 text-sm">
          {lines.map((l) => (
            <li key={l.label} className="flex items-baseline gap-2.5">
              <AdminStatusBadge
                status={l.tone}
                label={l.tone === "watch" ? "Watch" : "Double down"}
                tone={l.tone === "watch" ? "warn" : "ok"}
              />
              <span className="text-ui-text tabular-nums">
                <span className="font-medium">{l.label}</span>
                {l.costPerBooked === null
                  ? ""
                  : ` · ${money(l.costPerBooked)} per booked call`}
                {` · $${l.revenuePerDollar.toFixed(2)} back per $1`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardCard>
  );
}
