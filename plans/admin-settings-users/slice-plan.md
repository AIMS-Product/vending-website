# Admin Settings Users Thin Slice Plan

Status: COMPLETE
Last updated: 2026-06-01
Owner: Codex

## Working Brief

- Feature or fix: Replace admin magic-link auth with Supabase email/password auth, add first-party forgot/reset password routes, add `admin`/`super_admin` account roles, and add an Admin Settings users page where only super admins can invite, resend setup/reset, change roles, and remove access.
- Primary actors: `super_admin` account owner, regular `admin`, pending invited user, removed user, anonymous visitor on admin auth routes.
- Core invariant: Only active `app_users` members can enter `/admin`; only active `super_admin` users can mutate account access; the last active super admin can never be removed or demoted.
- Previous intended behaviours: `/admin/*` remains protected by Supabase auth plus `app_users`; existing CMS/content routes remain available to authorized admins; service-role clients remain server-only; local `ADMIN_DEV_AUTH_BYPASS=1` remains development-only.
- Unsafe outcomes: passwordless login remains reachable; anonymous self-signup creates admin access; regular admins mutate accounts; a reset link restores access for a removed user; the last super admin is lost; destructive account actions lack audit events; Supabase service-role code leaks to client components.
- Current evidence: `src/lib/supabase/auth.ts`, `src/proxy.ts`, `src/app/admin/login/actions.ts`, `src/app/admin/login/LoginForm.tsx`, `src/app/auth/callback/route.ts`, `supabase/migrations/20260501042413_init_news_cms.sql`, `supabase/migrations/20260506150000_page_builder_coderabbit_hardening.sql`, `src/components/admin/AdminShell.tsx`, `src/components/admin/AdminUi.tsx`, `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`, `page.md`, `route.md`, `redirect.md`, `cookies.md`, and Supabase Auth Admin SDK definitions for `createUser`, `inviteUserByEmail`, `generateLink`, `updateUserById`, `deleteUser`, `signInWithPassword`, `resetPasswordForEmail`.
- Assumptions: `james@modernamenities.com` remains the bootstrap owner email unless a later deployment config says otherwise; Supabase hosted project email/password settings and redirect URLs will be configured outside this code change; no separate profile fields are needed in this release; removed users are represented by audit history rather than an active table row.
- Out of scope: custom Resend auth emails, public forgot-email discovery, full content-permission matrix, hard-deleting historical auth identities, custom password policy beyond basic UI validation, custom-domain launch verification before DNS/domain access is granted.

## Risk Classification

- Overall tier: T1
- Why: This changes authentication, account permissions, destructive access removal, audit records, and database role constraints.
- Live-data risk: Medium. Migration changes role values and promotes bootstrap owner; no destructive user-row deletion should run automatically beyond role normalization.
- Migration risk: Medium. `app_users.role` and `app_user_emails.role` constraints must move from `editor|admin` to `admin|super_admin`, existing `editor` rows must become `admin`, and `is_app_admin()` must include both roles for existing CMS access.
- External-contract risk: Medium. Supabase Auth Dashboard settings/templates/redirect URLs must match the app routes for password reset/setup links.

## Dependency Graph

| Node                             | Depends on | Parallel?              | Shared-state risk              | Notes                                                      |
| -------------------------------- | ---------- | ---------------------- | ------------------------------ | ---------------------------------------------------------- |
| S1 Schema and auth role contract | None       | No                     | Migration/types shared state   | Creates roles, events, helper contract.                    |
| S2 Password login/reset routes   | S1         | No                     | Auth route shared state        | Removes magic-link UI/actions/callback semantics.          |
| S3 Account service domain rules  | S1         | No                     | Service-role account mutations | Owns invite, role, remove, audit, lockout guards.          |
| S4 Settings Server Actions       | S3         | No                     | Account mutation entrypoints   | Validates forms and requires super admin for mutations.    |
| S5 Settings UI and sidebar       | S4         | No                     | AdminShell shared UI           | Adds read-only admin view and super-admin controls.        |
| S6 Docs and Supabase ops notes   | S1-S5      | Yes after code settles | Docs only                      | Records Dashboard settings and new model.                  |
| S7 Automated verification        | S1-S6      | No                     | Test/check runtime             | Unit, type, lint, build, React Doctor as relevant.         |
| S8 Browser smokes                | S1-S7      | No                     | Dev server/browser state       | Fresh desktop/mobile screenshots for admin login/settings. |

## Progress

| Slice | Status | Tier | Owner        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Next gate                     |
| ----- | ------ | ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| S1    | done   | T1   | Codex/manual | Added `20260601100000_admin_settings_users.sql`, `AdminRole = admin/super_admin`, `requireSuperAdmin()`, and dev bypass super-admin context; `npm run test -- src/lib/supabase/auth.test.ts` passed (11 tests).                                                                                                                                                                                                                                                                                                                               | S2 password login/reset tests |
| S2    | done   | T1   | Codex/manual | Replaced passwordless admin auth with password login plus forgot/reset routes; `npm run test -- src/app/admin/login/actions.test.ts src/app/admin/forgot-password/actions.test.ts src/app/admin/reset-password/actions.test.ts src/app/auth/callback/route.test.ts src/lib/supabase/auth-redirects.test.ts` passed (16 tests).                                                                                                                                                                                                                | S3 app-users service tests    |
| S3    | done   | T1   | Codex/manual | Added `src/lib/services/app-users.ts`; `npm run test -- src/lib/services/app-users.test.ts` passed (4 tests for invite/reuse/last-super-admin/remove).                                                                                                                                                                                                                                                                                                                                                                                        | S4 settings action tests      |
| S4    | done   | T1   | Codex/manual | Added `src/app/admin/settings/users/actions.ts`; `npm run test -- src/app/admin/settings/users/actions.test.ts` passed (4 tests for invite, unauthorized, invalid role, resend/remove).                                                                                                                                                                                                                                                                                                                                                       | S5 rendered settings UI       |
| S5    | done   | T2   | Codex/manual | Added Settings sidebar route, `/admin/settings/users`, metrics/table/actions/audit UI, and `/admin/settings` redirect; targeted tests still pass and `npm run typecheck` passed. Runtime layout proof deferred to S8.                                                                                                                                                                                                                                                                                                                         | S6 docs update                |
| S6    | done   | T2   | Codex/manual | Updated `docs/PROJECT_HANDOVER.md` and `docs/seo-page-builder/roadmap.md`; grep confirms targeted docs no longer describe production passwordless admin access.                                                                                                                                                                                                                                                                                                                                                                               | S7 command evidence           |
| S7    | done   | T1   | Codex/manual | Targeted suite passed, including proxy/auth regression coverage; `npm run typecheck`, `npm run lint`, full `npm run test` (48 files, 263 tests), `npm run build`, `git diff --check`, and feature-scoped Prettier check passed. `npx react-doctor@latest --verbose --diff` passed with 6 non-blocking warnings; `npm run doctor` still reports broad existing repo diagnostics. `npm run format:check` still fails on unrelated pre-existing docs/report files. `rg` confirms no live `src` passwordless auth/magic-link API or copy remains. | S8 browser smoke verification |
| S8    | done   | T2   | Codex/manual | Production auth routes on `localhost:3013`: `/admin/login` 200, `/admin/forgot-password` 200, `/admin/reset-password` 307 to `/admin/login`; screenshots saved under `reports/admin-settings-users/`. Dev-bypass settings route on existing `localhost:3000` rendered desktop/mobile after adding a development-only empty-audit fallback for the linked Supabase project missing `app_user_events`; mobile table clipping was fixed with a stacked mobile list.                                                                              | complete                      |

## Slices

### S1 - Schema And Role Contract

Status: done
Tier: T1
Type: schema/backend
Actor/trigger: migration plus server auth helpers
Action: Add `super_admin`, collapse `editor` to `admin`, add `app_user_events`, promote bootstrap owner, add `requireSuperAdmin()` and make the dev bypass return `super_admin`.
Invariant protected: Existing admins keep CMS access; only `super_admin` is treated as account-management authority.
Intentional behaviour changes: Role set becomes `admin|super_admin`; `editor` is no longer a valid account role; `is_app_admin()` allows both roles for existing CMS operations.
Previous intended behaviours preserved: `/admin/*` still gates on active `app_users`; dev bypass is ignored outside development.
Unsafe outcomes: bootstrap owner not promoted; existing admins lose access; regular admins are accidentally treated as super admins.
Dependencies: none
Expected files: `supabase/migrations/*_admin_settings_users.sql`, `src/types/database.ts`, `src/lib/supabase/auth.ts`, `src/lib/supabase/dev-auth.ts`, `src/lib/supabase/auth.test.ts`
Write boundaries: exact files above.
Tests required: auth helper tests for `admin`, `super_admin`, dev bypass, and `requireSuperAdmin()` rejection.
Runtime verification: not required before later auth/UI slices.
Migration/backfill notes: non-destructive forward migration; update constraints safely; update existing `editor` to `admin`; promote `james@modernamenities.com` rows to `super_admin` when present.
Acceptance criteria: role helpers and migration encode two-role model and last-super-admin logic can build on it.
Exit evidence: targeted auth tests pass.
Parallelization: single-threaded due migration/type shared state.
Blocked on: none.

#### AgentTaskContract

Eligible: no - T1 migration/auth shared contract should stay with coordinator.
Current adapter: stronger-model/manual
Model route: gpt-5.5/manual
Model routing reason: auth and migration correctness.

### S2 - Password Login And Reset Flow

Status: done
Tier: T1
Type: backend/frontend
Actor/trigger: anonymous admin login/reset user
Action: Replace magic-link login with email/password, add forgot password and reset password routes, and remove passwordless callback behavior.
Invariant protected: Login succeeds only for existing password-auth users who are authorized in `app_users`; reset/setup cannot restore a removed account.
Intentional behaviour changes: `/admin/login` asks for email and password; password reset email flow replaces sign-in link flow; `/auth/callback` is recovery/setup only.
Previous intended behaviours preserved: successful login lands on a safe `/admin/*` path; unsafe `next` redirects are normalized; errors are user-safe.
Unsafe outcomes: `signInWithOtp` remains reachable; reset page updates passwords for users without `app_users`; login errors leak account existence unnecessarily.
Dependencies: S1.
Expected files: `src/app/admin/login/actions.ts`, `src/app/admin/login/LoginForm.tsx`, `src/app/admin/login/actions.test.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/forgot-password/page.tsx`, `src/app/admin/forgot-password/actions.ts`, `src/app/admin/reset-password/page.tsx`, `src/app/admin/reset-password/actions.ts`, `src/app/auth/callback/route.ts`, `src/lib/supabase/auth-redirects.ts`, `src/lib/supabase/auth-redirects.test.ts`
Write boundaries: exact files above.
Tests required: login calls `signInWithPassword`; forgot password calls `resetPasswordForEmail` with app reset redirect; callback exchanges code and redirects to reset page; reset action verifies `app_users` before updating password.
Runtime verification: browser smoke login/reset pages for layout and no magic-link copy.
Migration/backfill notes: none.
Acceptance criteria: no app code path offers passwordless sign-in; reset/setup works through first-party pages.
Exit evidence: targeted auth route/action tests pass.
Parallelization: single-threaded with auth routes.
Blocked on: none.

#### AgentTaskContract

Eligible: no - T1 auth flow, server/client boundary, and callback semantics.
Current adapter: stronger-model/manual
Model route: gpt-5.5/manual
Model routing reason: auth flow safety.

### S3 - Account Service Domain Rules

Status: done
Tier: T1
Type: backend
Actor/trigger: super admin account operation
Action: Add `src/lib/services/app-users.ts` to list active/pending users and audit events, invite/reuse auth users, resend setup/reset emails, change roles, remove access, revoke sessions when possible, and guard last-super-admin transitions.
Invariant protected: regular admins cannot mutate accounts; last super admin cannot be removed/demoted; every account mutation has an audit event.
Intentional behaviour changes: account access becomes manageable from app code instead of manual Supabase rows.
Previous intended behaviours preserved: `app_user_emails` remains invite/access source of truth; historical FK references are not hard-deleted.
Unsafe outcomes: duplicate auth users; removing own last super admin; partial session revoke hides failure; missing audit log.
Dependencies: S1.
Expected files: `src/lib/services/app-users.ts`, `src/lib/services/app-users.test.ts`
Write boundaries: exact files above.
Tests required: invite pending user; attach existing auth user; role change pending/active; reject last-super-admin demotion/removal; remove access deletes app rows and attempts session revoke; event rows inserted.
Runtime verification: not required until UI.
Migration/backfill notes: uses S1 event table.
Acceptance criteria: service tests prove dangerous cases and expected Supabase Admin Auth calls.
Exit evidence: service tests pass.
Parallelization: single-threaded due service contract.
Blocked on: none.

#### AgentTaskContract

Eligible: no - T1 account permission and destructive-access service.
Current adapter: stronger-model/manual
Model route: gpt-5.5/manual
Model routing reason: lockout and destructive access rules.

### S4 - Settings Server Actions

Status: done
Tier: T1
Type: backend
Actor/trigger: settings forms
Action: Add settings user actions that validate input, call `requireSuperAdmin()` for mutations, call app-user service operations, revalidate settings route, and return inline action errors for unauthorized regular admins.
Invariant protected: UI cannot grant mutation authority; backend rejects unauthorized account changes.
Intentional behaviour changes: new account mutations available to super admins from `/admin/settings/users`.
Previous intended behaviours preserved: server actions authenticate from cookies, not user-supplied tokens.
Unsafe outcomes: hidden form fields bypass role checks; invalid role accepted; unauthorized admin redirected unexpectedly from read-only page.
Dependencies: S3.
Expected files: `src/app/admin/settings/users/actions.ts`, `src/app/admin/settings/users/actions.test.ts`
Write boundaries: exact files above.
Tests required: unauthorized regular admin gets inline error; super admin invite/change/remove delegates to service; invalid role/email rejected.
Runtime verification: covered in S8.
Migration/backfill notes: none.
Acceptance criteria: action tests pass and no account action lacks `requireSuperAdmin()`.
Exit evidence: settings action tests pass.
Parallelization: single-threaded with S5.
Blocked on: none.

#### AgentTaskContract

Eligible: no - T1 server action authorization.
Current adapter: stronger-model/manual
Model route: gpt-5.5/manual
Model routing reason: auth mutation boundary.

### S5 - Settings UI And Sidebar

Status: done
Tier: T2
Type: frontend
Actor/trigger: admin opens Settings
Action: Add `/admin/settings` redirect, `/admin/settings/users` page, Settings sidebar item, read-only admin view, super-admin add form and row actions, metrics, status labels, and recent audit panel/table.
Invariant protected: visible controls reflect server permissions but never replace server-side authorization.
Intentional behaviour changes: Settings appears in AdminShell for all admins; regular admins can inspect users/audit read-only.
Previous intended behaviours preserved: AdminShell layout remains stable; no raw IDs in normal UI; operational design contract remains quiet/dense.
Unsafe outcomes: regular admin sees active mutation controls; mobile table overflows; raw Supabase IDs exposed; destructive actions lack confirmation.
Dependencies: S4.
Expected files: `src/components/admin/AdminShell.tsx`, `src/components/admin/AdminUi.tsx`, `src/app/admin/settings/page.tsx`, `src/app/admin/settings/users/page.tsx`, optional `src/components/admin/AdminUsersManager.tsx`
Write boundaries: exact files above.
Tests required: compile/type coverage; action tests from S4. Component unit tests optional if UI logic grows.
Runtime verification: browser-test `/admin/settings/users` desktop and mobile with dev super-admin context.
Migration/backfill notes: none.
Acceptance criteria: route renders metrics/table/actions without overlap; regular admin read-only state is represented by server data when testable.
Exit evidence: fresh screenshots/notes from browser smoke.
Parallelization: single-threaded with AdminShell shared file.
Blocked on: none.

#### AgentTaskContract

Eligible: no - UI depends on T1 auth/action slices and shared AdminShell.
Current adapter: stronger-model/manual
Model route: gpt-5.5/manual
Model routing reason: shared admin navigation and permission UI.

### S6 - Docs And Supabase Ops Notes

Status: done
Tier: T2
Type: docs/ops
Actor/trigger: maintainer/deployer
Action: Update handover/roadmap docs with password auth, roles, Settings users, dev bypass meaning, and required Supabase Dashboard email/password/redirect/template settings.
Invariant protected: docs must not imply magic links remain or that local bypass proves hosted auth.
Intentional behaviour changes: docs align with new auth model.
Previous intended behaviours preserved: custom-domain cutover caveat remains.
Unsafe outcomes: deployer misses Supabase redirect config; docs overclaim production verification.
Dependencies: S1-S5.
Expected files: `docs/PROJECT_HANDOVER.md`, `docs/seo-page-builder/roadmap.md`
Write boundaries: exact files above.
Tests required: docs reviewed by grep for stale magic-link claims.
Runtime verification: none.
Migration/backfill notes: none.
Acceptance criteria: no stale magic-link setup instructions remain in targeted docs except historical caveats explicitly marked obsolete.
Exit evidence: grep output and doc diff.
Parallelization: can run after code, docs only.
Blocked on: none.

#### AgentTaskContract

Eligible: yes - docs-only after code settles.
Current adapter: deepseek-agent possible, but coordinator will likely edit manually in this run.
Model route: deepseek-v4-flash:3 with gpt-5.5 review fallback.
Model routing reason: low-risk docs if code facts are provided.

### S7 - Automated Verification

Status: done
Tier: T1
Type: verification
Actor/trigger: implementation complete
Action: Run targeted tests throughout, then full relevant checks: auth/settings tests, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `git diff --check`, and React Doctor if React/admin files changed.
Invariant protected: implementation compiles, tests prove unsafe cases, and React/admin diagnostics do not regress silently.
Intentional behaviour changes: none.
Previous intended behaviours preserved: existing test suite remains green or failures are recorded as pre-existing/out-of-scope with evidence.
Unsafe outcomes: green narrow tests hide broader auth/build breakage.
Dependencies: S1-S6.
Expected files: plan evidence only.
Write boundaries: plan file if recording evidence.
Tests required: commands above.
Runtime verification: S8 handles browser.
Migration/backfill notes: do not run live migrations; inspect SQL and typecheck.
Acceptance criteria: commands pass or blocked failures are documented with exact output.
Exit evidence: command list and results.
Parallelization: single-threaded due shared repo.
Blocked on: none.

#### AgentTaskContract

Eligible: no - verification/shared runtime.
Current adapter: stronger-model/manual
Model route: gpt-5.5/manual
Model routing reason: parent verification responsibility.

### S8 - Browser Smoke Verification

Status: done
Tier: T2
Type: verification
Actor/trigger: rendered admin auth/settings workflow
Action: Start local dev server with safe dev auth where needed, open fresh browser screenshots for `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` error/unauthorized state if reachable, and `/admin/settings/users` desktop/mobile.
Invariant protected: rendered UI has no overlap, stale magic-link copy, hidden required actions, raw IDs, or misleading enabled actions.
Intentional behaviour changes: none.
Previous intended behaviours preserved: AdminShell remains usable on desktop/mobile.
Unsafe outcomes: code passes but actual admin UI is unusable or still mentions magic links.
Dependencies: S7.
Expected files: screenshot artifacts under a contained tmp/report path if needed, plan evidence update.
Write boundaries: plan evidence and optional screenshots.
Tests required: browser smokes with fresh screenshots.
Runtime verification: in-app browser or Playwright against localhost.
Migration/backfill notes: use dev bypass for settings route proof; do not claim hosted Supabase auth works without live config. The linked Supabase project still needs `20260601100000_admin_settings_users.sql` applied for real audit rows; development renders an empty audit panel if that table is missing.
Acceptance criteria: fresh rendered evidence for auth/settings routes and no critical layout issues.
Exit evidence: `reports/admin-settings-users/login-desktop.png`, `login-mobile.png`, `forgot-password-desktop.png`, `forgot-password-mobile.png`, `settings-users-desktop.png`, and `settings-users-mobile.png`.
Parallelization: single-threaded browser/dev server.
Blocked on: none.

#### AgentTaskContract

Eligible: no - browser/runtime verification.
Current adapter: stronger-model/manual
Model route: gpt-5.5/manual
Model routing reason: visual verification and final judgment.

## Verification Gates

- Automated checks: targeted auth/service/action tests, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `git diff --check`.
- Runtime checks: fresh browser screenshots/inspection for `/admin/login`, `/admin/forgot-password`, `/admin/settings/users` at desktop and mobile; reset callback/reset page where safe without live email.
- Migration checks: SQL review for role constraints, idempotent role updates, event table, bootstrap promotion, and no hard-delete live data.
- Security/auth checks: grep for remaining `signInWithOtp`, passwordless magic-link copy, account actions without `requireSuperAdmin()`, and client imports of service-role modules.
- Observability/audit checks: service tests and code inspection prove invite/resend/change/remove events insert `app_user_events`.

## Subagent Plan

No subagents for initial implementation. The risky slices share migrations, auth routes, service-role account mutations, and AdminShell, so coordinator/manual execution is safer. A docs-only cleanup pass could be delegated after code settles, but this run will likely keep it local for consistency.

## Update Rules

- Move only one implementation slice to `in_progress` at a time.
- Mark `done` only after exit evidence is recorded in the Progress table.
- Add newly discovered required work as a new slice instead of expanding an active slice silently.
- Keep skipped work visible with the reason.

## Next Slice

None - all slices complete.

## Commit/Push Recommendation

Ready for review. Do not push until the Supabase Dashboard/Auth settings and `20260601100000_admin_settings_users.sql` deployment order are confirmed.
