/**
 * The company's booked-call targets, as written in the Q4 Channel Goals sheet,
 * checked in so the goals page and every team view read one copy. Pure and
 * client-safe.
 *
 * Basis: a booked call is a Close lead's "First Sales Call Booked Date",
 * grouped by "Funnel Name DEAL (Opp)". First call only, cancellations included,
 * follow-ups and rebookings excluded. That is the definition the plan's June to
 * August baseline was counted on, so a target and its actual are one
 * population. The `close_lead_funnel` mirror carries exactly these fields.
 *
 * THE PLAN, and why these numbers and not the sheet's.
 *
 * The workbook's "Q4 Growth Plan" tab sets the rule this file implements: every
 * priority channel compounds +10% a month. It states that rule against an
 * August baseline of 821 booked calls. We do not use the 821. The same
 * workbook's "Booked Call Summary" tab counts August at 523 on the definition
 * above, and our own ledger reproduces that 523 exactly (and Jun 602 vs its
 * 603, Jul 676 vs its 677 — 1,801 of 1,803 leads). No window and no basis we
 * can count reproduces 821: not any 30-day window, not every Calendly booking
 * made in August (1,010), not every meeting that landed in August (998). A
 * target we cannot measure an actual against is not a target, so the growth
 * rule is applied to the August each channel actually booked. When someone
 * sources the 821, change BASELINES here and the diff is the audit trail.
 *
 * Edit here when the plan changes; the diff is the audit trail.
 */

export const TARGET_BASIS =
  "Close first sales call booked, by funnel. First call per lead, cancellations included, follow-ups excluded. The same count the Q4 plan's June to August baseline used.";

/** The plan applies from this month onward; earlier months show actuals only. */
export const TARGETS_FROM = "2026-09";

/** The month every growth target compounds up from. */
export const BASELINE_MONTH = "2026-08";

/** The sheet's growth rule: +10% a month, compounding. */
export const MONTHLY_GROWTH = 1.1;

export type GoalChannel = {
  key: string;
  label: string;
  /** Close funnel names that roll into this channel, exactly as Close spells them. */
  funnels: readonly string[];
  /**
   * Booked calls in BASELINE_MONTH, which the growth rule compounds from.
   * Null where the plan grows nothing for this channel.
   */
  baseline: number | null;
  /** A flat monthly target the plan fixes instead of growing. */
  fixedTarget?: number;
  /** Pace on Monday to Friday, matching the plan's "2 a workday" framing. */
  workdays?: boolean;
  /** Shown next to a missing target so nobody reads the dash as zero. */
  note?: string;
};

export const GOAL_CHANNELS: readonly GoalChannel[] = [
  {
    key: "lane-2",
    label: "Lane 2",
    funnels: ["Reactivation Scrapers", "Sales Reactivation"],
    baseline: 291,
    workdays: true,
  },
  {
    key: "webinar",
    label: "Webinar",
    funnels: ["Internal Webinar"],
    baseline: 72,
  },
  { key: "youtube", label: "YouTube", funnels: ["YouTube"], baseline: 64 },
  {
    key: "instagram",
    label: "Instagram",
    funnels: ["Instagram", "Anthony IG"],
    baseline: 51,
  },
  {
    key: "marketing-reactivation",
    label: "Marketing Reactivation",
    funnels: ["Reactivation Email"],
    // The sheet fixes this one rather than growing it: August booked 0, and
    // "2 booked calls a workday" is the stated plan, not a multiple of zero.
    baseline: null,
    fixedTarget: 44,
    workdays: true,
  },
  {
    key: "newsletter",
    label: "Newsletter",
    funnels: ["Newsletter", "Mike Newsletter"],
    baseline: null,
    note: "No target until the newsletter carries a tracked booking link and produces a baseline.",
  },
  {
    key: "website",
    label: "Website",
    funnels: ["Website"],
    baseline: 45,
  },
];

/** Funnels the plan holds flat and does not set a goal for, reported as one row. */
export const OTHER_CHANNEL: GoalChannel = {
  key: "other",
  label: "Other funnels",
  funnels: [],
  baseline: null,
  note: "Meta Ads, Google Ads, LTF, VSL, LinkedIn, X and the rest. Held at current volume in the plan, no goal set.",
};

/** A lead whose funnel field is empty in Close. Counted, never allocated. */
export const UNTRACKED_LABEL = "No funnel in Close";

/**
 * Whole months from BASELINE_MONTH to `month`. Negative before the baseline.
 */
function monthsAfterBaseline(month: string): number {
  const [by, bm] = BASELINE_MONTH.split("-").map(Number) as [number, number];
  const [y, m] = month.split("-").map(Number) as [number, number];
  return (y - by) * 12 + (m - bm);
}

/**
 * This channel's booked-call target for one month, or null where the plan sets
 * no number. A fixed target beats the growth rule; a channel with neither has
 * no target and must never be printed as a zero.
 */
export function targetForMonth(
  channel: GoalChannel,
  month: string,
): number | null {
  if (!hasTargets(month)) return null;
  if (channel.fixedTarget != null) return channel.fixedTarget;
  if (channel.baseline == null) return null;
  const steps = monthsAfterBaseline(month);
  if (steps <= 0) return null;
  return Math.round(channel.baseline * MONTHLY_GROWTH ** steps);
}

/** The month keys a period covers, e.g. ("2026-10", 3) -> Oct, Nov, Dec. */
export function monthsFrom(firstMonth: string, count: number): string[] {
  const [year, month] = firstMonth.split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, index) => {
    const at = new Date(Date.UTC(year, month - 1 + index, 1));
    return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * This channel's target across a period. A quarter is the sum of its months,
 * never one month times three — the whole point of a compounding plan is that
 * October and December are different numbers.
 */
export function targetOver(
  channel: GoalChannel,
  firstMonth: string,
  monthCount: number,
): number | null {
  const months = monthsFrom(firstMonth, monthCount);
  const each = months.map((month) => targetForMonth(channel, month));
  if (each.every((value) => value == null)) return null;
  return each.reduce((sum: number, value) => sum + (value ?? 0), 0);
}

/** Every goal channel's target across a period, summed. */
export function totalTargetOver(
  firstMonth: string,
  monthCount: number,
): number | null {
  const each = GOAL_CHANNELS.map((channel) =>
    targetOver(channel, firstMonth, monthCount),
  );
  if (each.every((value) => value == null)) return null;
  return each.reduce((sum: number, value) => sum + (value ?? 0), 0);
}

/**
 * Booked-call targets that exist elsewhere and are NOT what this page counts
 * against. Named here, and shown on the page, because three competing totals
 * in circulation is what made "are we on target" unanswerable. Each says why
 * it is not the live number rather than leaving someone to re-derive it.
 */
export const OTHER_TARGETS_IN_CIRCULATION: ReadonlyArray<{
  label: string;
  value: string;
  why: string;
}> = [
  {
    label: "800 a month",
    value:
      "Lane 2 330, Webinar 103, YouTube 85, Instagram 121, Website 117, Reactivation 44",
    why: 'The "Channel KPI Plan" tab\'s capacity ambition. It is a flat monthly number with no growth path, and it was set before the +10% rule. Kept visible because the team quotes it.',
  },
  {
    label: "833 a month",
    value:
      "Lane 2 433, Webinar 173, YouTube 76, Instagram 54, Website 54, Reactivation 43",
    why: 'The "Existing Monthly Target" column on the Booked Call Summary tab. Superseded; nothing reads it.',
  },
  {
    label: "+10% from 821",
    value: "September 903, October 993, November 1,093, December 1,202",
    why: "The Q4 Growth Plan tab's own arithmetic. Its August baseline of 821 does not reconcile with the 523 the same workbook counts for August, and no basis we can measure reproduces it, so the rule is used and the baseline is not.",
  },
];

const FUNNEL_TO_CHANNEL = new Map(
  GOAL_CHANNELS.flatMap((channel) =>
    channel.funnels.map((funnel) => [funnel.toLowerCase(), channel.key]),
  ),
);

/** The goal channel a Close funnel rolls into, `other` when the plan names none. */
export function channelKeyForFunnel(funnel: string | null): string | null {
  const key = funnel?.trim().toLowerCase();
  if (!key) return null;
  return FUNNEL_TO_CHANNEL.get(key) ?? OTHER_CHANNEL.key;
}

/** Whether the plan's targets apply to a month key like "2026-10". */
export function hasTargets(month: string): boolean {
  return month >= TARGETS_FROM;
}
