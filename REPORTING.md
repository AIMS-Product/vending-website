# Reporting glossary

Every reporting number in this business answers exactly one question about exactly one population.
Most of our reporting failures have been the same mistake: a number that is correct for one
question read as the answer to another. This file exists so that never has to be re-derived.

**Rule:** before quoting a number, find it here. If it is not here, measure it, then add it.
Every entry names what it counts, where it comes from, and what it is NOT.

Last verified against live data: 2026-09-21.

---

## 1. The three systems, and what each is authoritative for

| System                   | Repo / location                                   | Authoritative for                                                                          | Not authoritative for                                                           |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Admin dashboard**      | `~/vending-website` → `vendingpreneurs.com/admin` | Channel and ad attribution: which source/medium/campaign produced which outcome            | Company totals. It only contains what can be attributed to a marketing channel. |
| **Webinar board**        | `~/vp-webinars`                                   | Everything about a webinar event: registrations, attendance, the room, per-setter outreach | Anything outside a webinar cohort                                               |
| **MTD funnel dashboard** | `AIMS-Product/mtd-funnel-dashboard` (Stephen)     | Total sales activity from Close: meetings booked, showed, qualified, closed-won            | Lead/acquisition volume — see §5                                                |

A fourth system, **GoHighLevel**, captures off-site form fills and lead magnets. We read it in
`~/vp-webinars` for webinar cohorts only. Nobody currently reports GHL form volume end to end.

---

## 2. Acquisition: Leads vs Contacts vs Form submissions

This is the single most misread area on the dashboard.

`applyLeadDefinition` (`src/lib/services/channel-report.ts`) splits one acquired population in two:

| Term               | Definition                                                                                | Typical weekly volume |
| ------------------ | ----------------------------------------------------------------------------------------- | --------------------- |
| **Lead**           | A form fill on vendingpreneurs.com itself                                                 | ~110                  |
| **Contact**        | Everyone else we acquired: webinar registration, off-site GHL form fill, ManyChat contact | ~1,200                |
| **Total captured** | leads + contacts                                                                          | ~1,300                |

**The Overview's "LEADS" tile shows leads only.** On 2026-09-21 it read 109 for a week in which we
actually captured 1,308 people. Nothing is missing from the database — the tile is narrower than
its label. Gated lead magnets ARE captured (e.g. `Instagram · mike-ig · lead-magnet`, 91 in
W11); they land in `contacts`.

> When someone asks "how many leads did we get", ask which they mean. Site form fills and total
> captured differ by more than 10×.

### Measured, week of 2026-09-14 → 09-20

| Number                             | Value            | Source                          |
| ---------------------------------- | ---------------- | ------------------------------- |
| Site form fills                    | 109              | `lead_submissions`              |
| Total captured                     | 1,308            | channel spine, leads + contacts |
| Close leads created                | 1,046            | Stephen's "Leads" column        |
| Kody's "New Form Submissions (VP)" | _unknown source_ | see §6                          |

---

## 3. Bookings

Three different tables count a booking, and they do not agree because they count different things.

| Measure              | Where                                                      | What it counts                               | W10 | W11 |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------- | --- | --- |
| **Close mirror**     | `close_lead_funnel.first_sales_call_booked_date`           | A lead's first sales call booking            | 167 | 163 |
| **Stephen's booked** | Close meeting activities, title-filtered, deduped per lead | Every qualifying meeting                     | 172 | 166 |
| **Channel spine**    | `channel_daily.booked`                                     | Bookings attributable to a marketing channel | 96  | 80  |

Weeks are Mon–Sun (Stephen's convention). **Always compare like windows** — comparing our 5-day
figure to his 7-day one manufactures a ~25 booking gap that does not exist.

- Our Close mirror tracks Stephen within ~3 (2%). Treat it as good.
- The channel spine is roughly **half** the company total, because the sales team's own rebooking
  activity (~80/week, funnel `Reactivation Scrapers`) has no marketing channel and is absent.
  The spine is not wrong; it answers "what did our channels buy", not "how many calls got booked".

### Marketing vs scrapers

`Reactivation Scrapers` is the outbound/reactivation funnel. It is excluded from marketing
reporting deliberately, so that ad spend is never divided by outcomes ads did not buy
(`close_events.py:257` in `~/vp-webinars`).

- **Marketing meetings booked** = total booked − Reactivation Scrapers.
- Verified W10: Stephen 172 − 83 = 89; ours independently = 89. Exact.

### Spine drift — root-caused, fixed and applied 2026-09-21

**Status: settled.** Fix `5b8fe6d`, applied by a manual `channel-sync` run at 13:20 PT
(the 4:10am cron had already run before the fix shipped). It cleared **32 of the 34
orphan rows and 88 of the 90 phantom bookings**, exactly what the simulation predicted.
The two it left are the two named at the end of this section; both are still stored and
still counted.

**Cause: orphaned booking rows the sync can never clear.**

`channel_daily.booked` has **three** writers, not two — `channel-confidence.ts:94` lists them
(`leads`, `webinar-ingest`, `manychat-ingest`). The `leads` connector (`channel-sync.ts`) writes
two of the four kinds:

1. site leads carrying `call_booked_at` — credited to the day the **lead arrived**;
2. Calendly bookings with no `lead_submission_id` — credited to the day the call was **booked**;
3. `webinar-ingest` — the in-room CTA bookings, written as `source = internal-webinar`;
4. `manychat-ingest` — `call_booked` events.

Measured 2026-09-21: of 1,851 stored bookings since Jun 1, **327 are `internal-webinar`**. Any
check that reconstructs expected bookings from `lead_submissions` + `calendly_bookings` alone is
short by that much and will report a false gap — it did, by 31 on W8, before this was found.

`syncLeads` zeroes stale rows before rewriting, but its clearing set is built only from keys that
**current site leads** map to (`channel-sync.ts:510-528`). Calendly-derived rows carry `leads=null`
and match no lead key, so they are never zeroed. When a booking's assigned day changes — a
date-bucketing fix, a re-import, a corrected `booked_at` — the sync writes the booking at its new
day and **leaves the row at the old day untouched, forever**. The read-time rollup then sums both.

Proven by exact arithmetic against the Calendly source:

| cohort          | Calendly source         | spine, correct | spine, duplicated      |
| --------------- | ----------------------- | -------------- | ---------------------- |
| `aug11_end_cta` | 13 @ Aug 11, 5 @ Aug 12 | 13 + 5         | **18 @ Aug 24**        |
| `aug18_end_cta` | 9 @ Aug 18, 1 @ Aug 19  | 9 + 1          | **10 @ Aug 24**        |
| `aug25_end_cta` | 18 @ Aug 25, 1 @ Aug 26 | 18 + 1         | **19 across Sep 8-11** |

Each duplicate equals that cohort's total exactly. Every orphan was written by the syncs of
2026-09-14 and 2026-09-18 and survived the 2026-09-21 resync.

**Measured 2026-09-21: 34 orphan rows carrying 90 phantom bookings since 2026-06-01. All
`leads=null`.**

Measured through `fetchFacts` before and after the run (population: `channel_daily.booked`
summed over the week, leads + contacts definition applied):

| Week            | Before | Predicted | After   | Note                                                                                                                                |
| --------------- | ------ | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| W8 Aug 24-30    | 164    | 108       | **108** | Exact.                                                                                                                              |
| W9 Aug 31-Sep 6 | 112    | 112       | **112** | No orphans; unchanged, as predicted.                                                                                                |
| W10 Sep 7-13    | 128    | 96        | **97**  | Every row rewritten by the run, 0 orphans left. The extra 1 is a booking that matured after the morning measurement, not a phantom. |
| W11 Sep 14-20   | 81     | 80        | **83**  | 82 live + the 1 unreachable chatbot orphan below. Rose because W11 bookings are still maturing.                                     |

W10 and W11 are still moving: a lead's booking is credited to its **arrival** day, so a
week's total keeps rising for days after the week ends. Do not treat either as final.

An orphan is a `booked` row the most recent sync did not regenerate. `synced_at` cannot say this
on its own — three connectors share the column and each write bumps it — but **among rows that
carry a booking** it can, because only the booking writers set `booked` and they rewrite a day's
booking rows in one pass. So: a `booked > 0` row whose `synced_at` **date** is older than the
newest `synced_at` date among booked rows on the same day. Dates, not instants: the connectors
run minutes apart inside one cron and a manual run lands hours later.

Validated against the 34-row backup across all of 2026: **34 rows, 90 bookings, 0 missed,
0 extra.** This is now the `spine-orphaned-bookings` audit check (§8), which additionally
requires the link to hold a booking on another day — the same restriction the fix applies, and
what separates the 32 it can clear from the 2 it cannot.

**Ruled out by measurement, not opinion:** double-counting a lead against an unlinked Calendly row
(3 of 1,122 estate-wide, 0 in W8/W9); twinned keys from the Sept 11 channel rename (0 in every
week — that migration worked); a null `booked_at` falling back to the import day (0 of 1,282);
read truncation (both readers window by day and cap at 200,000 against 32,720 rows).

**Residual, not yet explained.** W8 corrected 108 still sits above the Close mirror's marketing
subset. Part of it is writer 1: a lead's booking lands on its **arrival** day while Close dates it
on the **booking** day. Measured displacement across week boundaries: W8→W9 33, W9→W10 41,
W10→W11 30. Bookings mature 1-6 days after arrival (428 of 587). This is a real definitional
difference between the two systems, not a defect — but it means the spine and Close will never
agree week-on-week at the boundary.

**The earlier "spine W10 = 83" is not reproducible** and equals the Reactivation Scrapers count for
the same week; treat it as a transcription slip, not a measurement.

**The fix** (`clearMovedBookingRows`, `channel-sync.ts`) blanks the booking outcomes on a day a
link no longer has a booking on, mirroring `clearRenamedAdRows` in `metricool-sync.ts` — there the
campaign name moves inside a day, here the day moves under a link. It only considers links the run
actually wrote, so a link with no bookings in the window is never blanked. Simulated against live
data it reaches **32 of the 34 rows and 88 of the 90 phantom bookings**. The two it leaves are
single bookings on links with no surviving booking anywhere:

- `2026-07-22 instagram/simon/{{user_id}}/_____` — an unrendered link template that shipped live.
  A tracking bug in its own right; the booking is real, its attribution is not.
- `2026-09-15 chatbot/site_chat/(not set)/5b3714ca-…` — a dead chatbot session key.

## 4. Rates

### Book %

`bookedOfSignupsPct` — bookings over everyone the channel acquired (**leads + contacts**), not over
site leads alone. Denominating on leads alone published Webinar at 300% on 2026-09-21, because
4,037 registrations sat in `contacts` and were skipped.

Rows carrying a booking but no audience of their own are handled by source:

- `source === "internal-webinar"` — the night-of and replay CTAs, shown inside the room. Everyone
  clicking already registered, so they count in the numerator. 119 of the Webinar channel's 146
  bookings over 30 days.
- Everything else with no audience is a genuine direct link and is disclosed as `directBooked`,
  never folded into the rate.

**Regression bar.** Channels with no contacts must never move when Book % logic changes:
YouTube 62.5% · Google Ads 49.5% · Chatbot 53.7% · Newsletter 50%. Pinned in
`channel-report-rollup.test.ts`.

### Show rate

Shows over people who booked — never over all leads. Counting shows over leads is a known past
defect.

### Qualified (rep)

Qualified over people who **booked**, never over people who showed.

Measured 2026-09-21 for September so far: **16 of 444 booked calls carry "Qualified (Opp)" = Yes
with no "First Call Show Up (Opp)" = Yes.** Qualified is therefore not a subset of showed, and a
qualified-over-showed rate reads above 100% for some funnels. Both rates on the MTD funnel are
over booked for this reason, and the 16 are disclosed on screen.

This is a logging habit, not a data defect: a rep can mark the outcome without ever ticking the
show. Do not "fix" it by inferring a show from a qualification.

---

## 5. Stephen's MTD dashboard — what it counts

Source: Close CRM only (no Steel Trap, despite the assumption). `README.md` in his repo.

**Booked** = meeting activities surviving ALL of:

1. Not cancelled or declined
2. Not owned by Stephen Olivas, Ahmad Bukhari, Kristin Nelson, or **Spencer Reynolds** — note
   Spencer is an active VP setter, so his meetings are invisible in this dashboard
3. Title filters: excludes follow-ups, reschedules, "Vending Quick Discovery", "Anthony Q&A",
   enrolment calls; **includes** scraper "Next Steps" patterns
4. Lead status not `Canceled (by Lead)` or `Outside the US`

Deduplicated by `lead_id` — one lead, one booking. Closed-won is pulled independently by
`date_won`, so his won will not reconcile to his own booked cohort.

**His "Leads" column is unreliable.** It read 365 for the week of the Aug 18 webinar (809
registrants) and 1,965 for the week of Aug 25 (1,109 registrants). Do not use it.

**Trust his Booked.** Verified against our independent Close data within 3 bookings on both
matched weeks.

### Our mirror of it — `/admin/analytics?tab=close`

Shipped 2026-09-21. The same four stages, computed only from `close_lead_funnel`, with every
stage naming its population and the Close field it read. It reproduces the **shape** of his
dashboard and none of its arithmetic.

Measured September 1-21, 2026 (population: leads whose first sales call is dated in the window,
SteelTrap exclusions applied):

| Stage      | Count | Rate            | Population                                                                      |
| ---------- | ----- | --------------- | ------------------------------------------------------------------------------- |
| Booked     | 444   | —               | Leads whose first sales call is scheduled in the month                          |
| Showed     | 250   | 56.3% of booked | Of those, "First Call Show Up (Opp)" = Yes                                      |
| Qualified  | 188   | 42.3% of booked | Of those, "Qualified (Opp)" = Yes                                               |
| Closed-won | 40    | —               | Deals won in the month by `date_won` — **a different population**, not a subset |

Revenue on those 40: **$281,609**, 0 unvalued. 32 first calls excluded by the SteelTrap rule.
Marketing line **235**, `Reactivation Scrapers` **209** (444 total).

**Three reasons it will never equal his number**, all stated on the screen itself:

1. **Meeting owners.** He drops meetings owned by four people, one of whom (Spencer Reynolds) is
   an active VP setter. `close_lead_funnel` has **no meeting-owner field**, so that filter cannot
   be applied on our side at all. Reproducing it needs Close meeting activities, which we do not
   ingest.
2. **What a booking is.** We read the lead's "First Sales Call Booked Date"; he reads meeting
   activities and filters them by title.
3. **His "Leads" column is not mirrored, on purpose.** §5 above.

---

## 6. Kody's BTC scorecard rows

Two of the three are transcribed from Stephen's weekly archive. They are not an independent check.

| Row                                        | Definition                              | Verified                |
| ------------------------------------------ | --------------------------------------- | ----------------------- |
| New Leads – Meetings Booked (VP)           | Stephen's weekly TOTAL "Booked"         | Exact, W7–W10           |
| New Leads – Marketing Meetings Booked (VP) | Stephen's TOTAL − Reactivation Scrapers | Exact, W7–W10           |
| New Form Submissions (VP)                  | **Unknown**                             | Matches nothing we have |

Kody's form figure runs ~1.31× our total captured for W7–W9, then 1.15× at W10 — so his source
counts something we do not tag, and its behaviour changed. **Open question: which report is this?**

Scorecard weeks are labelled Mon–Fri but the values are Stephen's Mon–Sun weeks.

---

## 7. The two "Won" counts

Both read Close `opportunity.status_type == 'won'`. Only the scope differs. Do NOT merge them.

| Count                                                       | Scope                                                          | Totals                     |
| ----------------------------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| **Calls board** (`~/vp-webinars`, `call_deals.py`)          | Person was in the Zoom room and took a recorded call           | 15 across 11 cohorts       |
| **Close tag cohort** (`close_events.py` → `webinar_events`) | Lead carries the event's `utm_content`, marketing funnels only | 15 across the same cohorts |

They total the same **by coincidence** and disagree per cohort in both directions:

| Cohort | Room | Tag | Why                                                                                                                                   |
| ------ | ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------- |
| aug25  | 2    | 0   | Both winners are `Reactivation Scrapers`; excluded from marketing, published separately as `scraperInCohort.won = 2`, revenue $12,894 |
| july14 | 0    | 1   | Won after attending but never booking a call, so no room row exists                                                                   |

The tag number is the one to divide into ad spend for ROAS. The room number is the one for sales
performance. A single merged number would look correct at the total and be wrong in both
directions per cohort.

---

## 8. Traps that have cost real time

- **Never measure off raw `channel_daily` rows.** Go through `fetchFacts`, which applies
  `applyLeadDefinition`. Skipping it reports Webinar Book % as 0.7% when the page says 300%.
- **Match window lengths** before comparing any two systems. Mon–Fri vs Mon–Sun is a ~25 booking
  difference on bookings alone.
- A webinar Zoom has 404'd (June 16, `89024004879`); `retain_expired()` keeps it. July 14 has
  booked calls but no registrant figure — exclude it from any rate, never from a booking total.
- GHL tag counts are not registrant counts. Aug 18: Zoom 809 vs GHL-tagged 1,341.
- `close_lead_funnel` only holds leads that booked. It cannot answer lead-volume questions.
- **A stale spine row is invisible.** `channel_daily` is append-and-update; nothing deletes. A row
  whose key the sync stopped generating keeps its last value and is summed forever. Before trusting
  any historical spine figure, check `synced_at` against the latest run for that day. For bookings
  this is now checked nightly by `spine-orphaned-bookings` in `data-audit-checks.ts`, which renders
  on `/admin/data`. **Spend, visits, clicks, leads and won have no such check** — the same defect
  in any of those is still silent.
- **`vitest.config.ts` pre-sets placeholder Supabase env vars** (`localhost:54321`). A diagnostic
  that loads `.env.local` with `??=` silently reads nothing and returns null — assign with `=`.
- Webinar-night spikes in `booked` are **real** (the night-of CTA bursts). A spike on a day with no
  webinar is the thing to suspect.

---

## 9. Contested numbers — the live register

Every number that two systems disagree on, or that has no traceable source. A number is only
allowed in a report when it appears here as **settled**, or is quoted with its caveat.

| Number                             | Systems that disagree               | Status                                                                                                                     | What settles it                                                                  |
| ---------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Channel `booked`, Aug–Sep          | Spine vs Close mirror               | **Settled 2026-09-21.** Sync run; 88 of 90 phantom bookings cleared. W8 164→108 exact                                      | §3; `spine-orphaned-bookings` now checks it nightly                              |
| Channel `booked`, the last 2       | Two links with no surviving booking | **Standing, unfixable by the sync.** 2 bookings still counted, attribution wrong                                           | Delete by hand or fix the link; the audit deliberately ignores them              |
| Kody's "New Form Submissions (VP)" | Kody vs everything we hold          | **Unsourced.** ~1.31× our total capture W7–W9, 1.15× at W10                                                                | One question to Kody: which report is it                                         |
| "Leads"                            | Site form fills vs total captured   | **Settled 2026-09-21.** Tiles renamed; 109 vs 1,308 was a label, not a loss                                                | §2                                                                               |
| Won, per webinar cohort            | Calls board (room) vs Close tag     | **Settled.** Both correct, different scope; never merge                                                                    | §7                                                                               |
| Company booked                     | Our Close mirror vs Stephen         | **Settled.** Within 2% on matched windows; marketing line exact at W10                                                     | §3, §5                                                                           |
| Stephen's "Leads" column           | Stephen vs registrations            | **Known bad.** 365 for an 809-registrant week                                                                              | Do not use it                                                                    |
| Spencer Reynolds' meetings         | Stephen drops them; we do not       | **Open decision**, not a defect. Our mirror _cannot_ drop them — there is no meeting-owner field                           | Adam's call; matching him needs Close meeting-activity ingestion                 |
| MTD funnel stages, September       | Our Close mirror vs Stephen's MTD   | **Unverified against his sheet.** 444 / 250 / 188 / 40 measured from our mirror 2026-09-21; the two rules differ by design | A matched-window comparison against his Booked; the owner filter can never match |
| Qualified without a logged show    | Close vs itself                     | **Settled 2026-09-21.** 16 of 444 booked calls; qualified is not a subset of showed                                        | §4; both rates are over booked and the 16 are disclosed on screen                |
| GHL form-fill volume               | Nobody reports it end to end        | **No owner**                                                                                                               | Build it or say it does not exist                                                |
| `instagram/simon/{{user_id}}`      | —                                   | **Broken link template** shipped live; booking real, attribution is not                                                    | Fix the link, do not backfill                                                    |

Rules this register enforces:

- A number with no row here has not been checked. Say so rather than quoting it.
- "Settled" means measured against the other system on a **matched window**, with the population
  named. Not "looks about right".
- When a number moves, the row moves with it. A stale register is worse than none.

## 10. Open questions

1. Where does Kody's "New Form Submissions (VP)" come from?
2. Should Spencer Reynolds' meetings be excluded from company booking totals? Stephen drops them.
   Note we currently **cannot** drop them: `close_lead_funnel` carries no meeting-owner field. If
   the answer is yes, it needs Close meeting-activity ingestion, which is a slice of its own.
3. Is the MTD funnel worth reconciling to Stephen's Booked on a matched window, given the two
   rules differ by design? Ours reads a lead field, his reads meeting activities. Until someone
   does that comparison, the September stages stay **unverified** in §9.
4. No end-to-end report of GHL form-fill volume exists, though Lane 2 works those leads.
5. Should the spine credit a lead's booking to its arrival day or its booking day? Close uses the
   booking day. Changing it would make the two systems comparable week-on-week; it would also
   break `booked ÷ leads` as a rate over one population, which is why it is the way it is.
