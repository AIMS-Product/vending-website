# S3 Attempt 1 - Editor Top-Rail Hierarchy

Status: DONE
Date: 2026-06-05
Owner: Codex

## Scope

- Reworked `src/components/admin/seo-page-editor/SeoPageEditorTopRail.tsx`.
- Kept existing `Pages`, `Blocks`, `Save draft`, `Live preview`, `SEO`, editor-link copy, and public-URL copy commands reachable.
- Moved editor/public copy commands into a `Share` menu so copy actions no longer compete as top-level rail pills.
- Preserved the S1 manual-copy fallback behavior.

## Verification

- `npm run test -- src/components/admin/seo-page-editor/SeoPageEditorTopRail.test.ts src/components/admin/seo-page-editor/SeoPublishPanel.test.ts` passed.
- `npm run typecheck -- --pretty false` passed.
- Targeted ESLint for the edited TopRail/PublishPanel files passed.
- Browser proof:
  - `/tmp/page-builder-ux-hardening-s3/editor-desktop-1280.png`
  - `/tmp/page-builder-ux-hardening-s3/editor-desktop-share-open.png`
  - `/tmp/page-builder-ux-hardening-s3/editor-tablet-768-ready.png`
  - `/tmp/page-builder-ux-hardening-s3/editor-mobile-390-ready.png`

## Browser Findings

- Desktop: no horizontal overflow; visible top-level actions reduced to the navigation/panel toggles, save, preview, Share, and SEO.
- Share menu: both `Copy editor link` and `Copy public URL` remain reachable.
- Tablet: refreshed screenshot captured ready editor content with no horizontal overflow.
- 390px mobile: refreshed screenshot captured ready editor content with no horizontal overflow; rail wraps into two compact rows rather than seven peer pills.

## Residual Notes

- The top rail is cleaner, but S4 still owns deeper control-density work inside the editor body.
- The black `N` badge in screenshots is the Next.js development indicator, not app UI.
