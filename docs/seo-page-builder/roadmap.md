# SEO Page Builder Roadmap

## Working Goal

Build a backend-powered visual page builder for SEO resource pages. Admins should be able to create `/resources/[slug]` pages visually with rows, columns, reusable blocks, reusable media, approved source material, AI-assisted page structure proposals, draft previews, revision rollback, and manual publishing.

This is not a one-off content batch. The goal is the structure that lets the team create high-quality SEO/conversion pages over time.

## Product Decisions

| Area                 | Decision                                                                         |
| -------------------- | -------------------------------------------------------------------------------- |
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
| AI SEO               | AI suggests metadata and schema; admin approves                                  |
| Internal links       | AI suggests links; admin approves                                                |
| Roles                | Existing admins can edit and publish                                             |
| Archive behavior     | Admin chooses 404 or 301 redirect                                                |
| Library item changes | Published pages use snapshots; drafts refresh intentionally                      |
| First build approach | End-to-end thin slice first                                                      |
| First thin slice     | Text + image + CTA builder                                                       |

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

### Slice 1: End-to-End Builder Foundation

Goal: prove the architecture with a minimal real page builder.

Scope:

- Supabase migrations for `seo_pages`, `page_revisions`, `media_assets`, and `redirects`.
- TypeScript block schemas for `rich_text`, `image`, and `cta`.
- Admin `/admin/pages` list.
- Admin create page.
- Admin edit route.
- Rows/columns content model.
- Inline editing basics for text and CTA fields.
- Media asset selection for image block.
- Drag/drop ordering for sections/blocks.
- Autosave draft.
- Manual publish.
- Public `/resources/[slug]` renderer.
- Sitemap integration.
- Publish validation.

Verification:

- Unit tests for schema validation.
- Service tests for create, autosave, publish, archive, slug changes, redirects.
- Public render test for a published page.
- Sitemap test.
- Browser test of create/edit/publish/render flow.

### Slice 2: Revision UI and Preview Links

Scope:

- Revision history panel.
- Revision preview.
- Rollback revision into draft.
- Secret preview links.
- Token revocation/expiry.

Verification:

- Restore old revision into draft.
- Confirm public page does not change until publish.
- Confirm preview renders draft and is excluded from sitemap.

### Slice 3: Media Library

Scope:

- Media library admin.
- Upload image assets.
- Required alt text and source/rights notes.
- Tags/search.
- Image block references assets by ID.

Verification:

- Publish fails if used media lacks required metadata.
- Published page snapshots resolved media content.

### Slice 4: Full Core Blocks

Scope:

- `hero`
- `video`
- `faq`
- `card_grid`
- `proof`
- `lead_form`
- Structured data support for FAQ and breadcrumbs.

Verification:

- Block validation for each type.
- FAQ schema output from FAQ blocks.
- Lead form attribution from resource pages.

### Slice 5: Reusable Content Libraries

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

### Slice 6: AI Proposal Workflow

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

### Slice 7: SEO Hardening

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

## Open Technical Questions

- Should `draft_content` and `published_content` live on `seo_pages`, or should published content always resolve from latest publish revision?
- What drag/drop library best fits the current React/Next version?
- Should rich text be markdown, structured rich-text JSON, or a small inline formatting model?
- Should video assets be uploaded to Supabase, embedded from external providers, or integrated with a video host later?
- Should preview tokens render current draft live, or a frozen preview snapshot?
- Should `redirects` be handled in middleware, dynamic route logic, or a generated static redirect config?
