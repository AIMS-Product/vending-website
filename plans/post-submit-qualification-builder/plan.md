# Feature Plan: post-submit-qualification-builder

Status: IN_PROGRESS
Last updated: 2026-06-17
Owner: feature-orchestrator

## Working Brief

- Feature: Build an opt-in post-submit qualification system for Vendingpreneurs
  landing/SEO pages. A short contact form captures name/email/phone and
  attribution, creates or updates the local lead and Close CRM contact, then
  immediately redirects to a mandatory Typeform-style qualification flow that
  appends step-by-step answers to the same contact.
- Primary actors: public prospects on SEO/landing pages; admins creating
  qualification forms in `/admin/forms`; admins attaching qualification forms to
  page-builder `lead_form` blocks; operators reviewing `/admin/leads`; protected
  cron/admin retry runner processing Close sync events.
- Core invariant: local database persistence is the source of truth. A prospect
  must never lose their captured contact because Close credentials, Close API,
  notifications, or follow-up qualification fail.
- Previous intended behaviors: current `/apply`, `/contact`, legacy lead routes,
  existing `lead_submissions`, existing page-builder `lead_form` blocks, UTM and
  source attribution, admin auth/RLS, and SEO page publishing continue to work
  unless a page/block explicitly opts into the new qualification flow.
- Intentional behavior changes: opt-in page-builder lead forms become short
  name/email/phone capture forms; opt-in submits create a qualification session
  and redirect to `/qualify/[sessionToken]`; admins can build versioned
  qualification forms; operators can inspect qualification state and Close sync
  state; Close sync runs through retryable events.
- Unsafe outcomes: losing contact rows, creating duplicate Close contacts,
  blocking conversion on Close failure, leaking PII through public tokens,
  exposing qualification answers publicly, mutating existing apply/contact
  behavior, corrupting immutable form-version analytics, shipping admin UI that
  hides failed syncs, or running live Close writes without credentials/approval.
- Evidence: `decisions.md` in this folder; existing lead capture in
  `src/lib/services/leads.ts`; attribution in `src/lib/lead-attribution.ts` and
  `src/lib/page-builder/resource-lead-attribution.ts`; admin/page-builder design
  contracts in `docs/design/`; AGENTS.md release-train and browser verification
  rules.
- Assumptions: Close credentials are unavailable during initial build. Close API
  behavior is developed against mocked fetch tests and official Close docs, with
  final live proof blocked until credentials and custom-field IDs exist.
- Out of scope: live A/B traffic assignment, standalone public survey URLs,
  replacing `/apply` globally, opportunity creation, CSV export, dashboards,
  attribution reporting, file uploads, payments, calendar booking, conditional
  branching, arbitrary scripts, and automated lead scoring.

## Risk Classification

- Overall tier: T1. This touches customer-facing lead capture, PII, CRM sync,
  lifecycle state transitions, migrations, and protected admin operations.
- Live-data risk: medium. Implementation should use local/test data only until a
  disposable production-proof plan is explicitly approved. Close live writes are
  blocked until credentials and field mappings exist.
- Migration risk: high. Migrations add PII-adjacent tables and lead status/Close
  fields. They must be additive, reversible by follow-up migration, RLS-gated,
  and tested locally before any remote push.
- External-contract risk: high. Close API integration must be optional,
  retryable, idempotent where practical, and verified with official docs plus
  mocked adapter tests before live credentials exist.

## Dependency Graph

| Node | Title                                         | Tier | Depends On       | Parallel Group | Shared-State Risk                         | Status  |
| ---- | --------------------------------------------- | ---- | ---------------- | -------------- | ----------------------------------------- | ------- |
| S1   | Data model, RLS, generated types              | T1   | none             | W1-A           | migrations/types, single-threaded         | DONE    |
| S2   | Qualification form schema and services        | T1   | S1               | W2-A           | shared domain contracts                   | DONE    |
| S3   | Lead capture to qualification session service | T1   | S1,S2            | W3-A           | lead state transitions                    | DONE    |
| S4   | Close adapter, sync events, retry runner      | T1   | S1,S3            | W4-A           | external adapter, single-threaded         | DONE    |
| S5   | Public qualification backend route/actions    | T1   | S2,S3            | W4-B           | token/session state                       | DONE    |
| S6   | Public Typeform-style runtime design and UI   | T2   | S5               | W5-A           | browser-visible UI                        | DONE    |
| S7   | Admin qualification forms builder             | T2   | S2               | W5-B           | admin UI + form services                  | DONE    |
| S8   | Page/block attachment settings                | T2   | S2               | W5-C           | page-builder schema/editor                | DONE    |
| S9   | Opt-in lead-form public integration           | T1   | S3,S5,S8         | W6-A           | public conversion path                    | DONE    |
| S10  | Admin leads backstop and retry controls       | T2   | S4,S5            | W6-B           | admin ops UI                              | DONE    |
| S11  | Stale/expired lifecycle jobs and Close tasks  | T2   | S4,S10           | W7-A           | background state transitions              | DONE    |
| S12  | End-to-end proof and cleanup                  | T1   | S6,S7,S9,S10,S11 | W8-A           | browser + boundary proof, single-threaded | PENDING |

Browser gates must run serially during integration because this repo uses a
shared dev server and production-linked Supabase risk has existed in prior
builder work. Use disposable records only and clean them up.

## Worker Waves

- W1: S1 only. Migrations/generated types are shared state and must be
  single-threaded.
- W2: S2 only. Establish domain contracts before UI and public flow code.
- W3: S3 only. Lead/session state transitions are T1 and should settle before
  Close and runtime work.
- W4: S4 and S5 can run in parallel if S4 stays inside Close/sync files and S5
  stays inside qualification route/session actions. Integration must verify the
  shared event contracts.
- W5: S6, S7, and S8 can run in parallel after their dependencies if write scopes
  are enforced. S6 must use the frontend design skill and Image Gen concepting
  before implementation.
- W6: S9 and S10 can run in parallel. S9 owns public conversion behavior; S10
  owns admin operational visibility.
- W7: S11 after admin retry and Close sync foundations are proven.
- W8: S12 final proof, full integration checks, and cleanup.

## Nodes

### S1 - Data model, RLS, generated types

Status: DONE
Tier: T1
Type: scaffold
Actor/trigger: migration runner applies the feature schema.
Behavior to test: When migrations apply locally, then qualification forms,
immutable versions, sessions, answers, lead lifecycle fields, and Close sync
events exist with RLS/admin policies and no anonymous PII access.
Invariant protected: existing `lead_submissions` rows and existing SEO page data
remain valid; current public lead forms still submit.
Intentional behavior changes: new additive tables and lead status/Close fields.
Previous intended behaviors preserved: existing lead fields, indexes, status
values, and admin read access still work.
Unsafe outcomes: destructive migration, anon read/write to PII, token stored in
plaintext, hard dependency on Close config, broken generated database types.
Dependencies: none.
Expected files:

- `supabase/migrations/*_post_submit_qualification.sql`
- `src/types/database.ts`
- targeted migration/type tests as needed
  Write boundaries: migrations and generated/typed DB contract files only.
  Acceptance criteria:
- [x] Additive migration for `qualification_forms`,
      `qualification_form_versions`, `qualification_sessions`,
      `qualification_answers`, and `close_sync_events`.
- [x] Add lead fields for lifecycle status, qualification summary, Close IDs,
      and latest qualification/session timestamps without removing old status values.
- [x] Token lookup uses a hash or equivalent non-email/non-lead-ID public token
      storage.
- [x] RLS blocks anon access to qualification answers and sync events; admin
      policies follow existing `app_users` pattern.
- [x] Useful indexes exist for lead, email/lower email, session token hash,
      status, `next_retry_at`, Close IDs, source/variant, and created timestamps.
      Regression guards:
- Existing `submitLead` tests still pass.
- Existing page-builder lead attribution tests still pass.
  RGR:
- RED: migration/type tests or schema assertions fail before fields/tables exist.
- GREEN: additive migration + type contract passes.
- REFACTOR: name/index/policy cleanup only after tests pass.
  Gates:
- Repo gate: targeted tests plus `npm run typecheck`.
- Browser gate: skipped for schema-only node.
- Boundary/migration gate: local migration reset or equivalent non-production DB
  migration proof; never push remote DB without explicit approval.
  External docs needed: Supabase RLS/migration behavior only if unfamiliar local
  pattern is insufficient.
  Parallelization: single-threaded.
  Worker role: schema/data foundation worker.
  Exit evidence: migration diff, local migration command output, targeted tests,
  and generated type diff.
  Blocked on: none.

### S2 - Qualification form schema and services

Status: DONE
Tier: T1
Type: behavior
Actor/trigger: admin creates/edits/publishes a qualification form; public flow
loads a published immutable version.
Behavior to test: When an admin publishes a draft form, then a new immutable
version is created and future sessions use that version while existing sessions
continue on their original version.
Invariant protected: old answer analytics remain readable after form edits.
Intentional behavior changes: new form schema, default form, versioning, question
validation, normalized-role handling.
Previous intended behaviors preserved: no change to SEO page block validation
yet.
Unsafe outcomes: changing active sessions under users, accepting unsupported
question types, losing question/option snapshots, making design settings
editable.
Dependencies: S1.
Expected files:

- `src/lib/qualification/forms.ts`
- `src/lib/services/qualification-forms.ts`
- `src/lib/services/qualification-forms.test.ts`
- optional seed/default-form helper
  Write boundaries: qualification domain/service files and tests only.
  Acceptance criteria:
- [x] Zod schema covers approved v1 question types and rejects branching/scripts.
- [x] Draft edit and publish flow creates immutable versions.
- [x] A single default form can be resolved.
- [x] Question and option snapshots are serializable for answer storage.
- [x] Normalized roles support budget, timeline, state/market, business stage,
      goal, available capital, location status, machine goal, consent, and contact
      preference.
      Regression guards:
- Publishing a second version does not mutate the first.
- Existing sessions load by version ID, not latest form draft.
  RGR:
- RED: service tests for publish/version immutability fail.
- GREEN: implement minimal services.
- REFACTOR: consolidate validators/helpers.
  Gates:
- Repo gate: targeted service tests and typecheck.
- Browser gate: skipped until admin UI node.
- Boundary/migration gate: service tests use injected client or safe test double.
  External docs needed: none beyond repo Supabase service patterns.
  Parallelization: blocking domain node.
  Worker role: domain-service worker.
  Exit evidence: failing-then-passing tests and service API summary.
  Blocked on: none.

### S3 - Lead capture to qualification session service

Status: DONE
Tier: T1
Type: behavior
Actor/trigger: opt-in short contact form submits from a page-builder lead form.
Behavior to test: When an opt-in lead form submits name/email/phone with
attribution, then the app saves/reuses a local lead, creates a qualification
session for the resolved form version, enqueues Close create/update sync, and
returns a safe `/qualify/[token]` URL.
Invariant protected: Close failure cannot block local capture or session creation.
Intentional behavior changes: opt-in forms enter qualification flow instead of
showing final success immediately.
Previous intended behaviors preserved: non-opt-in `/apply`, `/contact`, and
legacy lead routes continue returning current success state.
Unsafe outcomes: dropped lead, duplicate local/Close records from retry,
plaintext token, lost attribution, Close dependency in transaction path.
Dependencies: S1, S2.
Expected files:

- `src/lib/services/qualification-intake.ts`
- `src/lib/services/qualification-intake.test.ts`
- small additions around `src/lib/services/leads.ts` only if needed
  Write boundaries: intake/lead service code and tests; no public UI yet.
  Acceptance criteria:
- [x] Required first step is full name, email, phone; all richer fields move to
      qualification.
- [x] Email dedupe reuses local Close IDs when available and records a new
      submission/session touchpoint.
- [x] Attribution captures source path, landing path, UTM, referrer,
      page/block/CTA, experiment, variant, form/version, and completion redirect.
- [x] Missing Close config creates retryable sync event without user-facing
      error.
- [x] Token expires after 30 days and stale date is 7 days.
      Regression guards:
- Existing `submitLead` apply/contact validation still passes.
- Duplicate idempotency behavior remains stable for non-opt-in forms.
  RGR:
- RED: intake behavior tests fail before service exists.
- GREEN: minimal service implementation.
- REFACTOR: shared attribution/session helpers.
  Gates:
- Repo gate: targeted tests plus typecheck.
- Browser gate: skipped until public integration node.
- Boundary/migration gate: no live Close; mocked sync event only.
  External docs needed: none.
  Parallelization: blocking T1 service node.
  Worker role: lead-intake worker.
  Exit evidence: behavior tests, state transition examples, no changes to legacy
  form behavior.
  Blocked on: none.

### S4 - Close adapter, sync events, retry runner

Status: DONE
Tier: T1
Type: integration
Actor/trigger: lead intake, qualification completion, stale-session job, or admin
retry requests a Close sync.
Behavior to test: When a Close sync event is due, then the processor attempts the
correct Close create/update/note/task operation, records success IDs or
retry/dead-letter state, and never leaks credentials or blocks visitor flow.
Invariant protected: local DB remains source of truth; Close writes are
idempotent/retryable where practical.
Intentional behavior changes: new optional Close integration through env config.
Previous intended behaviors preserved: existing email/Slack notifications
continue independently.
Unsafe outcomes: printing API keys, live writes in tests, duplicate Close
contacts, wrong contact chosen from duplicate Close matches, infinite retry loop,
user-visible CRM errors.
Dependencies: S1, S3.
Expected files:

- `src/lib/close/client.ts`
- `src/lib/close/sync.ts`
- `src/lib/close/sync.test.ts`
- `src/lib/config.ts`
- protected route/action for retry runner, e.g.
  `src/app/api/admin/close-sync/run/route.ts`
  Write boundaries: Close integration files, config, protected retry route/actions,
  tests.
  Acceptance criteria:
- [x] `CLOSE_API_KEY` optional env added without breaking local dev.
- [x] Client uses mocked fetch in tests; no live Close calls in CI/local tests.
- [x] Search-by-email duplicate strategy follows decisions: local mapping first,
      single clear Close match second, `needs_review` if ambiguous.
- [x] Event statuses: pending, retrying, synced, failed, dead_letter,
      needs_review.
- [x] Backoff updates `attempt_count`, `next_retry_at`, and `last_error`.
- [x] Completion writes readable Close note/activity payload and selected custom
      fields only when configured.
- [x] Stale qualification can enqueue a follow-up task event.
      Regression guards:
- Missing Close config degrades to retryable failure, not thrown visitor error.
- Failed Close response stores bounded error text, not full secret-bearing data.
  RGR:
- RED: adapter/sync event tests fail before client exists.
- GREEN: implement mocked adapter + processor.
- REFACTOR: split payload builders from HTTP client.
  Gates:
- Repo gate: targeted Close tests and typecheck.
- Browser gate: skipped for adapter.
- Boundary/migration gate: no live Close proof until credentials exist; document
  skip in verification.
  External docs needed: current official Close API docs for Leads, Contacts,
  Custom Fields, Activities/Notes, and Tasks before implementation.
  Parallelization: can run with S5 after S3, but integration must be serial.
  Worker role: external-adapter worker.
  Exit evidence: mocked request/response tests, retry-state tests, config behavior.
  Blocked on: final live Close proof requires real credentials and field IDs.

### S5 - Public qualification backend route/actions

Status: DONE
Tier: T1
Type: behavior
Actor/trigger: prospect opens `/qualify/[sessionToken]`, advances steps, or
completes qualification.
Behavior to test: When a valid session token is used, then the server loads the
immutable form version, saves each answer step-by-step, resumes at the first
unanswered required question, and completes the session with redirect metadata.
Invariant protected: token URL does not expose lead ID/email and cannot read
other users' answers.
Intentional behavior changes: new public session-token qualification route.
Previous intended behaviors preserved: existing public routes and preview routes
continue resolving.
Unsafe outcomes: accepting expired token, overwriting answers from another
session, losing partial answers, completing without required consent, open
redirect, PII leak.
Dependencies: S2, S3.
Expected files:

- `src/app/qualify/[sessionToken]/page.tsx`
- `src/app/qualify/[sessionToken]/actions.ts`
- `src/lib/services/qualification-sessions.ts`
- `src/lib/services/qualification-sessions.test.ts`
  Write boundaries: qualification route/actions/session services/tests.
  Acceptance criteria:
- [x] Valid token loads session; expired/unknown token shows branded unavailable
      state without PII.
- [x] Autosave persists answer snapshots and normalized values per Continue.
- [x] Resume chooses first unanswered required question.
- [x] Back navigation can edit previous answers.
- [x] Completion requires all required answers and consent when present.
- [x] Completion enqueues Close enrichment sync and resolves safe redirect path.
      Regression guards:
- Re-loading completed session does not duplicate completion sync events.
- Redirect path rejects external URLs.
  RGR:
- RED: session lifecycle tests fail.
- GREEN: route actions/service pass.
- REFACTOR: isolate token and answer validation helpers.
  Gates:
- Repo gate: targeted session tests and typecheck.
- Browser gate: basic route smoke in later UI node.
- Boundary/migration gate: mocked DB/service tests only.
  External docs needed: local Next docs under `node_modules/next/dist/docs/` before
  route/action implementation.
  Parallelization: can run with S4 after S3.
  Worker role: public-backend worker.
  Exit evidence: lifecycle tests, token/expiry tests, redirect guard tests.
  Blocked on: none.

### S6 - Public Typeform-style runtime design and UI

Status: DONE
Tier: T2
Type: behavior
Actor/trigger: prospect answers qualification questions.
Behavior to test: When a prospect uses the qualification runtime on desktop or
mobile, then they see a beautiful one-question-at-a-time experience with visible
progress, clear Back/Continue controls, saved state, validation, and completion
without layout overflow.
Invariant protected: mandatory flow is firm but not hostile; accessibility and
mobile usability remain intact.
Intentional behavior changes: new customer-facing Typeform-style runtime.
Previous intended behaviors preserved: site header/footer behavior unaffected
unless design intentionally suppresses them for `/qualify`.
Unsafe outcomes: clipped questions, inaccessible controls, text overflow,
browser-default form styling, aggressive lock-in messaging, unsaved answer loss.
Dependencies: S5.
Expected files:

- `src/components/qualification/QualificationRuntime.tsx`
- `src/components/qualification/*.tsx`
- runtime CSS/classes in existing Tailwind conventions
- tests under `src/components/qualification/`
- design concept artifact path under `plans/post-submit-qualification-builder/`
  Write boundaries: qualification runtime components, styles/tests, and design
  artifacts only.
  Acceptance criteria:
- [x] Use `build-web-apps:frontend-app-builder` and `imagegen` before coding the
      runtime UI.
- [x] Generate and save an accepted concept/reference for the runtime screen(s).
- [x] One question per screen, `n of total` progress, Back/Continue, keyboard and
      screen-reader accessible controls.
- [x] Supports all v1 question types with polished states.
- [x] Desktop and mobile screenshots verified against concept; no overflow or
      overlap.
- [x] Refresh/resume and validation errors are browser-tested.
      Regression guards:
- Completed/current answer state renders from server data without hydration
  mismatch.
- Reduced-motion preference does not break progress/transition behavior.
  RGR:
- RED: component/interaction tests fail for key controls.
- GREEN: implement runtime from accepted design.
- REFACTOR: component split and token cleanup.
  Gates:
- Repo gate: targeted component tests, typecheck, lint for changed files.
- Browser gate: real desktop and mobile screenshots; use `view_image` on concept
  and latest screenshots before marking done.
- Boundary/migration gate: no live data; disposable/mock session only.
  External docs needed: local Next docs if route/client boundary is changed.
  Parallelization: can run with S7/S8 after S5.
  Worker role: public-runtime UI worker.
  Exit evidence: concept path, screenshots, browser actions, tests.
  Blocked on: none.

### S7 - Admin qualification forms builder

Status: BLOCKED
Tier: T2
Type: behavior
Actor/trigger: admin manages qualification forms in `/admin/forms`.
Behavior to test: When an admin creates or edits a qualification form, then they
can add/reorder/delete supported questions, publish an immutable version, set a
default form, and preview without changing public sessions already in progress.
Invariant protected: admins edit content/sequencing only, not visual design or
scripts.
Intentional behavior changes: new `/admin/forms` surface.
Previous intended behaviors preserved: existing admin navigation, auth, settings,
pages/news/media surfaces unaffected.
Unsafe outcomes: raw JSON/schema UI, design controls, broken mobile admin
layout, invalid form publish, accidental mutation of published versions.
Dependencies: S2.
Expected files:

- `src/app/admin/forms/page.tsx`
- `src/app/admin/forms/[id]/page.tsx`
- `src/app/admin/forms/actions.ts`
- `src/components/admin/QualificationFormsManager.tsx`
- `src/components/admin/QualificationFormEditor.tsx`
- tests for actions/services/components
  Write boundaries: admin forms route/components/actions, admin nav registration,
  tests.
  Acceptance criteria:
- [x] Admin list shows draft/published/default state and create action.
- [x] Editor supports question labels, help text, placeholder, options,
      required, normalized role, and reorder.
- [x] Publish creates immutable version and clear confirmation.
- [x] Set default form action is admin-gated.
- [x] No visual design controls, scripts, branching, file upload, or payment
      fields.
- [x] Admin preview exists but cannot create real public submissions.
      Regression guards:
- Existing admin shell/nav tests continue passing.
- Publishing invalid/empty required question is blocked with user-facing error.
  RGR:
- RED: action/service tests fail for publish/default/reorder.
- GREEN: implement admin surface.
- REFACTOR: extract admin question editor primitives.
  Gates:
- Repo gate: targeted tests, typecheck, lint for changed files.
- Browser gate: `/admin/forms` desktop and mobile; create, edit, publish,
  reload proof.
- Boundary/migration gate: admin auth/RLS proof via service/action tests.
  External docs needed: local Next docs for server actions if changing patterns.
  Parallelization: can run with S6/S8.
  Worker role: admin-forms worker.
  Exit evidence: tests, screenshots, save/reload proof.
  Blocked on: none. Browser proof completed in `agent-runs/S7-attempt-2.md`.

### S8 - Page/block attachment settings

Status: DONE
Tier: T2
Type: behavior
Actor/trigger: admin configures qualification form defaults on a page or override
on a `lead_form` block.
Behavior to test: When a page has a default qualification form and a block has an
override, then the public session resolves the block override; otherwise it uses
page default; otherwise the global default.
Invariant protected: technical tracking fields stay out of the main canvas and
layout variants remain locked.
Intentional behavior changes: page/block settings can select qualification form,
completion redirect, experiment key, and variant key.
Previous intended behaviors preserved: existing lead form block content editing
and publish blockers still work.
Unsafe outcomes: raw schema labels in canvas, broken block validation, invalid
redirects, accidental design controls, unpublishable legacy blocks.
Dependencies: S2.
Expected files:

- `src/lib/page-builder/blocks.ts`
- `src/lib/page-builder/resource-lead-attribution.ts`
- `src/components/admin/seo-page-editor/BlockSettingsFields.tsx`
- page settings action/form data files under `src/components/admin/seo-page-editor/`
- `src/app/admin/pages/actions.ts`
- tests under page-builder/editor areas
  Write boundaries: page-builder schema/settings/editor files and tests only.
  Acceptance criteria:
- [x] Page-level default qualification form and completion redirect persisted.
- [x] Lead form block-level override persisted in settings, not prominent canvas.
- [x] Experiment/variant fields are optional and stored for S9 session handoff.
- [x] Redirect path validation is internal-path only.
- [x] Legacy blocks without settings remain valid.
      Regression guards:
- Existing block validation and editor form-data tests pass.
- Publish readiness still requires CTA/lead form as before.
  RGR:
- RED: schema/settings tests fail before fields exist.
- GREEN: add settings.
- REFACTOR: shared resolver helper.
  Gates:
- Repo gate: targeted page-builder/editor tests and typecheck.
- Browser gate: `/admin/pages/new` or disposable page editor settings proof.
- Boundary/migration gate: no live publish; disposable draft only.
  External docs needed: local Next docs only if route/action behavior changes.
  Parallelization: can run with S6/S7.
  Worker role: page-builder attachment worker.
  Exit evidence: settings resolution tests and browser proof.
  Blocked on: none. Browser proof completed in `agent-runs/S8-attempt-2.md`.

### S9 - Opt-in lead-form public integration

Status: DONE
Tier: T1
Type: integration
Actor/trigger: public visitor submits an opted-in page-builder `lead_form` block.
Behavior to test: When the visitor submits name/email/phone on an opted-in block,
then the app stores the contact, enqueues Close sync, creates a session using
resolved page/block/default configuration, and redirects to `/qualify/[token]`.
Invariant protected: non-opt-in lead forms and existing apply/contact flows
remain unchanged.
Intentional behavior changes: opted-in block renders short contact fields and
mandatory next-step redirect.
Previous intended behaviors preserved: lead attribution hidden fields and
resource page rendering remain correct.
Unsafe outcomes: broken public conversion path, duplicated submissions on retry,
lost attribution, no redirect, user-visible Close error.
Dependencies: S3, S5, S8.
Expected files:

- `src/components/forms/PublicLeadForm.tsx` or a new opt-in short form component
- `src/components/sections/ResourcePageRenderer.tsx`
- `src/components/sections/ResourcePageContent.tsx`
- new or updated server action for qualification intake
- tests for public render/action behavior
  Write boundaries: public lead form integration files and tests only.
  Acceptance criteria:
- [x] Opt-in block renders only required name/email/phone plus hidden
      attribution.
- [x] Submit redirects to token route on success.
- [x] Error state still returns field errors without losing entered values.
- [x] Non-opt-in forms use existing behavior.
- [x] Source page/block/CTA/UTM/experiment/variant are preserved.
      Regression guards:
- Existing `PublicLeadForm` tests pass or are split to preserve legacy behavior.
- Resource page lead attribution test proves page/block identity still forced.
  RGR:
- RED: public integration/action tests fail.
- GREEN: implement opt-in path.
- REFACTOR: completed narrow route/test cleanup; no separate component needed.
  Gates:
- Repo gate: targeted forms/resource tests and typecheck.
- Browser gate: disposable page/block submit through to `/qualify/[token]`.
- Boundary/migration gate: local/disposable data only; no live Close required.
  External docs needed: local Next docs for redirect/server action behavior.
  Parallelization: can run with S10 after dependencies.
  Worker role: public-integration worker.
  Exit evidence: tests, browser redirect proof, legacy behavior proof.
  Blocked on: none.

### S10 - Admin leads backstop and retry controls

Status: DONE
Tier: T2
Type: behavior
Actor/trigger: admin reviews lead capture, qualification, and Close sync state.
Behavior to test: When an admin opens `/admin/leads`, then they can filter leads
by lifecycle/sync state, inspect source and qualification answers, and retry
failed Close sync events without CSV/reporting features.
Invariant protected: PII remains admin-gated; failed Close sync is visible and
recoverable.
Intentional behavior changes: new operational lead backstop UI.
Previous intended behaviors preserved: no change to notification behavior.
Unsafe outcomes: PII exposed to anon/non-admin, hidden failed syncs, raw
implementation labels, retry button creates duplicate events.
Dependencies: S4, S5.
Expected files:

- `src/app/admin/leads/page.tsx`
- `src/app/admin/leads/[id]/page.tsx` or drawer component
- `src/app/admin/leads/actions.ts`
- `src/components/admin/AdminLeadsManager.tsx`
- `src/lib/services/lead-admin.ts`
- tests for service/actions
  Write boundaries: admin leads route/components/actions/services/tests.
  Acceptance criteria:
- [x] List includes lead/contact identity, lifecycle status, qualification state,
      Close sync state, source/UTM/variant, and created date.
- [x] Detail view shows answer snapshots and normalized summary.
- [x] Retry action enqueues or advances failed/needs-review Close sync safely.
- [x] No CSV, dashboard, A/B winner, or attribution report UI.
- [x] Mobile/desktop admin layout verified.
      Regression guards:
- Admin auth required; service/action tests enforce it.
- Retrying a synced event is blocked or no-op.
  RGR:
- RED: service/action tests fail before implementation.
- GREEN: implement list/detail/retry.
- REFACTOR: table/detail component cleanup.
  Gates:
- Repo gate: targeted admin lead tests, typecheck, lint.
- Browser gate: `/admin/leads` desktop/mobile, filters, detail, retry disabled or
  test event proof.
- Boundary/migration gate: no live Close; retry uses mocked/failed event.
  External docs needed: none.
  Parallelization: can run with S9.
  Worker role: admin-leads worker.
  Exit evidence: tests, screenshots, retry proof.
  Blocked on: none. Browser proof completed in `agent-runs/S10-attempt-2.md`.

### S11 - Stale/expired lifecycle jobs and Close tasks

Status: DONE
Tier: T2
Type: ops
Actor/trigger: protected cron/admin runner marks stale/expired sessions and
enqueues Close follow-up tasks.
Behavior to test: When qualification sessions pass stale or expiry thresholds,
then lifecycle statuses update idempotently and Close task sync events are
created only as configured.
Invariant protected: completed sessions are not downgraded; stale/expired jobs
do not spam tasks.
Intentional behavior changes: 7-day stale and 30-day expired lifecycle handling.
Previous intended behaviors preserved: regular scheduled-publishing runner and
admin APIs unaffected.
Unsafe outcomes: repeated task creation, completing expired sessions, changing
qualified leads to stale, unprotected cron endpoint.
Dependencies: S4, S10.
Expected files:

- `src/lib/services/qualification-lifecycle.ts`
- `src/app/api/admin/qualification-lifecycle/run/route.ts` or shared admin runner
- tests for lifecycle transitions
  Write boundaries: lifecycle service, protected route, tests.
  Acceptance criteria:
- [x] Pending sessions older than stale threshold become `qualification_stale`.
- [x] Expired sessions become `qualification_expired`.
- [x] Qualified/completed sessions are preserved.
- [x] Stale task sync events are idempotent.
- [x] Protected route follows existing `CRON_SECRET` or admin pattern.
      Regression guards:
- Scheduled publishing cron behavior untouched.
- Sync event retry statuses unaffected.
  RGR:
- RED: lifecycle tests fail.
- GREEN: implement job.
- REFACTOR: shared runner auth helper if useful.
  Gates:
- Repo gate: lifecycle tests and typecheck.
- Browser gate: skipped; admin visibility covered in S10.
- Boundary/migration gate: no live Close proof; queued events only.
  External docs needed: local Next docs for route handlers if needed.
  Parallelization: after S4/S10 only.
  Worker role: lifecycle worker.
  Exit evidence: transition tests, auth proof, idempotency tests, and route
  regression tests recorded in `agent-runs/S11-attempt-1.md`.
  Blocked on: none.

### S12 - End-to-end proof and cleanup

Status: PENDING
Tier: T1
Type: verification
Actor/trigger: orchestrator verifies the complete opted-in qualification flow.
Behavior to test: When a disposable page-builder lead form opts into a default
qualification form, then a public visitor can submit short contact, resume and
complete qualification, admins can inspect the lead and retry sync state, and
legacy forms remain unchanged.
Invariant protected: no unapproved live data mutation, no broken public routes,
no hidden failed syncs, no regressions to existing apply/contact.
Intentional behavior changes: full opted-in flow works.
Previous intended behaviors preserved: `/apply`, `/contact`, legacy lead routes,
non-opt-in lead form blocks, admin pages list/editor.
Unsafe outcomes: incomplete browser proof, stale dev server, unclean disposable
records, unverified mobile layout, overclaiming live Close without credentials.
Dependencies: S6, S7, S9, S10, S11.
Expected files:

- `plans/post-submit-qualification-builder/verification.md`
- `plans/post-submit-qualification-builder/agent-runs/*`
- optional evidence screenshots under reports/evidence if repo pattern requires
  Write boundaries: verification artifacts only unless fixing discovered bugs.
  Acceptance criteria:
- [ ] All implementation nodes DONE or explicitly SKIPPED/BLOCKED with accepted
      reasons.
- [ ] Full targeted repo gate run over changed areas.
- [ ] Typecheck and build run when practical.
- [ ] Browser proof covers public desktop/mobile qualification, admin forms,
      page/block attachment, admin leads, and legacy apply/contact smoke.
- [ ] Close live proof is marked skipped/blocked until credentials exist; mocked
      Close proof is fresh and complete.
- [ ] Disposable records cleaned up or documented if retained by immutable audit
      convention.
      Regression guards:
- Existing lead tests and page-builder tests pass.
- No custom domain checks are required before DNS/domain cutover.
  RGR:
- RED/GREEN/REFACTOR: not applicable except for bugs discovered during proof.
  Gates:
- Repo gate: targeted + full practical suite.
- Browser gate: required.
- Boundary/migration gate: local migration proof, no live Close without creds.
  External docs needed: official Close docs if any adapter behavior changed after
  mock implementation.
  Parallelization: single-threaded final proof.
  Worker role: feature-proof / orchestrator.
  Exit evidence: completed `verification.md`, screenshots/routes/commands, cleanup
  summary.
  Blocked on: live Close CRM proof requires `CLOSE_API_KEY`, Close custom field IDs,
  and approved test Close account/records.
