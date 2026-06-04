# Worker Report: S4 - Protected Cron Route And Vercel Config

Status: DONE
Attempt: 1
Date: 2026-06-03

## Scope

Added a protected App Router cron endpoint and Vercel cron configuration.

## RGR

- RED: Added route tests for missing secret, missing/wrong auth, success, and executor failure.
- GREEN: Implemented `GET(request: Request)` at `/api/admin/scheduled-publishing/run`; route requires exact `Authorization: Bearer ${CRON_SECRET}`, forces dynamic execution, and returns a safe JSON summary.
- REFACTOR: Kept the route thin; scheduler service owns business logic and failure classification.

## Gates

- Repo gate: Passed route tests, typecheck, lint, full tests, and build.
- Browser/HTTP gate: Local smoke returned 401 for missing/wrong auth and 200 for correct bearer auth.
- Boundary gate: Uses optional server-only `CRON_SECRET`; missing production env returns 503 instead of exposing an unauthenticated runner.

## Files

- `src/app/api/admin/scheduled-publishing/run/route.ts`
- `src/app/api/admin/scheduled-publishing/run/route.test.ts`
- `vercel.json`
- `src/lib/config.ts`

## Evidence

- Local route smoke:
  - No auth: 401 `Unauthorized.`
  - Wrong bearer: 401 `Unauthorized.`
  - Correct bearer: 200 safe scheduler summary.
- Build output included dynamic route `ƒ /api/admin/scheduled-publishing/run`.
- `vercel.json` schedules `/api/admin/scheduled-publishing/run` every five minutes.
