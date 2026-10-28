/** Canonical MTD V2 rules pinned to AIMS-Product/mtd-funnel-dashboard@9783f9a. */
import domRules from "@/lib/booked-calls-v2/rules.v2.6-any-meeting-clock.json";

export const RULE_VERSION = domRules.version;
/** Dom's config SHA-256 for v2.6; recorded so a screen can name what it ran. */
export const RULE_CONFIG_SHA =
  "b5c44b70f773b21ab5603d91907037f975f8669e91af23e113ea8ca5dc62bdcc";

export const TIME_ZONE = domRules.timezone;
/** Exactly 30 x 24 hours from the immediately preceding noncanceled scheduled meeting. */
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
  retiredAt: string | null;
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
    retiredAt:
      "retired_at_exclusive" in rule
        ? (rule.retired_at_exclusive as string)
        : null,
    bookedBy: rule.setter_name === SOCIAL_DM_SETTER ? "Social DMs" : "Lane 2",
  }),
);

/** Source/title fallback; setter name alone never qualifies. */
export const PEARL_SOURCE_TITLES: readonly RegExp[] =
  domRules.pearl_source_title_patterns.map((p) => new RegExp(p, "i"));

/** Exact raw source gate from the canonical JSON; query tails are not removed here. */
export const PEARL_SOCIAL_UTM_SOURCES: ReadonlySet<string> = new Set(
  domRules.pearl_accepted_utm_sources,
);

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
export const CANCELED_TITLE = /^\s*(canceled|cancelled)\b/i;

/** Handoff "Sales-call eligibility": follow-up / reschedule titles. */
export const FOLLOW_UP_TITLE =
  /follow[-\s]?up|fallow\s+up|\bf\/u\b|next\s+steps|reschedul/i;
/**
 * Handoff: non-booking and setter-only discovery titles, plus the internal
 * meetings Dom's engine calls not a sales call (not in `rules.json`; the
 * Oct 1-16 pull has 11 Webinar Actions Reviews among his 12).
 */
export const NOT_SALES_TITLE =
  /enrollment|silver\s+start\s+up|bronze\s+enrollment|\bq\s*&\s*a\b|walkthrough/i;
/** Any title that is not a new first call (Marketing MTD open-call filter). */
export const NON_NEW_CALL_TITLE = new RegExp(
  `${FOLLOW_UP_TITLE.source}|${NOT_SALES_TITLE.source}`,
  "i",
);

/** `Reactivation Scrapers` is retired and deliberately absent. */
export const ACCEPTED_SOURCES: readonly string[] = domRules.marketing_sources;
