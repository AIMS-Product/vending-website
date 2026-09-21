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
| **Channel spine**    | `channel_daily.booked`                                     | Bookings attributable to a marketing channel | 83  | 81  |

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

### Known defect — spine drift (unresolved)

The spine's booked count disagrees with the Close mirror's marketing subset, and the disagreement
changed over time:

|                              | W8  | W9  | W10 | W11 |
| ---------------------------- | --- | --- | --- | --- |
| Spine                        | 153 | 119 | 83  | 81  |
| Close mirror, marketing only | 75  | 73  | 89  | 83  |

Roughly double in late August, roughly right now. **Root cause not yet found.** Until it is, do not
compare channel-level Book % across August and September.

---

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

---

## 9. Open questions

1. Where does Kody's "New Form Submissions (VP)" come from?
2. Why did the channel spine's booked count drift (double in Aug, correct now)?
3. Should Spencer Reynolds' meetings be excluded from company booking totals? Stephen drops them.
4. No end-to-end report of GHL form-fill volume exists, though Lane 2 works those leads.
