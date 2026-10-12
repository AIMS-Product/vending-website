import { LEAD_DEFINITION } from "@/lib/analytics/lead-definition";
import { MATURE_AFTER_DAYS } from "@/lib/services/close-monthly-funnel";
import { DEFINITIONS_ID } from "@/lib/analytics/data-trust-bar";
import { SMALL_SAMPLE } from "@/lib/analytics/channel-value";

/** Anchor of one entry, so a card's "?" can land on its own definition. */
export const glossaryAnchor = (term: string) =>
  `def-${term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

/**
 * Card titles on /admin/analytics, each with its "how it's counted" note. The
 * cards show a title, the number and the chart; the words live here (METRICS.md
 * §16 has the full definitions).
 */
export const CARD_HELP = {
  glance: "Booked calls by channel",
  today: "Today",
  kpi: "Key numbers",
  scorecard: "Leadership scorecard",
  flow: "Every channel, from capture to sale",
  value: "What each channel's calls are worth",
  paid: "Paid ads: Google and Meta",
  bookings: "Booked calls",
  cost: "Cost per booked call",
  trend: "Leads and booked calls per day",
} as const;

/**
 * The words every analytics tab shares, defined once on screen. Tooltips never
 * show on a phone, and a marketer asking what "(3 direct)" meant is how this
 * came to exist (2026-09-22). Each entry restates the rule the code applies;
 * change them together.
 */
export const GLOSSARY: ReadonlyArray<{ term: string; meaning: string }> = [
  {
    term: CARD_HELP.glance,
    meaning: `Close first calls (SteelTrap rule, §5) by channel, credited as the flow card credits them. This week is Monday to today; this month is the 1st to today; days are Eastern time, as the sales floor counts them. Double down and Watch read the "What each channel's calls are worth" table for the window on screen: paid channels with at least ${SMALL_SAMPLE} booked calls, Double down when revenue won per $1 spent is $1 or more (best first), Watch when it is under $1 (worst first). Recent calls have had less time to close, so revenue per $1 reads low on short windows.`,
  },
  {
    term: CARD_HELP.today,
    meaning:
      "Calls booked today: new calls booked, Lane 2 out (§5). First calls on the calendar: Close first calls dated today, SteelTrap rule (§3, §5), the same calls Showed so far splits. Leads in today: site leads, people (§4). Showed so far: the rep logged the first-call show (§6). Each compares with yesterday and the same weekday last week. A dash means not read, never zero.",
  },
  {
    term: CARD_HELP.kpi,
    meaning:
      "Each against the same length of time just before. Leads: people on site forms (§4), recorded from Jul 6, 2026. Booked calls: Close mirror, SteelTrap rule (§3, §5), split marketing and reactivation as the flow card credits them (a lead with a Google click id is marketing, whatever Close funnel it sits under). Show rate: of calls held (§7). Revenue won: by date won (§8). CAC: blended, monthly model, the newest month with inputs (§10).",
  },
  {
    term: CARD_HELP.scorecard,
    meaning:
      "Monday to Sunday weeks, whatever the window. Total booked calls: Close first sales calls dated in the week (the day the call is scheduled for), every one, as the sheet's Total counts them; kept = after cancelled-by-lead, outside-the-US and quiz-funnel calls are removed (§3); mktg = kept, without Lane 2 reactivation by Close funnel (as the sheet splits it, so Google click leads Close files under Lane 2 stay in reactivation here, unlike the flow card). MQLs: every new marketing lead captured, site form leads plus webinar registrations, off-site form fills and ManyChat contacts (§4, UTC days); scored = site form fills the qualification quiz sent to a call (top closers, Lane 1, setting). Ad spend: Google Ads cost from Google Analytics (the property's Google Ads link) and Meta spend from Metricool, webinar campaigns included; incomplete = a network that spent in these weeks has days with nothing recorded. Cost per MQL: ad spend divided by MQLs for the same week.",
  },
  {
    term: CARD_HELP.flow,
    meaning:
      "Captured: leads and contacts on the channel spine (§4, UTC days). Booked onward: Close first calls in the window and what became of them to date (§5, §6, §16), by Close funnel, except that a lead whose site form carried a Google click id counts as Google Ads. Calls the SteelTrap rule leaves out are not counted. A call qualified with no show logged counts as qualified, never as a show. Won deals with no value in Close count as won and add nothing to revenue. Chatbot leads are in Website & search, where Close files their calls.",
  },
  {
    term: CARD_HELP.value,
    meaning: `The flow card's calls: Close first calls booked in the window and what became of them to date (§5, §6, §16), won deals and revenue from Close opportunities (§8). A lead whose site form carried a Google click id counts as Google Ads, whatever Close funnel it is filed under. Spend: ad spend on the channel spine in the window, as the cost card counts it (§9). Close rate is won over booked. Won deals lag: recent bookings have had less time to close, so compare channels on the same window and use 90 days for close rate. Under ${SMALL_SAMPLE} booked calls is a small sample (greyed). A dash means no ad spend or nothing to divide by.`,
  },
  {
    term: CARD_HELP.paid,
    meaning:
      "By channel: spend and clicks are the spine's ad rows (§9; Google from Google Analytics' Google Ads link, Meta from Metricool). Sign-ups: Google = site leads from a Google ad link; Meta = webinar registrations and lead-form contacts from Meta ad links. Booked and won are the flow card's calls (§16): Google = the Google Ads band; Meta = the Webinar and Meta Ads bands together, because Meta buys the webinar registrations (webinar calls also include registrants who came without an ad, about 1 in 7 in Sep-Oct 2026). By campaign: Google rows are the Google Ads page's (site leads with a Google click id that arrived in the window, and whether they booked or won), so they need not add up to the channel row. Meta stores spend and clicks per campaign but its registrations only per webinar week, so sign-ups, booked and won are not split by Meta campaign.",
  },
  {
    term: CARD_HELP.bookings,
    meaning:
      "Close first calls in the window, SteelTrap rule (§5), by channel as the flow card credits them. Plan: the booking plan's channels against its target for these days (§11), cancellations included as the plan counts them; the plan starts September 2026. Setter: as Close records it (§12).",
  },
  {
    term: CARD_HELP.cost,
    meaning:
      "Ad spend over channel bookings, by complete month (§9). The running month is shown as so far, never as the trend, and refreshes every 15 minutes.",
  },
  {
    term: CARD_HELP.trend,
    meaning:
      "Site leads by the day they arrived (§4); Close first calls by the day they are dated (§5). A window shorter than 14 days is drawn over 14 days so the bars have a shape.",
  },
  { term: "Lead", meaning: LEAD_DEFINITION.body },
  {
    term: "Registrations & contacts",
    meaning:
      "People who signed up somewhere other than a form on our site: webinar registrations, off-site GHL forms (Instagram lead magnets, VSL) and ManyChat contacts. They are not counted as leads.",
  },
  {
    term: "Site form fills vs total captured",
    meaning:
      "Site form fills are leads (above). Total captured is site form fills plus registrations & contacts: everyone we acquired. The two differ by more than 10x (week of Sep 14: 109 site form fills, 1,308 total captured), so ask which one is meant before quoting a number of leads.",
  },
  {
    term: "Booked call",
    meaning:
      "A person who booked a first sales call. One person counts once, however many times they reschedule. The sales team's spreadsheet counts every meeting instead, so its totals run about 1.7x ours; both are right, they count different things. On Channels, booked counts only calls a marketing channel can be credited for, roughly half the company total, because the sales team's own rebooking (Reactivation Scrapers) has no channel.",
  },
  {
    term: "Skipped form (direct booking)",
    meaning:
      "Booked straight from a calendar link (Instagram bio, a DM, an email) without filling in a form on the site first. Counted as booked, never as a lead, and shown beside the count rather than folded into Book %. Calls booked from the webinar room's own button are not skipped-form: those people already registered, so they count in Book %.",
  },
  {
    term: "Showed",
    meaning:
      "The rep marked First Call Show Up = Yes in Close. A call nobody marked is not counted as a show.",
  },
  {
    term: "Qualified",
    meaning:
      "Means two things depending on the tab. On the Sales and Executive tabs, the rep marked the person Qualified = Yes in Close after the call. On Overview, Lead quality and YouTube, the lead finished the qualifying questions on our site. A rep can mark Qualified without ticking the show, so qualified is not always a subset of showed and Qual % is out of booked, never out of showed.",
  },
  {
    term: "Closed-won (CW) and revenue",
    meaning:
      "The person's Close opportunity is marked won, and revenue is that deal's value in Close. On Month over month a sale counts in the month the call was booked. On Close view and Channels it counts in the month the deal was won, which is a different group of people from that month's booked calls, not a subset of them.",
  },
  {
    term: "First engaged",
    meaning:
      "On Closed-won, the earliest of: the Close lead being created, any Close activity dated before that (imported leads), the first site form, the first chatbot chat, or the first Calendly booking (by when it was booked). Webinar registrations are not stored per person, so a webinar buyer's first engagement is when GHL created their Close lead.",
  },
  {
    term: "Days to close",
    meaning:
      "On Closed-won, whole days from first engaged to the day Close marked the deal won. Median and p75 are across the source's won deals in the range.",
  },
  {
    term: "Show %, Qual %, CW %",
    meaning:
      "On Month over month and Close view, each is out of everyone who booked, never out of the step before it, so Show % is a minimum while logging is incomplete. On Executive and Funnels by month, Show % is out of calls with a show or no-show logged, so calls nobody logged are left out.",
  },
  {
    term: "Lead % (Opt-in %, Visit→lead) and Book %",
    meaning:
      "Lead % is leads out of site visits. Executive and Funnels by month call it Opt-in %, and YouTube calls it Visit→lead: the same rate under three names. On Channels, Book % is calls booked out of leads plus registrations & contacts. On Executive and Funnels by month, it is out of site leads only.",
  },
  {
    term: "Still filling in",
    meaning: `Sales keep arriving for about ${MATURE_AFTER_DAYS} days after a month ends, so the newest months read low until then.`,
  },
  {
    term: "— (a dash)",
    meaning:
      "Nothing to count: we have no data for it, or too few calls to work out a rate. A 0 is a real zero.",
  },
  {
    term: "Cost per booked call (Google Ads)",
    meaning:
      "Google Ads spend divided by the people who came from a Google ad click (one per click id) and later booked a first sales call. Booked calls count on the day the lead came in, so the latest days keep filling in for a week or two. The frozen baseline is $149 (Sep 10 to Oct 9, 2026).",
  },
  {
    term: "(pre-tracking) keyword",
    meaning:
      "A Google lead whose keyword cannot be recovered: it came in before keywords were added to ad links (Oct 10, 2026) and its click is not in the Google Ads click report either. Never guessed.",
  },
  {
    term: "Search terms with spend and no lead",
    meaning:
      "What people actually typed, where the clicks cost at least $25 in the range and never produced a site form, a Google lead form or a Close upload (qualified, booked, won) on any day the Google Ads script has synced (from July 2026). Candidates for negative keywords, not proof of waste.",
  },
  {
    term: "Campaign health",
    meaning:
      "Google's own status for each campaign and its live ads, read by the daily Google Ads script: not serving, ads disapproved or in review, limited by budget.",
  },
];

export function AnalyticsGlossary() {
  return (
    <details id={DEFINITIONS_ID} className="group mt-2 scroll-mt-4">
      <summary className="text-ui-accent cursor-pointer text-xs font-medium underline-offset-2 hover:underline">
        What the numbers mean
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
        {GLOSSARY.map((entry) => (
          <div
            key={entry.term}
            id={glossaryAnchor(entry.term)}
            className="scroll-mt-4"
          >
            <dt className="text-ui-text font-semibold">{entry.term}</dt>
            <dd className="text-ui-text-muted mt-0.5 leading-5">
              {entry.meaning}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
