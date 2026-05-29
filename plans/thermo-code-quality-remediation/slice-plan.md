# Thermo Code Quality Remediation Thin Slice Plan

Status: COMPLETE
Last updated: 2026-05-29
Owner: Codex

## Working Brief

- Feature or fix: Remediate the confirmed thermo-nuclear maintainability findings across the SEO Page Builder, admin CMS routes, media upload flows, and page service orchestration without changing product behavior.
- Primary actors: Admin content editors, admin publishers, future maintainers, test/build reviewers, and public visitors indirectly affected by builder output.
- Core invariant: The builder must preserve current public rendering, draft save/autosave/preview/publish behavior, media governance, source-bound AI behavior, lead attribution, and admin auth while reducing duplicated branching and oversized modules.
- Previous intended behaviours: Shared public/editor renderer parity, admin save/reload persistence, published-page draft isolation, media picker/library uploads, preview link creation, SEO readiness gates, block-preview parity, sitemap/public resource rendering, and admin auth must keep working.
- Unsafe outcomes: Silent page content changes, published metadata mutation during draft save, broken preview/publish flows, lost media metadata, weakened media rights/alt requirements, layout/control regressions in admin UI, and broad refactors without characterization tests.
- Current evidence:
  - Current branch: `codex/seo-builder-teardown-remediation`.
  - Dirty state at planning time is untracked browser/audit artifacts only.
  - `src/components/admin/SeoPageEditorForm.tsx` is 7,770 lines and contains editor state, preview orchestration, block editor UI, AI review UI, settings, media application, and helper logic.
  - `src/components/sections/ResourcePageContent.tsx` is 1,104 lines and branches over every block type/variant in one renderer.
  - Block behavior is scattered across `blocks.ts`, `block-options.ts`, `block-preview-cases.ts`, `block-field-visibility.ts`, `seo-readiness.ts`, `ResourcePageContent.tsx`, and `SeoPageEditorForm.tsx`.
  - Page service multi-write flows exist in `src/lib/services/seo-pages.ts` around publish, archive, refresh, and rollback.
  - Save/preview server actions duplicate create/update/published-draft branching in `src/app/admin/pages/actions.ts`.
  - Media upload flow is duplicated between `src/lib/media/editor-upload.ts`, `MediaPickerProvider.tsx`, and `MediaLibraryManager.tsx`.
  - Current verification before planning passed: `npm run lint`, `npm run typecheck`, `npm run test -- --coverage`, `npm run build`, `npm run format:check`.
  - React Doctor full scan reports 82 warnings, including giant components, state/effects concentration, sequential independent awaits, and media upload/accessibility issues.
- Assumptions:
  - Refactors should be behavior-preserving unless a slice explicitly says otherwise.
  - UI layout changes require fresh browser screenshots per `docs/design/visual-review-checklist.md`.
  - Transaction/RPC changes must be separated from broad refactors.
  - Generated database types and package locks are out of scope unless a slice explicitly requires them.
- Out of scope:
  - New block types, new visual design, new AI behavior, live deployment, migrations not required by a selected slice, and broad public content/copy changes.

## Risk Classification

- Overall tier: T2 with T3 extraction slices and T1/T2 service-state slices.
- Why: Most work is admin workflow and shared renderer maintainability; atomic publish/archive changes touch state transitions and database-backed redirects.
- Live-data risk: Medium for publish/archive service slices; low for pure extraction slices.
- Migration risk: None for S1-S6. Possible non-destructive RPC migration for S7 if atomic service writes are implemented at the database boundary.
- External-contract risk: Low. No third-party API changes are planned. Next.js docs should be read only if route/server-action conventions change.

## Dependency Graph

| Node                                                | Depends on       | Parallel?            | Shared-state risk | Notes                                                                            |
| --------------------------------------------------- | ---------------- | -------------------- | ----------------- | -------------------------------------------------------------------------------- |
| S1 Media upload helper consolidation                | None             | No                   | Medium            | First low-risk code slice; touches shared admin media components.                |
| S2 Page editor draft persistence command            | None             | No                   | Medium            | Consolidates duplicated server action branching before larger editor work.       |
| S3 Page service atomicity plan and characterization | S2 preferred     | No                   | High              | Characterize current multi-write behavior before RPC/transaction edits.          |
| S4 Atomic publish/archive/rollback writes           | S3               | No                   | High              | May require migration/RPC and must be single-threaded.                           |
| S5 Public resource renderer decomposition           | None             | Yes, after S1 starts | Medium            | Split renderer by block type while preserving parity.                            |
| S6 Canonical block descriptor pilot                 | S5               | No                   | High              | Introduce one descriptor path after renderer is split enough to avoid churn.     |
| S7 Admin list-state extraction                      | None             | Yes                  | Low               | Pages/media/news route filtering and href helpers can be extracted separately.   |
| S8 SeoPageEditorForm helper extraction              | S2, S5 preferred | No                   | Medium            | Move pure helpers and block summary/completion logic out of the client monolith. |
| S9 SeoPageEditorForm state reducer split            | S8               | No                   | Medium            | Introduce reducer/provider only after helpers are outside the component.         |
| S10 Final thermo review and closeout                | S1-S9            | No                   | Low               | Rerun strict review and gates after all required slices are done.                |

## Audit Triage

Source artifact: thermo-nuclear code-quality review in current thread plus current source inspection.
Audit date: 2026-05-29
Findings reviewed: 6

| Finding                                                                                         | Verified against current code?                                                                                | Disposition     | Reason                                                                |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------- |
| F1 `SeoPageEditorForm.tsx` is a 7,770-line multi-concern client component                       | yes - `wc -l` and function map                                                                                | sliced as S8/S9 | Too broad for one slice; needs staged extraction and state split.     |
| F2 Block registry is not the canonical behavior surface                                         | yes - repeated `block.type`/`variant` branches across renderer, readiness, preview, visibility, editor        | sliced as S5/S6 | Requires decomposition before descriptor unification.                 |
| F3 SEO page service multi-write flows are non-atomic                                            | yes - revision/redirect writes precede page updates in `seo-pages.ts`                                         | sliced as S3/S4 | State-transition risk; characterize before implementation.            |
| F4 Save/preview server actions duplicate draft persistence branching                            | yes - `saveSeoPage` and `saveSeoPageDraftAndCreatePreviewLink` repeat create/update/published logic           | sliced as S2    | Code-only consolidation with focused action tests.                    |
| F5 Admin list routes mix fetching, filtering, sorting, pagination, href building, and rendering | yes - pages/media/news route files contain repeated local helpers                                             | sliced as S7    | Lower-risk extraction; split by route family if needed.               |
| F6 Media upload logic is duplicated and bypasses canonical helper                               | yes - `editor-upload.ts`, `MediaPickerProvider.tsx`, and `MediaLibraryManager.tsx` repeat signed upload steps | sliced as S1    | Best first slice: narrow, behavior-preserving, clear canonical layer. |

## Progress

| Slice | Status | Tier  | Owner        | Evidence                                                                                                             | Next gate                                   |
| ----- | ------ | ----- | ------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| S1    | done   | T3    | Codex/manual | helper consolidation complete; tests/type/lint/format/duplicate scan passed                                          | start S2 draft persistence characterization |
| S2    | done   | T2    | Codex/manual | draft persistence helper extracted; action characterization tests/type/lint/format passed                            | start S3 service state characterization     |
| S3    | done   | T2    | Codex/manual | publish/archive partial gaps plus refresh/rollback write groups characterized; service tests/type/lint/format passed | decide S4 RPC/transaction shape             |
| S4    | done   | T1/T2 | Codex/manual | atomic Supabase RPCs added; service tests/type/lint/format/build/migration lint passed; sitemap smoke 200            | start S5 renderer split                     |
| S5    | done   | T3    | Codex/manual | renderer split to 690-line shell plus focused hero/rich-text components; parity/type/lint/format/browser checks pass | start S6 descriptor pilot                   |
| S6    | done   | T2    | Codex/manual | CTA descriptor owns picker/default/visibility/editor/preview/parity paths; tests/type/lint/format/parity passed      | start S7 list-state extraction              |
| S7    | done   | T3    | Codex/manual | list-state helpers extracted for pages/media/news; tests/type/lint/format/browser smoke passed                       | start S8 editor helper extraction           |
| S8    | done   | T3    | Codex/manual | pure editor helpers extracted and tested; type/lint/format/browser smoke passed                                      | start S9 reducer/provider split             |
| S9    | done   | T2    | Codex/manual | page-content reducer extracted and tested; type/lint/format/build/browser checks passed                              | start S10 final review                      |
| S10   | done   | T3    | Codex/manual | final thermo review rerun; lint/type/coverage/build/format/react-doctor/browser gates recorded                       | complete                                    |

Allowed statuses: `pending`, `in_progress`, `blocked`, `done`, `skipped`.

## Slices

### S1 - Consolidate Image Upload Plumbing

Status: done
Tier: T3
Type: frontend
Actor/trigger: Admin uploads an image from the media picker, bulk media modal, or add-media modal.
Action: Reuse one canonical client-side signed image upload helper and metadata-default helper instead of duplicating Supabase signed upload orchestration in multiple components.
Invariant protected: Image uploads still create the same storage objects and media asset metadata, accepted file types remain unchanged, and media rights/alt/title defaults remain unchanged.
Intentional behaviour changes: None. This is a maintainability-only refactor.
Previous intended behaviours preserved: Quick editor upload saves directly to the media library; picker modal manual upload still saves after the form; bulk upload still queues up to 20 files and creates ready items; add-media modal still uploads first, then submits metadata.
Unsafe outcomes: Lost storage bucket/path hidden values, changed accepted MIME/extensions, lost title/alt defaults, automatic creation when the user expected manual save, or UI layout changes without browser proof.
Dependencies: None.
Expected files:

- `src/lib/media/editor-upload.ts`
- `src/lib/media/editor-upload.test.ts`
- `src/components/admin/MediaPickerProvider.tsx`
- `src/components/admin/MediaLibraryManager.tsx`

Write boundaries:

- Exact files listed above only.

Tests required:

- Extend `editor-upload.test.ts` to cover the new lower-level storage helper with mocked signer/client.
- Run media/upload tests and full type/lint after changes.

Runtime verification:

- Browser verification required only if visible upload UI/layout changes. If the refactor changes no markup, code/tests are sufficient for this slice.

Migration/backfill notes: None.
External docs needed: None.

Acceptance criteria:

- Signed image upload orchestration lives in one reusable helper.
- `MediaPickerProvider.tsx` and `MediaLibraryManager.tsx` no longer hand-roll the same `createSignedMediaUpload` + `createClient().storage.uploadToSignedUrl` sequence.
- Quick upload behavior still uses `uploadImageFileToMediaLibrary`.
- Focused tests cover accepted/rejected file behavior and storage upload success/failure.

Exit evidence:

- `npm test -- src/lib/media/editor-upload.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `rg -n "createSignedMediaUpload|uploadToSignedUrl|createClient\(|storage\.from" src/components/admin/MediaPickerProvider.tsx src/components/admin/MediaLibraryManager.tsx src/lib/media/editor-upload.ts`
- Result: duplicate signed upload orchestration remains only in `src/lib/media/editor-upload.ts`; components now call `uploadImageFileToStorage`.

Parallelization: single-threaded because both admin media components touch the same helper.
Blocked on: none.

#### AgentTaskContract

Eligible: no - implementing manually because this is the active first slice and touches shared admin media components.
Current adapter: stronger-model/manual
Model route: gpt-5.5/manual
Model/effort: gpt-5.5 / high
Model routing reason: Shared UI utility refactor with hidden form values and upload side effects.
Candidate strategy: not-cheap-agent
Read scope:

- `src/lib/media/editor-upload.ts`
- `src/lib/media/editor-upload.test.ts`
- `src/components/admin/MediaPickerProvider.tsx`
- `src/components/admin/MediaLibraryManager.tsx`
- `src/app/admin/media/actions.ts`

Allowed writes:

- `src/lib/media/editor-upload.ts`
- `src/lib/media/editor-upload.test.ts`
- `src/components/admin/MediaPickerProvider.tsx`
- `src/components/admin/MediaLibraryManager.tsx`

Must not touch:

- `package.json`, lockfiles, migrations, generated database types, unrelated admin UI, block renderer files.

Agent Task Module readiness gate:

- Semantic delta count: 1.
- Runtime contract table:

  | Input/state                   | Expected output/effect                                   | Must preserve? | Verification              |
  | ----------------------------- | -------------------------------------------------------- | -------------- | ------------------------- |
  | Accepted image file in helper | signed upload called with same filename and content type | yes            | unit test                 |
  | Rejected file                 | helper rejects before signing/uploading                  | yes            | unit test                 |
  | Upload storage error          | helper throws and callers show existing failure message  | yes            | unit test plus typecheck  |
  | Manual add-media upload       | hidden bucket/path values still reflect uploaded file    | yes            | code inspection/typecheck |

- Edge-case matrix:

  | Dimension             | Required cases                            | Included in validator? |
  | --------------------- | ----------------------------------------- | ---------------------- |
  | File type             | avif, webp, png, jpeg, rejected non-image | yes                    |
  | File MIME fallback    | empty type falls back to image/jpeg       | yes                    |
  | Storage upload result | success and error                         | yes                    |
  | Metadata defaults     | filename with separators and empty base   | yes                    |

- Previous-behavior preservation:
  - Existing quick upload helper still returns `createMediaAssetFromEditor` result.
  - Bulk upload still marks each item ready/error independently.
  - Add-media modal still requires explicit form save after upload.
- Parent hidden/strong validator:
  - Check callsites no longer duplicate signed upload plumbing.
  - Run focused tests, typecheck, lint.

Agent task prompt:

```text
Consolidate the duplicated admin image upload plumbing into the canonical media upload helper without changing UI behavior. Only edit the S1 allowed files. Add tests for the lower-level helper and update MediaPickerProvider/MediaLibraryManager to reuse it. Stop if preserving existing add-media manual-save semantics requires changes outside allowed files.
```

Acceptance commands:

- `npm test -- src/lib/media/editor-upload.test.ts`
- `npm run typecheck`

Parent verification:

- `npm run lint`
- `npm run format:check`
- source inspection for duplicated signed upload sequence

Failure policy:

- If required writes exceed the allowed files, stop and report BLOCKED. Do not expand scope.

### S2 - Consolidate Page Editor Draft Persistence

Status: done
Tier: T2
Type: backend
Actor/trigger: Admin saves, publishes, autosaves, or opens preview from the SEO Page Builder.
Action: Extract a single server-side draft persistence command used by save, autosave where applicable, and save-and-preview actions.
Invariant protected: Published pages keep draft changes isolated until publish; unpublished pages continue updating canonical page fields; preview links save the latest draft before opening.
Intentional behaviour changes: None.
Previous intended behaviours preserved: New pages redirect after initial save, published drafts store `draft_settings`, publish applies draft settings, preview creation works for new and existing pages.
Unsafe outcomes: Published page public metadata changes during draft save, preview opens stale content, new-page redirect breaks, or save/publish messages regress.
Dependencies: None.
Expected files:

- `src/app/admin/pages/actions.ts`
- `src/app/admin/pages/actions.test.ts`

Write boundaries:

- Exact files above only.

Tests required:

- Characterization tests for new page save, unpublished page save, published page draft save, save-and-preview for new page, save-and-preview for existing published page.

Runtime verification:

- Browser save/preview check required if server action behavior or hidden form fields change.

Migration/backfill notes: None.
External docs needed: Read local Next docs for top-level `use server` and `redirect`.

Acceptance criteria:

- Duplicate create/update/published draft branches are collapsed into one helper.
- Existing tests and new branch tests pass.

Exit evidence:

- `npm test -- src/app/admin/pages/actions.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- Source inspection: `saveSeoPage` and `saveSeoPageDraftAndCreatePreviewLink` now call `persistPageEditorDraft`; shared metadata is built by `draftMetadataFromPageForm`.

Parallelization: single-threaded with S3/S4 because it touches page state orchestration.
Blocked on: none.

### S3 - Characterize SEO Page Service Multi-Write State

Status: done
Tier: T2
Type: backend
Actor/trigger: Admin publishes, archives, refreshes libraries, or rolls back a page.
Action: Add characterization tests that pin current multi-write ordering, failure behavior, and expected state boundaries before changing atomicity.
Invariant protected: Later atomicity changes must preserve successful behavior and explicitly improve partial-failure behavior.
Intentional behaviour changes: None.
Previous intended behaviours preserved: Publish creates revision and published snapshot, archive creates redirect when requested, rollback restores draft content/settings, refresh updates draft content.
Unsafe outcomes: Refactoring service writes without tests proving current success path and partial-failure gap.
Dependencies: S2 preferred.
Expected files:

- `src/lib/services/seo-pages.test.ts`
- Possibly test helper-only edits inside the same file.

Write boundaries:

- `src/lib/services/seo-pages.test.ts`

Tests required:

- Current success-path tests plus at least one failing/marked TODO or explicit characterization for partial failure if the current mock harness can express it.

Runtime verification: None; service tests are sufficient.
Migration/backfill notes: None.
External docs needed: None.

Acceptance criteria:

- Tests clearly document which writes belong together for publish/archive/rollback/refresh.
- Plan can safely choose RPC/transaction implementation in S4.

Exit evidence:

- `npm test -- src/lib/services/seo-pages.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- Result: service tests now cover 22 cases, including publish/update partial failure, archive redirect/update partial failure, refresh manual-save revision plus draft update, and rollback revision plus draft restore.

Parallelization: no, because S4 depends on this.
Blocked on: none.

### S4 - Make SEO Page Multi-Write Commands Atomic

Status: done
Tier: T1/T2
Type: backend
Actor/trigger: Admin publishes, archives, refreshes libraries, or rolls back a page.
Action: Move related multi-write state transitions into atomic database-backed commands or an equivalently atomic service boundary.
Invariant protected: A page cannot be left with a revision/redirect that claims a state change which the page row failed to apply.
Intentional behaviour changes: Partial failures become all-or-nothing where currently possible.
Previous intended behaviours preserved: Successful publish/archive/refresh/rollback outputs and revalidation behavior.
Unsafe outcomes: Destructive migration, broken public resource routes, duplicate redirects, lost revision snapshots, or weakened publish validation.
Dependencies: S3.
Expected files:

- `src/lib/services/seo-pages.ts`
- `src/lib/services/seo-pages.test.ts`
- Supabase migration only if an RPC is required.

Write boundaries:

- `src/lib/services/seo-pages.ts`
- `src/lib/services/seo-pages.test.ts`
- `src/types/database.ts`
- `supabase/migrations/20260529090000_seo_page_atomic_state_transitions.sql`

Tests required:

- Service tests proving all-or-nothing behavior where the mock can express it.
- Migration lint if migration is added.

Runtime verification:

- Production-build route smoke for published resource and sitemap after service changes.

Migration/backfill notes: Added non-destructive RPC migration; no backfill.
External docs needed: Followed existing Supabase `security definer` RPC pattern in local migrations.

Acceptance criteria:

- Related writes are atomic or explicitly proven impossible to split in current architecture.

Exit evidence:

- `npm test -- src/lib/services/seo-pages.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run build`
- `supabase db lint --local`
- Runtime smoke: built server on `localhost:3012`; `/sitemap.xml` returned `200`; `/resources/start-vending` returned `404` because the connected Supabase schema cache lacks `published_seo_pages`, so no local published resource slug was available to smoke.
- Result: publish, archive redirect, refresh, and rollback now call atomic RPCs after TypeScript validation; tests assert no separate revision/redirect plus page writes occur in service code.

Parallelization: single-threaded, high shared-state risk.
Blocked on: none.

### S5 - Split Public Resource Block Renderer By Block Type

Status: done
Tier: T3
Type: frontend
Actor/trigger: Public/resource page render and editor block preview render.
Action: Extract block-specific render components from `ResourcePageContent.tsx` without changing markup or classes.
Invariant protected: Public/editor renderer parity and block-preview parity stay intact.
Intentional behaviour changes: None.
Previous intended behaviours preserved: All block variants render the same user-visible content, editor fallback behavior remains, lead form preview remains disabled in previews.
Unsafe outcomes: Markup/class drift without browser evidence, broken preview parity, public route regressions.
Dependencies: None.
Expected files:

- `src/components/sections/ResourcePageContent.tsx`
- New files under `src/components/sections/resource-blocks/`
- `src/components/sections/ResourcePageRenderer.test.tsx` or relevant tests if needed.
  Write boundaries:

- `src/components/sections/ResourcePageContent.tsx`
- `src/components/sections/resource-blocks/HeroBlock.tsx`
- `src/components/sections/resource-blocks/RichTextBlock.tsx`
- `src/components/sections/resource-blocks/shared.tsx`

Tests required:

- Existing renderer tests.
- Block-preview parity script.

Runtime verification:

- Browser route `/admin/pages/block-preview-audit` and public resource smoke if markup changes.

Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria:

- `ResourcePageContent.tsx` drops below 1,000 lines.
- Block-type render logic lives in focused components.
- Parity remains passing.

Exit evidence:

- `wc -l src/components/sections/ResourcePageContent.tsx`: 690 lines.
- `npm test -- src/components/sections/ResourcePageRenderer.test.ts src/lib/page-builder/block-preview-cases.test.ts` passed.
- `SMOKE_BASE_URL=http://localhost:3013 node scripts/block-preview-parity-audit.mjs` passed with 30/30 variants.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` passed.
- Browser screenshot captured at `/tmp/vending-s5-block-preview-audit-desktop.png`.

Parallelization: can run separately from S2/S3/S7 after S1 if write files are disjoint.
Blocked on: none.

### S6 - Pilot Canonical Block Descriptor

Status: done
Tier: T2
Type: frontend/backend
Actor/trigger: Maintainer adds or changes block behavior.
Action: Introduce a typed descriptor for one or two low-risk block types that co-locates picker metadata, defaults, visibility defaults, preview case data, text extraction, and render/edit references.
Invariant protected: Block behavior remains source-controlled by approved schemas and presets, not duplicated ad hoc branches.
Intentional behaviour changes: None.
Previous intended behaviours preserved: Existing block schemas, renderer output, editor controls, readiness findings, and AI validation.
Unsafe outcomes: Half-migrated registry that increases indirection without deleting branches.
Dependencies: S5.
Expected files:

- `src/lib/page-builder/*`
- Selected renderer/editor files.
  Write boundaries:

- `src/lib/page-builder/block-descriptors.ts`
- `src/lib/page-builder/block-descriptors.test.ts`
- `src/lib/page-builder/block-options.ts`
- `src/lib/page-builder/blocks.ts`
- `src/lib/page-builder/content-ops.ts`
- `src/lib/page-builder/block-preview-cases.ts`
- `src/lib/page-builder/block-field-visibility.ts`
- `src/lib/page-builder/block-editor-placeholders.ts`
  Tests required:

- Registry/descriptor tests proving descriptor output matches previous data.

Runtime verification:

- Block-preview parity for descriptor-migrated blocks.

Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria:

- At least one repeated branch family is removed, not just wrapped.
- Descriptor path is obviously extensible before migrating all blocks.

Exit evidence:

- Added `src/lib/page-builder/block-descriptors.ts` and CTA descriptor tests.
- CTA picker metadata, block registry defaults, content creation, field visibility defaults, editor placeholder reference, preview block creation, and parity markers now route through the descriptor.
- `npm test -- src/lib/page-builder/block-descriptors.test.ts src/lib/page-builder/block-preview-cases.test.ts src/lib/page-builder/block-field-visibility.test.ts src/lib/page-builder/block-editor-placeholders.test.ts src/lib/page-builder/blocks.test.ts src/lib/page-builder/content-ops.test.ts` passed.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` passed.
- `SMOKE_BASE_URL=http://localhost:3013 node scripts/block-preview-parity-audit.mjs` passed with 30/30 variants.

Parallelization: no; shared block contract.
Blocked on: S5.

### S7 - Extract Admin List State Helpers

Status: done
Tier: T3
Type: frontend/backend
Actor/trigger: Admin opens pages, media, or news list routes with filters/search/sort/page params.
Action: Move query normalization, filtering, sorting, pagination, and href builders out of route render files into focused helper modules with tests.
Invariant protected: Admin list URLs, filters, result counts, and visible rows stay the same.
Intentional behaviour changes: None.
Previous intended behaviours preserved: Pages/media/news list filters and pagination keep current labels and href behavior.
Unsafe outcomes: URL param drift, changed default filters, changed page-size behavior, or route files still holding duplicated list logic.
Dependencies: None.
Expected files:

- `src/app/admin/pages/page.tsx`
- `src/app/admin/media/page.tsx`
- `src/app/admin/news/page.tsx`
- New helper/test files under `src/lib/admin/`
  Write boundaries:

- `src/app/admin/pages/page.tsx`
- `src/app/admin/media/page.tsx`
- `src/app/admin/news/page.tsx`
- `src/lib/admin/list-state.ts`
- `src/lib/admin/seo-pages-list.ts`
- `src/lib/admin/media-list.ts`
- `src/lib/admin/news-list.ts`
- `src/lib/admin/list-state.test.ts`

Tests required:

- Helper tests for normalization, sorting, pagination, hrefs.

Runtime verification:

- Browser screenshots only if rendered markup changes.

Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria:

- Route files become mostly data loading plus render composition.
- Shared list-state behavior is testable outside route components.

Exit evidence:

- Added shared list-state utility and route-specific pages/media/news list helpers.
- Extracted URL normalization, filtering, sorting, pagination, hrefs, counts, and media chips from the three admin route files.
- `npm test -- src/lib/admin/list-state.test.ts` passed.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` passed.
- Browser smoke passed for `/admin/pages`, `/admin/media`, and `/admin/news` on `localhost:3013`.

Parallelization: yes if split by route family with disjoint helper files.
Blocked on: none.

### S8 - Extract Pure SeoPageEditorForm Helpers

Status: done
Tier: T3
Type: frontend
Actor/trigger: Maintainer works on editor helper logic.
Action: Move pure parsing, label, summary, completion, and block update helpers out of `SeoPageEditorForm.tsx` into focused modules with tests.
Invariant protected: Editor UI behavior and persisted page content stay unchanged.
Intentional behaviour changes: None.
Previous intended behaviours preserved: Initial content parsing, draft settings parsing, block summaries, completion messages, slug formatting, media label behavior, and content update helpers.
Unsafe outcomes: Helper extraction that changes fallback defaults, block completion messages, or draft settings parsing.
Dependencies: S2 and S5 preferred.
Expected files:

- `src/components/admin/SeoPageEditorForm.tsx`
- New helper files under `src/components/admin/seo-page-editor/` or `src/lib/page-builder/`
- Tests for extracted helpers.
  Write boundaries:
- To be narrowed before execution.
  Tests required:
- New helper tests plus existing page-builder tests.
  Runtime verification:
- Browser not required if no JSX/layout changes; required if extracted helpers alter rendered text.
  Migration/backfill notes: None.
  External docs needed: None.
  Acceptance criteria:
- `SeoPageEditorForm.tsx` shrinks materially without changing JSX behavior.
- Extracted helpers have focused tests.
- `npm test -- src/lib/page-builder/editor-helpers.test.ts` passed.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` passed.
- Browser smoke passed for `/admin/pages/new` on `localhost:3013` with no console errors; screenshot captured at `/tmp/vending-s8-admin-pages-new-desktop.png`.
  Parallelization: no; touches the main editor file.
  Blocked on: none.

### S9 - Split SeoPageEditorForm State Model

Status: done
Tier: T2
Type: frontend
Actor/trigger: Admin edits page content, SEO settings, preview state, AI proposal state, and responsive sidebars.
Action: Replace scattered related `useState` groups with reducer/provider boundaries and focused subcomponents.
Invariant protected: Editing one concern must not reset or accidentally mutate another editor concern.
Intentional behaviour changes: None.
Previous intended behaviours preserved: Autosave, manual save, preview, AI proposal insertion, sidebar toggles, selected block/settings behavior.
Unsafe outcomes: Lost editor state, autosave loops, stale preview content, mobile/desktop panel regressions.
Dependencies: S8.
Expected files:

- `src/components/admin/SeoPageEditorForm.tsx`
- New editor state modules/components.
  Write boundaries:
- To be narrowed after S8.
  Tests required:
- Focused reducer tests.
- Existing editor/action tests.
  Runtime verification:
- Real admin editor desktop and mobile browser checks with save/reload if visible workflow changes.
  Migration/backfill notes: None.
  External docs needed: None.
  Acceptance criteria:
- Main editor component no longer owns all unrelated state directly.
- Reducer actions are typed and covered.
- No visible workflow regression.
- `src/lib/page-builder/editor-state.ts` owns typed page-content reducer actions for content replacement, chrome settings, block/section/column add/move/duplicate/remove, and suggested block insertion.
- `SeoPageEditorForm.tsx` dispatches reducer actions instead of owning nested `setContent` mutation branches inline.
- `npm test -- src/lib/page-builder/editor-state.test.ts src/lib/page-builder/editor-helpers.test.ts` passed.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` passed.
- Browser workflow smoke passed for `/admin/pages/new` desktop and mobile after choosing "From scratch"; screenshots captured at `/tmp/vending-s9-editor-desktop.png` and `/tmp/vending-s9-editor-mobile.png`.
  Parallelization: no; central editor state.
  Blocked on: S8.

### S10 - Final Thermo-Nuclear Review

Status: done
Tier: T3
Type: verification
Actor/trigger: All required remediation slices are done or explicitly skipped.
Action: Rerun the strict thermo-nuclear code-quality review against the current branch and verify that the plan's structural goals were met.
Invariant protected: Completion is proven by current evidence, not by intent.
Intentional behaviour changes: None.
Previous intended behaviours preserved: All automated and runtime gates required by completed slices.
Unsafe outcomes: Marking the goal complete while major structural blockers remain.
Dependencies: S1-S9.
Expected files: none unless review finds required plan updates.
Write boundaries: none by default.
Tests required:

- `npm run lint`
- `npm run typecheck`
- `npm run test -- --coverage`
- `npm run build`
- `npm run format:check`
- React Doctor full scan.
  Runtime verification:
- Any UI route affected by completed slices must have current browser evidence.
  Migration/backfill notes: None.
  External docs needed: None.
  Acceptance criteria:
- No remaining high-conviction thermo findings from the original review remain unaddressed without an explicit skipped/blocker record.
- Plan status can move to COMPLETE only after evidence is recorded.
- Final thermo review summary: original duplicated upload, draft-persistence, non-atomic page service, public renderer, block descriptor, admin-list, editor-helper, and editor-content-state findings were addressed by S1-S9.
- Residual review note: `SeoPageEditorForm.tsx` is still a large legacy editor surface at 7,097 lines, but planned S8/S9 extracted pure helpers and the page-content reducer without changing behavior. React Doctor still reports broader giant-component debt as follow-up work rather than a regression from this plan.
- `npm run lint`, `npm run typecheck`, `npm run test -- --coverage`, `npm run build`, and `npm run format:check` passed.
- React Doctor full scan passed with score 82/100 and 91 warnings; diff scan against `origin/main` passed with score 91/100 and 32 warnings.
- Browser evidence captured during completed slices: block-preview parity route, admin list routes, and `/admin/pages/new` desktop/mobile editor workflow.
  Parallelization: no.
  Blocked on: S1-S9.

## Verification Gates

- Automated checks:
  - Focused tests per slice.
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test -- --coverage` for broader closeout.
  - `npm run build` for any admin/editor/route/service change.
  - `npm run format:check`.
- Runtime checks:
  - Browser checks for any visible admin/editor layout or workflow change.
  - `/admin/pages/block-preview-audit` parity for renderer/block descriptor changes.
  - Public resource route smoke for renderer/service publish changes.
- Migration checks:
  - `supabase db lint --local` if any migration/RPC is added.
- Security/auth checks:
  - Admin routes must continue requiring admin auth outside local dev bypass.
  - Published draft isolation must remain covered for page action/service slices.
- Observability/audit checks:
  - No new repo-root temp artifacts should be created by verification scripts.

## Subagent Plan

No external subagents are required for the first slice. Future parallel-safe work may split S5 and S7 only after S1/S2 file ownership is clear.

## Update Rules

- Move only one slice to `in_progress` per worker unless the plan explicitly allows parallel work.
- Mark `done` only after exit evidence is recorded.
- Mark `blocked` with the exact missing decision, dependency, or failing check.
- Add newly discovered work as a new slice or follow-up; do not silently expand an active slice.
- Keep rejected or skipped work visible with the reason.
