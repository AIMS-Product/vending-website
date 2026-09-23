# Analytics clarity pass — 2026-09-22 (unattended, Adam at the gym)

Trigger: Makenna (marketing) asked what "10 (3 direct)" means on Channels. The
answer lived only in a hover tooltip. The dashboard is read by non-engineers on
laptops and phones; it has to explain itself on screen.

Branch `feat/analytics-clarity`, worktree `~/vending-website-clarity`, off
origin/main `fa7d2d5`. Push to main = production.

## Goals

1. Every analytics tab (15) readable by a marketer with no tooltip: plain
   labels, abbreviations spelled out or legended, no internal words (spine,
   observed, cohort, rollup, connector, denominator, population).
2. One "What these words mean" glossary on the analytics page, covering the
   terms every tab shares (lead, contact, booked, showed, qualified, closed-won,
   skipped form, maturing).
3. Overview says how fresh its numbers are (punch list 5).
4. A connector that writes 0 rows for days stops reading healthy (Bitly, punch
   list 5).
5. Visual check of each changed tab on a local preview.

## Invariants

- Copy and presentation only for goals 1-2. No change to how any number is
  computed, no URL/query keys, data keys or test ids renamed.
- Tests that assert copy get their expected strings updated; no assertion removed.
- No emojis, no litotes, no dark theme changes.

## Status

- [x] "(3 direct)" -> "(3 skipped form)" + explained above the Channels table
- [x] Wording pass, Leads + Channels tabs (agent A)
- [x] Wording pass, Sales + Executive tabs (agent B)
- [x] Glossary (`AnalyticsGlossary.tsx`, under the lead definition on every tab)
- [x] Overview freshness line (`/admin`, PT)
- [x] Zero-row connector health: status `empty` / "No new data" after 48h
- [x] Bugs found on the way, fixed: YouTube Attended (was booked minus
      no-show), skipped-form check counted webinar bookings, Booked calls tab
      filed Reactivation Email as reactivation, Lane 2 note said unlogged calls
      count as shown, MoM revenue always green, raw feed ids on screen
- [x] Visual check on synthetic data (MoM, Channels, glossary; 1440 + 390)
- [ ] Review, PR, merge

## Left for Adam

- Cancelled Calendly bookings are dropped from Booked calls (deliberate, tested:
  August has no cancel records, so counting them would be uneven).
- "Qualified" means two things (rep mark in Close vs finished site questions);
  the glossary says so. Renaming one of them is a product call.
- Pre-existing lint error in src/lib/booking/post-booking-redirect.ts (rule not
  found), not from this branch.
