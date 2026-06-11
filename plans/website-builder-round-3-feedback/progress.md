# Feature Progress: website-builder-round-3-feedback

Status: IN_PROGRESS
Current wave: W1
Last updated: 2026-06-11
Owner: feature-orchestrator

## Graph Summary

| Node | Title                                         | Tier | Depends On | Parallel Group | Owner      | Status  |
| ---- | --------------------------------------------- | ---- | ---------- | -------------- | ---------- | ------- |
| S1   | Published list bullet/number styling (I1)     | T3   | none       | W1-A           | worker-s1  | DONE    |
| S2   | Substring link selection (I2)                 | T3   | none       | W1-B           | worker-s2  | DONE    |
| S3   | Meta description 155 alignment + counter (I3) | T2   | none       | W1-C           | worker-s3  | DONE    |
| S4   | Outline up/down reorder (I4)                  | T3   | none       | W1-D           | worker-s4  | DONE    |
| S5   | Proof point imagery end-to-end (I5)           | T2   | none       | W2-A           | unassigned | PENDING |
| S7   | Importer truncation warning (I7)              | T3   | none       | W2-B           | unassigned | PENDING |
| S6a  | Route prefix settings table + admin UI (I6)   | T2   | none       | W3-A           | unassigned | PENDING |
| S6b  | Dynamic prefix route + lookup validation (I6) | T2   | S6a        | W4-A           | unassigned | PENDING |

## Gate Progress

| Node | RED  | GREEN | REFACTOR | Repo Gate | Browser Gate | Boundary Gate | Evidence           | Confidence |
| ---- | ---- | ----- | -------- | --------- | ------------ | ------------- | ------------------ | ---------- |
| S1   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S1-1.md | High       |
| S2   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S2-1.md | High       |
| S3   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S3-1.md | High       |
| S4   | DONE | DONE  | DONE     | DONE      | DONE         | n/a           | agent-runs/S4-1.md | High       |
| S5   | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none               | TBD        |
| S7   | TODO | TODO  | TODO     | TODO      | TODO         | n/a           | none               | TBD        |
| S6a  | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none               | TBD        |
| S6b  | TODO | TODO  | TODO     | TODO      | TODO         | TODO          | none               | TBD        |

Browser gates run serially by the orchestrator at wave integration (shared dev
server; workers do code + repo gates only).

## Blockers

| Node | Blocker | Required Decision Or Evidence |
| ---- | ------- | ----------------------------- |

## Completed Evidence

- W1 integration (2026-06-11, orchestrator): fresh repo gate over all four areas —
  `npm run test -- src/components/admin/seo-page-editor src/components/sections/resource-blocks src/lib/page-builder src/lib/admin src/app/admin/pages`
  62 files / 406 tests PASS; `npm run typecheck` clean; targeted eslint clean.
  Write-boundary audit clean (no forbidden files touched; home-v2 and
  Benefits/Testimonials diffs are pre-existing and excluded).
- S1: published page `/resources/vending-in-colleges` renders 3 `ul.list-disc`
  lists (was bare `list-outside`); screenshot `/tmp/r3-s1-public-bullets.png`.
  Render test red->green in `RichTextBlock.test.tsx`; checklist variant asserted
  unchanged.
- S2: editor browser proof on `/admin/pages/f7cf0260...`: "Link text" input with
  "Leave blank to link the whole paragraph" hint; non-matching text shows
  role=alert ("That text isn't in this paragraph...") with no data change; valid
  substring accepted silently. Screenshots `/tmp/r3-s2-error.png`,
  `/tmp/r3-s2-valid.png`. 13 helper tests + 3 render tests.
- S3: counter "116/155" visible in publish Settings tab; 200-char fill capped at
  155 (`/tmp/r3-s3-counter-visible.png`). Two-tier constants in
  `copy-standards.ts` (155 target / 180 legacy server ceiling); legacy 170-char
  save accepted, 181 rejected (test-certified). AI generation schemas capped 155;
  ai-chat request-context schema deliberately kept at legacy 180 (documented in
  S3-1.md).
- S4: outline up/down buttons with per-column boundary disabling verified desktop
  (`/tmp/r3-s4-outline-before/after.png` — order visibly changed, unsaved draft
  only) and mobile 390px via Blocks pill (`/tmp/r3-s4-mobile-open.png`); no
  horizontal overflow. 4 interaction tests.
