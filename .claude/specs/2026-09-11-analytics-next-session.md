# Next session: analytics follow-ups

Written 2026-09-11 at the end of a long session. PR #31 (this branch) carries
the finished work; everything below is what it did not cover.

Read `.claude/specs/2026-09-10-overnight-polish-handoff.md` for the house rules
that still apply: worktree only, production database read-only, failing test
before each fix, never add a `CRON_SECRET` minimum length.

---

## Done, on PR #31

1. The Overview read the oldest 1,000 of 2,004 bookings. 861 was really 1,748,
   and every booking after 24 August was missing. Both analytics reads page now.
2. Page paths link to the live page in three panels.
3. The YouTube per-video rate columns are graded red / amber / green against the
   median of the other videos, ungraded below five in the denominator.

Also open and unmerged: **PR #28**, the YouTube attribution polish. It edits
`youtube-attribution.ts`, `YouTubeAttributionPanels.tsx` and that file's test,
all of which #31 also touches. Whichever lands second needs a small rebase, and
`paged-read.ts` should absorb the copy of `readAllRows` living in
`youtube-attribution.ts` once both are in.

---

## 1. A Q3 range. The reason this work started

Adam is writing a Q3 marketing attribution report. **This screen cannot produce
a Q3 number.** The ranges are rolling windows only — 7d, 30d, 90d, 1y — so
"Last 90 days" is roughly 13 June to 11 September. Q3 is 1 July to 30 September.

The change is structural rather than cosmetic:
`ADMIN_ANALYTICS_RANGES` in `src/lib/services/admin-analytics-range.ts` is
`{ label, days }`, and every consumer derives `start` by subtracting `days` from
now. A quarter needs an absolute start **and** end, so the range type has to
carry a date pair and `admin-analytics.ts`, `youtube-attribution.ts` and the
range switcher all follow.

Notes for whoever picks it up:

- `youtube-attribution.ts` is heavily edited on PR #28. **Merge #28 first.**
- The prior-period comparison (`buildMetric`) assumes an equal-length window
  immediately before the current one. That still works for a quarter, but the
  code computes it from `days` — it needs the same treatment.
- Quarter presets were the agreed scope, not a full date picker. Adam was asked
  and did not pick; presets were assumed. **Flag if he wanted the picker.**
- Q3 2026 is not over, so a Q3 selection is partial until 1 October. The label
  should say so rather than letting a partial quarter read as a final one.

## 2. The chatbot admin pages are slow

Adam reported this at the end of the session. **Not yet diagnosed — do not
guess at a fix.**

What has been ruled out, measured against production on 2026-09-11:

- **It is not row volume.** `chatbot_conversations` holds **138 rows**.
  `FETCH_CAP` in `src/lib/chatbot/analytics.ts` is 4,000 and `LIST_CAP` in
  `src/lib/services/chatbot-admin.ts` is 500, so neither is anywhere near
  PostgREST's 1,000-row cap today. The bug that made the Overview wrong is not
  this bug.

Candidates, in the order worth measuring:

- **Sequential round trips.** `src/lib/chatbot/analytics.ts` runs a three-shot
  fallback (`ROW_FIELDS`, then `ROW_FIELDS_NO_ATTRIBUTION`, then
  `LEGACY_ROW_FIELDS`) one after another, and `linkBookedEvents` walks its
  `.in()` chunks in a `for` loop with an `await` inside. Each chunk is a
  separate trip. `paged-read.ts` on this branch already has the parallel shape
  to copy.
- **Payload size.** That same lookup selects `raw_payload` when `includeHost` is
  set. It is a large JSONB column on a 2,007-row table and it crosses the wire
  in full.
- **Missing indexes** on the columns those `.in()` lookups filter by —
  `calendly_bookings.scheduled_event_uri` especially.

How to measure, rather than assume: use the live-check pattern from the
overnight handoff — a throwaway `src/__live__/*.test.ts` that mocks
`@/lib/supabase/admin`, builds a real client from `.env.local`, and times the
real service function. That is how the GA4 read was proved to be 1.4s and then
proved to be 400ms. **Delete `src/__live__` before committing.**

Do not touch `src/lib/chatbot/**` or `src/lib/services/chatbot-admin*` without
checking for other live sessions first — three PRs landed there in two days.

## 3. Bitly clicks are still not tracked

Confirmed on 2026-09-11: `BITLY_ACCESS_TOKEN` is set in no environment — not in
`.env.local`, not among the 53 Vercel production variables — and
`bitly_link_clicks` holds 0 rows. The hourly cron at `:17` has been firing and
returning "skipped" since it shipped. The clicks stage of the YouTube funnel is
blank, and will stay blank for the Q3 report.

Needs a Bitly generic access token, and ideally `BITLY_GROUP_GUID` as well —
that second one is what lets the sync fill in the 42 registry rows that carry no
short link. No code has ever made a real call to the Bitly API.

## 3b. Booking integrity check — run 2026-09-11, READ ONLY

Adam asked for a backfill. **There is nothing to backfill.** This was a read
bug, never a write bug: every booking the webhook received is in the table.
Verified against production:

- 2,007 rows, 1,749 of them `booked`, the rest `canceled`.
- **1,749 booked rows, 1,749 distinct `invitee_uri`. Zero duplicates.**
  (An earlier count of 108 repeated `scheduled_event_uri` values is not a
  duplicate: `invitee_uri` is the unique key, and one scheduled event can carry
  several invitees. Group calls, working as designed.)
- Every row carries a `scheduled_event_uri`. None orphaned.

Three real findings came out of it.

### The page filters on the wrong time column

`admin-analytics.ts` filters bookings on `created_at`, which the schema
defaults to `now()` — it is **when we recorded the row**, not when the call was
booked or held. `event_start_at` is the real axis.

At 90-day grain the two nearly agree, which is why nobody noticed:

| Month   | by `created_at` | by `event_start_at` |
| ------- | --------------- | ------------------- |
| 2026-07 | 434             | 381                 |
| 2026-08 | 847             | 901                 |
| 2026-09 | 468             | 466                 |
| 2026-10 | 0               | 1                   |

They diverge at 7-day and 30-day grain, because of the next finding. A Q3
report by month should be built on `event_start_at`. Decide the axis
deliberately before changing it — "booked in this range" and "call happens in
this range" are different questions and the page may want both.

### Twenty-two days recorded nothing

No booking rows at all were written on **2026-08-04 through 08-23**, or on
08-25 and 08-26. The monthly totals still land, so the data arrived later in
bulk rather than being lost — but the webhook was not capturing continuously
for three weeks and something backfilled it afterwards.

**This is the actual risk to bookings.** If the webhook drops out again and
nobody runs a backfill, those bookings really are gone. Worth finding out what
happened in that window and whether anything alerts on it. Nothing appears to.

### Only 31% of booked calls attribute to a lead

544 of 1,749 booked calls carry a `lead_submission_id`. Of the remaining 1,205,
exactly **6** can be matched to a lead by email — so 1,199 have no lead in our
database at all.

That is consistent with the page's own note (phone, Saleskick and direct
Calendly links never touch the site) rather than evidence of broken
attribution. But it is the ceiling on any attribution report: **roughly two
calls in three cannot be traced to a marketing source**, and no amount of
dashboard work changes that. Raising it is a tracking-link problem, not a code
problem.

## 4. Smaller things noticed and not done

- `admin-analytics.ts` is 609 lines and `chatbot/analytics.ts` is 1,258. Both
  are over the 800-line guidance in the coding-style rules.
- The `capped` flag returned by `readAllRows` is logged but never surfaced in
  the UI. A truncated total still renders as if it were complete; it should say
  so on the page.
- `paged-read.ts` sets both ceilings to 50,000. Nothing tests what happens at
  the ceiling itself, only at the page boundary.

---

> Reflection: checking the row count before writing the chatbot diagnosis was
> worth the one query — the obvious story (same 1,000-row cap) was wrong, and
> 138 rows rules it out entirely · evolve: two production bugs in two days came
> from the same PostgREST cap, so a repo-wide sweep for `.limit(` with a value
> above 1,000 and for `.select(` with no paging is overdue.
