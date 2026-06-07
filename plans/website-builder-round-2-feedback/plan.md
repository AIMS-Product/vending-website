# Feature Plan: Website Builder Round 2 Feedback

Status: COMPLETE
Last updated: 2026-06-05
Owner: feature-orchestrator

## Working Brief

- Feature: Convert the Google Doc "Website Builder Notes" Round 2 feedback into a follow-up SEO Page Builder implementation graph.
- Primary actors: Admin content editor, super admin, AI page assistant, public visitor, analytics/content-ops stakeholder.
- Core invariant: Draft editing, autosave, publish gates, public rendering, media governance, routing/canonical behavior, and analytics attribution must remain trustworthy while authoring ergonomics improve.
- Previous intended behaviors: Existing page type/template creation, block registry validation, inline editing, internal-link suggestions, media library, preview/public rendering, author profiles, and lifecycle/review fields continue to work.
- Intentional behavior changes: Improve rich-text body authoring, make body fields expand or otherwise expose all copy, support outline insertion, verify/fix image upload, add video thumbnail override, decide author public paths, and plan document import plus attribution/reporting integrations.
- Unsafe outcomes: Arbitrary HTML editing, silent publish changes, broken rich-text schema compatibility, broken public list/link rendering, uploading assets to production without approval, bad canonical/author paths, or GTM trigger changes without a contract.
- Evidence: `docs/seo-page-builder/website-builder-feedback-review.md`, Google Doc "Website Builder Notes", `docs/design/page-builder.md`, `docs/design/page-builder-blocks.md`, `docs/design/visual-review-checklist.md`, and agent-run reports for S0-S8 under `plans/website-builder-round-2-feedback/agent-runs/`.
- Assumptions: Round 2 is follow-up work over the completed V2 graph. Upload verification against the configured Supabase project was approved for one generated throwaway media asset and completed with cleanup.
- Out of scope: Pushing branches, opening PRs, production release, arbitrary raw code/HTML editor, full in-platform research suite, and GTM implementation without event/trigger decisions.

## Risk Classification

- Overall tier: T2. Most nodes touch admin workflows, page content shape, media storage, public rendering, or external analytics contracts.
- Live-data risk: Medium. Read-only browser verification is safe, but media upload verification creates remote storage/database records.
- Migration risk: Medium. Rich-text heading levels, video thumbnail override, and author path behavior may require additive schema or route changes.
- External-contract risk: Medium. GTM/dataLayer and content-review reporting depend on analytics and ops contracts.

## Dependency Graph

| Node | Title                                                       | Tier | Depends On | Parallel Group | Shared-State Risk          | Status |
| ---- | ----------------------------------------------------------- | ---- | ---------- | -------------- | -------------------------- | ------ |
| S0   | Verify Round 2 runtime reports                              | T1   | none       | W0-A           | browser/remote write gate  | DONE   |
| S1   | Expand rich-text model for heading hierarchy and structures | T2   | S0         | W1-A           | content schema/rendering   | DONE   |
| S2   | Add rich-text authoring controls and auto-sizing fields     | T2   | S1         | W2-A           | editor canvas              | DONE   |
| S3   | Add outline-based block insertion                           | T2   | S0         | W1-B           | editor outline/block order | DONE   |
| S4   | Verify and fix browser image upload flow                    | T2   | S0         | W1-C           | remote media writes        | DONE   |
| S5   | Add video thumbnail override                                | T2   | S0         | W1-D           | media/video render         | DONE   |
| S6   | Decide and implement public author path                     | T2   | S0         | W1-E           | routing/canonical URLs     | DONE   |
| S7   | Plan document copy/upload to block mapping                  | T2   | S1         | W3-A           | AI/import workflow         | DONE   |
| S8   | Define attribution and review-reporting contracts           | T2   | S0         | W1-F           | external contracts         | DONE   |

## Nodes

### S0 - Verify Round 2 runtime reports

Status: DONE
Tier: T1
Type: verification
Actor/trigger: Reviewer opens the existing editor and public page after Round 2 feedback.
Behavior to test: Verification node; no product behavior change.
Invariant protected: UI claims are grounded in rendered evidence before implementation.
Intentional behavior changes: None.
Previous intended behaviors preserved: Existing editor and public page remain unchanged.
Unsafe outcomes: Creating remote media records without approval or marking upload fixed without a browser proof.
Dependencies: none.
Expected files: `docs/seo-page-builder/website-builder-feedback-review.md`, `plans/website-builder-round-2-feedback/agent-runs/S0-runtime-verification.md`.
Write boundaries: Documentation and verification artifacts only.
Acceptance criteria:

- [x] Browser-check an existing editor page for body spacing and expansion.
- [x] Browser-check the corresponding public page to separate editor issues from final rendering.
- [x] Run focused upload helper tests.
- [x] Record upload write gate if browser upload would mutate the configured Supabase project.

Regression guards:

- Do not edit or publish existing pages during verification.
- Do not upload files without approval.

RGR:

- RED: Identify unverified runtime claims from Round 2.
- GREEN: Verify read-only claims in browser and focused tests.
- REFACTOR: Update evidence docs only.

Gates:

- Repo gate: `npm run test -- src/lib/media/editor-upload.test.ts`.
- Browser gate: Required and completed for spacing/expansion.
- Boundary/migration gate: Browser upload blocked on live write approval.

External docs needed: `docs/design/visual-review-checklist.md`.
Parallelization: blocking verification.
Worker role: verifier.
Exit evidence: `agent-runs/S0-runtime-verification.md`.
Blocked on: none for read-only checks; upload proof blocked separately in S4.

### S1 - Expand rich-text model for heading hierarchy and structures

Status: DONE
Tier: T2
Type: scaffold
Actor/trigger: Admin needs structured text inside one Text block.
Behavior to test: When a rich-text body contains paragraphs, lists, and supported heading levels, then it validates, renders publicly, preserves internal links, and stays compatible with existing content.
Invariant protected: Existing rich-text paragraphs, link spans, lists, SEO readiness, and public rendering continue to work.
Intentional behavior changes: Support the heading hierarchy needed for authoring controls, including h4 if accepted by the content contract.
Previous intended behaviors preserved: Existing h2/h3/list/span content remains valid.
Unsafe outcomes: Breaking stored draft/published content, invalidating internal link suggestions, or allowing arbitrary HTML.
Dependencies: S0.
Expected files: `src/lib/page-builder/blocks.ts`, `src/components/sections/resource-blocks/RichTextBlock.tsx`, rich-text tests, SEO readiness/internal link tests.
Write boundaries: Rich-text schema/rendering/helpers only.
Acceptance criteria:

- [x] Rich-text schema supports the agreed heading levels and existing content.
- [x] Public renderer maps heading levels correctly without breaking page outline.
- [x] Internal link spans and list nodes still validate and render.
- [x] Tests cover backwards compatibility.

Regression guards:

- No raw HTML fields.
- No layout variant changes from the canvas.

RGR:

- RED: Added failing tests for `h4` heading validation and public `h2/h3/h4` render preservation.
- GREEN: Extended schema/rendering minimally.
- REFACTOR: Kept heading-level handling local to the rich-text renderer and used schema parsing in renderer tests.

Gates:

- Repo gate: Completed with focused rich-text, readiness, internal-link, renderer tests, typecheck, eslint, and React Doctor.
- Browser gate: Completed on the non-mutating block-preview audit route with `h2/h3/h4` DOM and screenshot evidence.
- Boundary/migration gate: Completed; no migration or remote write needed.

External docs needed: local code/design docs only.
Parallelization: W1-A; blocks S2.
Worker role: schema/rendering worker.
Exit evidence: `agent-runs/S1-heading-hierarchy.md`.
Blocked on: none.

### S2 - Add rich-text authoring controls and auto-sizing fields

Status: DONE
Tier: T2
Type: behavior
Actor/trigger: Admin edits body copy in a Text block.
Behavior to test: When an admin writes body copy, then they can add lists, internal links, subheadings, and additional paragraphs inside the same block while seeing all copy without internal textarea scrolling.
Invariant protected: Autosave, draft persistence, internal-link suggestions, block validation, and public render remain stable.
Intentional behavior changes: Replace or enhance fixed-height body textareas with controls that better reflect public paragraph/list structure and expand to content.
Previous intended behaviors preserved: Existing textarea edits still round-trip or migrate gracefully.
Unsafe outcomes: Data loss during autosave, inaccessible custom editor controls, or link insertion that creates unsafe URLs.
Dependencies: S1.
Expected files: `src/components/admin/seo-page-editor/BlockInlineEditor.tsx`, `BlockSettingsFields.tsx`, `editor-helpers.ts`, tests.
Write boundaries: Rich-text editor UI and helpers only.
Acceptance criteria:

- [x] Body fields expand or expose all content without hidden internal scroll for normal page copy.
- [x] Admin can add/edit bullet lists without adding a separate module.
- [x] Admin can add manual internal links through a safe link control.
- [x] Admin can add supported subheading levels inside the same Text block.
- [x] Save/reload preserves structured rich text.

Regression guards:

- Existing checklist variant remains usable.
- Existing internal-link suggestion apply flow still works.

RGR:

- RED: Added structured rich-text reload coverage for paragraph, heading, list, and link nodes; Round 2 browser proof showed the old flattened textarea did not expose structured authoring.
- GREEN: Added a reusable structured rich-text body editor with paragraph, `h2/h3/h4`, list, and safe manual link controls in both canvas and settings.
- REFACTOR: Shared the editor between surfaces and made textareas auto-size without internal scrolling.

Gates:

- Repo gate: Focused editor helper coverage passed inside the 13-file suite; targeted eslint, typecheck, and diff check passed.
- Browser gate: Desktop and 390px editor proof passed with structured controls, manual link path, list items, and heading controls visible.
- Boundary/migration gate: Completed; no migration or remote write needed.

External docs needed: `docs/design/page-builder.md`, `docs/design/page-builder-blocks.md`.
Parallelization: W2-A after S1.
Worker role: editor UI worker.
Exit evidence: `agent-runs/S2-rich-text-authoring-controls.md`, `/tmp/round2-s2-rich-text-desktop.png`, `/tmp/round2-s2-rich-text-mobile.png`.
Blocked on: none.

### S3 - Add outline-based block insertion

Status: DONE
Tier: T2
Type: behavior
Actor/trigger: Admin uses the left outline to add page structure.
Behavior to test: When the admin is in the outline, then they can insert a new content block at a deliberate position without leaving the outline context.
Invariant protected: Block ordering, selection, autosave, and mobile drawer behavior remain stable.
Intentional behavior changes: Add compact insert controls in the outline for existing pages, not just the empty-state first block.
Previous intended behaviors preserved: Existing canvas add block flow and outline selection/editing continue to work.
Unsafe outcomes: Inserting at the wrong position, overlapping outline controls, or making mobile outline unusable.
Dependencies: S0.
Expected files: `SeoPageEditorShell.tsx`, `BlockPicker.tsx`, editor controller/helpers, tests.
Write boundaries: Outline insertion controls and block insertion helpers.
Acceptance criteria:

- [x] Add controls are available from the outline when blocks already exist.
- [x] Insert position is clear and deterministic.
- [x] Mobile outline/drawer remains usable.
- [x] Existing block move/remove/select behavior is preserved.

Regression guards:

- Do not add layout controls to the canvas.
- No required action depends on hover only on mobile.

RGR:

- RED: Added insertion-position reducer coverage for deterministic block placement.
- GREEN: Added clamped insert indexes, outline block indexes, and compact add-below controls wired to the existing block picker.
- REFACTOR: Portaled the picker dialog after browser proof showed the nested outline picker was clipped/covered.

Gates:

- Repo gate: Focused editor-state coverage passed inside the 13-file suite; targeted eslint, typecheck, and diff check passed.
- Browser gate: Desktop and mobile outline insertion proof passed after the picker portal fix.
- Boundary/migration gate: Completed; no migration or remote write needed.

External docs needed: `docs/design/page-builder.md`.
Parallelization: W1-B.
Worker role: outline UI worker.
Exit evidence: `agent-runs/S3-outline-insertion.md`, `/tmp/round2-s3-outline-picker-portal.png`, `/tmp/round2-s3-outline-insert-desktop.png`, `/tmp/round2-s3-outline-mobile.png`.
Blocked on: none.

### S4 - Verify and fix browser image upload flow

Status: DONE
Tier: T2
Type: integration
Actor/trigger: Admin uploads an image from the media picker or media library.
Behavior to test: When an admin uploads an accepted generated test image, then the signed storage upload succeeds, a media asset is created, and the asset can be selected/rendered.
Invariant protected: Media rights/alt metadata, storage paths, and page content remain trustworthy.
Intentional behavior changes: Unknown until runtime failure is reproduced.
Previous intended behaviors preserved: Existing media library filters and media picker behavior keep working.
Unsafe outcomes: Creating unwanted production media records or masking a storage/auth failure.
Dependencies: S0.
Expected files: `src/lib/media/editor-upload.ts`, `src/components/admin/MediaPickerProvider.tsx`, `src/app/admin/media/actions.ts`, media service/tests.
Write boundaries: Media upload flow only.
Acceptance criteria:

- [x] Browser upload is reproduced with a generated disposable image in an approved environment.
- [x] If upload fails, the exact failing step is identified: signed URL creation, storage upload, asset create, picker state, or render selection.
- [x] Any fix includes focused tests and browser proof.
- [x] Disposable asset is cleaned up if created.

Regression guards:

- Unsupported file types still fail before signed upload.
- Alt text and rights notes remain required for image assets.

RGR:

- RED: Reproduced inert controls on `127.0.0.1` and confirmed hydration worked on `localhost`.
- GREEN: Verified the media upload/save/listing path on `localhost`.
- REFACTOR: No code change needed; kept client/server upload boundaries unchanged.

Gates:

- Repo gate: `npm run test -- src/lib/media/editor-upload.test.ts`.
- Browser gate: Completed on `http://localhost:3000/admin/media`.
- Boundary/migration gate: Completed with approved throwaway asset creation and cleanup.

External docs needed: Supabase storage docs if the signed upload path changes.
Parallelization: W1-C but blocked.
Worker role: media integration worker.
Exit evidence: `agent-runs/S4-browser-upload-verification.md`.
Blocked on: none.

### S5 - Add video thumbnail override

Status: DONE
Tier: T2
Type: behavior
Actor/trigger: Admin edits a video block and wants a custom thumbnail.
Behavior to test: When a video block has a thumbnail override, then editor and public render use the selected thumbnail where applicable without breaking the embed.
Invariant protected: Existing YouTube thumbnail derivation and video embed playback remain stable.
Intentional behavior changes: Add optional media thumbnail selection/upload for video blocks.
Previous intended behaviors preserved: Video URL-only blocks still work.
Unsafe outcomes: Thumbnail asset type mismatch, broken embeds, or missing alt/rights metadata.
Dependencies: S0.
Expected files: video block schema/rendering, media picker settings, tests.
Write boundaries: Video block thumbnail fields and rendering only.
Acceptance criteria:

- [x] Video block supports optional thumbnail asset override.
- [x] Editor settings expose thumbnail picker/upload without making the canvas technical.
- [x] Public render uses override for poster/preview where supported.
- [x] Existing URL-derived thumbnails still work when no override exists.

Regression guards:

- Embed URL validation remains safe.
- No arbitrary media URL injection beyond existing safe paths.

RGR:

- RED: Added tests for optional video thumbnail override parsing and public render usage.
- GREEN: Added optional video thumbnail fields, media picker wiring, editor canvas rendering, and public render support.
- REFACTOR: Kept missing fields absent for stored-content compatibility and tightened the YouTube iframe sandbox.

Gates:

- Repo gate: Focused block/renderer tests passed inside the 13-file suite; targeted eslint, typecheck, React Doctor, and diff check passed.
- Browser gate: Non-mutating block-preview audit proof passed for custom thumbnail styles in picker preview and actual render.
- Boundary/migration gate: Completed; additive JSON fields required no migration.

External docs needed: none unless embed behavior changes.
Parallelization: W1-D.
Worker role: media block worker.
Exit evidence: `agent-runs/S5-video-thumbnail-override.md`, `/tmp/round2-s5-video-thumbnail-preview-screen.png`.
Blocked on: none.

### S6 - Decide and implement public author path

Status: DONE
Tier: T2
Type: integration
Actor/trigger: Public visitor or admin follows an author profile URL.
Behavior to test: When an author profile is shown or linked, then the URL matches the chosen taxonomy and canonical behavior.
Invariant protected: Existing blog/news routes and future blog-builder routes do not break.
Intentional behavior changes: Replace or validate `/blog/author/{slug}` once the desired path is chosen.
Previous intended behaviors preserved: Admin author management remains separate from admin users.
Unsafe outcomes: Broken public author links, duplicated author canonical paths, or route conflicts.
Dependencies: S0.
Expected files: author admin page, public route, route helpers, sitemap/canonical tests if public route ships.
Write boundaries: Author path display/routing only.
Acceptance criteria:

- [x] User chooses the public author path taxonomy.
- [x] Admin display and public route agree.
- [x] Canonical/sitemap behavior is deliberate.
- [x] Existing `/blog` and `/news` routes keep working.

Regression guards:

- Do not remove legacy routes without redirect/cutover policy.
- Do not conflate admin users with public authors.

RGR:

- RED: Added route/display tests for canonical author path, public profile route, admin display, proxy redirect, and public profile service.
- GREEN: Implemented `/authors/{slug}` helpers, public profile route/metadata, admin display update, sitemap inclusion, and `/blog/author/{slug}` 308 redirect.
- REFACTOR: Centralized author path formatting and kept public reads to safe fields through a server-only loader.

Gates:

- Repo gate: route/helper/service/admin/proxy tests, broader changed-surface tests, lint, typecheck, diff check, and React Doctor.
- Browser gate: Admin author page, public author route, legacy redirect, and 390px public/admin viewport proof.
- Boundary/migration gate: Completed; no migration or database write. `curl -I` confirmed 308 redirect to `/authors/mike-hoffmann`.

External docs needed: local Next.js route docs if public route changes.
Parallelization: W1-E.
Worker role: routing worker.
Exit evidence: `agent-runs/S6-public-author-path.md`.
Blocked on: none; canonical path decision is `/authors/{slug}`, with legacy `/blog/author/{slug}` redirect if needed.

### S7 - Plan document copy/upload to block mapping

Status: DONE
Tier: T2
Type: scaffold
Actor/trigger: Admin has a full document or research draft and wants it converted into page modules.
Behavior to test: When an admin provides document content, then the system proposes a block mapping for review without publishing automatically.
Invariant protected: AI-generated/imported content remains review-gated and block-registry validated.
Intentional behavior changes: Add an import/proposal workflow for doc-to-block mapping.
Previous intended behaviors preserved: Existing AI assistant proposal behavior stays proposal-only.
Unsafe outcomes: Auto-publishing imported content, losing source attribution, or inserting unsupported claims.
Dependencies: S1.
Expected files: AI assistant/import route, page-builder AI service, block mapping tests, maybe document parser utilities.
Write boundaries: Import/proposal workflow only.
Acceptance criteria:

- [x] Accept pasted document text first; file upload can be a later extension if needed.
- [x] Proposed blocks validate against the page-builder schema.
- [x] Source/research context is preserved in the proposal review.
- [x] Admin chooses what to insert.

Regression guards:

- No arbitrary HTML import.
- No direct publish.

RGR:

- RED: Added mapping tests for document sections, safe links, list structures, source excerpts, line ranges, and validation.
- GREEN: Added a proposal-only mapper and AI assistant review UI for selecting and inserting validated blocks.
- REFACTOR: Kept mapping pure/local and deferred file upload or persistent source records.

Gates:

- Repo gate: Focused document-import tests passed inside the 13-file suite; targeted eslint, typecheck, and diff check passed.
- Browser gate: Assistant document import proof passed with 2 validated block plans and selected block insertion.
- Boundary/migration gate: Completed; no upload, AI API call, database write, or migration needed.

External docs needed: OpenAI/Vercel AI docs only if API integration changes.
Parallelization: W3-A after S1.
Worker role: AI/import worker.
Exit evidence: `agent-runs/S7-document-import-mapping.md`, `/tmp/round2-s7-document-import-plan.png`, `/tmp/round2-s7-document-import-inserted.png`.
Blocked on: none.

### S8 - Define attribution and review-reporting contracts

Status: DONE
Tier: T2
Type: planning
Actor/trigger: Analytics/content-ops stakeholder wants backend-configurable GTM triggers and content review/research reporting.
Behavior to test: Contract node; no implementation until events and reporting consumers are defined.
Invariant protected: Public tracking and content-review states remain interpretable and auditable.
Intentional behavior changes: Define event taxonomy, dataLayer payloads, review triggers, and reporting consumers.
Previous intended behaviors preserved: Existing CTA/form tracking names and lifecycle fields remain valid.
Unsafe outcomes: Shipping analytics events no one consumes, changing conversion attribution silently, or creating noisy review tasks.
Dependencies: S0.
Expected files: `decisions.md`, analytics docs, maybe future plan update.
Write boundaries: Planning/docs only until unblocked.
Acceptance criteria:

- [x] Required GTM/dataLayer events are named.
- [x] Payload ownership is defined at v1 level.
- [x] Content-review triggers and reporting destinations are defined at v1 level.
- [x] Implementation nodes are split after contract approval.

Regression guards:

- No tracking implementation without a contract.
- No production tag/container changes in this graph without explicit release approval.

RGR:

- RED: Listed unknown external contracts.
- GREEN: Captured decisions and deferred implementation nodes.
- REFACTOR: Kept analytics and content-review contracts separate from implementation.

Gates:

- Repo gate: docs formatting/check only.
- Browser gate: skipped until implementation.
- Boundary/migration gate: completed; no tracking, GTM/container, database, or migration changes made.

External docs needed: GTM/dataLayer docs when implementation begins.
Parallelization: W1-F.
Worker role: contract planner.
Exit evidence: `agent-runs/S8-attribution-review-contract.md`.
Blocked on: none.
