# S1 Attempt 1 - Copy-Link Fallback

Status: DONE
Owner: Codex
Date: 2026-06-05

## Scope

- Node: S1 - Make copy-link actions reliable and visibly actionable.
- Write boundary: `src/components/admin/seo-page-editor/SeoPageEditorTopRail.tsx` and focused helper test.
- Preserved behavior: same editor/public URL generation, same top-rail buttons, no save/preview/publish changes.

## Changes

- Exported `copyRailUrl` and made it return a typed success/error result.
- Added Clipboard API injection for focused tests.
- On clipboard failure, the top rail now shows a red `alert` message and a visible read-only URL input for manual copying.
- Kept successful copy messaging neutral and unchanged in meaning.

## RED

- `npm run test -- src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts` initially failed because the new helper tests could not access `copyRailUrl` and mock signatures needed correction.
- Prior Browser evidence reproduced the user-visible failure: `Copy public URL` showed `Could not copy link.` and clipboard stayed empty.

## GREEN

- Implemented typed helper return values and rendered the fallback state in `SeoPageEditorTopRail`.
- Added `SeoPageEditorTopRail.test.ts` with success, failure, and no-URL cases.

## REFACTOR

- Added a direct `aria-label` to the manual-copy input after Browser proof showed the visual input existed but the DOM proof selector lacked a stable accessible hook.
- Removed unused mock parameters so targeted ESLint is clean.

## Verification

- `npm run test -- src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts` - passed 3 tests.
- `npm run typecheck -- --pretty false` - passed.
- `npx eslint src/components/admin/seo-page-editor/SeoPageEditorTopRail.tsx src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts` - passed.
- Browser proof on `http://localhost:3000/admin/pages/f7eb8024-bbba-42d9-8b13-932e337f7e32`:
  - `Copy public URL` button count: 1.
  - Fallback message present.
  - Old `Could not copy link.` text absent.
  - Manual input visible.
  - Manual URL value: `http://localhost:3000/resources/vending-in-college`.
  - Screenshot: `/tmp/page-builder-ux-hardening-s1/copy-public-fallback-desktop-labelled.png`.

## Residual Risk

- This slice does not redesign the crowded top rail; S3 owns that.
- Browser clipboard read is unavailable in this in-app browser because the virtual clipboard is not installed, so the runtime proof focused on the failure fallback path that originally failed.
