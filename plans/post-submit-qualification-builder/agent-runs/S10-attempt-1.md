# S10 Attempt 1 - Admin Leads Backstop And Retry Controls

Date: 2026-06-17
Owner: feature-orchestrator
Status: BLOCKED on browser gate

## Scope

S10 added an admin-gated lead operations backstop for reviewing captured leads,
qualification progress, source attribution, and recoverable Close sync failures.
It intentionally does not add CSV export, dashboards, attribution reporting, or
A/B winner UI.

## RED

Initial targeted tests were added before implementation:

```bash
npx vitest run src/lib/services/lead-admin.test.ts src/app/admin/leads/actions.test.ts src/components/admin/AdminLeadsManager.test.tsx src/components/admin/AdminShell.test.tsx
```

Expected RED failures:

- `./lead-admin` missing.
- `src/app/admin/leads/actions` missing.
- `src/components/admin/AdminLeadsManager` missing.
- `/admin/leads` nav item missing from `AdminShell`.

## GREEN

Implemented:

- `src/lib/services/lead-admin.ts`
  - Lists admin lead rows with identity, lifecycle, qualification, Close sync,
    source/UTM, experiment, variant, and latest sync event state.
  - Loads lead detail with qualification sessions, answer snapshots, normalized
    summaries, and Close sync events.
  - Requeues failed, needs-review, and dead-letter Close sync events without
    creating duplicate events.
  - Blocks retry for already-synced events.
- `src/app/admin/leads/page.tsx`
  - Admin-gated list route with lifecycle and Close sync filters.
- `src/app/admin/leads/[id]/page.tsx`
  - Admin-gated lead detail route.
- `src/app/admin/leads/actions.ts`
  - Admin-gated retry action with safe validation and revalidation.
- `src/components/admin/AdminLeadsManager.tsx`
  - List, filters, detail view, answer snapshots, sync event cards, and retry
    controls.
- `src/components/admin/AdminShell.tsx`
  - Adds `/admin/leads` navigation.

## REFACTOR

- Reused the existing admin shell, metric strip, status badge, card, and button
  styles.
- Kept retry handling local to the sync event being retried; no live Close API
  call is made from the admin UI.
- Formatted all touched TypeScript files with Prettier.

## Verification

```bash
npx vitest run src/lib/services/lead-admin.test.ts src/app/admin/leads/actions.test.ts src/components/admin/AdminLeadsManager.test.tsx src/components/admin/AdminShell.test.tsx
```

Result: passed, 4 files, 21 tests.

```bash
npm run typecheck
```

Result: passed.

```bash
npm run lint
```

Result: passed with 4 pre-existing warnings outside S10:

- `plans/ux-verified-technical-fixes/agent-runs/s17-s20-clickthrough.mjs`
- `plans/ux-verified-technical-fixes/agent-runs/s17-smoke.mjs`
- `plans/ux-verified-technical-fixes/agent-runs/s4-axe.mjs`
- `src/app/admin/pages/actions.test.ts`

```bash
npx react-doctor@latest --verbose --scope changed --base HEAD
```

Result: passed, no S10 issues found, 100/100.

Note: `npx react-doctor@latest --verbose --diff` was also run first per the
local React Doctor skill. That deprecated flag scanned the entire stack against
`main` and reported older committed S7/S8 findings in `src/app/admin/forms/[id]/page.tsx`,
`src/components/admin/QualificationFormEditor.tsx`, and
`src/components/qualification/QualificationRuntime.tsx`. The S10-only scan
against `HEAD` is clean.

## Browser Gate

Command:

```bash
env ADMIN_DEV_AUTH_BYPASS=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key-placeholder-000000 SUPABASE_SERVICE_ROLE_KEY=local-service-key-placeholder-000000 npm run dev -- --port 3002
```

Screenshots:

- `plans/post-submit-qualification-builder/browser-evidence/S10-admin-leads-desktop.png`
- `plans/post-submit-qualification-builder/browser-evidence/S10-admin-leads-mobile.png`

Result: blocked. The route reached the app and produced `Leads admin |
Vendingpreneurs`, but both desktop and mobile screenshots rendered the app error
boundary:

```text
Something went wrong
An unexpected error occurred. Please try again.
Reference: 3015857270
```

Playwright console captured:

```text
LeadAdminServiceError: Could not list leads.
```

This matches the existing S7/S8 local Supabase blocker: the current local env
does not provide a matching Supabase schema/data set for admin database reads.

## Boundary Notes

- No Close credentials were used or required.
- No live Close proof was attempted.
- No remote DB migrations were run.
- Retry behavior is covered by mocked local service tests and updates existing
  failed/review-needed sync events to pending.

## Outcome

S10 code, repo, and boundary gates are complete. S10 remains blocked on browser
layout/interaction proof until a matching local Supabase stack/env/schema is
available for `/admin/leads`.
