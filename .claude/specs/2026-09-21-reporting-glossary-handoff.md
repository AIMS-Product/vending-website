# Handoff — reporting glossary + Book % fix (2026-09-21, evening)

Third session of the day. Read in order:

1. `REPORTING.md` at the repo root — **new, the glossary.** Everything verified today lives there.
2. `.claude/specs/2026-09-21-webinar-attribution-handoff.md` — the morning's webinar work.
3. `.claude/specs/2026-09-21-reporting-accuracy-handoff.md` — the goals/setter-credit session.

## Shipped this session

**`REPORTING.md`** (new) — metric glossary. Each metric names what it counts, where it comes from,
and what it is NOT; plus the measured divergences, Stephen's definitions, Kody's scorecard rows,
the traps, and the open questions. Point a fresh session here first.

**Decision 1 resolved** — `channel-report-rollup.ts`. Neither Option A nor Option B; a narrower fix.
`bookedByOwnAudience(fact) = fact.source === "internal-webinar"` admits the in-room CTA rows into
the Book % denominator set and excludes them from `directBooked`.

- Webinar Book % 0.7% → **3.6%** (30d), `directBooked` 119 → none.
- Option A ruled out by measurement, not preference: totals-over-totals moves Chatbot
  53.7% → 82.9% and Google Ads 49.5% → 50.5%, breaking the stated regression bar.
- Containment provable: all 119 no-audience Webinar bookings carry this source (226 of 226 at 90d),
  and no row outside the Webinar channel carries it at either window.
- Before/after verified on identical live data. Bar held: YouTube 62, Google Ads 49.5, Chatbot 53.7,
  Newsletter 50 unchanged. (YouTube reads 62 not 62.5 — a sync moved leads 136 → 137, confirmed by
  running the OLD code against the SAME data.)
- 2,741 vitest pass, tsc clean. New test pins all four bar channels.

## Corrections — read before trusting the earlier handoffs

1. **Decision 2's stated cause was wrong.** The morning spec says the two Aug 25 winners carry
   `utm_content = None` and were never webinar-ad leads. `data/close/flat.json` in `~/vp-webinars`
   says both carry `utm_content = aug25`, `showed: true`, `booked: true`, $5,997 + $6,897. They are
   excluded by `close_events.py:257` because their funnel is `Reactivation Scrapers` — deliberate,
   so ad spend is not divided by outcomes ads did not buy. **The missing 2 are already published**
   as `aug25.scraperInCohort.won`. The reconciliation is mostly rendering, not a new pipeline.
2. **The two Won counts total the same (15 = 15)** across all 11 cohorts and disagree per cohort in
   BOTH directions — aug25 room 2 / tag 0; july14 room 0 / tag 1 (won after attending, never booked
   a call). A merged number would look right at the total and be wrong both ways per cohort.
3. **My own error:** I compared our 5-day window to Stephen's 7-day one and reported a ~25 booking
   scraper gap that does not exist. On matched windows our Close mirror tracks him within 3
   (W10 167 v 172, W11 163 v 166); the marketing line matched exactly at W10 (89 = 89).

## Open, in priority order

1. **Spine drift, unresolved.** `channel_daily.booked` vs the Close mirror's marketing subset:
   W8 153 v 75, W9 119 v 73, W10 83 v 89, W11 81 v 83. Double in late August, correct now. Root
   cause not found. Channel-level Book % is unsafe to compare across Aug/Sept until it is. Highest
   value open item; use `safe-feature-slice` — Book % feeds ad spend decisions.
2. **Leads tile relabel.** Overview "LEADS" shows site form fills only (109) while real capture was
   1,308. Rename to "Site form fills", add "Total captured". No pipeline work.
3. **Week selector + total row** on the analytics page. Jess cannot scope to a named week or see a
   total, so she asks Adam every Monday. Stephen's weeks are Mon–Sun.
4. **Decision 2 implementation.** Label "Won — attended the room" vs "Won — webinar-attributed" and
   render the per-cohort gap with its reason, from `scraperInCohort.won` and the
   attended-but-never-booked case. `app/src/lib/close-reconciliation.ts` in `~/vp-webinars` is the
   pattern to follow.
5. **Decision 3** — Instagram's 23 `directBooked`. Still needs evidence before changing.
6. **GHL setter outreach failure.** Root-caused, not fixed. `ghl_outreach.py`'s coverage guard
   enforces a per-cohort invariant as an all-or-nothing abort, so the two cohorts CI refreshes
   correctly (sept8 1041/1041, sept15 1080/1080) are discarded along with the older ones it cannot
   reach. Fix: carry the committed entry forward per cohort where new coverage is lower, publish the
   rest, print the carry-forward loudly, keep `--allow-coverage-drop`. Compensation data — use
   `safe-feature-slice`.

## Owed by Adam

- **Rotate two Avoma keys.** Settings → Developer in the Avoma web app. One was pasted in chat; a
  second, different key sits in plaintext at `~/attention-to-avoma/HANDOFF.md:30` (not a git repo,
  so never pushed). New key into `~/vp-webinars/.env` only; the GitHub secret can be set from file.
- **Ask Kody which report "New Form Submissions (VP)" comes from.** The only unsourced number on
  the scorecard. Runs ~1.31× our total capture for W7–W9, then 1.15× at W10.
- Stale "Anthony Q&A" GHL custom value still reads "Thursday, September 17".

## Rules

- Measure through `fetchFacts`, never raw `channel_daily`. Recipe: temp test in
  `src/lib/services/`, load `.env.local` manually (vitest does not), stub `console.error` into an
  array (vitest swallows it), write results to a file. Delete the temp file afterwards.
- The checkout is shared with other sessions. Stage explicitly, never `git add -A`. **Check whether
  a spec filename already exists before writing one** — I clobbered a tracked handoff this session.
- `pnpm exec` is broken here; call `./node_modules/.bin/*` directly.
- A push to `main` publishes to www.vendingpreneurs.com in ~1 min.
