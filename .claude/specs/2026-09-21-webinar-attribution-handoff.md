# Handoff — webinar attribution accuracy (2026-09-21)

Two repos: `~/vending-website` (vendingpreneurs.com/admin, the channel dashboard) and
`~/vp-webinars` (the webinar board + the sender that pushes into it).

## Shipped today, verified, live — do not redo

**vp-webinars** (`c068d28`, `b715811`)

- Sept 22 registered; `automation/roll_next_event.py` now writes the registry entry itself from Zoom's
  upcoming webinars, verifying GHL tag + pipeline + Close cohort live. Runs FIRST in `refresh_snapshots.py`.
- `event-registry.test.ts` fails if `zoom.json` holds a weekly-topic webinar with no registry entry.
- `NEXT_EVENT` derives from the newest weekly registry entry (was a hand-pinned `NEXT_DATE`).
- `zoom_pull.retain_expired()` keeps webinars Zoom has 404'd (June 16 `89024004879`).
- `CALENDLY_PAT` + `AVOMA_API_KEY` GitHub secrets set; both already wired in the workflow env.

**vending-website** (`f738bda`, `5ec28c5`)

- Book % denominator now `leads + contacts` (`bookedOfSignupsPct` in `channel-report-rollup.ts`).
  Was site-leads-only, which published **Webinar 300%**, VSL 200%, Instagram 84.8%.
- Webinar ad-set `showed`/`won` no longer written to `channel_daily` (`webinar-ingest.ts`). Verified
  cleared in prod: spine Webinar `showed` 57→3, `won` 1→0.

## The three open decisions — all the same family

A number that is correct for one question is being read as the answer to another.

### 1. Webinar Book % understates (0.7% vs a true ~3.6%), and `directBooked` lies (claims 119)

`channel-report-rollup.ts`. 119 of the Webinar channel's 146 bookings sit on night-of CTA rows
(`internal-webinar | during-night-of | <tag>_end_cta`) which carry no audience, so row-pairing drops them.
They are NOT walk-ins — every one came from a registration.

- Option A: totals-over-totals for Book %. Gives 3.6%. **Breaks the deliberate, tested rule that bookings
  with no lead stay out of Book %** (test: "keeps bookings without a lead out of Book %") and moves every
  channel. Do not do this without deciding that trade-off explicitly.
- Option B: source the Webinar row's outcomes from `webinar_events`. Contained to one channel, bigger change.
  `channel-report.ts` already fetches `webinar_events` (~line 403) for registrations.

### 2. Two legitimate "Won" counts that disagree, same label, no signpost

Both read Close `opportunity.status_type == 'won'`. Only the SCOPE differs.

- **Calls board** (vp-webinars, `call_deals.py` → `call-deals.json`): person was in the Zoom room and took a
  recorded call. Aug25/Sep1/Sep8/Sep15 = **4** (Aug 25 = 2). Board totals: 352 people, 15 won, 74 lost, 263 open.
- **Close tag cohort** (`close_events.py` → `close.json` → `webinar_events`): lead carries the event's
  `utm_content`. Same four = **2** (Aug 25 = 0).
- Proven cause, not speculation: the two Aug 25 winners are `lead_iM68XX…` and `lead_TNestF…`, both
  `utm_content = None`, funnel `Reactivation Scrapers`, won 2026-08-27. Never webinar-ad leads.
  Ruled out the other candidate: `wonBeforeEvent` is null on all four cohorts, so the pre-event exclusion
  in `close_events.py` is NOT the cause.
- **The tag number is correct for the channel dashboard** (it is what you divide into ad spend for ROAS).
  Do NOT "sync" them to one number — that breaks one of the two questions.
- Proposed fix: rename ("Won — attended the room" vs "Won — webinar-attributed"), and publish a per-cohort
  reconciliation line showing the gap and its reason (untagged / other funnel).

### 3. `directBooked` on contact-backed channels

Filter is per row (`leads == null && contacts == null`); the comment's intent ("not webinar or ManyChat
rows") is not what it implements. Channel-level test is probably right but Instagram has 23 that may be
genuine direct Calendly links — needs evidence before changing.

## Owed by Adam

- **Rotate the Avoma key** — pasted into chat 2026-09-21, therefore burned. New one into `.env` only; the
  GitHub secret can then be set from the file.
- `GHL setter outreach` fails, exit 1. It is a SLOW task, so it only runs on the two daily refreshes
  (11:00/17:00 UTC) — that is why scheduled runs are red and event-day runs are green.
- Sept 22 `Anthony Q&A` GHL custom value still reads "Thursday, September 17" (past).

## Gotchas that cost time today

- **Measure through `fetchFacts`, never raw `channel_daily` rows.** `applyLeadDefinition` moves non-site
  leads into `contacts`; skipping it made me report Webinar Book % as 0.7% when the live page said 300%.
- Recipe: drop a temp `src/lib/services/zz-diagnostic.test.ts` that calls `fetchFacts` with a service-role
  client from `.env.local`, then `buildChannelReport`. `console.log` is swallowed by vitest — write to a file.
  Delete the file afterwards.
- **The vending-website checkout is shared** with other sessions. Stage explicitly, never `git add -A`.
- `pnpm exec` is broken here; call `./node_modules/.bin/{tsc,vitest,prettier,eslint,next}` directly.
- A push to `main` publishes to www.vendingpreneurs.com in ~1 min.
- Verification bar used today: 2,730 vitest tests, tsc, eslint, prettier, real `next build`, plus a
  before/after measurement against live prod data.

## Regression check for any Book % change

Channels with no contacts must not move: YouTube 62.5%, Google Ads 49.5%, Chatbot 53.7%, Newsletter 50%.
