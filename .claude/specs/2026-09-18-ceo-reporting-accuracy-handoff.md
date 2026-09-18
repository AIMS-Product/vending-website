# Make the analytics CEO-ready — handoff

**Date:** 2026-09-18 · **Repo:** `~/vending-website` · **Branch:** `main`
**Shipped today:** `6801cbc` (GHL finding), `1d263d2` (link coverage), `0dcf6f0` (all
funnel metrics at once + channel marks), `c4cb5ef` (rate honesty + Webinar naming)

Paste this whole file into a fresh session. It is self-contained.

**The goal has changed.** Until today the job was to build the surfaces. Now the
job is to make them true enough to put in front of the CEO, and to add one view
that answers "are we improving" without anyone reading a pivot table.

---

## 0. The rules that keep a number honest — do not break these

Carried forward from the 2026-09-18 funnel-tracking handoff. They still hold.

Shared definitions — change in ONE place or the tabs disagree:

- `resolveChannel(utm_source, {medium, capturedByChatbot})` — `src/lib/analytics/channel.ts`
- `resolveGa4Channel(utm_source, utm_campaign)` — same file. `ga4_page_views` has
  **no medium column**; this is how a paid google session is told from organic.
- `canonicalFunnelPath(path)` — `src/lib/services/funnel-monthly.ts`. The join key
  between GA4's landing page, our `source_path`, and anything PostHog stamps.
  **Import it; never write a second copy.**
- `classifyBookedCall(email, showByEmail, today)` — same file.
- `ofObservedPct` / `ofVisitsPct` — `src/lib/services/channel-report-rollup.ts`.
  The denominator is every row that observed it; a denominator-day that converted
  nobody counts as the zero it was.
- `SHOW_GRACE_DAYS = 1`, `CLOSE_MATURITY_DAYS = 30` — `funnel-cohort.ts`. Still
  invented numbers. Dom/Adam never answered; see job E.

The four standing rules:

1. **Never turn missing into zero.** A denominator of 0 returns `null`, rendered
   as a dash. `0.0%` means observed-and-zero.
2. **Both sides of a division must be the same population, measured by the same
   instrument.** Platform impressions, GA4 sessions, webinar registrations and
   our own lead table are four instruments. Cross-instrument rates are marked
   `crossSystem`, greyed, and **dropped above 100%**.
3. **Lead cohort, not calendar month.** A row's month is the month the LEAD
   arrived; their booking, call and sale count there whenever they happened.
4. **GA4 lags ~1 day.** Every visit-denominated rate is clipped to GA4's last
   reported day on BOTH sides. `FunnelPeriod.visitsEnd` says where it stops.

**The verification standard, which found every real defect so far:** run the
report against **live production data** and read the output critically. Not one
of the defects found on 2026-09-18 came from a test. Production is reachable
read-only with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from
`.env.local` over PostgREST, `Range` header to page past the 1,000-row cap.

---

## Job A — the July denominator, and why the CEO must not see this yet

**This is the one that would embarrass us, and it is unverified. Do it first.**

The site cut over to this app on **2026-07-27**. `lead_submissions` therefore
holds roughly **four days** of July. But `ga4_page_views` was collecting for the
whole month, because GA4 was tracking the previous site too.

So on the Funnels tab, July's opt-in is four days of leads divided by
thirty-one days of visits. Observed on screen: `/` shows July **0.5%** opt-in
(29 leads / 6,254 visits) against August **3.5%** (183 / 5,212).

If that reading is right, **the headline "opt-in improved 7x since July" is
mostly an artifact of a short numerator**, and it is exactly the sort of number a
CEO repeats in a board meeting.

**What to do:**

- Confirm the first `lead_submissions.created_at` and compare it to the first
  `ga4_page_views.day`. Establish exactly how many days of July have leads.
- Decide the fix. Options, in the order I would consider them:
  1. Clip July's visit denominator to the same days the leads cover — the same
     trick rule 4 already applies at the GA4 end (`visitsEnd`). This is the
     honest one and reuses machinery that exists.
  2. Suppress July entirely and start the trend at August, with a line saying
     why.
  3. Show July but mark it partial and refuse to print its rates.
- Whatever you pick, `docs/marketing/funnel-baseline-2026-09-18.md` was frozen
  against the current arithmetic. Re-run `node scripts/funnel-baseline-snapshot.mjs`
  after the change and say in the file that the baseline moved and why.

**Do not** simply delete July. Losing the only pre-cutover comparison to avoid
explaining it is how a dashboard becomes decoration.

---

## Job B — the gaps, named one at a time

The Journeys tab is full of dashes and zeros. They are not all the same thing,
and a CEO cannot tell them apart. Each one below is either a real bug, a known
upstream gap, or correct-and-needs-a-caption. **Classify every one before
changing any of them.**

Read against the 30-day window ending 2026-09-18.

### B1. Google Ads shows VISITED 0 against LEAD 96 — almost certainly a bug

The Journeys lane prints **Visited 0** for Google Ads, yet the Funnels tab shows
`/contact` → Google Ads with **2,560 visits in September** and 2,560 again in
August. The visits exist in `ga4_page_views`; the lane is not finding them.

The Google Ads lane declares `paths: ["/contact", "/"]`. Suspects, in order:

- `resolveGa4Channel` is classifying those sessions as Organic search rather
  than Google Ads in the journeys path, while the funnels path classifies them
  correctly. The two tabs call different resolvers — check which.
- The lane's paths are not being folded through `canonicalFunnelPath` before
  matching, so `/contact` with a query string misses.
- GA4 keys visits on the campaign NAME while the links carry the numeric
  campaign id (`23805931083`). This exact mismatch is why `MIN_COVERAGE` exists
  in `channel-report-rollup.ts`. It may be biting here too.

**This one matters most** because Google Ads is money and the lane currently
reads as though paid search sends nobody to the site.

### B2. Webinar still shows LEAD 3 under a column called LEAD

Adam ruled on 2026-09-18: **a Webinar lead IS a registration.** Commit `c4cb5ef`
relabelled the Webinar lane's step from "Lead" to "/start form" — but the
Journeys tab lays every lane against one **fixed band axis**, and that axis's
column is still headed `LEAD`. So the 3 still sits under a column that says
LEAD, next to a Registered column showing 4,036.

The rename did not reach the thing the reader actually sees. **Finish it:** for
the Webinar lane the Lead band should carry the registration count (4,036), and
the `/start` form submissions should appear as their own step or not in that
band at all. Check `bandOf()` and `JOURNEY_BANDS` in
`channel-journeys-report.ts`.

### B3. Instagram: 2,552,132 impressions → 144 visits (0.0%)

LinkedIn: 363,941 → 17. Meta Ads: 50,860 seen, 805 clicked, **2 visits**.

This is the known Meta attribution gap — job 5 of the previous handoff, never
shipped on purpose. `ga4_page_views` has no `utm_medium`, so an Instagram bio
link and an Instagram ad campaign are indistinguishable there, and
`resolveGa4Channel` deliberately refuses to guess.

**The fix is upstream, not in code.** Meta ad links must carry
`utm_medium=paid_social` and a campaign name distinguishable from organic. Only
**1** lead in 30 days carries `instagram/paid_social`; 116 carry `google/cpc`.

**Do not ship the code before the tagging convention is agreed** — it would
relabel organic Instagram as paid, which is worse than the visible gap. But
**do** add a caption to those cells saying the visit count is known-incomplete,
because a CEO reading 2.5M impressions against 144 visits will conclude
Instagram is worthless, and that conclusion is not supported.

### B4. The rest, to classify

| Cell                                           | Reading             | Likely truth                                                                  |
| ---------------------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| Webinar SHOWED 0, WON —                        | 2 booked, 0 showed  | Check against Close; 2 is too thin to report                                  |
| Instagram QUALIFIED —                          | 55 leads, 45 booked | Social landers take 3 fields and skip the quiz — **correct, needs a caption** |
| Chatbot VISITED —                              | 51 leads, no visits | Chatbot leads arrive mid-conversation with no landing session — **correct**   |
| YouTube CLICKED blank                          | 134,126 seen        | No click connector for YouTube — **correct, needs a caption**                 |
| Google Ads REGISTERED blank                    | —                   | No registration step in that lane — **correct**                               |
| Newsletter VISITED 185 > CLICKED 125           |                     | Cross-instrument (Bitly vs GA4). Rule 2 territory                             |
| `/booking-meta` Aug: 44 leads, 0 visits        |                     | Same Meta gap as B3                                                           |
| "Not on the map": Internal Ltf 2, Trustpilot 1 |                     | Add lanes or fold them                                                        |

**The deliverable for job B is not "fewer dashes."** It is that every remaining
dash has a one-line reason a non-technical reader can accept, and that no dash
is hiding a bug. A dash that means "our tagging is broken" and a dash that means
"this step does not exist in this funnel" must not look the same.

---

## Job C — the executive rollup (what Adam actually asked for)

> "It would be cool to see all of these sources, pages, and channels aggregated
> together to then simply show how these are improving month over month."

Today there are five tabs and a pivot table. None of them answers "are we
getting better" in one screen.

**Build one view.** Suggested shape, but the shape is yours to argue with:

- **One row per month**, most recent first. Not per channel, not per page —
  those are the drill-down, and they already exist.
- Columns: Visits · Leads · Opt-in % · Booked · Book % · Showed · Show % ·
  Won · Revenue · Cost per lead. The whole funnel, one line per month.
- Under it, the same months broken out by channel and by page — collapsed by
  default. The existing Funnels tab already computes both groupings; reuse
  `funnel-monthly.ts` rather than writing a third rollup.
- Month-over-month change per cell, using the existing colour rules (`MIN_WEIGHT`
  8 observations, `FLAT_BAND` 5%) so a thin month is not coloured. Those
  thresholds already exist in `FunnelMonthlyPanel.tsx` — import, do not redefine.

**Constraints that are not negotiable:**

- Rule 3: a month is the month the **lead** arrived. A sale in September from a
  July lead counts in July. This is already how `funnel-monthly.ts` works, and
  it is the single most common thing a new report gets wrong.
- Rule 1: a dash is not a zero, in the aggregate exactly as in the detail.
- Only **August 2026** is a complete month of lead history until October, and
  July is the partial one job A is about. Whatever job A decides, this view must
  honour it — this is the view the CEO will actually read.

---

## Job D — verify the numbers against the sources, not against the code

The report has never been checked against anything but itself. Before the CEO
sees it, reconcile each headline number to the system that owns it:

- **Leads** → count `lead_submissions` directly for the window. Should match the
  tab exactly. Any gap is a filter nobody documented.
- **Booked / Showed / Won / Revenue** → reconcile to Close. `close_lead_funnel`
  is the mirror. Revenue figures like $114,832 in August need to match Close's
  own number or the CEO will find the difference.
- **Visits** → GA4 UI for the same window. Expect a small gap; document it.
  Note **7.8% of GA4 sessions in the last 30 days (1,064 of 13,666) have an
  empty `landing_page`** and cannot join to any page row. That loss is invisible
  today and shortens every page-level denominator.
- **Webinar registrations** → the webinar receiver's own count.
- **`ga4-visits` last run reported "9 rows failed to write."** Small, silent, and
  it shortens a denominator. Find out why.

Write the reconciliation into `docs/marketing/` as a dated file with the real
numbers, the way the funnel baseline was done. If a number cannot be reconciled,
say so in the doc rather than quietly shipping it.

---

## Job E — still blocked on people

- **Close-maturity / show-grace windows.** `CLOSE_MATURITY_DAYS = 30` and
  `SHOW_GRACE_DAYS = 1` are invented. They gate Win % everywhere. Dom or Adam
  must say: how many days after a held call is it not closing, and how long
  before a rep must have logged whether it happened. When answered, change the
  constants, add a comment naming who decided and when, remove `MATURITY_RULE`'s
  "provisional" wording, and check the transition — changing a denominator rule
  can turn an honest dash into a plausible wrong number.
- **The channel journey map.** `src/lib/content/channel-journeys.ts` is a
  hand-written registry mirroring the Q4 FigJam board. Kody has not signed it
  off lane by lane. The tab's "not on the map" list is the correction worklist.
- **Meta tagging convention** — see B3.

---

## Also outstanding

- **Link registry is still one row.** `/admin/links/coverage` (shipped today)
  shows **9 of 396 tagged leads** arrived on a registered link. YouTube (158
  leads), Google Ads (122) and Instagram (63) are at 0%. 70 distinct untracked
  links carry 387 leads. Owners: Kody (site/paid), Mike and Anthony (social +
  newsletter), Stephen (Close/outbound). Until this is filled,
  `channel_daily.destination` stays `unknown` on ~99% of rows and channel × page
  × CTA cannot be recovered by any report.
- **Setter links put the destination in the campaign slot** —
  `mike-ig/setter/book-call` (52 leads) has `book-call` as `utm_campaign`, not
  `utm_term`. Tell Kody; it is a tagging fix, not a code fix.
- **PostHog is being wired in a separate session.** Decide which first-party
  page-view stream is canonical: `lead_page_views` already exists and is live
  (2,559 rows in 30 days, keyed on `vp_session_id`, but **only stores views
  carrying a `utm_campaign`**). PostHog will produce nearly the same stream with
  a different filter. Two first-party page-view counts with different filters
  will eventually be divided by each other. **Decide before it ships.**
  PostHog will NOT match GA4 (different blocking, session definitions, bot
  filtering) and should not be made to. The one pair that should match is
  PostHog's submit event vs `lead_submissions` — a gap there is a tracking bug.
- **GSC is not in this repo at all.** No table, nothing reads it. When wired, it
  belongs in the reach bands (`REACH_STAGES`, "Seen"/"Clicked") beside Metricool
  and YouTube, never in the site funnel — it measures the results page, upstream
  of the site, with no UTMs and no session identity.
- **`thankyou_visits` is in the generated DB types but not in production.** A
  query selecting it 400s. A migration is unapplied.
- **Nobody has eyeballed the Channels, KPI, Funnel map or Booked calls tabs**
  since today's rate change. `ofObservedPct` altered Book % and Win % on every
  surface that reads `channel-report-rollup.ts`.

---

## Repo gotchas that will cost you time

- **This repo is npm, not pnpm.** `pnpm exec` / `npx` trigger a failing install.
  Run `./node_modules/.bin/{tsc,vitest,eslint,next,prettier}` directly.
  `pnpm-lock.yaml` and `pnpm-workspace.yaml` at the root are not ours — leave
  them untracked.
- **A push to `main` publishes to www.vendingpreneurs.com in ~1 minute.** No
  staging. Deploy by merging to main, never `vercel --prod` from a tree.
- **Admin login blocks localhost.** Production or a preview deploy is the only
  real check.
- **`curl` against a page returns a ~600-byte shell.** Pages stream through a
  root `loading.tsx` Suspense boundary. Every `/admin/*` path 307s to login
  whether or not the route exists, so a 307 proves nothing about deployment.
- **A node script importing app modules** must load `.env.local` into
  `process.env` BEFORE the import (`src/lib/config.ts` validates on load) and
  alias `server-only` to `vitest.server-only-shim.ts`. `jiti` is the only TS
  runner installed. See `scripts/funnel-baseline-snapshot.mjs`.
- **`rtk` mangles output** containing parens or alternation, and mangles
  `git diff`. Use `/usr/bin/grep`, `/usr/bin/git`, `/usr/bin/head` for anything
  whose output you reason about. `/usr/bin/cat` does not exist; use `/bin/cat`.
- **Another session may be editing this checkout.** Re-check `git status`
  immediately before staging, and stage files explicitly.
- **`viewer-access.ts` + `viewer-access.test.ts` are a deliberate pair.** A new
  admin page must be added to both lists or the guard test fails. That is the
  design, not an obstacle.

## Verification standard

`./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run`,
`./node_modules/.bin/next build`, `./node_modules/.bin/eslint src`. Then run the
changed report against **live production data** and read the output critically.
One pre-existing lint error in `src/lib/booking/post-booking-redirect.ts` (an
eslint rule name that no longer exists) is unrelated to this work.

**Current baseline: 2,609 tests passing, types clean, build green.**
