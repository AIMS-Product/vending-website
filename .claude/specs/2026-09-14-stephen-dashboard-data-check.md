# Does our data map to Stephen's dashboards? — 2026-09-14

Checked `mtd-funnel-dashboard`, `sales-manager-dashboard` and
`call-capacity-dashboard` against our own spine for June–September 2026.

**Short answer: the funnel names and the stages line up. The counts do not,
and both sides were wrong.** One bug on his side inflates every booked count
on the MTD dashboard; one bug on ours dumped 925 bookings onto a single day.
Both are found and ours is fixed.

## 1. Stephen's booked counts are inflated — a paging typo

`fetch_and_build.py`, `fetch_leads_by_booked_date()`, lines 342–350:

```python
"_limit":  200,
"_skip":   skip,
...
skip += 100        # <- advances half a page
```

Each page asks Close for 200 leads but the cursor moves 100, so every page
after the first re-reads 100 leads it already has. `leads.extend(batch)` never
dedupes, and each lead in that list becomes one row in `meeting_rows`, which is
what `booked`, `showed`, `qualified` and `closed` are counted from.

It is the only loop in the file whose limit and skip disagree — lines 265/272,
379/387 and 415/442 all pair correctly. Every other loop in the other two
dashboards pairs correctly too. One typo, wide blast radius: it feeds every
non-Reactivation-Scrapers funnel on the MTD dashboard.

Reactivation Scrapers is not affected — it comes from the meeting-title path,
which pages correctly.

Corroboration inside his own output: August shows Website with 56 leads and 72
booked (129%), LTF with 1 lead and 8 booked (800%), Instagram 75 and 80 (107%).

**His fix is one character: `skip += 200`.** Until then, treat MTD booked,
showed, qualified and closed as high by roughly a third for every funnel except
Reactivation Scrapers. Revenue and lead counts come from other loops and are
not affected.

### What the two sides say, on his own grain

Our Close mirror (`close_lead_funnel`, refreshed 2026-09-14, 8,226 leads),
counted the way he counts: one row per lead whose First Sales Call Booked Date
falls in the month.

| month      | his booked | ours | his ÷ ours |
| ---------- | ---------- | ---- | ---------- |
| June       | 977        | 674  | 1.45       |
| July       | 1,196      | 798  | 1.50       |
| August     | 821        | 576  | 1.43       |
| Sept (MTD) | 434        | 355  | 1.22       |

The ratio holds steady across every funnel, which is what a paging fault looks
like and is not what a mapping disagreement looks like. Two real differences
sit underneath it and are not bugs:

- He excludes Canceled-by-Lead and Outside-the-US leads; we do not.
- He counts Reactivation Scrapers as **meetings** (title-prefix), we count
  **leads**. September RS is the one cell where we read higher (166 vs 156).
- His "Unknown (Needs Review)" bucket has no counterpart on our side; leads with
  no funnel land in a `(no funnel)` row instead.

## 2. Our spine had 925 bookings stamped on one day — fixed

A Calendly backfill ran 2026-09-14 and imported 1,889 bookings whose true dates
run May (91), June (489), July (344) and September (1). `channel-sync.ts`
bucketed the tagged, no-lead-form ones by the mirror row's own `created_at`, so
925 of them landed on 2026-09-14. A normal day carries 6–64.

What that distorted: the Channels tab, the funnel map, month-over-month, and the
Q4 pace — everything reading `channel_daily.booked`. It is why June reads as
almost no bookings at all and September reads as a record month.

Fixed in `1d9f3ad`: the day now comes from Calendly's own booked-at in the
stored payload. A regression test covers the backfill shape.

Repaired in prod on 2026-09-14: the sync was re-run over 140 days, so the
bookings now sit on their real days. One bulk delete of the stale rows is still
outstanding — see Open.

## 3. Setters and scrapers were one bucket — fixed

Against Adam's Lane 2 Roster sheet (as of 2026-09-11): three setters (Charlie
Ingram, Pearl Sathekge, William Nowak), nine scrapers (Naria Torres, Melia King,
Jessica Zatkin, Cassie Caraballo, August Young, Connor George, Vince Bartolini,
Kelly Schrader, Spencer Reynolds) and Ariella Irvine on both sides.

Our team page called all of them "Setter", and **William Nowak was on no list at
all**, so his calls showed as unclassified. Fixed in `abfc718`: the roster
carries the job, the Role column prints it, and attribution asks `setsCalls()`
so splitting the roles took no credit away from a scraper.

Beatrice Braescu Cojocaru and Josh Stoffel book calls but are not on the sheet.
They keep their credit and show as unclassified until someone says which job
they hold.

## 4. What we verified from our own data, 2026-09-14

Adam's call: stop benchmarking against Stephen, establish what is true from
live data we control. Three findings, each checked rather than assumed.

**Close's "First Sales Call Booked Date" is the meeting date, not the booking
date.** 102 Close leads matched to their Calendly rows: 96 line up with the day
the call is scheduled for, 2 with the day it was booked. 40 rows already sit on
future dates. Both dashboards are built on this field, so both answer "how full
is the calendar", not "what did we book". The section-1 comparison is unaffected
— it was meeting-dated on both sides — but the label was wrong.

**Our Calendly mirror is complete for marketing and blind to reactivation.**
Every Close booking since 2026-08-24, checked for a matching Calendly first-call
row: Website 35 of 35, Google Ads 21 of 21, Internal Webinar 112 of 115, YouTube
35 of 36, Instagram 46 of 49 — and Reactivation Scrapers 28 of 257. That team
books on calendars we get no webhook from. Their only source is Close, on the
meeting-date basis.

**The booked-call gap is real and it is not marketing's.** Marketing first calls
booked, by booking date, from Calendly: 91, 94, 95 over the three weeks to
2026-09-13. Flat. Reactivation delivered 79, 69, 76 against a roster expectation
of 160 a week. Total capacity is 210 a week and we land 143-167. The whole
shortfall sits on the reactivation side.

### Shipped

- **Webinar bookings were double-counted** — the sheet's count plus the tagged
  Calendly links, same calls. 2026-09-08 read 74 against a true ~34. Fixed in
  `db177c3`: Calendly owns booked on the spine, the sheet keeps its numbers on
  `webinar_events`. Written as an explicit null so the sender's next
  full-history send clears the doubled rows with no backfill by hand.
- **Booked-calls tab** (`7e5d974`), `admin/analytics?tab=booked`. Six weeks,
  booking-dated, marketing only, split by Close funnel.

### Deliberately not done

- **No Reactivation Scrapers channel on the spine.** The spine is
  booking-dated; that team's only source is meeting-dated. Adding it would
  reintroduce the class of bug this work removed. It needs its own view on its
  own axis, or a Calendly connection for those calendars.
- **No target line on the board.** 42 a weekday is total call capacity across
  reactivation and marketing. Marketing has no target of its own yet.
- **No cancellation column.** Bookings made 3-23 August have no cancel record
  at all, so a zero would read as "none" rather than "not captured".

## Open

- **Marketing needs a booking target of its own** before the board can show a
  gap rather than a trend.
- **Reactivation's 160-a-week expectation is being met at roughly 45%.** That is
  the real gap and it has no owner in this repo yet.
- **ga4-visits fails rows on a wide window** — 1,258 of 9,205 on the 140-day
  re-sync. Pre-existing.
- **Beatrice and Josh** need a job on the roster sheet.
- **Tell Stephen about `skip += 100`** — Adam said not to message him.
- Carried over from the funnel-map handoff: rotate `GHL_API_KEY`.

## Not relitigated

- We count leads, he counts meetings for Reactivation Scrapers. Both are
  defensible; they answer different questions and should not be forced to match.
- His status exclusions stay his. Our spine counts every booking and lets the
  reader exclude.
