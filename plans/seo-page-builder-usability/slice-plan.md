# SEO Page Builder Usability Thin Slice Plan

Status: BLOCKED
Last updated: 2026-05-11
Owner: Codex

## Working Brief

- Feature or fix: Fix the non-technical UX blockers found in the five-persona Chrome review of `/admin/pages/new`.
- Primary actors: Admin marketers, content writers, sales/admin assistants, and operators creating SEO resource pages.
- Core invariant: Publish gates, source-bound AI rules, structured page content, and lead/CTA attribution must remain enforced while the editor becomes easier to use.
- Previous intended behaviours: Admins can create one resource page at a time, edit structured blocks, save drafts, run readiness checks, and publish only after hard blockers are resolved.
- Unsafe outcomes: Do not weaken publish validation, do not hide real blockers, do not invent business/content claims, and do not change public rendering or database contracts.
- Current evidence: `docs/seo-page-builder/roadmap.md`, Chrome review of `/admin/pages/new`, `src/components/admin/SeoPageEditorForm.tsx`, `src/lib/page-builder/blocks.ts`, `src/lib/page-builder/seo-readiness.ts`, and local Next 16 docs under `node_modules/next/dist/docs/`.
- Assumptions: This pass is frontend-only polish for the current builder and does not require migrations, live-data changes, or public route changes.
- Out of scope: New templates, full media-library CRUD redesign, AI prompt changes, deployment, and production data cleanup.

## Risk Classification

- Overall tier: T3
- Why: UI copy, default block values, editor flow, and local interaction changes only.
- Live-data risk: None expected; draft save/publish still goes through existing server actions and validators.
- Migration risk: None.
- External-contract risk: None.

## Dependency Graph

| Node | Depends on | Parallel? | Shared-state risk | Notes                                                                                |
| ---- | ---------- | --------- | ----------------- | ------------------------------------------------------------------------------------ |
| S1   | None       | No        | Low               | First-time creation flow must be simplified before reviewing downstream field order. |
| S2   | S1         | No        | Low               | Plain-language labels and advanced SEO grouping use the same drawer surface.         |
| S3   | S2         | No        | Low               | CTA auto-attribution changes default UI state while preserving validators.           |
| S4   | S2, S3     | No        | Low               | Next-step checklist should reflect the new labels and auto-attribution behavior.     |
| S5   | S4         | No        | Low               | Inline support panels should not disrupt the new first-time path.                    |
| S6   | S1-S5      | No        | Low               | Verification gate across targeted tests and Chrome.                                  |

## Audit Triage

Source artifact: five-persona Chrome UX review in current thread
Audit date: 2026-05-11
Findings reviewed: 5

| Finding                                | Verified against current code?                                              | Disposition  | Reason                                                    |
| -------------------------------------- | --------------------------------------------------------------------------- | ------------ | --------------------------------------------------------- |
| First-time creation is noisy           | yes — new-page modal renders over the full editor                           | sliced as S1 | code-only, no product decision needed                     |
| SEO readiness is too technical         | yes — labels include SERP, Schema, Canonical URL, Tracking name             | sliced as S2 | code-only UI label/grouping change                        |
| CTA blocker is unclear                 | yes — CTA blocks require `trackingName` and default new CTA leaves it empty | sliced as S3 | preserve validator, improve default/sync behavior         |
| Publish path lacks a clear finish line | yes — drawer has status/readiness/actions but no single next required step  | sliced as S4 | code-only UI guidance                                     |
| Support links interrupt creation       | yes — support cards navigate away from editor                               | sliced as S5 | use inline panels with optional full-library escape hatch |

## Progress

| Slice | Status  | Tier | Owner | Evidence                                                                                                                                                                                                                       | Next gate                                            |
| ----- | ------- | ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| S1    | done    | T3   | Codex | `curl -s http://localhost:3000/admin/pages/new` exposes `Create page` / `From scratch` without `Page details` or `SEO: Blocked`.                                                                                               | none                                                 |
| S2    | done    | T3   | Codex | `npm run typecheck`; `npm run lint -- src/components/admin/SeoPageEditorForm.tsx`; primary labels changed in `src/components/admin/SeoPageEditorForm.tsx`.                                                                     | none                                                 |
| S3    | done    | T3   | Codex | `npm run typecheck`; `npm test -- src/lib/page-builder/blocks.test.ts src/lib/page-builder/seo-readiness.test.ts`; validators untouched.                                                                                       | none                                                 |
| S4    | done    | T3   | Codex | `npm run typecheck`; next-step card added above readiness details.                                                                                                                                                             | none                                                 |
| S5    | done    | T3   | Codex | `npm run typecheck`; support panels now expand inline with optional full-library links.                                                                                                                                        | none                                                 |
| S6    | blocked | T3   | Codex | Typecheck, targeted lint, page-builder tests, and `git diff --check` passed; Chrome smoke was attempted but blocked by Chrome extension UI: `Chrome is blocking automation because another extension UI is open on this page.` | dismiss Chrome extension UI, then rerun Chrome smoke |

## Slices

### S1 - Focus First-Time Creation

Status: done
Tier: T3
Type: frontend
Actor/trigger: Admin opens `/admin/pages/new`.
Action: Show a focused start choice before revealing the full editor.
Invariant protected: Existing save/publish actions remain unavailable until the editor is shown and form fields exist.
Intentional behaviour changes: Replace the modal-over-editor first state with a start panel.
Previous intended behaviours preserved: "From scratch" still reveals a blank editable page; templates remain unavailable.
Unsafe outcomes: A user should not submit an empty hidden draft before choosing a creation path.
Dependencies: None.
Expected files: `src/components/admin/SeoPageEditorForm.tsx`.
Write boundaries: `src/components/admin/SeoPageEditorForm.tsx`.
Tests required: Typecheck/lint; Chrome smoke for `/admin/pages/new`.
Runtime verification: Chrome confirms the initial state is start-panel-first and the editor appears after "From scratch".
Acceptance criteria: The editor, readiness drawer, public nav, and footer are not visible before the creation choice.
Exit evidence: `curl -s http://localhost:3000/admin/pages/new | rg -o "Create page|From scratch|Page details|SEO: Blocked|Advanced SEO|Next required step"` returned only `Create page` and `From scratch`; automated checks passed.
Parallelization: single-threaded in this pass.
Blocked on: none.

#### AgentTaskContract

Eligible: no - implemented manually because all slices share one large TSX file and need parent-level UX judgment.

### S2 - Translate Technical Readiness UI

Status: done
Tier: T3
Type: frontend
Actor/trigger: Non-technical admin reads readiness and SEO settings.
Action: Rename technical labels and move advanced SEO controls behind a collapsed disclosure.
Invariant protected: The underlying readiness categories and meta fields are unchanged.
Intentional behaviour changes: Friendlier display labels; canonical/noindex/sitemap controls are advanced by default.
Previous intended behaviours preserved: Admins can still edit slug, target keyword, SEO title, canonical URL, noindex, and sitemap.
Unsafe outcomes: Do not hide publish blockers or remove advanced controls.
Dependencies: S1.
Expected files: `src/components/admin/SeoPageEditorForm.tsx`.
Write boundaries: `src/components/admin/SeoPageEditorForm.tsx`.
Tests required: Typecheck/lint.
Runtime verification: Chrome confirms labels are understandable and advanced controls are reachable.
Acceptance criteria: `SERP` and `Schema` do not appear as primary user-facing category labels; canonical/noindex/sitemap are under `Advanced SEO`.
Exit evidence: `npm run typecheck` and targeted ESLint passed; user-facing primary labels are now friendly and advanced SEO controls are collapsed.
Parallelization: single-threaded.
Blocked on: none.

#### AgentTaskContract

Eligible: no - same shared file as S1.

### S3 - Auto-Fill Internal CTA Attribution

Status: done
Tier: T3
Type: frontend
Actor/trigger: Admin adds or edits a CTA/lead-form block.
Action: Generate internal tracking labels from visible CTA/submit labels unless the user has customized the tracking label.
Invariant protected: Server-side publish validation still requires attribution.
Intentional behaviour changes: New CTA/lead-form blocks no longer strand non-technical users on a blank internal field.
Previous intended behaviours preserved: Users can still manually override tracking labels.
Unsafe outcomes: Do not remove tracking validation or change attribution schema.
Dependencies: S2.
Expected files: `src/components/admin/SeoPageEditorForm.tsx`.
Write boundaries: `src/components/admin/SeoPageEditorForm.tsx`.
Tests required: Typecheck/lint.
Runtime verification: Chrome adds CTA and no longer surfaces an immediate missing-tracking blocker.
Acceptance criteria: Added CTA has a non-empty `trackingName`; edits keep tracking in sync until manually overridden.
Exit evidence: `npm run typecheck`, targeted ESLint, and page-builder tests passed; server validators were not changed.
Parallelization: single-threaded.
Blocked on: none.

#### AgentTaskContract

Eligible: no - same shared file and behavioral UX judgment.

### S4 - Add Next Required Step

Status: done
Tier: T3
Type: frontend
Actor/trigger: Admin looks at page details/publish area.
Action: Show one clear next required step based on blocker/warning/save state.
Invariant protected: Readiness scoring remains source of truth.
Intentional behaviour changes: Add a plain-language checklist card above detailed readiness.
Previous intended behaviours preserved: Existing readiness cards and action-item list remain available.
Unsafe outcomes: Do not report "ready" while blockers exist.
Dependencies: S2, S3.
Expected files: `src/components/admin/SeoPageEditorForm.tsx`.
Write boundaries: `src/components/admin/SeoPageEditorForm.tsx`.
Tests required: Typecheck/lint.
Runtime verification: Chrome shows "Next required step" and it changes as fields/blocks are completed.
Acceptance criteria: A non-technical user can see the next publish action without reading all findings.
Exit evidence: `npm run typecheck` and targeted ESLint passed; next-step panel is implemented in `src/components/admin/SeoPageEditorForm.tsx`.
Parallelization: single-threaded.
Blocked on: none.

#### AgentTaskContract

Eligible: no - same shared file.

### S5 - Keep Builder Support Inline

Status: done
Tier: T3
Type: frontend
Actor/trigger: Admin needs media or library context while editing.
Action: Replace primary navigation-style support cards with inline expandable panels and optional full-library links.
Invariant protected: Existing `/admin/media` and `/admin/libraries` routes remain available.
Intentional behaviour changes: First-time users can inspect support context without leaving the editor.
Previous intended behaviours preserved: Users can still navigate to full media/content libraries when needed.
Unsafe outcomes: Do not duplicate library CRUD or make stale claims about source content.
Dependencies: S4.
Expected files: `src/components/admin/SeoPageEditorForm.tsx`.
Write boundaries: `src/components/admin/SeoPageEditorForm.tsx`.
Tests required: Typecheck/lint.
Runtime verification: Chrome confirms support context expands inline.
Acceptance criteria: Media/content support cards are not only page-navigation links.
Exit evidence: `npm run typecheck` and targeted ESLint passed; support cards now expand inline with secondary full-library links.
Parallelization: single-threaded.
Blocked on: none.

#### AgentTaskContract

Eligible: no - same shared file.

### S6 - Verification Gate

Status: blocked
Tier: T3
Type: verification
Actor/trigger: Codex after implementation.
Action: Run focused automated checks and Chrome smoke.
Invariant protected: No publish contract weakening or TS/ESLint regressions.
Intentional behaviour changes: none.
Previous intended behaviours preserved: Existing editor form still saves through the same server action.
Unsafe outcomes: Do not mark complete if typecheck/lint fail or Chrome cannot reach the route.
Dependencies: S1-S5.
Expected files: no implementation files.
Write boundaries: none.
Tests required: `npm run typecheck`; `npm run lint -- src/components/admin/SeoPageEditorForm.tsx` if supported, otherwise repo lint.
Runtime verification: Chrome smoke on `/admin/pages/new`.
Acceptance criteria: Automated checks pass and Chrome confirms the first-time flow.
Exit evidence: Automated checks passed. Chrome smoke attempted on 2026-05-11, but the Chrome backend reported `Chrome is blocking automation because another extension UI is open on this page.`
Parallelization: no.
Blocked on: Dismiss the Chrome extension UI/popup, then rerun the Chrome smoke.

#### AgentTaskContract

Eligible: no - verification-only.

## Verification Gates

- Automated checks: `npm run typecheck`; targeted lint for `src/components/admin/SeoPageEditorForm.tsx`.
- Runtime checks: Chrome route smoke for `/admin/pages/new`.
- Migration checks: none.
- Security/auth checks: confirm no auth/server-action changes.
- Observability/audit checks: none.

## Update Rules

- Move only one slice to `in_progress` at a time.
- Mark `done` only after exit evidence is recorded.
- Add newly discovered work as a follow-up slice rather than expanding scope.
