# Decisions: scheduled-publishing-runner

## Confirmed Decisions

- 2026-06-03: This is a follow-up feature graph from `plans/website-builder-feedback-v2/`; implementation must stay inside the feature-orchestrator workflow.
- 2026-06-03: Scheduled pages should auto-publish unattended when their scheduled time arrives, not merely move to a manual review queue.
- 2026-06-03: Scheduled publishing should use Vercel Cron hitting a protected Next.js route.
- 2026-06-03: The cron route should live under the app API route tree, for example `/api/admin/scheduled-publishing/run`.
- 2026-06-03: The runner must be server-side, protected, idempotent, and must re-run normal publish gates immediately before publishing.
- 2026-06-03: Scheduled publishing UI should use American West Coast time, implemented as `America/Los_Angeles`, for admin entry and display.
- 2026-06-03: Scheduled timestamps should be stored internally as UTC/timestamptz.
- 2026-06-03: Failed scheduled publishes do not need active email/Slack notifications in v1. Dashboard failure state plus readable `scheduled_publish_error` is enough.
- 2026-06-03: Scheduled publishing should support both first-time draft publishes and scheduled updates to already-published pages.
- 2026-06-03: For published pages, the existing live page stays live until the scheduled draft is successfully published as the next revision. If the scheduled update fails, the old live page remains live.

## Safe Defaults

- 2026-06-03: Use strong technical defaults without stopping the user unless a choice affects product behavior, live data, permissions, state transitions, external contracts, destructive behavior, migration direction, or customer-visible behavior.
- 2026-06-03: Protect the Vercel Cron route with `CRON_SECRET` via `Authorization: Bearer ...`.
- 2026-06-03: Add `CRON_SECRET` validation to server config without exposing it to the client.
- 2026-06-03: Use a five-minute cron cadence unless deployment plan constraints force a wider interval.
- 2026-06-03: Readiness/publish-gate failures mark the page `failed`, record a readable error, and require admin edit/reschedule before retry.
- 2026-06-03: Transient system failures can retry up to a small fixed cap, with attempt count and last-attempt timestamp recorded.
- 2026-06-03: Successful runs set `scheduled_publish_status = published`, clear scheduler errors, and preserve the normal published revision behavior.
- 2026-06-03: The runner should be idempotent under repeated GETs and concurrent cron invocations.

## Open Questions

- None for initial runner implementation planning.

## Rejected Options

- 2026-06-03: Do not use client-side timers.
- 2026-06-03: Do not require manual final review before publishing.
- 2026-06-03: Do not add email/Slack notifications in v1.
- 2026-06-03: Do not use browser-local timezone semantics for scheduling.
