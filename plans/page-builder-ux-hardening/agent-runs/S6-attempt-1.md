# S6 Attempt 1 - Admin Label Hardening

Status: DONE
Owner: Codex
Date: 2026-06-05

## Scope

- Node: S6 - Replace implementation-shaped labels on list/authors/redirects.
- Write boundary: `src/components/admin/AdminShell.tsx`, `src/app/admin/pages/page.tsx`, `src/app/admin/pages/authors/page.tsx`, `src/app/admin/pages/redirects/page.tsx`.
- Preserved behavior: form field names, redirect status values, page-list URL state, author creation action, redirect creation action, and role values.

## Changes

- Humanized admin role display from `super_admin` to `Super admin`.
- Changed page list column/filter language from governance to workflow.
- Changed author field label from `Avatar asset ID` to `Avatar media ID` with advanced helper text.
- Changed Redirect Manager to `Redirects` and rewrote the description.
- Changed redirect status option labels to plain language with HTTP codes as secondary detail.
- Changed `Page ID` to `Related page ID` with advanced helper text.

## RED

- Fresh Browser evidence showed raw labels including `super_admin`, `Governance`, `Avatar asset ID`, `Page ID`, `301 permanent`, and `Redirect Manager`.

## GREEN

- Applied label/help-text changes without touching payload names or action/service code.

## REFACTOR

- Adjusted role formatting to sentence-case `Super admin` rather than title-case `Super Admin`.

## Verification

- `npm run test -- src/app/admin/pages/page.test.ts src/app/admin/pages/authors/page.test.ts` - passed 2 tests.
- `npm run typecheck -- --pretty false` - passed.
- `npx eslint src/components/admin/AdminShell.tsx src/app/admin/pages/page.tsx src/app/admin/pages/authors/page.tsx src/app/admin/pages/redirects/page.tsx` - passed.
- Browser proof:
  - `/admin/pages`: `super_admin` absent, `Super admin access` present, `WORKFLOW` present.
  - `/admin/pages/authors`: `Avatar asset ID` absent, `Avatar media ID` present.
  - `/admin/pages/redirects`: `Redirect Manager`, `Page ID`, and `301 permanent` absent; `Redirects`, `Related page ID`, and `Permanent move (301)` present.
  - Screenshots:
    - `/tmp/page-builder-ux-hardening-s6/pages-list.png`
    - `/tmp/page-builder-ux-hardening-s6/authors.png`
    - `/tmp/page-builder-ux-hardening-s6/redirects.png`

## Residual Risk

- The black `N` bubble visible in local screenshots is the Next.js dev indicator, not an app-rendered avatar. It is recorded in `decisions.md` as dev-only and not patched.
