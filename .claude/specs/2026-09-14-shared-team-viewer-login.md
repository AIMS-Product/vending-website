# Shared team viewer login (read-only, full studio)

**Date:** 2026-09-14 · **Surface:** Tier-1 (auth) · **Repo:** vending-website

## Goal

One shared credential the team can use to look at the whole Studio. No per-person
accounts, no editing anywhere.

## Approach

The `viewer` role already exists and is already denied every write path
(`requireAdmin()` inside every Server Action). The only change needed is which
pages a viewer may _open_. No new role, no new gate, no new auth code.

## Changes

1. Page gates: `requireAdmin()` -> `requireReadAccess()` on 22 read-only admin pages.
2. `VIEWER_READABLE_PATHS` grows to match, so the nav shows what the gates allow.
3. Guard tests updated to match (`viewer-access.test.ts`, `AdminShell.test.tsx`).
4. `scripts/create-shared-viewer.mjs` seeds the shared `app_users` row + auth user.

## Deliberately still admin-only

Autosaving editors and creation pages, because opening them read-only fires write
actions on mount and would look broken:

- `pages/[id]`, `pages/new`
- `news/[id]`, `news/new`
- `case-studies/[id]`, `case-studies/new`
  Plus `settings/users` (staff roster + role changes) and `reset-password`
  (the shared account must not be able to change its own password).

## Invariants preserved

- Every Server Action still calls `requireAdmin()` / `requireSuperAdmin()`. Writes
  are denied by the same single gate as before; no call site learned its own check.
- `getAuthorizedAdmin()`, RLS, and the proxy allowlist are untouched.
- `requireAdmin()` remains the default gate for any page written from now on.

## Known trade-off

Edit buttons still render on the newly opened pages for a viewer. Clicking one is
denied server-side (no data change) but bounces to `/admin`. Hiding every control
is a 20-file diff for cosmetics; the role chip in the sidebar already reads "Viewer".

## Risk accepted by Adam (2026-09-14)

Lead PII and chatbot transcripts are readable behind a shared password. Flagged,
accepted: "full access thats fine, just no editing".
