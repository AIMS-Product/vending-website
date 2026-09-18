# Trust the numbers — handoff (2026-09-18, evening)

Repo `~/vending-website` · branch `main` @ `4530d98` · prod live (Vercel team
`aimanagingservices`, project `vending-website`). Paste this whole file into a
fresh session. Read `.claude/specs/2026-09-18-tracking-estate-wiring-handoff.md`
section 0 (instrument boundary) first.

**Goal of the next session: every number on /admin/analytics that goes to the
CEO is either verified against its source system or visibly marked as not
tracked. No silent zeros.** Adam's words: "WE NEED TO TRUST OUR NUMBERS."

---

## Shipped today (live, verified)

- **One lead definition** (`src/lib/analytics/lead-definition.ts`,
  `collapseToLeads`): one person (email) per rolling 30 days, name + email on a
  site form or chatbot, no newsletter, no test/internal. Every tab, the channel
  spine read (`fetchFacts` in `channel-report.ts`) and the reporting API count
  through it. Prod August: Overview = Channels = Funnels = **510**. Webinar
  registrations / GHL off-site forms / ManyChat now show as **Registrations &
  contacts** (August 3,649), never as leads. Guard test:
  `src/lib/services/lead-count-agreement.test.ts`.
- Definition strip under the Analytics tabs.
- Overview + YouTube lead reads page past PostgREST's **silent 1,000-row cap**
  (prod has 1,094 lead rows; newest were being dropped).
- Funnels: Won/Revenue no longer require a logged booking; unobserved visits
  render a dash, not 0.
- Header row pinned to the window on Funnels, Executive, Channels, KPI tables
  (`FreezeTableHead.tsx`, verified in headless Chromium).
- Nightly `syncLeads` now writes people and zeroes the keys it rewrites; the
  first run after deploy (tonight's cron, 120-day window) rewrites spine
  booked/won per person. Check `channel_sync_runs` for `leads` tomorrow.

## 1. FIRST: webinar closed deals read 0 — Adam says that is false. He is right.

**Hypothesis (verify before touching code):** webinar registrants never become
`lead_submissions` rows (they register on GHL), so every lead-based surface
(Funnels, Executive, Journeys, Overview, YouTube) has nowhere to hang their
Close won deal. Their calls come in as Calendly bookings with no lead row
("orphan" bookings, counted as booked only), and `syncLeads` never writes `won`
for an orphan booking. Webinar `won` on Channels comes only from the
vp-webinars sheet push (`webinar-ingest.ts`, `won: a.won`) — check whether the
sheet even fills it.

**Verify with real data, in this order:**

1. Close: count won opportunities in Jul/Aug/Sep whose lead has Webinar
   attribution (Close MCP `find_opportunities` status won + lead custom
   fields / UTM; the Close UTM backfill stamps `internal-webinar`).
   `close_lead_funnel` (our mirror, `close-lead-funnel-sync.ts`) may already
   hold status_label + source: query it first.
2. `webinar_events` (per webinar: registrations, booked, showed, won?) —
   does the sheet carry wins?
3. `channel_daily` where channel = 'Webinar': sum `won`, `revenue` by month.
4. Compare. Report the three numbers side by side to Adam before any fix.

**Likely fix shape:** outcomes (booked / showed / won / revenue) for people
with no site lead row come from Close by the Close lead's attribution, not
from `lead_submissions`. The Funnel map already reads the Close cohort
(`funnel-cohort.ts`, `close_lead_funnel`); the Executive rollup needs a
"Close-attributed wins" line per channel so Webinar shows its real deals.
Never add them to Leads (not site leads); show them as won/revenue under
the Webinar channel with the source named.

## 1b. Reconcile with the SteelTrap weekly report (Close-based)

Adam compared our dashboard with SteelTrap's "Week ending Sept 17" report
(Sep 11–17: 162 booked, 97 showed, 62 qualified, 14 won, $87,134). The two are
different questions, not a bug:

- **Population:** SteelTrap = every first call in Close. 77 Reactivation
  Scrapers + 37 Internal Webinar = 114 of 162 are people who never submit a
  site form, so they are never our leads. ~48 are comparable.
- **Dating:** SteelTrap buckets by the week each event happened (booked in
  week, closed in week; avg 29.9 days to close). We credit outcomes to the
  lead's cohort month.
- **Qualified:** SteelTrap = rep disposition after the call. Ours "Qs done" =
  finished the online questions. Different stage.
- **Source labels:** SteelTrap = Close lead source field. Ours = site UTMs via
  `resolveChannel`.

**Build:** a "Close view" (Executive tab section or its own tab) that uses
SteelTrap's rules: all Close first calls by booked week, showed / qualified /
won / revenue by event week, grouped by the Close lead source field. Source:
`close_lead_funnel` (+ Close API for opportunity won date/value). Acceptance:
Sep 11–17 ties to 162 / 97 / 62 / 14 / $87,134 per source row, or every gap is
named. This view also answers item 1 (webinar wins) for free. Keep the site
funnel as is; label each view with the question it answers.

## 2. Channels + KPI "Visits" overstated ~43% (August 17,397 vs GA4 12,133)

`channel_daily.visits` kept GA4's provisional dimension keys (same fault
already repaired on `ga4_page_views` by `scripts/ga4-repair-superseded.mjs`).
The code fix is live but self-heals only a 3-day window. Needs a
**day-by-day** repair from 2026-02 to today: for each day, pull the GA4
channel-session report for that single day (a wider report folds rows into
`(other)`), null `visits` on keys GA4 no longer reports, rewrite the rest.
Dry run first, then apply; verify August sums to GA4's own total within ~2%.
Funnels/Executive read `ga4_page_views` and are already correct.

## 3. Show rate — needs Adam's decision

Funnels counts a show only when a rep logged `first_call_show_up = yes` in
Close; Channels/KPI/spine count booked minus no-show/canceled, so an
unlogged call counts as shown (upper bound). Recommendation: Close-logged only
everywhere, with "not logged" shown as its own count. Ask once, then unify.

## 4. Smaller, known

- Migration `20260912110000_channel_daily_thankyou_visits.sql` still needs
  Adam's DB password (Supabase CLI not linked).
- Registration/contact key collision: if a ManyChat or GHL route key equals a
  site lead's key on the same day, `fetchFacts` shows the site count and drops
  the contact count. Did not happen in August (reconciled exactly). Permanent
  fix = connectors write their own stored `contacts` column (migration).
- Team report Meta cost-per-lead now excludes GHL form fills (site leads
  only) — relabel or confirm with Adam.
- `mikehoffmann` Vercel project builds on every push to this repo and errors;
  ask Adam whether to disconnect it.
- Vercel builds hung in "Initializing" twice today (13:23, 14:24) with zero
  build events; cancel + `vercel redeploy <url> --target production --scope
aimanagingservices` cleared it. Status page showed no incident.

## How to verify against prod (read-only)

A temporary vitest config pointed at `.env.local` runs the real services:
create `.tmp-verify/vitest.verify.config.ts` (alias `@` → src, `server-only`
→ `vitest.server-only-shim.ts`, `env` = parsed `.env.local`, include
`.tmp-verify/*.test.ts`), call `getAdminAnalytics` / `getChannelsTab` /
`getFunnelMonthly` / `getKpiTab` with `range: "custom:2026-08-01:2026-08-31"`,
write JSON to /tmp, delete the dir after. vitest swallows console.log; write
to a file.

## Sources of truth (for the CEO note)

Visits: GA4 · Leads: our DB (`lead_submissions`) · Booked / Showed / Won /
Revenue: Close · Spend: Metricool · Webinar registrations: vp-webinars push ·
GHL forms/email: GHL API · Instagram DM: ManyChat · SteelTrap: not used.
