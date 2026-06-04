# S7 Attempt 1 - Block Preview Audit Containment

Status: DONE
Owner: Codex
Date: 2026-06-05

## Scope

- Node: S7 - Fix block-preview audit mobile overflow and heading semantics.
- Write boundary: `src/app/admin/pages/block-preview-audit/page.tsx`.
- Preserved behavior: development-only route gate, parity marker attributes, picker preview vs actual render comparison, and public `ResourcePageContentView` behavior.

## Changes

- Added `min-w-0`, `max-w-full`, and `overflow-hidden` containment to the audit route's case/grid/panel wrappers.
- Kept the existing `aria-hidden`/`inert` preview wrappers so sample page headings are not exposed as page navigation semantics.
- Did not change public resource render components.

## RED

- Fresh Browser evidence before the slice showed 390px mobile `scrollWidth` 566 and 95 visible raw DOM headings due preview content.

## GREEN

- Contained the preview harness so scaled 1024px preview content no longer forces page-level horizontal overflow.

## REFACTOR

- Kept containment local to the dev-only audit route rather than changing shared public render components.

## Verification

- `npm run typecheck -- --pretty false` - passed.
- `npx eslint src/app/admin/pages/block-preview-audit/page.tsx` - passed.
- Browser proof on `/admin/pages/block-preview-audit`:
  - 390px mobile `scrollWidth`: 390.
  - 390px mobile horizontal overflow: false.
  - Desktop `scrollWidth`: 1280.
  - Desktop horizontal overflow: false.
  - Exposed heading count outside `aria-hidden` preview content: 31.
  - Exposed H1 count outside `aria-hidden` preview content: 1.
  - Screenshots:
    - `/tmp/page-builder-ux-hardening-s7/block-audit-mobile-390.png`
    - `/tmp/page-builder-ux-hardening-s7/block-audit-desktop.png`

## Residual Risk

- Raw DOM headings still exist inside the intentionally `aria-hidden` preview surfaces because the route renders real public blocks for visual parity. The accessibility check excludes those hidden surfaces.
- The global floating `N` avatar still overlaps mobile/admin content; that is tracked outside this route-specific node.
