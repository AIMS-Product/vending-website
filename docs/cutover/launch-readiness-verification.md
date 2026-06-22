# Launch Readiness Verification

Last verified locally: 2026-06-22.

Use this check after deploying the current launch-readiness changes and before
calling the production release ready. For the ordered env, release, DNS, smoke,
and watch sequence, use `docs/cutover/launch-day-runbook.md`.

## Production Prerequisite Check

Run the read-only Vercel/env/DNS/deployment prerequisite check before cutover:

```bash
npm run check:launch:prereqs
```

Expected result before go-live: `failures=0`.

This check reports secret names only, never values. It verifies:

- Production Supabase and `CRON_SECRET` env names are present.
- At least one lead notification channel is configured: Resend email
  (`RESEND_API_KEY`, `LEAD_NOTIFICATION_TO`, `LEAD_NOTIFICATION_FROM`) or
  `SLACK_WEBHOOK_URL`.
- `CLOSE_API_KEY` is present, and Close field-mapping env names are reported as
  warnings until configured.
- Vercel can inspect `vendingpreneurs.com`; current DNS cutover status is
  reported as a warning unless `--require-domain-configured` is passed.
- The latest production deployment, or a deployment supplied with
  `--deployment`, passes `npm run check:launch`.

Use this stricter DNS gate after domain access is granted and the cutover window
starts:

```bash
npm run check:launch:prereqs -- --require-domain-configured
```

## Local Production Check

Build and run the app with a throwaway cron secret so protected cron routes can
prove they reject unauthenticated traffic with `401`:

```bash
npm run build
CRON_SECRET=local-launch-check npm run start -- --port 3015
npm run check:launch -- http://localhost:3015
```

Expected result: `checked=10` and `failures=0`.

This proves:

- `/news/feed.xml` emits `https://www.vendingpreneurs.com` links, not localhost.
- The public header wordmark is eager/high-priority for LCP discovery.
- The hero stat color uses the contrast-safe value.
- `/case-studies` uses compressed `.jpg` testimonial posters.
- Scheduled publishing, qualification lifecycle, and Close sync cron routes are
  protected by `CRON_SECRET`.

## Protected Vercel Deployment Check

For a Vercel deployment protected by Vercel Authentication, use the deployment
URL with `vercel curl` via the same script:

```bash
npm run check:launch -- --deployment https://<deployment>.vercel.app
```

Expected result after the release deploy: `checked=10` and `failures=0`.

If it fails with RSS `localhost`, PNG posters, missing wordmark priority, or the
old hero stat color, the deployment does not contain the local launch fixes yet.
If cron route checks return `503`, `CRON_SECRET` is missing from the target
environment.
