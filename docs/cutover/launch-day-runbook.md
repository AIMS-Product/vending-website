# Launch Day Runbook

Last updated: 2026-06-22.

This runbook starts after the current launch-readiness code changes are
reviewed and explicitly approved for release. Do not push, deploy, edit Vercel
environment variables, or change DNS until that approval is given.

## Current Readiness State

Local app verification passes:

```bash
npm run check:launch -- http://localhost:3015
```

Expected local result: `checked=10` and `failures=0`.

Production prerequisite verification currently fails:

```bash
npm run check:launch:prereqs
```

Current result on 2026-06-22: `failures=2`, `warnings=2`.

Hard failures:

- No production lead notification channel is configured.
- `CLOSE_API_KEY` is missing from Vercel production.

Warnings:

- Close mapping env names are not configured.
- DNS cutover is pending.

Resolved:

- `NEXT_PUBLIC_SITE_URL` is configured in Vercel production.
- The latest production deployment
  `https://vending-website-9ylmbb5y4-aimanagingservices.vercel.app` passes
  `npm run check:launch` with `checked=10` and `failures=0`.

## Access Needed

- Vercel project access for `aimanagingservices/vending-website`.
- DNS registrar/provider access for `vendingpreneurs.com`.
- A monitored lead notification destination: Resend sender and inbox, or Slack
  incoming webhook.
- Close API key and, ideally, the Close field/status IDs listed in
  `.env.example`.
- Admin login access for the real production inbox.

## Production Environment Setup

Add at least one lead notification channel.

Email channel:

```bash
vercel env add RESEND_API_KEY production
vercel env add LEAD_NOTIFICATION_TO production
vercel env add LEAD_NOTIFICATION_FROM production
```

Slack channel:

```bash
vercel env add SLACK_WEBHOOK_URL production
```

Add Close sync.

```bash
vercel env add CLOSE_API_KEY production
```

Recommended Close mapping/status envs are listed in `.env.example`. They are
not required to start the runner, but launch quality is better when lifecycle
status, field mapping, and task ownership are explicit.

Recommended canonical env:

```bash
vercel env add NEXT_PUBLIC_SITE_URL production
```

Value: `https://www.vendingpreneurs.com`.

Re-check without printing secret values:

```bash
npm run check:launch:prereqs -- --skip-deployment-check
```

Do not proceed to release until the lead notification channel and
`CLOSE_API_KEY` failures are gone.

## Release The Code

Only after explicit release approval:

1. Keep the launch-readiness changes in a dedicated commit or branch so they do
   not absorb unrelated dirty work.
2. Run local gates:

   ```bash
   npm run typecheck
   npm test
   npm run lint
   npm run build
   ```

3. Push or deploy through the approved release path.
4. Wait for the production deployment to reach `Ready`.
5. Capture the deployment URL:

   ```bash
   vercel ls vending-website --prod
   ```

6. Verify the protected Vercel deployment:

   ```bash
   npm run check:launch -- --deployment https://<deployment>.vercel.app
   npm run check:launch:prereqs -- --deployment https://<deployment>.vercel.app
   ```

Expected result before DNS cutover: production deployment verifier passes, env
failures are gone, and only DNS/admin smoke warnings may remain.

## Functional Production Smoke

Use safe test records only.

1. Submit `/apply` or `/contact` on the production deployment.
2. Confirm the lead row appears in `/admin/leads`.
3. Confirm the configured email or Slack notification arrives.
4. Confirm Close sync can process the test lead without exposing secrets.
5. Confirm production admin magic-link/callback works for the real inbox.
6. Generate one production admin AI draft to prove `OPENAI_API_KEY` is usable.
7. Confirm the news draft state is intentional before publishing or cutover.

## DNS Cutover

Current observed DNS on 2026-06-22:

```bash
dig +short NS vendingpreneurs.com
dig +short A vendingpreneurs.com
dig +short CNAME www.vendingpreneurs.com
dig +short A www.vendingpreneurs.com
```

Current output points at the old provider:

- Nameservers: `ns59.domaincontrol.com`, `ns60.domaincontrol.com`
- Apex A: `198.202.211.1`
- `www` CNAME: `cdn.webflow.com`

Current Vercel CLI recommendation:

| Purpose          | Type | Name/Host                         | Value/Target  | Source of truth                                  | Verify                                 |
| ---------------- | ---- | --------------------------------- | ------------- | ------------------------------------------------ | -------------------------------------- |
| Apex web traffic | A    | `@` / `vendingpreneurs.com`       | `76.76.21.21` | `vercel domains inspect vendingpreneurs.com`     | `dig +short A vendingpreneurs.com`     |
| WWW web traffic  | A    | `www` / `www.vendingpreneurs.com` | `76.76.21.21` | `vercel domains inspect www.vendingpreneurs.com` | `dig +short A www.vendingpreneurs.com` |

At cutover time, use the Vercel dashboard or `vercel domains inspect` output as
the source of truth if it differs from this file.

After DNS changes:

```bash
dig +short A vendingpreneurs.com
dig +short A www.vendingpreneurs.com
curl -I https://vendingpreneurs.com
curl -I https://www.vendingpreneurs.com
npm run check:launch:prereqs -- --require-domain-configured
```

Expected state: Vercel reports the domain configured, HTTPS works, and the
canonical host behavior matches the launch decision.

## First-Hour Watch

- Watch Vercel deployment logs for 4xx/5xx spikes.
- Watch `/admin/leads` for test and real submissions.
- Watch the notification destination for lead alerts.
- Watch Close sync outcomes for failed/dead-lettered events.
- Check Sentry for new server/client errors.
- Re-run `npm run check:launch:prereqs -- --require-domain-configured` after
  DNS propagation.

## Rollback

If the new deployment fails before DNS cutover, use the previous Ready Vercel
deployment and do not change DNS.

If DNS has already changed and the site fails, revert the web DNS records to the
previous provider values from the DNS dashboard, then verify with `dig` and
`curl`. Keep form submissions recoverable through Supabase `/admin/leads`.
