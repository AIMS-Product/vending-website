# Launch Blockers

Last verified: 2026-06-11. Each item lists how it was verified so it can be
re-checked at cutover time. Companion docs: `docs/cutover/` (route strategy),
`docs/stack-release.md` (release train).

## P0 — leads go nowhere a human looks

Lead capture itself works: every Apply/Contact/`lead_form` submission inserts
into the Supabase `lead_submissions` table via `submitLead`
(`src/lib/services/leads.ts`) with idempotency, UTM, and source attribution.
RLS blocks anon reads/writes. But after the insert, nothing reaches a person:

1. **Notification env vars are not set anywhere.** `RESEND_API_KEY`,
   `LEAD_NOTIFICATION_TO`, `LEAD_NOTIFICATION_FROM`, and `SLACK_WEBHOOK_URL`
   are absent from both `.env.local` and Vercel (verified 2026-06-11 via
   `vercel env ls`). The service treats this as non-fatal by design — rows are
   stored and marked `notification_failed` — so failures are silent.
2. **No `/admin/leads` view exists.** `src/app/admin/` has pages, news, media,
   libraries, and settings, but nothing lists `lead_submissions`. There is no
   UI where an unnotified lead would ever be seen.

**Exit criteria:** at least one notification channel live on Vercel production
(Resend email to a monitored address, and/or the Slack webhook) AND a
verified end-to-end test: submit a production form, see the notification,
see the row. An `/admin/leads` view is strongly recommended as the backstop
so leads survive a notification outage.

## P0 — production OpenAI key is dead

Vercel production still has the OLD `OPENAI_API_KEY` (36 days old, from the
org that exhausted its quota). The working key currently lives only in
`.env.local`. Until the Vercel value is replaced, the page-builder AI
assistant and SEO agent fail in production with the quota error.

Admin-facing, so not a public-site outage — but it ships broken tooling to
whoever edits content after cutover.

**Exit criteria:** update `OPENAI_API_KEY` on Vercel production (use
`printf '%s' "$KEY" | vercel env add ...` — never echo, it appends `\n`),
redeploy, and confirm one AI draft generates in the production admin.

## P1 — carried over from the 2026-05-05 cutover review

Still open as of that review; re-verify at cutover:

- **News drafts need a human publish decision.** 32 Webflow articles imported
  to `news_posts` as `status=draft`; none published. Public `/news` correctly
  hides them.
- **Admin magic-link/callback flow unverified for the real inbox**
  (`james@modernamenities.com`). Verify login end-to-end on the production
  domain before handing the admin over.
- **DNS cutover owner, window, and rollback plan.** The
  `vendingpreneurs.com` custom domain is still not attached to this project
  (see `AGENTS.md`); public custom-domain checks remain post-cutover work.

## Resolved since the May review

- ~~`npm audit --omit=dev` PostCSS advisory via `next@16.2.4`~~ — clean as of
  2026-06-11 on `next@16.2.6` (`found 0 vulnerabilities`).
- ~~Cerebras env/config cleanup~~ — Cerebras fully removed 2026-06-11
  (code, env, and Vercel).

## Not blockers, for awareness

- Lead notification config is intentionally non-fatal: if a channel goes down
  after launch, leads keep landing in `lead_submissions` with
  `notification_failed` status — recoverable, but only if someone checks.
- The copy-quality gate surfaces thin-copy findings as readiness _warnings_,
  not publish blockers. Dial up to blockers in
  `src/lib/page-builder/seo-readiness.ts` if launch content needs the hard
  stop.
