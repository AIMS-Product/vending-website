# SEO Editor Component Decomposition Plan

Status: DONE
Last updated: 2026-05-29
Owner: Codex

## Working Brief

- Feature or fix: Decompose `SeoPageEditorForm.tsx` into focused editor modules while preserving the current SEO Page Builder workflow and visual behavior.
- Primary actors: Admin content editors and maintainers working on the SEO Page Builder.
- Core invariant: Saving, autosave, preview, publish readiness, AI proposal insertion, block editing, media picker usage, and responsive sidebars must behave the same after each extraction.
- Previous intended behaviours: The canvas remains page-like, technical settings stay out of prominent canvas content, locked block variants stay locked, readiness warnings remain actionable, and desktop/mobile editor checks remain clean.
- Unsafe outcomes: Lost hidden form values, stale autosave content, changed block schemas, broken focus/escape behavior, unreachable settings, mobile panel overlap, or a refactor that simply hides coupling behind larger imports.
- Current evidence:
  - Design contracts read: `docs/design/admin-studio.md`, `docs/design/page-builder.md`, `docs/design/page-builder-blocks.md`, `docs/design/visual-review-checklist.md`.
  - `SeoPageEditorForm.tsx` started this plan at 7,097 lines and is currently 36 lines after the controller and panel extraction.
  - New editor modules are under 1,000 lines; largest focused modules are `useSeoPageEditorController.ts` at 997 lines, `BlockSettingsFields.tsx` at 895 lines, and `BlockInlineEditor.tsx` at 807 lines.
  - Existing extracted modules: `src/lib/page-builder/editor-helpers.ts` and `src/lib/page-builder/editor-state.ts`.
  - React Doctor no longer reports `SeoPageEditorForm.tsx` or the new SEO editor modules as giant components.
- Assumptions:
  - This is a behavior-preserving refactor; no visual redesign is intended.
  - Extracted components should keep current markup/classes unless a test or browser check proves a necessary correction.
  - The dirty worktree contains the prior thermo remediation and temporary screenshots; do not revert unrelated artifacts.
- Out of scope:
  - New block types, schema changes, AI behavior changes, publish/service changes, and new visual design.

## Dependency Graph

| Slice                                     | Depends on | Risk | Notes                                                                                 |
| ----------------------------------------- | ---------- | ---- | ------------------------------------------------------------------------------------- |
| S1 Shared editor UI primitives and styles | none       | T3   | Extract class tokens, glyphs, tooltip/menu primitives used by later modules.          |
| S2 SEO readiness sidebar module           | S1         | T3   | Move right-sidebar readiness, AI proposal, link suggestion, and publish-step helpers. |
| S3 Block settings modal module            | S1         | T3   | Move settings modal, optional field wrapper, and block settings panels.               |
| S4 Canvas block editor modules            | S1, S3     | T3   | Move section/column/block editors and block picker/canvas helpers.                    |
| S5 Shell orchestration cleanup            | S2-S4      | T2   | Leave main form as state/actions/orchestration plus top-level layout only.            |
| S6 Final verification                     | S1-S5      | T3   | Run static gates, React Doctor diff, and desktop/mobile browser checks.               |
| S7 Controller and panel split             | S6         | T3   | Move residual form state/actions into a controller hook and split large JSX panels.   |

## Progress

| Slice | Status | Evidence                                                                                                                                                                                                                                                                                                                                     | Next gate                             |
| ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| S1    | done   | `editor-styles.ts` extracted; type/lint/format passed                                                                                                                                                                                                                                                                                        | extract SEO readiness sidebar         |
| S2    | done   | `SeoReadinessPanel.tsx` extracted; main form reduced to 6,036 lines; type/lint/format passed                                                                                                                                                                                                                                                 | extract block settings modal          |
| S3    | done   | `BlockSettingsModal.tsx` extracted; main form reduced to 4,599 lines; type/lint/format passed                                                                                                                                                                                                                                                | extract canvas block editor modules   |
| S4    | done   | Canvas, picker, toolbar, inline block, media block, settings-field, and helper modules extracted; focused type/lint checks passed                                                                                                                                                                                                            | clean main form orchestration         |
| S5    | done   | `SeoPageEditorShell.tsx`, `SeoReadinessHelpers.ts`, and focused settings/field modules extracted; main form reduced to 1,804 lines                                                                                                                                                                                                           | final verification                    |
| S6    | done   | typecheck, lint, format, build, coverage, React Doctor diff, and desktop/mobile rendered checks completed; React Doctor remained 91/100 with residual `SeoPageEditorForm` size/state findings                                                                                                                                                | reduce remaining form controller size |
| S7    | done   | `useSeoPageEditorController.ts`, workspace/panel modules, and hidden/top-rail/canvas/SEO panel components extracted; `SeoPageEditorForm.tsx` is 36 lines; every editor file is below 1,000 lines; React Doctor no longer reports editor-specific findings; typecheck, lint, format, build, coverage, and desktop/mobile rendered checks pass | close plan                            |

## Verification Gates

- Focused `npm run typecheck` after each extraction.
- `npm run lint` and `npm run format:check` after each meaningful slice.
- `npm run build` after module-boundary changes settle.
- `npx react-doctor@latest --verbose --diff origin/main` before completion.
- Browser desktop/mobile checks for `/admin/pages/new` after UI/module extraction.

## Update Rules

- Only mark a slice done after evidence is recorded.
- Keep each extraction behavior-preserving.
- If an extraction reveals a behavior bug, add a new slice instead of hiding it inside the move.
