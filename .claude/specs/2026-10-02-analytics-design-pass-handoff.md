# Handoff: analytics design pass (round 2)

Start here in a fresh session. Repo `~/vending-website`, worktree `~/vending-website-overhaul`, branch
`feat/analytics-overhaul`, PR AIMS-Product/vending-website#120 (open, not merged). Read the round-1
spec `.claude/specs/2026-10-02-analytics-overhaul.md` and `METRICS.md` §16 first. Same hard rules
apply: no provenance (run the grep before every commit), branch + preview + PR only, METRICS.md is
the source of truth, read-only against production.

Adam's verdict on round 1: "a lot better, I really like it." Round 2 is design polish plus speed.
Use the `impeccable` skill for the pass. Check the result on the preview, not only locally.

## How to see the preview headless

The Vercel connector cannot reach the AIMS team. Use the signed-in CLI:
`vercel curl /admin/login --scope aimanagingservices --deployment <preview-url> --debug -- -s -o /dev/null`
prints an `x-vercel-protection-bypass` header. Pass it (and `x-vercel-set-bypass-cookie: true`) as
Playwright `extraHTTPHeaders`. The admin login needs `?email=<address>` or the email field stays
hidden (guest mode). The screenshot script used in round 1 is `/tmp/vwa/shoot-preview.mjs` (may be gone).

## Feedback to implement

### 1. Channel flow (`ChannelFlowChart.tsx`, `channel-flow.ts`)

- Order bands **largest to smallest by Booked** (Sales reactivation and Webinar on top); "Other and
  not recorded" always last. Sort in `buildChannelFlow` (pure, add a test) so the rail and the
  Bookings card follow the same order.
- Columns are vertically centred with a fixed gap between bands, so small bands bunch up with white
  space around them. Top-align the columns and shrink or drop the gap for tiny bands, so the flow
  reads as one block. Keep the log step between stages.

### 2. Cost per booked call card

- The sparklines look "funky": with 2-5 points and a min-max y-axis, a $20 move looks like a cliff.
  Replace with a small bar per month (zero-based) or a compact month table with the latest bar
  highlighted. Keep "Sep $365 -46%" and "Oct so far" text.

### 3. Leads and booked calls per day

- Adam wants a **bar chart**, not lines: grouped or paired daily bars (leads vs booked), zero-based,
  hover readout kept. Build it in `DashboardCharts.tsx` (hand-drawn SVG, `--ui-chart-*` tokens).

### 4. Channel logos everywhere

- **Any mention of Facebook, Instagram, LinkedIn, TikTok, X, YouTube, webinar, chatbot, Google,
  Meta, email or newsletter must carry its logo or icon**, on every admin page: KPI captions, the
  Bookings card's By-channel list, the cost card rows, the flow rail, the Channels drill-down, the
  SEO/social pages and Team. `ChannelLogo` (`components/admin/ChannelLogo.tsx`) already resolves
  labels; use it everywhere a channel name appears. Consider a lint test that fails when a known
  channel label is rendered without it.

### 5. Apply the same fixes to other pages

- Same chart rules (bars for daily counts, zero-based axes, no min-max sparklines on tiny series,
  logos on channel names) across the other admin reporting pages.

### 6. /admin/seo

- **Overview tab: "looks like shit"**. Redesign it as a clear summary (KPI strip, one trend, what
  changed), matching the analytics dashboard's language.
- **Pages view: keep, Adam loves it.**
- **Keywords and AEO: "getting nothing from it, a wall of text."** Turn it into something scannable:
  ranked table with position, change and a small bar, AI-answer presence as chips, the detail
  behind a row expand.
- **Content plan: keep, Adam likes the in-progress view.**
- **Tasks:** Adam does not look at it. Ask whether it is for the agent; if so, move it out of his way
  (secondary tab or collapsed), do not delete.
- **Social:** the graphs are "weird" and "stupid that it's kind of centred". Left-align, full-width
  charts with proper axes, logos on every network.

### 7. Speed of the dashboard

- Round 1 measured ~10-14 s to settle on the preview (6-7 s on a local production build). Profile
  before changing anything. Likely costs:
  - `readCac` calls `getCacPageData` once per month (up to 6), each reading Close.
  - `readBookingInputs` reads the whole `close_lead_funnel` mirror and a year of `calendly_bookings`
    for the Today strip.
  - `readFacts` runs `fetchFacts` over six months of the spine for the cost card.
  - `readDeals` pages Close won opportunities (cached 5 min).
- Options: narrow each read to what its card needs, cache the monthly series (CAC, cost per booked)
  with `unstable_cache` and a short revalidate, read only today's/yesterday's/last week's bookings.
  Keep every card behind its own Suspense so the top of the page paints first.

## State at handoff

- All checks green on the branch (typecheck, lint, 4,277 tests, build, CI 20/20).
- Open items from round 1: Bitly token, ManyChat setup, the `_____` Calendly link template (351
  bookings), October CAC inputs not entered.
