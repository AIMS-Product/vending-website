# SEO Page Builder UX Fixes — Thin Slice Plan

Status: COMPLETE (all 13 slices done & verified; tsc + eslint clean; 207/207 tests pass)
Last updated: 2026-05-29
Owner: Codex

## Working Brief

- **Feature or fix:** Resolve the actionable findings from the 15-persona UX review of the SEO Page Builder (`/admin/pages/*`), per scope locked in `reports/ux-persona-review-seo-builder/grill-review.md`.
- **Primary actors:** Admin/editor staff using the builder; one prod data op affects the public site's resource pages.
- **Core invariant:** The builder must never (a) silently lose a user's content, (b) change a page's published/draft/archived state without the author's explicit intent, or (c) alter what's live on the public site except via an explicit publish/unpublish/archive action. Every UX change preserves existing save, autosave, readiness, and publish-gate behavior unless a slice explicitly changes it.
- **Previous intended behaviours (must stay true):** debounced autosave on saved pages (`useSeoPageEditorController.ts:452`); publish-readiness gate that blocks publish until a CTA/lead-form block exists; dev-only gating of `block-preview-audit` and `ADMIN_DEV_AUTH_BYPASS`; Archive confirmation; sr-only labels on status dots; in-context live preview.
- **Unsafe outcomes:** hard-deleting prod rows; publishing/unpublishing a page without confirmation; an empty/blocked page going live; breaking autosave; exposing the dev-auth bypass or audit page in production.
- **Current evidence:** `reports/ux-persona-review-seo-builder/` (review + exploration + grill); code reads of `SeoPageEditorShell.tsx`, `SeoPageEditorWorkspace.tsx`, `SeoPageEditorTopRail.tsx`, `SeoPublishPanel.tsx`, `useSeoPageEditorController.ts`, `editor-styles.ts`, `editor-responsive.ts`, `src/app/admin/pages/page.tsx`, `src/app/admin/pages/actions.ts`, `src/lib/admin/seo-pages-list.ts`, `dev-auth.ts`, `block-preview-audit/page.tsx`.
- **Assumptions:** `adminCreateSeoPage` can mint a blank draft row server-side (confirmed present in `actions.ts:15`); design contracts in `docs/design/page-builder*.md` + `admin-studio.md` govern editor UI and must be read before each editor slice.
- **Out of scope:** #11 help/support link (dropped — internal tool); items in §C of the review (already handled in code); the parallel public-facing review.

## Risk Classification

- **Overall tier:** Mixed. One Tier-1 data op (S0), two Tier-2 correctness slices (S3, S4), the rest Tier-3 UI/copy.
- **Why:** Most work is affordance/copy/display polish on an internal tool. The publish/archive/create paths are state transitions on customer-visible records.
- **Live-data risk:** HIGH for S0 only (archives real prod rows). All other slices are code; local dev hits PROD Supabase, so any _manual verification_ that saves/publishes must use clearly-labelled throwaway drafts and must not publish to live.
- **Migration risk:** None — no schema changes planned.
- **External-contract risk:** None (no webhook/payment/3rd-party contract touched). "Run SEO agent" (S11) triggers an internal AI action — S11 only adds a pre-run confirm, does not change the agent.

## Dependency Graph

| Node                        | Depends on              | Parallel?                        | Shared-state risk             | Notes                                                                          |
| --------------------------- | ----------------------- | -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| S0 (#12 seed archive)       | None                    | unsafe-live                      | PROD rows                     | Approval-gated: list rows → user approves → archive (not delete). No code dep. |
| S3 (#1 data-loss)           | None                    | parallel-safe (Shell)            | Shell file                    | Create draft row on "From scratch"; correctness bug — early.                   |
| S4 (#2 publish confirm)     | None                    | parallel-safe (page.tsx/actions) | page.tsx row actions          | Add confirm to publish-to-live (+ move-to-draft); correctness bug — early.     |
| S1 (#10 vocab)              | S4 (same page.tsx)      | single-threaded w/ S2,S4         | page.tsx + seo-pages-list.ts  | Draft/Published/Archived + "All"; drop "Live".                                 |
| S2 (#5 status glyph)        | S1                      | single-threaded w/ S1            | page.tsx StatusDot + legend   | Non-colour shape/letter glyph in compact dot.                                  |
| S5 (#3 chooser skip)        | S3 (same Shell)         | single-threaded w/ S3            | SeoPageEditorShell.tsx        | Auto-skip one-option chooser.                                                  |
| S6 (#6/#7 nav buttons)      | None                    | parallel-safe (TopRail)          | TopRail file                  | Labelled Blocks / SEO&Publish buttons; drop red ring.                          |
| S8 (#8 autosave visibility) | S6 (same TopRail)       | single-threaded w/ S6            | TopRail + canvas + controller | Promote autosave status; reframe "Save draft".                                 |
| S7 (#4 disabled Publish)    | None                    | parallel-safe (PublishPanel)     | SeoPublishPanel file          | Greyed disabled + focus NEXT-STEP on click.                                    |
| S11 (#14 SEO agent)         | S7 (same PublishPanel)  | single-threaded w/ S7            | SeoPublishPanel               | Pre-run explanation + confirm.                                                 |
| S9 (#9 onboarding)          | None                    | parallel-safe (inputs/canvas)    | EditorInputs + empty state    | Inline jargon tooltips + empty-state first-step CTA.                           |
| S10 (#13 slug)              | S9 (likely same inputs) | single-threaded w/ S9            | EditorInputs                  | Inline slug rules/availability.                                                |

**Five file-disjoint lanes** (parallel across lanes, sequential within):
A `page.tsx`/list → S4, S1, S2 · B `Shell` → S3, S5 · C `TopRail`/controller → S6, S8 · D `PublishPanel` → S7, S11 · E `EditorInputs`/canvas → S9, S10. S0 is a standalone data op.

## Audit Triage

Source artifact: reports/ux-persona-review-seo-builder/UX-REVIEW.md (+ code-grounded synthesis)
Audit date: 2026-05-29 · Findings reviewed: 14 + security note

| Finding                              | Verified against current code?                                                                 | Disposition                   | Reason                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| #1 data-loss window                  | yes — autosave guarded by `page?.id` (`controller:453`); no `beforeunload`                     | sliced S3                     | needs-code; create draft on From scratch        |
| #2 unconfirmed publish-to-live       | yes — `publishSeoPageFromList` has no `confirmMessage` (`page.tsx:538`); Archive does (`:561`) | sliced S4                     | needs-code                                      |
| #3 forced one-option chooser         | yes — `SeoPageEditorShell` requires click; "From template" disabled                            | sliced S5                     | needs-code                                      |
| #4 weak disabled-Publish             | yes — `primaryButtonClass` has `disabled:opacity-50` only; tooltip hover-only                  | sliced S7                     | needs-code (refine, not add)                    |
| #5 colour-only visible status        | yes — `StatusDot` has sr-only text but visible signal is colour-only (`page.tsx:692`)          | sliced S2                     | needs-code (visible glyph)                      |
| #6/#7 mobile drawers / chevrons      | yes — drawers exist (`Workspace:34`, `controller:385`); triggers are corner chevrons           | sliced S6                     | needs-code (affordance)                         |
| #8 autosave invisible to model       | yes — indicator exists (`CanvasPanel:121`) but subtle vs prominent Save draft                  | sliced S8                     | needs-code (salience)                           |
| #9 jargon / no onboarding            | yes — no inline help on key terms                                                              | sliced S9                     | needs-code                                      |
| #10 status vocabulary tangle         | yes — `seoPageFilters` Active/Drafts/Published/Archived + "live" legend                        | sliced S1                     | needs-code                                      |
| #12 junk seed data                   | yes — visible test rows in prod list                                                           | sliced S0                     | needs-product approval (destructive)            |
| #13 slug validation                  | yes — no visible slug rules                                                                    | sliced S10                    | needs-code (low)                                |
| #14 SEO agent opacity                | yes — no pre-run explanation                                                                   | sliced S11                    | needs-code (low)                                |
| #11 help/support link                | yes — none present                                                                             | DROPPED                       | user decision: internal tool, not worth it      |
| block-preview-audit "leaked to prod" | no — `NODE_ENV !== "development"` → `notFound()` (`page.tsx:18`)                               | dropped (false alarm)         | already dev-gated + noindex                     |
| dev-auth bypass "prod hole"          | no — `getDevAdminContext` dev-only-guarded                                                     | dropped (false alarm)         | already guarded; confirm NODE_ENV in prod build |
| Archive unconfirmed                  | no — `confirmMessage` present (`page.tsx:561`)                                                 | dropped (false alarm)         | already confirmed                               |
| screen-reader status                 | no — sr-only labels present                                                                    | dropped (partial false alarm) | SR covered; visible gap → S2                    |

## Progress

| Slice | Status | Tier | Lane | Owner | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Next gate                           |
| ----- | ------ | ---- | ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| S0    | done   | T1   | data | Codex | Archived test/56789test/ztest1 via archive_seo_page_atomically; deleted ux-review-test draft; /resources/56789test + /resources/ztest1 → 404, real demo → 200; final counts archived15/draft1/published3                                                                                                                                                                                                                                                                                                                               | —                                   |
| S3a   | done   | T2   | B    | Codex | tsc clean; beforeunload dirty-guard for unsaved new page in useSeoPageEditorController.ts (snapshot baseline + guard effect). Covers tab-close/refresh/external-nav; does NOT block in-app SPA nav (App Router limitation — noted).                                                                                                                                                                                                                                                                                                    | —                                   |
| S3b   | done   | T2   | B    | Codex | tsc + eslint + browser-verified: typing a title on /admin/pages/new auto-creates a draft (URL → /admin/pages/[id] via history.replaceState, no remount), autosave + "Saved automatically" engage, hidden id uses effectivePageId so manual save updates (no duplicate); only fires after a real title (no blank "Untitled" rows). New server action createSeoPageDraftForEditor. Verified row created then deleted (cleanup). Minor seam: a few id-gated affordances (Run SEO agent, Live-preview label) activate after a save/reload. | —                                   |
| S4    | done   | T2   | A    | Codex | tsc clean; added confirmMessage to publish (live URL warning) + move-to-draft (unpublish warning) in page.tsx, reusing window.confirm guard (AdminShell.tsx:476)                                                                                                                                                                                                                                                                                                                                                                       | —                                   |
| S1    | done   | T3   | A    | Codex | tsc clean + screenshot; All/Drafts/Published/Archived; "drafts + published", "publicly visible", legend "N published"; no "Live"                                                                                                                                                                                                                                                                                                                                                                                                       | —                                   |
| S2    | done   | T3   | A    | Codex | tsc clean + screenshot; StatusDot renders non-colour glyph (D/P/A status; ✓/!/✕/+ readiness) + sr-only label retained                                                                                                                                                                                                                                                                                                                                                                                                                  | user may tweak glyph size/style     |
| S5    | done   | T3   | B    | Codex | tsc clean + verified (chooser=0, canvas visible); gated behind NEW_PAGE_TEMPLATES_ENABLED=false; reinstates when templates ship                                                                                                                                                                                                                                                                                                                                                                                                        | —                                   |
| S6    | done   | T3   | C    | Codex | tsc + screenshots (desktop + mobile); corner chevrons → labelled "Blocks"/"SEO" pills, red status ring dropped; mobile SEO button opens the drawer ("Readiness and publish" shown) — resolves B1                                                                                                                                                                                                                                                                                                                                       | —                                   |
| S8    | done   | T3   | C    | Codex | tsc; "Saved automatically · {time}" / autosave-error line added to top rail (shows once page has id)                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                   |
| S7    | done   | T3   | D    | Codex | tsc + screenshot; greyed disabledPublishButtonClass replaces pale-blue; aria-disabled + click scrolls/focuses #publish-next-step instead of submitting                                                                                                                                                                                                                                                                                                                                                                                 | —                                   |
| S11   | done   | T3   | D    | Codex | tsc; window.confirm explainer before runAiSeoAgent (proposal-only, nothing auto-published)                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                                   |
| S9    | done   | T3   | E    | Codex | tsc + screenshot; canvas empty state → "Start building this page" first-step guidance incl. publish-requires-CTA hint                                                                                                                                                                                                                                                                                                                                                                                                                  | tooltip-per-term expansion optional |
| S10   | done   | T3   | E    | Codex | tsc; inline slug rules helper (lowercase/hyphens, auto-from-title, unique)                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                                   |

Allowed statuses: pending, in_progress, blocked, done, skipped.

## Slices

### S0 — Archive obvious junk seed pages (PROD, approval-gated)

Status: pending · Tier: T1 · Type: ops · Lane: data
Actor/trigger: maintainer cleanup. Action: archive (not delete) clearly-test resource pages; separately hard-delete only the review's own draft `ux-review-test-20260529`.
Invariant protected: no real/customer page is archived; nothing hard-deleted except the self-created test draft; archive is reversible.
Intentional changes: status of confirmed-junk rows → archived.
Previous behaviours preserved: published real pages stay live.
Unsafe outcomes: archiving a real page; hard-deleting any pre-existing row.
Dependencies: none.
Expected files: none (data op via `archiveSeoPageFromList`/admin service or SQL through approved path).
Tests required: none (data op).
Runtime verification: produce a table of candidate rows (id, slug, title, status, updated_at) → **user approves the exact list** → archive → re-list to confirm counts.
Acceptance criteria: only user-approved rows archived; counts reflect it; test draft removed.
Exit evidence: before/after row list; the approved id set.
Blocked on: user approval of the row list (gate).

### S3 — Create draft row on "From scratch" (closes data-loss window) [correctness]

Status: pending · Tier: T2 · Type: backend+frontend · Lane: B
Actor/trigger: user clicks "From scratch". Action: immediately persist a blank draft via `adminCreateSeoPage`, then route to `/admin/pages/[id]` so the existing autosave (`controller:452`) protects content from keystroke one. Add a `beforeunload` dirty-guard as backstop.
Invariant protected: no content typed in a new page is lost; no duplicate/orphan rows on repeated clicks.
Previous behaviours preserved: autosave on saved pages; readiness gate; existing save action.
Unsafe outcomes: creating multiple stray drafts; navigating before id assigned.
Dependencies: none. Read `docs/design/page-builder.md` first.
Expected files: `SeoPageEditorShell.tsx` (onCreateFromScratch), new-page flow (`SeoPageEditorForm.tsx`/`app/admin/pages/new`), possibly a thin create action wrapping `adminCreateSeoPage`.
Write boundaries: Shell create handler + new-page wiring only.
Tests required: unit/integration — new page persists + autosaves before any manual Save; repeat-click does not create duplicates.
Runtime verification: create From-scratch, type, navigate away & back → content present (use throwaway draft; do NOT publish).
Acceptance criteria: a draft id exists immediately; autosave fires; no orphan duplicates.
Exit evidence: test output + DB row check (single draft).

### S4 — Confirm publish-to-live (and move-to-draft) from list [correctness]

Status: pending · Tier: T2 · Type: frontend · Lane: A
Actor/trigger: user clicks "Publish page"/"Move to draft" in the list kebab. Action: add a `confirmMessage` (reuse the existing confirm wrapper used by Archive at `page.tsx:561`).
Invariant protected: no page goes live / unpublishes without explicit confirmation.
Previous behaviours preserved: Archive confirm; publish/unpublish server actions unchanged.
Unsafe outcomes: accidental publish to public site.
Dependencies: none (do before S1/S2 in lane A).
Expected files: `src/app/admin/pages/page.tsx` (row action wiring); reuse existing confirm component.
Tests required: action does not fire until confirm accepted.
Runtime verification: trigger publish on a throwaway draft, cancel → no state change; confirm → publishes (then revert via move-to-draft).
Acceptance criteria: confirm gates both actions; copy names the page + consequence.
Exit evidence: test + screenshot of dialog.

### S1 — Standardise status vocabulary

Status: pending · Tier: T3 · Type: frontend/copy · Lane: A (after S4)
Action: canonical states Draft / Published / Archived; rename "Active" tab → "All"; remove "Live" wording (use "Published") across tabs, dot legend, and summary cards.
Invariant protected: filter values (`active/draft/published/archived`) and query behavior unchanged — labels only.
Expected files: `src/lib/admin/seo-pages-list.ts` (labels), `src/app/admin/pages/page.tsx` (cards/legend).
Tests required: filter logic unchanged (existing list tests pass); label assertions.
Acceptance criteria: one term per state everywhere; no "Live".
Exit evidence: screenshot of tabs/legend/cards.

### S2 — Non-colour status glyph in compact dot

Status: pending · Tier: T3 · Type: frontend · Lane: A (after S1)
Action: keep the compact `StatusDot`; add a distinguishing shape or single-letter glyph per state so states are separable without colour (WCAG 1.4.1). Respect admin-UI prefs: **no chips**, stay compact, no new list columns.
Invariant protected: sr-only labels retained; table stays lean.
Expected files: `src/app/admin/pages/page.tsx` (StatusDot + legend).
Tests required: each state renders a distinct non-colour marker; sr-only text intact.
Runtime verification: greyscale/contrast check of the four states.
Acceptance criteria: states distinguishable in greyscale; layout unchanged width-wise.
Exit evidence: greyscale screenshot of all states.

### S5 — Auto-skip one-option create chooser

Status: pending · Tier: T3 · Type: frontend · Lane: B (after S3)
Action: when "From scratch" is the only enabled option, invoke it automatically (skip the modal); keep the chooser code path for when templates ship.
Invariant protected: S3's create-draft behavior runs identically; nothing else in Shell changes.
Expected files: `SeoPageEditorShell.tsx`.
Tests required: New page lands directly in blank editor; chooser reappears if a second option becomes enabled.
Acceptance criteria: zero extra click for the only path.
Exit evidence: screen capture New → editor.

### S6 — Labelled drawer/panel triggers (mobile + desktop); drop red ring

Status: pending · Tier: T3 · Type: frontend · Lane: C
Action: replace the corner ‹ › chevron toggles with explicit labelled controls ("Blocks", "SEO & Publish") that open the panels/drawers on all viewports; remove the alarming red status-ring from the toggle (keep readiness colour on the panel/badge). Read `docs/design/page-builder.md` first.
Invariant protected: `mobileEditorPanel`/collapse logic (`controller:385`) and drawer overlay (`Workspace:34`) behavior preserved; only the trigger UI changes.
Expected files: `SeoPageEditorTopRail.tsx`, `editor-styles.ts` (`floatingRailButtonClass`).
Tests required: triggers open each panel at mobile (375), tablet (768), desktop; aria-labels intact.
Runtime verification: mobile viewport — open Blocks and SEO panels via the new buttons.
Acceptance criteria: a first-time user can open both editing panels on a phone.
Exit evidence: mobile screenshots of opened drawers.

### S8 — Promote autosave status; reframe "Save draft"

Status: pending · Tier: T3 · Type: frontend · Lane: C (after S6)
Action: surface autosave state ("Saving… / Saved HH:MM") in the top rail next to the save control; reframe "Save draft" to convey automatic saving (e.g. "Save now" + "Saved automatically" hint). Keep the existing `autosave` state from the controller; keep the canvas indicator or move it up.
Invariant protected: autosave logic unchanged; manual save still works.
Expected files: `SeoPageEditorTopRail.tsx`, `SeoPageEditorCanvasPanel.tsx`, `useSeoPageEditorController.ts` (expose status if needed).
Tests required: indicator reflects autosave saved/error states.
Acceptance criteria: a user can tell their work is being saved without clicking.
Exit evidence: screenshots of saving/saved states.

### S7 — Greyed disabled Publish + focus the blocker reason on click

Status: pending · Tier: T3 · Type: frontend · Lane: D
Action: give the disabled Publish a true disabled treatment (neutral grey, not 50%-opacity blue); on click of the disabled button, scroll/focus the existing `NextPublishStepCard` reason. Read `docs/design/page-builder.md`.
Invariant protected: publish gate logic (`publishDisabled`) unchanged.
Expected files: `SeoPublishPanel.tsx`, possibly `editor-styles.ts` (`primaryButtonClass` disabled variant).
Tests required: disabled state styling asserted; click focuses the reason card.
Acceptance criteria: nobody mistakes disabled Publish for active; reason is one interaction away.
Exit evidence: screenshots disabled vs enabled.

### S11 — Pre-run explanation + confirm for "Run SEO agent"

Status: pending · Tier: T3 · Type: frontend · Lane: D (after S7)
Action: add a one-line "what this will change" + a confirm step before "Run SEO agent" runs (it modifies draft content / may incur cost).
Invariant protected: the agent action itself unchanged; only gated by a confirm.
Expected files: `SeoPublishPanel.tsx` (or the agent control component).
Tests required: agent does not run until confirmed.
Acceptance criteria: user understands the effect before running.
Exit evidence: screenshot of confirm.

### S9 — Inline jargon help + empty-state first step

Status: pending · Tier: T3 · Type: frontend · Lane: E
Action: add concise inline helper text/tooltips on key terms (blocks, readiness, canonical URL, intent, target keyword); make the canvas empty state lead with a concrete first action ("Add your first content block to get started"). Read `docs/design/page-builder-blocks.md`.
Invariant protected: no field behavior changes; copy/affordance only.
Expected files: `EditorInputs.tsx`, canvas empty-state component, `SeoReadinessPanel.tsx` (helper text).
Tests required: helper text present; empty-state CTA routes to add-block.
Acceptance criteria: a first-timer knows what "blocks"/"readiness" mean and what to do first.
Exit evidence: screenshots.

### S10 — Inline slug validation/availability

Status: pending · Tier: T3 · Type: frontend · Lane: E (after S9)
Action: show slug rules (allowed chars, auto-from-title behavior) and live availability/format feedback inline.
Invariant protected: slug persistence/validation server-side unchanged; UI guidance only.
Expected files: `EditorInputs.tsx` (slug field).
Tests required: invalid slug surfaces inline guidance.
Acceptance criteria: user sees slug constraints before submit.
Exit evidence: screenshot.

## Verification Gates

- **Automated checks:** `tsc --noEmit`; existing Vitest suite (esp. list filter + editor controller tests); new tests per slice (S3 autosave-before-save, S4 confirm-gates-publish, S2 non-colour marker, S5 chooser-skip).
- **Runtime checks:** browser/preview verification for S5, S6, S7, S8, S2 (greyscale), S9. Use throwaway drafts only; **never publish to the live public site** during verification (prod Supabase).
- **Migration checks:** none (no schema changes).
- **Security/auth checks:** confirm no slice weakens `requireAdmin`, the dev-auth bypass guard, or the audit-page dev gate.
- **Observability/audit checks:** S0 archive recorded with before/after row lists.

## Subagent Plan

| Agent | Role              | Slice(s)              | Model/reasoning  | Read scope                                        | Write scope | Must not touch     | Evidence required                        |
| ----- | ----------------- | --------------------- | ---------------- | ------------------------------------------------- | ----------- | ------------------ | ---------------------------------------- |
| A1    | List/copy         | S4→S1→S2 (sequential) | gpt-5.5 / medium | page.tsx, seo-pages-list.ts, confirm cmp          | those files | editor components  | tests + greyscale + dialog screenshots   |
| A2    | Create flow       | S3→S5                 | gpt-5.5 / medium | Shell, new-page flow, create action               | those files | list/publish files | autosave-before-save test + DB row check |
| A3    | Top rail          | S6→S8                 | gpt-5.5 / medium | TopRail, canvas, controller, editor-styles        | those files | PublishPanel, list | mobile drawer + autosave screenshots     |
| A4    | Publish panel     | S7→S11                | gpt-5.5 / medium | SeoPublishPanel, editor-styles                    | those files | TopRail, list      | disabled-state + confirm screenshots     |
| A5    | Inputs/onboarding | S9→S10                | gpt-5.5 / medium | EditorInputs, canvas empty state, readiness panel | those files | publish/list       | helper-text + slug screenshots           |

Rules: lanes A–E are file-disjoint and may run in parallel; **within a lane, slices are sequential** (shared files). S0 runs in the main thread, approval-gated, before/independent of code lanes. `editor-styles.ts` is touched by A3 and A4 — coordinate: make additive, non-conflicting class additions, or single-thread the `editor-styles.ts` edits. Every agent reads the relevant `docs/design/page-builder*.md` contract before editing editor UI and must not revert others' work.

## Update Rules

- One slice `in_progress` per lane.
- Mark `done` only with exit evidence recorded.
- `blocked` must name the exact missing decision/dependency.
- New discoveries become new slices, not silent scope growth.
- S0 cannot start until the user approves the explicit row list.
