/**
 * Dom's booked-call rules, `booked_calls.v2.2` (memo 2026-10-13), as data.
 *
 * Title regexes are copied from `AIMS-Product/close-first-sales-meeting`
 * `update_field.py` (SCRAPER_TITLE_MAP, CLOSER_PATTERNS, EXCLUDED_OWNERS,
 * SETTER_OWNERS) in their approved order. The four V2 titles that file does
 * not carry (PPA Growth, Enterprise, Velocity, Horizon) follow its style.
 * "TLG Clarity" is deployed there but deliberately not in V2.
 *
 * ponytail: transcribed from the memo; when Dom shares `rules.json`, vendor it
 * and check this file against its config SHA instead of the memo.
 */

export const RULE_VERSION = "booked_calls.v2.2";
/** Dom's config SHA-256 for v2.2; recorded so a screen can name what it ran. */
export const RULE_CONFIG_SHA =
  "6949a5ee62fb387c569f1536fe63e65c64dc0d347c93560e422202aa894b581a";

export const TIME_ZONE = "America/Los_Angeles";
export const REPEAT_DAYS = 60;
/** Historical title exceptions apply only to meetings created before this. */
export const HISTORICAL_CUTOFF = "2026-10-14T07:00:00Z";

export type BookedBy = "Marketing" | "Lane 2" | "Social DMs";

type TitleRule = { pattern: RegExp; setter: string; bookedBy: BookedBy };

const VP = String.raw`vendingpren[eu]+rs?`;
const lane2 = (source: string, setter: string): TitleRule => ({
  pattern: new RegExp(source, "i"),
  setter,
  bookedBy: "Lane 2",
});

/** Order matters: most specific first, as in update_field.py. */
export const TITLE_MAP: readonly TitleRule[] = [
  lane2(String.raw`ppa\s+growth\s*-?\s*next\s+steps`, "Tony Parton"),
  lane2(String.raw`${VP}\s+enterprise\s*-?\s*next\s+steps`, "Ashley Atencio"),
  lane2(String.raw`${VP}\s+velocity\s*-?\s*next\s+steps`, "Ibraheem Khan"),
  lane2(String.raw`${VP}\s+pinnacle\s*-\s*next\s+steps`, "Monde"),
  lane2(String.raw`${VP}\s+executive\s*-\s*next\s+steps`, "Finley Eastlake"),
  lane2(String.raw`${VP}\s+-\s+next\s+steps\s+call`, "Charlie Ingram"),
  lane2(String.raw`${VP}\s+next\s+steps\s+call`, "Vince Bartolini"),
  lane2(String.raw`vendingpren[eu]+r\s+next\s+steps`, "William Nowak"),
  {
    pattern: new RegExp(String.raw`${VP}\s+next\s+steps\s+session`, "i"),
    setter: "Pearl Sathekge",
    bookedBy: "Social DMs",
  },
  lane2(
    String.raw`vending\s+discovery\s+call\s+-\s+next\s+steps`,
    "August Young",
  ),
  lane2(
    String.raw`vending\s+opportunity\s*-?\s*next\s+steps`,
    "Cassie Caraballo",
  ),
  lane2(String.raw`${VP}\s+connect\s*-?\s*next\s+steps`, "Jessica Zatkin"),
  lane2(String.raw`${VP}\s+momentum\s*-?\s*next\s+steps`, "Connor George"),
  lane2(String.raw`${VP}\s+pathway\s*-?\s*next\s+steps`, "Naria Torres"),
  lane2(String.raw`${VP}\s+blueprint\s*-?\s*next\s+steps`, "Melia King"),
  lane2(String.raw`tlg\s+pinnacle\s*-?\s*next\s+steps`, "Kaylane Nunes"),
  lane2(String.raw`tlg\s+compass\s*-?\s*next\s+steps`, "Josh Stoffel"),
  lane2(String.raw`tlg\s+elevate\s*-?\s*next\s+steps`, "Catalina"),
  lane2(String.raw`tlg\s+vanguard\s*-?\s*next\s+steps`, "Connor Mason"),
  lane2(String.raw`tlg\s+northstar\s*-?\s*next\s+steps`, "Jonathan Quinn"),
  lane2(String.raw`${VP}\s+ascent\s*-?\s*next\s+steps`, "Owen Hart"),
  lane2(String.raw`${VP}\s+keystone\s*-?\s*next\s+steps`, "Brad Savage"),
  lane2(String.raw`${VP}\s+summit\s*-?\s*next\s+steps`, "Rob Maxfield"),
  lane2(String.raw`${VP}\s+growth\s*-?\s*next\s+steps`, "Igor Trojanowski"),
  lane2(String.raw`${VP}\s+horizon\s*-?\s*next\s+steps`, "Ariella Irvine"),
];

/** The 12 approved new-call families an unmapped title can earn Marketing with. */
export const FIRST_CALL_FAMILIES: readonly RegExp[] = [
  /vending\s+strategy\s+call/i,
  /vendingpren[eu]+rs?\s+consultation/i,
  /vendingpren[eu]+rs?\s+strategy\s+call/i,
  /new\s+vendingpren[eu]+r\s+strategy\s+call/i,
  /vending\s+consult\b/i,
  /post\s+masterclass\s+strategy\s+call/i,
  /vending\s+route\s+consultation/i,
  /cash[-\s]flowing\s+vending\s+route\s+advisory\s+interview/i,
  /vending\s+route\s+advisory\s+call/i,
  /vending\s+route\s+discovery/i,
  /vending\s+consultation\s+&\s+strategy\s+session/i,
  /vendhub\s+consultation\s+call/i,
];

const ARIELLA = /\bariella\b/i;
const WILLIAM = /\bwilliam\b/i;
const QUICK_DISCOVERY = /quick\s+discovery/i;

export type HistoricalException = {
  key: string;
  matches: (title: string, leadSetter: string | null) => boolean;
};

/** Valid only for meetings created before `HISTORICAL_CUTOFF`. */
export const HISTORICAL_EXCEPTIONS: readonly HistoricalException[] = [
  {
    key: "ariella_strategy",
    matches: (t) => ARIELLA.test(t) && /strategy\s+call/i.test(t),
  },
  {
    key: "ariella_follow_up",
    matches: (t) => ARIELLA.test(t) && /follow[-\s]?up/i.test(t),
  },
  {
    key: "ariella_rescheduled",
    matches: (t) => ARIELLA.test(t) && /reschedul/i.test(t),
  },
  {
    key: "william_quick_discovery",
    matches: (t) => WILLIAM.test(t) && QUICK_DISCOVERY.test(t),
  },
  {
    key: "william_setter_quick_discovery",
    matches: (t, setter) =>
      QUICK_DISCOVERY.test(t) &&
      (setter ?? "").trim().toLowerCase() === "william nowak",
  },
];

/** Never credit: Stephen Olivas, Ahmad Bukhari. */
export const EXCLUDED_CALLERS: ReadonlySet<string> = new Set([
  "user_5cZRqXu8kb4O1IeBVA98UMcMEhYZUhx1fnCHfSL0YMV",
  "user_yRF070m26JE67J6CJqzkAB3IqY7btNm1K5RisCglKa6",
]);
/** Setter-only discovery callers: Kristin Nelson, Spencer Reynolds. */
export const SETTER_ONLY_CALLERS: ReadonlySet<string> = new Set([
  "user_EmhqCmaHERTfgfWnPADiLGEqQw3ENvRYd3u1VEmblIp",
  "user_4sfuKGMbv0LQZ4hpS8ipASv406kKTSNP5Xx79jOwSqM",
]);

export const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "upcoming",
  "in-progress",
  "completed",
]);
export const CANCELED_OUTCOME = /cancel|reschedul/i;
export const CANCELED_TITLE = /^cancel(?:l)?ed[\s:]?/i;
/** Generic follow-up / reschedule / non-sales titles (update_field.py hard excludes + memo). */
export const NON_NEW_CALL_TITLE =
  /follow[-\s]?up|fallow\s+up|f\/u\b|next\s+steps|reschedul|enrollment|silver\s+start\s*up|q\s*&\s*a|walk\s*-?through/i;
export const RESCHEDULE_SIGNAL = /reschedul/i;

/** Appendix B. `Reactivation Scrapers` is retired and deliberately absent. */
export const ACCEPTED_SOURCES: readonly string[] = [
  "Affiliate",
  "Anthony IG",
  "Anthony X",
  "Direct Traffic",
  "GoHighLevel",
  "Google Ads",
  "Instagram",
  "Internal Webinar",
  "Linkedin",
  "LinkedIn Ads",
  "Low Ticket Funnel",
  "LTF - In-House",
  "LTF - Quiz Funnel",
  "Meta Ads",
  "Mike Newsletter",
  "OLD Organic - Misc - Cam",
  "Passivepreneurs",
  "Podcast - Paid",
  "Q4 Misc Traffic Cam",
  "Reactivation Email",
  "Reactivation Email Setter",
  "Referred",
  "Sales Reactivation",
  "Search - OG",
  "Side Hustle Nation",
  "TikTok",
  "VSL",
  "Website",
  "Website - OG - Cam",
  "WWWS",
  "X",
  "YouTube",
  "YouTube Ads",
];
