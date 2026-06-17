# S8 Attempt 1: Page/block attachment settings

Date: 2026-06-17
Status: BLOCKED on browser gate
Worker: orchestrator

## Scope

Implemented page and lead-form block qualification attachment settings for the
SEO Page Builder. The slice stays inside page-builder schema/editor files and
does not change public lead-form submission behavior; S9 still owns the public
opt-in integration.

## RED

Command:

```bash
npm test -- src/lib/page-builder/blocks.test.ts src/lib/page-builder/resource-lead-attribution.test.ts src/components/admin/seo-page-editor/editor-form-data.test.ts
```

Expected failures:

- `pageContentSchema` rejected top-level and lead-form `qualification` objects
  as unrecognized keys.
- `resolveResourceQualificationAttachment` was missing.

Observed result: failed for the intended reasons.

## GREEN / REFACTOR

Implemented:

- Optional `qualification` attachment settings on `PageContent`.
- Optional `lead_form.props.qualification` block override settings.
- Internal-path-only validation for completion redirects.
- Shared `qualificationAttachmentSettings` and `pageQualificationSettings`
  helpers.
- `resolveResourceQualificationAttachment` with block > page > global default
  precedence.
- Editor reducer/controller wiring for page-level qualification defaults.
- Left panel page settings controls under `Qualification follow-up`.
- Lead-form block settings modal override controls under `Qualification
follow-up`.
- Component-level UI tests proving the controls render in settings surfaces, not
  as layout controls.

## Repo Evidence

Commands:

```bash
npm test -- src/lib/page-builder/blocks.test.ts src/lib/page-builder/resource-lead-attribution.test.ts src/components/admin/seo-page-editor/editor-form-data.test.ts src/lib/page-builder/editor-state.test.ts src/components/admin/seo-page-editor/qualification-settings-ui.test.tsx
npm run typecheck
npm run lint
npx react-doctor@latest --verbose --scope changed --base HEAD
```

Results:

- 5 test files passed, 43 tests passed.
- Typecheck passed.
- Lint passed with 0 errors. Existing warnings remain outside S8 and include
  prior plan scripts plus prior qualification form files.
- React Doctor on the S8 diff found no issues and scored 92/100.

Regression coverage:

- Legacy lead-form blocks without `qualification` remain valid.
- Publish readiness still treats lead forms as conversion surfaces through
  existing `blocks.test.ts` coverage.
- Editor form-data keeps qualification settings inside `draftContent` instead
  of adding stray top-level form fields.

## Browser Gate

Status: BLOCKED.

Attempted proof route:

- `http://127.0.0.1:3026/admin/pages/new`

Evidence:

- Screenshot captured at
  `plans/post-submit-qualification-builder/browser-evidence/S8-editor-desktop-initial.png`.

Observed blockers:

1. Placeholder Supabase JWTs let the dev server boot, but `/admin/pages/new`
   failed while building the internal link index with `PGRST301: Expected 3
parts in JWT; got 1`.
2. `supabase start` for this worktree could not start because standard local
   ports are already owned by an unrelated running `VendPlacement` Supabase
   stack (`54322` allocated).
3. Reusing the already-running `VendPlacement` stack with locally-derived JWTs
   reached the route, but the schema/data was incompatible and failed with
   `Could not list media assets`.
4. An isolated temporary Supabase workdir on alternate ports failed during
   migration setup under Supabase CLI `2.75.0` with
   `ERROR: cannot insert multiple commands into a prepared statement
(SQLSTATE 42601)`.

No other stack was stopped or mutated. No remote DB migration was run.

## Boundary

- No Close credentials used.
- No live Close request made.
- No push, PR, Vercel preview, or remote DB migration run.
- No live publish performed.

## Exit State

Code and repo gates are ready, but S8 is not marked done because the required
browser settings proof could not run in the current local environment.
