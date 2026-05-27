# SEO Readiness Autopilot Thin Slice Plan

Status: READY
Last updated: 2026-05-06
Owner: Codex

## Working Brief

- Feature or fix: Build an evidence-backed SEO readiness and autopilot layer into the SEO Page Builder so non-technical marketing users can create, improve, internally link, audit, and publish resource pages without needing to understand the underlying SEO mechanics.
- Primary actors: Admin marketers editing pages, admin publish flow, public resource renderer, future AI proposal workflow, future Search Console/ranking import.
- Core invariant: A resource page must never be shown as SEO-ready or be published when hard technical/indexing/provenance failures are present; AI can suggest but cannot silently mutate content or publish.
- Previous intended behaviours: Draft editing, preview tokens, public rendering, sitemap inclusion rules, database-backed redirects, lead attribution, block validation, media metadata checks, FAQ schema, source-bound AI proposals, and immutable revisions must keep working.
- Unsafe outcomes: Fake single-number SEO score, keyword-stuffing incentives, hidden or misleading structured data, broken internal links, accidental noindex/sitemap conflicts, AI-invented claims, direct AI publishing, destructive revision changes, and live ranking claims before Search Console data exists.
- Current evidence: `docs/seo-page-builder/roadmap.md`; `src/lib/page-builder/blocks.ts`; `src/lib/page-builder/ai-proposals.ts`; `src/lib/services/seo-pages.ts`; `src/lib/services/seo-page-public.ts`; `src/components/admin/SeoPageEditorForm.tsx`; `src/components/sections/ResourcePageRenderer.tsx`; Supabase migrations for `seo_pages`, libraries, media, revisions, redirects, lead attribution, and AI proposals.
- Assumptions:
  - Hard technical blockers are non-overridable in v1.
  - Content quality warnings are visible but do not block publishing until we have evidence that a rule should be mandatory.
  - Automatic internal linking requires backward-compatible inline link support in rich text, not only CTA/card links.
  - Audit snapshots are structured JSON first; readable reports are rendered from the structured result.
  - Search Console and real ranking data are post-launch integrations, not pre-launch readiness signals.
- Out of scope:
  - Predicting Google rankings before launch.
  - Competitor scraping.
  - Broad AI content generation.
  - Drag/drop polish beyond the current editor.
  - Replacing source-bound AI approval with freeform prompt output.
  - Static `next.config.ts` redirects for builder pages.

## Product Decisions Taken

| Decision                 | Default                                              | Reason                                                          | Can revisit?                                       |
| ------------------------ | ---------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| Publish blockers         | Non-overridable for hard technical failures          | Prevents knowingly shipping unindexable or broken pages         | Yes, with explicit admin override/audit-log design |
| Marketing-quality issues | Warning/opportunity first                            | Avoids blocking useful pages because of subjective scoring      | Yes, once real performance data exists             |
| Score model              | Category ratings plus evidence, not one opaque score | Marketers need simple status, engineers need proof              | Yes, weighting can evolve                          |
| Internal links           | Body-copy inline links are required                  | CTA/card links alone are not enough for real internal-link SEO  | No, unless product accepts weaker SEO              |
| AI role                  | Proposal-only and source-bound                       | Matches existing roadmap constraints and avoids compliance risk | No for launch-critical path                        |
| Ranking data             | Post-launch only                                     | Pre-launch readiness is measurable; ranking is not              | No                                                 |

## Risk Classification

- Overall tier: T2
- Why: The work changes admin workflows, publish gating, structured content contracts, internal link generation, and may add non-destructive audit storage. It does not handle money, customer ownership, or destructive live-data operations.
- Live-data risk: Medium. Existing published resource pages and revisions must remain renderable after rich-text schema evolution.
- Migration risk: Low to medium. Audit snapshots need a new append-only table; rich-text link support should not require backfilling JSON if implemented with backward-compatible schemas.
- External-contract risk: Medium later. Search Console/ranking integration is intentionally blocked until launch and credentials/property decisions exist.

## Dependency Graph

| Node                                | Depends on         | Parallel?     | Shared-state risk | Notes                                                       |
| ----------------------------------- | ------------------ | ------------- | ----------------- | ----------------------------------------------------------- |
| S1 Readiness contract               | None               | No            | Low               | Establishes the shared findings/ratings model.              |
| S2 Editor inspector v1              | S1                 | No            | Medium            | Touches the already-active visual editor.                   |
| S3 Publish gate convergence         | S1                 | No            | Medium            | Server-side enforcement must match inspector hard blockers. |
| S4 Rich-text inline links           | S1                 | No            | High              | Shared content contract, renderer, and editor behaviour.    |
| S5 Internal page index              | S1                 | Yes, after S1 | Low               | Service can be built independently of UI.                   |
| S6 Link suggestion engine           | S4, S5             | No            | Medium            | Needs linkable body content and page index.                 |
| S7 One-click link application       | S6                 | No            | Medium            | User-facing editor mutation path.                           |
| S8 Audit snapshots and diffs        | S1, S3             | No            | High              | Adds migration and append-only audit records.               |
| S9 AI semantic recommendations      | S6, S8             | Yes, after S8 | Medium            | Extends existing source-bound AI proposal model.            |
| S10 Search Console and live ranking | Launch, GSC access | No            | High              | Blocked until site is live and verified.                    |

## Progress

| Slice | Status  | Tier | Owner        | Evidence                                                                                     | Next gate                                          |
| ----- | ------- | ---- | ------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| S1    | done    | T2   | Codex        | `npm test -- src/lib/page-builder/seo-readiness.test.ts`; full checks passed                 | S2 editor inspector.                               |
| S2    | done    | T3   | Codex        | browser verified editor panel, drawer, disabled publish, no fresh console errors             | S3 publish convergence.                            |
| S3    | done    | T2   | Codex/manual | `npm test -- src/lib/services/seo-pages.test.ts`; full checks passed                         | S4 rich-text inline links.                         |
| S4    | done    | T2   | Codex/manual | `npm test -- src/lib/page-builder/blocks.test.ts src/lib/page-builder/seo-readiness.test.ts` | S5 internal page index.                            |
| S5    | done    | T2   | Codex        | `npm test -- src/lib/services/seo-internal-link-index.test.ts`                               | S6 deterministic link suggestions.                 |
| S6    | done    | T2   | Codex        | `npm test -- src/lib/page-builder/internal-link-suggestions.test.ts`                         | S7 one-click application.                          |
| S7    | done    | T3   | Codex/manual | helper tests, editor UI wiring, browser smoke, full checks passed                            | S8 audit snapshots and diffs.                      |
| S8    | pending | T2   | Codex/manual | none                                                                                         | Audit snapshot diff proves fixed/new issues.       |
| S9    | pending | T2   | Codex/manual | none                                                                                         | AI output remains source-bound and approval-only.  |
| S10   | blocked | T2   | Codex/manual | none                                                                                         | Requires launched site plus Search Console access. |

Allowed statuses: `pending`, `in_progress`, `blocked`, `done`, `skipped`.

## Slices

### S1 - SEO Readiness Contract And Pure Inspector

Status: done
Tier: T2
Type: backend
Actor/trigger: Editor autosave, manual publish validation, later audit runner.
Action: Compute category findings and a readiness summary from page metadata, draft content, known routes, media hints, and optional internal-link index.
Invariant protected: Readiness output is evidence-backed and deterministic; it must not claim ranking performance.
Intentional behaviour changes: None at runtime yet. Adds a reusable contract.
Previous intended behaviours preserved: Existing `validatePageForPublish` behaviour and block schemas remain valid.
Unsafe outcomes: Duplicated validation that disagrees with publish, opaque scoring, keyword-stuffing incentives.
Dependencies: None.
Expected files:

- `src/lib/page-builder/seo-readiness.ts`
- `src/lib/page-builder/seo-readiness.test.ts`
- `src/lib/page-builder/blocks.ts` only if existing private helpers need to be exported.
  Write boundaries:
- Add the new readiness module and focused tests.
- Avoid editor UI, service behaviour, migrations, and package changes.
  Tests required:
- Technical blockers: missing title/SEO title/meta, invalid slug, noindex plus sitemap, invalid canonical.
- Content blockers/warnings: no CTA/lead path, missing image alt, thin body, missing target keyword alignment warning, unsupported claim warning placeholder.
- Link blockers: broken internal links are hard findings.
- Structured data warning: FAQ schema only valid when visible FAQ exists.
  Runtime verification: Not required in S1; pure unit tests are enough.
  Migration/backfill notes: None.
  External docs needed: Google Search Central SEO starter guide, title link guidance, structured data guidelines, canonicalization guidance.
  Acceptance criteria:
- A single function returns category-level `blockers`, `warnings`, `opportunities`, `evidence`, and overall status.
- Every hard blocker maps to a stable code suitable for UI and publish enforcement.
- Tests prove no ranking/performance claims are made.
  Exit evidence:
- `npm test -- src/lib/page-builder/seo-readiness.test.ts` passed with 5 tests.
- Full `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` passed after S1-S3.
  Parallelization: Blocking foundation; do first.
  Blocked on: None.

#### AgentTaskContract

Eligible: yes
Current adapter: deepseek-agent
Model route: `deepseek-v4-flash:5` with GPT-5.5 consolidator if candidate outputs disagree.
Model/effort: deepseek-v4-flash / high
Model routing reason: Pure deterministic function plus tests, no migration or external calls.
Candidate strategy: tournament deepseek-v4-flash:5 -> gpt-5.5-medium consolidator
Read scope:

- `src/lib/page-builder/blocks.ts`
- `src/lib/page-builder/blocks.test.ts`
- `docs/seo-page-builder/roadmap.md`
  Allowed writes:
- `src/lib/page-builder/seo-readiness.ts`
- `src/lib/page-builder/seo-readiness.test.ts`
- `src/lib/page-builder/blocks.ts` only for exported helper reuse.
  Must not touch:
- Migrations, generated database types, editor UI, server actions, public renderer, package files.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Draft missing SEO title | Hard blocker code exists | yes | Unit test |
  | `noindex=true` and `sitemapEnabled=true` | Hard blocker code exists | yes | Unit test |
  | Valid publishable page | No hard blockers, ready/strong status possible | yes | Unit test |
  | Keyword absent from visible content | Warning or opportunity, not blocker | yes | Unit test |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Optional metadata | omitted, empty string, null, valid string | yes |
  | Content tree | empty, invalid shape, valid rich page | yes |
  | Link hrefs | approved internal, unknown internal, external http(s), unsafe | yes |
  | Property presence | absent property vs own property with `undefined` | yes |
- Previous-behavior preservation:
  - Existing `validatePageForPublish` tests still pass.
- Parent hidden/strong validator:
  - Parent compares hard blocker codes against current publish-validation issue categories.
    Agent task prompt:

```text
Implement a pure SEO readiness contract for the SEO Page Builder. Add `src/lib/page-builder/seo-readiness.ts` and focused tests. Do not change runtime publish behaviour or UI. The output must be deterministic, category based, evidence backed, and must not claim live ranking. Preserve all existing block validation tests.
```

Acceptance commands:

- `npm test -- src/lib/page-builder/seo-readiness.test.ts`
- `npm run typecheck`
  Parent verification:
- `npm test -- src/lib/page-builder/blocks.test.ts src/lib/page-builder/seo-readiness.test.ts`
- `npm run lint`
  Failure policy:
- Stop if a required change needs migrations, package changes, or editor/server rewrites.

### S2 - Editor SEO Inspector V1

Status: done
Tier: T3
Type: frontend
Actor/trigger: Admin marketer editing a draft.
Action: Show a simple readiness panel/drawer that updates from local draft state and displays blockers, warnings, opportunities, and evidence.
Invariant protected: The editor must stay visual/page-like; SEO controls remain secondary and understandable.
Intentional behaviour changes: Adds visible readiness state and client-side publish disabled state for hard blockers.
Previous intended behaviours preserved: Save, autosave, existing SEO settings drawer, block editing, drag/drop, and hidden form fields.
Unsafe outcomes: Turning the editor back into a technical checklist, hiding evidence behind an unexplained score, blocking draft save.
Dependencies: S1.
Expected files:

- `src/components/admin/SeoPageEditorForm.tsx`
  Write boundaries:
- UI integration only; no schema/service/migration changes.
  Tests required:
- Existing typecheck and lint.
- If practical, add a small component/pure helper test only if the repo already has a pattern for this component.
  Runtime verification:
- Browser open `/admin/pages/new`.
- Confirm readiness status changes when title/meta/CTA/image alt fields change.
- Confirm draft save still works.
  Migration/backfill notes: None.
  External docs needed: None.
  Acceptance criteria:
- Marketer sees `Blocked`, `Needs work`, `Strong`, or `Opportunities` without leaving the canvas.
- Hard blockers are written in plain language with exact affected field/block evidence.
- SEO settings can still live in a drawer; readiness is visible enough to guide building.
  Exit evidence:
- `SeoPageEditorForm` computes `assessSeoReadiness` from live draft state.
- Browser verified the readiness strip, SEO drawer detail panel, live blocker counts, and disabled Publish state.
- No fresh browser console errors after reload.
- Full `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` passed after S1-S3.
  Parallelization: Can be implemented after S1; not parallel with other editor slices.
  Blocked on: S1.

#### AgentTaskContract

Eligible: yes, with parent visual verification.
Current adapter: deepseek-agent
Model route: `deepseek-v4-flash:3` with GPT-5.5 parent review.
Model/effort: deepseek-v4-flash / high
Model routing reason: Narrow UI integration around an existing pure helper.
Candidate strategy: tournament deepseek-v4-flash:3 -> gpt-5.5-medium consolidator
Read scope:

- `src/components/admin/SeoPageEditorForm.tsx`
- `src/lib/page-builder/seo-readiness.ts`
  Allowed writes:
- `src/components/admin/SeoPageEditorForm.tsx`
  Must not touch:
- Services, migrations, renderer, package files, unrelated admin components.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Draft has hard blockers | Inspector shows `Blocked`; publish button disabled client-side | yes | Browser |
  | Draft warnings only | Inspector shows warning/opportunity, publish available client-side | yes | Browser |
  | SEO drawer opens | Existing metadata fields still work | yes | Browser |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | New page without ID | Save draft possible, publish unavailable | yes |
  | Existing page | Autosave continues | yes |
  | Empty content | Inspector does not crash | yes |
- Previous-behavior preservation:
  - Existing page editor form submits the same hidden fields.
- Parent hidden/strong validator:
  - Browser console must have no new errors after reload.
    Agent task prompt:

```text
Integrate the SEO readiness summary into the existing visual page editor. Keep the editor page-like. Show concise category status and evidence, and disable publish client-side only when hard blockers exist. Do not change server actions or schemas.
```

Acceptance commands:

- `npm run typecheck`
- `npm run lint`
  Parent verification:
- Browser verification in the in-app browser.
  Failure policy:
- Stop if the UI change requires changing the content schema or server publish behaviour.

### S3 - Server Publish Gate Convergence

Status: done
Tier: T2
Type: backend
Actor/trigger: Admin clicks Publish.
Action: Enforce the same hard SEO blockers server-side that the editor inspector shows.
Invariant protected: Client-side readiness can never be the only publish guard.
Intentional behaviour changes: Publish returns stable, human-readable SEO blocker messages for the readiness contract.
Previous intended behaviours preserved: Existing validation for block tree, media rights, redirect conflict, revisions, published snapshots, sitemap, and redirects.
Unsafe outcomes: UI says blocked but server publishes, or UI says ready but server rejects for unrelated duplicated logic.
Dependencies: S1.
Expected files:

- `src/lib/services/seo-pages.ts`
- `src/lib/services/seo-pages.test.ts`
- `src/lib/page-builder/blocks.ts` only if validation is deduplicated there.
- `src/lib/page-builder/seo-readiness.ts`
  Write boundaries:
- Server publish validation only.
  Tests required:
- Publish rejects hard readiness blockers.
- Existing publish cases still pass.
- Error issue codes are stable and map to UI.
  Runtime verification:
- Browser publish a blocked draft and confirm useful message.
- Publish a valid draft and confirm public render still works.
  Migration/backfill notes: None.
  External docs needed: None.
  Acceptance criteria:
- Server publish cannot bypass hard readiness blockers.
- Existing tests for publish, revisions, media, redirects, and sitemap pass.
  Exit evidence:
- `adminPublishSeoPage` now derives hard publish issues from `assessSeoReadiness`.
- `npm test -- src/lib/services/seo-pages.test.ts` passed with 12 tests.
- Full `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` passed.
- Browser verified client-side hard blockers keep Publish disabled on a new draft, with no fresh console errors after reload.
  Parallelization: Single-threaded because it changes publish semantics.
  Blocked on: S1.

#### AgentTaskContract

Eligible: no - publish state transition and shared validation semantics require stronger parent judgment.
Current adapter: stronger-model/manual
Model route: GPT-5.5 manual implementation.
Model/effort: gpt-5.5 / high
Model routing reason: Server publish gate is customer-visible state transition logic.
Candidate strategy: not-cheap-agent

### S4 - Backward-Compatible Rich Text Inline Links

Status: done
Tier: T2
Type: schema/frontend/backend
Actor/trigger: Admin accepts or edits a link inside body copy.
Action: Extend the rich-text document model so paragraphs can represent inline links while legacy string paragraphs continue to parse and render.
Invariant protected: Existing published and draft content must render exactly as before unless links are explicitly added.
Intentional behaviour changes: Rich-text paragraphs can contain linked spans for internal links.
Previous intended behaviours preserved: Existing `paragraph.text`, headings, lists, public renderer, editor text entry, and validation.
Unsafe outcomes: Breaking existing JSON drafts, losing text during autosave, link spans with unsafe hrefs, editor corruption when marketers edit linked text.
Dependencies: S1.
Expected files:

- `src/lib/page-builder/blocks.ts`
- `src/lib/page-builder/blocks.test.ts`
- `src/lib/page-builder/content-ops.ts`
- `src/lib/page-builder/content-ops.test.ts`
- `src/components/sections/ResourcePageRenderer.tsx`
- `src/components/admin/SeoPageEditorForm.tsx`
  Write boundaries:
- Rich-text schema, compatibility helpers, renderer, and narrow editor controls.
  Tests required:
- Legacy paragraph `{ type: "paragraph", text: "..." }` still parses.
- New linked-span paragraph parses.
- Unsafe internal/external hrefs fail.
- Renderer outputs real anchors for linked spans.
- Editor can preserve legacy text without converting unless needed.
  Runtime verification:
- Browser create a page with a body link, preview, publish, reload.
  Migration/backfill notes:
- No data backfill in v1. Schema must accept legacy shape.
- If a future cleanup migration normalizes old paragraphs, it must be separate.
  External docs needed: None.
  Acceptance criteria:
- Automatic internal linking has a valid content target.
- Existing demo pages still render.
  Exit evidence:
- `npm test -- src/lib/page-builder/blocks.test.ts src/lib/page-builder/seo-readiness.test.ts` passed.
- Existing rich-text paragraphs remain valid.
- Linked rich-text paragraphs with safe hrefs validate.
- Unsafe hrefs fail schema validation.
- Unknown internal links inside rich-text spans block publish.
  Parallelization: Single-threaded; shared content contract.
  Blocked on: S1.

#### AgentTaskContract

Eligible: no - shared JSON content contract plus editor and renderer coupling.
Current adapter: stronger-model/manual
Model route: GPT-5.5 manual implementation.
Model/effort: gpt-5.5 / high
Model routing reason: Backward compatibility and content-preservation risk are too high for a cheap agent.
Candidate strategy: not-cheap-agent

### S5 - Internal Page Index Service

Status: done
Tier: T2
Type: backend
Actor/trigger: Editor loads an existing draft, audit runner runs, or internal-link suggestion engine asks for candidates.
Action: Build a safe index of published internal pages and approved static routes with title, slug/path, target keyword, headings, summary, and current outgoing links.
Invariant protected: Suggestions only point to approved internal destinations and never to drafts, previews, archived pages, or noindex resources unless explicitly allowed.
Intentional behaviour changes: Adds an internal-link candidate source; no UI yet.
Previous intended behaviours preserved: Public page fetching, sitemap filtering, draft visibility, archive behaviour.
Unsafe outcomes: Suggesting draft/preview links, self-links, noindex pages, broken paths, or links to redirects as primary targets.
Dependencies: S1.
Expected files:

- `src/lib/services/seo-internal-link-index.ts`
- `src/lib/services/seo-internal-link-index.test.ts`
- `src/lib/services/seo-page-public.ts` only if a shared selector/helper is needed.
  Write boundaries:
- New service and tests.
  Tests required:
- Published indexable pages included.
- Draft, archived, preview, noindex, and sitemap-disabled pages excluded by default.
- Current page excluded when page ID/path is supplied.
- Existing outgoing links extracted.
  Runtime verification: Not required; service tests enough.
  Migration/backfill notes: None.
  External docs needed: None.
  Acceptance criteria:
- Returns deterministic linkable targets for suggestion engine.
- Does not expose unpublished content.
  Exit evidence:
- `npm test -- src/lib/services/seo-internal-link-index.test.ts` passed.
- Query filters published, `noindex = false`, and `sitemap_enabled = true`.
- Current page can be excluded.
- Invalid published content is skipped.
  Parallelization: Parallel-safe after S1 if S4 is handled separately.
  Blocked on: S1.

#### AgentTaskContract

Eligible: yes
Current adapter: deepseek-agent
Model route: `deepseek-v4-flash:5` with GPT-5.5 consolidator.
Model/effort: deepseek-v4-flash / high
Model routing reason: Bounded service/helper plus tests.
Candidate strategy: tournament deepseek-v4-flash:5 -> gpt-5.5-medium consolidator
Read scope:

- `src/lib/services/seo-page-public.ts`
- `src/lib/services/seo-pages.ts`
- `src/lib/page-builder/blocks.ts`
- `src/lib/services/seo-page-public.test.ts`
  Allowed writes:
- `src/lib/services/seo-internal-link-index.ts`
- `src/lib/services/seo-internal-link-index.test.ts`
- `src/lib/services/seo-page-public.ts` only for shared selector export if necessary.
  Must not touch:
- Migrations, editor UI, publish service, generated database types.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Published indexable resource | Included as target | yes | Unit test |
  | Draft/preview/archived/noindex | Excluded | yes | Unit test |
  | Current page ID supplied | Excluded from candidates | yes | Unit test |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Page status | draft, published, archived | yes |
  | Index settings | noindex true/false, sitemap true/false | yes |
  | Missing content | null/invalid/valid | yes |
- Previous-behavior preservation:
  - Existing public page service tests pass.
- Parent hidden/strong validator:
  - Parent checks no unpublished statuses are returned.
    Agent task prompt:

```text
Add a backend internal-link index service for published SEO resource pages. It must exclude drafts, previews, archived pages, noindex pages, sitemap-disabled pages by default, and the current page. Include focused tests with a fake Supabase client. Do not add UI or migrations.
```

Acceptance commands:

- `npm test -- src/lib/services/seo-internal-link-index.test.ts`
- `npm run typecheck`
  Parent verification:
- `npm test -- src/lib/services/seo-page-public.test.ts src/lib/services/seo-internal-link-index.test.ts`
  Failure policy:
- Stop if a migration or generated type update appears necessary.

### S6 - Deterministic Internal Link Suggestions

Status: done
Tier: T2
Type: backend
Actor/trigger: Editor readiness inspector or audit runner requests link opportunities.
Action: Suggest specific internal links with target URL, anchor text, insertion target, reason, confidence, and dedupe logic.
Invariant protected: Suggestions help users and search engines without encouraging keyword stuffing or irrelevant links.
Intentional behaviour changes: Adds suggestions only; does not mutate content.
Previous intended behaviours preserved: Existing links remain unchanged unless admin accepts a later suggestion.
Unsafe outcomes: Repeated exact-match anchors, irrelevant links, linking to self, suggesting already-linked destinations, too many links in one block.
Dependencies: S4, S5.
Expected files:

- `src/lib/page-builder/internal-link-suggestions.ts`
- `src/lib/page-builder/internal-link-suggestions.test.ts`
- `src/lib/page-builder/seo-readiness.ts` only if suggestions are surfaced through readiness output.
  Write boundaries:
- Pure suggestion engine and tests.
  Tests required:
- No self-link suggestions.
- No duplicate destination suggestions when already linked.
- Anchor text comes from visible text or approved target metadata.
- Max suggestions per page/block enforced.
- Confidence/reason evidence is deterministic.
  Runtime verification: Not required in S6; no UI.
  Migration/backfill notes: None.
  External docs needed: Google guidance on internal links and anchor text.
  Acceptance criteria:
- Engine returns useful suggestions without changing content.
- Suggestions are explainable to marketers.
  Exit evidence:
- `npm test -- src/lib/page-builder/internal-link-suggestions.test.ts` passed.
- Suggestions skip self-links and already-linked destinations.
- Suggestions only use visible anchor text from the current draft and approved target metadata.
- Suggestions are capped and deterministically ordered.
  Parallelization: Parallel-safe after S4/S5.
  Blocked on: S4, S5.

#### AgentTaskContract

Eligible: yes
Current adapter: deepseek-agent
Model route: `deepseek-v4-flash:5` with GPT-5.5 consolidator.
Model/effort: deepseek-v4-flash / high
Model routing reason: Pure deterministic suggestion engine with clear edge cases.
Candidate strategy: tournament deepseek-v4-flash:5 -> gpt-5.5-medium consolidator
Read scope:

- `src/lib/page-builder/seo-readiness.ts`
- `src/lib/page-builder/blocks.ts`
- `src/lib/services/seo-internal-link-index.ts`
  Allowed writes:
- `src/lib/page-builder/internal-link-suggestions.ts`
- `src/lib/page-builder/internal-link-suggestions.test.ts`
- `src/lib/page-builder/seo-readiness.ts` only to attach suggestion summaries if needed.
  Must not touch:
- Editor UI, services, migrations, renderer, package files.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Candidate shares keyword/topic with paragraph | Suggest one link with reason | yes | Unit test |
  | Candidate already linked | No duplicate suggestion | yes | Unit test |
  | Candidate equals current page | No suggestion | yes | Unit test |
  | Many possible links | Max limit and stable ordering | yes | Unit test |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Anchor candidates | exact phrase, partial phrase, fallback title | yes |
  | Existing links | none, same href, same slug via canonical path | yes |
  | Target quality | missing keyword, missing summary, noindex excluded upstream | yes |
- Previous-behavior preservation:
  - Readiness tests still pass.
- Parent hidden/strong validator:
  - Parent inspects suggestions for keyword-stuffing incentives.
    Agent task prompt:

```text
Add a pure deterministic internal-link suggestion engine. It should consume current page content plus approved internal-link targets and return explainable, deduped suggestions. It must not mutate content or suggest self-links, duplicate links, drafts, or unsafe hrefs.
```

Acceptance commands:

- `npm test -- src/lib/page-builder/internal-link-suggestions.test.ts`
- `npm run typecheck`
  Parent verification:
- `npm test -- src/lib/page-builder/seo-readiness.test.ts src/lib/page-builder/internal-link-suggestions.test.ts`
  Failure policy:
- Stop if inline link schema support is missing or ambiguous.

### S7 - One-Click Internal Link Application In Editor

Status: done
Tier: T3
Type: frontend
Actor/trigger: Admin marketer accepts an internal-link suggestion.
Action: Apply a suggested link to the intended rich-text span, or show a safe fallback if the text has changed.
Invariant protected: Suggestions never silently rewrite unrelated copy.
Intentional behaviour changes: Admin can accept, dismiss, or ignore link suggestions in the visual editor.
Previous intended behaviours preserved: Draft autosave, manual editing, drag/drop, preview, publish.
Unsafe outcomes: Inserting links into stale text, corrupting rich-text JSON, making hidden changes, adding too many links automatically.
Dependencies: S6.
Expected files:

- `src/app/admin/pages/[id]/page.tsx`
- `src/app/admin/pages/new/page.tsx` if new-page index is needed.
- `src/app/admin/pages/actions.ts` if server action fetch/apply support is needed.
- `src/components/admin/SeoPageEditorForm.tsx`
- `src/lib/page-builder/internal-link-suggestions.ts`
  Write boundaries:
- Editor suggestion UI and apply/dismiss behaviour.
  Tests required:
- Pure apply helper test if link insertion logic is non-trivial.
- Existing editor build/type/lint.
  Runtime verification:
- Browser edit a draft, accept a suggested internal link, autosave, reload, preview, publish, public render.
  Migration/backfill notes: None.
  External docs needed: None.
  Acceptance criteria:
- Marketer can add a suggested link with one click.
- The UI explains why the link is suggested.
- Changed/stale text produces a clear "review manually" state, not a bad mutation.
  Exit evidence:
- `applyInternalLinkSuggestion` is covered in `src/lib/page-builder/internal-link-suggestions.test.ts`.
- Editor receives approved internal link targets from admin page routes.
- Editor shows available suggestions and applies a selected suggestion into the draft content state.
- Browser smoke verified `/admin/pages/new` still renders with SEO readiness and no fresh console errors.
- Full `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` passed.
  Parallelization: Single-threaded; editor mutation path.
  Blocked on: S6.

#### AgentTaskContract

Eligible: no - editor mutation path plus stale text handling needs stronger judgment.
Current adapter: stronger-model/manual
Model route: GPT-5.5 manual implementation.
Model/effort: gpt-5.5 / high
Model routing reason: User-facing content mutation in a dirty editor surface.
Candidate strategy: not-cheap-agent

### S8 - SEO Audit Snapshots And Diffs

Status: pending
Tier: T2
Type: schema/backend/frontend
Actor/trigger: Admin manually runs audit; publish flow stores audit evidence; later background job can refresh.
Action: Persist structured audit snapshots keyed by page, content hash, readiness version, and rendered-path evidence; compare current run to previous run.
Invariant protected: Audit history is append-only evidence, not mutable marketing copy.
Intentional behaviour changes: Admin can see fixed/new/regressed findings over time.
Previous intended behaviours preserved: Page revisions remain immutable; audit snapshots do not replace revisions.
Unsafe outcomes: Treating audit snapshots as revisions, deleting evidence, rerunning AI as a whole-page rewrite, storing secret data, blocking publish on stale snapshot instead of current content.
Dependencies: S1, S3.
Expected files:

- `supabase/migrations/YYYYMMDDHHMMSS_seo_page_audit_snapshots.sql`
- `src/types/database.ts` after type generation if migration is applied.
- `src/lib/services/seo-page-audits.ts`
- `src/lib/services/seo-page-audits.test.ts`
- `src/app/admin/pages/actions.ts`
- `src/components/admin/SeoPageEditorForm.tsx` or a dedicated audit panel component.
  Write boundaries:
- Non-destructive migration plus audit service/UI.
  Tests required:
- Insert snapshot.
- Diff previous/current findings.
- Same content hash can reuse or show no-change state.
- Draft and publish snapshots remain distinguishable.
  Runtime verification:
- Run audit on draft, change content, rerun, confirm diff shows fixed/new issues.
  Migration/backfill notes:
- Non-destructive append-only table.
- RLS admin-only.
- No deletion path in v1.
  External docs needed: Supabase migration/RLS patterns from existing repo; no Next API changes unless route behaviour changes.
  Acceptance criteria:
- Audit results can be compared without reinterpreting old content.
- Marketers see "fixed", "new", and "still open" findings.
  Exit evidence:
- Migration lint if migration changed.
- Service tests.
- Browser audit run and diff.
  Parallelization: Single-threaded because of migration/shared generated types.
  Blocked on: S1, S3.

#### AgentTaskContract

Eligible: no - migration and generated database types are shared state.
Current adapter: stronger-model/manual
Model route: GPT-5.5 manual implementation.
Model/effort: gpt-5.5 / high
Model routing reason: Schema, RLS, generated types, and audit semantics require parent coordination.
Candidate strategy: not-cheap-agent

### S9 - Source-Bound AI Semantic Recommendations

Status: pending
Tier: T2
Type: integration
Actor/trigger: Admin requests semantic SEO recommendations after deterministic readiness and internal-link engine exist.
Action: Extend the existing AI proposal model to recommend missing subtopics, FAQs, metadata rewrites, source-backed claim improvements, and internal-link candidates with source IDs or approved claim IDs.
Invariant protected: AI output remains proposal data and cannot publish, overwrite published content, mutate libraries, or insert unsupported claims.
Intentional behaviour changes: Adds semantic recommendations on top of deterministic findings.
Previous intended behaviours preserved: Existing AI proposal validation, warning schema, admin acceptance, source-bound contract.
Unsafe outcomes: Prompt-only enforcement, unsupported claims becoming draft content, AI-generated hidden schema, whole-page rewrite without admin selection.
Dependencies: S6, S8.
Expected files:

- `src/lib/page-builder/ai-proposals.ts`
- `src/lib/services/ai-page-proposals.ts`
- `src/lib/services/ai-page-proposals.test.ts`
- Admin proposal UI files only after backend contract is proven.
  Write boundaries:
- Proposal schema/service first; UI second.
  Tests required:
- Unsupported claim warning remains non-insertable.
- Internal-link recommendations include source/target evidence.
- Accepted suggestions validate through normal block/content schemas.
  Runtime verification:
- Admin generates or loads a proposal, accepts selected suggestions, confirms draft changes only after approval.
  Migration/backfill notes:
- Existing `ai_page_proposals` may already store proposal JSON. Add migration only if indexed audit/proposal linkage is required.
  External docs needed:
- Current AI provider SDK docs if a live provider call is added. Do not assume provider API shape from memory.
  Acceptance criteria:
- AI improves the readiness workflow without bypassing deterministic blockers.
  Exit evidence:
- Proposal tests.
- Browser approval flow.
  Parallelization: Can be planned while S8 is in progress, but implementation should wait until deterministic path is trusted.
  Blocked on: S6, S8.

#### AgentTaskContract

Eligible: no - AI/source contract and proposal acceptance are compliance-sensitive.
Current adapter: stronger-model/manual
Model route: GPT-5.5 manual implementation.
Model/effort: gpt-5.5 / high
Model routing reason: Source-bound AI contract and admin approval semantics are high risk.
Candidate strategy: not-cheap-agent

### S10 - Search Console And Live Ranking Feedback

Status: blocked
Tier: T2
Type: integration
Actor/trigger: Post-launch scheduled import or admin manual refresh.
Action: Import Search Console page/query/indexing performance and compare it to stored audit snapshots.
Invariant protected: Live performance data informs decisions but does not rewrite content automatically.
Intentional behaviour changes: Adds real-world feedback after launch.
Previous intended behaviours preserved: Pre-launch readiness remains deterministic and available without GSC.
Unsafe outcomes: Presenting rank as real before data exists, OAuth scope mistakes, pulling wrong property, confusing impressions/clicks with readiness.
Dependencies: Public launch, verified Search Console property, integration decision, S8.
Expected files:

- TBD after provider/auth decision.
  Write boundaries:
- Blocked until credentials/property/scope decisions exist.
  Tests required:
- Mock import parser.
- Property mismatch rejection.
- Diff report with real query data attached to correct page.
  Runtime verification:
- Manual import against verified property after launch.
  Migration/backfill notes:
- Likely separate table for external performance snapshots; do not overload readiness audit snapshots.
  External docs needed:
- Current Google Search Console API docs and auth setup.
  Acceptance criteria:
- Actual page/query performance appears beside audit history.
  Exit evidence:
- Verified import from correct property.
  Parallelization: Not available before launch.
  Blocked on:
- Production launch/cutover.
- Search Console property access and OAuth/service-account decision.

#### AgentTaskContract

Eligible: no - blocked external integration and live-data scope.
Current adapter: not-cheap-agent
Model route: not-cheap-agent
Model/effort: not-cheap-agent
Model routing reason: Requires product/ops credentials and external API current docs.
Candidate strategy: not-cheap-agent

## Verification Gates

- Automated checks:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
  - Focused Prettier check for edited files.
- Migration checks:
  - `supabase db lint --linked` only when migrations changed.
  - Generated database types must match applied migrations when type generation is required.
- Runtime checks:
  - In-app browser editor load.
  - New draft readiness changes live.
  - Hard blocker prevents publish.
  - Valid page publishes.
  - Preview token renders draft.
  - Published `/resources/[slug]` renders.
  - Sitemap includes only published, indexable resources.
  - Internal links render as anchors and survive reload.
  - Redirects from slug changes remain database-backed.
- Security/auth checks:
  - Admin-only audit/link suggestion actions.
  - No draft/preview/archived/noindex pages returned by internal-link index.
  - AI proposals remain admin-approved and source-bound.
- Observability/audit checks:
  - Audit snapshots are append-only.
  - Diffs show fixed/new/still-open findings.
  - No immutable page revision deletion.

## Subagent Plan

| Agent | Role                       | Slice(s) | Model/reasoning             | Read scope    | Write scope                  | Must not touch                  | Evidence required                                   |
| ----- | -------------------------- | -------- | --------------------------- | ------------- | ---------------------------- | ------------------------------- | --------------------------------------------------- |
| A1    | Pure validator writer      | S1       | deepseek-agent via contract | S1 read scope | S1 allowed writes            | UI, services, migrations        | focused tests plus parent validation                |
| A2    | UI integrator              | S2       | deepseek-agent via contract | S2 read scope | `SeoPageEditorForm.tsx` only | server actions, schemas         | typecheck/lint plus browser parent check            |
| A3    | Internal page index writer | S5       | deepseek-agent via contract | S5 read scope | S5 allowed writes            | migrations, UI, publish service | service tests plus parent unpublished-content check |
| A4    | Suggestion engine writer   | S6       | deepseek-agent via contract | S6 read scope | S6 allowed writes            | UI, migrations, renderer        | suggestion tests plus parent spam/duplicate review  |

Manual/stronger-model ownership:

- S3 publish gate convergence.
- S4 rich-text link content contract.
- S7 one-click editor mutation.
- S8 migration and audit snapshots.
- S9 AI proposal contract.
- S10 Search Console integration.

## Update Rules

- Move only one shared-state slice to `in_progress` at a time.
- Mark `done` only after exit evidence is recorded.
- Mark `blocked` with exact blocker and owner.
- Add newly discovered prerequisites as new slices; do not silently expand the active slice.
- Keep AI/ranking work behind deterministic readiness and internal-link foundations.
- Do not stage or commit unrelated existing dirty docs or `.agents` changes when executing this plan.
