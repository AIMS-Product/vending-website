# Feature Plan: Scheduled Publishing Runner

Status: READY
Last updated: 2026-06-03
Owner: feature-orchestrator

## Working Brief

- Feature: Complete scheduled publishing by adding a protected Vercel Cron runner that publishes due SEO/page-builder drafts or scheduled updates automatically.
- Primary actors: Admin content editor, scheduled publishing job, public visitor.
- Core invariant: Scheduled publishing must use the same publish gates, immutable revision snapshots, redirects, sitemap behavior, content-library capture, and draft-vs-live isolation as manual publishing.
- Previous intended behaviors: Manual publish, save draft, preview links, published resource routes, route-prefix paths, duplicate-page drafts, governance metadata, and dashboard filters must keep working.
- Intentional behavior changes: Scheduled pages auto-publish unattended when due; scheduled updates to published pages replace the live revision only after successful publish; failed schedules are visible in dashboard state with readable errors.
- Unsafe outcomes: Publishing invalid drafts, double-publishing from repeated cron invocations, leaking draft updates before the due time, silently failing jobs, running an unauthenticated public publish endpoint, publishing in the wrong timezone, or breaking manual publish.
- Evidence: `plans/website-builder-feedback-v2/decisions.md`, `plans/website-builder-feedback-v2/verification.md`, `src/lib/services/seo-pages.ts`, `src/app/admin/pages/actions.ts`, `src/app/admin/pages/page.tsx`, `src/components/admin/seo-page-editor/SeoPublishPanel.tsx`, Vercel Cron docs, local Next Route Handler docs.
- Assumptions: The project deploys on Vercel; Vercel Cron is available for the deployment plan; `CRON_SECRET` can be configured in Vercel env vars; `America/Los_Angeles` is the admin scheduling timezone.
- Out of scope: Email/Slack notifications, external analytics/webhooks/API work, legacy news migration, A/B testing, and arbitrary third-party embed scheduling.

## Risk Classification

- Overall tier: T2 because this adds a background job, auth-protected route, schema/state transitions, and live publish automation.
- Live-data risk: Medium. The runner mutates publish state and can make pages public, but only through existing publish gates and scheduled rows.
- Migration risk: Medium. Additive scheduler attempt/lock fields are needed for idempotency and observability.
- External-contract risk: Medium. Vercel Cron invocation, `CRON_SECRET`, and deployment plan cadence are platform contracts.

## Dependency Graph

| Node | Title                                             | Tier | Depends On | Parallel Group | Shared-State Risk           | Status  |
| ---- | ------------------------------------------------- | ---- | ---------- | -------------- | --------------------------- | ------- |
| S0   | Verify current scheduled metadata behavior        | T0   | none       | W0-A           | low verification            | PENDING |
| S1   | Add scheduler state and configuration foundation  | T2   | S0         | W1-A           | migration/config            | PENDING |
| S2   | Implement due-page query and atomic claim service | T2   | S1         | W2-A           | scheduler state transitions | PENDING |
| S3   | Execute scheduled publishes through publish gates | T2   | S2         | W3-A           | live publish state          | PENDING |
| S4   | Add protected cron route and Vercel cron config   | T2   | S3         | W4-A           | external cron/auth          | PENDING |
| S5   | Complete admin scheduling UX and dashboard states | T1   | S1         | W4-B           | admin UI/forms              | PENDING |
| S6   | Final end-to-end scheduler proof                  | T2   | S4, S5     | W5-A           | full-flow verification      | PENDING |

## Nodes

### S0 - Verify current scheduled metadata behavior

Status: PENDING
Tier: T0
Type: verification
Actor/trigger: Admin opens the existing page editor and pages dashboard with scheduled metadata available.
Behavior to test: Verification node; no new product behavior.
Invariant protected: The runner graph starts from rendered truth about current metadata/UI rather than assumptions from the previous implementation.
Intentional behavior changes: None.
Previous intended behaviors preserved: Existing scheduled fields render in Advanced SEO, `/admin/pages` scheduled filter exists, manual publish still works.
Unsafe outcomes: Building a runner on stale assumptions about field names, form serialization, or dashboard state.
Dependencies: none.
Expected files: Worker report only unless verification finds a blocking defect.
Write boundaries: `plans/scheduled-publishing-runner/agent-runs/` evidence only.
Acceptance criteria:

- [ ] Verify the editor exposes a scheduled publish field with timezone copy requirement still pending.
- [ ] Verify dashboard scheduled/failed states currently have a visible place to land.
- [ ] Verify existing manual publish service remains the publish entry point.

Regression guards:

- Do not mutate live pages during verification.
- Do not mark UI layout claims complete without rendered browser proof.

RGR:

- RED: Record current gaps against the runner requirements.
- GREEN: Confirm the exact files/services to modify.
- REFACTOR: None unless verification evidence needs cleanup.

Gates:

- Repo gate: None unless files change.
- Browser gate: Required for current editor/dashboard evidence.
- Boundary/migration gate: None.
  External docs needed: None.
  Parallelization: Blocking first wave.
  Worker role: verifier.
  Exit evidence: Browser notes/screenshots and current code/service pointers.
  Blocked on: none.

### S1 - Add scheduler state and configuration foundation

Status: PENDING
Tier: T2
Type: scaffold
Actor/trigger: Scheduled publishing worker needs durable state, auth config, and timezone constants.
Behavior to test: When scheduler state is stored, then attempts, last attempt time, lock/claim state, and readable errors can be recorded without changing unrelated page data.
Invariant protected: Scheduler observability and idempotency are explicit, not inferred from `scheduled_publish_status` alone.
Intentional behavior changes: Add attempt/last-attempt/lock fields; add server-only `CRON_SECRET`; add a scheduler timezone constant for `America/Los_Angeles`.
Previous intended behaviors preserved: Existing scheduled metadata columns and page save form continue to work.
Unsafe outcomes: Destructive migration, secret exposed to client bundle, status enum incompatible with existing rows, or ambiguous timezone handling.
Dependencies: S0.
Expected files: `supabase/migrations/*scheduled_publish_runner*.sql`, `src/types/database.ts`, `src/lib/config.ts`, scheduler constants/helper file.
Write boundaries: Additive schema/config/timezone foundation only.
Acceptance criteria:

- [ ] Add scheduler attempt count, last attempt timestamp, and optional lock/claim timestamp or equivalent idempotency field.
- [ ] Keep `scheduled_publish_status` backward compatible with existing values.
- [ ] Add server-only `CRON_SECRET` config support.
- [ ] Centralize `America/Los_Angeles` scheduling timezone label.
- [ ] Tests or typecheck prove new fields compile.

Regression guards:

- Existing env validation still works in local/test without requiring `CRON_SECRET` unless the cron route executes.
- Existing page list/editor type usage compiles.

RGR:

- RED: Add focused type/service expectations for scheduler state fields where practical.
- GREEN: Add additive migration and types/config updates.
- REFACTOR: Centralize scheduler constants to avoid hard-coded timezone strings.

Gates:

- Repo gate: typecheck and focused service/config tests if present.
- Browser gate: Not required for this scaffold node.
- Boundary/migration gate: Additive migration only; `supabase db push` or local migration verification required before browser proof depending on environment.
  External docs needed: Next env docs only if config behavior is unclear.
  Parallelization: Single-threaded migration/config work.
  Worker role: schema/config worker.
  Exit evidence: Migration name, typecheck, and config/test evidence.
  Blocked on: none.

### S2 - Implement due-page query and atomic claim service

Status: PENDING
Tier: T2
Type: integration
Actor/trigger: Cron runner asks for pages due at or before the current time.
Behavior to test: When cron runs, then only due scheduled pages are claimed for one execution, skipped pages are ignored, and repeated/concurrent runs cannot claim the same page twice.
Invariant protected: Idempotency and draft-vs-live isolation are enforced before publish execution starts.
Intentional behavior changes: Add scheduler service APIs for finding due pages, claiming a page, recording skipped/transient failure/gate failure/success.
Previous intended behaviors preserved: Manual publish and draft save services remain callable independently.
Unsafe outcomes: Multiple runners publish the same page, failed pages retry indefinitely, already-published schedules are reprocessed, or non-due pages publish early.
Dependencies: S1.
Expected files: `src/lib/services/seo-pages.ts` or dedicated `src/lib/services/seo-page-scheduler.ts`, service tests.
Write boundaries: Scheduler service/state transitions only; do not add route or UI in this node.
Acceptance criteria:

- [ ] Due query selects `scheduled_publish_status = scheduled` and `scheduled_publish_at <= now`.
- [ ] Claim operation is atomic enough for repeated/concurrent cron calls.
- [ ] Gate failures and transient failures can be recorded distinctly.
- [ ] Retry cap is enforced for transient failures.
- [ ] Unit tests cover due, not-due, already-failed, retry-cap, and concurrent/idempotent behavior.

Regression guards:

- Existing `adminListSeoPages` and `adminPublishSeoPage` behavior remains unchanged.
- No public client can call scheduler services directly.

RGR:

- RED: Add failing scheduler service tests for due selection and idempotent claim.
- GREEN: Implement smallest scheduler service functions.
- REFACTOR: Keep publish execution out of the due-query service if complexity grows.

Gates:

- Repo gate: scheduler service tests, existing `seo-pages.test.ts`, typecheck.
- Browser gate: Not required.
- Boundary/migration gate: Use test doubles or non-destructive disposable rows only.
  External docs needed: none.
  Parallelization: Single-threaded scheduler state work after S1.
  Worker role: scheduler service worker.
  Exit evidence: Passing service tests and clear state-transition assertions.
  Blocked on: none.

### S3 - Execute scheduled publishes through publish gates

Status: PENDING
Tier: T2
Type: integration
Actor/trigger: Claimed due page is ready for scheduled publish execution.
Behavior to test: When a due page is executed, then the existing publish pipeline runs; success creates a normal published revision, and failure leaves the old live page intact.
Invariant protected: Scheduled publishing is the same as manual publishing except for trigger source and scheduler status bookkeeping.
Intentional behavior changes: Add scheduled publish executor that calls existing publish service with a scheduler actor/context and records outcome.
Previous intended behaviors preserved: Manual publish, content-library capture, redirects, sitemap, and immutable revisions behave exactly as before.
Unsafe outcomes: Bypassing publish readiness, publishing draft content directly, overwriting live pages on failed update, duplicate content-library capture, or losing publish notes/audit context.
Dependencies: S2.
Expected files: Scheduler service/executor tests, possible publish-label helper update.
Write boundaries: Scheduled publish executor and tests; no route/UI work.
Acceptance criteria:

- [ ] Successful first-time scheduled publish creates a normal published revision.
- [ ] Successful scheduled update creates a new live revision while old live page stays live until success.
- [ ] Readiness/publish-gate failure records failed scheduler status and does not mutate live state.
- [ ] Transient error records retryable failure state until cap.
- [ ] Publish note/label identifies scheduled publish without exposing internal implementation names publicly.

Regression guards:

- Existing publish tests continue to pass.
- Content-library capture remains tied to the published revision.
- Redirect/sitemap behavior remains full-path aware.

RGR:

- RED: Add executor tests for success, gate failure, transient failure, and published-page update.
- GREEN: Implement executor using existing `adminPublishSeoPage`.
- REFACTOR: Extract failure classification if it makes tests clearer.

Gates:

- Repo gate: executor tests, existing publish tests, typecheck.
- Browser gate: Not required for service node.
- Boundary/migration gate: Non-destructive test rows/mocks only.
  External docs needed: none.
  Parallelization: Depends on S2; do not parallelize with route until executor contract is stable.
  Worker role: publish executor worker.
  Exit evidence: Tests proving success/failure state and old-live-page preservation.
  Blocked on: none.

### S4 - Add protected cron route and Vercel cron config

Status: PENDING
Tier: T2
Type: integration
Actor/trigger: Vercel Cron performs an HTTP GET to the configured route.
Behavior to test: When Vercel Cron calls the route with the correct bearer secret, then due pages are processed and a safe JSON summary is returned.
Invariant protected: The scheduled publish endpoint cannot be invoked by unauthenticated public traffic.
Intentional behavior changes: Add App Router route handler and `vercel.json` cron entry.
Previous intended behaviors preserved: Existing app routes, proxy auth rules, and admin UI routes keep working.
Unsafe outcomes: Public unauthenticated publish endpoint, cached GET response, leaking secrets/errors, wrong cron path, deployment failure from unsupported cron expression.
Dependencies: S3.
Expected files: `src/app/api/admin/scheduled-publishing/run/route.ts`, route tests, `vercel.json`, config tests.
Write boundaries: Cron route/config only.
Acceptance criteria:

- [ ] Route rejects missing/wrong `Authorization` with 401.
- [ ] Route accepts `Authorization: Bearer ${CRON_SECRET}`.
- [ ] Route forces dynamic/server execution and returns count/error summary without sensitive details.
- [ ] `vercel.json` includes cron path and schedule.
- [ ] Route tests cover auth, success, and executor failure summary.

Regression guards:

- No admin cookie/session requirement for Vercel Cron.
- No client-side exposure of `CRON_SECRET`.
- Existing API route tests still pass.

RGR:

- RED: Add route auth tests and missing-secret test.
- GREEN: Implement route and Vercel cron config.
- REFACTOR: Keep route thin; executor owns business logic.

Gates:

- Repo gate: route tests, typecheck, lint.
- Browser gate: HTTP smoke with missing auth locally can prove 401; authorized local smoke can use disposable/test setup if safe.
- Boundary/migration gate: Verify Vercel docs assumptions: cron uses GET path from `vercel.json`; `CRON_SECRET` is sent in Authorization header.
  External docs needed: Vercel Cron docs and Next.js route-handler docs in `node_modules/next/dist/docs/`, including route segment runtime and dynamic execution behavior.
  Parallelization: W4-A after S3; can run alongside S5 if write scopes remain separate.
  Worker role: cron route worker.
  Exit evidence: Tests, `vercel.json` diff, local HTTP/auth proof.
  Blocked on: none.

### S5 - Complete admin scheduling UX and dashboard states

Status: PENDING
Tier: T1
Type: behavior
Actor/trigger: Admin schedules, cancels, reschedules, or reviews a scheduled publish.
Behavior to test: When an admin manages scheduling, then timezone, scheduled/failed/published states, cancel/reschedule, and errors are understandable without opening raw schema details.
Invariant protected: Admin UI reflects scheduler state accurately and does not imply exact-to-the-second guarantees.
Intentional behavior changes: Add explicit Pacific Time label, cancel/reschedule controls, failed-state error display, and scheduled update copy.
Previous intended behaviors preserved: Existing SEO drawer fields, save draft, publish, dashboard search/status filters, and governance filters still work.
Unsafe outcomes: Browser-local timezone confusion, hidden failed jobs, stale error after reschedule, mobile overflow, or accidental immediate publish.
Dependencies: S1.
Expected files: `src/components/admin/seo-page-editor/SeoPublishPanel.tsx`, `src/app/admin/pages/actions.ts`, `src/app/admin/pages/page.tsx`, list-state tests, action tests.
Write boundaries: Admin scheduling UI/actions/dashboard state only; no cron route/executor logic.
Acceptance criteria:

- [ ] Scheduling field clearly says Pacific Time / America/Los_Angeles.
- [ ] Admin can cancel a schedule.
- [ ] Admin can reschedule after failure or before due time.
- [ ] Dashboard exposes scheduled and failed states with readable error where practical.
- [ ] Saving a schedule clears stale failure state and resets attempts.
- [ ] Mobile/narrow editor and dashboard remain usable.

Regression guards:

- Existing manual publish button remains clear and available.
- Existing governance filters do not reset unexpectedly.
- Existing page save/autosave does not publish scheduled content early.

RGR:

- RED: Add action/list tests for schedule, cancel, reschedule, and failed state.
- GREEN: Implement admin UI/actions.
- REFACTOR: Extract formatting helpers for Pacific Time if repeated.

Gates:

- Repo gate: action/list tests, typecheck, targeted lint.
- Browser gate: Required for editor Advanced SEO and dashboard scheduled/failed state on desktop and mobile/narrow.
- Boundary/migration gate: Use disposable or existing local draft; do not mutate production content without explicit approval.
  External docs needed: none.
  Parallelization: W4-B after S1; parallel-safe with S4 if route/executor write scopes stay separate.
  Worker role: admin UX worker.
  Exit evidence: Tests and Chrome screenshots/state for schedule/cancel/reschedule/failed display.
  Blocked on: none.

### S6 - Final end-to-end scheduler proof

Status: PENDING
Tier: T2
Type: verification
Actor/trigger: Feature orchestrator validates the complete scheduled publishing flow.
Behavior to test: When an admin schedules a page and the protected cron route runs after due time, then the page publishes exactly once through the normal publish pipeline.
Invariant protected: User-facing scheduled publish behavior is proven across UI, route, service, DB, and public render.
Intentional behavior changes: None beyond proving integrated behavior.
Previous intended behaviors preserved: Manual publish, preview, public render, redirects, sitemap/noindex, content-library capture, and dashboard filters.
Unsafe outcomes: Calling the runner against live production content accidentally, skipping route auth proof, or accepting service tests without rendered/admin proof.
Dependencies: S4, S5.
Expected files: `plans/scheduled-publishing-runner/verification.md`, worker evidence under `agent-runs/`.
Write boundaries: Verification artifacts only unless defects are found.
Acceptance criteria:

- [ ] Unauthenticated cron route returns 401.
- [ ] Authorized cron route processes due disposable/test page and returns a safe summary.
- [ ] Scheduled publish creates exactly one revision even if the route is called twice.
- [ ] Failed gate case records failed status and leaves old live page intact.
- [ ] Browser shows dashboard scheduled/failed/published state.
- [ ] Public route renders only after successful scheduled publish.

Regression guards:

- Do not use real production customer-facing content as the disposable test page without explicit approval.
- Do not leave unwanted public test content behind.

RGR:

- RED: Reproduce final flow gaps if any integration check fails.
- GREEN: Run complete proof.
- REFACTOR: Update verification notes and any newly found follow-up.

Gates:

- Repo gate: Full targeted suite from S1-S5 plus typecheck/lint; broader build if route/config changes warrant it.
- Browser gate: Required desktop and mobile/narrow admin checks plus public-route smoke.
- Boundary/migration gate: Migration applied to intended environment; Vercel env requirement recorded; no production publish without disposable cleanup.
  External docs needed: Vercel Cron docs for final route/config assumptions.
  Parallelization: Final single-threaded proof.
  Worker role: feature proof worker.
  Exit evidence: `verification.md` with commands, browser proof, route proof, migration proof, and confidence score.
  Blocked on: none.

## Dependency Waves

| Wave | Nodes  | Notes                                                                  |
| ---- | ------ | ---------------------------------------------------------------------- |
| W0   | S0     | Verify current UI/schema/service state before implementation.          |
| W1   | S1     | Add scheduler state/config foundation; migration is single-threaded.   |
| W2   | S2     | Due query and idempotent claim service.                                |
| W3   | S3     | Publish executor through existing publish gates.                       |
| W4   | S4, S5 | Cron route/config and admin UX can proceed in parallel after services. |
| W5   | S6     | Final end-to-end proof.                                                |

## First Unblocked Wave

S0 is ready to run. After S0, S1 is the first implementation node.
