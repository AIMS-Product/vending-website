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

## Open

- **One delete is left, and it needs Adam's hand.** The re-sync (2026-09-14,
  `days=140`) put the backfilled bookings on their real days — May 91, June 561,
  July 624, August 570 — but the stale rows it replaced still sit on
  2026-09-14, showing 683 phantom bookings on one day. Removing them is a bulk
  delete, which this session is not permitted to run:

  ```
  ! cd ~/vending-website && node scripts/repair-20260914-spine.mjs delete
  ```

  `scripts/repair-20260914-spine.mjs backup` was run first; the 291 rows are
  saved at
  `/private/tmp/claude-501/-Users-adamwolfe/7b039b12-.../scratchpad/channel_daily-20260914-backup.json`.
  Then `... verify` to confirm 2026-09-14 drops to a normal day.

- **ga4-visits fails rows on a wide window.** The 140-day re-sync wrote 9,205
  GA4 rows and failed 1,258. The daily run fails a handful. Pre-existing, not
  from this work, but worth a look.
- **Tell Stephen about `skip += 100`** — Adam said not to message him; it is one
  character whenever the conversation happens.
- **Beatrice and Josh** need a job on the roster sheet.
- Carried over from the funnel-map handoff: rotate `GHL_API_KEY`.

## Not relitigated

- We count leads, he counts meetings for Reactivation Scrapers. Both are
  defensible; they answer different questions and should not be forced to match.
- His status exclusions stay his. Our spine counts every booking and lets the
  reader exclude.
