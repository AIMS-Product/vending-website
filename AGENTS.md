<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:domain-cutover-rules -->

# Custom domain cutover status

CUT OVER 2026-07-27. `vendingpreneurs.com` and `www.vendingpreneurs.com` resolve
through Vercel (apex + www A records at `76.76.21.21`) and serve this app. The
Webflow rollback proxy that previously answered on those hosts (identified by the
`x-vp-rollback-origin: webflow` response header) has been replaced.

Public-domain behavior is now app behavior: treat a wrong response on
`www.vendingpreneurs.com` as a real bug, not as legacy Webflow noise.

Rollback path if production must be reverted: re-promote the last rollback-proxy
production deployment. DNS does not change in either direction.

<!-- END:domain-cutover-rules -->

<!-- BEGIN:production-deploy-rules -->

# Production deploys

Production is live. Pushes to `main` publish to the custom domains.

- `main` is the release branch; deploy by merging into it, never by
  `vercel --prod` from a working tree.
- Verify a deployment on its own `*.vercel.app` URL before promoting anything to
  the custom domains.
- Leads flow to Close CRM from production on a 10-minute cron. Changes to
  `src/lib/close/*` or the qualification intake path are customer-visible the
  moment they deploy — verify on preview against the real Close org first.

<!-- END:production-deploy-rules -->

<!-- BEGIN:admin-studio-design-rules -->

# Admin Studio and SEO Page Builder design contracts

Before changing `/admin` CMS UI, SEO Page Builder UI, editor controls, block editing, visual polish, or browser-facing admin workflows, read:

- `docs/design/admin-studio.md`
- `docs/design/page-builder.md`
- `docs/design/page-builder-blocks.md`
- `docs/design/visual-review-checklist.md`

These are execution contracts, not inspiration docs. Do not introduce UI that violates them without updating the relevant design contract in the same change.

The active product roadmap remains `docs/seo-page-builder/roadmap.md`; the design docs define how the admin/editor experience should be implemented and verified.

<!-- END:admin-studio-design-rules -->

<!-- BEGIN:feature-orchestrator-rules -->

# Feature Orchestrator flow

When work is being executed from a tracked feature graph under `plans/<feature-slug>/`,
keep the canonical workflow inside the `feature-orchestrator` skill. Use stage
skills only as explicit orchestrator stages, such as `feature-slice-worker`,
`feature-integrator`, or `feature-proof`, and do not switch to a standalone
implementation skill as the primary workflow for a graph node.

The orchestrator owns `plan.md` and `progress.md`. Worker evidence belongs under
`plans/<feature-slug>/agent-runs/` and should be integrated back into
`progress.md` only by the orchestrator stage.

<!-- END:feature-orchestrator-rules -->

<!-- BEGIN:builder-release-train-rules -->

# Website Builder release train

For Website Builder / SEO Page Builder work tracked under
`plans/website-builder-feedback-v2/` and follow-up graphs, use a local-only
stacked release train until the user explicitly asks to push a branch or create
a PR.

Use `docs/stack-release.md` as the release-train playbook.

Current release baseline:

- S1-S3 are already landed on `main`.
- S4-S12 and follow-up scheduled publishing runner work should be split from the
  dirty working tree into dependency-ordered local branches/commits.
- Do not push these branches, open PRs, or trigger Vercel previews until the user
  explicitly chooses the next slice to release.

When continuing this work:

- Add new changes to the appropriate local stack branch, or create a new branch
  on top of the latest unreleased stack branch when the work is a later slice.
- Keep branches stacked in dependency order so each future PR can target the
  previous slice branch rather than all PRs targeting `main`.
- Preserve orchestrator evidence in the relevant `plans/<feature-slug>/`
  folder, but avoid mixing unrelated cutover/docs/report/tmp artifacts into
  release-train commits.
- When using `cap` for this release train, run it as a local commit/verification
  flow only. Do not use the default cap push/deploy path for unreleased stack
  branches.
- Treat any push, PR creation, Vercel preview, or production release as an
  explicit user-controlled step, not part of ordinary implementation.
- The repo-local Husky `pre-push` guard blocks stack branch pushes by default.
  Only bypass it for the user-selected release slice with
  `ALLOW_RELEASE_TRAIN_PUSH=1`.

<!-- END:builder-release-train-rules -->

# Learnings

- GHL v2 workflow email stats (`/emails/locations/{loc}/campaigns/stats/workflow-campaigns/{id}`, Version `v3`) are lifetime totals with no date range. The ghl-email connector snapshots them daily into `ghl_email_stats` and writes the day-over-day difference; history starts the day after the first run. There is no per-workflow SMS stats endpoint; SMS counts would need a full `/conversations/search` pass, which is too slow for a cron.
- Metricool's brand summary (`/v2/analytics/brand-summary/posts`) returns every network in one call, but its `metrics` map is untyped in the published OpenAPI file. `readMetric` in `src/lib/metricool/client.ts` reads tolerantly and the raw map is stored on `metricool_posts.metrics`; check the first live row before trusting reach / impressions / clicks names.
- Metricool: the Vendingpreneurs (6626386) and Mike (6633336) brands share one Facebook page, so the same post ids come back under both blog ids; `metricool-sync.ts` lets the first brand in `METRICOOL_BLOG_IDS` own a post. Instagram ids differ between brand-summary (graph id) and the typed `/v2/analytics/posts/instagram` rows (media id); the post URL is the join. Brand-summary never reports reach or clicks; only the typed endpoints do.
- `channel_daily` is keyed on the six link dimensions only; `channel` is derived from `source` (+ `medium` for paid) and overwritten on every upsert. Never put a derived column in a spine key: with `channel` in the key, each rename forked every old row and the dashboard double counted (2,788 keys on 2026-09-11). Webinar rows keep their label via the `channel_daily_keep_program_channel` trigger.
- YouTube Analytics channel reports cannot combine `video` and `day` dimensions; per video per day is one request per day with `dimensions=video`.
- `feat/unified-channels` was cut before PRs #23–#27 landed as squashes, so merging main into it conflicted on ~25 files. Cherry-picking the slice commits onto a fresh branch from main (`feat/unified-channels-main`) applied cleanly.
- Next's trailing-slash 308 is switched off (`skipTrailingSlashRedirect`) so the PostHog reverse proxy at `/api/ph/*` can receive `/e/`, `/s/`, `/flags/` as posthog-js sends them; `src/proxy.ts` performs the 308 for public pages instead. Any proxy-matcher or rewrite change must keep `curl -I /about/` = 308 to `/about` and `curl -X POST /api/ph/e/` = 200.
- `channel_daily.source = 'ghl_form'` going to zero leads after **2026-08-25 is correct, not a broken connector**. Every `ghl_form` row that ever carried leads is the GHL **Waitlist Form** (`LZ4wWLGozv6Gt813E3XM`, medium `waitlist`, channel Webinar, 139 leads all-time); its last submission was 2026-08-25T18:30:34Z and the form still exists in GHL, unfilled. Every other form with live traffic is in `FORM_ROUTES` and writes under its real source (`mike-ig`, `anthony-ig`, `vsl`, `website`, `meta_ads`), so nothing is left to land on the `ghl_form` fallback tag. Verified 2026-09-18 against the GHL API: 3,583 submissions 09-01..09-18, of which 3,144 are webinar-registration forms (skipped by `WEBINAR_FORM_PATTERN`, already counted as registrations) and 1 is Course Access (excluded), leaving 438 — and `channel_daily` holds exactly 438 for those days. **Do not back-fill and do not loosen the skip regex.** Ask whether the waitlist form was retired on purpose.
- Won deals and revenue by channel come from Close opportunities (`src/lib/services/close-wins.ts`: won by `date_won`, credited to the lead's "Funnel Name DEAL (Opp)"), never from `lead_submissions`. Webinar buyers register on GHL and have no site lead row, so any lead-based won count reads them as 0. Verified 2026-09-18: 249 won deals since June 1 = Close exactly.
- A "shown" call is one a rep logged `First Call Show Up = yes` in Close (`classifyBookedCall`), on every tab. Never derive shows as booked minus no-show/canceled; that counted every unlogged call as shown.
- `channel_daily.visits` from May to 2026-09-18 was 13-43% high from GA4 provisional keys left behind; repaired day by day with `scripts/channel-visits-repair.mjs` (every month = GA4 exactly). Re-run it (dry run first) if Channels visits ever drift from GA4 by more than ~2%. Never run GA4 channel reports wider than one day for a repair: wider reports fold into `(other)`.
- SteelTrap's weekly "booked" = Close leads with `First Sales Call Booked Date` in the Fri–Thu week, **minus leads whose current status is "Canceled (by Lead)" or "Outside the US", and the "LTF - Quiz Funnel" funnel** (`crm_silver_to_gold_lakebase.py` `DEFAULT_MEETING_BOOKED_EXCLUDED_*`). No email dedupe, no lane filter. The Close view tab (`close-week-view.ts`) applies the same rule; Sep 11–17 = 162 / 97 / 62 / 14 / $87,134. `close_lead_funnel` must be pruned after each complete crawl, or leads whose booked date was cleared (or were deleted) stay counted forever.
- The Q4 booked-call plan is **+10% a month compounding from each channel's August actual**, checked into `channel-targets.ts` (Lane 2 291, Webinar 72, YouTube 64, Instagram 51, Website 45; Marketing Reactivation fixed at 44 because August booked 0; Newsletter unforecasted). Sep 619 / Oct 676 / Nov 740 / Dec 810, Q4 2,226. **The workbook's "Q4 Growth Plan" tab states the same +10% rule against an August baseline of 821 — do not use the 821.** The same workbook's "Booked Call Summary" tab counts August at 523 and our mirror reproduces that exactly (Jun 602 v 603, Jul 676 v 677, Aug 523 v 523 — 1,801 of 1,803 leads). Nothing reproduces 821: no 30-day window, not all Calendly bookings made in August (1,010), not all meetings landing in August (998). Two other totals are in circulation and are shown on the page as superseded, not used: 800/month (Channel KPI Plan tab) and 833/month (the Summary tab's "Existing Monthly Target"). A quarter target is the **sum of its months**, never one month times three.
- The goals page total row counts **plan channels only**, matching its target's population. Counting every booked call against the six-channel target made September read "ahead" on Meta, Google and LinkedIn bookings the plan never asked for (488 v 452 on 2026-09-21). The all-in figure is carried separately in `allBooked` and printed under the table.
- Every booked-on number reads `calendly_bookings.raw_payload -> payload -> created_at`. A writer that builds its own payload must nest it there: the chatbot embed confirmation stored `{ source, inviteeUri, scheduled_event }` with no `payload`, so four September consultation calls were in no daily pace figure at all. `withBookedAt` in `calendly-bookings.ts` now guards every caller, and `scripts/repair-calendly-booked-at.mjs` repaired the 13 historical rows (dry run by default).
- Metricool ad rows carry the campaign NAME in `content`, which is part of the spine key, and the Meta webinar campaign is renamed every week ("Sep 15" → "Sep 22"). `clearRenamedAdRows` in `metricool-sync.ts` blanks a campaign day stored under an older name after each run; without it Sep 15 counted $462 twice. Verified 2026-09-19: August Meta spend in `channel_daily` = Meta's own account total ($45,322.36) to the cent. Webinar ad spend buys registrations, so it is priced per sign-up on Channels and left out of Executive cost per lead.
- The numbers check themselves nightly: `/api/admin/data-audit/run` (5:30am PT) asks GA4, Close, Calendly, Metricool, GoHighLevel and YouTube what they have and compares it to what we stored, then `/api/admin/data-report/run?period=day|week` emails the EOD/EOW report led by that verdict (5pm PT daily, 5pm Thursday weekly, to `adam@modern-amenities.com`, override with `DATA_REPORT_TO`). A source that cannot be reached is never counted as agreement. Failures also post to Slack; a pass is silent. Details and tolerances: `docs/marketing/data-audit.md`. **GoHighLevel's `endAt` is exclusive** — asking for a window's own last day returns nothing for it (112 submissions to endAt 09-18, 129 to endAt 09-19); both `ghl-sync` and the audit ask one day past. Close's `/data/search/` with `include_counts: true` returns a total without paging.
- `ghl_email_stats` holds GoHighLevel's **lifetime** totals per workflow, not daily numbers; the daily figures are the deltas `emailDeltaRows` writes onto the spine as source `ghl_email` (`impressions` = sent, `clicks` = clicked). Summing the snapshot table printed "166,109 sent" for one day in the first EOD email. GHL has no daily opens or replies at all, so those are reported as not available rather than filled in from a lifetime total.
- The month-over-month tab (`/admin/analytics?tab=mom`) counts **people**, the sales floor's sheet counts **meeting activities**. January 2026: 825 here against its 1,448, and the ~1.7x ratio holds across every single funnel (LTF 391/220, Instagram 307/179, YouTube 262/152, Website 83/51). A lead who reschedules twice is three rows there and one here. Lead with that when the two are compared; `close_lead_funnel` still carries no meeting-owner field, so the sheet's population cannot be reproduced.
- **Never use `call_disposition` as the first-call show outcome.** It reflects the most recent call: only 3,802 of 6,663 dispositions say "New Call Show/No Show", the rest are Follow Up, Reschedule or Canceled, and it disagrees with `First Call Show Up (Opp)` on 970 calls. Show is `first_call_show_up` everywhere.
- `close_lead_funnel` holds **only leads that booked a first call** (8,404 rows, none without a booked date), so it can never answer "leads created by channel". Form fills come from `lead_submissions`, which starts **2026-07-06** — there is no channel-level lead history before then, from any source. Blank those cells; do not zero-fill them.
- A phone Close refuses fails the **whole** lead write (12 leads lost Aug–Sep 2026 to national numbers like `0907…` sent as `+0907…`). `normalizePhone` drops a bare leading `0` and keeps `00` as `+`; `syncLeadCreateOrUpdate` retries once without the phone on a 400 "Invalid phone number". Never remove either layer. "Qualification enrichment is missing a Close lead ID" is always a symptom: read the lead's `lead_create_or_update` event, which the enrichment error now quotes.
- **Vidalytics autoplays muted, so progress only counts while `player.muted()` is false** (`audiblePercentWatched`). Before 2026-09-22 an untouched /pre-call-resources tab ran all fifteen players and logged them as watched (20 events in 75s, the short answers "reached 100%"), so `lead_video_views` rows first played before `VIDEO_VIEWS_TRUSTED_FROM` (2026-09-22 23:45 UTC) cannot tell a watcher from an open tab. Every reader filters on that constant; the rows are kept, not deleted. A new reader of the table must apply the same filter. Clicking the unmute card restarts from 0:00, so the gate loses no real viewing. Any live check of this feature must click unmute; an unclicked page should send zero `video_progress` events.
- The chatbot dashboard counts **sales chats only**: `triageConversation` (`src/lib/chatbot/triage.ts`) drops member-support chats (only phrasings about THEIR membership, login, payment or booked call; a later "book a call" puts a chat back in sales; a chat with its own in-chat booking stamp always counts), and a chat whose lead's `call_booked_at` is an earlier day than the chat (Pacific) is left out as booked-before-chat. `lead_submissions.call_booked_at` is Close's "First Sales Call Booked Date", a DATE, so a same-day pre-chat booking still counts. Hand-offs live in `chatbot_follow_up_tasks` too and are told apart by the `flag_for_team:` dedupe prefix, never by `task_type`. On 2026-09-23 the 30-day view went 190 chats / 45 booked to 183 / 42 (5 support, 2 booked before).
- Every term the analytics tabs share is defined once on screen in `src/components/admin/AnalyticsGlossary.tsx`; a tooltip alone never reaches a phone. Change the entry in the same commit as the rule it describes. A data feed that runs clean but writes 0 rows for 48h reads "No new data" (`EMPTY_AFTER_HOURS`), which is how Bitly hid for weeks.
- A booking reaches its pre-call video views through **`resolveBookingSessions`** (`pre-call-engagement.ts`): the lead row's session plus `calendly_booking_sessions` (written by the on-site Calendly embed's `booking_linked` event), watching merged across both. A linked browser is trusted only if every booking it made is the same email; a setter's or shared browser would otherwise credit one person's watching to everyone it booked. Any view read that fails or reaches PostgREST's 1,000-row cap reads as "cannot tell", never "watched nothing", and the pre-call Close note posts nothing for a booking with no browser (a note can't be edited later). Webinar attendees book on /start without a site form, so the lead-row route alone left 10 of 18 watching browsers unnamed on 2026-09-23. Every reader of engagement (Pre-call video tab, /admin/bookings, the pre-call Close note) must use the resolver, never the lead row alone. Close's `First Call Show Up` describes the lead's FIRST sales call only: read it onto a booking only when the booking's call day matches `first_sales_call_booked_date` (UTC or Pacific), as `firstCallOutcome` does. Onboarding, reschedule and follow-up bookings otherwise borrow another call's answer.
- Every analytics tab and `/admin/data` opens with a trust bar (`DataTrustBar`). Which feeds a tab reads is `TAB_FEEDS` and which number an audit check verifies is `CHECK_COVERS`, both in `src/lib/analytics/data-trust-bar.ts`; change them in the same commit as a loader that starts reading a new table (a test reads each loader for `.from("table")` and fails on an unmapped one) or a new audit check. A number is "Unverified" unless its check is in the latest run and passed (or warned, within twice tolerance): failed, errored, skipped, missing from the run, replaced by a `<group>-group` or `<source>-config` row, or no run in 26h all count. The chip shows only where the check's days overlap the days on screen.
- **`channel_sync_runs.error` is for failures only** (or `skipped: <why>`). Any other text marks the run failed on the trust bar and fails the nightly "Every connector ran cleanly" check, however much it wrote: Metricool's untagged-link count sat there from 09-19 and made posts syncing daily read "4 days old". Log notes with `console.warn`. A feed whose own table has never had a row (`FEEDS[*].fills`: `bitly_link_clicks`, `manychat_events`) reads "not connected" on the bar and is left out of its date; as of 2026-09-23 neither has ever received a row (Bitly has no token in any environment; ManyChat's one run was our own test).
- Search Console's Seen / Clicked for Organic search live on their own spine source, `google-search-console` (medium `organic`, one row a day, `search-console-sync.ts`), never on GA4's google/organic key: that key is whatever campaign/term GA4 reports that day, and a search click is not a session. Anything that sums spine `impressions` as social reach must exclude that source (`reachTotals` in `data-report-data.ts` does). Nothing arrives until the GA4 service account's `client_email` is a Restricted user on the property and `GSC_SITE_URL` is set (`docs/marketing/search-console.md`).
