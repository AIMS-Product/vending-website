# Launch Blockers

Last verified: 2026-06-22. Each item lists how it was verified so it can be
re-checked at cutover time. Companion docs: `docs/cutover/` (route strategy),
`docs/cutover/launch-day-runbook.md` (ordered launch steps), and
`docs/stack-release.md` (release train).

Current automated prerequisite check:
`npm run check:launch:prereqs` returns `failures=2` and `warnings=2` as of
2026-06-22. The hard failures are missing lead notification configuration,
missing `CLOSE_API_KEY`. The latest production deployment now passes
`npm run check:launch` with `checked=10` and `failures=0`.

## P0 — lead notifications are not live

Lead capture itself works: every Apply/Contact/`lead_form` submission inserts
into the Supabase `lead_submissions` table via `submitLead`
(`src/lib/services/leads.ts`) with idempotency, UTM, and source attribution.
RLS blocks anon reads/writes, and `/admin/leads` now exists as the admin
backstop (`src/app/admin/leads/page.tsx`,
`src/app/admin/leads/[id]/page.tsx`, `src/lib/services/lead-admin.ts`).
But after insert, production still has no configured notification channel:

1. `RESEND_API_KEY`, `LEAD_NOTIFICATION_TO`, `LEAD_NOTIFICATION_FROM`, and
   `SLACK_WEBHOOK_URL` are absent from Vercel production (verified
   2026-06-22 via `vercel env ls production`).
2. The service treats this as non-fatal by design. Rows are stored and marked
   `notification_failed`, so the lead is recoverable in `/admin/leads`, but no
   person is alerted automatically.

**Exit criteria:** at least one notification channel live on Vercel production
(Resend email to a monitored address, and/or the Slack webhook) AND a
verified end-to-end test: submit a production form, see the notification,
see the row in `/admin/leads`. Re-check provider prerequisites with
`npm run check:launch:prereqs`.

## P0 — Close CRM/lifecycle automation is not live

Post-submit qualification and lead lifecycle code is present locally, but the
live production automation is still incomplete:

1. `CRON_SECRET` is present on Vercel production (verified 2026-06-22 via
   `vercel env ls production`).
2. `vercel.json` in this worktree schedules `/api/admin/scheduled-publishing/run`,
   `/api/admin/qualification-lifecycle/run`, and `/api/admin/close-sync/run`.
   The cron route protection is live in the latest production deployment
   (verified with `npm run check:launch -- --deployment
https://vending-website-9ylmbb5y4-aimanagingservices.vercel.app`).
3. `CLOSE_API_KEY` and the Close mapping/status env vars are absent from Vercel
   production (verified 2026-06-22 via `vercel env ls production`), so Close sync
   cannot process live records.

**Exit criteria:** Close env vars are configured in Vercel production, the
current cron config is deployed, and a production or approved preview smoke
proves lifecycle + Close sync can process a test lead without exposing secrets.
Re-check the env/deployment side with `npm run check:launch:prereqs`.

## P1 — production OpenAI admin smoke is unverified

Vercel production has an `OPENAI_API_KEY` env var (verified 2026-06-22 via
`vercel env ls production`), but the value is encrypted and was not pulled or
printed. The previous quota issue is not cleared until a production admin smoke
test proves the page-builder AI assistant/SEO agent can generate a draft.

Admin-facing, so not a public-site outage, but it should be verified before
handing content editing over after cutover.

**Exit criteria:** confirm one AI draft generates in the production admin after
the latest deployment.

## P1 — carried over from the 2026-05-05 cutover review

Still open as of that review; re-verify at cutover:

- **News drafts need a human publish decision.** 32 Webflow articles imported
  to `news_posts` as `status=draft`; none published. Public `/news` correctly
  hides them.
- **Admin magic-link/callback flow unverified for the real inbox**
  (`james@modernamenities.com`). Verify login end-to-end on the production
  domain before handing the admin over.
- **DNS cutover owner, window, and rollback plan.** `vendingpreneurs.com`
  exists under the Vercel team, but `vercel domains inspect vendingpreneurs.com`
  still reports it is not configured correctly: current nameservers are
  `ns59.domaincontrol.com` and `ns60.domaincontrol.com`, and Vercel recommends
  `A vendingpreneurs.com 76.76.21.21` or Vercel nameservers. Per `AGENTS.md`,
  public custom-domain behavior remains post-cutover follow-up until the user
  says domain access/DNS cutover has been granted. Direct `dig` checks on
  2026-06-22 still showed apex `A 198.202.211.1` and `www` pointing through
  `cdn.webflow.com`; see `docs/cutover/launch-day-runbook.md`.

## Resolved since the May review

- ~~`npm audit --omit=dev` PostCSS advisory via `next@16.2.4`~~ — clean as of
  2026-06-11 on `next@16.2.6` (`found 0 vulnerabilities`).
- ~~Cerebras env/config cleanup~~ — Cerebras fully removed 2026-06-11
  (code, env, and Vercel).
- ~~No `/admin/leads` backstop~~ — `/admin/leads` list/detail and retry surfaces
  exist in the current app.
- ~~Missing production `CRON_SECRET`~~ — present in Vercel production as of
  2026-06-22.
- ~~Production deployment missing local launch fixes~~ — production deployment
  `https://vending-website-9ylmbb5y4-aimanagingservices.vercel.app` passes
  `npm run check:launch` with `checked=10` and `failures=0`.
- ~~Missing `NEXT_PUBLIC_SITE_URL`~~ — present in Vercel production as of
  2026-06-22. The config also trims the value before rendering canonical/RSS
  URLs.

## Not blockers, for awareness

- Lead notification config is intentionally non-fatal: if a channel goes down
  after launch, leads keep landing in `lead_submissions` with
  `notification_failed` status and remain reviewable in `/admin/leads`.
- The copy-quality gate surfaces thin-copy findings as readiness _warnings_,
  not publish blockers. Dial up to blockers in
  `src/lib/page-builder/seo-readiness.ts` if launch content needs the hard
  stop.
