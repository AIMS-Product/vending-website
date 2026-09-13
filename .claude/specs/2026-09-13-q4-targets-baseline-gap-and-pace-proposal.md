# Q4 channel targets: what the sheet asks, what we can measure, the gap, and the pace surface

Written 2026-09-13 from `~/Desktop/Q4 Channel Goals.xlsx` (6 sheets) against live
production tables. Every number below is either quoted from the workbook or
pulled from the database today; the source is named on each.

## 0. The workbook holds four target sets on two different bases

| Sheet                     | Target                                                                                                                           | Basis                                                            | Aug number for the same channel (Lane 2) |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| Channel KPI Plan          | 800 booked calls / month (Lane 2 330, Webinar 103, YouTube 85, Instagram 121, Mkt Reactivation 44, Website 117, Newsletter none) | Databricks first booked call per lead, by Close funnel           | 291                                      |
| Q4 Growth Plan            | +10% MoM from an August base of 821: Sep 903, Oct 993, Nov 1093, Dec 1202 (Q4 3,288)                                             | "August actuals from Close CRM", all booked calls by lead source | 357                                      |
| September Structure       | +15% over Jun-Aug avg = 691 / month                                                                                              | Same Databricks first-call basis                                 | 302                                      |
| Booked Call Summary col F | "Existing Monthly Target" 833                                                                                                    | older, unstated                                                  | 433                                      |

Slack (Jess, Sep 12): **Channel KPI Plan is the focus; Funnel Improvement Map is
the plan.** So the canonical target is the 800 plan on the Databricks
first-booked-call basis. The Growth Plan's Aug base (821) is a different
population (all booked calls, incl. rebookings) and is 57% higher than the same
month on the first-call basis (523). The same October target is a +21% lift on
one basis and a +90% lift on the other. Do not mix them on one page.

## 1. Every target, restated

Basis codes: **FC** = Databricks first booked call per lead by Close funnel
(cancellations included, follow-ups excluded). **CAC** = Close all booked calls
by lead source. **Cohort** = our spine (`channel_daily`), credited to the day the
lead arrived. **BD** = Calendly bookings by booked date.

### Channel KPI Plan (canonical, 800 / month)

| Channel                                                              | Target / mo    | Weekly (x3/13) | Measures                                                                   | Basis             | Measurable today?                                                                                                                                                                                   |
| -------------------------------------------------------------------- | -------------- | -------------- | -------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lane 2                                                               | 330            | 76.2           | first booked calls from Reactivation Scrapers + Sales Reactivation funnels | FC                | **No.** Lane 2 is not a channel in the spine. Closest proxy: Calendly BD bookings credited to a setter by the credit rule. Not the same population.                                                 |
| Webinar                                                              | 103            | 23.8           | first booked calls, Internal Webinar funnel                                | FC                | Partly. Spine has Webinar booked (cohort) and Calendly BD with `internal-webinar` tag. Neither is FC.                                                                                               |
| YouTube                                                              | 85             | 19.6           | first booked calls, YouTube funnel                                         | FC                | Partly, same caveat.                                                                                                                                                                                |
| Instagram                                                            | 121            | 27.9           | first booked calls, Instagram + Anthony IG funnels                         | FC                | Partly, same caveat.                                                                                                                                                                                |
| Marketing Reactivation                                               | 44 (2/workday) | 10.2           | first booked calls, Reactivation Email funnel                              | FC                | **No.** 2 bookings in the whole quarter; no send/touch denominator anywhere we read.                                                                                                                |
| Newsletter                                                           | none yet       | -              | booked calls from a newsletter CTA                                         | FC + UTM          | **No.** No newsletter connector; 2 tagged bookings ever. Sheet itself says unforecasted.                                                                                                            |
| Website                                                              | 117            | 27.0           | first booked calls, Website funnel                                         | FC                | Partly, same caveat.                                                                                                                                                                                |
| Show goal (Lane 2 60%, Webinar 60%, others hold 61-78%)              | rate           | -              | showed / all booked incl. cancels                                          | FC                | **No in our data.** Only 33% of our booked leads carry any Close outcome (Aug: 111 of 338). Databricks has outcomes on 95% (1,706 of 1,803). The rate is measurable in Close, not in our dashboard. |
| Close goal 15% floor (Website 25%)                                   | rate           | -              | won / showed                                                               | FC                | **No.** Same outcome gap, plus won counts are tiny (Aug 26 across all channels).                                                                                                                    |
| Upstream: Webinar 3,864 registrations / mo (892/wk)                  | count          | -              | GHL registrations                                                          | GHL forms         | Yes. `webinar_events.registrations` and `ghl_form` leads in the spine.                                                                                                                              |
| Upstream: 25% attendance, 65% offer retention                        | rates          | -              | attendees / registrations; at offer / attendees                            | webinar workbook  | Yes. `webinar_events` has registrations, attendees, attendees_at_offer per event (Jun-Aug: 7,841 reg, 1,516 att = 19.3%; 825 at offer matches the sheet exactly).                                   |
| Upstream: YouTube 131 new leads / mo                                 | count          | -              | new Close leads, YouTube funnel                                            | Close             | Partly. Spine YouTube leads (cohort): Jul 32, Aug 146.                                                                                                                                              |
| Upstream: Instagram 162 new leads / mo, 12 posts / wk (30/40/30 mix) | count          | -              | Close leads; Metricool posts                                               | Close / Metricool | Leads partly. Posts yes: `metricool_posts` Aug 126 IG posts (brand 6633336 = 104, 6633345 = 22). Content-intent tags: **No.**                                                                       |
| Upstream: Website 130 new leads / mo                                 | count          | -              | new Close leads, Website funnel                                            | Close             | Partly (spine Website leads Aug 151, cohort).                                                                                                                                                       |
| Lane 2 operating: 15 team bookings / workday, ~4 reps at 3.75        | count          | -              | bookings per active rep per day                                            | Close / dialer    | **No.** No roster or workday model; no dialer feed.                                                                                                                                                 |

### Funnel Improvement Map extras (the plan, not targets)

| Item                                                          | Measurable today?                                                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube views -> CTA clicks -> leads -> booked                | **No.** `youtube_video_daily` is empty (OAuth not connected, connector skips). `bitly_link_clicks` is empty (connector writes 0 rows). |
| Instagram fills by magnet and originating post                | Fills partly (GHL lead-magnet form leads). Originating post: **No.**                                                                   |
| Website qualified sessions -> form -> booking by landing page | Sessions yes (GA4: Jun 12,476, Jul 13,885, Aug 12,133). Session-to-booking join: **No.**                                               |
| Marketing Reactivation eligible audience, sends, replies      | **No.** GHL email stats exist (`Webinar_ADNB_Email` 8,211 sent) but are lifetime snapshots per workflow, not joined to bookings.       |
| Newsletter audience, delivered, CTA clicks                    | **No.** No connector.                                                                                                                  |

### Q4 Growth Plan (CAC basis, secondary)

Priority channels Oct / Nov / Dec: Lane 2 432 / 475 / 523, Webinar 161 / 180 /
201, YouTube 124 / 139 / 155, Instagram 101 / 112 / 125, Website 90 / 102 / 113.
Ten reference sources held flat at 85 / month combined. Total 993 / 1,093 /
1,202. Measurable: same answer as the 800 plan. **Its August base cannot be
reproduced from any table we hold** (Close all-calls by source is not mirrored).

### September Structure revenue block

Coaching forecast = 691 x $6,900 AOV x 11% close = $524K; plus Routes $175K, MSA
$20K, VendEquipment $12.5K, BTC $3.8K = $736K. Basis: cash (deals won in month).
Measurable today: **No.** `lead_submissions.closed_won_value` does not exist in
production (migration `20260912120000` not applied), so spine revenue is null
everywhere. The $296K cohort / $503K cash figures in the handoff came from a
Close read, not from the dashboard. Neither basis is on any page today.

## 2. Q3 actuals per channel, each basis side by side

Booked calls. Databricks FC is copied from the workbook's Verification sheet;
Cohort and BD are pulled from production today.

| Channel           | FC Jun | FC Jul | FC Aug | Cohort Jul   | Cohort Aug   | Cohort Sep 1-13 | BD Jul                        | BD Aug    | BD Sep 1-13 |
| ----------------- | ------ | ------ | ------ | ------------ | ------------ | --------------- | ----------------------------- | --------- | ----------- |
| Lane 2            | 221    | 276    | 291    | not in spine | not in spine | not in spine    | see setter tiers              |           |             |
| Webinar           | 97     | 76     | 72     | 60           | 86           | 142             | 24 tagged                     | 33 tagged | 81 tagged   |
| YouTube           | 67     | 72     | 64     | 43           | 106          | 34              | 26                            | 42        | 17          |
| Instagram         | 111    | 126    | 51     | 58           | 58           | 32              | 54                            | 48        | 35          |
| Website           | 106    | 126    | 45     | 17           | 83           | 29              | untagged pile                 |           |             |
| Google Ads        | -      | -      | -      | 7            | 77           | 25              | 0                             | 6         | 12          |
| Meta Ads          | -      | -      | -      | 20           | 25           | 0               | 14                            | 10        | 0           |
| Chatbot           | -      | -      | -      | 0            | 10           | 20              | 0                             | 4         | 18          |
| Mkt Re-engagement | 1      | 1      | 0      | -            | -            | -               | -                             | -         | -           |
| Total             | 603    | 677    | 523    | 278          | 486          | 301             | 434 all / 242 first-call type | 847 / 337 | 560 / 260   |

Why they differ: the spine and Calendly feed start in July (June has 1 Calendly
row and no lead rows). The spine only sees leads that touched our site or a
tagged link (991 leads since July vs 1,803 booked Close leads Jun-Aug). Lane 2
never touches the site. Calendly BD includes next-steps, onboarding and
reschedules (Aug: 510 of 847).

Calendly credit tiers by booked month (booked status): Jul 434 = 37 rep-recorded
/ 189 tagged / 208 untagged. Aug 847 = 42 / 172 / 633. Sep 1-13 560 = 167 / 172 / 221. September is the first month where "Calendly recorded who booked" is the
largest tier.

Outcome logging on our booked leads: Jul 13 of 61, Aug 111 of 338, Sep 66 of
167 have any Close outcome. Show rate on our side is an upper bound until this
closes; Databricks has 95% coverage.

Webinar Q3 from `webinar_events` (matches the sheet): 8 events, 7,841
registrations, 1,516 attendees (19.3%), 825 at offer (60% of 7 measured),
spend $91.8K Meta. Sep 1 + Sep 8: 1,854 reg, 324 att (17.5%).

## 3. Gap: weekly run-rate to hit Q4

Canonical (800 plan, FC basis). Baseline = Jun-Aug FC monthly average.

| Channel          | Jun-Aug avg / mo | Aug / mo | Target / mo | Target / wk | Lift vs avg | Lift vs Aug |
| ---------------- | ---------------- | -------- | ----------- | ----------- | ----------- | ----------- |
| Lane 2           | 262.7            | 291      | 330         | 76.2        | +26%        | +13%        |
| Webinar          | 81.7             | 72       | 103         | 23.8        | +26%        | +43%        |
| YouTube          | 67.7             | 64       | 85          | 19.6        | +26%        | +33%        |
| Instagram        | 96.0             | 51       | 121         | 27.9        | +26%        | +137%       |
| Mkt Reactivation | 0.7              | 0        | 44          | 10.2        | new         | new         |
| Website          | 92.3             | 45       | 117         | 27.0        | +27%        | +160%       |
| Total            | 601              | 523      | 800         | 184.6       | +33%        | +53%        |

Instagram and Website fell by half from July to August on the FC basis (126 to
51, 126 to 45). If August is the real run-rate, those two channels need to more
than double, not grow 26%. The sheet's "+15%" and "800" both assume the Jun-Aug
average holds. Worth asking whether August was a data gap (entry source
relabelling: Aug shows 81 "Website-Apply" and 185 "Rep-Outbound" that did not
exist in June) or a real drop.

Growth Plan (CAC basis) weekly run-rates, for reference: total Aug 189.6/wk ->
Oct 229 -> Nov 252 -> Dec 278 (Dec is +46% over Aug). Lane 2 82 -> 100 -> 110 -> 121. Webinar 30 -> 37 -> 42 -> 46. YouTube 23 -> 29 -> 32 -> 36. Instagram 18 ->
23 -> 26 -> 29. Website 17 -> 21 -> 24 -> 26.

## 4. Proposal: target vs pace vs actual (not built)

One new admin page `/admin/goals`, built from the Overview/KPI parts.

- **Targets as a checked-in constant** `src/lib/services/channel-targets.ts`:
  `{ channel, month, metric: "booked", target, basis: "first-call" }` for Oct,
  Nov, Dec from the 800 plan (flat 800 each month unless the CEO says ramp).
  No table, no migration; the sheet changes rarely and a diff in git is the
  audit trail. Promote to a table when someone other than us edits targets.
- **Pace math, pure module** `pace-report.ts` with one test: expected-to-date =
  target x (days elapsed / days in month); variance = actual - expected in calls
  and %; projected month-end = actual / share elapsed; weekly target = target x
  3 / 13 against last 7 days actual; status ahead / on pace / behind at +-5%.
  Lane 2 and Reactivation use workdays (Mon-Fri) for elapsed share, matching
  the sheet's "2 per workday". Everything else uses calendar days.
- **Actuals on the booked-date basis through the one credit rule.** A target for
  October is about calls booked in October. Read `calendly_bookings` (status
  booked, first-call event types only) and resolve each through
  `resolveCallCredit`: rep credit -> Lane 2; channel credit -> the channel;
  untagged -> its own "Untagged" row, shown and never allocated. This is the
  same function `/admin/bookings` and KPI Lane 2 use, so no two pages disagree.
  Label every row "Calendly booked date, not Close first-call" until a Close
  or Databricks feed lands; then swap the reader, not the page.
- **Layout:** month picker (Oct / Nov / Dec / Q4), headline row (Combined:
  target, expected by today, actual, ahead/behind, projected), then one row per
  channel with `ChannelLogo`, columns: Target | By today | Actual | Ahead or
  behind (calls and %) | Weekly target | Last 7 days | Projected | Certainty.
  Certainty for Lane 2 is the recorded / tagged / inferred split. A channel with
  a target and no reader (Newsletter, Marketing Reactivation) prints the target
  and a dash with "not measured yet". Reuse `OverviewMetric`, `Delta`,
  `ChannelLeaderboard` row styling. Light theme, no emojis.
- **Not on this page until the data exists:** show rate, close rate, revenue,
  attendance. Each gets a "needs X" line in a Needs Attention block instead of
  a number.
- Verification: tsc, vitest (`./node_modules/.bin/vitest run`), next build,
  eslint, prettier, real output pasted.

## 5. Later slices (after 4 is approved)

Team views (setters, closers, webinars, socials, ads) reading the same credit
rule and the same pace module. Then the two data fixes that turn upper bounds
into measurements: Close/Databricks first-call feed (Lane 2, outcomes, cash
revenue) and the GHL form -> channel mapping (801 unattributed leads).

## 6. Connections and data missing today (verified against connector runs)

- Close-wide lead feed (not just our 991 site leads): needed for Lane 2, FC
  basis, outcomes, cash revenue. Either Close API in-app or Databricks
  `steeltrap_staging.silver_core.crm_event_ledger_by_company` (Dom's ledger).
- `closed_won_value` migration not applied in production -> revenue null.
- YouTube OAuth not connected -> `youtube_video_daily` empty, views unmeasurable.
- Bitly connector writes 0 rows -> CTA clicks unmeasurable.
- No Google Ads or Meta Ads spend feed; only webinar Meta spend via webinar_events.
- No newsletter platform connector; no reactivation send -> booking join.
- Calendly history starts July 2026; June needs a backfill via the API.
- 9 Calendly user ids unnamed (token in Vercel only).
- ChannelLogo has no mark for GHL, Calendly, Close, ManyChat, Kit, Side Hustle
  Nation, LTF, Webinar.
- GA4 connector: 7 rows failing to write on every run.

## 7. Approved and built (2026-09-13, Adam: "yes")

Adam's answers that changed the plan: Channel KPI Plan (800 a month, no ramp,
"aim to crush it") is the target; read SteelTrap where useful but the app
reads Close directly for the daily number because SteelTrap gold lagged eleven
days on 2026-09-13; ads spend and YouTube views come from Metricool (ads via
the `subject=account` timeline parameter, verified live); GHL form names come
from the GHL forms API (19 forms listed); Kit is the newsletter tool
(ActiveCampaign next); backfill Calendly from June matching by email exactly
as the webhook does; logos are the most important piece.

Shipped in this session:

- `public/admin/brands/*.svg` and `ChannelLogo` renders real vendor artwork;
  neutral glyphs for owned surfaces and Lane 2. Still missing files: ManyChat,
  HighLevel mark (only the wordmark is published), Side Hustle Nation.
- `close_lead_funnel` mirror: migration, hourly sync at
  `/api/admin/close-lead-funnel-sync/run`, field ids resolved from Close's
  schema by label. Reproduced the workbook's Databricks counts from SteelTrap
  (Jun: Lane 2 221, Instagram 111, Website 106, Webinar 97, YouTube 67) so the
  first sync can be checked against them.
- `/admin/goals`: target vs expected-by-today vs booked, ahead or behind in
  calls and percent, weekly target vs last 7 days, need per week, projected,
  outcome-logged share. Targets in `channel-targets.ts`; pace in
  `goal-pace.ts`. Viewer role may read it.

Not yet done, in order: apply both migrations in production and run the sync
once, then check Jun to Aug totals against SteelTrap; Metricool ads spend and
YouTube views into the spine; GHL form to channel mapping; Calendly June
backfill; Kit connector; team views.
