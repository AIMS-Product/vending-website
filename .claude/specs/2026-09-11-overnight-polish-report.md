# Overnight polish report — YouTube attribution + GA4

Run 2026-09-10 into 2026-09-11, unattended, from
`.claude/specs/2026-09-10-overnight-polish-handoff.md`.
Branch `fix/youtube-attribution-polish`, one draft PR. Nothing merged, nothing
deployed, nothing written to the database.

---

## The three lines

1. **Ready to merge:** 20 commits. The first 12 close every open item from the
   YouTube attribution review; the last 8 fix what a code review and a security
   review then found in those 12 — two HIGH, three MEDIUM and seven LOW. Suite
   260 files / **2,191 tests** green (from 256 / 2,097 at the start of the run),
   typecheck clean, production build clean.
2. **Adam must do:** review and merge the PR, and **apply one migration** — a
   new index, listed below. Two decisions were taken without you, both marked.
   One thing still needs a real Bitly token to confirm. Nothing else is
   blocking.
3. **Blocked:** nothing. One item was skipped on purpose (the `CRON_SECRET`
   minimum length), and both the dev server and the production build have to run
   with `--webpack` in this worktree — see "Two environment notes".

---

## The second pass: what the two reviews found in the first pass

This is the part that is new since the run was interrupted. A code review and a
security review both ran against `origin/main..HEAD`. Every finding below had a
test written first that failed for the right reason, then the fix.

### Two HIGH

**The funnel could still render over 100%.** The first pass made a won lead
count as booked, so booked could never fall below closed. But the attended count
still subtracted the no-show and cancelled labels unconditionally, while the
closed count counted wins unconditionally — so attended could drop below closed
and the bottom stage rendered as 200% of the one above it.

It takes two leads to see it, which is why the monotonicity test written in the
first pass could not: it used one. One lead booked and won, one lead whose
appointment says "canceled" but which carries a won date. That is booked 2,
attended 1, closed 2.

A win now counts as attended, for the same reason it counts as booked: the sale
happened, so the call happened. The label on the appointment was either never
cleared or the call was rebooked. `6d669fc`, 2 new tests.

**The fail-closed rate limiter was scoped far too wide.** The handoff asked for
the page-view branch only. Commit `07bbaa0` instead fail-closed the whole
`attribution_event` action — and that action is checked at the top of the events
route, before the money-page forward and before the popup counter. So a limiter
blip would have 429'd every attribution event on the site, which is the opposite
of the trade the change was meant to make (a dropped analytics row costs
nothing; a dropped forward costs attribution).

Three things fixed together (`8e30e99`, 10 new tests):

- The landing-view write has its own action and its own budget now, checked only
  on the branch that writes. The event gate is fail-open again.
- The docstring still said "Fails OPEN" after the change made that untrue.
- The four schema codes — `42P01`, `42703`, `PGRST204`, `PGRST205` — now fail
  **open** even for a fail-closed action. The hits table's migration is applied
  by hand, so "not deployed yet" is a real state, and refusing every page view
  until somebody runs a migration is an outage dressed up as a safety measure. A
  statement timeout still refuses.

### Three MEDIUM

**The clicks window probe was scanning the whole table on every render, and its
comment said the opposite.** The probe reads the earliest synced day, ordering on
`day` alone. The primary key is `(bitly_id, day)`, so it cannot serve that, and
the campaign index is partial on a non-null campaign so it cannot answer for the
whole table. Sequential scan plus a sort, every time anyone opened the tab. The
comment claimed it used the primary key. There is now a migration for you to
apply, and the comment is honest. `0393bb7`.

**One permanently broken short link would have pinned the Bitly cron at 500
forever.** The validation added in the first pass throws on a malformed stored
id, the worker caught that as a failure, and the runner turns any failure into a 500. So one bad row would page the cron every night for a data problem no retry
can fix — and because the row kept its old sync timestamp, it also sat at the
front of the claim queue crowding out links that work.

Malformed ids now have their own count, separate from failures. They are refused
before the request, logged with the campaign name, and stamped so they rotate to
the back of the queue. The runner needed no change: it keys on the failure count,
which now means only what the next run can actually retry. `adcbcd3`, 3 new
tests.

**The bitlink validator accepted `..`** — a real path-traversal hole, and the
worst thing either review found. `"../users"` has exactly one slash, so it looked
like "domain/hash", passed the pattern, and the request path folded to
`/v4/users/clicks`: a different Bitly endpoint, reached carrying our own bearer
token. The existing reject list only covered the multi-slash spelling, which the
slash count already caught.

The two halves are validated separately now, and every domain label has to start
and end on a letter or digit — so no label can be empty or a bare dot.
`3421600`, 11 new rejected shapes covered.

### Seven LOW

| What was wrong                                                                      | Commit    |
| ----------------------------------------------------------------------------------- | --------- |
| The clicks-window test stayed green if you deleted the query's date filter          | `4fed5a0` |
| The "booked count when outcomes are not connected" test could never fail            | `49c90c8` |
| "Won later" printed wins dated **before** the cohort month                          | `4fed5a0` |
| The import script's failure message named a row index that pointed at nothing       | `4fed5a0` |
| A transient clicks failure rendered as "needs a Bitly token"                        | `7f635c7` |
| The Bitly worker swallowed the new validation error with no log at all              | `adcbcd3` |
| A GA4 route test called "leaks nothing" never looked at the log, where the leak was | `4fed5a0` |

Three of those are worth a sentence each:

- **The test mock was lying.** It recorded the `gte("day", …)` filter and then
  ignored it, so the range bound on the clicks query was untested — you could
  delete it and the whole 2,100-test suite stayed green. The mock filters now,
  and I proved it by deleting the filter and watching the test go red. The
  window test's expected number changed from 10 to 5 as a result: 5 was always
  the right answer.
- **A test that cannot fail is worse than no test**, because it reads as
  coverage. The booked-count one passed a lead with all three outcome columns
  null, so it proved nothing about what the code does with them. It sets them
  now — and that turned up a real gap: nothing stopped a win we could not
  measure from raising the booked count while the two stages below it read
  "unmeasured". The columns are cleared once at the boundary instead.
- **The GA4 log was the leak.** The test checked only the response body. A GA4
  auth failure's message can carry parts of the service-account key, and the
  route was logging it. It logs the error class only now, matching its Bitly
  sibling, and the test checks the log too.

---

## Two decisions taken without you

**Assumed a won lead counts as booked and attended — flag if wrong.**
Close reports some deals as won with no booking date behind them, and some with
an appointment still labelled cancelled. Counted literally, those land at the
bottom of the funnel and at neither stage above it, so the page renders
"200% continued from the step above", which is visibly broken. The alternative
was to drop those wins from the closed stage.

I inferred the call instead: a sale cannot happen without one, and dropping a
real win would understate the revenue this page exists to attribute. The cost is
that "Booked a call" here can read very slightly higher than the same figure on
the other analytics tabs, which count the booking date alone. **No production
number moved** — there are no YouTube leads in that state today, so this is a
guard rather than a change.

**Assumed the Bitly runner should report failure the way the GA4 one does —
flag if wrong.** The Bitly runner used to return HTTP 200 with `ok: true` even
when links failed, while the GA4 runner already returned 500. A cron reporting
green while links quietly stop syncing is exactly how the clicks table could sit
at zero rows with nobody noticing, so the Bitly runner now returns 500 when a
link failed.

The review then narrowed this, and the narrowing matters: it 500s only on
failures **the next run can retry** — a link that was unreachable, or a write
that errored. A stored id that is permanently malformed is counted separately
and does not page anyone, because no retry will ever fix it. Every write is an
upsert keyed by `(bitly_id, day)`, so a retry corrects rather than doubles. If
you would rather one dead link never page the cron at all, the line to change is
`ok = result.failed === 0` in the Bitly runner route.

---

## Migrations to apply

**One, and it is optional in the sense that nothing breaks without it.**

```
supabase/migrations/20260911120000_bitly_link_clicks_day_idx.sql
```

It adds an index on `bitly_link_clicks (day)`. Without it the YouTube tab still
shows the right numbers — the probe that needs it just scans the whole clicks
table and sorts, on every page load, against a table that grows one row per link
per day. Apply it when convenient. Hand it over with
`pbcopy < supabase/migrations/20260911120000_bitly_link_clicks_day_idx.sql`;
pasting long lines into a terminal truncates them.

Both migrations the original review listed as unapplied have since been applied.
A read-only probe during the run found `youtube_videos` 647 rows,
`bitly_link_clicks` 0 rows, `lead_page_views` 184 rows, `ga4_page_views` 16,330
rows, `lead_submissions` 956 rows, and the closed-won and call-outcome columns
all present.

42 of the 647 registry rows carry no Bitly id — exactly the rows the re-import
fix stops resetting.

---

## What the first pass did, task by task

| Task                                          | State              | Evidence                                                                                     |
| --------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| T1 browser QA, four ranges                    | done               | First time this tab has been driven. Table below. One finding, now fixed                     |
| T2 H7 only schema errors mean "not connected" | done               | `9ebbdb1`, 4 tests incl. a timeout on the visits read and on the outcome columns             |
| T3 H8 clicks window vs range                  | done               | `119a7ae`, 3 tests on both sides of the boundary                                             |
| T4 M9 funnel monotonicity                     | done, **decision** | `3ea040d`, then `6d669fc` when the review found the gap. See "Two decisions"                 |
| T4 M10 per-video clicks null                  | done               | `f570e93`, 4 tests                                                                           |
| T4 M11 cohort win column                      | done               | `f570e93`, 1 test: the two sub-columns always sum to the win count                           |
| T4 M12 coverage note wording                  | done               | `f7e49e4`, first test file for these panels, 6 tests                                         |
| T5 M13 re-import wipes Bitly ids              | done               | `f8fc562`, 6 tests, dry-run only. 42 of 647 rows were at risk — confirmed against production |
| T6 LOW items                                  | done / 1 skipped   | `dab027c`. See below                                                                         |
| T7 rate limiter fails closed for page views   | done, **re-done**  | `07bbaa0`, then `8e30e99` — the first version was scoped to the whole action                 |
| T8 Bitly bitlink validation                   | done, 1 open       | `e3ddb58`, then `3421600` for the `..` hole. Needs one live call                             |
| T9 GA4 read speed                             | done               | `e42ecf6`. 1-year 1.32–1.44s → 394–502ms                                                     |
| T10 route tests for both sync jobs            | done, **decision** | `4422504`, 19 tests                                                                          |
| T11 spec hygiene                              | done               | `77a2cd7`                                                                                    |
| T12 trim MEMORY.md                            | not done           | See the last section                                                                         |

### T6 in detail

- `daysBetween` returning −1 for an unparseable date: **already fixed** before
  this run, in the day-key work, and covered by two existing tests. No change
  needed.
- `(untagged)` in the missing-from-registry list: fixed (`f570e93`).
- Unused click-to-lead rate: deleted, as preferred.
- The click sync abandoning a worker's share on a null-id row: fixed.
- **`CRON_SECRET` minimum length: skipped on purpose**, per the handoff's
  rule 8. Production's value cannot be read from here, and if it is shorter than
  a new minimum, config parsing fails and the site goes down. Your call, with
  the value in front of you.

---

## Browser QA — the first look at this tab

Headless Chromium against `next dev` on production data, read-only. Screenshots
before and after in `.claude/specs/2026-09-11-polish-screens/`.

| Range | Visits | Leads | Booked | Attended | Won | Page load |
| ----- | ------ | ----- | ------ | -------- | --- | --------- |
| 7d    | 233    | 27    | 16     | 9        | 1   | 1.4–3.1s  |
| 30d   | 1,287  | 153   | 111    | 87       | 12  | 1.4–2.2s  |
| 90d   | 4,139  | 230   | 155    | 127      | 17  | 1.5–1.8s  |
| 1y    | 8,652  | 230   | 155    | 127      | 17  | 1.6–2.3s  |

- No console errors on any range.
- No percentage over 100% on any range.
- The coverage note reads "GA4 sessions by Pacific day", as expected.
- **The one bug the QA found: "Link clicks" rendered a hard `0`** on all four
  ranges. The clicks table exists but is empty, so the read succeeded and the
  stage was reported as measured-and-zero. It renders a dash now.

These numbers predate the second pass. The second pass changed no production
number: every fix in it is a guard against a state no YouTube lead is in today,
or a wording, log or test change.

### The 30-day total reads 1,287, not the 1,339 in the handoff

Not a regression, and nothing to fix. The window is rolling (now minus 30 days)
while the GA4 ingest runs at 3:40am Pacific for the last 3 days and GA4 itself
lags a day. So the oldest day drops out of the window before the newest day is
written, and the number drifts down between ingests. Verified against an
independent paged read: 1,287 exactly.

---

## GA4 read speed

Timed against production with a throwaway live check (deleted before any
commit), three runs each, before and after:

| Range   | Before        | After     |
| ------- | ------------- | --------- |
| 90 days | 600–831ms     | 269–331ms |
| 1 year  | 1,324–1,438ms | 394–502ms |

The 1-year range was 16 sequential 1,000-row pages, gaining a page every couple
of weeks. It now issues six at a time. Only the final batch over-reads, by at
most five empty pages, which is cheaper than the extra round trip it would take
to know the total up front.

Totals proven unchanged against an independent paged read on every range:
7d 233, 30d 1,287, 90d 4,139, 1y 8,652 sessions over 15,516 rows. A unit test
covers the batch boundary at 7,001 rows, where a wrong second-batch offset would
silently drop or double a page.

---

## Still open, for you

1. **One live Bitly call.** The path sends the slash unencoded, which is what
   Bitly's own example request does. No token exists in any environment, so this
   call has still never reached the real API. Confirm with one daily-clicks call
   once `BITLY_ACCESS_TOKEN` is set.
2. **`CRON_SECRET` minimum length**, skipped on purpose above.
3. **The index migration**, above.

The third item on the earlier version of this list — a permanently invalid short
link failing every run forever — is **fixed**, not open. See the MEDIUM section.

---

## Two environment notes

- **Both `next dev` and `next build` need `--webpack` in this worktree.**
  Turbopack refuses a symlinked `node_modules` that points outside the project
  root ("Symlink [project]/node_modules is invalid"), which is exactly the setup
  the handoff prescribes. `next build --webpack` exits 0 with no errors, and the
  Vercel preview build is the real check.
- Screenshots add about 4.6MB to the repo. Say the word and I will drop them.

---

## T12 — MEMORY.md

Still not done, and deliberately. MEMORY.md is over its load limit, so its last
lines never load. The handoff gates this task on everything else being finished
and context being low; the second pass consumed that budget. Shortening 149
index lines safely is a careful job better done where you can see it than as the
last act of an unattended run.

The single longest line by far is the Send More AI entry, which alone is about
3.3KB — moving its detail into that project's own topic file would put MEMORY.md
under the limit on its own.

---

## The PR

See the PR link in the session output. Draft, base `main`, not merged. The Vercel
check result is recorded there.

> Reflection: writing the failing test first paid twice over — the two-lead
> funnel case and the `..` bitlink were both invisible to the tests the first
> pass had written, and both only showed up once a test was made able to fail ·
> evolve: two of the seven LOW findings were tests that could not fail, so the
> gate should include deleting the line under test and checking the suite goes
> red, not just that it is green.
