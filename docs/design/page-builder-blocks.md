# SEO Page Builder Block Editing Contract

## Purpose

Each block must have a clear editing model. The canvas is for public-facing content. Layout, source, attribution, and technical values belong in controlled settings.

## Universal Block Rules

- Preserve the existing block schema in `src/lib/page-builder/blocks.ts`.
- Do not invent new block states casually.
- Do not add arbitrary HTML editing.
- Do not expose layout variants as editable canvas controls.
- Do not expose internal tracking fields as prominent canvas controls.
- Use the same block content model for editor preview and public rendering wherever practical.
- If a block needs advanced configuration, put it in a settings popover, drawer, picker, or advanced accordion.

## Block Contracts

| Block     | Canvas editable content                                                      | Settings or sidebar content                                                         | Locked layout/content rules                                                |
| --------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Hero      | Eyebrow, headline, body copy, CTA label when visible                         | CTA href, CTA tracking label, media path, media alt text, media caption, proof text | Variant such as standard/split/compact/editorial is locked after insertion |
| Rich text | Eyebrow, section heading, body copy, headings, list text                     | Link targeting, advanced rich text controls if added later                          | Structure stays within approved rich text nodes                            |
| CTA       | Button label                                                                 | Href, tracking label, preset reference                                              | Button style/variant is controlled by approved presets                     |
| Image     | Caption when visible                                                         | Media library asset, image URL/path, alt text, rights notes, asset ID               | Aspect, framing, and placement come from the selected block layout         |
| Video     | Title and caption when visible                                               | Video URL/embed source                                                              | Embed behavior and layout are controlled by block variant                  |
| FAQ       | Heading, question text, answer text                                          | Add/remove/reorder FAQ items when exposed as settings                               | FAQ component behavior is controlled by approved variant                   |
| Cards     | Block heading, card title, card body, visible card link label if implemented | Card href, add/remove/reorder cards                                                 | Card count limits and grid layout are controlled by schema and presets     |
| Proof     | Eyebrow, quote/stat body, name, context when visible                         | Proof library item ID/reference                                                     | Proof layout and emphasis are preset-controlled                            |
| Lead form | Heading, helper copy, submit label                                           | Tracking name, field configuration if supported later                               | Required lead fields and attribution are enforced by app contract          |

## Hero Block Standard

Hero blocks are the highest-risk visual blocks because they define the page's first impression.

Required behavior:

- Headline is directly editable in the canvas.
- Body copy is directly editable in the canvas.
- CTA label is directly editable when a CTA is present.
- CTA href and tracking label are advanced settings.
- The current layout is visible only as a non-editable badge.
- Missing headline/body guidance appears near the fields and in readiness summary.

Do not:

- show `CTA href` beside the CTA as a primary canvas field,
- show `Internal CTA label` as a primary canvas field,
- allow the layout variant to change from the block toolbar,
- make the empty headline look like a broken form card.

## Rich Text Standard

Rich text blocks should feel like editing page copy, not editing JSON.

Required behavior:

- Section headings and body text are edited inline.
- Empty copy prompts should say what to write, not mention schema.
- Link editing may use a small popover or sidebar, not raw span data.

## CTA Standard

CTA blocks should prioritize what the user sees.

Required behavior:

- Button label is editable in place.
- Destination URL is a secondary setting.
- Tracking label should auto-sync from button label until deliberately overridden.

## Image And Media Standard

Image blocks need enough governance to avoid bad launches without making the canvas technical.

Required behavior:

- Canvas shows the actual image or a clear visual placeholder.
- Caption can be edited near the image.
- Alt text and rights notes stay in media settings.
- Media library picker should be preferred over manual URLs when assets exist.

## Lead Form Standard

Lead form blocks are conversion and attribution surfaces.

Required behavior:

- Heading, helper copy, and submit label can be edited as content.
- Tracking and attribution settings are not primary canvas fields.
- Public form fields remain disabled/non-editable in the page builder unless a future field-configuration feature exists.
- Before public use, lead attribution must preserve page, keyword, block, CTA, UTM, and referrer.

## Completion Guidance

For every block:

- Missing required content should be clear near the field.
- Completion status should update when the field is filled.
- Publish blockers should summarize in the SEO/readiness panel.
- The user should not need to open a modal to understand what is missing.
