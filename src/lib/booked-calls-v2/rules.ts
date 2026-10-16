/**
 * Dom's booked-call rules, `booked_calls.v2.6-scheduled-anchor-candidate`
 * (handoff 2026-10-16), as data. Every title, caller, pattern and source
 * comes from his `rules.json` vendored verbatim beside this file (SHA-256
 * 2a3343fd…942f, pinned in sources.test.ts). Do not edit the JSON: a new rule
 * version is a new file. The few constants below are the handoff's prose
 * rules that his engine applies but `rules.json` does not carry.
 */

import domRules from "@/lib/booked-calls-v2/rules.v2.6.json";

export const RULE_VERSION = domRules.version;
/** Dom's config SHA-256 for v2.6; recorded so a screen can name what it ran. */
export const RULE_CONFIG_SHA =
  "2a3343fd339133c62b7accba767893c0b297d4b0be2527c95ca111c84895942f";

export const TIME_ZONE = domRules.timezone;
/** Exactly 30 x 24 hours from the prior credited meeting's scheduled start. */
export const EPISODE_MS = domRules.candidate_policy.episode_days * 86_400_000;
/** Title rules flagged `historical` apply only to meetings created before this. */
export const HISTORICAL_CUTOFF = domRules.historical_cutoff_exclusive;

export type BookedBy = "Marketing" | "Lane 2" | "Social DMs";

export const SOCIAL_DM_SETTER = domRules.candidate_policy.social_dm_setter;

export type TitleRule = {
  key: string;
  pattern: RegExp;
  setter: string;
  /** Lead's current setter must be this person for the rule to apply. */
  requiredSetter: string | null;
  historical: boolean;
  bookedBy: BookedBy;
};

/** Order matters: first match wins, in Dom's order. */
export const TITLE_MAP: readonly TitleRule[] = domRules.title_rules.map(
  (rule) => ({
    key: rule.key,
    pattern: new RegExp(rule.pattern, "i"),
    setter: rule.setter_name,
    requiredSetter: rule.required_setter,
    historical: rule.historical,
    bookedBy: rule.setter_name === SOCIAL_DM_SETTER ? "Social DMs" : "Lane 2",
  }),
);

/**
 * Pearl's Social DM leads booked onto a standard closer calendar. Applied
 * only when the lead's current setter is Pearl: the handoff names these
 * "Pearl social-source/title patterns" but not the gate, and the titles are
 * also ordinary Marketing first calls.
 */
export const PEARL_SOURCE_TITLES: readonly RegExp[] =
  domRules.pearl_source_title_patterns.map((p) => new RegExp(p, "i"));

/** The 12 approved new-call families an unmapped title can earn Marketing with. */
export const FIRST_CALL_FAMILIES: readonly RegExp[] =
  domRules.new_call_patterns.map((p) => new RegExp(p, "i"));

/** Never credit: Stephen Olivas, Ahmad Bukhari. */
export const EXCLUDED_CALLERS: ReadonlySet<string> = new Set(
  domRules.excluded_callers,
);
/** Setter-only discovery callers: Kristin Nelson, Spencer Reynolds. */
export const SETTER_ONLY_CALLERS: ReadonlySet<string> = new Set(
  domRules.setter_only_callers,
);

export const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "upcoming",
  "in-progress",
  "completed",
]);
export const CANCEL_STATUSES: ReadonlySet<string> = new Set(
  domRules.candidate_policy.cancellation_statuses,
);
/** A native `Rescheduled` outcome is not here: it keeps the original credit. */
export const CANCEL_OUTCOMES: ReadonlySet<string> = new Set(
  domRules.candidate_policy.cancellation_outcomes,
);
export const CANCELED_TITLE = /^cancel(?:l)?ed[\s:]?/i;

/** Handoff "Sales-call eligibility": follow-up / reschedule titles. */
export const FOLLOW_UP_TITLE =
  /follow[-\s]?up|fallow\s+up|f\/u\b|next\s+steps|reschedul/i;
/** Handoff: non-booking and setter-only discovery titles. */
export const NOT_SALES_TITLE =
  /enrollment|silver\s+start\s*up|q\s*&\s*a|walk\s*-?through|vending\s+quick\s+discovery|route\s+planning\s+call/i;
/** Any title that is not a new first call (Marketing MTD open-call filter). */
export const NON_NEW_CALL_TITLE = new RegExp(
  `${FOLLOW_UP_TITLE.source}|${NOT_SALES_TITLE.source}`,
  "i",
);

/** `Reactivation Scrapers` is retired and deliberately absent. */
export const ACCEPTED_SOURCES: readonly string[] = domRules.marketing_sources;
