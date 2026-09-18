# Funnel + channel conversion tracking — handoff

**Date:** 2026-09-18 · **Repo:** `~/vending-website` · **Branch:** `main`
**Shipped today:** `a180666` (Funnels tab + frozen baseline), `bf3d535` (pivot + Journeys tab)

Paste this whole file into a fresh session. It is self-contained.

---

## 0. What already exists — do not rebuild any of it

Three reporting surfaces answer three different questions. They share one
definition of a lead, a channel and a booked call, and they must keep sharing it.

| Surface            | Question                                    | Where                                                   |
| ------------------ | ------------------------------------------- | ------------------------------------------------------- |
| **Channels** tab   | which traffic source converts               | `channel-report.ts`, `channel-report-rollup.ts`         |
| **Funnels** tab    | which page converts, month over month       | `funnel-monthly.ts`, `FunnelMonthlyPanel.tsx`           |
| **Journeys** tab   | which step in which channel's journey leaks | `channel-journeys-report.ts`, `ChannelJourneyPanel.tsx` |
| **Funnel map** tab | the aggregate spine, cohort-correct         | `funnel-map.ts`, `funnel-cohort.ts`                     |
| **KPI** tab        | Adam's Lead Gen KPI Framework               | `kpi-report.ts`                                         |

Shared definitions — change these in ONE place or the tabs will disagree:

- `resolveChannel(utm_source, {medium, capturedByChatbot})` — `src/lib/analytics/channel.ts`.
  The single canonical raw-tag → channel mapping.
- `resolveGa4Channel(utm_source, utm_campaign)` — same file. `ga4_page_views` has
  **no medium column**, so this is how a paid google session is told from an
  organic one (GA4 writes campaign `(organic)` for organic).
- `canonicalFunnelPath(path)` — `src/lib/services/funnel-monthly.ts`. Strips query,
  lowercases, strips trailing slash, folds retired URLs through `FUNNEL_REDIRECTS`.
  **Import it; never write a second copy.** It is the join key between GA4's
  landing page, our `source_path`, and anything PostHog stamps client-side.
- `classifyBookedCall(email, showByEmail, today)` — same file. held / noShow /
  pending / unlogged, plus closeable. The only definition of "showed up".
- `SHOW_GRACE_DAYS = 1`, `CLOSE_MATURITY_DAYS = 30` — `funnel-cohort.ts`. See item 4.

Standing rules the whole stack obeys. Break one and the number becomes a lie:

1. **Never turn missing into zero.** A denominator of 0 returns `null`, rendered
   as a dash. `0.0%` means observed-and-zero.
2. **Both sides of a division must be the same population, measured by the same
   instrument.** Platform impressions, GA4 sessions, webinar registrations and
   our own lead table are four instruments. Rates across two are marked
   `crossSystem`, greyed, and dropped above 100%.
3. **Lead cohort, not calendar month.** A row's month is the month the LEAD
   arrived; their booking, call and sale count there whenever they happened.
4. **GA4 lags ~1 day.** Every visit-denominated rate is clipped to GA4's last
   reported day on BOTH sides. `FunnelPeriod.visitsEnd` says where it stops.

---

## The six jobs

### 1. Fill the marketing link registry — the biggest limit on everything

**Evidence.** `marketing_links` contains **one row**. Consequently
`channel_daily.destination` is `unknown` on **992 of 1,000** rows over the last
30 days (`webinar-register` 3 rows, `book-call` 5 rows, `unknown` 992). Because
`destination` comes from `utm_term` via `resolveDestination`, channel × page ×
CTA collapses and no report can recover it.

**This is mostly not a code job.** The builder already exists at `/admin/links`
and the standard is `docs/marketing/link-standard.md`. What is needed:

- Every live ad, post, bio link, email and DM link rebuilt through `/admin/links`
  so it carries the closed-list `utm_term` (the destination).
- Owners: Kody (site/paid), Mike and Anthony (social + newsletter), Stephen (Close/outbound).

**What code CAN do, and should:**

- A coverage report: for the last 30 days, how many leads/visits arrived on a
  link that is in `marketing_links` versus not, broken down by channel, with the
  untagged links listed so there is a worklist. Put it on the Journeys tab or a
  small `/admin/links/coverage` page.
- **Adam's rule: never infer a destination from the landing page.** An untagged
  link stays `unknown`. The report names it; it does not guess it.

**Done when** the coverage report exists and shows the untagged worklist, and
Adam has a list he can hand to four people.

---

### 2. GHL form leads have been zero since 2026-08-25

**Evidence.** `channel_daily` rows with `source = ghl_form`:
July 57 leads, August 27 leads, **September 0**. Last day with any: `2026-08-25`.
The `ghl-forms` connector still runs daily and succeeds — last run 2026-09-18
11:20, 7 rows written, no error. So it is writing rows that carry no leads.

**Two possible truths, and they need separating before anything is changed:**

1. GHL form submissions genuinely stopped on 25 Aug (a form was unpublished, a
   funnel was retired, a campaign ended).
2. The connector's mapping broke — a form name changed, the registration-form
   skip regex (`/webinar/i` in `ghl-sync.ts` `FORM_ROUTES`) started matching
   everything, or the API shape moved.

**How to tell them apart:** call the GHL API directly for form submissions in
September and compare the raw count to what the connector wrote. If GHL returns
submissions and we wrote zero, it is us. If GHL returns nothing, it is them and
the fix is a conversation, not a commit.

**Do not** "fix" this by back-filling or by loosening the skip regex until you
know which of the two it is.

**Done when** the cause is named with evidence, and either the connector is
fixed with a regression test, or a note in `AGENTS.md` records that GHL forms
legitimately stopped and when.

---

### 3. Kody confirms the channel journey map

**The file is `src/lib/content/channel-journeys.ts`.** It is a hand-written
registry: one lane per channel, ordered steps, and which real pages belong to
each step. No data source knows the step order — that is marketing's knowledge.
It mirrors the Q4 Marketing Channel Maps FigJam board.

I drafted it from the board plus the real `utm_source → source_path` pairs. It
is a first pass and parts of it are certainly wrong.

**Known open questions for Kody:**

- **Webinar lane** — is `/start` still the only booking destination the webinar
  sends to? The lane shows 282 visits and 3 leads over 30 days, a 1.1% opt-in,
  which is either a real catastrophe or a missing page.
- **Google Ads lane** — I declared `/contact` + `/`. Real data shows 20 more
  Google Ads leads on `/booking-youtube` (6), `/about` (5), `/news` (4),
  `/case-studies` (2). Are those intended destinations or leaks?
- **Website lane** — 24 off-map leads on `/resources/roadmap` (8),
  `/newsletter` (4), `/vending-business-blueprint` (3). Are the lead magnets
  part of the website journey or their own lane?
- **Marketing Reactivation** — it is a lane on the FigJam and has no lane here.
  In Close it is the biggest funnel (`Reactivation Scrapers`, 563 rows since
  July). It has no site pages, so decide what its steps even are.
- **Is the step order right** for each lane, and are there DM/Email steps
  between pages that we are not modelling?

**The tab tells you when the map is stale** — leads on a page a lane does not
declare are listed beside it, and channels no lane claims are named at the
bottom. Use those two lists as the correction worklist.

**Done when** Kody has signed off lane by lane and the off-map lists are small
and explained.

---

### 4. Confirm the close-maturity and show-grace windows

**`CLOSE_MATURITY_DAYS = 30` and `SHOW_GRACE_DAYS = 1` in `funnel-cohort.ts`
are invented numbers.** The comment in the file says so. They gate:

- **Win %** on the Funnels tab and the Journeys tab — a held call only enters
  the close-rate denominator once it is this old.
- The Funnel map's close rate, which is permanently unavailable at a 30-day
  range because nothing is ever mature inside it.

**Get the real numbers from Dom or Adam:** how many days after a call is held
should we conclude it is not going to close? And how long after a call's
scheduled date should a rep have logged whether it happened?

**Then** change the two constants, and check the transition: changing a rate's
denominator rule can turn an honest dash into a plausible wrong number. There
is precedent — see the opt-in fix in `.claude/specs/2026-09-11-unified-channels-handoff-5.md`.

**Done when** both constants carry a comment naming who decided them and when,
and `MATURITY_RULE`'s "provisional" wording is removed.

---

### 5. Make Meta Ads traffic attributable

**The problem.** `ga4_page_views` has no `utm_medium`. For Google, GA4 writes
campaign `(organic)` on organic sessions, so `resolveGa4Channel` can separate
Google Ads from Organic search — that fix took Google Ads from **0 visits** to
**4,716** and a 2.0% opt-in.

**Meta has no such marker.** An Instagram bio link (`link-in-bio`) and an
Instagram ad campaign (`ltf_buyers`, `retargeting-lost-crm`, `website_90`,
`VP-Masterclass`) look identical on that table. I deliberately did NOT guess —
guessing trades a visible gap for an invisible error. So the Meta Ads lane
currently reads 50,860 impressions, 805 clicks, **2 visits**.

**The fix is upstream, not in code.** Meta ad links must carry a medium that
marks them paid (`utm_medium=paid_social`, per `PAID_MEDIUM` in `channel.ts`)
AND a campaign that is distinguishable from organic. Today only **1** lead in
30 days carries `instagram/paid_social`; 116 carry `google/cpc`.

**Then in code:** extend `resolveGa4Channel` to treat the Meta sources as paid
when the campaign matches the ad-campaign naming the team agrees on, with tests
covering both the paid and the bio-link case. Do not ship the code before the
tagging convention is agreed, or it will mislabel organic Instagram.

**Done when** Meta ad links are tagged, `resolveGa4Channel` handles them, and
the Meta Ads lane shows a visit count in the same order as its click count.

---

### 6. Decide one definition of "Webinar lead"

**Today there are two, and both are defensible:**

- **Channels tab: 4,024 Webinar leads / 30 days.** The webinar connector counts
  a _registration_ as a lead. Reasonable — a registration is a captured person.
- **Journeys tab: 3 Webinar leads / 30 days.** Counts rows in `lead_submissions`
  captured on `/start`. Also reasonable — that is a form submission on our site.

Side by side they read as a bug. They are not; they are two different things
wearing one word. Adam saw the Channels tab's Webinar **Book % of 272.7%**,
which is the same collision: 148 bookings measured against the tiny paired
subset of links where both sides were observed.

**What to do:**

- Pick the canonical meaning of "lead" for the Webinar channel and label the
  other one something else (**Registrations**) everywhere it appears.
- Fix the Channels tab's paired-population rates while you are there. Webinar
  272.7% and LinkedIn 112.5% are the visible symptom of dividing a numerator
  from the full population by a denominator from the paired subset. The pattern
  to copy is `ofVisitsPct` in `channel-report-rollup.ts`, which already solved
  exactly this for opt-in rates — and the `<50% coverage returns null` guard
  that stops it printing a confident wrong number during the transition.

**Done when** no rate anywhere on the admin exceeds 100% unless both sides
genuinely come from our own tables, and "Webinar leads" means one thing.

---

## Also outstanding (smaller, do after the six)

- **Pre-submit form abandonment is still untracked by the server.** No row is
  written until consent + first submit, so someone who types and leaves is
  invisible. A parallel session is wiring **PostHog** to close exactly this —
  see `.claude/specs/2026-09-18-posthog-conversion-tracking.md`. The seam is
  `vp_session_id`, and PostHog must fold paths with the SAME
  `canonicalFunnelPath`. Do not let a second copy of that function exist.
- **That PostHog change replaces Sentry in `src/instrumentation-client.ts`.**
  Confirm with Adam that losing client error reporting is intended.
- **Re-run the baseline at month end:** `node scripts/funnel-baseline-snapshot.mjs`.
  The tab recomputes live and drifts as Close reconciles; the dated file is the
  record. `docs/marketing/funnel-baseline-2026-09-18.md` is the first one.
- **Nobody has eyeballed the Funnels or Journeys tabs rendered.** Every check so
  far was types, tests, and the report run against production data. Open
  `/admin/analytics?tab=journeys` and `?tab=funnels&group=channel` and look.
- **`ga4-visits` last run reported "9 rows failed to write".** Small, but it
  silently shortens a denominator.
- Only **August 2026** is a complete month of lead history (site cut over
  2026-07-27), so monthly trends are thin until October.

---

## Repo gotchas that will cost you time

- **This repo is npm, not pnpm.** `pnpm exec` / `npx` trigger a failing install.
  Run `./node_modules/.bin/{tsc,vitest,eslint,next,prettier}` directly.
  `pnpm-lock.yaml` and `pnpm-workspace.yaml` at the root are not ours.
- **`pnpm dev` fails** (`ERR_PNPM_IGNORED_BUILDS`). Use `./node_modules/.bin/next dev -p <port>`.
- **A push to `main` publishes to www.vendingpreneurs.com in ~1 minute.** There
  is no staging. Deploy by merging to main, never `vercel --prod` from a tree.
- **Admin login blocks localhost.** The only real check is a preview deploy.
- **`curl` against a page returns a ~600-byte shell**, not content — pages stream
  through a root `loading.tsx` Suspense boundary. Use Playwright for rendered
  DOM; curl is still right for headers and redirects.
- **Another session may be editing this checkout.** It happened today: a module
  was extracted and then deleted mid-refactor, breaking imports. Re-check
  `git status` immediately before staging, and stage files explicitly.
- **`rtk` mangles output** containing parens or alternation, and mangles
  `git diff`. Use `/usr/bin/grep`, `/usr/bin/git`, `/usr/bin/head` for anything
  whose output you reason about. `/usr/bin/cat` does not exist; use `/bin/cat`.
- **A node script that imports app modules** must load `.env.local` into
  `process.env` BEFORE the import (`src/lib/config.ts` validates on load) and
  alias `server-only` to `vitest.server-only-shim.ts`. `jiti` is the only TS
  runner installed — there is no tsx or esbuild. See
  `scripts/funnel-baseline-snapshot.mjs` for the working pattern.
- **Querying production read-only** is the fastest way to check a claim:
  `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`,
  PostgREST, `Range` header to page past the 1,000-row cap.

## Verification standard

`./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run`,
`./node_modules/.bin/next build`, `./node_modules/.bin/eslint src`. Then run the
changed report against **live production data** and read the output critically —
every real defect found today (Google Ads 0 visits, LinkedIn 0 visits, the 148%
rate, the empty link registry) was found that way and none of them by a test.
