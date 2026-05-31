# SEO Page Builder Design Contract

## Purpose

The SEO Page Builder is a constrained, block-level editor for `/resources/[slug]` pages. It should let admins compose and edit high-quality SEO/conversion pages without exposing freeform design controls or technical implementation fields.

The active product roadmap remains `docs/seo-page-builder/roadmap.md`. This file is the design and interaction contract for executing that roadmap.

## Core Model

- This is a block-level page builder, not an element-level design tool.
- Admins choose approved blocks and templates; they do not draw arbitrary layouts.
- Layout, responsive behavior, spacing, typography, and brand styling are controlled by code and approved presets.
- The canvas is for public-facing page content.
- Sidebars, drawers, and advanced settings are for governance, SEO, attribution, media metadata, and technical configuration.

## Canvas Rules

The center canvas must feel like editing the real page:

- Render the page-like public frame wherever practical.
- Inline-edit visible text where the user sees it.
- Text fields should look like content with subtle hover/focus affordances, not large CMS form panels.
- Do not show raw technical fields in the canvas.
- Do not show layout selectors in the canvas after a block is inserted.
- Do not expose schema paths, UUIDs, tracking keys, or implementation names in the main authoring surface.
- Empty content should look guided, not broken. Place missing-field hints near the field and summarize them in the SEO/readiness panel.

## Locked Layout Rules

- Block layout is selected when adding the block or choosing a template.
- Once inserted, the block layout is locked in the canvas.
- The current layout may be shown as a non-editable badge, for example `Editorial hero`.
- Changing layout after insertion requires a deliberate replace/rebuild flow, not an inline dropdown.
- Never let a user accidentally change layout while editing copy.

## Content Editing Rules

- Public-facing copy belongs in the canvas.
- Admins should be able to click into headings, body copy, button text, FAQ copy, card text, proof copy, image captions, and lead form copy.
- Editing content should preserve the existing block type, variant, ordering, attribution, and publish state.
- Required-field validation should update immediately enough to guide the user without feeling noisy.
- Autosave and manual save must preserve collapsed drawer values and hidden required fields.

## Technical Settings Rules

These do not belong as prominent canvas fields:

- URL/href fields unless the block is specifically a link editor.
- Tracking labels.
- Preset IDs.
- Asset IDs.
- Source document IDs.
- Schema paths.
- Internal metadata.

Technical settings should live in one of:

- block settings popover/modal,
- right sidebar,
- content library picker,
- media picker,
- advanced accordion.

Page title, slug, SEO title, target keyword, and meta description are settings.
They must not render as a separate public-looking headline above the first hero
block. The first hero block owns the visible page headline.

## Block Controls

- Structural controls should appear on hover/focus or in the left outline, not dominate the canvas.
- Drag/reorder handles should be visually secondary.
- Duplicate/remove/move actions should stay available but compact.
- Add section and add block controls must not overlap the block toolbar.
- A user should always be able to tell whether they are editing content, changing page structure, or opening settings.

## Sidebar Roles

Left sidebar:

- page structure,
- block outline,
- selected block location,
- navigation to a block,
- compact settings entry points.

Center canvas:

- visible page content only,
- direct content editing,
- add content in context,
- lightweight field-level warnings.

Right sidebar (SEO and publish only):

- publish action and publish blockers,
- SEO readiness summary and findings,
- page title, slug, and metadata,
- advanced technical SEO settings,
- internal link suggestions.

The right sidebar configures SEO and judges readiness. It must not be a second
block-insertion surface for arbitrary structure. Readiness findings may offer a
focused "add the missing block" shortcut and may apply internal link
suggestions, but bulk/generative structure creation does not live here.

Top rail:

- manual Save draft and Preview (the single home for Save draft),
- autosave status.

Floating AI assistant:

- the generative SEO agent (run, proposal review, insert selected content),
- AI proposal source references and warnings.

The AI assistant is a separate floating surface (bottom-right launcher), not a
section of the right sidebar. It proposes content; approved insertions land on
the canvas. It must be positioned so it never covers the publish controls.

## Warnings And Readiness

- Field-level issues should sit close to the affected field.
- SEO/readiness panel should summarize publish blockers and next required action.
- Avoid duplicate warning panels that repeat the same issue in multiple places.
- Readiness labels should use user-facing copy: `Add SEO title`, not `seo_title missing`.
- Warnings should never obscure content or block editing unless the action is truly unsafe.

## AI And Source-Bound Content

- AI proposes block content; admins approve insertion.
- The generative SEO agent lives in the dedicated floating AI assistant, not in the right sidebar or readiness panel.
- Proposed blocks must validate against the same block registry as manually authored blocks.
- AI source references and warnings belong in the assistant's proposal review, not inline as normal page content and not duplicated into the readiness panel.
- Unsupported claims should block insertion or publish according to the roadmap contract.

## What Must Not Ship

- Freeform design controls.
- Layout dropdowns in the canvas.
- Technical tracking fields as first-class canvas content.
- Raw schema labels in normal UI.
- Page builder surfaces that pass tests but visually overlap, hide actions, or feel like generic forms embedded in a page.
