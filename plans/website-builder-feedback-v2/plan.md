# Feature Plan: Website Builder Feedback V2

Status: IN_PROGRESS
Last updated: 2026-06-02
Owner: feature-orchestrator

## Working Brief

- Feature: Convert the Kody Wirth website-builder feedback review into a dependency-ordered implementation graph for the next SEO/Admin Studio builder expansion.
- Primary actors: Admin content editor, super admin, AI page assistant, public visitor, scheduled publishing job.
- Core invariant: Published pages, previews, redirects, sitemap/noindex behavior, lead attribution, and immutable revision history must remain trustworthy while the builder grows from resource-page editor into a broader page-type/template CMS.
- Previous intended behaviors: Existing `/admin/pages` resource-page creation, autosave, revision history, preview links, media library, libraries, SEO readiness, internal link suggestions, publish gates, database redirects, and public `/resources/[slug]` rendering must keep working.
- Intentional behavior changes: Add persistent editor escape/navigation, explicit copy links, page-type/template creation, duplicate-page flow, route-prefix-aware slugs, publish-to-content-library capture, page-level internal tags, review lifecycle fields, scheduled publishing, richer dashboard governance, custom footer variants, better media/proof/author support, and later collaboration/integration surfaces.
- Unsafe outcomes: Accidentally mutating live pages during draft edits, exposing preview/admin controls publicly, creating duplicate/low-quality SEO slugs, indexing preview/noindex pages, losing redirects during prefix changes, overwriting collaborator work silently, bulk-publishing unsafe pages, saving arbitrary raw code, or widening roles without auditability.
- Evidence: `docs/seo-page-builder/website-builder-feedback-review.md`, `docs/seo-page-builder/roadmap.md`, `docs/design/admin-studio.md`, `docs/design/page-builder.md`, `docs/design/page-builder-blocks.md`, `docs/design/visual-review-checklist.md`.
- Assumptions: This is a v2 expansion over the already-shipped builder foundation. The user has approved all feedback classifications and requested a graph plan only in this pass. The exact slug prefix taxonomy can be finalized inside the route/template node before implementation.
- Out of scope: Production data mutation, Vercel deployment, public custom-domain cutover, broad visual redesign, arbitrary freeform design controls, arbitrary raw HTML editing, and implementing the plan in this pass.

## Risk Classification

- Overall tier: T2 because the full graph includes migrations, scheduled jobs, public routing, sitemap/canonical behavior, and admin governance changes.
- Live-data risk: Medium. Draft/publish/revision boundaries and redirect behavior touch live page records but can be built non-destructively.
- Migration risk: Medium. Several nodes likely require additive schema for page tags, review dates, scheduled publish state, route prefixes, content-library block captures, authors, comments, and experiments.
- External-contract risk: Medium. Preview links, sitemap/noindex, public routing, webhooks, CSV/API, and analytics events have external consumers or crawler behavior.

## Dependency Graph

| Node | Title                                                      | Tier | Depends On | Parallel Group | Shared-State Risk              | Status  |
| ---- | ---------------------------------------------------------- | ---- | ---------- | -------------- | ------------------------------ | ------- |
| S0   | Verify existing review-marked builder behavior             | T0   | none       | W0-A           | browser/session state          | DONE    |
| S1   | Add persistent editor navigation and copy links            | T1   | S0         | W1-A           | low admin UI                   | DONE    |
| S2   | Define page type and template creation foundation          | T2   | S0         | W1-B           | schema/admin creation flow     | DONE    |
| S3   | Add route-prefix slugs and duplicate-page flow             | T2   | S2         | W2-A           | routing/redirect/sitemap       | DONE    |
| S4   | Capture published blocks into content library              | T2   | S2         | W2-B           | publish snapshots/library data | PENDING |
| S5   | Add SEO drawer governance fields                           | T2   | S2         | W2-C           | page metadata/publish gates    | PENDING |
| S6   | Add dashboard metadata, lifecycle, and bulk operations     | T2   | S5         | W3-A           | admin list/bulk mutations      | PENDING |
| S7   | Add admin redirect manager                                 | T2   | S3         | W3-B           | redirects/public routing       | PENDING |
| S8   | Add scheduled publishing and review automation             | T2   | S5         | W3-C           | jobs/timezone/publish state    | PENDING |
| S9   | Add media defaults, proof images, and alt-text audit       | T1   | S2         | W3-D           | media metadata/rendering       | PENDING |
| S10  | Fold blog authoring into builder with author profiles      | T2   | S2, S3     | W4-A           | route/content model            | PENDING |
| S11  | Add controlled custom footer and form/embed blocks         | T2   | S2, S5     | W4-B           | public render/security         | PENDING |
| S12  | Add governance history, comments, and collision protection | T2   | S6         | W5-A           | revisions/concurrency/audit    | PENDING |
| S13  | Plan later analytics, webhooks, CSV import, and API access | T2   | S6, S7, S8 | W5-B           | external contracts             | BLOCKED |

## Nodes

### S0 - Verify existing review-marked builder behavior

Status: DONE
Tier: T0
Type: verification
Actor/trigger: Reviewer opens the current admin builder, media library, preview, and public resource routes.
Behavior to test: Verification node; no new product behavior.
Invariant protected: Existing shipped builder features are classified from rendered/browser evidence before new implementation depends on them.
Intentional behavior changes: None.
Previous intended behaviors preserved: Autosave, revisions, preview links, SEO readiness, internal link suggestions, canonical/noindex, media filters, permissions, and alt text should keep their documented behavior.
Unsafe outcomes: Building v2 work on incorrect assumptions from code-only inspection.
Dependencies: none.
Expected files: test/playwright or manual verification notes only if needed; no production code changes required.
Write boundaries: Existing verification artifacts under `plans/website-builder-feedback-v2/` if evidence needs to be recorded.
Acceptance criteria:

- [ ] Browser-verify autosave, reload persistence, draft-vs-live boundary, and save failure messaging.
- [ ] Browser-verify revision preview, restore-to-draft, and publish isolation.
- [ ] Browser-verify preview links for draft access, expiry/revoke, noindex behavior, and no admin controls.
- [ ] Verify canonical/noindex/sitemap output on representative published pages.
- [ ] Verify media filters and alt text paths through media library, builder picker, and public render.
- [ ] Verify permissions still match admin/super-admin expectations.

Regression guards:

- Do not create permanent public content without cleanup.
- Do not mark UI claims complete without screenshot or browser evidence.

RGR:

- RED: Capture the current unverified assumptions from the feedback review as checklist items.
- GREEN: Execute the smallest browser/repo checks that prove or correct each assumption.
- REFACTOR: Update the review doc or follow-up evidence file only where classifications change.

Gates:

- Repo gate: `npm run lint`, `npm run typecheck`, and focused tests only if verification changes code or test files.
- Browser gate: Required for admin/editor UI and public render claims.
- Boundary/migration gate: No migrations expected.

External docs needed: `docs/design/visual-review-checklist.md`.
Parallelization: blocking; run before implementation waves.
Worker role: verifier.
Exit evidence: Routes opened, screenshots or browser notes, commands run, and any corrected statuses.
Blocked on: none.

### S1 - Add persistent editor navigation and copy links

Status: DONE
Tier: T1
Type: behavior
Actor/trigger: Admin edits a page and needs to return to the CMS or share the exact page reference.
Behavior to test: When an admin is anywhere in the editor, then they can always return to `/admin/pages` and copy the editor/public URL without relying on the Blocks panel.
Invariant protected: The top rail remains the home for save/preview/autosave and does not hide publish controls or canvas editing.
Intentional behavior changes: Add a persistent "Back to pages" or dashboard control and explicit "Copy editor link" / "Copy public URL" controls.
Previous intended behaviors preserved: Existing Blocks panel dashboard link can remain; save draft, preview, autosave, and publish controls keep their locations.
Unsafe outcomes: Navigation control crowds the top rail, wraps poorly on mobile, exposes raw UUIDs as normal UI, or copies stale public URLs before publish.
Dependencies: S0.
Expected files: `src/components/admin/seo-page-editor/SeoPageEditorTopRail.tsx`, possible URL helper/service tests.
Write boundaries: Editor chrome and URL-copy UI only.
Acceptance criteria:

- [ ] Persistent back control is visible in desktop and narrow editor layouts.
- [ ] Copy editor link works for draft and published pages.
- [ ] Copy public URL is disabled or clearly unavailable before a page has a publishable public path.
- [ ] Mobile/narrow top rail has no overlap or hidden primary actions.

Regression guards:

- Existing save/preview/autosave controls keep working.
- No raw database identifiers are shown outside deliberate support/debug copy.

RGR:

- RED: Add or update focused tests for copy-link availability and disabled states where practical.
- GREEN: Implement compact top-rail controls.
- REFACTOR: Share URL formatting helpers with page list/editor if duplication appears.

Gates:

- Repo gate: lint, typecheck, focused component/unit tests if present.
- Browser gate: Required desktop and mobile editor screenshots.
- Boundary/migration gate: none.

External docs needed: `docs/design/admin-studio.md`, `docs/design/page-builder.md`.
Parallelization: W1-A, parallel-safe with S2 after S0.
Worker role: admin UI worker.
Exit evidence: Browser screenshots and copy-link test evidence.
Blocked on: none.

### S2 - Define page type and template creation foundation

Status: DONE
Tier: T2
Type: scaffold
Actor/trigger: Admin starts a new page or asks the AI assistant to use a saved template.
Behavior to test: When an admin creates a page, then they can choose page type and optionally a blank page, default template, saved template, or AI-assisted template path.
Invariant protected: Builder remains constrained to approved blocks/templates and does not become a freeform design tool.
Intentional behavior changes: Enable page-type selection for Blog, Landing Page, SEO Page/Resource, Video Page, and future types; establish Template Builder data and UI contract; allow AI to tag/select approved templates.
Previous intended behaviors preserved: Existing resource-page creation still works as the default path until other page types are ready.
Unsafe outcomes: Template selection bypasses block validation, exposes layout controls in the canvas, inserts unsupported AI claims, or creates pages with invalid route/SEO metadata.
Dependencies: S0.
Expected files: schema migrations, page creation action/services, `src/app/admin/pages/*`, editor controller, AI assistant template contract, block registry tests.
Write boundaries: Page creation, template model, template selection UI, AI template contract. Do not implement public routes for new prefixes in this node unless required for tests.
Acceptance criteria:

- [x] New-page flow includes page type selection and blank/default/saved template choices.
- [x] Resource-page creation remains backward compatible.
- [x] Templates are composed of existing validated blocks and locked layout variants.
- [x] AI can reference approved templates without bypassing proposal review.
- [x] Template creation/selection is represented in tests and admin UI copy uses marketer-facing labels.

Regression guards:

- No arbitrary HTML or freeform design controls.
- Existing draft autosave and publish gates still validate generated template content.

RGR:

- RED: Add tests for page creation with page type/template selections and invalid template rejection.
- GREEN: Add additive data/service/UI foundation.
- REFACTOR: Normalize page-type constants and template registry usage.

Gates:

- Repo gate: migration tests if schema changes, lint, typecheck, focused service/UI tests.
- Browser gate: New-page creation flow desktop and mobile/narrow review.
- Boundary/migration gate: Additive migration only; no destructive template/page data change.

External docs needed: `docs/design/admin-studio.md`, `docs/design/page-builder.md`, `docs/design/page-builder-blocks.md`.
Parallelization: W1-B, parallel-safe with S1 after S0; single-threaded for migrations.
Worker role: feature foundation worker.
Exit evidence: Migration/test output and browser proof of create flow.
Blocked on: none.

### S3 - Add route-prefix slugs and duplicate-page flow

Status: DONE
Tier: T2
Type: integration
Actor/trigger: Admin selects a page type, edits the slug prefix, or duplicates an existing page.
Behavior to test: When an admin duplicates or creates a typed page, then the default route prefix is inferred but can be deliberately changed before publish with safe uniqueness and redirect handling.
Invariant protected: Public routing, canonical URLs, redirects, sitemap, preview links, and published revision snapshots remain consistent.
Intentional behavior changes: Support prefixes such as `/resources`, `/blog`, `/solutions`, or landing route groups; add page-level duplicate action with SEO-safe temporary slug rules.
Previous intended behaviors preserved: Existing `/resources/[slug]` pages and redirects continue to resolve.
Unsafe outcomes: Duplicate pages publish with low-quality duplicate slugs, prefix changes break canonical/sitemap/preview links, redirects loop, or route uniqueness is checked only by slug instead of full path.
Dependencies: S2.
Expected files: route helpers, page services/actions, redirect services, sitemap/public services, page list row actions, editor slug UI, tests.
Write boundaries: Page path/prefix services, duplicate action, redirect integration, slug UI. Do not broaden to full blog authoring; that is S10.
Acceptance criteria:

- [x] Page path uniqueness is enforced by full path/prefix.
- [x] Default prefix is inferred by page type and can be overridden where allowed.
- [x] Duplicate creates a draft, resets publish state, copies relevant content/metadata/tags, and requires a publish-safe slug/title.
- [x] Prefix or slug changes create safe redirects for previously published paths.
- [x] Canonical, sitemap, preview, and public render use the full path correctly.

Regression guards:

- Existing `/resources` pages and redirects pass compatibility tests.
- Bulk duplicate/publish is not introduced.

RGR:

- RED: Add route/prefix/duplicate tests including redirect conflict and loop cases.
- GREEN: Implement path model and duplicate action.
- REFACTOR: Centralize URL/path formatting used by editor, public service, sitemap, and redirect manager.

Gates:

- Repo gate: lint, typecheck, route/service tests, build if routing changes.
- Browser gate: Create, duplicate, preview, publish, and public-route smoke with disposable content.
- Boundary/migration gate: Additive migration if storing prefix/full path; non-destructive backfill for existing resources.

External docs needed: local Next.js routing docs under `node_modules/next/dist/docs/` before route implementation.
Parallelization: W2-A; single-threaded with route/migration work.
Worker role: routing and services worker.
Exit evidence: Passing route tests, browser smoke, and cleanup notes.
Blocked on: none; safe route-prefix defaults are recorded in `decisions.md`.

### S4 - Capture published blocks into content library

Status: PENDING
Tier: T2
Type: integration
Actor/trigger: Admin publishes a page.
Behavior to test: When a page is published, then every page-builder block is captured as a reusable content-library piece with source page, published revision, type, metadata, tags, and provenance.
Invariant protected: Published page snapshots remain immutable and library edits do not silently alter live pages.
Intentional behavior changes: Add automatic publish-time content-library capture; manual "save block to library" can be added later but is not the primary requirement.
Previous intended behaviors preserved: Existing proof/CTA/source libraries keep working; blocks that reference library items still snapshot as before.
Unsafe outcomes: Library capture mutates live revisions, creates duplicates on every republish without versioning, captures unsupported/private draft notes, or makes reusable content indistinguishable from source material.
Dependencies: S2.
Expected files: migrations, publish service, content-library services/UI, block serialization tests, admin libraries route.
Write boundaries: Content-library data model and publish pipeline only; do not redesign all libraries unless needed.
Acceptance criteria:

- [ ] Publish captures each block with block type, content payload, source page, revision ID, page type, tags, and created/updated metadata.
- [ ] Republish behavior is deterministic: versioned, deduped, or explicitly linked to publish revision.
- [ ] Internal tags from the page flow into captured pieces where appropriate.
- [ ] Admin library can filter and inspect captured content pieces.
- [ ] Published pages remain rendered from publish snapshots, not from mutable captured library pieces.

Regression guards:

- Existing publish tests still prove live/draft isolation.
- Existing reusable proof/CTA references still resolve.

RGR:

- RED: Add failing tests for publish capture and republish behavior.
- GREEN: Add additive schema and publish integration.
- REFACTOR: Extract capture mapping per block type to avoid publish-service bloat.

Gates:

- Repo gate: migration tests, service tests, lint, typecheck.
- Browser gate: Publish disposable page, inspect captured library entries, verify public page unchanged after library inspection/edit where applicable.
- Boundary/migration gate: Additive migration; no destructive library cleanup.

External docs needed: none beyond builder docs.
Parallelization: W2-B; parallel-safe with S3/S5 except migration coordination.
Worker role: content library worker.
Exit evidence: Publish capture test and browser/admin evidence.
Blocked on: none.

### S5 - Add SEO drawer governance fields

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: Admin configures SEO and lifecycle metadata before publishing.
Behavior to test: When an admin opens the SEO/publish drawer, then they can manage internal tags, review period, next review date, OG/social fields, noindex/canonical, and page lifecycle state without exposing technical schema labels.
Invariant protected: SEO drawer remains the governance/readiness surface and not a second block insertion area.
Intentional behavior changes: Add non-public tags, topic/cluster/campaign/funnel labels, review period dropdown in 3-month increments up to 18 months, next review date, OG/social controls, and clear noindex/canonical behavior.
Previous intended behaviors preserved: Existing SEO title, meta description, target keyword, canonical, noindex, sitemap, readiness, and internal link suggestions keep working.
Unsafe outcomes: Tags leak publicly, review status conflicts with publish status, OG images lose alt/rights metadata, noindex and sitemap contradict each other, or drawer values unmount/corrupt on collapse.
Dependencies: S2.
Expected files: migrations, SEO editor/drawer components, page services, readiness logic, tests.
Write boundaries: SEO/governance metadata and drawer UI. Dashboard presentation belongs to S6.
Acceptance criteria:

- [ ] Internal-only tags persist, reload, and do not render publicly unless intentionally used for admin filtering.
- [ ] Review period supports 3, 6, 9, 12, 15, and 18 months and calculates next review due date.
- [ ] OG/social image/title/description controls persist and render correct metadata.
- [ ] Noindex, sitemap, and canonical states are validated together.
- [ ] Drawer remains usable on desktop and narrow layouts.

Regression guards:

- Existing publish readiness cannot be bypassed by new metadata fields.
- Existing canonical/noindex behavior remains compatible for `/resources` pages.

RGR:

- RED: Add metadata persistence, validation, and public-render tests.
- GREEN: Add additive fields and drawer controls.
- REFACTOR: Centralize SEO metadata validation for editor, publish, and public render.

Gates:

- Repo gate: migration tests, service tests, lint, typecheck, build if metadata output changes.
- Browser gate: SEO drawer desktop/mobile, save/reload, preview/public metadata proof.
- Boundary/migration gate: Additive migration only.

External docs needed: `docs/design/admin-studio.md`, `docs/design/page-builder.md`.
Parallelization: W2-C; parallel-safe with S3/S4 except migrations.
Worker role: SEO governance worker.
Exit evidence: Tests plus browser proof of drawer persistence and metadata output.
Blocked on: none.

### S6 - Add dashboard metadata, lifecycle, and bulk operations

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: Admin manages many pages from `/admin/pages`.
Behavior to test: When an admin uses the page dashboard, then they can filter and act on metadata, internal tags, review state, orphan/internal-link state, and selected pages without opening every page.
Invariant protected: Bulk operations cannot accidentally publish unsafe pages or bypass publish gates.
Intentional behavior changes: Add metadata table/view, inline-safe metadata editing, filters for missing/too-long metadata, Needs review/Updating/Orphaned filters, checkbox selection, bulk archive/draft/tag/review-period/status actions.
Previous intended behaviors preserved: Existing page search, status filters, row actions, readiness indicators, and publish/draft/archive behavior keep working.
Unsafe outcomes: Bulk publish becomes possible without guardrails, dashboard becomes too wide/unscannable, mobile overflows, or inline edits skip validation.
Dependencies: S5.
Expected files: `/admin/pages` route/components, page services/actions, metadata validators, internal-link audit services/tests.
Write boundaries: Page dashboard/list/governance surfaces only.
Acceptance criteria:

- [ ] Dashboard supports metadata view with full path, target keyword, SEO title, meta description, noindex/sitemap, review status/date.
- [ ] Filters surface Needs review, Updating, Orphaned/Needs internal links, and metadata issues.
- [ ] Multi-select supports guarded bulk archive, move-to-draft, add/remove internal tags, and change review period/status.
- [ ] Bulk publish is absent or explicitly guarded outside this node.
- [ ] Mobile/tablet layout has intentional containment or stacked fallback.

Regression guards:

- Row-level actions still work.
- Status filters remain understandable and performant.

RGR:

- RED: Add tests for bulk action validation and metadata filtering.
- GREEN: Implement dashboard view/actions.
- REFACTOR: Extract reusable table/action primitives only if repeated complexity appears.

Gates:

- Repo gate: action/service tests, lint, typecheck.
- Browser gate: `/admin/pages` desktop and mobile screenshots, save/reload for inline edits.
- Boundary/migration gate: No destructive bulk mutation in tests without disposable data.

External docs needed: `docs/design/admin-studio.md`.
Parallelization: W3-A; depends on S5.
Worker role: admin dashboard worker.
Exit evidence: Tests and browser evidence for list, filters, and bulk actions.
Blocked on: none.

### S7 - Add admin redirect manager

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: Admin needs to map old URLs to new builder pages or inspect automatically created redirects.
Behavior to test: When an admin opens Redirect Manager, then they can create, validate, inspect, and deactivate redirects for builder paths beyond `/resources`.
Invariant protected: Redirect engine prevents loops/conflicts and does not break existing published routes.
Intentional behavior changes: Add admin UI for old path, destination, status code, source/reason, linked page, conflict validation, and support for typed route prefixes.
Previous intended behaviors preserved: Existing automatic slug/archive redirects keep working.
Unsafe outcomes: Redirect loops, redirecting published pages away from themselves, path conflicts with live pages, exposing unsafe external destinations without validation, or letting CSV import bypass validation.
Dependencies: S3.
Expected files: redirect manager route/components, redirect services, validation tests, possibly route middleware/server redirect lookup.
Write boundaries: Redirect admin UI and redirect validation/services.
Acceptance criteria:

- [ ] Admins can list existing redirects and identify automatic vs manual source.
- [ ] Create/edit validates old path, destination, status code, conflicts, and self-redirects.
- [ ] Redirects can link to a builder page when applicable.
- [ ] Works for all route prefixes introduced by S3.
- [ ] CSV import is deferred unless explicitly included later.

Regression guards:

- Existing redirect lookup tests pass.
- Live page routes are preferred over invalid redirect conflicts.

RGR:

- RED: Add validation tests for conflict/loop/status/source cases.
- GREEN: Implement manager UI/actions.
- REFACTOR: Share validation between automatic slug-change redirects and manual manager.

Gates:

- Repo gate: service/action tests, lint, typecheck, build if route handling changes.
- Browser gate: Redirect manager create/list/edit smoke and public redirect smoke with disposable paths.
- Boundary/migration gate: Additive fields only if needed; no bulk redirect import.

External docs needed: local Next.js routing docs if redirect lookup route changes.
Parallelization: W3-B; depends on S3.
Worker role: redirect worker.
Exit evidence: Tests and browser/public-route proof.
Blocked on: none.

### S8 - Add scheduled publishing and review automation

Status: PENDING
Tier: T2
Type: integration
Actor/trigger: Admin schedules a page to go live or sets review lifecycle timing.
Behavior to test: When an admin schedules a publish time, then the page remains draft until the server-side scheduler publishes it at the selected time and dashboard state reflects scheduled/review-due pages.
Invariant protected: Publish gates, revisions, redirects, sitemap, and notifications behave as if a human published at that time.
Intentional behavior changes: Add scheduled publish metadata, date/time picker, cancel/reschedule, timezone handling, dashboard visibility, and review-due state transitions.
Previous intended behaviors preserved: Immediate manual publish continues to work.
Unsafe outcomes: Client-only timers publish incorrectly, timezone drift publishes early/late, scheduled publish bypasses readiness, failed jobs go silent, or review reminders mutate publish status unexpectedly.
Dependencies: S5.
Expected files: migrations, publish scheduling services, cron/job route or hosted scheduler integration, dashboard indicators, tests.
Write boundaries: Scheduling metadata, publish job, review due calculation; no unrelated notification system unless required.
Acceptance criteria:

- [ ] Admin can schedule, cancel, and reschedule publish with clear timezone.
- [ ] Scheduled job revalidates publish gates before publishing.
- [ ] Publish creates revision/snapshot and updates sitemap/redirect behavior consistently.
- [ ] Dashboard shows scheduled and review-due states.
- [ ] Job failures are observable in admin logs or status fields.

Regression guards:

- Manual publish remains immediate.
- Draft content cannot leak publicly before scheduled time.

RGR:

- RED: Add time-controlled tests for schedule/cancel/reschedule and publish-gate failure.
- GREEN: Implement additive fields and scheduler/job path.
- REFACTOR: Share publish execution between manual and scheduled paths.

Gates:

- Repo gate: service/job tests, lint, typecheck, build.
- Browser gate: Schedule/cancel UI smoke; job behavior may use controlled service tests if real wait is impractical.
- Boundary/migration gate: Additive migration; no live scheduled publish without disposable content.

External docs needed: Vercel cron/job docs if using hosted scheduling.
Parallelization: W3-C; depends on S5; single-threaded for scheduler.
Worker role: scheduling worker.
Exit evidence: Time-controlled test output and UI proof.
Blocked on: scheduler mechanism choice if repo lacks established cron/job path.

### S9 - Add media defaults, proof images, and alt-text audit

Status: PENDING
Tier: T1
Type: behavior
Actor/trigger: Admin selects hero defaults, attaches proof images, or reviews media SEO completeness.
Behavior to test: When media is used in page-builder content, then default hero selection, proof/testimonial images, alt text, rights notes, and published output stay complete and auditable.
Invariant protected: Public images render with appropriate metadata and do not silently drop alt text.
Intentional behavior changes: Add universal/default hero image selection by page type/template, proof/testimonial media picker, thumbnails, and a complete alt-text/SEO-media audit.
Previous intended behaviors preserved: Existing media library upload/filter/select flows and image block rendering keep working.
Unsafe outcomes: Default hero image overrides block-specific image unexpectedly, proof images render without alt text, rights notes are ignored, or media picker becomes a technical asset-ID form.
Dependencies: S2.
Expected files: media library manager, proof library UI, block renderer/editor, media services/tests, SEO readiness checks.
Write boundaries: Media defaults/proof-image surfaces and alt metadata propagation.
Acceptance criteria:

- [ ] Media library can mark/select default hero images by page type/template.
- [ ] Hero blocks can use default images but allow explicit block override.
- [ ] Proof/testimonial create/edit forms include media picker and thumbnail display.
- [ ] Public render and preview carry correct alt text/captions/rights where applicable.
- [ ] SEO readiness flags missing media metadata.

Regression guards:

- Existing media filters and picker behavior still pass.
- Existing image block public render remains unchanged unless improved.

RGR:

- RED: Add tests for default/override resolution and proof asset rendering.
- GREEN: Implement picker/default/metadata propagation.
- REFACTOR: Centralize media metadata resolution for image, hero, proof, and OG surfaces.

Gates:

- Repo gate: service/render tests, lint, typecheck.
- Browser gate: Media library, builder media picker, proof item, preview/public image smoke.
- Boundary/migration gate: Additive fields only if needed.

External docs needed: `docs/design/page-builder-blocks.md`.
Parallelization: W3-D; depends on S2.
Worker role: media worker.
Exit evidence: Tests and browser/public render proof.
Blocked on: none.

### S10 - Fold blog authoring into builder with author profiles

Status: PENDING
Tier: T2
Type: integration
Actor/trigger: Admin chooses Blog page type or manages public author profiles.
Behavior to test: When an admin creates a Blog page, then the same builder is scoped to blog defaults, `/blog` routing, author profile selection, and blog SEO metadata.
Invariant protected: Existing news/blog admin behavior remains available or is migrated with clear compatibility; public routes do not conflict.
Intentional behavior changes: Merge blog creation into the page builder experience and add author profiles distinct from admin users where needed.
Previous intended behaviors preserved: Existing `/admin/news` content is not deleted or silently migrated without a migration plan.
Unsafe outcomes: Breaking current news routes, conflating admin access users with public authors, creating duplicate author schema, or publishing blog pages without valid author/structured data.
Dependencies: S2, S3.
Expected files: blog/news admin routes, page type/template services, author model/admin UI, public render/schema tests.
Write boundaries: Blog page-type integration and author profile management. Do not remove legacy blog/news until a separate migration/cutover node exists.
Acceptance criteria:

- [ ] Blog page type starts with blog-appropriate template/defaults.
- [ ] Author selection supports display name, bio, avatar, role/title, and structured-data/social fields as needed.
- [ ] Authors may differ from admin users.
- [ ] Existing news/blog paths remain safe during transition.
- [ ] AI assistant can build blog content from approved templates/sources.

Regression guards:

- Existing resource-page builder remains unaffected.
- Admin user management remains separate from public author profile management.

RGR:

- RED: Add tests for blog page creation, author selection, and route separation.
- GREEN: Implement blog type and author profile foundation.
- REFACTOR: Decide legacy news integration only after compatibility tests are explicit.

Gates:

- Repo gate: migration/service/render tests, lint, typecheck, build.
- Browser gate: Blog create/edit/preview/public smoke and author profile admin smoke.
- Boundary/migration gate: No destructive migration of existing news records without explicit approval.

External docs needed: local Next.js docs for route changes.
Parallelization: W4-A; depends on S2/S3.
Worker role: blog integration worker.
Exit evidence: Tests and browser route proof.
Blocked on: migration/cutover decision for existing `/admin/news` if implementation proposes removal or merge.

### S11 - Add controlled custom footer and form/embed blocks

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: Admin customizes page footer variant or adds a form/embed block.
Behavior to test: When an admin configures a page/footer variant or form/embed, then the output is controlled, validated, and does not change the global hard-coded footer everywhere.
Invariant protected: Public render remains secure, brand-controlled, and compatible with lead attribution.
Intentional behavior changes: Add custom footer variants based on the main footer, not universal footer overrides; add native form block or controlled provider embeds for third-party forms.
Previous intended behaviors preserved: Existing global footer/nav remains hard-coded and unaffected by page-level variants.
Unsafe outcomes: Arbitrary raw code injection, global footer mutation, provider embeds escaping sandbox, lead attribution loss, or footer variants hiding required legal/navigation content.
Dependencies: S2, S5.
Expected files: footer variant model/editor, public renderer, form/embed block schema/editor/renderers, validation tests.
Write boundaries: Footer variant and controlled form/embed block surfaces.
Acceptance criteria:

- [ ] Page-builder pages can select or configure a footer variant without editing the global footer.
- [ ] Variant can remove/adjust approved links/content within guardrails.
- [ ] Native form block or provider embed uses allowlisted/sandboxed configuration.
- [ ] Lead/form submissions preserve attribution fields.
- [ ] Public render and preview match.

Regression guards:

- Existing public footer remains unchanged outside builder pages.
- No arbitrary HTML input.

RGR:

- RED: Add validation/security tests for footer variants and embeds.
- GREEN: Implement controlled variant/block surfaces.
- REFACTOR: Reuse existing lead form attribution helpers.

Gates:

- Repo gate: schema/render/action tests, lint, typecheck, build.
- Browser gate: Editor, preview, public render, and form submission smoke with disposable data.
- Boundary/migration gate: Additive migration if storing variants/forms.

External docs needed: `docs/design/page-builder-blocks.md`.
Parallelization: W4-B; depends on S2/S5.
Worker role: public-render/security worker.
Exit evidence: Tests plus browser/public proof.
Blocked on: approved provider allowlist for embeds if third-party forms are included.

### S12 - Add governance history, comments, and collision protection

Status: PENDING
Tier: T2
Type: integration
Actor/trigger: Multiple admins review or edit the same page.
Behavior to test: When admins review or edit page content, then they can see attribution, leave non-public comments, and avoid silently overwriting newer changes.
Invariant protected: Revision history remains append-only and public pages never include internal comments.
Intentional behavior changes: Add visible actor names/emails, timestamps, revision type, publish notes, changed-field summaries, optional diff view, page/block comments, resolve/reopen, and optimistic concurrency warnings.
Previous intended behaviors preserved: Existing revisions, rollback, and publish notes keep working.
Unsafe outcomes: Comments publish publicly, conflict detection blocks legitimate autosave, private emails leak to public render, or revision diffs become inaccurate.
Dependencies: S6.
Expected files: revision panel, comments model/UI, editor controller autosave/concurrency, audit services/tests.
Write boundaries: Governance/audit/comment/collision surfaces only.
Acceptance criteria:

- [ ] Revision UI shows actor and meaningful action context.
- [ ] Internal page/block comments never render publicly.
- [ ] Comments support author/timestamp and resolve/reopen.
- [ ] Editor detects server version changes since load and warns before overwrite.
- [ ] User has clear choices: reload latest, save as new version, or compare where supported.

Regression guards:

- Existing autosave and restore-to-draft still work.
- Public preview/published render strips comments.

RGR:

- RED: Add tests for comments visibility and optimistic concurrency failure.
- GREEN: Implement comments/history/conflict warning.
- REFACTOR: Keep autosave controller complexity bounded by extracting conflict handling.

Gates:

- Repo gate: migration/service/controller tests, lint, typecheck.
- Browser gate: Two-session or simulated conflict smoke; comments save/reload/public-not-visible proof.
- Boundary/migration gate: Additive migration only.

External docs needed: none beyond admin/editor design docs.
Parallelization: W5-A; depends on S6.
Worker role: governance worker.
Exit evidence: Tests and browser/session conflict evidence.
Blocked on: none.

### S13 - Plan later analytics, webhooks, CSV import, and API access

Status: BLOCKED
Tier: T2
Type: decision-needed
Actor/trigger: Admin or external system needs experiments, imports, notifications, or API access.
Behavior to test: Decision node; no implementation until product targets are concrete.
Invariant protected: External contracts are not shipped before auth, audit, versioning, event definitions, and analytics are clear.
Intentional behavior changes: Later support for A/B testing, webhook subscriptions, CSV metadata import, and read-only or write API access.
Previous intended behaviors preserved: Existing public services remain internal until a deliberate API contract exists.
Unsafe outcomes: Shipping unauthenticated APIs, write APIs without audit/versioning, webhook secrets/logs mishandled, CSV import corrupting metadata, or experiments creating SEO/canonical issues.
Dependencies: S6, S7, S8.
Expected files: future decisions/plan only until blockers resolve.
Write boundaries: None until unblocked.
Acceptance criteria:

- [ ] Define experiment event model and conversion attribution.
- [ ] Define webhook events, subscribers, retries, signing, and delivery logs.
- [ ] Define CSV metadata import columns, validation, dry-run, rollback, and permissions.
- [ ] Define API consumers, auth, read/write scope, rate limits, audit, and versioning.

Regression guards:

- No external write surface without audit and rollback.
- No experiment variants without canonical/SEO guardrails.

RGR:

- RED: Capture missing decisions as failing acceptance checklist.
- GREEN: Resolve product/integration decisions.
- REFACTOR: Split into separate implementation graphs once decisions are concrete.

Gates:

- Repo gate: none until planned.
- Browser gate: none until planned.
- Boundary/migration gate: blocked until decisions are resolved.

External docs needed: future analytics/webhook/API provider docs.
Parallelization: W5-B after dependencies; currently blocked.
Worker role: product/architecture planner.
Exit evidence: Decisions document or follow-up graph.
Blocked on: concrete analytics targets, webhook consumers, CSV import scope, API consumer/auth model, and whether A/B testing is launch-critical.

## Dependency Waves

| Wave | Nodes          | Notes                                                                                                                 |
| ---- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| W0   | S0             | Verification before implementation.                                                                                   |
| W1   | S1, S2         | Small navigation improvement can run beside template/page-type foundation after S0.                                   |
| W2   | S3, S4, S5     | Route prefixes, content-library capture, and SEO governance can run in parallel only with migration coordination.     |
| W3   | S6, S7, S8, S9 | Dashboard, redirect manager, scheduling, and media improvements build on W2 outputs.                                  |
| W4   | S10, S11       | Blog/author and public-render block variants require the foundation and route model.                                  |
| W5   | S12, S13       | Collaboration/governance follows dashboard maturity; external contracts remain blocked until product decisions exist. |

## First Unblocked Wave

S0 is the first required wave. S1 and S2 are the first implementation candidates once S0 has evidence.
