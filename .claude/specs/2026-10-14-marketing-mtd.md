# Marketing MTD view (Jess's handoff, 2026-10-14)

**Superseded rule (Adam, 2026-10-14 evening): the page now counts on Dom's booked_calls.v2.2.**
See AGENTS.md (2026-10-14 Marketing MTD) and METRICS.md §16 "Marketing MTD". The field-based rule below
is kept as the record of Jess's reference; Sep 1-14 on Dom's rule = 142 booked vs her 154 (wins,
value and cycle unchanged: 15 / $103,290 / 10 days).

Source: "Adam Marketing Dashboard Handoff.docx" from Jess. Attachments
(`marketing-mtd-dashboard.html`, `adam-marketing-dashboard-config.json`) not yet
received.

## Rule (field-based, NOT Dom's V2 meeting rule)

- Booked: distinct Close leads, First Sales Call Booked Date in range, current
  Funnel Name. Excluded: status Canceled (by Lead) / Outside the US; BTC Business
  Line TLG / PPA; Reactivation Scrapers; Lead Owner not on the Lane 1 roster
  (`MTD_BOOKING_OWNERS`). LTF Quiz is INCLUDED. Blank funnel = "Unknown (Needs Review)".
- Shown: First Call Show Up yes/true/1. Qualified among shown: shown AND Qualified.
  Raw qualified-but-not-shown are conflicts, listed by lead.
- Won: opportunities won by date_won, same lead filters (no roster), minus the five
  closers (`MTD_EXCLUDED_CLOSER_IDS`). Independent of booked. Won/booked = period ratio.
- Cycle: Pacific day won minus Pacific day lead created; median over all deals; n shown.
- Compare: same dates last month (day clamped). Counts % change, rates pp, New / —.
- Goal: 125/week = 25 per Mon–Fri day; month goal = 25 x workdays; catch-up per
  remaining week segment, ceil(required daily x days).

## Acceptance

1. Sep 1–14 reproduces 154 / 95 / 66 (73 raw) / 15 / $103,290 / 10 days n=15
   (`scripts/marketing-mtd-validate.ts`, exit 0).
2. Oct 1–14 differences from Jess's 11 AM snapshot (122/74/54/10/$73,679) explained
   by record changes after her snapshot.
3. Goal math on 122 at Oct 14 gives 250 / −128 / 550 / 428 / 72·179·179 (unit test).
4. Page renders on prod-data dev, desktop and mobile, no page overflow.

## Parts

1. Numbers page `/admin/analytics/marketing` (this slice).
2. Verified upcoming first calls from `close_meetings` (needs Jess's title patterns).
3. Per-channel people with Close links and loss reasons (sync Lost Reason, Key Concern,
   Primary Objection).
4. Dated snapshots, export, print.

## Open

- Main dashboard counts Dom's V2 (97 marketing, Oct 1–14); Jess's view is 122
  field-based. Jess's doc says the activity rule does not replace hers. Adam to settle.
