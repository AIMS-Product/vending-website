/**
 * Booked calls by the day they were booked — the marketing team's scoreboard.
 *
 * Every other booking number in this codebase is dated by something else. The
 * channel spine credits a booking to the day its lead first arrived, because
 * that is the only basis on which booked ÷ leads is a real rate. Close's
 * "First Sales Call Booked Date" is the day the call is *scheduled for*, not
 * the day it was booked — 96 of 102 leads checked on 2026-09-14 matched the
 * meeting date, 2 matched the booking date. Both are right for what they
 * answer and both are wrong for this question.
 *
 * Marketing does work in a week and wants to know what that week produced, so
 * this file dates a booking by Calendly's own booked-at and nothing else.
 * Calendly is the system of record for a booking being made.
 *
 * Reactivation is deliberately absent: 229 of the 257 Reactivation Scrapers
 * bookings since 2026-08-24 never reach our Calendly mirror, because that team
 * books on calendars we get no webhook from. Their only source is Close, on
 * the meeting-date basis, so folding them in here would mix the two axes this
 * file exists to keep apart. `reactivationSeen` reports the handful that do
 * come through, purely so the number is not mistaken for the whole team.
 */

// The regex that used to live here classified event names by pattern. It
// disagreed with the two other regexes doing the same job elsewhere in this
// repo by up to 202 bookings, and it counted `VendHub Consultation Call`,
// `Acquisition Ace Strategy Call` and a VendScout demo as Vendingpreneurs first
// calls. Classification is now the reviewed mapping in
// `calendly-event-types.json`, which fails closed on anything nobody has
// classified. See `calendly-event-class.ts`.

import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import { classifyEventType } from "@/lib/services/calendly-event-class";

/** Close funnels owned by the reactivation team, not by marketing. */
const REACTIVATION_FUNNELS = new Set([
  "Reactivation Scrapers",
  "Reactivation Email",
  "Sales Reactivation",
]);

export type BookingRow = {
  inviteeEmail: string | null;
  inviteeName?: string | null;
  status: string;
  eventName: string | null;
  /** Calendly's own booked-at. Falls back to the mirror row's insert time. */
  bookedAt: string | null;
  createdAt: string;
};

/** One Close lead, used only to name the funnel a booking belongs to. */
export type FunnelRow = { email: string | null; funnel: string | null };

export type WeekRow = {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  /** First calls booked that week that belong to a marketing funnel. */
  marketing: number;
  /** Reactivation bookings that happen to reach Calendly. Not the team's total. */
  reactivationSeen: number;
  /** Marketing first calls by Close funnel, biggest first. */
  byFunnel: Array<{ funnel: string; booked: number }>;
};

export type BookedCallsReport = {
  /** Oldest week first. The last row is the week in progress. */
  weeks: WeekRow[];
  /** Marketing bookings with no Close lead yet, in the most recent week. */
  notInCloseYet: number;
};

/**
 * Whether a booking is a first sales call, from the reviewed mapping.
 *
 * Unreviewed event types are NOT first calls. That is deliberate: the old regex
 * treated "no pattern matched" as "must be a new call", which is how generic
 * `30 Minute Meeting` slots and other brands' calendars ended up in this count.
 * Failing closed under-reports visibly instead of over-reporting invisibly.
 */
export function isFirstCall(
  eventName: string | null,
  eventTypeUri: string | null = null,
): boolean {
  return classifyEventType(eventTypeUri, eventName).class === "new";
}

/** The Monday of the week containing `day`, as YYYY-MM-DD. */
export function weekStartOf(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((weekday + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function buildBookedCalls(input: {
  bookings: BookingRow[];
  funnels: FunnelRow[];
  /** Mondays to report, oldest first. */
  weekStarts: string[];
  /** Test and internal bookings count only when the page toggle is on. */
  includeInternal?: boolean;
}): BookedCallsReport {
  const funnelByEmail = new Map<string, string>();
  for (const row of input.funnels) {
    const email = row.email?.trim().toLowerCase();
    if (email && !funnelByEmail.has(email)) {
      funnelByEmail.set(email, row.funnel ?? "No funnel set");
    }
  }

  const wanted = new Set(input.weekStarts);
  const weeks = new Map<
    string,
    WeekRow & { funnelCounts: Map<string, number> }
  >();
  for (const weekStart of input.weekStarts) {
    weeks.set(weekStart, {
      weekStart,
      marketing: 0,
      reactivationSeen: 0,
      byFunnel: [],
      funnelCounts: new Map(),
    });
  }

  let notInCloseYet = 0;
  const latest = input.weekStarts.at(-1);

  for (const booking of input.bookings) {
    if (!isFirstCall(booking.eventName)) continue;
    if (
      !input.includeInternal &&
      isInternalLead(booking.inviteeEmail, booking.inviteeName)
    ) {
      continue;
    }
    const day = (booking.bookedAt ?? booking.createdAt).slice(0, 10);
    const weekStart = weekStartOf(day);
    if (!wanted.has(weekStart)) continue;
    const week = weeks.get(weekStart);
    if (!week) continue;

    // Cancellations are deliberately not reported. Calendly only tells us
    // about a cancel through its webhook, and bookings made 3-23 August have
    // none on record at all, so a zero would read as "none happened" when it
    // means "never captured". The booking itself is still the channel's work.
    if (booking.status !== "booked") continue;

    const email = booking.inviteeEmail?.trim().toLowerCase();
    const funnel = email ? funnelByEmail.get(email) : undefined;
    if (funnel && REACTIVATION_FUNNELS.has(funnel)) {
      week.reactivationSeen += 1;
      continue;
    }

    week.marketing += 1;
    const label = funnel ?? "Not in Close yet";
    if (!funnel && weekStart === latest) notInCloseYet += 1;
    week.funnelCounts.set(label, (week.funnelCounts.get(label) ?? 0) + 1);
  }

  return {
    weeks: input.weekStarts.map((weekStart) => {
      const week = weeks.get(weekStart)!;
      const { funnelCounts, ...rest } = week;
      return {
        ...rest,
        byFunnel: [...funnelCounts.entries()]
          .map(([funnel, booked]) => ({ funnel, booked }))
          .sort(
            (a, b) => b.booked - a.booked || a.funnel.localeCompare(b.funnel),
          ),
      };
    }),
    notInCloseYet,
  };
}

/** The `count` Mondays ending with the week containing `today`, oldest first. */
export function recentWeekStarts(today: string, count: number): string[] {
  const current = weekStartOf(today);
  const out: string[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const date = new Date(`${current}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - back * 7);
    out.push(date.toISOString().slice(0, 10));
  }
  return out;
}
