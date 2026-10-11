import { AdminStatusBadge, adminCardClass } from "@/components/admin/AdminUi";
import { dayLabel } from "@/components/admin/dashboard/DashboardPanels";
import { briefingOf } from "@/lib/analytics/ceo-briefing";
import {
  countInRange,
  inRange,
  keptCalls,
  LEADS_RECORDED_FROM,
  showRateHeld,
} from "@/lib/analytics/dashboard-metrics";
import {
  type DashboardWindow,
  type DayRange,
  windowPhrase,
} from "@/lib/analytics/dashboard-window";
import {
  callSpan,
  readCalls,
  readDeals,
  readLeads,
} from "@/lib/services/analytics-dashboard-data";

interface CeoBriefingProps {
  window: DashboardWindow;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The first thing on the dashboard: one sentence on what happened, then the
 * moves big enough to talk about, problems first. Same reads as the key
 * numbers below (cached per request), so the two never disagree.
 */
export async function CeoBriefing({ window }: CeoBriefingProps) {
  const span = callSpan(window);
  const prior = window.prior;
  const [leads, calls, deals] = await Promise.all([
    readLeads(span.from),
    readCalls(span.from, span.to),
    readDeals(prior.startDay, window.today),
  ]);
  const kept = calls.ok ? keptCalls(calls.data) : [];
  const sum = (r: DayRange) =>
    deals.ok
      ? deals.data
          .filter((d) => inRange(d.dateWon, r))
          .reduce((s, d) => s + (d.value ?? 0), 0)
      : 0;
  const show = calls.ok ? showRateHeld(calls.data, window, window.today) : null;
  const showBefore = calls.ok
    ? showRateHeld(calls.data, prior, window.today)
    : null;

  const briefing = briefingOf({
    period: capitalize(windowPhrase(window)),
    priorPhrase: `${dayLabel(prior.startDay)} – ${dayLabel(prior.endDay)}`,
    leads:
      leads.ok && window.startDay >= LEADS_RECORDED_FROM
        ? {
            now: countInRange(leads.data, (l) => l.day, window),
            before: countInRange(leads.data, (l) => l.day, prior),
          }
        : null,
    booked: calls.ok
      ? {
          now: kept.filter((c) => inRange(c.bookedDate, window)).length,
          before: kept.filter((c) => inRange(c.bookedDate, prior)).length,
        }
      : null,
    revenue: deals.ok
      ? {
          now: sum(window),
          before: sum(prior),
          deals: deals.data.filter((d) => inRange(d.dateWon, window)).length,
        }
      : null,
    showRate:
      show?.rate != null && showBefore?.rate != null
        ? { now: show.rate, before: showBefore.rate }
        : null,
  });

  return (
    <section aria-label="Briefing" className={`${adminCardClass} mb-4`}>
      <p className="text-ui-text text-lg leading-snug font-medium">
        {briefing.headline}
      </p>
      {briefing.items.length > 0 ? (
        <ul className="mt-3 grid gap-2 text-sm">
          {briefing.items.map((item) => (
            <li key={item.text} className="flex items-baseline gap-2.5">
              <AdminStatusBadge
                status={item.tone}
                label={item.tone === "bad" ? "Watch" : "Win"}
                tone={item.tone === "bad" ? "warn" : "ok"}
              />
              <span className="text-ui-text-muted">{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ui-text-muted mt-2 text-sm">
          Nothing moved more than 10% against {dayLabel(prior.startDay)} –{" "}
          {dayLabel(prior.endDay)}.
        </p>
      )}
    </section>
  );
}
