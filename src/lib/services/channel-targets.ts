/**
 * The company's booked-call targets, as written in the Q4 Channel Goals sheet
 * (Channel KPI Plan tab, "800 booked calls a month"), checked in so the goals
 * page and every team view read one copy. Pure and client-safe.
 *
 * Basis: a booked call is a Close lead's "First Sales Call Booked Date",
 * grouped by "Funnel Name DEAL (Opp)". First call only, cancellations included,
 * follow-ups and rebookings excluded. That is the definition the plan's June to
 * August baseline was counted on, so a target and its actual are one
 * population. The `close_lead_funnel` mirror carries exactly these fields.
 *
 * Edit here when the plan changes; the diff is the audit trail.
 */

export const TARGET_BASIS =
  "Close first sales call booked, by funnel. First call per lead, cancellations included, follow-ups excluded. The same count the Q4 plan's June to August baseline used.";

/** The plan applies from this month onward; earlier months show actuals only. */
export const TARGETS_FROM = "2026-09";

export type GoalChannel = {
  key: string;
  label: string;
  /** Close funnel names that roll into this channel, exactly as Close spells them. */
  funnels: readonly string[];
  /** Booked calls per month. Null where the plan sets no number yet. */
  target: number | null;
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
    target: 330,
    workdays: true,
  },
  {
    key: "webinar",
    label: "Webinar",
    funnels: ["Internal Webinar"],
    target: 103,
  },
  { key: "youtube", label: "YouTube", funnels: ["YouTube"], target: 85 },
  {
    key: "instagram",
    label: "Instagram",
    funnels: ["Instagram", "Anthony IG"],
    target: 121,
  },
  {
    key: "marketing-reactivation",
    label: "Marketing Reactivation",
    funnels: ["Reactivation Email"],
    target: 44,
    workdays: true,
  },
  {
    key: "newsletter",
    label: "Newsletter",
    funnels: ["Newsletter", "Mike Newsletter"],
    target: null,
    note: "No target until the newsletter carries a tracked booking link and produces a baseline.",
  },
  { key: "website", label: "Website", funnels: ["Website"], target: 117 },
];

/** Funnels the plan holds flat and does not set a goal for, reported as one row. */
export const OTHER_CHANNEL: GoalChannel = {
  key: "other",
  label: "Other funnels",
  funnels: [],
  target: null,
  note: "Meta Ads, Google Ads, LTF, VSL, LinkedIn, X and the rest. Held at current volume in the plan, no goal set.",
};

/** A lead whose funnel field is empty in Close. Counted, never allocated. */
export const UNTRACKED_LABEL = "No funnel in Close";

export const MONTHLY_TARGET_TOTAL = GOAL_CHANNELS.reduce(
  (sum, channel) => sum + (channel.target ?? 0),
  0,
);

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
