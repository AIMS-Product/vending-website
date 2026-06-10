# Feature Progress: ux-verified-technical-fixes

Status: IN_PROGRESS
Current wave: W1 (S7/S16/S10/S8 parallel; S1 runs solo afterwards — production build needs exclusive .next while the shared dev server is down)
Last updated: 2026-06-11
Owner: feature-orchestrator

Wave plan (revised at launch for write-boundary + server safety):
W1 = S7, S16, S10, S8 · W1b = S1 solo · W2 = S14→S13→S12 chain, S9→S15 chain, S5, S4 · W3 = S11, S2, S3, S6 + any S16 reproductions · W5 = S17 final proof. Orchestrator commits one checkpoint per accepted wave; no push (release-train rule).

## Graph Summary

| Node | Title                                                 | Tier | Depends On     | Parallel Group               | Owner        | Status                    |
| ---- | ----------------------------------------------------- | ---- | -------------- | ---------------------------- | ------------ | ------------------------- |
| S1   | CLS < 0.1 cold loads (I1)                             | T2   | none           | W1b (solo: owns .next build) | unassigned   | PENDING                   |
| S7   | News cards first paint (I7)                           | T3   | none           | W1-A                         | w-s7         | ALREADY_RESOLVED (+guard) |
| S16  | Verify-first trio (I16)                               | T3   | none           | W1-B                         | w-s16        | DONE                      |
| S10  | News row archive + bulk (I10)                         | T2   | none           | W1-C                         | w-s10        | DONE                      |
| S8   | Redirect path refine (I8)                             | T2   | none           | W1-D                         | w-s8         | DONE                      |
| S18  | Create-gate landmark (C132, ex-S16)                   | T3   | none           | W3                           | w-s18        | DONE                      |
| S19  | News editor mobile save bar (C145, ex-S16)            | T3   | S5 (same file) | W3                           | w-s5         | DONE                      |
| S4   | Body link contrast (I4)                               | T3   | S1             | W2-C                         | unassigned   | PENDING                   |
| S5   | Nested asides (I5)                                    | T3   | none           | W2-D                         | w-s5         | DONE                      |
| S14  | Apply error summary (I14)                             | T2   | none           | W3-A 1/3                     | w-s14        | DONE                      |
| S13  | Privacy line (I13)                                    | T3   | S14            | W3-A 2/3                     | w-s14        | DONE                      |
| S12  | "(optional)" labels (I12)                             | T3   | S13            | W3-A 3/3                     | w-s14        | DONE                      |
| S9   | Create feedback (I9)                                  | T3   | none           | W3-B 1/2                     | w-s9         | DONE (e2e wiring → S20)   |
| S15  | Schedule-failed KPI (I15)                             | T3   | S9             | W3-B 2/2                     | w-s9         | DONE                      |
| S11  | Libraries sidebar (I11)                               | T3   | none           | W3-C                         | w-s11        | DONE                      |
| S2   | Public tap targets (I2)                               | T3   | S1             | W3-D                         | unassigned   | PENDING                   |
| S3   | Admin hit areas (I3)                                  | T3   | S15            | W4-A                         | unassigned   | PENDING                   |
| S6   | Heading order (I6)                                    | T3   | none           | W4-B                         | w-s6         | IN_PROGRESS               |
| S20  | Top-rail ?created param (e2e for S9, ex-S9 discovery) | T3   | S9             | W3                           | w-s9         | IN_PROGRESS               |
| S17  | Final proof                                           | —    | all            | W5                           | orchestrator | PENDING                   |

## Gate Progress

| Node | RED                                     | GREEN                  | REFACTOR | Repo Gate | Browser Gate                               | Boundary Gate                    | Evidence                                              | Confidence            |
| ---- | --------------------------------------- | ---------------------- | -------- | --------- | ------------------------------------------ | -------------------------------- | ----------------------------------------------------- | --------------------- |
| S1   | TODO                                    | TODO                   | TODO     | TODO      | TODO                                       | n/a                              | none                                                  | TBD                   |
| S7   | DONE (browser repro attempt: no defect) | n/a (no fix warranted) | n/a      | DONE      | DONE                                       | n/a                              | agent-runs/S7-1.md + shots/s7-\*                      | 95                    |
| S16  | n/a                                     | n/a                    | n/a      | n/a       | DONE                                       | n/a                              | agent-runs/S16-1.md + axe JSON + shots/s16-\*         | 96                    |
| S10  | DONE                                    | DONE                   | DONE     | DONE      | DONE                                       | DONE                             | agent-runs/S10-1.md + shots/s10-1..5                  | 95                    |
| S8   | DONE                                    | DONE                   | DONE     | DONE      | DONE                                       | n/a                              | agent-runs/S8-1.md + shots/s8-source-format-error.png | 96                    |
| S4   | n/a                                     | TODO                   | n/a      | TODO      | TODO                                       | n/a                              | none                                                  | TBD                   |
| S5   | DONE (axe before JSON)                  | DONE                   | DONE     | DONE      | DONE (axe 1→0 both surfaces)               | n/a                              | agent-runs/S5-S19-1.md + s5-axe-\*.json + shots       | 95                    |
| S19  | DONE                                    | DONE                   | DONE     | DONE      | DONE (375px proof + desktop absent)        | DONE (save persisted)            | agent-runs/S5-S19-1.md + shots/s19-\*                 | 94                    |
| S14  | DONE                                    | DONE                   | DONE     | DONE      | DONE (anchor-focus proven)                 | n/a                              | agent-runs/S14-S13-S12-1.md + shots/s14-\*            | 94                    |
| S13  | DONE                                    | DONE                   | n/a      | DONE      | DONE                                       | n/a                              | shots/s13-privacy.png                                 | 96                    |
| S12  | DONE                                    | DONE                   | n/a      | DONE      | DONE                                       | n/a                              | shots/s12-optional.png                                | 96                    |
| S9   | DONE                                    | DONE                   | DONE     | DONE      | DONE (server-render proof; e2e via S20)    | DONE (param-driven, reload-safe) | agent-runs/S9-S15-1.md                                | 90 (95 after S20 e2e) |
| S15  | DONE                                    | DONE                   | n/a      | DONE      | DONE (0-state real; >0 unit-proven)        | n/a                              | agent-runs/S9-S15-1.md                                | 93                    |
| S11  | DONE (2 failing tests first)            | DONE                   | n/a      | DONE      | DONE (aria-current proof)                  | n/a                              | agent-runs/S11-1.md + shots/s11-\*                    | 96                    |
| S18  | DONE (fresh axe before)                 | DONE                   | n/a      | DONE      | DONE (axe 1→0, screenshots byte-identical) | n/a                              | agent-runs/S18-1.md + s18-axe-\*.json                 | 96                    |
| S2   | TODO                                    | TODO                   | TODO     | TODO      | TODO                                       | n/a                              | none                                                  | TBD                   |
| S3   | TODO                                    | TODO                   | TODO     | TODO      | TODO                                       | n/a                              | none                                                  | TBD                   |
| S6   | TODO                                    | TODO                   | TODO     | TODO      | TODO                                       | n/a                              | none                                                  | TBD                   |
| S17  | n/a                                     | n/a                    | n/a      | TODO      | TODO                                       | TODO                             | none                                                  | TBD                   |

## Blockers

| Node | Blocker | Required Decision Or Evidence |
| ---- | ------- | ----------------------------- |
| —    | none    | —                             |

## Completed Evidence

- W2 (2026-06-11): S14/S13/S12 DONE (one worker, PublicLeadForm chain) — focusable role="alert" error summary with per-field anchors + single assertive source (bottom message demoted to polite on validation failure), privacy line linking /privacy (route verified), systemic "(optional)" labels via shared FieldLabel; conversion path and "Not sure yet" behavior preserved; orchestrator spot-check 28/28 + tsc clean; residual: PublicLeadForm.tsx 538 lines (pre-existing overage, flagged for future split). S5/S19 DONE (one worker) — article landmark restructure (asides now siblings) + news editor aside→div: axe landmark-complementary 1→0 on both surfaces; NewsMobileSaveBar (lg:hidden, fixed, reuses form submit via form= attribute), 375px proof + desktop display:none; throwaway draft uxfix-s19-throwaway (6078e5be…) queued for S17 cleanup. S9/S15 DONE (one worker, admin/pages/page.tsx) — param-driven ?created banner + Open link + row highlight (reload-safe, no-param baseline 0), ScheduleFailedKpi from existing allPages fetch (renders null at 0, >0 unit-proven, real DB has 0 failures — none fabricated); 16/16 page.test.ts + 96/96 pages scope; discovery: create flow doesn't emit ?created → new node S20 (top-rail back-link param) assigned to w-s9 with extended boundary; residual: page.tsx far over size limits pre-existing, flagged for dedicated split.

- W1 (2026-06-11): S7 ALREADY_RESOLVED — C005 was misattributed: no scroll-reveal logic exists or ever existed in NewsList (grep + git -S); first-paint visible at 1280/375/images-stalled (agent-runs/shots/s7-\*). Original review screenshot shows a broken cover image (the C030 ImageWithFallback case), not hidden cards. Regression guard added to NewsList.test.tsx. S16 DONE — verdicts: C132 REPRODUCED (nested named regions, → new node S18), C145 REPRODUCED (Save ~1519px below fold at 375w, → new node S19), SEO-P3d NOT-REPRODUCED (20/20 clean post-load clicks; latent pre-hydration race noted as residual: "Start building page" is client-only onClick with no SSR fallback). S10 DONE — list-actions.ts (archive + bulk, UUID floor, returnTo allowlist, 50-cap), NewsBulkArchiveControls island, row menu + confirm; 7 new unit tests; browser proof on :3001 with two throwaways left ARCHIVED (uxfix-s10-throwaway-mq8oijc8 a854dfe3…, uxfix-s10-throwaway-bulk-mq8oijc8 7b0abbfa…); persistence verified on reload. Orchestrator spot-check: 30/30 targeted tests, tsc clean, boundaries respected. S8 code accepted (leading-slash floor mirroring isRootRelativePath + https allowance; 19/19) — browser gate rerunning against :3001 (worker initially hit the STALE prod server on :3000, port discovery recorded below).
- Environment note (2026-06-11): port 3000 = stale `next start` (PID 53708) left from June 10 session, no auth bypass; orchestrator's dev server = port 3001 (PID 73118). All admin browser proofs must use :3001. The stale :3000 server will be killed before S1's production-build CLS measurement.
- Pre-flight (2026-06-11): in-flight tree stabilized — Zod 4 preprocess→pipe fix in redirects pageId schema, lead-action-handler Supabase boundary mocked + assertions made unconditional. Baseline: vitest 606/606, tsc clean. Commits 6c94fbf (src) + 9510702 (reports).
