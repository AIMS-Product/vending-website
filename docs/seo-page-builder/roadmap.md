# SEO Page Builder Roadmap

## Working Goal

Build a backend-powered visual page builder for SEO resource pages. Admins should be able to create `/resources/[slug]` pages visually with rows, columns, reusable blocks, reusable media, approved source material, AI-assisted page structure proposals, draft previews, revision rollback, and manual publishing.

This is not a one-off content batch. The goal is the structure that lets the team create high-quality SEO/conversion pages over time.

## Current Alignment - 2026-05-06

- This roadmap is the active source of truth for the SEO Page Builder.
- `plans/cutover-readiness/slice-plan.md` is the older Webflow-copy/cutover track. Keep it for launch blockers and legacy URL evidence, but do not use it to size or sequence the builder.
- The SEO Page Builder is a pre-ship requirement. Final public launch/cutover is blocked until the builder's public surface, lead attribution, SEO routing, and publish gates pass verification.
- Codex owns implementation slice sizing and technical sequencing. The user owns product direction, approvals, and content/source decisions.
- Lead attribution must support page, keyword, block, CTA, UTM, and referrer data before any builder `lead_form` block goes public.
- Builder-managed redirects should be database-backed CMS redirects. Static `next.config.ts` redirects remain acceptable for legacy Webflow/canonical cutover rules only.
- AI must run under a strict source-bound proposal contract. A system prompt is required, but not sufficient by itself; the app must also validate source references, schema shape, and admin approval before inserting anything into a draft.

## Current Completion Status - 2026-05-07

Use this table for Asana/leadership reporting. A slice is only marked done when
the implementation, tests, browser evidence, and cleanup/verification gate are
complete enough that it can be defended as shipped.

| Done | Slice                                    | Status | Evidence / completed scope                                                                                                                                                                                                                                                                                                                                                                            | Remaining gate                                                                                                                   |
| ---- | ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [x]  | 1. Data model and block registry         | Done   | Supabase page/revision/media/redirect foundation, content schemas, publish snapshots, validation, and service tests.                                                                                                                                                                                                                                                                                  | Keep schema changes migration-backed.                                                                                            |
| [x]  | 2. Admin CRUD and basic editor           | Done   | Admin page list/create/edit, inline editing, autosave, and draft persistence.                                                                                                                                                                                                                                                                                                                         | Continue simplifying marketer-facing controls.                                                                                   |
| [x]  | 3. Publish, renderer, sitemap, redirects | Done   | Public `/resources/[slug]` rendering, publish gates, sitemap support, and database-backed redirect lookup.                                                                                                                                                                                                                                                                                            | Recheck on deployed smoke pages after major changes.                                                                             |
| [x]  | 4. Drag/drop ordering                    | Done   | Drag/drop editor island is implemented with keyboard reorder fallbacks for sections, columns, and blocks. Local browser QA used the keyboard reorder controls for blocks, columns, and sections, saved the draft, published a disposable resource page, verified the reordered public render, and cleaned the test page.                                                                              | Pointer-drag can get a final deployed smoke pass, but the saved ordering contract is verified.                                   |
| [x]  | 5. Revision UI and preview links         | Done   | Revision panel, revision snapshots, rollback path, and secret draft preview tokens.                                                                                                                                                                                                                                                                                                                   | Do not expose preview URLs to sitemap/indexing.                                                                                  |
| [x]  | 6. Media library                         | Done   | Admin `/admin/media`, upload action, media asset service, metadata fields, storage migration, and tests exist. Page editor now has a marketer-facing media picker for image blocks. Local browser E2E selected a library image, saved the draft, published a disposable resource page, verified public image URL/alt/caption metadata, and cleaned the test page/media asset.                         | Keep storage bucket/env configuration available in deployment and re-run a deployed media smoke before DNS cutover.              |
| [x]  | 7. Full core blocks and lead attribution | Done   | Hero, video, FAQ, card grid, proof, CTA, rich text, image, and lead form blocks passed local browser E2E through authenticated editor publish, public rendering, real lead submission, database attribution verification, and cleanup.                                                                                                                                                                | Re-run the same smoke after the next deployment before DNS cutover.                                                              |
| [x]  | 8. Reusable content libraries            | Done   | Tables exist for proof items, CTA presets, source documents, source excerpts, and approved claims. Publish snapshots can resolve CTA/proof references. Admin `/admin/libraries` now manages CTA presets, proof items, source documents, approved excerpts, and approved claims. Local browser E2E created each library type, verified source/claim approval surfaces, and cleaned disposable records. | Future edit/delete UX can be added after launch if marketers need in-place library maintenance.                                  |
| [x]  | 9. AI proposal workflow                  | Done   | Source-bound AI proposals, warnings for unsupported claims, proposal review, and accept-selected block insertion have been implemented and browser-tested.                                                                                                                                                                                                                                            | Future AI chat helper should use the same proposal rules.                                                                        |
| [x]  | 10. SEO hardening                        | Done   | SEO readiness scoring, missing-field checks, internal link suggestion foundation, editor warnings, redirect conflict protection, and publish-time duplicate SEO title/meta-description checks are in place. Production smoke on Vercel verified public render, preview render, redirect handling, sitemap inclusion/removal, and lead attribution.                                                    | Keep monitoring real marketer-created pages for duplicate metadata edge cases after launch.                                      |
| [x]  | Launch readiness smoke test              | Done   | Production Vercel deployment passed disposable smoke verification: created and published a resource page, created a preview token, moved the slug to create a redirect, submitted a browser lead with UTM attribution, verified database attribution, checked sitemap inclusion, verified admin auth gate, then removed lead/preview/redirect records and archived the immutable-revision test page.  | Remaining cleanup record is an archived smoke page plus immutable revision snapshot, which is expected by the append-only model. |

## Product Decisions

| Area                 | Decision                                                                         |
| -------------------- | -------------------------------------------------------------------------------- |
| Ship timing          | Build before final public site launch/cutover                                    |
| Page type            | Service/keyword resource pages first                                             |
| Primary job          | Organic SEO that converts to applications/booked calls                           |
| Creation model       | Create one page at a time in a visual builder                                    |
| Layout model         | Flexible rows and columns with approved block types                              |
| Mobile behavior      | Automatic responsive stacking                                                    |
| Editor feel          | Inline WYSIWYG editing                                                           |
| Ordering             | Drag/drop rows, columns, and blocks                                              |
| Styling              | Brand-controlled presets only                                                    |
| First block set      | Hero, rich text, image, video, CTA, FAQ, card grid, testimonial/proof, lead form |
| AI role              | Page-structure assistant that proposes blocks and metadata                       |
| AI sources           | Approved internal source material only                                           |
| Media                | Reusable media library plus per-page uploads                                     |
| Publish states       | Draft, published, archived                                                       |
| Revisions            | Full revision history and rollback UI in v1                                      |
| Saving               | Autosave draft, manual publish                                                   |
| Preview              | Secret preview links                                                             |
| Public URLs          | `/resources/[slug]`                                                              |
| Slug changes         | Published slug changes create automatic 301 redirects                            |
| SEO controls         | Core metadata plus structured data controls                                      |
| Forms/CTAs           | Reusable CTA and lead form blocks with automatic attribution                     |
| Publish gate         | Hard publish requirements                                                        |
| Media requirements   | Accessibility and rights metadata required                                       |
| Reusable content     | Selected blocks can reference library items                                      |
| Source material      | Source documents, excerpts, and approved claims                                  |
| AI insertion         | AI proposes blocks; admin approves before insertion                              |
| AI enforcement       | Source-bound proposal contract plus programmatic validation                      |
| AI SEO               | AI suggests metadata and schema; admin approves                                  |
| Internal links       | AI suggests links; admin approves                                                |
| Roles                | Existing admins can edit and publish                                             |
| Archive behavior     | Admin chooses 404 or 301 redirect                                                |
| Redirect engine      | Database-backed builder redirects                                                |
| Library item changes | Published pages use snapshots; drafts refresh intentionally                      |
| First build approach | Narrow verified slices toward an end-to-end builder                              |
| First thin slice     | Schema + structured text/image/CTA page publish/render path                      |

## Architecture Principles

- Store page content as structured data, not arbitrary HTML.
- Render public pages and editor previews through the same block registry.
- Use approved block types with brand presets rather than freeform styling.
- Treat draft and published content separately.
- Snapshot published pages so global library edits do not silently alter live pages.
- Make AI non-destructive: proposals first, insertion only after admin approval.
- Keep SEO and conversion requirements enforced at publish time.
- Reuse the existing Supabase/admin model where possible.

## Proposed Data Model

### `seo_pages`

Owns page identity and current draft state.

Recommended fields:

- `id`
- `slug`
- `title`
- `status`: `draft`, `published`, `archived`
- `target_keyword`
- `page_type`
- `template_key`
- `draft_content`
- `published_content`
- `published_revision_id`
- `seo_title`
- `meta_description`
- `canonical_url`
- `noindex`
- `sitemap_enabled`
- `og_asset_id`
- `structured_data_settings`
- `published_at`
- `archived_at`
- `archive_behavior`: `not_found`, `redirect`
- `archive_redirect_url`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

### `page_revisions`

Stores recoverable snapshots.

Recommended fields:

- `id`
- `page_id`
- `revision_type`: `autosave`, `manual_save`, `publish`, `rollback`, `ai_insert`
- `label`
- `content_snapshot`
- `seo_snapshot`
- `created_by`
- `created_at`

### `media_assets`

Reusable image/video library.

Recommended fields:

- `id`
- `asset_type`: `image`, `video`, `embed`
- `title`
- `alt_text`
- `caption`
- `source_rights_notes`
- `storage_bucket`
- `storage_path`
- `external_url`
- `thumbnail_asset_id`
- `width`
- `height`
- `duration_seconds`
- `tags`
- `uploaded_by`
- `created_at`
- `updated_at`

### `source_documents`

Approved AI/source input.

Recommended fields:

- `id`
- `title`
- `source_type`: `paste`, `file`, `url_reference`, `existing_site_content`
- `body`
- `asset_id`
- `tags`
- `created_by`
- `created_at`
- `updated_at`

### `source_excerpts`

Reusable factual excerpts from source documents.

Recommended fields:

- `id`
- `source_document_id`
- `excerpt`
- `topic_tags`
- `approved`
- `approved_by`
- `approved_at`

### `approved_claims`

Claims AI may use confidently.

Recommended fields:

- `id`
- `claim`
- `claim_type`
- `source_excerpt_id`
- `usage_notes`
- `risk_level`
- `approved_by`
- `approved_at`

### `proof_items`

Reusable testimonials and proof blocks.

Recommended fields:

- `id`
- `kind`: `testimonial`, `stat`, `case_study`, `quote`
- `name`
- `role_or_context`
- `body`
- `asset_id`
- `source_rights_notes`
- `approved`
- `created_at`
- `updated_at`

### `cta_presets`

Reusable CTA options.

Recommended fields:

- `id`
- `label`
- `href`
- `style_preset`
- `tracking_name`
- `created_at`
- `updated_at`

### `redirects`

SEO-safe URL changes and archived-page redirects.

Recommended fields:

- `id`
- `source_path`
- `destination_path`
- `status_code`
- `page_id`
- `created_reason`: `slug_changed`, `page_archived`, `manual`
- `created_by`
- `created_at`

### Lead Attribution Extensions

Existing lead submission storage should eventually capture:

- `source_page_id`
- `source_page_slug`
- `target_keyword`
- `source_block_id`
- `source_cta_tracking_name`
- UTM fields
- referrer

This is required before public `lead_form` blocks ship. Resource-page leads must
be attributable to the exact page, keyword, source block, and CTA preset/block
that generated the submission.

## Page Content Shape

The page should be stored as a tree:

```json
{
  "version": 1,
  "sections": [
    {
      "id": "section_1",
      "preset": "standard",
      "background": "default",
      "spacing": "standard",
      "columns": [
        {
          "id": "column_1",
          "width": "1/2",
          "blocks": [
            {
              "id": "block_1",
              "type": "rich_text",
              "props": {
                "eyebrow": "Guide",
                "heading": "Start a vending machine business with a plan",
                "body": "..."
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Block Registry

Each block type needs:

- Schema validation.
- Default props.
- Public renderer.
- Editor renderer.
- Inline-editable fields.
- Publish validation.
- Allowed style presets.

Initial full registry target:

- `hero`
- `rich_text`
- `image`
- `video`
- `cta`
- `faq`
- `card_grid`
- `proof`
- `lead_form`

First thin slice registry:

- `rich_text`
- `image`
- `cta`

## Editor Requirements

The editor should support:

- Create page.
- Edit slug, title, SEO metadata, target keyword.
- Add sections.
- Add columns.
- Add approved blocks.
- Inline-edit block content.
- Drag/drop sections, columns, and blocks.
- Autosave draft.
- Manual publish.
- Secret preview link generation.
- Revision list.
- Revision preview.
- Rollback revision into draft.
- Publish validation report.

The editor may still need a lightweight inspector for settings that are awkward inline:

- Section background preset.
- Section spacing preset.
- Column width preset.
- Block style variant.
- SEO metadata.
- Structured data settings.
- Preview token controls.

## AI Workflow

AI should never publish directly.

AI also should not be treated as a freeform writer. It must operate through a
source-bound proposal contract:

- Input is limited to selected source documents, excerpts, approved claims,
  existing page context, target keyword, audience, and offer.
- Output is structured proposal data, not arbitrary HTML.
- Every proposed claim, statistic, FAQ answer, metadata recommendation, and
  internal-link suggestion must include source IDs or approved-claim IDs.
- Unsupported claims must be returned as warnings or `needs_source`; the AI
  must not invent missing evidence.
- Accepted proposal blocks must pass the same block registry validation as
  manually authored blocks before insertion.
- AI cannot publish, overwrite published content, create redirects, or mutate
  reusable libraries directly.
- Store proposal metadata: model, prompt version, selected source IDs, proposal
  JSON, warnings, accepted block IDs, and accepting admin.

Recommended flow:

1. Admin starts or opens a page.
2. Admin enters topic, target keyword, audience, offer, and selected source material.
3. AI proposes:
   - Page outline.
   - Block tree.
   - SEO title.
   - Meta description.
   - Suggested slug.
   - FAQ/schema candidates.
   - Internal link suggestions.
   - Source references and warnings.
4. Admin accepts all, accepts selected blocks, edits, or discards.
5. Accepted blocks are inserted into the draft.
6. Admin edits visually.
7. Publish validation runs.
8. Admin publishes manually.

## Publish Validation

Publishing should be blocked unless:

- Slug is valid and unique.
- SEO title exists.
- Meta description exists.
- Page has valid canonical/noindex/sitemap settings.
- Block tree is valid.
- Required block fields are filled.
- Used images have alt text.
- Used media has source/rights metadata.
- Video URLs/assets are valid.
- Page has at least one CTA or lead form.
- Internal links are valid.
- Structured data validates if enabled.
- Redirect conflicts are absent.

## Sitemap, Robots, and Routing

Public published pages should render at:

- `/resources/[slug]`

Rules:

- Published pages appear in sitemap when `sitemap_enabled = true` and `noindex = false`.
- Draft and archived pages never appear in sitemap.
- Secret previews never appear in sitemap.
- Archived pages either 404 or 301 redirect, depending on admin choice.
- Slug changes on published pages create a 301 redirect from old path to new path.

## Implementation Slices

### Slice 1: Data Model And Block Registry Foundation

Goal: prove the content contract before building editor complexity.

Scope:

- Supabase migrations for `seo_pages`, `page_revisions`, `media_assets`, and
  `redirects`.
- `draft_content`, `published_content`, and `published_revision_id` on
  `seo_pages`.
- Immutable publish revisions in `page_revisions`.
- TypeScript content-tree schemas for sections, columns, `rich_text`, `image`,
  and `cta`.
- Validation helpers for block props, allowed presets, required fields, and
  publish gates.
- Service tests for create, save draft, publish snapshot, archive, slug change,
  and redirect creation.

Verification:

- Unit tests for schema validation.
- Service tests prove publish creates an immutable revision and mirrors the
  snapshot to `seo_pages.published_content`.
- Service tests prove slug changes create database redirect rows.

### Slice 2: Admin CRUD And Basic Editor

Goal: create and edit a real draft without drag/drop or AI.

Scope:

- Admin `/admin/pages` list.
- Admin create/edit routes.
- Rows/columns content model.
- Inline editing basics for text and CTA fields.
- Image block can reference an existing asset or per-page upload path.
- Add/remove/reorder controls can be simple buttons first; drag/drop is
  deliberately deferred.
- Autosave draft.

Verification:

- Browser test creates a draft with text, image, and CTA blocks.
- Autosave persists reloads.
- Invalid block data is rejected before save.

### Slice 3: Publish, Public Renderer, Sitemap, And Redirects

Goal: complete the first public end-to-end resource page.

Scope:

- Manual publish.
- Public `/resources/[slug]` renderer.
- Sitemap integration.
- Publish validation.
- Database-backed redirect lookup for builder-managed redirects.

Verification:

- Public render test for a published page.
- Sitemap test.
- Redirect test for a changed published slug.
- Browser test of create/edit/publish/render flow.

### Slice 4: Drag/Drop Ordering

Scope:

- Add drag/drop for sections, columns, and blocks using a client-only editor
  island.
- Default technical choice: `@dnd-kit/core` + `@dnd-kit/sortable`, verified
  against the current React 19 / Next 16 app before installation.
- Keep keyboard-accessible reorder buttons as a fallback.

Verification:

- Reorder sections/columns/blocks and prove saved order renders publicly.
- Keyboard reorder remains usable without pointer drag.

### Slice 5: Revision UI and Preview Links

Scope:

- Revision history panel.
- Revision preview.
- Rollback revision into draft.
- Secret preview links.
- Token revocation/expiry.
- Preview tokens render the current draft; revision previews render frozen
  revision snapshots.

Verification:

- Restore old revision into draft.
- Confirm public page does not change until publish.
- Confirm preview renders draft and is excluded from sitemap.

### Slice 6: Media Library

Scope:

- Media library admin.
- Upload image assets.
- Required alt text and source/rights notes.
- Tags/search.
- Image block references assets by ID.

Verification:

- Publish fails if used media lacks required metadata.
- Published page snapshots resolved media content.

### Slice 7: Full Core Blocks And Lead Attribution

Scope:

- `hero`
- `video`
- `faq`
- `card_grid`
- `proof`
- `lead_form`
- Structured data support for FAQ and breadcrumbs.
- Lead schema/extensions for `source_page_id`, `source_page_slug`,
  `target_keyword`, `source_block_id`, and `source_cta_tracking_name`.

Verification:

- Block validation for each type.
- FAQ schema output from FAQ blocks.
- Lead form attribution from resource pages.

### Slice 8: Reusable Content Libraries

Scope:

- `proof_items`
- `cta_presets`
- `source_documents`
- `source_excerpts`
- `approved_claims`
- Draft refresh flow for changed library items.

Verification:

- Published snapshots do not silently change when a library item changes.
- Draft can intentionally refresh referenced items.

### Slice 9: AI Proposal Workflow

Scope:

- AI prompt inputs from approved sources.
- Proposal object.
- Proposed block tree.
- Suggested metadata/schema.
- Source references and warnings.
- Accept selected blocks into draft.

Verification:

- AI cannot insert content without admin approval.
- Proposal references selected approved sources.
- Accepted blocks validate before insertion.
- Unsupported claims produce warnings instead of draft content.

### Slice 10: SEO Hardening

Scope:

- Internal link suggestion/approval flow.
- Metadata duplicate checks.
- SERP preview.
- Schema validation warnings.
- Redirect conflict UI.

Verification:

- Page cannot publish with broken internal links.
- Slug changes produce working 301 redirects.

## Key Risks

- Inline editing plus drag/drop can become complex quickly. Keep block data strict.
- A full row/column builder can drift toward Webflow-level scope. Brand presets should stay firm.
- AI-generated pages can create compliance risk. Keep approved sources and human approval mandatory.
- Revision rollback is easiest if snapshots are immutable and complete.
- Published snapshots need careful design so library updates do not silently change live pages.
- Secret preview links must be tokenized, revocable, and excluded from sitemap.

## Resolved Technical Direction

- Published content source of truth: public rendering reads
  `seo_pages.published_content` for fast, simple runtime reads. Every publish
  also creates an immutable `page_revisions` row and stores its ID in
  `published_revision_id`.
- Drag/drop library: use `@dnd-kit/core` and `@dnd-kit/sortable` in a
  client-only editor island after the schema/editor path is proven. Verify the
  exact package version against React 19 / Next 16 before install.
- Rich text format: use constrained structured rich-text JSON for builder
  blocks, not arbitrary HTML. News CMS markdown remains separate.
- Video assets: represent videos as `media_assets` with provider/external URL
  metadata first. Do not upload large video files to Supabase in v1.
- Preview tokens: live draft previews for active draft review; frozen snapshots
  for revision previews.
- Redirects: use database-backed builder redirects resolved by application
  routing. Keep static Next redirects for legacy Webflow/canonical rules only.
