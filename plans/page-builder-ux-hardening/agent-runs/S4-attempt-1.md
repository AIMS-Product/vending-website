# S4 Attempt 1 - Editor Control Density

Status: DONE
Date: 2026-06-05
Owner: Codex

## Scope

- Updated `src/components/admin/seo-page-editor/useSeoPageEditorController.ts`.
- Changed the desktop block outline panel to be collapsed by default.
- Left SEO/readiness/publish open by default so blockers and publish actions remain visible.
- Kept existing `Blocks` top-rail toggle behavior for accessing the outline and header/footer switches.

## Verification

- `npm run test -- src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts src/components/admin/seo-page-editor/SeoPublishPanel.test.ts src/components/admin/seo-page-editor/editor-form-data.test.ts` passed.
- `npm run typecheck -- --pretty false` passed.
- Targeted ESLint for the editor controller/workspace/panel files passed.
- Browser proof:
  - `/tmp/page-builder-ux-hardening-s4/editor-desktop-first-load.png`
  - `/tmp/page-builder-ux-hardening-s4/editor-desktop-blocks-open.png`
  - `/tmp/page-builder-ux-hardening-s4/editor-desktop-after-save-reload.png`
  - `/tmp/page-builder-ux-hardening-s4/editor-mobile-first-load.png`

## Browser Findings

- Desktop first load: Blocks panel closed, SEO/publish panel visible, no horizontal overflow, visible first-viewport controls reduced to 24.
- Blocks opened: outline and `Show header` / `Show footer` controls remained reachable, no horizontal overflow, visible first-viewport controls measured 34.
- Save/reload: clicked `Save draft`, reloaded the editor, and confirmed the hidden `draftContent` string was identical before save and after reload.
- Mobile: top rail and canvas remained usable with no horizontal overflow; side panels were not opened on first load.

## Residual Notes

- This slice intentionally reduces first-load density without rebuilding block editing or introducing a new panel persistence model.
- Publish confirmation and SEO readiness remain governed by S2 and the existing server validation.
