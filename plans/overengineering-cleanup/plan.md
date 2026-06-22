# Overengineering Cleanup Plan

Origin: `$ponytail-audit` findings routed through `$issue-fix-strategy` into
`feature-orchestrator`.

Core invariant: reduce stale or one-off infrastructure without changing shipped
admin/editor behavior, deleting canonical orchestrator evidence, or disturbing
the local-only Website Builder release train.

## Issue Strategy

| ID  | Priority | Finding                                                                                              | Decision                                                                           | Route          |
| --- | -------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------- |
| I1  | P2       | Generated proof artifacts are checked in.                                                            | Do not delete `plans/*` evidence in this pass; repo report archiving remains open. | Decision-bound |
| I2  | P2       | Live AI model benchmark harness still includes Gemini/provider comparison after OpenAI-only runtime. | Remove benchmark harness and benchmark report outputs.                             | N1             |
| I3  | P2       | CTA-only descriptor layer duplicates explicit block metadata.                                        | Inline CTA metadata into the existing block tables and remove descriptor module.   | N2             |
| I4  | P3       | JSON stringify/parse clone helpers add avoidable indirection.                                        | Replace with `structuredClone` behind existing schema parsing.                     | N3             |
| I5  | P3       | Signed Supabase upload setup is duplicated across news and media actions.                            | Extract a server-only helper while preserving action auth and return shapes.       | N4             |
| I6  | P3       | Admin page/shell icons duplicate `AdminIcon` glyphs.                                                 | Reuse the shared admin icon component and verify rendered admin UI.                | N5             |
| I7  | P2       | Sentry may be unused integration surface.                                                            | Decision-bound until provisioning/removal is confirmed.                            | Skipped        |
| I8  | P2       | Deterministic AI fallback may be larger than needed.                                                 | Product behavior change, not cleanup-only.                                         | Skipped        |
| I9  | P3       | Legacy AI `provider` payload normalization may be stale.                                             | Keep until compatibility/version-skew window is explicitly closed.                 | Skipped        |

## Graph

### N0 - Orchestration Scaffold

- Status: DONE
- Dependencies: none
- Write scope: `plans/overengineering-cleanup/*`
- Acceptance: plan, decisions, progress, and worker evidence locations exist.

### N1 - Remove Stale AI Benchmark Harness

- Status: DONE
- Dependencies: N0
- Write scope: `package.json`, `vitest.benchmark.config.ts`,
  `scripts/ai-benchmark/**`, `reports/ai-model-benchmark-2026-06-11/**`
- Acceptance:
  - `npm run ai-benchmark` is no longer advertised.
  - Benchmark-only Gemini/provider code is gone.
  - Stale benchmark output reports are removed.
  - Default test/typecheck paths do not reference the deleted files.

### N2 - Collapse CTA Descriptor Layer

- Status: DONE
- Dependencies: N0
- Write scope: `src/lib/page-builder/block-*`,
  `src/lib/page-builder/content-ops.ts`, related tests
- Acceptance:
  - `block-descriptors.ts` and its test are removed.
  - CTA metadata lives in the same explicit tables as other page-builder blocks.
  - CTA preview, picker, field visibility, parity markers, placeholders, and
    `createPageBlock("cta")` still behave the same.

### N3 - Replace JSON Clone Helpers

- Status: DONE
- Dependencies: N0
- Write scope: `src/lib/page-builder/content-ops.ts`,
  `src/lib/page-builder/page-templates.ts`, related tests
- Acceptance:
  - Existing clone behavior still returns independent parsed values.
  - No JSON stringify/parse clone remains in the page-builder helper path.

### N4 - Extract Signed Upload Helper

- Status: DONE
- Dependencies: N0
- Write scope: `src/lib/supabase/**`,
  `src/app/admin/media/actions.ts`, `src/app/admin/news/actions.ts`, related
  tests
- Acceptance:
  - News and media actions share one signed-upload helper.
  - Each action still authenticates before preparing uploads.
  - Existing public return shapes remain compatible.
  - Supabase errors remain action-appropriate.

### N5 - Reuse Shared Admin Icons

- Status: DONE
- Dependencies: N0
- Write scope: `src/components/admin/AdminUi.tsx`,
  `src/components/admin/AdminShell.tsx`, `src/app/admin/pages/page.tsx`,
  rendered admin evidence
- Acceptance:
  - Page and shell duplicate icon switch statements are removed or materially
    reduced.
  - Shared icon sizing remains stable in admin page and shell contexts.
  - Rendered screenshots confirm no obvious layout/icon regression.

### N6 - Final Proof

- Status: DONE
- Dependencies: N1, N2, N3, N4, N5
- Write scope: `plans/overengineering-cleanup/progress.md`,
  `plans/overengineering-cleanup/verification.md`
- Acceptance:
  - Targeted tests, typecheck, and lint/build decisions are recorded.
  - Browser/UI proof is recorded for N5.
  - Skipped decision-bound audit items are explicitly accounted for.
