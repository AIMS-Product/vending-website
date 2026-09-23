# Data trust bar — 2026-09-22

Adam: "I truly do not trust the data. I have no way to know if it's fully
refreshed and pulling from the right sources, or whether the glossary is built
into the live data page. Make it baby-proof for anyone who logs in tomorrow."

Branch `feat/data-trust-bar`, off origin/main `8a125af`. PR only; never merge.

## What ships

One bar at the top of every `/admin/analytics` tab and `/admin/data`:

1. **Data as of** — the oldest last successful update among the feeds that tab
   reads. Tab to feeds lives in one table (`TAB_FEEDS`,
   `src/lib/analytics/data-trust-bar.ts`). A feed past its expected cadence is
   amber; past twice its cadence, never updated, failing, or unreadable is red,
   named in plain words.
2. **Last night's checks: N of M passed** — the failing ones named, linking to
   `/admin/data`. No stored run in the last 26 hours is red: silence never
   reads as OK.
3. **Unverified** — a number whose audit check failed, errored or could not be
   run is marked "Unverified" next to the number (reason on hover) and listed
   with its reason in visible text inside the bar (phones). Check to number
   lives in one table (`CHECK_COVERS`).
4. **Definitions** — opens and scrolls to the glossary. Glossary extended so
   lead, site form fills vs total captured, booked call, skipped-form booking,
   showed, qualified and closed-won each match `REPORTING.md`.

## Invariants

- No number's computation changes. This slice only reads, labels and flags.
- No URL/query keys, data keys or test ids renamed.
- A trust read that fails renders red with the reason; it never hides the tab
  and never reads as green.
- A check that did not pass never renders as verified.
- Light theme, admin tokens (`--ui-*`), `AdminStatusBadge` tones; no emojis.

## Status

- [x] Pure rules + tests (mapping, staleness, audit missing, unverified)
- [x] Reader, bar component, wired into analytics tabs and /admin/data
- [x] Glossary entries reconciled with REPORTING.md
- [x] PR open (not merged; needs a signed-in look at a live tab)
