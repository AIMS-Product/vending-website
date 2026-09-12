# Handoff 5: unified channel reporting, after the accuracy audit

Written 2026-09-11 evening, commits 770be30..e057b68 on `main`.
Read handoff-4 first for context. Conventions unchanged: `./node_modules/.bin/*`
(never `pnpm exec`), one slice per commit, suite green, null means not observed,
keys in `.env.local` and Vercel only, never ask for a key in chat, never infer
`utm_term`.

## Shipped this session

1. **Google Ads campaign key mismatch** (770be30). GA4 gets the campaign NAME
   from auto-tagging; the link carries `utm_campaign=<numeric id>`. Over 30
   days that put 5,444 visits under names with 0 leads and 128 leads under ids
   with 51 visits; only 9 rows carried both. `ga4/client` now fetches
   `sessionCampaignId`, and `channel-sync` keys paid google rows on the id.
   Merge keys also switched from `|` to NUL, because Ads campaign names carry
   pipes ("VP | W2 | Consideration").
2. **Thank-you visits** (bc3cf3e). New GA4 report filtered to our own
   confirmation pages, written as `channel_daily.thankyou_visits`. The regex
   `^(/(thank-you|your-call-is-booked|booked).*|/.*-thank-you)$` was verified
   against live GA4: it matches exactly `/your-call-is-booked` (52),
   `/thank-you-for-applying` (49), `/resources/roadmap-thank-you` (8),
   `/resources/finance-templates-thank-you` (1) over 30 days, nothing else.
   The spec's guessed `/thank-you*` and `/booked*` paths do not exist.
3. **Revenue per lead** (3d46959). `lead_submissions.closed_won_value` in
   DOLLARS; Close returns `value` in CENTS (verified: $5,997 -> 599700).
   Summed across a lead's won opportunities, written by the leads connector as
   spine revenue on the lead's cohort day.
4. **Opt-in was inflated 2-7x on every channel** (7854c3e, e057b68). Not in the
   original plan; found by auditing. See below -- this was the single biggest
   reason the tab could not be trusted.

## The opt-in bug, because it will come up again

A spine row carries `leads` only when a lead was submitted on that link that
day. `pairedPct` averaged over rows where BOTH sides were observed, which
silently dropped every visit-day that converted nobody, so the rate averaged
over converting days only. Measured in prod:

| channel    | was   | is now | true (leads/visits) |
| ---------- | ----- | ------ | ------------------- |
| YouTube    | 35.3% | 10.5%  | 11.7%               |
| LinkedIn   | 77.8% | 17.9%  | 17.5%               |
| Instagram  | 39.2% | 19%    | 23.9%               |
| Website    | 7.1%  | 5.6%   | 5.7%                |
| Trustpilot | 100%  | dash   | 14.3%               |

`ofVisitsPct` sums the numerator over every visit-observed row, counting a
missing lead row as the zero leads it was. Scoped ONLY to rates whose
denominator is visits. Everything below the lead stays strictly paired, and
must: a standalone Calendly booking has no lead and an unknown show status, so
counting either as zero would be the same mistake inverted. Confirmation that
the scoping is right: lead -> book did not move at all (YouTube 72.1%,
Website 63.3%, Instagram 81%).

## Two more fixes, found by asking "what is wrong RIGHT NOW"

5. **The opt-in fix briefly made Google Ads worse** (5239f4b). Turning the
   paired rate into a visits-based one changed Google Ads from an honest dash
   to a confident **0.2%** against a true 2.3% -- because until the backfill
   runs, only 12 of its 128 leads (9%) share a row with any visit. A tenfold
   error that reads like a measurement is worse than a dash. `ofVisitsPct` now
   returns null when the visit rows cover under half of what the channel
   counted: the signature of a key mismatch rather than a measurement. Healthy
   channels are nowhere near the bar (Website 99%, YouTube 91%, LinkedIn 88%,
   Instagram 81%), and it clears itself after the backfill.
6. **The Reach column was part reach, part impressions** (95d78d6).
   `reach ?? impressions` summed reach from the rows that had it and
   impressions from the rows that did not, under one label. And summing reach
   across posts counts the same follower once per post they saw -- 44 Instagram
   posts summed to 1,242,166. Now impressions only, labelled Impressions, the
   same additive-metrics rule that keeps bounce rate out of the GA4 client.
   The Channels tab was already correct; only the KPI tab mixed them.

## Verified against live APIs, not assumed

- Both GA4 report shapes were run exactly as the code builds them:
  the 7-dimension channel report returns 200 (1,634 rows; sum 11,455 vs GA4
  TOTAL 11,253, the expected "(other)" fold, which is why verifyTotals is off)
  and the thank-you report returns 200 with 93 rows / 109 sessions, its sum
  matching GA4's TOTAL exactly. Neither had ever been executed before.
- Close opportunity `value` is in cents, checked against live opportunities.
- The GHL webinar-form exclusion catches all four registration forms, checked
  against the live form list.

## Adam does, before any of this reads correctly

1. **Run the migration.** One `do $$` block covering all three, in the Supabase
   SQL editor. It is in `supabase/migrations/2026091210*.sql`, or ask for the
   combined block. It deletes ~1,486 name-keyed Google Ads visit rows (or the
   backfill leaves both and Google Ads counts its visits twice), adds
   `channel_daily.thankyou_visits`, adds `lead_submissions.closed_won_value`.
2. **Backfill:** `GET /api/admin/channel-sync/run?days=400` with `CRON_SECRET`.
   Google Ads visits re-key onto the campaign id and thank-you visits populate.
3. Revenue fills itself: the Close reconciler runs every 2 minutes at 60 leads
   a pass, so ~32 minutes for all 943 leads that carry a `close_lead_id`.
4. Still owed from handoff-4 and unchanged: `REPORTING_API_KEY`,
   `BITLY_ACCESS_TOKEN` + `BITLY_GROUP_GUID`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`
   for YouTube Analytics, retagging live links with `utm_term`, Mike's ManyChat
   External Request actions.

## Expected numbers after the backfill (measured, not guessed)

- Google Ads 30d: ~5,495 visits, 128 leads, opt-in ~2.3% (was a dash).
- Revenue, 30d, cohort basis: **$296,263 across 32 won leads** --
  Website/Chatbot $136,770 (13), YouTube $106,564 (12), Google Ads $30,588 (4),
  Instagram $11,994 (2), Newsletter $10,347 (1).
- Thank-you visits 30d: ~110 total, spread thin across channels.

## The revenue trap, read this before comparing to Close

Close closed **$503,223 across 65 deals** in the same 30 days. The tab will say
~$296,263. Both are correct and they will never match:

- The tab is **cohort basis**: revenue from leads that ARRIVED in the window.
- Close is **cash basis**: deals WON in the window, whatever cohort they came
  from.
- Only 31 of those 65 wins (48%, $266,163) map to a website lead row at all.
  The rest came from leads the site never captured -- phone, referral, and
  cohorts older than lead capture.

Every recent window will therefore under-report and keep growing as the cohort
matures. Do not "fix" this by switching to won-date; it would break the whole
point of the cohort basis. If Adam wants a cash-basis number, it is a separate
column with its own stated basis.

## Open questions, ranked

1. **Show rate is a ceiling, not a measurement.** 218 of 348 booked leads in
   the cohort have no mapped Close outcome and are all counted as shown. The
   breakdown: 96 "Follow Up" + 25 "Long Term Follow Up" (a follow-up implies
   the call happened -- fair), 35 "Lost" (ambiguous), and **50 still sitting at
   "Call Booked" after their call date** (that is nobody updating Close, not
   evidence of a show). If those 50 never happened the true show rate is ~61%
   rather than 76.6%. Changing the rule also moves the YouTube tab, which uses
   the same derivation, so it needs Adam's call before anyone touches it.
2. **GHL forms is a blind alley, not a double count.** 811 leads, every other
   column a dash, because GHL form submissions are never matched to Close.
   Checked by email: only **12 people (1%)** appear in both GHL form fills and
   `lead_submissions`, so it is a genuinely separate audience. The question is
   whether those 811 should be matched into Close at all.
   Form breakdown 30d: 90 Day Checklist MH 551, PAID VP Internal Team 85,
   VSL 71, Financial Templates MH 45, Lead Scoring -> Book a Call 34,
   General VSL 28, 90 Day Checklist AK 18, Waitlist 12, Course Access 1.
   `Course Access Form` is existing customers, not leads. Is
   `PAID: VP Internal Team: 90 Days Lead Magnet Form` real outside traffic?
   The four webinar registration forms ARE correctly excluded -- verified
   against the live GHL form list, `/webinar/i` catches all four.
3. **Re-engagement still cannot be checked.** `ghl_email_stats` has exactly one
   snapshot day (2026-09-11, 63 workflows, 152,363 lifetime sends). The section
   needs two to difference cumulative counters, so all 63 workflows are hidden
   and the Channels tab Email row has no Seen or Clicked. The second snapshot
   lands with the 11:20 UTC cron on 2026-09-12; check it then. The code is
   already correct for it -- nothing to change, just verify.
4. **Junk channels.** "Shn", "Vsl", "Braze", "Wwws" each hold one booking from
   a garbage `utm_source`; "Unknown" holds 126 visits and 15 bookings. Cosmetic
   but it makes the tab look careless.
5. **Stored labels still lag** (handoff-4 item 4, unchanged). "Ghl Form" (770
   leads) and "GHL forms" (75) are two stored labels for one channel. Confirmed
   harmless: read-time normalisation merges them into the single 811 row. A
   `?days=400` ghl-sync run cleans it once that connector gains a `days`
   option. Low priority.
6. Show-rate inflation from future-dated calls is real but negligible: 13 of
   348 booked calls have not happened yet, moving show rate 76.6% -> 77.0%.
   Not worth code.
7. **X impressions are real but vanity.** 529 posts over 30 days reporting
   11,403,999 impressions, 47 clicks, 0 leads. That is what X's API says and it
   is honestly labelled, but X counts any timeline view, so it dwarfs every
   other number on the Channels tab while meaning the least. Worth a word to
   anyone senior reading the tab before they anchor on it.

## What is still NOT verified

- The migrations have not run. Everything downstream -- Google Ads opt-in,
  thank-you visits, revenue -- is currently a dash on the page, which is
  honest, but the numbers this spec projects for them are projections from
  source data, not readings off the tab.
- No full `?days=400` connector run has happened against prod with the new
  code. The GA4 queries are verified and the suite is green; the end-to-end
  backfill is not.

## Verified healthy

- 0 duplicate conflict keys in `channel_daily` over 30 days -- the 20260912
  re-key migration is holding.
- lead_submissions 539 real leads in 30d vs 520 on the spine across the same
  channels; the gap is the internal-lead filter and UTC day boundaries.
- The four webinar registration forms are correctly excluded from GHL form
  leads, so webinar registrants are not counted twice.
- `webinar_events` revenue zeros for Aug 25 and Sept 8 are real: both events
  have 0 won. Not a data gap.

## Verify before saying done

`./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run`,
`./node_modules/.bin/eslint src`, `npm run build`; then push, confirm on
`vercel ls --prod --scope aimanagingservices`, and read the live table with
browser-harness (`new_tab`, `wait_for_load`, `wait_for_element("table")`,
then `js(...)` over the table rows -- far more legible than a screenshot,
which is unreadable once downscaled enough to fit in context).

## Gotchas hit this session

- `.env.local` quotes values with single quotes; a naive `replace(/^"|"$/g,"")`
  leaves them and `JSON.parse` dies, dumping the GA4 private key into the
  error. Strip both quote styles.
- `rg` is mangled by the rtk hook; `/usr/bin/grep` for anything reasoned on.
  Unquoted globs in zsh die on `--include=*.ts`.
- The Supabase CLI on this machine is NOT logged into this project
  (`aacisvhkmsaabqdvdmmf` is absent from `supabase projects list`), and prod
  has no `DATABASE_URL`. Migrations are SQL-editor only, by hand.
- `vercel env pull` DOES return `CLOSE_API_KEY` for this project, which is how
  the cents question got settled. Do not paste it anywhere.
