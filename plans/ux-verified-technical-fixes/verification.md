# Verification: ux-verified-technical-fixes

## Final Status

PASS

## Requirement Audit

All 31 findings from `reports/ux-review-status-2026-06-11/` (strategy I1–I16), mapped to nodes:

| Requirement (findings)                          | Node   | Evidence                                                                                                                                                                               | Result                          |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| CLS < 0.1 cold loads (C096/C099/C020/C127/C134) | S1     | s1-cls-before/after.json: 0.29167 → 0.0 on /about, /news, article; / already 0.0. Root cause: root loading.tsx fallback height (NOT footer component).                                 | PASS                            |
| News cards visible first paint (C005)           | S7     | No reveal logic exists (grep + git -S); first-paint shots at 1280/375/images-stalled; original report was a broken-image misattribution (covered by C030 fix). Regression guard added. | PASS (ALREADY_RESOLVED + guard) |
| News row archive + bulk (C141/C033/C019)        | S10    | list-actions.ts + NewsBulkArchiveControls + row menu; 7 unit tests; browser archive of 2 throwaways; persistence on reload; re-proven by S17 cleanup on a third post.                  | PASS                            |
| Redirect path format validation (P2-3)          | S8     | Leading-slash refine mirroring isRootRelativePath + https allowance; 19/19 tests; browser inline-error proof with preserved values.                                                    | PASS                            |
| Apply error summary (C014)                      | S14    | role=alert summary, anchor→focus proven in browser; single assertive source; 20/20 forms tests.                                                                                        | PASS                            |
| Privacy line (C088)                             | S13    | Line + /privacy link rendered both form types; shots/s13-privacy.png.                                                                                                                  | PASS                            |
| "(optional)" labels (C027)                      | S12    | Shared FieldLabel; contact State "(optional)" browser-confirmed; apply State still required.                                                                                           | PASS                            |
| Create-page feedback (C140)                     | S9+S20 | ?created banner + Open link + row highlight; top-rail back-link param (backToPagesHref, unit-proven 3 states); FULL e2e click-through PASS in S17 (id 8f994979…).                      | PASS                            |
| Schedule-failed KPI (C137)                      | S15    | ScheduleFailedKpi from existing fetch; >0 unit-proven; 0-state confirmed live (renders nothing).                                                                                       | PASS                            |
| Libraries sidebar (C142)                        | S11    | Sidebar entry + aria-current proof; 5/5 tests.                                                                                                                                         | PASS                            |
| Nested asides (C052/C057)                       | S5     | axe landmark-complementary 1→0 on article + /admin/news/new; visuals unchanged.                                                                                                        | PASS                            |
| Create-gate landmark (C132)                     | S18    | axe landmark-unique 1→0; screenshots byte-identical.                                                                                                                                   | PASS                            |
| News editor mobile save (C145)                  | S19    | NewsMobileSaveBar (lg:hidden, real submit via form=); 375px in-viewport proof; desktop display:none; save persisted.                                                                   | PASS                            |
| Create-gate flakiness (SEO-P3d)                 | S16    | NOT-REPRODUCED: 20/20 post-load clicks. Latent pre-hydration race recorded (residual).                                                                                                 | PASS (no fix warranted)         |
| Public tap targets (C093/C110/C094/C129/C047)   | S2     | 17–20px → 44px measured; header height 82px identical; mobile menu already 48px; no neighbor swallowed.                                                                                | PASS                            |
| Admin hit areas (C010/C107)                     | S3     | Dots verified decorative (no padding needed); checkbox 16→24px hit, 16px visual; padding-click toggles.                                                                                | PASS                            |
| Heading order (C053/C086)                       | S6     | sr-only h2s (typed content); axe heading-order 1→0, page total 0; home unaffected; screenshots pixel-identical.                                                                        | PASS                            |
| Body link + sidebar contrast (C050)             | S4     | 2.86:1→5.70:1 body links; 3.17:1→21:1 sidebar subtitle; whole-page axe 0 serious.                                                                                                      | PASS                            |

## Evidence Table

| Claim                   | Fresh evidence                                                                  | Result | Remaining risk                                 |
| ----------------------- | ------------------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| Full unit suite green   | vitest 653/653 (107 files) at final checkpoint                                  | PASS   | —                                              |
| Types clean             | npx tsc --noEmit exit 0 (run at every wave + final)                             | PASS   | —                                              |
| Production build        | npm run build success after all changes (route table emitted)                   | PASS   | —                                              |
| User-visible flows live | S17 browser sweep: 10/10 checks PASS on :3000 incl. e2e create→banner→archive   | PASS   | local env only                                 |
| axe final sample        | s17-axe-\*.json: 0 serious/critical on article, /admin/pages/new, /case-studies | PASS   | sampled, not exhaustive                        |
| DB hygiene              | All 5 throwaways ARCHIVED (8f994979…, 2b7ee5a0…, 6078e5be…, 2× uxfix-s10)       | PASS   | archived rows remain (restorable, intentional) |

## Commands

- npx vitest run (653/653) · npx tsc --noEmit (clean) · npm run build (pass)
- Browser/axe drivers: plans/ux-verified-technical-fixes/agent-runs/\*.mjs + tools/measure-cls.mjs

## Runtime And Boundary Proof

- CLS: fresh `next build` + per-page cold `next start`, buffered layout-shift observer, before/after JSONs.
- Archive boundary: status persisted across reloads (S10, S17).
- Create→list boundary: param-driven banner reload-safe; no stale banner without param.

## Skipped Checks

- Live Vercel re-measure of CLS (no deploy this round — local release train). Re-measure after next production deploy; historical 0.263 was recorded on the deployed URL.
- Full-site axe crawl (sampled 3 key surfaces instead; per-node axe runs cover the changed surfaces).
- E2E (Playwright suite) not run — repo's persona-review scripts are ad-hoc; unit + targeted browser proofs used instead.

## Behavior Preservation

- Previous intended behaviors: apply redirect to /thank-you-for-applying; inline validation + aria wiring; "Not sure yet" qualification clearing; news naming/301s; ImageWithFallback; pages-list labels/legend/menus/bulk; publish checklist; schedule status; redirect CRUD + pageId UUID floor; skip link; SSR stat values; footer link set; compact admin visuals.
- Intentional behavior changes: loading fallback reserves viewport; Inter display:optional; news rows gain archive/bulk; redirect form rejects non-/ paths at form layer; apply form gains summary/privacy/optional labels; pages list gains created-banner + failure KPI; sidebar gains libraries; tap/hit areas enlarged invisibly; landmarks/headings restructured semantically.
- Evidence: regression suites green at every wave (606→653 tests, all green); S17 smoke sweep; per-node preservation checks in agent-runs/.
- Confidence: 93/100. Held back by: local-only CLS numbers, sampled (not exhaustive) axe coverage, and the observed autosave re-fire behavior (below).

## Residual Risk

- Autosave re-fire: S17 observed frequent repeated POSTs while the new-page editor sat idle. Not a regression introduced this round (no autosave files touched) and N4's backoff governs failures, not idle re-fires — but worth a dedicated look. Candidate follow-up node.
- Latent pre-hydration race on "Start building page" (client-only onClick, no SSR fallback) — not human-reachable at load-event timing (20/20 clean), recorded from S16.
- Duplicate-slug guard means automated create-flows must use unique titles (S17 finding #1) — correct product behavior, noted for future test drivers.
- PublicLeadForm.tsx (538 lines) and admin/pages/page.tsx exceed repo size limits (pre-existing); dedicated split recommended.
- CLS verified locally; re-measure on the live URL after next deploy.
