# Feature Progress: scheduled-publishing-runner

Status: COMPLETE
Current wave: W5 complete
Last updated: 2026-06-03
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                             | Tier | Depends On | Parallel Group | Owner    | Status |
| ---- | ------------------------------------------------- | ---- | ---------- | -------------- | -------- | ------ |
| S0   | Verify current scheduled metadata behavior        | T0   | none       | W0-A           | verifier | DONE   |
| S1   | Add scheduler state and configuration foundation  | T2   | S0         | W1-A           | worker   | DONE   |
| S2   | Implement due-page query and atomic claim service | T2   | S1         | W2-A           | worker   | DONE   |
| S3   | Execute scheduled publishes through publish gates | T2   | S2         | W3-A           | worker   | DONE   |
| S4   | Add protected cron route and Vercel cron config   | T2   | S3         | W4-A           | worker   | DONE   |
| S5   | Complete admin scheduling UX and dashboard states | T1   | S1         | W4-B           | worker   | DONE   |
| S6   | Final end-to-end scheduler proof                  | T2   | S4, S5     | W5-A           | proof    | DONE   |

## Gate Progress

| Node | RED  | GREEN | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence                        | Confidence |
| ---- | ---- | ----- | -------- | --------- | ------------ | ------------- | ------------------------------- | ---------- |
| S0   | PASS | PASS  | N/A      | N/A       | PASS         | N/A           | `agent-runs/S0-attempt-1.md`    | 95%        |
| S1   | PASS | PASS  | PASS     | PASS      | N/A          | PASS          | `agent-runs/S1-attempt-1.md`    | 94%        |
| S2   | PASS | PASS  | PASS     | PASS      | N/A          | PASS          | `agent-runs/S2-S3-attempt-1.md` | 94%        |
| S3   | PASS | PASS  | PASS     | PASS      | PASS         | PASS          | `agent-runs/S2-S3-attempt-1.md` | 94%        |
| S4   | PASS | PASS  | PASS     | PASS      | PASS         | PASS          | `agent-runs/S4-attempt-1.md`    | 94%        |
| S5   | PASS | PASS  | PASS     | PASS      | PASS         | PASS          | `agent-runs/S5-attempt-1.md`    | 93%        |
| S6   | PASS | PASS  | PASS     | PASS      | PASS         | PASS          | `agent-runs/S6-attempt-1.md`    | 94%        |

## Blockers

| Node | Blocker | Required Decision Or Evidence |
| ---- | ------- | ----------------------------- |
| none | none    | none                          |

## Completed Evidence

- S0 verified current scheduled metadata and missing runner surfaces.
- S1 added additive scheduler attempt/lock state, server-only `CRON_SECRET`, database types, and Pacific-time helper coverage.
- S2/S3 added due-page listing, guarded claim, retry/failure recording, and publish execution through `adminPublishSeoPage`.
- S4 added protected GET route `/api/admin/scheduled-publishing/run` plus `vercel.json` five-minute cron config.
- S5 completed admin cancel/reschedule/failed-state UX and dashboard filter/rendering.
- S6 proved first-time gate failure, first-time success/idempotency, scheduled-update failure preserving old live state, public route behavior, and cleanup with disposable pages.
- Gates passed: typecheck, lint, targeted tests, full tests, build, Prettier check on touched code files, Supabase SQL lint, remote migration push, route smoke, and browser screenshots.
- Final due-row read found zero due scheduled rows; final authorized cron route smoke returned a no-op summary.

## Notes

- Created from the completed `website-builder-feedback-v2` graph after S8 shipped scheduled metadata/UI but deferred the production runner.
- Decisions copied from `plans/website-builder-feedback-v2/decisions.md` on 2026-06-03.
- Current Vercel Cron docs say cron invokes the configured `vercel.json` path with an HTTP GET, and `CRON_SECRET` is sent as an `Authorization: Bearer ...` header when configured.
- Local Next docs confirm App Router `route.ts` handlers can export `GET(request: Request)` and are public HTTP endpoints unless explicitly protected.
- Local Supabase migration replay was not available because the local container/history already had unrelated migration drift; the additive migration linted and was applied to the remote linked project successfully.
