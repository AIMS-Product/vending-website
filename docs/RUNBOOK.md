# Runbook

Operational guide for vendingpreneurs.com. Verified against `main` at `faac091` on 2026-10-02.
Cron schedules are copied from `vercel.json`; if that file changes, this table changes in the
same commit. Architecture is in [ARCHITECTURE.md](ARCHITECTURE.md); the reasoning behind many
rules below is in the `AGENTS.md` Learnings section, which this document points to instead of
repeating.

Items marked **(outside the repo)** depend on settings in Vercel, Supabase, Close, GitHub or
another vendor that cannot be read from the code. Confirm them in the vendor's dashboard.

## 1. Environments

| Environment | Where                                                                      | Notes                                                                                       |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Production  | Vercel, custom domains `vendingpreneurs.com` and `www.vendingpreneurs.com` | Deploys from `main`. Crons run here only.                                                   |
| Preview     | One `*.vercel.app` URL per branch/PR                                       | Crons never fire on previews, so a queue on a preview must be drained by hand.              |
| Local       | `npm run dev`, `.env.local`                                                | `ADMIN_DEV_AUTH_BYPASS=1` skips admin auth, only under `next dev`; ignored everywhere else. |

- Environment variables are set in the Vercel project (Settings, Environment Variables).
  A change applies only to deployments created after it; redeploy to pick it up.
  Full list: [ENV.md](ENV.md).
- Local `.env.local` normally points at a real Supabase project. Scripts and `npm run dev` write
  to whatever it points at; check `NEXT_PUBLIC_SUPABASE_URL` first.

## 2. Release

1. Branch from `main`; open a PR into `main`.
2. Locally: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
   A fresh checkout needs `npx next typegen` once. `npm run build` is refused by
   `scripts/guard-next-build.mjs` while a Next dev server is running; stop it first.
3. Open the preview deployment and verify on its own `*.vercel.app` URL.
   Changes under `src/lib/close/*` or the qualification intake path are customer-visible the
   moment they reach production: verify them against the real Close org on the preview first.
4. If the change touches `src/proxy.ts`, a matcher, or a rewrite, check the proxy contract:
   `curl -I <preview>/about/` returns 308 to `/about`, and `curl -X POST <preview>/api/ph/e/`
   returns 200.
5. Merge to `main`. That publishes to production.
6. Never run `vercel --prod` from a working tree.

Local git hooks (`.husky/`): `pre-commit` runs `lint-staged` and `tsc --noEmit`; `pre-push`
blocks branches named `codex/*`, `stack/*`, `builder-v2/*`, `release-stack/*`. **No CI workflow
exists in this repository and GitHub branch protection is not configured as far as the code
shows (outside the repo: confirm in GitHub settings).** Until CI is added, the four commands in
step 2 are the only gate.

## 3. Rollback

- **Code:** in Vercel, promote the previous production deployment of this project
  (Deployments, previous production build, Promote). DNS does not change.
- The Webflow rollback proxy that answered on these hosts before 2026-07-27 has been retired.
  Do not try to restore it.
- **Database:** migrations are forward-only and hand-applied (see [DATABASE.md](DATABASE.md)).
  Rolling code back does not roll a migration back. Check that the previous deployment still works
  with the current schema before promoting it. **(outside the repo)** Backup and point-in-time
  recovery depend on the Supabase plan; confirm them in the Supabase dashboard.

## 4. Scheduled jobs

All jobs are `GET` routes authenticated with `Authorization: Bearer $CRON_SECRET`. Vercel sends
that header itself when `CRON_SECRET` is set in the project. Schedules are UTC. The PT column
assumes daylight time (UTC-7). In standard time (UTC-8, early November to mid March) every
job runs one hour earlier on the PT clock: the `12:30 UTC` audit runs at 4:30am PT instead of
5:30am.

| Route (`/api/admin/...`)        | UTC schedule   | PT (daylight) | What it does                                                                                                                                                                          | Re-run                                                                                                            |
| ------------------------------- | -------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `close-sync/run`                | `*/2 * * * *`  | every 2 min   | Drains the `close_sync_events` outbox to Close, reconciles Close bookings, prunes rate-limit rows, ensures the VP form v3 qualification form is published (`ensureVpFormV3Published`) | Safe: events are claimed with a lease; overlapping drains are normal                                              |
| `qualification-lifecycle/run`   | `*/10 * * * *` | every 10 min  | Lifecycle follow-ups for qualification sessions; queues stale-session tasks to the outbox                                                                                             | Safe: stale-task events are deduped by key                                                                        |
| `scheduled-publishing/run`      | `*/5 * * * *`  | every 5 min   | Publishes SEO pages whose scheduled time has arrived                                                                                                                                  | See service (`seo-page-scheduler.ts`)                                                                             |
| `chatbot-digest/run`            | `*/10 * * * *` | every 10 min  | Extracts a prospect profile from finished chats, emails/Slacks the team, writes a Close engagement note                                                                               | See service (`chatbot/learning/digest.ts`)                                                                        |
| `no-book-alert/run`             | `*/10 * * * *` | every 10 min  | Slack message for leads 15 to 120 minutes old with no booking; max 25 per run                                                                                                         | Safe: each lead is marked in `lead_submissions.metadata` once alerted. Kill switch: `NO_BOOK_ALERT_ENABLED=false` |
| `close-lead-funnel-sync/run`    | `5 * * * *`    | hourly        | Crawls Close and refreshes the `close_lead_funnel` mirror                                                                                                                             | Safe: upserts                                                                                                     |
| `bitly-sync/run`                | `17 * * * *`   | hourly        | Bitly click sync for the YouTube funnel                                                                                                                                               | Safe: upserts; `?days=N` widens the window                                                                        |
| `pre-call-notes/run`            | `25 * * * *`   | hourly        | Posts "what they watched" notes onto the Close lead of calls about to start                                                                                                           | Safe: marker check prevents re-posting; `?dryRun=1`, `?hoursAhead=`                                               |
| `chatbot-learning/run`          | `0 7 * * *`    | midnight      | Chatbot learning pass (classification, knowledge suggestions, site recommendations)                                                                                                   | See service (`chatbot/learning/run.ts`)                                                                           |
| `chatbot-booking-reconcile/run` | `0 8 * * *`    | 1:00am        | Sweeps Calendly for chatbot bookings the webhook missed                                                                                                                               | Safe: upserts on invitee URI; `?dryRun=true`                                                                      |
| `ga4-sync/run`                  | `40 10 * * *`  | 3:40am        | GA4 page views and sessions; re-reads a trailing 3-day window to catch GA4's ~48h revisions                                                                                           | Safe: upserts; `?days=N` backfill                                                                                 |
| `channel-sync/run`              | `10 11 * * *`  | 4:10am        | Builds the `channel_daily` spine from its connectors; records each in `channel_sync_runs`                                                                                             | Safe: upserts; `?days=N` backfill                                                                                 |
| `ghl-sync/run`                  | `20 11 * * *`  | 4:20am        | GoHighLevel forms and email stats (daily snapshot deltas)                                                                                                                             | Safe: upserts                                                                                                     |
| `metricool-sync/run`            | `30 11 * * *`  | 4:30am        | Metricool posts, ads and account series (re-reads the last ten days)                                                                                                                  | Safe: upserts                                                                                                     |
| `youtube-analytics-sync/run`    | `40 11 * * *`  | 4:40am        | YouTube Analytics per video per day                                                                                                                                                   | Safe: upserts                                                                                                     |
| `search-console-sync/run`       | `50 11 * * *`  | 4:50am        | Search Console clicks and impressions; skips with `skipped:` when not configured                                                                                                      | Safe: upserts                                                                                                     |
| `data-audit/run`                | `30 12 * * *`  | 5:30am        | Compares stored numbers to GA4, Close, Calendly, Metricool, GHL, YouTube; writes `data_audit_runs`; Slack alert on failure                                                            | Appends rows on every run; harmless but noisy                                                                     |
| `data-report/run?period=day`    | `0 0 * * *`    | 5:00pm        | Emails the end-of-day report (to `DATA_REPORT_TO` or the default recipient)                                                                                                           | **Not idempotent: each run sends an email**                                                                       |
| `data-report/run?period=week`   | `0 0 * * 5`    | Thu 5:00pm    | Emails the end-of-week report                                                                                                                                                         | **Not idempotent: each run sends an email**                                                                       |
| `seo-ranks/run`                 | `0 13 * * 1`   | Mon 6:00am    | Queues this week's DataForSEO SERPs and collects finished ones                                                                                                                        | **Costs money** (DataForSEO); monthly cap `DATAFORSEO_MONTHLY_BUDGET_USD`, default 25                             |
| `seo-ai/run?engine=ai_mode`     | `10 13 * * 1`  | Mon 6:10am    | AI citation check (`ai_mode`)                                                                                                                                                         | **Costs money** (same cap)                                                                                        |
| `seo-ai/run?engine=chatgpt`     | `20 13 * * 1`  | Mon 6:20am    | ChatGPT citation check                                                                                                                                                                | **Costs money** (same cap)                                                                                        |
| `seo-ai/run?engine=youtube`     | `30 13 * * 1`  | Mon 6:30am    | YouTube citation check                                                                                                                                                                | **Costs money** (same cap)                                                                                        |
| `seo-ai/run?engine=mentions`    | `40 13 1 * *`  | 1st, 6:40am   | Monthly mentions check                                                                                                                                                                | **Costs money** (same cap)                                                                                        |
| `seo-ranks/run?collect=1`       | `50 13 * * 1`  | Mon 6:50am    | Collects finished SERPs only                                                                                                                                                          | Safe                                                                                                              |
| `seo-triggers/run`              | `0 14 * * 1`   | Mon 7:00am    | Writes SEO tasks from rank and Search Console movement                                                                                                                                | Deduped (`seo_tasks`)                                                                                             |

`calendly-backfill/run` is **not** scheduled. It is a manual month-at-a-time Calendly history
backfill (`?from=YYYY-MM-DD&to=YYYY-MM-DD&dryRun=true|false`).

### Run a job by hand

```bash
# Production. This executes the job for real; use ?dryRun where the table above lists it.
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.vendingpreneurs.com/api/admin/close-sync/run"
```

Take `CRON_SECRET` from the Vercel project settings; never paste it into a ticket or chat. A
`503` means the secret is not configured on that deployment; a `401` means it does not match.
A manual run against production writes production data.

## 5. Monitoring

| Signal                    | Where                                                  | Notes                                                                                                                          |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Server and browser errors | Sentry **(outside the repo: project and alert rules)** | Initialises only when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` is set. 10% trace sampling outside development.                  |
| Lead and no-book alerts   | Slack incoming webhook `SLACK_WEBHOOK_URL`             | README documents the channel as `#vp-site-leads`.                                                                              |
| Nightly data audit        | `/admin/data`, Slack on failure, EOD/EOW email         | A passing audit is silent. Details and tolerances: `docs/marketing/data-audit.md`.                                             |
| Per-tab data trust bar    | Top of every analytics tab                             | A number is "Unverified" unless its audit check is in the latest run and passed. `AGENTS.md` Learnings, "Every analytics tab". |
| Connector health          | `channel_sync_runs`                                    | `error` holds failures or `skipped: <why>` only. Any other text marks the run failed. Use `console.warn` for notes.            |
| CSP violations            | Server logs, `csp report-only violation`               | One log line per distinct directive and blocked host per instance.                                                             |
| Vercel runtime logs       | Vercel dashboard **(outside the repo)**                | Cron invocations and their responses appear here.                                                                              |

## 6. Common incidents

| Symptom                                              | First checks                                                                                                                                                                | Where it is explained                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Leads stored but not in Close                        | Rows in `close_sync_events` with status `retrying`, `failed`, `dead_letter` or `needs_review` and their `last_error`; `CLOSE_API_KEY` set; cron running (production only)   | README "Lead capture to Close"                                   |
| Close answers 400 on a lead write                    | A contact-scoped custom field id sent on a lead update, or a phone Close rejects. Check scope with `GET /custom_field/{lead                                                 | contact}/{id}/`                                                  | README "Close custom fields"; `AGENTS.md` (phone normalisation, "missing a Close lead ID") |
| Outbox backlog after an outage                       | Wait for the 2-minute cron, or call `close-sync/run` by hand. Events retry up to `max_attempts` (default 8).                                                                | `src/lib/close/sync.ts`                                          |
| A tab says "No new data"                             | The feed ran clean but wrote 0 rows for 48 hours (`EMPTY_AFTER_HOURS`). Check the source system and `channel_sync_runs`.                                                    | `AGENTS.md` Learnings                                            |
| Channels visits drift from GA4 by more than about 2% | Dry-run `scripts/channel-visits-repair.mjs`, then `--apply`; never run GA4 channel reports wider than one day for a repair                                                  | `AGENTS.md` Learnings; [scripts/README.md](../scripts/README.md) |
| Bookings missing from a day's pace figure            | A writer storing `raw_payload` without a nested `payload.created_at`; `scripts/repair-calendly-booked-at.mjs` repairs history                                               | `AGENTS.md` Learnings                                            |
| Calendly webhook answers 401                         | `CALENDLY_WEBHOOK_SIGNING_KEY` unset or does not match the subscription's key. Calendly shows the key once, at creation; recreate with `scripts/calendly-webhook-setup.mjs` | Script header (`scripts/calendly-webhook-setup.mjs`)             |
| Booking confirmation did not reach a chat            | `chatbot_booked` rate limit, invitee `utm_content` not equal to the conversation id, or `CALENDLY_API_TOKEN` missing; the daily reconcile cron repairs misses               | `src/app/api/chatbot/booked/route.ts`                            |
| Report email missing                                 | `RESEND_API_KEY`, `LEAD_NOTIFICATION_FROM`/`RESEND_FROM_EMAIL`, and `data-report/run` in Vercel logs                                                                        | `docs/marketing/data-audit.md`                                   |
| Search Console numbers all zero                      | GA4 service account must be a user on the property and `GSC_SITE_URL` set; the run records `skipped:` otherwise                                                             | `docs/marketing/search-console.md`                               |
| `/admin` redirects to login for a known user         | The user must exist in `app_users` with a recognised role (`viewer`, `admin`, `super_admin`)                                                                                | [SECURITY.md](SECURITY.md)                                       |
| `/admin/seo` shows "not set up"                      | The `seo_*` tables come from hand-applied migrations (`APPLY-IN-SQL-EDITOR.md` section 8)                                                                                   | [DATABASE.md](DATABASE.md)                                       |
| `next build` refuses to run                          | A Next dev server is running; stop it. Override variable is in `scripts/guard-next-build.mjs`                                                                               | README "Scripts"                                                 |

## 7. Routine tasks

- **Rotate a secret:** change it in Vercel, redeploy, then update the other side (for example
  the `vp-webinars` GitHub Actions secret for `WEBINAR_INGEST_SECRET`, the ManyChat flow header
  for `MANYCHAT_INGEST_SECRET`, the consumer of `REPORTING_API_KEY`).
- **Rotate the shared viewer password:** `scripts/create-shared-viewer.mjs` (see its README entry).
  Prefer personal `admin` accounts from `/admin/settings/users` where an audit trail matters.
- **Add or remove an admin:** `/admin/settings/users` (super admin only).
- **Add a report recipient:** set `DATA_REPORT_TO` (comma separated) and redeploy.
- **Silence the no-book alert without losing lead notifications:** `NO_BOOK_ALERT_ENABLED=false`.
