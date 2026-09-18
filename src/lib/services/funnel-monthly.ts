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

import { canonicalFunnelPath } from "@/lib/analytics/canonical-path";
import { isBookingFunnelPath } from "@/lib/content/booking-funnel-routes";
import {
  isChatbotCapture,
  isInternalLead,
} from "@/lib/services/admin-analytics-internal";
import { resolveChannel, resolveGa4Channel } from "@/lib/analytics/channel";
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
  utm_source?: string | null;
  utm_medium?: string | null;
  metadata?: unknown;
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
  /** Needed only when grouping by channel; GA4 stores no medium. */
  utm_source?: string | null;
  /** GA4's campaign, which is what separates paid google from organic. */
  utm_campaign?: string | null;
};

/**
 * What a row of the report is.
 *
 * "page" answers "which page converts" — the thing we change. "channel"
 * answers "which source converts" — the thing we spend on. Same stages, same
 * cohort rule, different question, so it is one switch rather than two tabs
 * that would eventually disagree about what a lead is.
 */
export type FunnelGrouping = "page" | "channel";

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
  /** The other dimension, one level down. Empty on a child row. */
  children?: FunnelPeriodRow[];
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
  grouping: FunnelGrouping;
  generatedAt: string;
};

// The funnel a row belongs to. Shared with the browser-side PostHog stamp so
// both sides of the vp_session_id seam agree on "which page".
// The funnel a row belongs to. Shared with the browser-side PostHog stamp so
// both sides of the vp_session_id seam agree on "which page".
export { canonicalFunnelPath };

export function buildFunnelMonthly(input: {
  leads: FunnelLeadRow[];
  visits: FunnelVisitRow[];
  shows: FunnelShowRow[];
  sessions?: FunnelSessionRow[];
  now: Date;
  includeInternal?: boolean;
  changedOn?: string;
  grouping?: FunnelGrouping;
}): FunnelMonthlyReport {
  const now = input.now;
  const today = dayKey(now);
  const changedOn = input.changedOn ?? FUNNEL_REBUILD_DAY;
  const grouping = input.grouping ?? "page";

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
      grouping,
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
      grouping,
      today,
      visitsThrough,
      changedOn,
    }),
    visitsThrough,
    showCoverage: showCoverage(leads, showByEmail, today),
    formStartsTracked: false,
    grouping,
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
  grouping: FunnelGrouping;
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
    grouping: input.grouping,
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
  grouping: FunnelGrouping;
  today: string;
  visitsThrough: string | null;
}): FunnelPeriod {
  const { start, end, today, visitsThrough, grouping } = input;
  // Visit rates stop where GA4 stops, on both sides of the division.
  const visitEnd = visitsThrough && visitsThrough < end ? visitsThrough : end;
  const visitWindowOpen = visitsThrough !== null && visitEnd >= start;

  // Two levels, always: the row is whichever dimension was asked for and the
  // children are the other one. Grouping by channel without being able to open
  // it is a number nobody can act on -- "Instagram converts at 38%" is only
  // useful once you can see it is one lander doing the work.
  const buckets = new Map<
    string,
    { own: Mutable; children: Map<string, Mutable> }
  >();
  const bucket = (row: string, child: string | null) => {
    let entry = buckets.get(row);
    if (!entry) {
      entry = { own: blank(row), children: new Map() };
      buckets.set(row, entry);
    }
    if (child === null) return entry.own;
    let kid = entry.children.get(child);
    if (!kid) {
      kid = blank(child);
      entry.children.set(child, kid);
    }
    return kid;
  };
  /** Applies a change to the row and to its child in one pass. */
  const both = (
    row: string,
    child: string,
    apply: (target: Mutable) => void,
  ) => {
    apply(bucket(row, null));
    apply(bucket(row, child));
  };

  for (const visit of input.visits) {
    if (visit.day < start || visit.day > visitEnd) continue;
    const page = canonicalFunnelPath(visit.landing_page);
    if (!page) continue;
    // GA4 holds no medium, so the campaign is what separates a paid google
    // session from an organic one. See resolveGa4Channel.
    const channel = resolveGa4Channel(
      visit.utm_source,
      visit.utm_campaign,
    ).channel;
    const [row, child] =
      grouping === "page" ? [page, channel] : [channel, page];
    both(row, child, (target) => {
      target.visits += visit.sessions;
    });
  }

  for (const lead of input.leads) {
    const day = lead.created_at.slice(0, 10);
    if (day < start || day > end) continue;
    const page = canonicalFunnelPath(lead.source_path);
    if (!page) continue;
    const channel = resolveChannel(lead.utm_source, {
      medium: lead.utm_medium,
      capturedByChatbot: isChatbotCapture(lead.metadata),
    }).channel;
    const [row, child] =
      grouping === "page" ? [page, channel] : [channel, page];
    const questions = input.questionsByLead.get(lead.id);
    const call = lead.call_booked_at
      ? classifyBookedCall(lead.email, input.showByEmail, today)
      : null;

    both(row, child, (target) => {
      target.leads += 1;
      if (day <= visitEnd) target.leadsInVisitWindow += 1;
      if (questions) {
        target.questionsOffered += 1;
        if (questions.finished) target.questionsFinished += 1;
      }
      if (!call) return;
      target.booked += 1;
      if (lead.closed_won_at) {
        target.won += 1;
        if (lead.closed_won_value !== null) {
          target.revenue = (target.revenue ?? 0) + lead.closed_won_value;
        }
      }
      applyCall(target, call, lead.closed_won_at !== null);
    });
  }

  const byLeads = (a: FunnelPeriodRow, b: FunnelPeriodRow) =>
    b.leads - a.leads || (b.visits ?? 0) - (a.visits ?? 0);
  const rows = [...buckets.values()]
    .map((entry) => ({
      ...finalise(entry.own, visitWindowOpen),
      children: [...entry.children.values()]
        .map((child) => finalise(child, visitWindowOpen))
        .sort(byLeads),
    }))
    .sort(byLeads);

  return {
    key: input.key,
    label: input.label,
    start,
    end,
    visitsEnd: visitWindowOpen ? visitEnd : null,
    rows,
    totals: finalise(
      sum([...buckets.values()].map((entry) => entry.own)),
      visitWindowOpen,
    ),
  };
}

/**
 * What happened to one booked call: held, no-show, not yet, or nobody logged it.
 *
 * The scheduled date comes from the Close mirror, which is the only column
 * that holds when the call actually IS rather than when it was booked. A lead
 * the mirror has never seen cannot be judged either way, so it is "unlogged"
 * rather than a no-show. `closeable` says the call is old enough that a
 * missing sale means something.
 *
 * Exported because the channel journey report has to split calls the same way;
 * two definitions of "showed up" would eventually disagree on one page.
 */
export function classifyBookedCall(
  email: string | null | undefined,
  showByEmail: Map<string, FunnelShowRow>,
  today: string,
): { state: "held" | "noShow" | "pending" | "unlogged"; closeable: boolean } {
  const mirror = showByEmail.get(emailKey(email));
  const scheduled = mirror?.first_sales_call_booked_date ?? null;
  if (!scheduled) return { state: "unlogged", closeable: false };
  if (scheduled > shiftDays(today, -SHOW_GRACE_DAYS)) {
    return { state: "pending", closeable: false };
  }
  const answer = mirror?.first_call_show_up?.trim().toLowerCase();
  if (answer === "yes") {
    return {
      state: "held",
      closeable: scheduled <= shiftDays(today, -CLOSE_MATURITY_DAYS),
    };
  }
  if (answer === "no") return { state: "noShow", closeable: false };
  return { state: "unlogged", closeable: false };
}

function applyCall(
  row: Mutable,
  call: ReturnType<typeof classifyBookedCall>,
  won: boolean,
): void {
  const { state, closeable } = call;
  if (state === "pending") {
    row.pendingShow += 1;
    return;
  }
  if (state === "unlogged") {
    row.showUnlogged += 1;
    return;
  }
  if (state === "noShow") {
    row.noShow += 1;
    return;
  }
  row.held += 1;
  if (closeable) {
    row.closeable += 1;
    if (won) row.wonOfCloseable += 1;
  }
}

export type LeadQuestions = { finished: boolean; furthest: number };

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
        ? crossSystemRatio(row.leadsInVisitWindow, row.visits)
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
export function indexShows(rows: FunnelShowRow[]): Map<string, FunnelShowRow> {
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
export function indexSessions(
  rows: FunnelSessionRow[],
): Map<string, LeadQuestions> {
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

/**
 * A rate whose two sides come from two instruments, dropped when it passes 100%.
 *
 * Opt-in is the only one here: the leads are rows in our own table, the visits
 * are GA4 sessions. GA4 attributes a session to the landing page it saw, and we
 * attribute a lead to the `source_path` the form was on, so a visitor who
 * landed on one page and submitted on another is counted on two different rows.
 * Where that runs one way the page shows more leads than visits — production on
 * 2026-09-18 had /newsletter at 236.4% and /booking-t5-socials/Meta at 133.3%.
 *
 * Above 100% the join has demonstrably failed, and a rate that cannot be true
 * is worth less than a dash. Below it the same error is present and invisible,
 * which is why the tab says opt-in is a shape and not a conversion rate. This
 * is the standing rule the Journeys tab already applies as `crossSystem`.
 */
const CROSS_SYSTEM_CEILING = 100;

function crossSystemRatio(
  numerator: number,
  denominator: number,
): number | null {
  const value = ratio(numerator, denominator);
  return value !== null && value > CROSS_SYSTEM_CEILING ? null : value;
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
