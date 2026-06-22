# Agent Run: N4 Extract Signed Upload Helper

Status: DONE
Worker: main-thread orchestrator
Started: 2026-06-22 11:58:55 ACST
Completed: 2026-06-22 11:58:55 ACST

## Scope

- Node: N4 - Extract Signed Upload Helper
- Allowed write scope: `src/lib/supabase/**`,
  `src/app/admin/media/actions.ts`, `src/app/admin/news/actions.ts`, related
  tests
- Files changed: added `src/lib/supabase/signed-upload.ts` and
  `signed-upload.test.ts`; updated media and news actions.

## RGR Evidence

- RED: Source scan showed duplicated signed upload path sanitization and
  Supabase `createSignedUploadUrl` setup in media and news actions.
- GREEN: Extracted `createSignedImageStorageUpload` and
  `createImageStoragePath`; media/news actions now share it while preserving
  each action's auth call and return shape.
- REFACTOR: Helper marked `server-only`; tests cover sanitization, bucket/path,
  public URL, and error propagation.

## Root Cause / Investigation

- Root cause or hypothesis: Two upload actions evolved the same filename,
  bucket, signed URL, and public URL plumbing independently.
- Failed attempts: None.

## Gates

- Repo Gate:
  - Targeted tests passed: `signed-upload`, `editor-upload`,
    `NewsEditorForm`, and related touched suites: 8 files, 44 tests.
  - `npm run typecheck` passed.
  - `npm run lint` passed with four pre-existing warnings outside this change.
  - `npm run build` passed.
  - `npm test` passed: 146 files, 914 tests.
- Browser Gate: Not required; server action helper has no UI surface.
- Boundary/Migration Gate: Supabase calls are not live-smoked in this pass.
  Boundary behavior is covered with mocked storage client tests and unchanged
  auth placement.

## Behavior Preservation

- Previous intended behaviors checked:
  - `createSignedMediaUpload` still authenticates and returns `bucket`, `path`,
    `token`, `signedUrl`, `publicUrl`.
  - `createSignedImageUpload` still authenticates and returns `path`, `token`,
    `signedUrl`, `publicUrl`.
  - Media action still wraps Supabase errors in its friendly upload message;
    news action still lets the helper error bubble.
- Evidence: source review and `src/lib/supabase/signed-upload.test.ts`.
- Confidence: Medium-high because live Supabase was not called.

## Residual Risk

- A live Supabase storage smoke was skipped to avoid external side effects.

## Handoff Notes

- Any future signed image upload should use `createSignedImageStorageUpload`
  after its action-level auth check.

## Recommendation

DONE
