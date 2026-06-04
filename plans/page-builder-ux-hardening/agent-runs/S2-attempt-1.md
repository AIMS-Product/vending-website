# S2 Attempt 1 - Editor Publish Confirmation

Status: DONE
Owner: Codex
Date: 2026-06-05

## Scope

- Node: S2 - Add editor publish confirmation without weakening publish gates.
- Write boundary: `src/components/admin/seo-page-editor/SeoPublishPanel.tsx` and focused helper test.
- Preserved behavior: publish validation, disabled publish blocker focus, save draft, publish notes, and list-row confirmations.

## Changes

- Added `editorPublishConfirmMessage` to state the public publish consequence using the existing route-prefix path helper.
- Replaced direct editor publish submit with an inline confirmation panel.
- First `Publish` click opens the panel; `Cancel` closes it; `Confirm publish` is the only publish submit button.
- Kept the existing disabled-publish click behavior that scrolls/focuses `#publish-next-step`.

## RED

- Current source showed the editor `Publish` button was `type="submit"` and submitted directly when `editor.publishDisabled` was false.
- Focused tests were added for confirmation copy across draft, published-change, and missing-slug cases.

## GREEN

- Added an inline `alertdialog` confirmation panel inside the publish footer.
- Confirm publish submit keeps `name="intent"` and `value="publish"` so the existing server action path is unchanged.

## REFACTOR

- Avoided native `window.confirm` after a browser proof attempt showed it blocks automation and is poorer evidence for this admin surface.

## Verification

- `npm run test -- src/components/admin/seo-page-editor/SeoPublishPanel.test.ts src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts` - passed 6 tests.
- `npm run typecheck -- --pretty false` - passed.
- `npx eslint src/components/admin/seo-page-editor/SeoPublishPanel.tsx src/components/admin/seo-page-editor/SeoPublishPanel.test.ts src/components/admin/seo-page-editor/SeoPageEditorTopRail.tsx src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts` - passed.
- Browser proof on `http://localhost:3000/admin/pages/f7eb8024-bbba-42d9-8b13-932e337f7e32`:
  - Publish button count: 1.
  - Inline `alertdialog` appeared.
  - Consequence copy included `/resources/vending-in-college`.
  - `Cancel` button count: 1.
  - Cancel removed the dialog.
  - No `Page published.` text appeared before or after cancel.
  - Screenshot: `/tmp/page-builder-ux-hardening-s2/publish-inline-confirm-desktop.png`.

## Residual Risk

- This slice does not test accepting `Confirm publish` in Browser because that would publish the existing sample page. The submit path is preserved by keeping `name="intent"` and `value="publish"` on the confirm button.
