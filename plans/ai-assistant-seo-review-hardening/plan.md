# Feature Plan: AI Assistant SEO Review Hardening

Status: READY
Last updated: 2026-06-09
Owner: feature-orchestrator

## Working Brief

- Feature: Make the AI assistant stronger by separating generative page building
  from SEO review, hardening provider input normalization, and proving the flow
  with focused tests and browser verification.
- Primary actors: admin editor using the floating AI assistant; external AI
  provider returning tool calls; local editor applying validated draft edits.
- Core invariant: AI can change only local editor draft state unless the user
  explicitly saves/publishes through existing editor controls.
- Previous intended behaviors: chat can create a complete page draft; chat
  history is page-scoped; provider selector can choose OpenAI or Cerebras;
  readiness panel continues to summarize publish blockers.
- Intentional behavior changes: the assistant's SEO action becomes a review of
  the current page, not a source-bound draft-block generator.
- Unsafe outcomes: raw validation errors from AI payloads; duplicate generative
  surfaces; AI changes saved/published content automatically; fake media URLs;
  weak fallback copy that only passes block-count tests.
- Evidence: code review findings from 2026-06-09, OSS browser verification,
  existing readiness tests, Fallow audit.
- Assumptions: source-bound proposal backend can remain dormant for now; no
  migration is needed; no live-data mutation is required for verification.
- Out of scope: visible user template system, production release/push, removing
  AI proposal tables/services, and new AI-powered SEO-analysis endpoint.

## Risk Classification

- Overall tier: T2
- Live-data risk: Low. Browser tests may create disposable drafts only.
- Migration risk: None expected.
- External-contract risk: Medium. Cerebras schema/tool calling remains external
  provider behavior.

## Dependency Graph

| Node | Title                                                                   | Tier | Depends On  | Parallel Group | Shared-State Risk          | Status  |
| ---- | ----------------------------------------------------------------------- | ---- | ----------- | -------------- | -------------------------- | ------- |
| S1   | Replace visible SEO draft generator with SEO review panel               | T2   | none        | W1-A           | UI/controller shared files | PENDING |
| S2   | Normalize AI tool inputs before local schema parsing                    | T2   | none        | W1-B           | shared AI chat service     | PENDING |
| S3   | Improve deterministic fallback copy quality                             | T2   | S2          | W2-A           | shared fallback helpers    | PENDING |
| S4   | Remove structural leftovers and duplicated low-level helpers where safe | T3   | S1,S2       | W2-B           | shared exports/tests       | PENDING |
| S5   | Focused testing and browser sweep                                       | T2   | S1,S2,S3,S4 | W3-A           | shared dev server/test DB  | PENDING |

## Nodes

### S1 - Replace visible SEO draft generator with SEO review panel

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: admin opens the assistant and clicks the SEO/review action.
Behavior to test: When the admin opens the assistant SEO action, then the panel
shows current SEO/readiness findings and does not generate draft block proposals.
Invariant protected: The chat builder remains the only visible generative
page-building mode.
Intentional behavior changes: "Generate page draft" UI becomes "Review SEO".
Previous intended behaviors preserved: readiness findings stay available; chat
builder still applies local draft edits; provider selector remains available for
chat.
Unsafe outcomes: hiding useful readiness actions; confusing users with two
generators; unmounting required editor fields.
Dependencies: none.
Expected files: `AiBuilderAssistant.tsx`,
`useSeoPageEditorController.ts` only if controller shape needs adjustment, tests
if existing coverage exists.
Write boundaries: AI assistant UI/controller only.
Acceptance criteria:

- [ ] Assistant secondary action is labelled and described as SEO review.
- [ ] No visible button in the assistant runs the old AI block proposal flow.
- [ ] Review panel summarizes blockers, warnings, opportunities, and metrics.
- [ ] Review panel gives deterministic next actions without raw schema labels.
      Regression guards:
- Chat create/edit still works.
- Import document panel still works.
  RGR:
- RED: add or update a component/controller test where practical, or document
  current browser behavior before change.
- GREEN: replace panel behavior.
- REFACTOR: remove now-unused UI props from the assistant where safe.
  Gates:
- Repo gate: focused TS/TSX tests or typecheck if no component test exists.
- Browser gate: open an editor page and verify assistant review panel.
- Boundary/migration gate: no DB migration, no publish/save side effects.
  External docs needed: none.
  Parallelization: single-threaded with S1 files.
  Worker role: UI behavior slice owner.
  Exit evidence: changed files, test/browser proof, and no old generator visible.
  Blocked on: none.

### S2 - Normalize AI tool inputs before local schema parsing

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: external AI provider returns tool-call inputs.
Behavior to test: When a provider returns overlong or oversized safe fields,
then local normalization repairs them before schema parsing where safe.
Invariant protected: local editor schemas remain final authority.
Intentional behavior changes: safe text/array excess is trimmed/capped instead
of surfacing raw validation errors.
Previous intended behaviors preserved: unsafe media URLs still request
clarification or fail safely; unknown block types remain rejected.
Unsafe outcomes: silently accepting dangerous URLs; masking invalid block types;
dropping required content without notice.
Dependencies: none.
Expected files: `src/lib/page-builder/ai-chat.ts`,
`src/lib/page-builder/ai-chat.test.ts`.
Write boundaries: AI chat apply/normalization layer and tests.
Acceptance criteria:

- [ ] `set_seo_metadata` overlong fields still normalize.
- [ ] `replace_page_sections` overlong block text and oversized arrays normalize.
- [ ] `add_block` overlong cards/FAQs/body normalize.
- [ ] unsafe media URLs are not normalized into valid fake URLs.
      Regression guards:
- Existing dynamic edit/add/replace tests still pass.
  RGR:
- RED: tests with overlong block payloads fail before implementation.
- GREEN: add normalization before parse.
- REFACTOR: keep helper data-driven enough to avoid more schema sprawl.
  Gates:
- Repo gate: `npx vitest run src/lib/page-builder/ai-chat.test.ts`.
- Browser gate: covered in S5.
- Boundary/migration gate: none.
  External docs needed: none.
  Parallelization: can run parallel with S1 if write boundaries are respected.
  Worker role: AI validation slice owner.
  Exit evidence: tests and focused diff.
  Blocked on: none.

### S3 - Improve deterministic fallback copy quality

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: model returns metadata-only for a create-page ask.
Behavior to test: When fallback creates page sections, then each section has
distinct, customer-facing draft copy that reflects the hidden guide.
Invariant protected: fallback remains a safety net for metadata-only responses.
Intentional behavior changes: less repetitive hero/body/card/FAQ copy.
Previous intended behaviors preserved: complete first drafts still include
visible blocks.
Unsafe outcomes: invented claims, fake guarantees, or overly generic copy.
Dependencies: S2.
Expected files: `src/lib/page-builder/ai-chat.ts`,
`src/lib/page-builder/ai-chat.test.ts`.
Write boundaries: fallback helpers and tests.
Acceptance criteria:

- [ ] Use-case/local/comparison/how-to fallback sections have distinct body text.
- [ ] Copy avoids placeholder instructions and unsupported guarantees.
- [ ] Target topic remains present in headings/body.
      Regression guards:
- create-page metadata-only fallback still appends `replace_page_sections`.
  RGR:
- RED: strengthen fallback assertions.
- GREEN: update fallback copy helpers.
- REFACTOR: keep guide-specific branches understandable.
  Gates:
- Repo gate: `npx vitest run src/lib/page-builder/ai-chat.test.ts`.
- Browser gate: covered in S5.
- Boundary/migration gate: none.
  External docs needed: none.
  Parallelization: after S2.
  Worker role: fallback quality slice owner.
  Exit evidence: tests and copy examples.
  Blocked on: S2.

### S4 - Remove structural leftovers and duplicated low-level helpers where safe

Status: PENDING
Tier: T3
Type: refactor
Actor/trigger: maintainer review before release.
Behavior to test: When Fallow audits the branch, then introduced dead exports
are gone and provider helper duplication is reduced or explicitly deferred.
Invariant protected: no provider behavior changes without tests.
Intentional behavior changes: none user-facing.
Previous intended behaviors preserved: OpenAI/Cerebras parsing and UI provider
selection.
Unsafe outcomes: broad refactor breaking provider parsing.
Dependencies: S1, S2.
Expected files: `seo-agent-provider.ts`, `ai-page-guides.ts`, optional shared
provider helper.
Write boundaries: low-level helper cleanup only.
Acceptance criteria:

- [ ] Remove introduced unused exports.
- [ ] Do not broaden provider refactor unless tests cover both services.
      Regression guards:
- service tests still pass.
  RGR:
- RED: Fallow/test signal.
- GREEN: remove dead exports and tiny duplication only if safe.
- REFACTOR: avoid large adapter rewrite unless required.
  Gates:
- Repo gate: focused tests, typecheck, Fallow audit.
- Browser gate: none directly; covered by S5.
- Boundary/migration gate: none.
  External docs needed: none.
  Parallelization: after S1/S2.
  Worker role: structural cleanup owner.
  Exit evidence: Fallow before/after and tests.
  Blocked on: S1, S2.

### S5 - Focused testing and browser sweep

Status: PENDING
Tier: T2
Type: verification
Actor/trigger: maintainer finishing feature branch.
Behavior to test: When the AI assistant is tested in the browser, then chat
builder and SEO review behavior match the product split.
Invariant protected: no unverified UI claims.
Intentional behavior changes: none beyond prior nodes.
Previous intended behaviors preserved: chat history per page, Cerebras provider,
create-page block generation, import document access, readiness panel.
Unsafe outcomes: testing against stale UI, leaving dev server/session running
without reporting, mutating non-disposable content.
Dependencies: S1, S2, S3, S4.
Expected files: `plans/ai-assistant-seo-review-hardening/verification.md`.
Write boundaries: verification artifact only.
Acceptance criteria:

- [ ] Focused unit/service tests pass.
- [ ] Typecheck and scoped lint pass.
- [ ] Browser opens admin editor and verifies SEO review panel.
- [ ] Browser or harness verifies Cerebras create-page still creates blocks.
- [ ] Any disposable drafts are documented.
      Regression guards:
- no unrelated dirty files staged.
  RGR:
- RED: not applicable for verification node.
- GREEN: run checks and browser proof.
- REFACTOR: none.
  Gates:
- Repo gate: tests/typecheck/lint.
- Browser gate: in-app/browser automation screenshots or DOM proof.
- Boundary/migration gate: no migration; disposable draft creation only if
  needed.
  External docs needed: none.
  Parallelization: final single-threaded.
  Worker role: final proof owner.
  Exit evidence: verification artifact.
  Blocked on: S1, S2, S3, S4.
