# Feature Plan: seo-builder-ux-fixes (round 2)

Status: READY
Last updated: 2026-06-10
Owner: feature-orchestrator

Seeded by: `reports/ux-persona-review-seo-builder/fix-strategy.md` (accepted issue-fix-strategy triage of the 2026-06-10 SEO Page Builder persona review). Evidence: `UX-REVIEW.md`, `final-findings.json`, `axe-results.json`, `screenshots/`, journey scripts in `scripts/`. Round 1 (May 29) is archived at `plan-2026-05-29-round1-complete.md` — different fix set, COMPLETE, not part of this graph.

## Working Brief

- Feature: Fix the 20 accepted issues (I1–I20) from the SEO Page Builder UX persona review. Core disease: the publish/schedule machinery does the work but lies about its state (5 of 6 P0s cluster in `SeoPublishPanel.tsx` / `SeoReadinessPanel.tsx` / `useSeoPageEditorController.ts`); 6th P0 is missing redirect server actions.
- Primary actors: Admin/editor staff in `/admin/pages/*`; public visitors only via redirect resolution (I4) and published pages (I3 live link).
- Core invariant: The builder never (a) silently loses content, (b) changes published/draft/archived state without explicit intent, (c) alters what is live on the public site except via explicit publish/unpublish/archive/redirect action, (d) changes any timezone semantics — Pacific Time is correct.
- Previous intended behaviors (must stay true): readiness rules themselves (I1 changes presentation, not rules); `seo-page-scheduler.ts` runner semantics incl. cancel (reworked June 2026 — see `20260610091000_schedule_state_ownership.sql`); confirm step before every publish; debounced autosave; live redirect resolution and 301/302/307/308 semantics; proxy/middleware behaviour (proxy intercepts builder routes — known learning); publish revisions + restore flow; round-1 fixes (status glyphs, publish confirm, draft-on-type, tour positioning).
- Intentional behavior changes: blockers become one canonical persistent checklist with deep links; saved schedule round-trips into the form and shows "Scheduled to publish {dt} (Pacific Time)" + Cancel + failed state; publish success replaces confirm card with "Open live page"; redirects gain delete/edit with confirm; nav guard with Discard-deletes-auto-row; autosave failure becomes visible with retry; manual saves snapshot revisions (keep-last-20).
- Unsafe outcomes: breaking live redirect resolution or status codes; deleting any redirect other than the 3 sanctioned test rows; publishing junk to the live site during verification; scheduler regression (pages publishing at wrong time or not at all); losing draft content via the new Discard path on a row the user DID explicitly save; timezone drift.
- Evidence baseline: publish journey 1.2/5, schedule journey 1.3/5 (`journey-results*.json`). Target ≥3.5 on both.
- Assumptions: dev auth bypass active; local dev hits PROD Supabase → all manual browser verification uses clearly-labelled throwaway drafts and never publishes junk live; `revision_type='manual_save'` already allowed in `page_revisions` CHECK (verified `20260506090000` migration) so I9 needs no schema migration.
- Out of scope: timezone changes; scheduler runner rework; public-site review findings; pushing branches / PRs / deploys (local-only until James says otherwise).

## Risk Classification

- Overall tier: Mixed. T1: N1, N2 (publish/schedule truth on customer-visible records), N5 (destructive, customer-visible routing — safe-slice-grade gates). T2: N3, N4, N6, N8, N9, N17. T3: the rest.
- Live-data risk: HIGH for N5 acceptance-by-cleanup (deletes 3 sanctioned prod redirect rows — pre-approved, those exact rows only). MEDIUM ambient: dev hits PROD Supabase, so browser gates must use throwaway drafts.
- Migration risk: None expected. `manual_save` revision_type exists. If any node discovers it needs a SQL function change, that node becomes single-threaded with a non-destructive migration gate.
- External-contract risk: None (no webhooks/payments). Public contract = redirect resolution + published routes; N5/N3 boundary gates prove preservation.

## Dependency Graph

| Node | Title                                         | Issues  | Tier         | Depends On  | Parallel Group   | Shared-State Risk                       | Status  |
| ---- | --------------------------------------------- | ------- | ------------ | ----------- | ---------------- | --------------------------------------- | ------- |
| N0   | Pre-flight: commit review artifacts           | —       | ops          | none        | W0 (single)      | git index                               | PENDING |
| N1   | Canonical publish-blocker checklist           | I1, I19 | T1           | N0          | W1-A (chain 1/4) | PublishPanel+controller lane            | PENDING |
| N2   | Schedule status honesty                       | I2      | T1           | N1          | W1-A (chain 2/4) | PublishPanel+controller lane            | PENDING |
| N3   | Publish success state                         | I3      | T2           | N2          | W1-A (chain 3/4) | PublishPanel+controller lane            | PENDING |
| N4   | Autosave failure surfacing + toast dedupe     | I6      | T2           | N3          | W1-A (chain 4/4) | controller lane                         | PENDING |
| N5   | Redirect CRUD (delete/edit/validate)          | I4      | T1           | N0          | W1-B             | seo-pages.ts service                    | PENDING |
| N6   | Unsaved-exit guard / orphan drafts            | I5      | T2           | N0          | W1-C             | MUST NOT edit controller (W1-A owns it) | PENDING |
| N7   | Pages-list status text labels/legend          | I7      | T3           | N1–N6       | W2-A             | pages list page.tsx                     | PENDING |
| N8   | Fix aria-prohibited-attr on block spans       | I8      | T2           | N1–N6       | W2-B             | canvas/block editors                    | PENDING |
| N9   | Draft revisions on manual save + prune        | I9      | T2           | N1–N6       | W2-C (chain 1/2) | seo-pages.ts + actions.ts               | PENDING |
| N10  | Duplicate-page slug `{source}-copy-n`         | I13     | T3           | N9          | W2-C (chain 2/2) | seo-pages.ts + actions.ts               | PENDING |
| N11  | Mobile editor: sticky bar + collapsible panel | I10     | T3           | N1–N6       | W2-D             | Workspace/TopRail/styles                | PENDING |
| N12  | SEO panel verdict + tabs restructure          | I14     | T3           | W2 done     | W3-A             | PublishPanel/ReadinessPanel             | PENDING |
| N13  | Collapse create wizard to one step            | I15     | T3           | W2 done     | W3-B             | Shell / new page                        | PENDING |
| N14  | Keyboard shortcuts (Cmd+S, Cmd+Enter, "/")    | I16     | T3           | W2 done     | W3-C             | controller/Workspace only — not panel   | PENDING |
| N15  | Quick Tour → opt-in                           | I17     | T3           | W2 done     | W3-D             | walkthrough files                       | PENDING |
| N16  | Revision page labels + AM/PM + context        | I18     | T3           | N9; W2 done | W3-E             | revisions route                         | PENDING |
| N17  | A11y batch (tab order, landmarks, targets)    | I12     | T2           | N11, N16    | W4 (single 1/3)  | broad editor+revision chrome            | PENDING |
| N18  | Jargon/copy sweep                             | I11     | T3           | N17         | W4 (single 2/3)  | broad copy across editor+list+redirects | PENDING |
| N19  | P3 batch                                      | I20     | T3           | N18         | W4 (single 3/3)  | misc shared surfaces                    | PENDING |
| N20  | Final proof: journeys + verification.md       | all     | verification | all         | W5 (single)      | none                                    | PENDING |

Issue coverage check: I1→N1, I2→N2, I3→N3, I4→N5, I5→N6, I6→N4, I7→N7, I8→N8, I9→N9, I10→N11, I11→N18, I12→N17, I13→N10, I14→N12, I15→N13, I16→N14, I17→N15, I18→N16, I19→N1 (folded), I20→N19. All 20 mapped.

Waves: W0 (ops) → W1 = {A-chain N1→N2→N3→N4 ∥ B N5 ∥ C N6} → integrate → W2 = {N7 ∥ N8 ∥ C-chain N9→N10 ∥ N11} → integrate → W3 = {N12 ∥ N13 ∥ N14 ∥ N15 ∥ N16} → integrate → W4 = N17→N18→N19 (single-threaded, broad surfaces) → W5 = N20.

## Nodes

### N0 - Pre-flight: commit pre-existing review artifacts

Status: PENDING
Tier: ops
Type: ops
Actor/trigger: orchestrator (no worker).
Behavior to test: n/a (git hygiene).
Invariant protected: orchestrator fix commits contain only this round's code changes.
Dependencies: none.
Expected files: `reports/ux-persona-review-seo-builder/` (untracked, ~14M), plan artifacts, archived round-1 plan rename.
Write boundaries: git index only — no source edits.
Acceptance criteria:

- [ ] Untracked review artifacts committed as their own commit (pre-existing work, predates this fix set).
- [ ] Plan/progress/decisions + round-1 archive rename committed as planning commit.
- [ ] `git status` clean before first worker launches.
      RGR: n/a (ops). Gates: Repo gate = clean `git status`. Browser/boundary: n/a.
      Parallelization: single-threaded (git op). Worker role: orchestrator-direct. Exit evidence: commit SHAs.
      Blocked on: nothing.

### N1 - Canonical publish-blocker checklist (I1, absorbs I19)

Status: PENDING
Tier: T1
Type: behavior
Actor/trigger: editor opens a draft with publish blockers / clicks disabled Publish.
Behavior to test: When a page has publish blockers, then SeoPublishPanel renders ONE persistent plain-language checklist of EVERY blocker at once (human names, e.g. "Add a headline to the Hero section"), each item deep-links/opens its target field — including the block-settings modal for CTA destination URL — and the chip, panel, and disabled Publish button all derive from that single canonical list, with `aria-describedby` + live region on Publish.
Invariant protected: readiness RULES unchanged — same set of conditions blocks publish before and after; only derivation/presentation is unified.
Intentional changes: blockers visible all-at-once upfront (was: one-at-a-time/hover tooltip); placeholder cues clarified (I19).
Previous behaviors preserved: publish stays blocked until rules pass; confirm-before-publish untouched.
Unsafe outcomes: a blocker rule silently dropped → empty/broken page publishable; deep link opening wrong field/modal.
Dependencies: N0.
Expected files: `src/components/admin/seo-page-editor/SeoPublishPanel.tsx`, `SeoReadinessPanel.tsx`, `SeoReadinessHelpers.ts`, `useSeoPageEditorController.ts`, `SeoPublishPanel.test.ts`, possibly `BlockSettingsModal.tsx` (deep-link open hook), `editor-styles.ts`.
Write boundaries: the files above only. Do NOT touch scheduler, redirects, Shell, actions.ts publish semantics.
Acceptance criteria:

- [ ] Blank new page shows full blocker list (all items, human-readable, no jargon).
- [ ] Each blocker item focuses/opens its field; CTA-destination item opens block-settings modal at the field.
- [ ] Chip count, panel list, disabled-button reason all read from one derivation function.
- [ ] Publish button has `aria-describedby` pointing at the list; list updates announce via live region.
- [ ] No readiness rule added/removed (rule-parity test).
      Regression guards: existing `SeoPublishPanel.test.ts` suite green; publish-confirmation flow untouched.
      RGR:
- RED: Vitest — canonical blocker derivation returns every expected blocker (with label + target ref) for a blank page fixture; rule-parity test vs current readiness logic fails until derivation is wired.
- GREEN: implement single derivation in `SeoReadinessHelpers.ts` (or sibling), wire all three consumers + deep links + a11y.
- REFACTOR: dedupe old per-consumer blocker strings; keep files ≤300 lines (split if PublishPanel grows — it is already 849; extract checklist component).
  Gates:
- Repo gate: `tsc --noEmit`, eslint, `vitest run` (full), build if touched files demand.
- Browser gate: Playwright (journey-script style): blank page → see all blockers → click each deep link → field focused → fill → publish enabled. Axe pass on publish panel (no new violations).
- Boundary/migration gate: none (no schema/contract).
  External docs needed: `docs/design/page-builder.md`, `docs/design/admin-studio.md`, `docs/design/visual-review-checklist.md` (design contracts — read before UI edits).
  Parallelization: single-threaded chain W1-A, position 1/4. Owns PublishPanel+controller lane.
  Worker role: feature-slice-worker. Goal/context per above; forbidden scope: everything outside listed files; shared-state: N5/N6 run concurrently in other lanes — do not touch their files. Return: test names + output, screenshots, axe result, derivation function path.
  Exit evidence: RED→GREEN test output, Playwright screenshots of full checklist + deep-link focus, axe summary.
  Blocked on: N0 only.

### N2 - Schedule status honesty (I2)

Status: PENDING
Tier: T1
Type: behavior
Actor/trigger: editor sets a scheduled publish time, saves, reloads / revisits the page.
Behavior to test: When a page has `scheduled_publish_at` saved, then (a) the schedule field round-trips into form state (does NOT re-render empty — root bug in `useSeoPageEditorController`/`SeoPublishPanel` hidden-field baseline), and (b) the Publish Status card renders "Scheduled to publish {dt} (Pacific Time)" with an inline Cancel and a visible failed state from `scheduled_publish_status`/`scheduled_publish_error`, with the schedule control surfaced out of the Advanced section.
Invariant protected: Pacific Time semantics unchanged; scheduler runner (`seo-page-scheduler.ts`, reworked June 2026) and cancel semantics unchanged.
Unsafe outcomes: schedule silently cleared on save (data loss); double-schedule; timezone shift; runner regression.
Dependencies: N1 (same files; panel reshaped by N1).
Expected files: `useSeoPageEditorController.ts`, `SeoPublishPanel.tsx`, `SeoPublishPanel.test.ts`, maybe `SeoPageEditorHiddenFields.tsx`, `editor-form-data.ts(+test)`.
Write boundaries: those files. Do NOT edit `seo-page-scheduler.ts` or `20260610091000_schedule_state_ownership.sql` semantics; scheduler tests must pass untouched.
Acceptance criteria:

- [ ] Root cause of empty re-render identified and stated (not patched blind) — debugging expectation: trace saved value → server payload → form state hydration.
- [ ] Set schedule → save → reload: field shows saved Pacific value.
- [ ] Status card: "Scheduled to publish {dt} (Pacific Time)" + Cancel inline; cancel clears visibly.
- [ ] Failed schedule (`scheduled_publish_status='failed'`) renders error visibly.
- [ ] Schedule control reachable without opening Advanced.
      Regression guards: `seo-page-scheduler.test.ts` green and unmodified; cancel still clears server state.
      RGR:
- RED: Vitest round-trip — controller hydrated with page fixture carrying `scheduled_publish_at` exposes it in form state (currently fails); display-format test for Pacific label.
- GREEN: fix hydration + render status card states.
- REFACTOR: extract schedule-status subcomponent if panel size demands.
  Gates:
- Repo gate: tsc, eslint, full vitest.
- Browser gate: Playwright set→save→reload→see→cancel→cleared on a throwaway draft; screenshot of scheduled + failed states (failed state may be driven by test fixture/storybook-style harness if prod data can't be safely mutated — document method).
- Boundary/migration gate: confirm no writes to scheduler columns outside existing save/cancel actions (grep + test).
  External docs needed: design contracts as N1.
  Parallelization: W1-A chain 2/4.
  Worker role: feature-slice-worker; same lane ownership as N1; root-cause writeup required in report.
  Exit evidence: failing-then-passing round-trip test, reload screenshot showing persisted schedule, cancel screenshot, scheduler test suite output.
  Blocked on: N1.

### N3 - Publish success state (I3)

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: editor completes a publish.
Behavior to test: When publish succeeds, then the confirm card is dismissed and a success block renders with "Open live page" (from `route_path`), the link shown once the route actually responds (handles the ~seconds of 404 right after publish); a subsequent publish requires a fresh confirm.
Invariant protected: confirm step before EVERY publish (round-1 S4 behavior).
Unsafe outcomes: confirm card stays armed → accidental re-publish; live link 404s for the user.
Dependencies: N2.
Expected files: `SeoPublishPanel.tsx`, `useSeoPageEditorController.ts`, `editor-publish-confirmation.ts`, tests.
Write boundaries: those files only.
Acceptance criteria:

- [ ] On success: confirm card gone, success block visible with live link.
- [ ] Link appears only after route responds (poll/backoff; cap with "may take a moment" fallback).
- [ ] Re-publish flow demands fresh confirmation.
      Regression guards: publish-confirmation tests green.
      RGR: RED Vitest on success-state transition + fresh-confirm reset; GREEN implement; REFACTOR extract poller util.
      Gates:
- Repo gate: tsc/eslint/vitest.
- Browser gate: Playwright on throwaway draft — publish → card gone → success block → "Open live page" resolves 200 → unpublish/cleanup the throwaway afterwards (leave prod clean).
- Boundary gate: none.
  External docs needed: design contracts.
  Parallelization: W1-A chain 3/4.
  Worker role: feature-slice-worker; must clean up any published throwaway page (archive/unpublish) and show evidence.
  Exit evidence: test output, screenshots (success block, live page 200), cleanup proof.
  Blocked on: N2.

### N4 - Autosave failure surfacing + toast dedupe (I6)

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: autosave request fails (network error — real observed "seo page autosave failed TypeError: Failed to fetch").
Behavior to test: When an autosave fails, then the save indicator flips to a visible "Couldn't save — retrying / Save manually" state and autosave retries with backoff; duplicate "Draft saved" toasts are deduped.
Invariant protected: debounced autosave semantics; manual save path.
Unsafe outcomes: editor believes content saved when it is not (data loss); retry storm hammering server.
Dependencies: N3.
Expected files: `useSeoPageEditorController.ts`, `editor-autosave-payload.ts(+test — has tests, extend)`, indicator component (CanvasPanel/TopRail), `SeoEditorManualSubmitToast.tsx`, tests.
Write boundaries: those files.
Acceptance criteria:

- [ ] Simulated fetch failure → visible failure indicator + retry with backoff (test with fake timers).
- [ ] Recovery flips back to saved state.
- [ ] One "Draft saved" toast per save (dedupe verified).
      Regression guards: existing editor-autosave-payload tests green; debounce timing unchanged.
      RGR: RED Vitest failure→indicator-state + backoff schedule + toast dedupe; GREEN; REFACTOR extract retry policy.
      Gates: Repo gate tsc/eslint/vitest. Browser gate: dev-tools offline simulation screenshot of failure indicator on throwaway draft. Boundary: none.
      Parallelization: W1-A chain 4/4 (releases the lane).
      Worker role: feature-slice-worker.
      Exit evidence: test output incl. fake-timer backoff, screenshots online/offline states.
      Blocked on: N3.

### N5 - Redirect CRUD (I4) — RISKY SURFACE, safe-slice-grade gates

Status: PENDING
Tier: T1
Type: behavior
Actor/trigger: admin manages redirects at `/admin/pages/redirects`; public visitor hits a redirected path.
Behavior to test: When an admin deletes (or edits/disables) a redirect via the new row UI, then a confirm dialog gates the action, a Zod-validated server action performs it, and the live route stops (or changes) redirecting accordingly; when a create/edit submission is invalid, then inline plain-language errors render ("Start the path with /, e.g. /resources/old-page") and entered values are preserved.
Invariant protected: live redirect resolution + 301/302/307/308 semantics + proxy/middleware behaviour for all OTHER redirects, unchanged.
Intentional changes: delete + edit/disable exist (today: create-only, `actions.ts` is 37 lines); inline validation replaces query-param error flash that wipes values.
Unsafe outcomes: deleting/breaking a real customer-visible redirect; middleware regression breaking builder routes (proxy intercepts builder routes — known learning); validation change rejecting previously-valid paths.
Dependencies: N0. Parallel-safe vs W1-A and N6 (disjoint files).
Expected files: `src/app/admin/pages/redirects/actions.ts`, `src/app/admin/pages/redirects/page.tsx`, `src/lib/services/seo-pages.ts` (add `adminDeleteBuilderRedirect` / `adminUpdateBuilderRedirect` near `adminCreateBuilderRedirect`), `src/lib/redirects.test.ts` extensions, new row-UI component(s), Zod schema, tests.
Write boundaries: those files; do NOT touch `middleware`/proxy or `src/lib/redirects.ts` resolution logic itself.
Acceptance criteria:

- [ ] Delete with confirm dialog; row gone; resolution for that path returns non-redirect.
- [ ] Edit or enable/disable with confirm; updated semantics live.
- [ ] Invalid input → inline message, values preserved, nothing persisted.
- [ ] Auth: actions call `requireAdmin()`; Zod-validated; return shape per error-handling rules (no throw to client).
- [ ] ACCEPTANCE-BY-CLEANUP: the 3 stuck test redirects (`/resources/ux-old-test-1781071681847`, `/resources/ux-old-test-1781071765035`, `/resources/ux-explore-old-1781071765035`) deleted via the NEW UI — these exact rows ONLY (pre-approved in decisions.md).
      Regression guards: `redirects.test.ts` + `seo-page-scheduler`-style untouched suites green; spot-check one real redirect still resolves with correct status code before AND after.
      RGR:
- RED: Vitest on new service fns (delete/update validation, not-found, auth) + Zod schema cases; failing UI test for inline error rendering.
- GREEN: implement actions + row UI + inline errors.
- REFACTOR: keep page.tsx ≤300 lines (extract row component).
  Gates:
- Repo gate: tsc, eslint, full vitest.
- Browser gate: Playwright full CRUD journey on a self-created throwaway redirect first (create→edit→disable→delete), THEN the 3 sanctioned deletions with before/after screenshots; before/after curl of one real redirect (status code + location header identical).
- Boundary/migration gate: prove resolution path unchanged — `src/lib/redirects.ts` diff empty; middleware diff empty; document curl evidence. No migration.
  External docs needed: `docs/design/admin-studio.md`.
  Parallelization: W1-B, parallel with W1-A chain and N6. Shared-state: `seo-pages.ts` also touched later by N9/N10 (different wave — safe).
  Worker role: feature-slice-worker with safe-slice discipline: throwaway-first destructive testing, sanctioned-rows-only cleanup, root-cause not patch if anything unexpected in resolution.
  Exit evidence: test output, CRUD screenshots, the 3 deletion screenshots + post-delete 404/200 checks, curl before/after on a real redirect.
  Blocked on: N0.

### N6 - Unsaved-exit guard / orphan drafts (I5)

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: editor opens "Start building" (auto-row created), types, then navigates away/closes tab without explicit save.
Behavior to test: When the user leaves an editor whose auto-created row was never explicitly saved, then a guard offers Save draft / Discard draft / Keep editing, where Discard deletes the auto-row; and when the editor opens on a fresh auto-row, then a visible "Draft created" notice renders. (Accepted default — keep create-on-start; see decisions.md.)
Invariant protected: a row the user explicitly saved is NEVER deleted by Discard; autosave/preview-token assumptions intact.
Unsafe outcomes: Discard deleting an explicitly-saved page (data loss); guard blocking navigation permanently; double rows.
Dependencies: N0. Parallel with W1-A and N5.
Expected files: `SeoPageEditorShell.tsx`, new guard hook/component (e.g. `useUnsavedExitGuard.ts` in seo-page-editor/), `src/app/admin/pages/actions.ts` (delete-never-saved-draft server action) + service fn, tests.
Write boundaries: those files. HARD CONSTRAINT: do NOT edit `useSeoPageEditorController.ts` or `SeoPublishPanel.tsx` — W1-A owns them. If the "explicitly saved" flag genuinely cannot be derived without controller changes, STOP, mark BLOCKED, report to integrator for sequencing after N4 (do not guess or duplicate state).
Acceptance criteria:

- [ ] In-app nav + beforeunload guard with the three options on never-explicitly-saved auto-rows.
- [ ] Discard deletes the auto-row (server action, admin-auth, Zod, only-if-never-explicitly-saved guard server-side too).
- [ ] Explicitly-saved page: guard does not offer destructive Discard (or offers plain leave).
- [ ] "Draft created" notice visible at editor open on auto-created rows.
      Regression guards: round-1 S3a/S3b behavior (draft-on-type, beforeunload dirty-guard) preserved or consciously superseded — state which in report.
      RGR: RED Vitest on guard-state derivation (never-saved vs saved fixtures) + server-action guard rejects saved rows; GREEN; REFACTOR.
      Gates: Repo gate tsc/eslint/vitest. Browser gate: Playwright — start building → type → navigate → dialog → Discard → row gone from list; repeat with explicit save → no destructive offer. Boundary: server-side only-never-saved check proven by test.
      External docs needed: design contracts.
      Parallelization: W1-C.
      Worker role: feature-slice-worker; root-cause discipline on the "explicitly saved" signal (inspect save paths before inventing new state).
      Exit evidence: test output, dialog + row-gone screenshots, server-guard test.
      Blocked on: N0.

### N7 - Pages-list status text labels/legend (I7)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin scans the pages list.
Behavior to test: When the list renders Readiness/Status dots, then visible text labels or a legend accompany them (accessible names already exist — this is markup/layout only).
Dependencies: W1 integrated. Expected files: `src/app/admin/pages/page.tsx` (+ list components). Write boundaries: list surface only.
Acceptance criteria: [ ] visible text/legend for every dot state; [ ] no color-only signal.
RGR: RED snapshot/role-query test for visible label; GREEN; REFACTOR. Gates: repo gate; browser screenshot; axe no-new-violations. Parallelization: W2-A. Worker: feature-slice-worker. Exit: test + screenshot.
Blocked on: W1 integration.

### N8 - Fix aria-prohibited-attr on block spans (I8)

Status: PENDING
Tier: T2 (serious axe violation)
Type: behavior
Actor/trigger: assistive tech reads the canvas block list.
Behavior to test: When block canvas renders block chrome, then no `span[aria-label]` without permitted role exists — name moves to a focusable wrapper or an element with a permitted role.
Dependencies: W1 integrated. Expected files: canvas/block editor components (`SeoPageEditorCanvas*.tsx`, `BlockInlineEditor.tsx` — locate exact spans via axe rerun). Write boundaries: canvas chrome only.
Acceptance criteria: [ ] axe `aria-prohibited-attr` count 0 on editor; [ ] names still announced.
RGR: RED axe assertion in test or scripted axe run failing; GREEN; REFACTOR. Gates: repo gate; browser gate = axe rerun clean (`axe-results.json` baseline). Parallelization: W2-B. Worker: feature-slice-worker. Exit: axe before/after.
Blocked on: W1 integration.

### N9 - Draft revisions on manual save + keep-last-20 prune (I9)

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: editor clicks "Save draft" before first publish.
Behavior to test: When a manual Save draft runs, then a `page_revisions` row with `revision_type='manual_save'` is snapshotted, and manual-save revisions beyond the latest 20 per page are pruned. (Accepted default — see decisions.md.)
Invariant protected: publish revisions + restore flow untouched; prune NEVER deletes publish/rollback/autosave/ai_insert revisions.
Dependencies: W1 integrated (shares `actions.ts`/`seo-pages.ts` with N5/N6 outputs). Expected files: `src/lib/services/seo-pages.ts`, `src/app/admin/pages/actions.ts`, tests; `manual_save` already in CHECK constraint — NO schema migration expected. If a SQL fn change proves necessary, escalate: node becomes migration-gated single-threaded.
Write boundaries: service + actions + tests.
Acceptance criteria: [ ] manual save → revision row (type manual_save); [ ] 21st manual save prunes oldest manual_save only; [ ] restore flow works on a manual_save revision; [ ] publish revisions untouched by prune (test).
RGR: RED service tests (snapshot, prune ordering, type-scoped prune); GREEN; REFACTOR. Gates: repo gate; browser gate = save twice → revisions page lists entries; boundary gate = prune query provably scoped (`revision_type = 'manual_save'` filter in code + test). Parallelization: W2-C chain 1/2 (owns service files this wave). Worker: feature-slice-worker. Exit: tests + revisions-page screenshot.
Blocked on: W1 integration.

### N10 - Duplicate-page slug `{source-slug}-copy-n` (I13)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin duplicates a page.
Behavior to test: When a page is duplicated, then the new slug is `{source-slug}-copy` (or `-copy-2`, `-copy-3` on collision) instead of `draft-{hash}`.
Dependencies: N9 (same service files). Expected files: `seo-pages.ts` duplicate fn, `actions.ts`, tests. Write boundaries: duplicate path only.
Acceptance criteria: [ ] derived slug; [ ] collision increments; [ ] slug-validity rules respected.
RGR: RED unit tests on slug derivation incl. collisions; GREEN; REFACTOR. Gates: repo gate; browser duplicate → check slug. Parallelization: W2-C chain 2/2. Worker: feature-slice-worker. Exit: tests + screenshot.
Blocked on: N9.

### N11 - Mobile editor: sticky action bar + collapsible SEO panel (I10)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: editor on small viewport.
Behavior to test: When viewport is small, then Save/Publish/status sit in a sticky action bar and the SEO panel is collapsible.
Invariant protected: desktop layout unchanged; round-1 drawer behavior preserved.
Dependencies: W1 integrated (TopRail/Workspace stable). Expected files: `SeoPageEditorWorkspace.tsx`, `SeoPageEditorTopRail.tsx`, `SeoPageEditorCanvasPanel.tsx`, `editor-responsive.ts`, `editor-styles.ts`, tests. Write boundaries: layout/chrome — no controller logic.
Acceptance criteria: [ ] sticky bar at small widths with Save/Publish/status; [ ] SEO panel collapse/expand; [ ] desktop unchanged (screenshot diff).
RGR: RED responsive util/component tests where feasible; GREEN; REFACTOR. Gates: repo gate; browser gate = Playwright viewport 390×844 + desktop screenshots. Parallelization: W2-D. Worker: feature-slice-worker. Exit: viewport screenshots both sizes.
Blocked on: W1 integration.

### N12 - SEO panel verdict + "fix next" + tabs (I14)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: editor opens SEO panel.
Behavior to test: When the SEO panel renders, then a verdict + "fix next" summary leads, with governance/comments behind tabs (info-dump restructure). Builds ON the N1 canonical list — must consume the same derivation, not fork it.
Dependencies: W2 integrated (panel files released by W1-A, stable through W2). Expected files: `SeoReadinessPanel.tsx`, `SeoPublishPanel.tsx` (containers), tests. Write boundaries: panel presentation; derivation function read-only.
Acceptance criteria: [ ] verdict + fix-next visible first; [ ] tabs for governance/comments; [ ] same blocker source as N1 (no second list).
RGR: RED component test for verdict/fix-next from derivation fixture; GREEN; REFACTOR. Gates: repo gate; browser screenshots; axe no-new-violations. Parallelization: W3-A. Worker: feature-slice-worker. Exit: tests + screenshots.
Blocked on: W2 integration.

### N13 - Collapse create wizard to one step (I15)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin creates a page.
Behavior to test: When the admin starts page creation, then a single step replaces the 3-step wizard, preserving all collected inputs and the create-on-start flow from N6.
Dependencies: W2 integrated; consumes N6's guard behavior unchanged. Expected files: `src/app/admin/pages/new/page.tsx`, `SeoPageEditorShell.tsx` (if chooser involved), tests. Write boundaries: creation flow only.
Acceptance criteria: [ ] one-step create; [ ] all previous inputs still settable; [ ] N6 "Draft created" + guard behavior intact.
RGR: RED flow test; GREEN; REFACTOR. Gates: repo gate; browser create journey screenshots. Parallelization: W3-B. Worker: feature-slice-worker. Exit: tests + screenshots.
Blocked on: W2 integration.

### N14 - Keyboard shortcuts (I16)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: editor uses keyboard.
Behavior to test: When the editor presses Cmd+S, then manual save runs (preventDefault); Cmd+Enter triggers publish flow (still gated by confirm + blockers); "/" opens the block picker when canvas-focused (not while typing in a text field).
Invariant protected: publish confirm/blocker gates apply to shortcut path identically.
Dependencies: W2 integrated. Expected files: new `useEditorKeyboardShortcuts.ts` hook wired in `SeoPageEditorWorkspace.tsx`; tests. Write boundaries: new hook + workspace wiring ONLY — do not edit SeoPublishPanel (W3-A owns it); invoke existing controller callbacks.
Acceptance criteria: [ ] three shortcuts work; [ ] "/" suppressed inside inputs/contenteditable; [ ] Cmd+Enter respects blockers/confirm.
RGR: RED hook unit tests (key events → callbacks, suppression cases); GREEN; REFACTOR. Gates: repo gate; browser demo screenshots/recording. Parallelization: W3-C. Worker: feature-slice-worker. Exit: tests + evidence.
Blocked on: W2 integration.

### N15 - Quick Tour → opt-in (I17)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: editor opens the builder for the first time.
Behavior to test: When the editor opens, then the Quick Tour does NOT auto-start; an affordance starts it on demand. Check against the prior tour-positioning fix (`walkthrough-card-position.ts` + test) — preserve it.
Dependencies: W2 integrated. Expected files: `BuilderEditorWalkthrough.tsx`, walkthrough utils/tests. Write boundaries: walkthrough files.
Acceptance criteria: [ ] no auto-start; [ ] manual start works; [ ] positioning fix intact (existing test green).
RGR: RED test on start-trigger condition; GREEN; REFACTOR. Gates: repo gate; browser screenshots. Parallelization: W3-D. Worker: feature-slice-worker. Exit: tests + screenshots.
Blocked on: W2 integration.

### N16 - Revision page labels + AM/PM + context (I18)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin opens a revision page.
Behavior to test: When revisions render, then each shows a proper version label (incl. `manual_save` from N9), the AM/PM display matches the editor's formatting (root-cause the mismatch — likely formatter divergence), and richer context (who/what) renders.
Dependencies: N9; W2 integrated. Expected files: `src/app/admin/pages/[id]/revisions/[revisionId]/page.tsx` (+ list page), shared date formatter, tests. Write boundaries: revisions route + shared formatter (announce formatter change to integrator — shared util).
Acceptance criteria: [ ] labels per revision_type; [ ] AM/PM consistent with editor (state root cause); [ ] context shown.
RGR: RED formatter/label tests; GREEN; REFACTOR. Gates: repo gate; browser screenshot. Parallelization: W3-E. Worker: feature-slice-worker with root-cause expectation on the mismatch. Exit: tests + screenshot + root-cause note.
Blocked on: N9, W2 integration.

### N17 - A11y batch (I12)

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: keyboard/AT user across editor + revision pages.
Behavior to test: When tabbing the editor, then SEO fields are not stranded at stops 28–33 behind page-preview chrome (skip-links + de-tabbed preview chrome); landmarks fixed (duplicate `main` on revision page, nested `complementary`, duplicate wizard regions); `nextjs-portal` not focusable without outline; Archive gets a non-color cue; eye/move targets ≥ usable size.
Dependencies: N11, N16 (touches same chrome/revision surfaces — runs after). Expected files: editor chrome components, revision page, portal/global styles. Write boundaries: broad but additive a11y — no behavior/logic changes.
Acceptance criteria: [ ] tab order test (SEO fields reachable early or via skip-link); [ ] axe landmark violations 0; [ ] focus outline present on all focusables; [ ] Archive has icon/text cue; [ ] targets meet 24px minimum.
RGR: RED scripted axe + tab-order assertions failing on current; GREEN; REFACTOR. Gates: repo gate; browser gate = axe full rerun vs `axe-results.json` baseline (all serious/critical cleared), tab-order recording. Parallelization: W4 single-threaded 1/3 (broad surface). Worker: feature-slice-worker. Exit: axe before/after, tab-order evidence.
Blocked on: N11, N16.

### N18 - Jargon/copy sweep (I11)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: non-expert admin reads editor/list/redirect copy.
Behavior to test: When UI copy renders, then: Eyebrow→"Overline (eyebrow)", Slug→"URL ending (slug)", CTA/Governance expanded, workflow filter labels and redirect status copy words-first — one pass across editor + list + redirects.
Dependencies: N17 (after a11y batch settles shared files; after N7/N12/N13 via wave order). Expected files: copy strings across editor components, list page, redirects page. Write boundaries: string/label changes only — zero logic.
Acceptance criteria: [ ] agreed renames applied consistently; [ ] no test references stale copy (update assertions); [ ] tone matches design contracts.
RGR: copy-level — RED update test assertions first where they pin copy; GREEN apply; REFACTOR n/a. Gates: repo gate (vitest catches stale strings); browser spot screenshots. Parallelization: W4 single-threaded 2/3. Worker: feature-slice-worker. Exit: diff summary + screenshots.
Blocked on: N17.

### N19 - P3 batch (I20)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: various minor flows.
Behavior to test (sub-items, each small): bulk select on list; Help/support link; truncated "Schedule faile…" label; no-results CTA balance; avatar FAB overlapping Sign out; share-menu stays open; preview-URL trust copy; thin-page publish warning; canvas-renders-public-chrome confusion note; create-gate hydration flakiness; dev-page (block-preview-audit) note.
Dependencies: N18 (overlapping surfaces). Expected files: misc small surfaces per item. Write boundaries: per-item minimal; hydration-flakiness item requires root-cause note, not a blind retry hack.
Acceptance criteria: [ ] each sub-item fixed or explicitly deferred with reason in report (no silent drops).
RGR: per-item lightweight tests where logic exists; visual items → screenshot evidence. Gates: repo gate; browser spot checks. Parallelization: W4 single-threaded 3/3. Worker: feature-slice-worker. Exit: per-item checklist with evidence.
Blocked on: N18.

### N20 - Final proof: journeys + verification.md

Status: PENDING
Tier: verification
Type: verification
Actor/trigger: orchestrator after all nodes DONE.
Behavior to test: requirement-by-requirement audit per feature-proof.
Dependencies: N1–N19.
Acceptance criteria:

- [ ] Re-run publish + schedule Playwright journeys (pattern of `reports/ux-persona-review-seo-builder/scripts/journeys2.mjs`, throwaway drafts, cleanup after): all blockers visible upfront; schedule visibly confirmed; behaviour at target ≥3.5/5 equivalent (was 1.2 / 1.3).
- [ ] Full repo gates: `tsc --noEmit`, eslint, full `vitest run`, production build.
- [ ] Axe rerun: serious/critical = 0 on editor, list, redirects, revisions.
- [ ] Issue audit I1–I20: each mapped node DONE with fresh evidence.
- [ ] Behavior preservation: scheduler tests green; redirect resolution curl proof; publish confirm intact; Pacific Time untouched.
- [ ] `verification.md` written with PASS / PASS WITH RISKS / BLOCKED / FAIL.
      Parallelization: W5 single. Worker role: feature-proof stage. Exit evidence: verification.md + journey artifacts.
      Blocked on: all prior nodes.
