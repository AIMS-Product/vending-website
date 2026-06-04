# Worker Report: S1 - Add scheduler state and configuration foundation

Status: DONE
Attempt: 1
Date: 2026-06-03

## Scope

Added the scheduler state, server configuration, and Pacific-time helper foundation required by the runner.

## RGR

- RED: Added/updated focused tests around scheduled publishing helpers and config-dependent route behavior before the green implementation.
- GREEN: Added `scheduled_publish_attempts`, `scheduled_publish_last_attempt_at`, and `scheduled_publish_locked_at`; added server-only optional `CRON_SECRET`; centralized `America/Los_Angeles` constants and UTC conversion helpers.
- REFACTOR: Kept timezone and display helpers in `src/lib/page-builder/scheduled-publishing.ts` instead of scattering hard-coded strings through actions and UI.

## Gates

- Repo gate: Passed via `npm run typecheck`, `npm run lint`, focused tests, full tests, and `npm run build`.
- Browser gate: Not required for this scaffold node.
- Boundary gate: `supabase db lint --local` passed; remote migration was applied with `supabase db push --yes` after migration state was verified.

## Files

- `supabase/migrations/20260603100000_scheduled_publish_runner.sql`
- `src/types/database.ts`
- `src/lib/config.ts`
- `src/lib/page-builder/scheduled-publishing.ts`
- `src/lib/page-builder/scheduled-publishing.test.ts`

## Evidence

- Remote schema probe confirmed scheduler columns exist after migration.
- `supabase migration list` showed `20260603100000 | 20260603100000` after push.
- Local `supabase db push --local` was blocked by pre-existing local migration-history drift; remote application and lint succeeded.
