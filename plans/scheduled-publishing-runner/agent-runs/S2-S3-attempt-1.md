# Worker Report: S2/S3 - Scheduler Claim Service And Publish Executor

Status: DONE
Attempt: 1
Date: 2026-06-03

## Scope

Implemented due-page selection, idempotent claim behavior, retry/failure recording, and scheduled publish execution through the existing publish pipeline.

## RGR

- RED: Added scheduler service tests for due selection, not-due rows, failed/capped rows, claim guards, success, validation failure, transient retry, and idempotency.
- GREEN: Added `adminListDueScheduledSeoPages`, `adminClaimDueScheduledSeoPage`, and `adminRunScheduledSeoPagePublishing`; the executor calls `adminPublishSeoPage` with publish note `Scheduled publish`.
- REFACTOR: Kept scheduler orchestration in `src/lib/services/seo-page-scheduler.ts` while leaving manual publish behavior in `seo-pages.ts`.

## Gates

- Repo gate: Passed targeted scheduler/publish tests plus full suite.
- Browser gate: Not required for service node; covered by final S6 route/browser proof.
- Boundary gate: Final proof used disposable pages and archived them after checks.

## Files

- `src/lib/services/seo-page-scheduler.ts`
- `src/lib/services/seo-page-scheduler.test.ts`
- `src/lib/services/seo-pages.ts`
- `src/lib/services/seo-pages.test.ts`

## Evidence

- Validation/readiness failures record `scheduled_publish_status = failed` with a readable error.
- Transient failures remain retryable until the configured cap.
- Successful scheduled publish creates a normal immutable published revision and marks the schedule `published`.
- Scheduled update failure preserves the existing `published_revision_id` and keeps the public route live.
