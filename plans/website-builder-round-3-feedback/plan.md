# Feature Plan: website-builder-round-3-feedback

Status: IN_PROGRESS
Last updated: 2026-06-11
Owner: feature-orchestrator

## Working Brief

- Feature: Close all seven Round 3 tester feedback items on the SEO page builder
  (triage IDs I1-I7, source: /issue-fix-strategy 2026-06-11 backed by
  `docs/seo-page-builder/website-builder-feedback-review.md` Round 3 Triage, R3-1..R3-7).
- Primary actors: admin content editors using `/admin/pages` builder; public visitors
  reading published pages; super-admins managing settings.
- Core invariant: published page output for existing pages must not change except
  where a fix is the explicit intent (list bullets appearing is intentional).
- Previous intended behaviors: checklist variant renders `list-none`; existing
  full-paragraph span links keep rendering; legacy meta descriptions 156-180 chars
  still save (warn-only); outline select/edit/add-below behavior from Round 2 S3;
  proof blocks without imagery render unchanged; all five existing route prefixes
  resolve identically with same metadata/canonical/sitemap; slug-change 301
  redirects; route-path uniqueness with archived-path retention.
- Intentional behavior changes: bullets/numbers now visible on published lists;
  authors can link a substring; meta limits align at 155 with editor counter;
  outline rows gain up/down; proof points can carry imagery; route prefixes become
  a curated settings-managed list; importer shows a truncation warning.
- Unsafe outcomes: breaking published page rendering; corrupting rich-text span
  data on link edit; blocking saves of legacy pages; route prefix change breaking
  existing public URLs/sitemap/redirects; migration data loss; non-super-admin
  access to route settings.
- Evidence: file:line audit in review doc Round 3 Triage (verified 2026-06-11 by
  seven read-only agents).
- Assumptions: I6 uses curated super-admin-managed prefix list (see decisions.md).
- Out of scope: GTM/attribution build-out, in-platform doc editor, section
  comments, review-trigger reporting, importer bold/italic support, drag-reorder.

## Risk Classification

- Overall tier: T2 (one migration + route restructuring; most nodes T3 UI).
- Live-data risk: none (local-only; no push/PR/preview per AGENTS.md release train).
- Migration risk: S6b relaxes SQL CHECK constraints — must be non-destructive and
  keep all existing route paths valid.
- External-contract risk: none (no webhooks/payments touched).

## Dependency Graph

| Node | Title                                                  | Tier | Depends On | Parallel Group | Shared-State Risk                           | Status  |
| ---- | ------------------------------------------------------ | ---- | ---------- | -------------- | ------------------------------------------- | ------- |
| S1   | Published list bullet/number styling (I1)              | T3   | none       | W1-A           | none                                        | PENDING |
| S2   | Substring link selection in rich-text editor (I2)      | T3   | none       | W1-B           | none                                        | PENDING |
| S3   | Meta description 155 alignment + counter (I3)          | T2   | none       | W1-C           | none                                        | PENDING |
| S4   | Outline up/down reorder controls (I4)                  | T3   | none       | W1-D           | none                                        | PENDING |
| S5   | Proof point imagery end-to-end (I5)                    | T2   | none       | W2-A           | none                                        | PENDING |
| S7   | Importer truncation warning (I7)                       | T3   | none       | W2-B           | none                                        | PENDING |
| S6a  | Route prefix settings table + admin UI (I6)            | T2   | none       | W3-A           | migration (single-threaded)                 | PENDING |
| S6b  | Dynamic [prefix]/[slug] route + lookup validation (I6) | T2   | S6a        | W4-A           | migration + route folders (single-threaded) | PENDING |

Browser gates are executed serially by the orchestrator at wave integration time
(one shared dev server; workers must not start/stop servers or run browser checks).

## Nodes

### S1 - Published list bullet/number styling (I1 / R3-3)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: public visitor views a published page containing rich-text list nodes.
Behavior to test: When a rich-text list node with style "bullet" ("numbered")
renders in public mode, then the `<ul>` (`<ol>`) carries `list-disc`
(`list-decimal`) so markers are visible.
Invariant protected: checklist variant stays `list-none`; spacing/margins unchanged.
Expected files: `src/components/sections/resource-blocks/RichTextBlock.tsx` (+ test).
Write boundaries: that file plus a colocated test file only.
Acceptance criteria:

- [ ] bullet lists render with `list-disc`, numbered with `list-decimal`
- [ ] checklist variant unchanged (`ml-0 list-none space-y-3`)
      Regression guards: render test covering all three variants.
      Gates: repo gate (vitest + tsc); browser gate (orchestrator, published/preview list).
      Exit evidence: failing-then-passing test output, file diff.

### S2 - Substring link selection (I2 / R3-1)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin editor adds a manual link to a paragraph node.
Behavior to test: When the editor supplies a URL and a link-text substring present
in the paragraph, then the paragraph is stored as before/link/after spans with the
href only on the matched span (first occurrence).
Invariant protected: schema unchanged; existing single-span full-paragraph links
still load and render; href safety validation preserved.
Expected files: `src/components/admin/seo-page-editor/RichTextBodyEditor.tsx` (+ test).
Write boundaries: that file plus test only. No changes to `blocks.ts`.
Acceptance criteria:

- [ ] link-text input next to manual link URL field
- [ ] empty link text = current whole-paragraph behavior (backward compatible)
- [ ] substring not found -> clear inline error, no data change
- [ ] start/middle/end matches produce correct span splits
      Regression guards: tests for whole-paragraph fallback and unsafe-href rejection.
      Gates: repo gate; browser gate (orchestrator).
      Exit evidence: span-split unit tests red->green, file diff.

### S3 - Meta description 155 alignment + counter (I3 / R3-4)

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: admin editor edits meta description; AI generates metadata.
Behavior to test: When meta description exceeds 155 chars, then new input is
hard-capped (form validation + editor maxLength) and readiness flags >155; legacy
stored values 156-180 still save and only warn.
Invariant protected: legacy long descriptions never block save/publish.
Expected files: shared constant (new or existing SEO standards module),
`src/app/admin/pages/actions.ts`, `src/lib/page-builder/ai-chat.ts`,
`src/lib/page-builder/ai-proposals.ts`, `src/lib/services/openai-seo-agent.ts`,
`src/lib/page-builder/seo-readiness.ts`, `src/lib/admin/seo-pages-list.ts`,
`src/components/admin/seo-page-editor/SeoPublishPanel.tsx` (+ tests).
Write boundaries: listed files + tests; only the meta-description-length concern.
Acceptance criteria:

- [ ] single shared 155 constant consumed everywhere (no scattered literals)
- [ ] editor textarea maxLength=155 with live counter
- [ ] readiness warning threshold 155
- [ ] legacy >155 value: save allowed, warning shown (validation must not reject
      unchanged legacy values — use a strategy that caps new input, e.g. schema
      max raised check only on changed values or max(180) retained server-side
      with UI cap + readiness at 155; worker decides and documents, but the
      acceptance test for "legacy save not blocked" must pass)
      Regression guards: AI proposal schema still accepts model output (prompt says 155).
      Gates: repo gate; browser gate (orchestrator: counter visible, cap enforced).
      Exit evidence: validation/readiness tests red->green, diff.

### S4 - Outline up/down reorder (I4 / R3-5)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin editor reorders blocks from the left-hand outline.
Behavior to test: When the up (down) button on an outline row is activated, then
the block moves one position via existing `moveBlock`, selection/highlight follows
it, and the button is disabled at the first (last) position.
Invariant protected: outline select/edit/add-below (Round 2 S3) unchanged.
Expected files: `src/components/admin/seo-page-editor/SeoPageEditorShell.tsx`,
`src/components/admin/seo-page-editor/BuilderBlocksPanel.tsx` (prop threading)
(+ tests).
Write boundaries: those files + tests. No reducer/controller changes
(`moveBlock` already exists at `useSeoPageEditorController.ts:1308`).
Acceptance criteria:

- [ ] up/down icon buttons on each outline row, aria-labels, keyboard accessible
- [ ] boundary disabling correct
- [ ] reorder reflected in canvas order
      Regression guards: existing outline interaction tests still pass.
      Gates: repo gate; browser gate (orchestrator, desktop + mobile width).
      Exit evidence: interaction test red->green, diff.

### S5 - Proof point imagery end-to-end (I5 / R3-6)

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: admin attaches an image to a proof item / proof block; public
visitor sees it rendered.
Behavior to test: When a proof block has a selected media asset, then editor
preview and public render show the image with alt text; without an asset, output
is byte-identical to today.
Invariant protected: existing proof blocks render unchanged; alt/rights metadata
carried through.
Expected files: `src/lib/services/page-builder-libraries.ts`,
`src/app/admin/libraries/page.tsx`, `src/lib/page-builder/blocks.ts`
(proofBlockSchema props only),
`src/components/admin/seo-page-editor/BlockSettingsFields.tsx`,
`src/components/admin/seo-page-editor/editor-media.ts`,
`src/components/sections/ResourcePageContent.tsx` (+ tests).
Write boundaries: listed files + tests; proof-block concern only.
Acceptance criteria:

- [ ] proofBlockSchema gains optional assetId/mediaSrc/mediaAltText
- [ ] `applyMediaAssetToProofBlock` helper following existing patterns
- [ ] MediaLibrarySelectButton in block settings and library proof form
- [ ] CreateProofItemInput/service persist asset_id
- [ ] quote/stat/logo variants render image when present, nothing when absent
      Regression guards: schema validation tests for legacy proof blocks (no media props).
      Gates: repo gate; browser gate (orchestrator); boundary gate (service test
      against generated types — no migration needed, column exists).
      Exit evidence: schema/service/render tests red->green, diff.

### S7 - Importer truncation warning (I7 / R3-7)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin pastes a document with more than MAX_IMPORTED_BLOCKS sections.
Behavior to test: When the parsed document yields more sections than the import
cap, then the proposal carries a "N sections dropped" warning and the
DocumentImportPanel displays it visibly before insertion.
Invariant protected: imports within the cap show no warning; mapping unchanged.
Expected files: `src/lib/page-builder/document-import.ts`,
`src/components/admin/seo-page-editor/AiBuilderAssistant.tsx` (DocumentImportPanel)
(+ existing test file `document-import.test.ts`).
Write boundaries: those files + tests.
Acceptance criteria:

- [ ] warning includes the exact dropped-section count
- [ ] no warning at or under the cap
      Regression guards: existing document-import tests pass.
      Gates: repo gate; browser gate (orchestrator).
      Exit evidence: parser test red->green, diff.

### S6a - Route prefix settings table + admin UI (I6 / R3-2, part 1)

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: super-admin manages allowed route prefixes in settings.
Behavior to test: When a super-admin adds a valid custom prefix (e.g. `/services`)
in `/admin/settings/routes`, then it persists to the new settings table and
appears in the configured list; reserved prefixes and non-super-admins are rejected.
Invariant protected: admin-only access model (`admin` vs `super_admin` per
existing auth memory); five default prefixes seeded and undeletable while in use.
Expected files: new migration (settings table + seed), new service in
`src/lib/services/`, new `src/app/admin/settings/routes/` page + actions,
`src/types/database.ts` (regenerated or hand-extended consistently) (+ tests).
Write boundaries: new files + settings nav registration; must not touch public
routes or `page-paths.ts` yet (that is S6b).
Acceptance criteria:

- [ ] migration creates table, seeds 5 existing prefixes, RLS enabled
- [ ] reserved blocklist enforced server-side (/admin,/api,/authors,/news, plus
      existing top-level app routes)
- [ ] super_admin gate on mutations (Zod-validated server actions)
- [ ] prefix shape validation: ^/[a-z0-9]+(-[a-z0-9]+)\*$
      Regression guards: settings/users page unaffected.
      Gates: repo gate; browser gate (orchestrator); boundary/migration gate
      (`supabase db reset` locally, non-destructive).
      Exit evidence: migration applied locally, service tests red->green, diff.

### S6b - Dynamic [prefix]/[slug] route + lookup validation (I6 / R3-2, part 2)

Status: PENDING
Tier: T2
Type: integration
Actor/trigger: public visitor requests a builder page under any configured prefix;
editor selects a prefix in the slug dropdown.
Behavior to test: When a page is published under a configured custom prefix, then
its public URL resolves with correct metadata/canonical/sitemap, and all five
legacy prefixes resolve byte-identically to before.
Invariant protected: existing public URLs, 301 slug-change redirects, route_path
uniqueness, archived-path retention; reserved routes never shadowed.
Expected files: consolidate `src/app/{resources,blog,landing,videos,solutions}/[slug]/`
into a dynamic handler, `src/lib/page-builder/page-paths.ts`,
`src/app/admin/pages/actions.ts` (prefix validation -> lookup), migration relaxing
SQL CHECKs to shape-only, sitemap (+ tests).
Write boundaries: listed files + tests; coordinate with S6a service.
Acceptance criteria:

- [ ] five legacy prefixes resolve identically (route tests)
- [ ] custom prefix page resolves end-to-end (editor dropdown -> publish -> public)
- [ ] dynamic route cannot shadow real app routes (static routes win in Next;
      verify against /admin,/authors,/news,/api)
- [ ] CHECK constraints relaxed via non-destructive migration; existing rows valid
      Regression guards: redirect fn tests, sitemap test, uniqueness index intact.
      Gates: repo gate; browser gate (orchestrator); boundary/migration gate
      (`supabase db reset` + route smoke).
      Exit evidence: route/migration proof, diff.
