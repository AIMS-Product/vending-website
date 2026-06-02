# Worker Report: S6 - Final End-To-End Scheduler Proof

Status: DONE
Attempt: 1
Date: 2026-06-03

## Scope

Ran the complete integrated proof across cron auth, due-page execution, publish gates, DB state, public route behavior, dashboard/editor UI, and cleanup.

## RGR

- RED: Initial browser/dashboard check hit a schema error because the remote Supabase project did not yet have the scheduler columns.
- GREEN: Applied the additive remote migration, reran route/browser checks, and proved first-time publish, gate failure, idempotency, and scheduled-update failure preservation with disposable pages.
- REFACTOR: Fixed dashboard governance chip wrapping on narrow viewport after rendered proof showed the failed-state chip was not consistently visible.

## Gates

- Repo gate: Passed typecheck, lint, targeted tests, full tests, Prettier check on touched code files, and build.
- Browser gate: Passed desktop and mobile/narrow admin screenshots plus public route smoke.
- Boundary gate: Remote migration applied; disposable pages were archived after public checks.

## Commands

- `npm run typecheck`
- `npm run lint`
- `npm test -- src/lib/services/seo-pages.test.ts src/lib/page-builder/scheduled-publishing.test.ts src/lib/services/seo-page-scheduler.test.ts src/app/api/admin/scheduled-publishing/run/route.test.ts src/app/admin/pages/actions.test.ts src/lib/admin/list-state.test.ts`
- `npm test`
- `npm run build`
- `npx prettier --check src/lib/page-builder/scheduled-publishing.ts src/lib/page-builder/scheduled-publishing.test.ts src/lib/services/seo-page-scheduler.ts src/lib/services/seo-page-scheduler.test.ts src/app/api/admin/scheduled-publishing/run/route.ts src/app/api/admin/scheduled-publishing/run/route.test.ts src/app/admin/pages/actions.ts src/app/admin/pages/actions.test.ts src/components/admin/seo-page-editor/SeoPublishPanel.tsx src/lib/admin/seo-pages-list.ts src/lib/admin/list-state.test.ts src/app/admin/pages/page.tsx src/lib/services/seo-pages.ts src/lib/config.ts src/types/database.ts vercel.json`
- `supabase db lint --local`
- `supabase db push --yes`

## End-To-End Evidence

- Gate-failure first-time proof: disposable page failed publish gates, recorded failed scheduler state, created no revision, public route stayed 404, and archived cleanup kept it 404.
- Success/idempotency proof: disposable page published once through the cron route, second cron call scanned zero due rows, exactly one revision existed with label `Publish: Scheduled publish`, public route rendered 200, and archived cleanup returned 404.
- Scheduled-update failure proof: an already-published disposable page kept its original live revision after the scheduled draft failed validation; public route stayed 200 until the page was archived, then returned 404.

## Residual Risk

- Production Vercel must have `CRON_SECRET` configured for the route to run.
- Cron cadence depends on the Vercel plan/runtime honoring `vercel.json`.
