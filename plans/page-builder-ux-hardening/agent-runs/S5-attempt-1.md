# S5 Attempt 1 - Create-Page Entry Simplification

Status: DONE
Owner: Codex
Date: 2026-06-05

## Scope

- Node: S5 - Simplify create-page entry and remove dead-primary choices.
- Write boundary: `src/components/admin/seo-page-editor/SeoPageEditorShell.tsx`.
- Preserved behavior: page type selection, starting-point selection, selected setup summary, and `Start building` action.

## Changes

- Rewrote the create-page intro from implementation language to plain editor-facing copy.
- Removed the disabled `From template` and `AI-assisted template` primary tiles from the current start screen.
- Kept a short low-emphasis note that saved templates and AI-assisted starts can appear when they are ready.

## RED

- Current `/admin/pages/new` rendered `Choose the page path first... scoped templates and AI context` and disabled `Coming soon` tiles in primary screen space.

## GREEN

- Replaced the copy and removed the dead disabled controls while keeping the existing page type/default start controls.

## REFACTOR

- Kept the change constrained to copy/layout; no create behavior or page-template data changed.

## Verification

- `npm run typecheck -- --pretty false` - passed.
- `npx eslint src/components/admin/seo-page-editor/SeoPageEditorShell.tsx` - passed.
- Browser proof on `/admin/pages/new`:
  - Old copy absent.
  - `Coming soon`, `From template`, and `AI-assisted template` absent.
  - New copy present.
  - `Start building` present.
  - 390px mobile has no horizontal overflow (`scrollWidth` 390, viewport 390).
  - Screenshots:
    - `/tmp/page-builder-ux-hardening-s5/new-page-desktop.png`
    - `/tmp/page-builder-ux-hardening-s5/new-page-mobile-390.png`

## Residual Risk

- The mobile screenshot still shows the global floating `N` avatar overlapping lower content. That is outside S5 and remains for the admin-shell/language pass.
