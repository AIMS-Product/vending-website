# Feature Plan: Admin UX Wave 3 (persona-review structural fixes)

Status: IN_PROGRESS
Last updated: 2026-07-07
Owner: feature-orchestrator

## Working Brief

- Feature: Close the four remaining structural items from the July 6 admin UX persona review: an `/admin` overview dashboard (I8), Content libraries redesign to summary cards + drawers (I10), editor one-contextual-panel progressive disclosure (I11-full), and the AdminShell sidebar-landmark fix (I18).
- Primary actors: admin operators (content editors, non-technical operators, executives) using `/admin` under real auth or the dev bypass.
- Core invariant: no admin workflow that works today may break — publish readiness gate, autosave, walkthrough, library CRUD server actions, auth gating of `/admin/*`.
- Accepted issue IDs: I8, I10, I11 (remaining slice), I18 (new: AdminShell `<aside>` nested inside `main#main-content` on every admin page — found during Wave 1/2 verification).
- Previous intended behaviors: `/admin/*` auth gate (proxy + requireAdmin); libraries CRUD via existing server actions; editor blocks/SEO toggles, walkthrough step reveals, AI-assistant defer logic, mobile panel switcher; skip-to-content link targets `#main-content`.
- Intentional behavior changes: `/admin` serves a dashboard instead of 307→/admin/pages; libraries page defaults to summary cards with add/edit in drawers; on desktop (xl+) opening one editor side panel closes the other; AdminShell sidebar sits outside the main landmark.
- Unsafe outcomes: dashboard queries writing anything (must be read-only); library actions changed or forms losing fields; editor readiness gate weakened; both editor panels becoming unreachable; skip link broken; dev server DB is PRODUCTION — no scripts against it, browser checks read-only except designated throwaway drafts.
- Evidence: reports/ux-persona-review-admin (musing-villani worktree); Wave 1/2 shipped as 8d77c56..a01a2ac; recon 2026-07-07 (next.config.ts:51 redirect, AdminShell.tsx:278 aside, libraries/page.tsx 417 lines, useSeoPageEditorController.ts:277-280 defaults).
- Assumptions: dashboard content per review spec (content live, leads this week, needs attention) is a safe default; one-panel-at-a-time on desktop satisfies "canvas + one contextual panel"; drawer pattern per docs/design/admin-studio.md.
- Out of scope: full persona re-run (offered after); AdminShell 819-line file split; keyboard shortcuts/command palette; P3 backlog.

## Risk Classification

- Overall tier: T2 (admin workflows, read-only data aggregation, shared chrome)
- Live-data risk: dev hits production Supabase — all new queries read-only; browser gate touches only throwaway drafts.
- Migration risk: none (no schema changes).
- External-contract risk: none (no webhooks/APIs changed).

## Dependency Graph

| Node | Title                                   | Tier | Depends On | Parallel Group | Shared-State Risk                     | Status  |
| ---- | --------------------------------------- | ---- | ---------- | -------------- | ------------------------------------- | ------- |
| N1   | AdminShell landmark fix (I18)           | T2   | none       | W1             | AdminShell.tsx shared chrome          | PENDING |
| N2   | /admin overview dashboard (I8)          | T2   | none       | W1             | next.config.ts (sole owner this wave) | PENDING |
| N3   | Libraries summary cards + drawers (I10) | T3   | none       | W1             | none                                  | PENDING |
| N4   | Editor one-panel-at-a-time (I11)        | T2   | none       | W1             | none                                  | PENDING |
| N5   | Overview nav entry in AdminShell (I8)   | T3   | N1, N2     | W2             | AdminShell.tsx                        | PENDING |

## Nodes

### N1 - AdminShell: sidebar outside the main landmark (I18)

Status: PENDING
Tier: T2 | Type: behavior
Actor/trigger: screen-reader/keyboard user navigating landmarks on any /admin page.
Behavior to test: When any admin page renders, then the desktop sidebar `<aside>` is NOT a descendant of `main#main-content`, exactly one `main` exists, and the skip link still targets the content column.
Invariant protected: identical visual layout (grid columns unchanged); nav, collapse toggle, account block all work.
Expected files: src/components/admin/AdminShell.tsx, new AdminShell landmarks test.
Write boundaries: AdminShell.tsx + its tests only.
Acceptance criteria:

- [ ] `aside` not nested in `main` (static-render test)
- [ ] exactly one `main` landmark with id="main-content"
- [ ] visual grid unchanged (same column classes)
      Regression guards: skip-link target resolves; mobile nav unchanged.
      Gates: repo gate (tsc, eslint, targeted vitest); browser gate at integration (orchestrator).

### N2 - /admin overview dashboard (I8)

Status: PENDING
Tier: T2 | Type: behavior
Actor/trigger: admin lands on /admin.
Behavior to test: When an authorized admin opens /admin, then a dashboard renders with (a) content live (published pages + posts, drafts), (b) leads this week (7-day count), (c) needs attention (failed Close syncs; failed/pending scheduled publishes), each linking to its surface; unauthenticated users still bounce to /admin/login.
Invariant protected: read-only aggregation; auth gate intact.
Expected files: new src/app/admin/page.tsx, new src/lib/services/admin-overview.ts (+tests), next.config.ts (remove /admin→/admin/pages redirect).
Write boundaries: those files only; NO AdminShell edits (nav entry is N5).
Acceptance criteria:

- [ ] /admin renders dashboard under dev bypass (orchestrator browser gate)
- [ ] counts match direct service queries; service unit-tested with fake client
- [ ] next.config redirect removed; /admin auth-gated (proxy covers /admin)
      Regression guards: /admin/pages list untouched; no service-role usage outside services layer.
      Gates: repo gate; browser gate at integration.

### N3 - Libraries: summary cards + focused drawers (I10)

Status: PENDING
Tier: T3 | Type: behavior
Actor/trigger: operator opens /admin/libraries.
Behavior to test: When the page loads, then five collapsed summary cards render (name, item count, one-line purpose) with one primary "Add" per library and items/edit behind a focused drawer; a visible source → excerpt → claim order cue exists; all existing server actions keep working unchanged.
Invariant protected: actions.ts semantics unchanged; every existing form field still submitted; no data loss on cancel.
Expected files: src/app/admin/libraries/** (page.tsx restructure + new client components + tests). actions.ts read-only.
Write boundaries: src/app/admin/libraries/** only.
Acceptance criteria:

- [ ] default view = 5 summary cards, no always-open forms
- [ ] drawer opens focused per library; Esc/overlay closes; accessible dialog semantics
- [ ] dependency cue shows source→excerpt→claim order
- [ ] all fields from the current forms present in drawers; actions untouched
      Regression guards: ProofItemMediaField still works inside drawer.
      Gates: repo gate; browser gate at integration.

### N4 - Editor: one contextual panel at a time on desktop (I11)

Status: PENDING
Tier: T2 | Type: behavior
Actor/trigger: editor user on xl+ viewport toggles Blocks or SEO panel.
Behavior to test: When one side panel is opened on desktop, then the other collapses (mobile already exclusive via mobileEditorPanel); closing a panel never opens the other; walkthrough step reveals still show the right panel.
Invariant protected: readiness gate untouched; both panels reachable; AI defer logic still correct (both-open case becomes impossible — simplify or leave).
Expected files: src/components/admin/seo-page-editor/useSeoPageEditorController.ts (+ its test).
Write boundaries: controller + tests only.
Acceptance criteria:

- [ ] opening blocks collapses SEO and vice versa (unit-tested at controller/pure level per existing test conventions)
- [ ] default state unchanged (canvas + SEO panel)
- [ ] walkthrough reveal path (editor.toggle\*) still lands on the intended single panel
      Regression guards: publish flow, autosave, mobile switcher untouched.
      Gates: repo gate; browser gate at integration.

### N5 - AdminShell Overview nav entry (I8)

Status: PENDING
Tier: T3 | Type: behavior
Depends: N1 (AdminShell restructure landed), N2 (route exists).
Behavior to test: When the shell renders, then an "Overview" nav item links to /admin and is active on the dashboard.
Write boundaries: AdminShell.tsx + tests.
Gates: repo gate; browser gate at integration.

## Worker Plan

- Wave W1: N1, N2, N3, N4 — four Sonnet 5 workers (sonnet-handoff), disjoint write sets, no worktree isolation needed. Workers do NOT use the shared preview browser; browser gate runs at integration by the orchestrator.
- Wave W2: N5 — one Sonnet 5 worker after N1+N2 integrate.
- Orchestrator commits one checkpoint per accepted wave; no pushes without user request.
