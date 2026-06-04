# Verification: scheduled-publishing-runner

## Final Status

COMPLETE

## Requirement Audit

| Requirement                                                   | Evidence                                                                                                                   | Result |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| Auto-publish due scheduled pages unattended                   | Authorized cron route published a due disposable page and returned a safe summary.                                         | PASS   |
| Protect cron route with scheduler auth                        | Missing/wrong auth returned 401; missing secret route path covered by tests; correct bearer succeeded locally.             | PASS   |
| Re-run normal publish gates before publish                    | Disposable invalid CTA/internal-link draft failed the normal publish gate and did not create a revision.                   | PASS   |
| Support first-time publish and scheduled updates              | First-time disposable publish succeeded; published-page scheduled update failure was separately proven.                    | PASS   |
| Keep old live page live when scheduled update fails           | Published-page failure preserved the original `published_revision_id` and public route returned 200 until archive cleanup. | PASS   |
| Record failed state and readable error                        | Failed proof recorded `scheduled_publish_status = failed`, attempt count, and readable validation error.                   | PASS   |
| Use America/Los_Angeles admin timezone with UTC storage       | Timezone helper tests passed; editor helper text says Pacific Time / America/Los_Angeles; DB stores timestamptz UTC.       | PASS   |
| Idempotent repeated/concurrent cron runs                      | Claim guards tested; second cron call after success scanned zero rows and created no second revision.                      | PASS   |
| Dashboard/browser proof for scheduled/failed/published states | Desktop and mobile/narrow screenshots captured dashboard/editor failed/schedule surfaces after schema migration.           | PASS   |

## Commands

- `npm run typecheck` - pass.
- `npm run lint` - pass.
- `npm test -- src/lib/services/seo-pages.test.ts src/lib/page-builder/scheduled-publishing.test.ts src/lib/services/seo-page-scheduler.test.ts src/app/api/admin/scheduled-publishing/run/route.test.ts src/app/admin/pages/actions.test.ts src/lib/admin/list-state.test.ts` - pass, 6 files, 60 tests.
- `npm test` - pass, 54 files, 303 tests.
- `npm run build` - pass.
- `npx prettier --check` on touched code/config files - pass.
- `supabase db lint --local` - pass.
- `supabase db push --yes` - pass against the linked remote project.
- Final due-row read - pass, `dueCount: 0`.
- Final local cron route smoke - pass, 401/401/200 with authorized no-op summary.

## Runtime And Boundary Proof

- Route auth smoke:
  - Missing auth: 401.
  - Wrong bearer: 401.
  - Correct bearer: 200 safe JSON summary.
  - Final authorized no-op summary: `scanned: 0`, `claimed: 0`, `published: 0`, `failed: 0`, `retried: 0`, `skipped: 0`, `errors: []`.
- Migration proof:
  - Remote migration `20260603100000_scheduled_publish_runner.sql` applied.
  - Remote schema probe confirmed scheduler columns.
- Browser proof:
  - `/tmp/scheduled-publishing-admin-pages-after.png`
  - `/tmp/scheduled-publishing-admin-pages-mobile-after-filters.png`
  - `/tmp/scheduled-publishing-editor-draft.png`
  - `/tmp/scheduled-publishing-editor-advanced-open.png`
  - `/tmp/scheduled-publishing-editor-schedule-field-visible.png`
  - `/tmp/scheduled-publishing-editor-mobile.png`
- Disposable data proof:
  - First-time invalid scheduled page failed gates, created no revision, public route remained 404, archive cleanup kept it 404.
  - First-time valid scheduled page published exactly once, second cron call scanned zero due rows, revision label was `Publish: Scheduled publish`, public route rendered 200, archive cleanup returned 404.
  - Scheduled update failure preserved the previous live revision, kept the public route live, then archive cleanup returned 404.

## Skipped Checks

- Local `supabase db push --local` did not complete because the local Supabase container/history already had unrelated migration drift and the local DB container was not available. This was not accepted as schema proof; remote migration application plus SQL lint and schema probe were used instead.
- No production Vercel invocation was run from the hosted scheduler. The route/config/auth behavior was proven locally, and production readiness depends on setting `CRON_SECRET` in Vercel.

## Behavior Preservation

- Previous intended behaviors: Manual publish, draft save, preview links, route-prefix public pages, redirects, sitemap/noindex, content-library capture, and dashboard filters.
- Intentional behavior changes: Due scheduled pages publish automatically via protected cron route; failed schedules show dashboard failure state.
- Evidence: Existing manual publish tests continued to pass; scheduled executor uses `adminPublishSeoPage`; final disposable proofs confirmed normal revision creation, publish gates, old-live-page preservation, public route behavior, and cleanup.
- Confidence: 94/100%.

## Residual Risk

- `CRON_SECRET` must be configured in Vercel before the hosted cron route can process schedules.
- Vercel cron cadence depends on deployment-plan support for the configured five-minute schedule.
- Local Supabase migration history remains drifted from unrelated prior work; remote linked project schema for this feature is current.
- Email/Slack notifications are intentionally out of scope for v1; failed schedules are visible through the dashboard and stored error state.
