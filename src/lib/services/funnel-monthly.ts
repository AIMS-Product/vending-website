/**
 * Per-funnel conversion rates, by month, as a LEAD COHORT.
 *
 * The question this answers is "which of our funnels converts, and is it
 * getting better or worse". The Channels tab answers it per traffic source;
 * this answers it per page, which is the thing we actually change.
 *
 * Two rules decide the whole shape of this module.
 *
 * 1. A row is one funnel in one month, and the month is the month the LEAD was
 *    captured -- not the month a call was booked or a deal closed. Every rate
 *    on the row then divides one population by itself: of the people who
 *    entered this funnel in August, this many booked, held, and bought,
 *    whenever those happened. Dating each stage by its own calendar month is
 *    the bug `funnel-cohort.ts` exists to remove, and it would be the same bug
 *    here one dimension over.
 *
 * 2. Visits are day-dated by GA4 and lag roughly a day behind leads. A visit
 *    rate over a window GA4 has not finished reporting divides today's leads by
 *    yesterday's visits and prints an opt-in rate that is too high. So every
 *    visit-denominated rate is computed over days up to `visitsThrough` only,
 *    on BOTH sides of the division, and the page prints that date.
 *
 * Nothing is defaulted to zero. A stage nobody has logged, or a cohort too
 * young to judge, comes back null so the page can say so.
 */

import { FUNNEL_REDIRECTS } from "@/lib/content/funnel-redirects";
import { isBookingFunnelPath } from "@/lib/content/booking-funnel-routes";
import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import {
  CLOSE_MATURITY_DAYS,
  SHOW_GRACE_DAYS,
} from "@/lib/services/funnel-cohort";

/**
 * The day the booking funnels were rebuilt: two-column hero with the form on
 * the first screen, chrome removed, four dead routes given a calendar, eleven
 * URLs redirected (commits 69ff27a, 3796564, 0fa1d9d, 92c62a0, b5af976).
 *
 * Everything before this is the baseline. Four things moved at once, so this
 * date splits the data; it does not attribute the difference to any one of
 * them.
 */
export const FUNNEL_REBUILD_DAY = "2026-09-17";

export type FunnelLeadRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  source_path: string | null;
  call_booked_at: string | null;
  closed_won_at: string | null;
  closed_won_value: number | null;
};

export type FunnelVisitRow = {
  day: string;
  landing_page: string;
  sessions: number;
};

/**
 * One qualification session: the scored questions a lead is offered after
 * handing over their contact details.
 *
 * This is where "filled in half the form" lives. The funnel is two stages —
 * stage 1 writes the lead row, stage 2 answers the questions — so a session
 * with no `completed_at` is somebody who gave us their number and then walked
 * away from the questions. Nothing else in the database records that.
 */
export type FunnelSessionRow = {
  lead_submission_id: string;
  completed_at: string | null;
  answer_count: number;
};

/** The Close mirror, which is the only place a show-up answer exists. */
export type FunnelShowRow = {
  email: string | null;
  first_sales_call_booked_date: string | null;
  first_call_show_up: string | null;
};

export type FunnelRates = {
  /** Visits that became a lead. Null until GA4 covers the window. */
  visitToLead: number | null;
  /** Leads offered the questions who finished them. The half-form rate. */
  questionsCompleted: number | null;
  leadToBook: number | null;
  /** Held / (held + no-show), over booked calls old enough to have an answer. */
  bookToShow: number | null;
  /** Won / held calls old enough to have closed. */
  showToWin: number | null;
};

export type FunnelPeriodRow = {
  funnel: string;
  /** True when the path is a registered booking funnel rather than a page that happens to capture leads. */
  isBookingFunnel: boolean;
  visits: number | null;
  leads: number;
  /** Leads who reached the questions at all. Not every page asks them. */
  questionsOffered: number;
  /** Of those, the ones who answered to the end. */
  questionsFinished: number;
  /** Offered the questions and stopped part-way. The half-filled forms. */
  questionsAbandoned: number;
  booked: number;
  /** Booked calls with a Yes/No show answer and old enough to have one. */
  showable: number;
  held: number;
  noShow: number;
  /** Booked, but the call has not happened yet (or not long enough ago). */
  pendingShow: number;
  /** Mature, and nobody logged whether they turned up. */
  showUnlogged: number;
  /** Held calls old enough that a win should have landed by now. */
  closeable: number;
  won: number;
  revenue: number | null;
  rates: FunnelRates;
};

export type FunnelPeriod = {
  /** `YYYY-MM` for a month, or a label for the before/after windows. */
  key: string;
  label: string;
  start: string;
  end: string;
  /**
   * Last day the visit columns cover, which is GA4's last reported day when
   * that falls inside the window. The raw visit COUNT is over this shorter
   * window while leads are over the full one, so a window ending today shows
   * fewer visits than it had. Print it next to any visit number.
   */
  visitsEnd: string | null;
  rows: FunnelPeriodRow[];
  totals: FunnelPeriodRow;
};

export type FunnelMonthlyReport = {
  months: FunnelPeriod[];
  /** Equal-length, weekday-aligned windows either side of the rebuild. */
  beforeAfter: {
    before: FunnelPeriod;
    after: FunnelPeriod;
    changedOn: string;
  } | null;
  /** Latest day GA4 has reported. Every visit rate stops here. */
  visitsThrough: string | null;
  /** Share of booked calls the Close mirror could answer for. */
  showCoverage: { known: number; total: number; pct: number | null };
  /**
   * Visitors who began typing and never submitted stage 1 are NOT here. No
   * row is written until consent is accepted, so a form abandoned before the
   * first submit leaves no trace in any table. The questions step below is
   * abandonment AFTER contact details, which is the part we can see.
   */
  formStartsTracked: false;
  generatedAt: string;
};

/** Old funnel URL -> the page it now renders, so a redirect keeps one history. */
const REDIRECT_DESTINATIONS: ReadonlyMap<string, string> = new Map(
  FUNNEL_REDIRECTS.map((redirect) => [
    redirect.source,
    // The destination carries `?source_path=`; the page is what precedes it.
    redirect.destination.split("?")[0] ?? redirect.destination,
  ]),
);

/**
 * The funnel a row belongs to.
 *
 * A redirected URL is folded into the page it now renders, because that is
 * what the visitor saw. Leaving them apart splits one funnel's history in
 * half on the day the redirect shipped: GA4 records the destination (it sees
 * the final URL) while the lead keeps `source_path` of the old one, so visits
 * and leads would land in different rows and every rate on both would be
 * wrong.
 */
export function canonicalFunnelPath(
  path: string | null | undefined,
): string | null {
  const raw = path?.trim();
  if (!raw) return null;
  // GA4 landing pages arrive with the query string attached.
  const withoutQuery = raw.split(/[?#]/)[0] ?? raw;
  const lowered = withoutQuery.toLowerCase();
  const normalised =
    lowered.length > 1 && lowered.endsWith("/")
      ? lowered.replace(/\/+$/, "")
      : lowered;
  if (!normalised.startsWith("/")) return null;
  return REDIRECT_DESTINATIONS.get(normalised) ?? normalised;
}

export function buildFunnelMonthly(input: {
  leads: FunnelLeadRow[];
  visits: FunnelVisitRow[];
  shows: FunnelShowRow[];
  sessions?: FunnelSessionRow[];
  now: Date;
  includeInternal?: boolean;
  changedOn?: string;
}): FunnelMonthlyReport {
  const now = input.now;
  const today = dayKey(now);
  const changedOn = input.changedOn ?? FUNNEL_REBUILD_DAY;

  const leads = input.leads.filter(
    (lead) =>
      input.includeInternal || !isInternalLead(lead.email, lead.full_name),
  );
  const showByEmail = indexShows(input.shows);
  const questionsByLead = indexSessions(input.sessions ?? []);
  const visitsThrough = maxDay(input.visits);

  const months = monthKeys(leads, input.visits).map((month) =>
    buildPeriod({
      key: month,
      label: monthLabel(month),
      start: `${month}-01`,
      end: monthEnd(month),
      leads,
      visits: input.visits,
      showByEmail,
      questionsByLead,
      today,
      visitsThrough,
    }),
  );
  months.sort((a, b) => b.key.localeCompare(a.key));

  return {
    months,
    beforeAfter: buildBeforeAfter({
      leads,
      visits: input.visits,
      showByEmail,
      questionsByLead,
      today,
      visitsThrough,
      changedOn,
    }),
    visitsThrough,
    showCoverage: showCoverage(leads, showByEmail, today),
    formStartsTracked: false,
    generatedAt: now.toISOString(),
  };
}

/**
 * Equal-length windows either side of the change, offset by whole weeks so the
 * two cover the same weekdays. Bookings are heavily weekday-shaped -- comparing
 * a Wed/Thu to a Sat/Sun would read as a collapse no change could cause.
 */
function buildBeforeAfter(input: {
  leads: FunnelLeadRow[];
  visits: FunnelVisitRow[];
  showByEmail: Map<string, FunnelShowRow>;
  questionsByLead: Map<string, LeadQuestions>;
  today: string;
  visitsThrough: string | null;
  changedOn: string;
}): FunnelMonthlyReport["beforeAfter"] {
  const { changedOn, today } = input;
  if (changedOn > today) return null;
  const days = daysBetween(changedOn, today) + 1;
  const weeks = Math.ceil(days / 7);
  const beforeStart = shiftDays(changedOn, -7 * weeks);
  const beforeEnd = shiftDays(beforeStart, days - 1);

  const shared = {
    leads: input.leads,
    visits: input.visits,
    showByEmail: input.showByEmail,
    questionsByLead: input.questionsByLead,
    today: input.today,
    visitsThrough: input.visitsThrough,
  };
  return {
    changedOn,
    before: buildPeriod({
      key: "before",
      label: `${days} days before (${formatDay(beforeStart)} – ${formatDay(beforeEnd)})`,
      start: beforeStart,
      end: beforeEnd,
      ...shared,
    }),
    after: buildPeriod({
      key: "after",
      label: `${days} days since (${formatDay(changedOn)} – ${formatDay(today)})`,
      start: changedOn,
      end: today,
      ...shared,
    }),
  };
}

function buildPeriod(input: {
  key: string;
  label: string;
  start: string;
  end: string;
  leads: FunnelLeadRow[];
  visits: FunnelVisitRow[];
  showByEmail: Map<string, FunnelShowRow>;
  questionsByLead: Map<string, LeadQuestions>;
  today: string;
  visitsThrough: string | null;
}): FunnelPeriod {
  const { start, end, today, visitsThrough } = input;
  // Visit rates stop where GA4 stops, on both sides of the division.
  const visitEnd = visitsThrough && visitsThrough < end ? visitsThrough : end;
  const visitWindowOpen = visitsThrough !== null && visitEnd >= start;

  const buckets = new Map<string, Mutable>();
  const bucket = (funnel: string) => {
    const existing = buckets.get(funnel);
    if (existing) return existing;
    const created = blank(funnel);
    buckets.set(funnel, created);
    return created;
  };

  for (const visit of input.visits) {
    if (visit.day < start || visit.day > visitEnd) continue;
    const funnel = canonicalFunnelPath(visit.landing_page);
    if (!funnel) continue;
    bucket(funnel).visits += visit.sessions;
  }

  for (const lead of input.leads) {
    const day = lead.created_at.slice(0, 10);
    if (day < start || day > end) continue;
    const funnel = canonicalFunnelPath(lead.source_path);
    if (!funnel) continue;
    const row = bucket(funnel);
    row.leads += 1;
    if (day <= visitEnd) row.leadsInVisitWindow += 1;
    const questions = input.questionsByLead.get(lead.id);
    if (questions) {
      row.questionsOffered += 1;
      if (questions.finished) row.questionsFinished += 1;
    }
    if (!lead.call_booked_at) continue;
    row.booked += 1;
    if (lead.closed_won_at) {
      row.won += 1;
      if (lead.closed_won_value !== null) {
        row.revenue = (row.revenue ?? 0) + lead.closed_won_value;
      }
    }
    applyShow(row, lead, input.showByEmail, today);
  }

  const rows = [...buckets.values()]
    .map((row) => finalise(row, visitWindowOpen))
    .sort((a, b) => b.leads - a.leads || (b.visits ?? 0) - (a.visits ?? 0));

  return {
    key: input.key,
    label: input.label,
    start,
    end,
    visitsEnd: visitWindowOpen ? visitEnd : null,
    rows,
    totals: finalise(sum(buckets.values()), visitWindowOpen),
  };
}

/**
 * Splits a booked call into held / no-show / still-waiting / nobody-logged-it.
 *
 * The scheduled date comes from the Close mirror, which is the only column
 * that holds when the call actually IS rather than when it was booked. A lead
 * the mirror has never seen cannot be judged either way, so it counts as
 * unlogged rather than as a no-show.
 */
function applyShow(
  row: Mutable,
  lead: FunnelLeadRow,
  showByEmail: Map<string, FunnelShowRow>,
  today: string,
): void {
  const mirror = showByEmail.get(emailKey(lead.email));
  const scheduled = mirror?.first_sales_call_booked_date ?? null;
  if (!scheduled) {
    row.showUnlogged += 1;
    return;
  }
  if (scheduled > shiftDays(today, -SHOW_GRACE_DAYS)) {
    row.pendingShow += 1;
    return;
  }
  const answer = mirror?.first_call_show_up?.trim().toLowerCase();
  if (answer === "yes") {
    row.held += 1;
    if (scheduled <= shiftDays(today, -CLOSE_MATURITY_DAYS)) {
      row.closeable += 1;
      if (lead.closed_won_at) row.wonOfCloseable += 1;
    }
    return;
  }
  if (answer === "no") {
    row.noShow += 1;
    return;
  }
  row.showUnlogged += 1;
}

type LeadQuestions = { finished: boolean; furthest: number };

type Mutable = {
  funnel: string;
  visits: number;
  leads: number;
  questionsOffered: number;
  questionsFinished: number;
  /** Leads inside the GA4-covered part of the window; the visit-rate numerator. */
  leadsInVisitWindow: number;
  booked: number;
  held: number;
  noShow: number;
  pendingShow: number;
  showUnlogged: number;
  closeable: number;
  won: number;
  wonOfCloseable: number;
  revenue: number | null;
};

function blank(funnel: string): Mutable {
  return {
    funnel,
    visits: 0,
    leads: 0,
    questionsOffered: 0,
    questionsFinished: 0,
    leadsInVisitWindow: 0,
    booked: 0,
    held: 0,
    noShow: 0,
    pendingShow: 0,
    showUnlogged: 0,
    closeable: 0,
    won: 0,
    wonOfCloseable: 0,
    revenue: null,
  };
}

function sum(rows: Iterable<Mutable>): Mutable {
  const total = blank("All funnels");
  for (const row of rows) {
    total.visits += row.visits;
    total.leads += row.leads;
    total.questionsOffered += row.questionsOffered;
    total.questionsFinished += row.questionsFinished;
    total.leadsInVisitWindow += row.leadsInVisitWindow;
    total.booked += row.booked;
    total.held += row.held;
    total.noShow += row.noShow;
    total.pendingShow += row.pendingShow;
    total.showUnlogged += row.showUnlogged;
    total.closeable += row.closeable;
    total.won += row.won;
    total.wonOfCloseable += row.wonOfCloseable;
    if (row.revenue !== null)
      total.revenue = (total.revenue ?? 0) + row.revenue;
  }
  return total;
}

function finalise(row: Mutable, visitWindowOpen: boolean): FunnelPeriodRow {
  const showable = row.held + row.noShow;
  return {
    funnel: row.funnel,
    isBookingFunnel: isBookingFunnelPath(row.funnel),
    visits: visitWindowOpen ? row.visits : null,
    leads: row.leads,
    questionsOffered: row.questionsOffered,
    questionsFinished: row.questionsFinished,
    questionsAbandoned: row.questionsOffered - row.questionsFinished,
    booked: row.booked,
    showable,
    held: row.held,
    noShow: row.noShow,
    pendingShow: row.pendingShow,
    showUnlogged: row.showUnlogged,
    closeable: row.closeable,
    won: row.won,
    revenue: row.revenue,
    rates: {
      visitToLead: visitWindowOpen
        ? ratio(row.leadsInVisitWindow, row.visits)
        : null,
      questionsCompleted: ratio(row.questionsFinished, row.questionsOffered),
      leadToBook: ratio(row.booked, row.leads),
      bookToShow: ratio(row.held, showable),
      showToWin: ratio(row.wonOfCloseable, row.closeable),
    },
  };
}

function showCoverage(
  leads: FunnelLeadRow[],
  showByEmail: Map<string, FunnelShowRow>,
  today: string,
): FunnelMonthlyReport["showCoverage"] {
  const cutoff = shiftDays(today, -SHOW_GRACE_DAYS);
  let known = 0;
  let total = 0;
  for (const lead of leads) {
    if (!lead.call_booked_at) continue;
    const mirror = showByEmail.get(emailKey(lead.email));
    const scheduled = mirror?.first_sales_call_booked_date ?? null;
    if (!scheduled || scheduled > cutoff) continue;
    total += 1;
    const answer = mirror?.first_call_show_up?.trim().toLowerCase();
    if (answer === "yes" || answer === "no") known += 1;
  }
  return { known, total, pct: ratio(known, total) };
}

/**
 * One mirror row per email. The mirror can hold several rows for one person;
 * the earliest scheduled call is their first, which is the one every rate here
 * is about.
 */
function indexShows(rows: FunnelShowRow[]): Map<string, FunnelShowRow> {
  const index = new Map<string, FunnelShowRow>();
  for (const row of rows) {
    const key = emailKey(row.email);
    if (!key) continue;
    const existing = index.get(key);
    if (!existing) {
      index.set(key, row);
      continue;
    }
    const mine = row.first_sales_call_booked_date ?? "9999-12-31";
    const theirs = existing.first_sales_call_booked_date ?? "9999-12-31";
    if (mine < theirs) index.set(key, row);
  }
  return index;
}

/**
 * How far each lead got through the questions.
 *
 * Keyed on the LEAD, not the session: a double submit opens a second session
 * for one person, and counting sessions would report the same prospect
 * abandoning and completing at once. Anyone with a completed session finished,
 * whichever attempt it was.
 */
function indexSessions(rows: FunnelSessionRow[]): Map<string, LeadQuestions> {
  const index = new Map<string, LeadQuestions>();
  for (const row of rows) {
    const key = row.lead_submission_id;
    if (!key) continue;
    const existing = index.get(key);
    index.set(key, {
      finished: (existing?.finished ?? false) || row.completed_at !== null,
      furthest: Math.max(existing?.furthest ?? 0, row.answer_count),
    });
  }
  return index;
}

function emailKey(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

function monthKeys(leads: FunnelLeadRow[], visits: FunnelVisitRow[]): string[] {
  const keys = new Set<string>();
  for (const lead of leads) keys.add(lead.created_at.slice(0, 7));
  for (const visit of visits) keys.add(visit.day.slice(0, 7));
  return [...keys].sort();
}

function maxDay(visits: FunnelVisitRow[]): string | null {
  let latest: string | null = null;
  for (const visit of visits) {
    if (latest === null || visit.day > latest) latest = visit.day;
  }
  return latest;
}

/** Null, never zero, when the denominator is empty. */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function monthEnd(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return dayKey(new Date(Date.UTC(year, index, 0)));
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function shiftDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return dayKey(date);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
