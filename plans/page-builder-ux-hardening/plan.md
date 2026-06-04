# Feature Plan: Page Builder UX Hardening

Status: DONE
Last updated: 2026-06-05
Owner: feature-orchestrator

## Working Brief

- Feature: Fix the current verified SEO Page Builder UX failures from `reports/ux-persona-review/UX-REVIEW.md` and the fresh browser check without changing the intended editor, publish, route, or block behavior.
- Primary actors: Admin content editors, super admins, and internal reviewers using `/admin/pages/*`.
- Core invariant: Draft edits, autosave, preview links, publish gates, route-prefix paths, redirects, revision history, block schemas, public rendering, and dev-only audit access must keep their current intended behavior unless a node explicitly changes the user-facing interaction.
- Previous intended behaviors: Existing page list filters/actions, editor autosave/manual save, preview creation, route-prefix public URL generation, SEO readiness blockers, publish validation, block inline editing, AI proposal review, author profile listing, redirect creation, and development-only block-preview audit remain intact.
- Intentional behavior changes: Improve copy-link reliability/error handling, add editor publish confirmation, reduce editor visual/control overload, make narrow editor actions usable, simplify create-page choices, replace implementation-shaped admin labels with marketer-facing guidance, and make block-preview audit responsive/a11y-safe as an internal dev tool.
- Unsafe outcomes: Accidental publish/unpublish/archive, weakening publish validation, losing draft content, mutating public routes unintentionally, hiding required SEO blockers, removing existing advanced settings, exposing dev-only tools in production, or inventing content/business claims.
- Evidence: `reports/ux-persona-review/UX-REVIEW.md`; fresh Browser evidence under `/tmp/page-builder-ux-roast-20260605/`; `docs/design/admin-studio.md`; `docs/design/page-builder.md`; `docs/design/page-builder-blocks.md`; `docs/design/visual-review-checklist.md`; current source reads of editor top rail, publish panel, new-page shell, authors, redirects, page list, and block-preview audit route.
- Assumptions: Scope is the current confirmed UX failures, not every historical/stale report item. Routine UX details can use safe defaults from the design contracts. No production data mutation, schema migration, push, PR, Vercel preview, or deploy is part of this graph unless the user explicitly asks.
- Out of scope: Full undo/redo system, drag-and-drop reordering, keyboard command palette, content import/migration tooling, public custom-domain behavior, production data cleanup, and broad visual rebrand.

## Risk Classification

- Overall tier: T2 because the graph includes editor publish confirmation and admin state-transition affordances, but most nodes are T3 UI/copy/layout hardening.
- Live-data risk: Low for implementation. Browser proof must use the existing sample page and avoid publish/delete/create side effects unless a disposable draft is deliberately created and cleaned up.
- Migration risk: None expected.
- External-contract risk: Low. Clipboard and preview/public URL behavior must preserve existing path generation.

## Dependency Graph

| Node | Title                                                           | Tier | Depends On           | Parallel Group | Shared-State Risk               | Status |
| ---- | --------------------------------------------------------------- | ---- | -------------------- | -------------- | ------------------------------- | ------ |
| S0   | Re-verify and triage current UX findings                        | T0   | none                 | W0-A           | browser/session evidence        | DONE   |
| S1   | Make copy-link actions reliable and visibly actionable          | T3   | S0                   | W1-A           | editor top rail                 | DONE   |
| S2   | Add editor publish confirmation without weakening publish gates | T2   | S0                   | W1-B           | editor publish form             | DONE   |
| S3   | Rework editor top-rail hierarchy for desktop/tablet/mobile      | T3   | S1                   | W2-A           | top rail, responsive controller | DONE   |
| S4   | Reduce editor control overload with progressive disclosure      | T3   | S3                   | W3-A           | canvas/blocks/SEO panels        | DONE   |
| S5   | Simplify create-page entry and remove dead-primary choices      | T3   | S0                   | W1-C           | new-page shell                  | DONE   |
| S6   | Replace implementation-shaped labels on list/authors/redirects  | T3   | S0                   | W1-D           | admin shell pages               | DONE   |
| S7   | Fix block-preview audit mobile overflow and heading semantics   | T3   | S0                   | W1-E           | dev-only audit route            | DONE   |
| S8   | Final behavior-preservation proof                               | T2   | S1,S2,S3,S4,S5,S6,S7 | W4-A           | verification only               | DONE   |

## Nodes

### S0 - Re-verify and triage current UX findings

Status: DONE
Tier: T0
Type: verification
Actor/trigger: Feature orchestrator opens the current page-builder routes in Browser.
Behavior to test: When the audit is used as input, then stale findings are dropped and current findings are scoped from rendered evidence.
Invariant protected: Do not fix stale audit artifacts or regress intended behavior while chasing old screenshots.
Intentional behavior changes: None.
Previous intended behaviors preserved: All existing source behavior; this is verification-only.
Unsafe outcomes: Planning from stale findings; overstating fixed issues.
Dependencies: none.
Expected files: plan artifacts only.
Write boundaries: `plans/page-builder-ux-hardening/*`.
Acceptance criteria:

- [x] Current editor rendered on desktop, tablet, and 390px mobile.
- [x] Copy-link failure reproduced against current browser.
- [x] Supporting shell routes checked for current/stale findings.
- [x] Block-preview audit checked after load on 390px mobile.
      Regression guards:
- Treat old report findings as input, not truth, until reproduced.
  RGR:
- RED: Current UX failures documented from rendered evidence.
- GREEN: Current/stale triage captured in this plan.
- REFACTOR: Split follow-up work into behavior-preserving nodes.
  Gates:
- Repo gate: skipped, no source change.
- Browser gate: DONE via Browser screenshots in `/tmp/page-builder-ux-roast-20260605/`.
- Boundary/migration gate: skipped, no boundary changes.
  External docs needed: none.
  Parallelization: blocking verification node.
  Worker role: orchestrator.
  Exit evidence: Fresh Browser metrics showed editor `83` buttons / `58` inputs desktop, `103` controls mobile, copy failure with empty clipboard, and block audit mobile `scrollWidth` 566 on 390px viewport.
  Blocked on: none.

### S1 - Make copy-link actions reliable and visibly actionable

Status: DONE
Tier: T3
Type: behavior
Actor/trigger: Admin clicks `Copy editor link` or `Copy public URL`.
Behavior to test: When Clipboard API write fails, then the user still gets a selectable URL/manual fallback and a visually distinct error state; when write succeeds, the existing success message remains.
Invariant protected: Editor URL and public URL formatting remain unchanged; no navigation, save, preview, or publish behavior changes.
Intentional behavior changes: Copy failure no longer strands the user with a quiet grey `Could not copy link.` message.
Previous intended behaviors preserved: Buttons remain available from the top rail when a page/public path exists; successful clipboard copy still writes the same URL and shows success.
Unsafe outcomes: Copying stale/wrong public URL, exposing raw ids beyond the editor URL, or causing form submission.
Dependencies: S0.
Expected files: `src/components/admin/seo-page-editor/SeoPageEditorTopRail.tsx`; focused helper test if practical.
Write boundaries: Top rail copy helper/message rendering only.
Acceptance criteria:

- [x] Clipboard success writes the expected URL and shows a neutral/success message.
- [x] Clipboard failure shows a red actionable message and renders the URL for manual copy.
- [x] Browser proof shows `Copy public URL` no longer leaves the reviewer without a usable URL.
      Regression guards:
- Existing save/preview/autosave controls still render.
- Mobile labels (`Editor link`, `Public URL`) still fit in the top rail.
  RGR:
- RED: Focused helper test initially failed before `copyRailUrl` was exported and typed for injection.
- GREEN: `copyRailUrl` now returns typed success/error results, and failed clipboard writes show a red manual-copy fallback.
- REFACTOR: Added direct input labelling and kept the top-rail redesign out of this slice.
  Gates:
- Repo gate: DONE - `npm run test -- src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts`; `npm run typecheck -- --pretty false`; targeted `npx eslint`.
- Browser gate: DONE - `/tmp/page-builder-ux-hardening-s1/copy-public-fallback-desktop-labelled.png`.
- Boundary/migration gate: skipped - no boundary changes.
  External docs needed: none.
  Parallelization: W1-A; blocks S3 because S3 will touch the same top rail.
  Worker role: top-rail behavior worker.
  Exit evidence: `src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts` passed 3 tests; typecheck passed; targeted ESLint passed; Browser confirmed fallback message, no old `Could not copy link.` text, visible labelled manual URL input with `http://localhost:3000/resources/vending-in-college`.
  Blocked on: none.

### S2 - Add editor publish confirmation without weakening publish gates

Status: DONE
Tier: T2
Type: behavior
Actor/trigger: Admin clicks editor `Publish` / `Publish changes`.
Behavior to test: When publish is allowed and the admin clicks Publish, then a confirmation names the public consequence before the form submits.
Invariant protected: Existing `publishDisabled`, SEO blockers, server action validation, publish notes, and list-row confirmations remain unchanged.
Intentional behavior changes: The editor matches list-row publish safety by requiring explicit confirmation before a public state transition.
Previous intended behaviors preserved: Blocked publish still focuses the next-step reason; save draft still submits without confirmation.
Unsafe outcomes: Public publish without confirmation; blocked publish submitting; confirmation on save.
Dependencies: S0.
Expected files: `src/components/admin/seo-page-editor/SeoPublishPanel.tsx` and possibly `useSeoPageEditorController.ts`.
Write boundaries: Editor publish submit handler/button behavior only.
Acceptance criteria:

- [x] Confirm cancel prevents publish submit.
- [x] Confirm accept remains the only submit path for publish.
- [x] Blocked publish still does not submit and still focuses blocker reason.
      Regression guards:
- List publish confirmations remain unchanged.
- Server-side publish validation unchanged.
  Gates:
- Repo gate: DONE - `npm run test -- src/components/admin/seo-page-editor/SeoPublishPanel.test.ts src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts`; `npm run typecheck -- --pretty false`; targeted `npx eslint`.
- Browser gate: DONE - inline confirmation proof at `/tmp/page-builder-ux-hardening-s2/publish-inline-confirm-desktop.png`; Cancel dismissed without publish.
- Boundary/migration gate: none.
  External docs needed: none.
  Parallelization: W1-B.
  Worker role: publish-safety worker.
  Exit evidence: Focused helper tests passed; typecheck passed; targeted ESLint passed; Browser confirmed inline `alertdialog` with consequence text, `Cancel` removed it, and no `Page published.` text appeared.
  Blocked on: none.

### S3 - Rework editor top-rail hierarchy for desktop/tablet/mobile

Status: DONE
Tier: T3
Type: frontend
Actor/trigger: Admin opens the editor on desktop, tablet, or 390px mobile.
Behavior to test: When the editor loads, then the top rail presents one clear primary action cluster without wrapping into a confusing multi-row pill cloud.
Invariant protected: All existing commands remain reachable; collapse/open logic for Blocks and SEO panels remains intact.
Intentional behavior changes: Visual hierarchy and grouping change; command semantics do not.
Previous intended behaviors preserved: Save, preview, editor/public copy, Pages back, Blocks toggle, SEO toggle, autosave status.
Unsafe outcomes: Hiding save/preview, making side panels unreachable, introducing overlap, or causing horizontal overflow.
Dependencies: S1.
Expected files: `SeoPageEditorTopRail.tsx`, maybe `editor-responsive.ts` or lightweight shared style constants.
Write boundaries: Top rail layout/styling only.
Acceptance criteria:

- [x] Desktop rail has clear grouped commands without competing pills.
- [x] Tablet rail remains usable and does not consume excessive first viewport.
- [x] 390px mobile rail is intentionally grouped, not a cloud of seven peers.
- [x] No horizontal overflow.
      Regression guards:
- Copy fallback from S1 still works.
- Save/preview buttons remain visible.
  Gates:
- Repo gate: DONE - focused TopRail/PublishPanel tests, `npm run typecheck -- --pretty false`, and targeted `npx eslint`.
- Browser gate: DONE - desktop, Share-open desktop, 768px tablet, and 390px mobile screenshots in `/tmp/page-builder-ux-hardening-s3/`.
- Boundary/migration gate: none.
  External docs needed: `docs/design/page-builder.md`, `docs/design/visual-review-checklist.md`.
  Parallelization: W2-A, after S1.
  Worker role: responsive editor chrome worker.
  Exit evidence: Top rail now keeps `Pages`, `Blocks`, `Save draft`, `Live preview`, `Share`, and `SEO` as the visible command set while nesting editor/public copy actions inside `Share`. Browser proof showed no horizontal overflow at 1280px, 768px, or 390px; the first tablet/mobile captures were invalid loading states, then refreshed proof captured ready editor content at `/tmp/page-builder-ux-hardening-s3/editor-tablet-768-ready.png` and `/tmp/page-builder-ux-hardening-s3/editor-mobile-390-ready.png`.
  Blocked on: none.

### S4 - Reduce editor control overload with progressive disclosure

Status: DONE
Tier: T3
Type: frontend
Actor/trigger: Admin opens an existing page editor.
Behavior to test: When the editor loads, then the canvas is the focal point and advanced/sidebar controls do not overwhelm the first viewport.
Invariant protected: All block fields, SEO settings, governance fields, autosave, hidden form values, and publish readiness remain available and persist correctly.
Intentional behavior changes: Default visible density and grouping change; no content model changes.
Previous intended behaviors preserved: Inline editing, block outline navigation, settings modal, SEO readiness, governance comments, revisions, AI assistant.
Unsafe outcomes: Unmounting required hidden values, losing autosave metadata, hiding blockers, or moving technical settings into the canvas.
Dependencies: S3.
Expected files: `SeoPageEditorWorkspace.tsx`, `BuilderBlocksPanel.tsx`, `SeoPublishPanel.tsx`, canvas/panel helpers as needed.
Write boundaries: Editor layout/progressive disclosure only; no service/server action changes.
Acceptance criteria:

- [x] First viewport on desktop has the canvas as the dominant focal point.
- [x] Advanced SEO/governance/revision sections are reachable but not all competing at once.
- [x] Visible control count on first load materially decreases without removing required actions.
- [x] Save/reload preserves values from collapsed areas.
      Regression guards:
- `SeoPageEditorHiddenFields` and collapsed SEO values still submit.
- Publish blockers still visible enough to act on.
  Gates:
- Repo gate: DONE - focused editor tests, `npm run typecheck -- --pretty false`, and targeted `npx eslint`.
- Browser gate: DONE - desktop first-load, Blocks-open, after-save-reload, and mobile screenshots in `/tmp/page-builder-ux-hardening-s4/`.
- Boundary/migration gate: none.
  External docs needed: `docs/design/page-builder.md`, `docs/design/page-builder-blocks.md`.
  Parallelization: W3-A.
  Worker role: editor IA worker.
  Exit evidence: Desktop first-load now starts with Blocks collapsed and SEO/publish visible, giving the canvas a wider first viewport while keeping publish readiness in sight. Browser proof showed 24 visible first-viewport controls with Blocks closed versus 34 with Blocks open, no horizontal overflow, header/footer controls reachable after opening Blocks, and identical `draftContent` before Save draft and after reload. Mobile proof remained no-overflow with panels closed by default.
  Blocked on: none.

### S5 - Simplify create-page entry and remove dead-primary choices

Status: DONE
Tier: T3
Type: frontend/copy
Actor/trigger: Admin opens `/admin/pages/new`.
Behavior to test: When creating a page, then the admin can start from the recommended/default path without dead disabled tiles dominating the screen.
Invariant protected: Page type/template metadata, existing blank/default template choices, and server create behavior remain unchanged.
Intentional behavior changes: Dead `Coming soon` options are hidden or demoted; copy becomes plain language and matched to controls.
Previous intended behaviors preserved: Page type selection, starting point selection, template gating for future features.
Unsafe outcomes: Removing future template extensibility, changing page type defaults, or creating pages accidentally.
Dependencies: S0.
Expected files: `src/components/admin/seo-page-editor/SeoPageEditorShell.tsx`.
Write boundaries: Create-page shell copy/layout only.
Acceptance criteria:

- [x] Primary create screen no longer gives prime space to disabled future features.
- [x] Copy avoids `page path`, `scoped templates`, and unexplained `AI context`.
- [x] Current default selections and `Start building` behavior remain unchanged.
      Regression guards:
- Future template path can still be re-enabled from code.
- No page is created until the user starts building.
  Gates:
- Repo gate: DONE - `npm run typecheck -- --pretty false`; targeted `npx eslint`.
- Browser gate: DONE - desktop and 390px mobile screenshots in `/tmp/page-builder-ux-hardening-s5/`.
- Boundary/migration gate: none.
  External docs needed: `docs/design/admin-studio.md`.
  Parallelization: W1-C.
  Worker role: create-flow worker.
  Exit evidence: Browser confirmed old copy/disabled tiles absent, new copy and `Start building` present, and 390px mobile `scrollWidth` equals viewport width. Screenshots: `/tmp/page-builder-ux-hardening-s5/new-page-desktop.png`, `/tmp/page-builder-ux-hardening-s5/new-page-mobile-390.png`.
  Blocked on: none.

### S6 - Replace implementation-shaped labels on list/authors/redirects

Status: DONE
Tier: T3
Type: frontend/copy
Actor/trigger: Admin scans page list, creates an author, or creates a redirect.
Behavior to test: When the admin sees labels like `Governance`, `Avatar asset ID`, `Page ID`, or `301 permanent`, then the UI explains or replaces them with marketer-facing language.
Invariant protected: Existing actions, form field names, select values, validation, and redirect status behavior remain unchanged.
Intentional behavior changes: Labels/help text improve; no data contracts change.
Previous intended behaviors preserved: Existing author list, redirect list, page filters, and route query behavior.
Unsafe outcomes: Changing redirect semantics, breaking form actions, or removing advanced values needed by admins.
Dependencies: S0.
Expected files: `src/app/admin/pages/page.tsx`, `src/app/admin/pages/authors/page.tsx`, `src/app/admin/pages/redirects/page.tsx`.
Write boundaries: Admin UI copy/help text only unless tests reveal label-only components need small extraction.
Acceptance criteria:

- [x] Redirect status options lead with plain language while preserving HTTP codes.
- [x] Raw ID fields are clearly advanced/internal or replaced with existing picker affordances if already available.
- [x] List governance/status language is scan-friendly and not color-only.
      Regression guards:
- Form payload names unchanged.
- Existing page-list URL state tests pass.
  Gates:
- Repo gate: DONE - page/authors tests, typecheck, targeted lint.
- Browser gate: DONE - screenshots of pages list, authors, redirects in `/tmp/page-builder-ux-hardening-s6/` plus rendered role-label check.
- Boundary/migration gate: none.
  External docs needed: `docs/design/admin-studio.md`.
  Parallelization: W1-D.
  Worker role: admin language worker.
  Exit evidence: Browser confirmed `super_admin`, `Governance`, `Avatar asset ID`, `Page ID`, `301 permanent`, and `Redirect Manager` are absent from the relevant surfaces; `Super admin access`, `WORKFLOW`, `Avatar media ID`, `Related page ID`, `Permanent move (301)`, and `Redirects` render.
  Blocked on: none.

### S7 - Fix block-preview audit mobile overflow and heading semantics

Status: DONE
Tier: T3
Type: frontend/accessibility
Actor/trigger: Developer/admin opens dev-only `/admin/pages/block-preview-audit`.
Behavior to test: When the audit renders on 390px mobile, then comparison cards fit within the viewport and rendered sample headings do not pollute the document outline.
Invariant protected: Route remains development-only and noindex; actual render and picker preview comparison content remains useful.
Intentional behavior changes: Responsive containment and semantic isolation change; preview data stays the same.
Previous intended behaviors preserved: Parity markers, mocked block content, picker preview vs actual render comparison.
Unsafe outcomes: Hiding comparison content entirely, weakening dev-only gate, or changing public renderer behavior to satisfy the audit route.
Dependencies: S0.
Expected files: `src/app/admin/pages/block-preview-audit/page.tsx`; maybe preview wrapper component.
Write boundaries: Audit route wrappers only; do not change public `ResourcePageContentView` semantics unless separately justified.
Acceptance criteria:

- [x] 390px audit route has no page-level horizontal overflow.
- [x] Audit route exposes one H1 for the page and does not duplicate sample H1s into the accessibility tree.
- [x] Desktop comparison remains readable.
      Regression guards:
- `NODE_ENV !== "development"` still returns `notFound()`.
- Parity markers remain available for scripts/tests.
  Gates:
- Repo gate: DONE - `npm run typecheck -- --pretty false`; targeted `npx eslint`.
- Browser gate: DONE - desktop and 390px mobile screenshots plus heading/scroll-width checks.
- Boundary/migration gate: none.
  External docs needed: `docs/design/admin-studio.md`.
  Parallelization: W1-E.
  Worker role: dev-tool accessibility worker.
  Exit evidence: Browser confirmed 390px `scrollWidth` 390, desktop `scrollWidth` 1280, exposed H1 count 1 after excluding `aria-hidden` preview surfaces, and screenshots in `/tmp/page-builder-ux-hardening-s7/`.
  Blocked on: none.

### S8 - Final behavior-preservation proof

Status: DONE
Tier: T2
Type: verification
Actor/trigger: Orchestrator after S1-S7.
Behavior to test: When all nodes are complete, then the current editor and admin workflows are demonstrably easier without breaking intended behavior.
Invariant protected: All graph invariants.
Intentional behavior changes: None beyond completed nodes.
Previous intended behaviors preserved: All listed working brief behaviors.
Unsafe outcomes: Marking complete without browser proof or skipped-check rationale.
Dependencies: S1,S2,S3,S4,S5,S6,S7.
Expected files: `plans/page-builder-ux-hardening/verification.md`.
Write boundaries: verification artifacts only unless a blocker is found.
Acceptance criteria:

- [x] Focused tests and typecheck pass.
- [x] Browser evidence covers `/admin/pages`, `/admin/pages/new`, editor desktop/tablet/mobile, authors, redirects, and block-preview audit.
- [x] No publish/delete/live-data side effect occurred during verification.
- [x] Behavior preservation confidence recorded.
      Regression guards:
- Dirty worktree reviewed so unrelated `reports/ux-persona-review/` remains untouched unless intentionally included.
  Gates:
- Repo gate: DONE - full Vitest, full ESLint, full typecheck, and React Doctor diff scan.
- Browser gate: DONE - S8 route matrix screenshots in `/tmp/page-builder-ux-hardening-s8/`.
- Boundary/migration gate: DONE - no migrations, production writes, publish, delete, push, PR, preview, or deploy.
  External docs needed: `docs/design/visual-review-checklist.md`.
  Parallelization: final single-threaded gate.
  Worker role: feature-proof verifier.
  Exit evidence: `npm run test` passed 58 files / 322 tests; `npm run lint` passed; `npm run typecheck -- --pretty false` passed; React Doctor diff score 97/100 with residual broader warnings recorded in `verification.md`. Browser proof covered pages list, new page, editor desktop/tablet/mobile, authors, redirects, and block-preview audit with no horizontal overflow. The final mobile editor proof also confirmed the hero eyebrow wraps and has an associated label.
  Blocked on: none.
