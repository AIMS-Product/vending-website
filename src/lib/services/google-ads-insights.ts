import { CHANGE_DATE } from "@/lib/services/google-ads-changelog";
import { addDays, mondayOf } from "@/lib/services/funnel-board";

/**
 * The media-buyer views on /admin/analytics/google-ads, as pure functions:
 * weekly trend, before vs after the 2026-10-10 change, the wasted search term
 * list and campaign health. The loader reads; these only count.
 */

/** Frozen 2026-10-10 (docs/marketing/google-ads-baseline-2026-10-10.md): 30 days to 2026-10-09. */
export const BASELINE = {
  from: "2026-09-10",
  to: "2026-10-09",
  days: 30,
  spend: 8208.72,
  leads: 105,
  booked: 55,
  won: 4,
  wonValue: 27888,
} as const;

/** Two weeks of learning after the change; the real readout is after this day. */
export const READOUT_AFTER = "2026-10-24";

/** The keyword label for a lead whose click left no keyword anywhere. */
export const PRE_TRACKING = "(pre-tracking)";

export type DaySpend = { day: string; cost: number };
/** A lead on its Pacific created day; one per gclid. */
export type DayLead = {
  day: string;
  booked: boolean;
  won: boolean;
  wonValue: number;
};

export type Week = {
  weekStart: string;
  spend: number;
  leads: number;
  booked: number;
  wonValue: number;
  costPerBooked: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
export const costPerBooked = (spend: number, booked: number) =>
  booked > 0 && spend > 0 ? round2(spend / booked) : null;

/** Monday-start weeks, oldest first. Leads count in the week they came in. */
export function weeklyTrend(spend: DaySpend[], leads: DayLead[]): Week[] {
  const weeks = new Map<string, Week>();
  const weekFor = (day: string) => {
    const key = mondayOf(day);
    const found = weeks.get(key);
    if (found) return found;
    const created: Week = {
      weekStart: key,
      spend: 0,
      leads: 0,
      booked: 0,
      wonValue: 0,
      costPerBooked: null,
    };
    weeks.set(key, created);
    return created;
  };
  for (const s of spend) weekFor(s.day).spend += s.cost;
  for (const lead of leads) {
    const week = weekFor(lead.day);
    week.leads += 1;
    if (lead.booked) week.booked += 1;
    if (lead.won) week.wonValue += lead.wonValue;
  }
  return [...weeks.values()]
    .map((w) => ({
      ...w,
      spend: round2(w.spend),
      costPerBooked: costPerBooked(w.spend, w.booked),
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export type PeriodStats = {
  from: string;
  to: string;
  days: number;
  spend: number;
  booked: number;
  costPerBooked: number | null;
  spendPerWeek: number;
  bookedPerWeek: number;
};

export type BeforeAfter = {
  before: PeriodStats;
  /** Null until a full day has passed since the change. */
  after: PeriodStats | null;
  readoutAfter: string;
  /** True once the after window is past the learning period. */
  settled: boolean;
};

function stats(
  from: string,
  to: string,
  days: number,
  spend: number,
  booked: number,
): PeriodStats {
  return {
    from,
    to,
    days,
    spend: round2(spend),
    booked,
    costPerBooked: costPerBooked(spend, booked),
    spendPerWeek: round2((spend / days) * 7),
    bookedPerWeek: Math.round((booked / days) * 7 * 10) / 10,
  };
}

/**
 * Baseline (frozen) against everything from the change date to `lastDay`
 * (the last complete day). Booked calls are counted on the lead's day, so
 * recent days keep filling in as people book; the page says so.
 */
export function beforeAfter(
  spend: DaySpend[],
  leads: DayLead[],
  lastDay: string,
): BeforeAfter {
  const before = stats(
    BASELINE.from,
    BASELINE.to,
    BASELINE.days,
    BASELINE.spend,
    BASELINE.booked,
  );
  if (lastDay < CHANGE_DATE) {
    return { before, after: null, readoutAfter: READOUT_AFTER, settled: false };
  }
  const inAfter = (day: string) => day >= CHANGE_DATE && day <= lastDay;
  const days =
    Math.round(
      (Date.parse(`${lastDay}T00:00:00Z`) -
        Date.parse(`${CHANGE_DATE}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  const afterSpend = spend
    .filter((s) => inAfter(s.day))
    .reduce((sum, s) => sum + s.cost, 0);
  const afterBooked = leads.filter((l) => inAfter(l.day) && l.booked).length;
  return {
    before,
    after: stats(CHANGE_DATE, lastDay, days, afterSpend, afterBooked),
    readoutAfter: READOUT_AFTER,
    settled: lastDay > READOUT_AFTER,
  };
}

export type SearchTermSpend = {
  term: string;
  campaignId: string;
  cost: number;
  clicks: number;
};

export type WastedTerm = { term: string; cost: number; clicks: number };

/**
 * Search terms that spent at least `minSpend` in the range and never produced
 * a form fill, a booked call or a CRM upload (`converting`, keyed term). Highest
 * spend first.
 */
export function wastedSearchTerms(
  terms: SearchTermSpend[],
  converting: ReadonlySet<string>,
  minSpend = 25,
  limit = 15,
): WastedTerm[] {
  const byTerm = new Map<string, WastedTerm>();
  for (const t of terms) {
    const key = t.term.trim().toLowerCase();
    const row = byTerm.get(key) ?? { term: key, cost: 0, clicks: 0 };
    row.cost += t.cost;
    row.clicks += t.clicks;
    byTerm.set(key, row);
  }
  return [...byTerm.values()]
    .filter((t) => t.cost >= minSpend && !converting.has(t.term))
    .map((t) => ({ ...t, cost: round2(t.cost) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
}

export type CampaignStatusRow = {
  campaignId: string;
  name: string;
  status: string;
  primaryStatus: string | null;
  reasons: string[];
  dailyBudget: number | null;
};

export type AdStatusRow = {
  campaignId: string;
  adGroupStatus: string | null;
  status: string;
  approval: string | null;
  review: string | null;
};

export type CampaignHealth = {
  campaignId: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  liveAds: number;
  approvedAds: number;
  underReview: number;
  disapproved: number;
  /** Plain-English problems, worst first; empty when healthy. */
  flags: string[];
};

const REASON_TEXT: Record<string, string> = {
  BUDGET_CONSTRAINED: "Limited by budget",
  HAS_ADS_DISAPPROVED: "Has disapproved ads",
  HAS_ADS_LIMITED_BY_POLICY: "Ads limited by policy",
  MISSING_LEAD_FORM_EXTENSION: "No lead form asset (optional)",
  BIDDING_STRATEGY_LEARNING: "Bid strategy learning",
  BIDDING_STRATEGY_MISCONFIGURED: "Bid strategy misconfigured",
  NOT_ELIGIBLE: "Not eligible to serve",
};

/** Enabled campaigns first; a paused campaign is reported but not flagged. */
export function campaignHealth(
  campaigns: CampaignStatusRow[],
  ads: AdStatusRow[],
): CampaignHealth[] {
  return campaigns
    .map((c) => {
      const live = ads.filter(
        (a) =>
          a.campaignId === c.campaignId &&
          a.status === "ENABLED" &&
          a.adGroupStatus === "ENABLED",
      );
      const approved = live.filter((a) =>
        (a.approval ?? "").startsWith("APPROVED"),
      ).length;
      const disapproved = live.filter(
        (a) => a.approval === "DISAPPROVED",
      ).length;
      const underReview = live.filter(
        (a) => a.review === "REVIEW_IN_PROGRESS",
      ).length;
      const flags: string[] = [];
      if (c.status === "ENABLED") {
        if (live.length > 0 && approved === 0) {
          flags.push(
            underReview > 0
              ? "No approved ads yet: new ads under review"
              : "Not serving: no approved ads",
          );
        }
        for (const reason of c.reasons) {
          const text = REASON_TEXT[reason];
          if (text && !flags.includes(text)) flags.push(text);
        }
      }
      return {
        campaignId: c.campaignId,
        name: c.name,
        status: c.status,
        dailyBudget: c.dailyBudget,
        liveAds: live.length,
        approvedAds: approved,
        underReview,
        disapproved,
        flags,
      };
    })
    .sort(
      (a, b) =>
        Number(b.status === "ENABLED") - Number(a.status === "ENABLED") ||
        b.flags.length - a.flags.length,
    );
}

/** The keyword a lead came in on: utm_term, else its click's keyword, else pre-tracking. */
export function leadKeyword(
  utmTerm: string | null,
  clickKeyword: string | null | undefined,
): string {
  const term = utmTerm?.trim().toLowerCase();
  if (term && !term.startsWith("{")) return term;
  const fromClick = clickKeyword?.trim().toLowerCase();
  return fromClick || PRE_TRACKING;
}

/** The last complete day before `today` (YYYY-MM-DD). */
export const lastCompleteDay = (today: string) => addDays(today, -1);

type Counts = { key: string; leads: number; booked: number };

/**
 * The caveat over the keyword table while leads still lack a keyword: without
 * it, a keyword whose bookings sit in the unknown row reads as pure waste.
 */
export function keywordNote(
  keywords: readonly Counts[],
  totals: { leads: number; booked: number },
  clickLookup: boolean,
): string | null {
  const unknown = keywords.find((k) => k.key === PRE_TRACKING);
  if (!unknown || unknown.leads === 0) return null;
  const why = clickLookup
    ? "their click could not be matched to a keyword."
    : "they came before keyword tracking started on Oct 10, and the click lookup that fills them in starts after the pending database update.";
  return `${unknown.leads} of ${totals.leads} leads (${unknown.booked} of ${totals.booked} booked calls) in this range have no keyword: ${why} Booked calls per keyword are undercounted, so a keyword showing 0 booked here may still be booking calls. Don't pause keywords from this table until this note is gone.`;
}
