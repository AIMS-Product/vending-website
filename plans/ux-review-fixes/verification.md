# Verification: ux-review-fixes

## Final Status

PASS

## Requirement Audit

| Requirement (decision)             | Evidence                                                                                                                    | Result |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| D2 apply → /thank-you-for-applying | Production browser run ends at /thank-you-for-applying (n14-apply-thankyou-prod.png); lead row created then cleaned         | PASS   |
| D3 contact → inline success panel  | Dev browser gate n2/n5: panel "MESSAGE SENT… will follow up at {email}" replaces form                                       | PASS   |
| D4 "Not sure yet" + required       | n5: option present in all 3 selects, submits end-to-end to thank-you; handler accepts value                                 | PASS   |
| D5 public "News" naming            | curl prod /news: 0 "blog" matches; breadcrumb tests green                                                                   | PASS   |
| D6 stats SSR real values           | curl prod: 500+/3,000+/$3M+ in rendered DOM, zero >0+< spans                                                                | PASS   |
| D7 inline validation               | n5: noValidate; 6 inline errors + role=alert on empty submit; values preserved; no native bubbles                           | PASS   |
| D8 tour repositioned               | n4: positioning unit tests + editor screenshot, card beside rail                                                            | PASS   |
| D9 sidebar Blog/News link          | AdminShell tests 3/3; live sidebar screenshot; aria-current on /admin/news                                                  | PASS   |
| D10 Redirects link                 | n6: link on /admin/pages header, click-through verified                                                                     | PASS   |
| D11 /blog→/news 301                | Prod curl: 308 → /news/{slug} → 200; junk 404; proxy tests 7/7 (orchestrator attempt-2 fixed proxy interception — n8-2.md)  | PASS   |
| D12 P2 sweep                       | n9-n13: every one of 54 P2 rows dispositioned (fixed / not-reproduced / N12-fixed / 10 deferred-Kody / 2 deferred-new-node) | PASS   |
| D13 workflow                       | 5 commits on local branch ux-review-fixes; zero pushes/PRs/deploys                                                          | PASS   |
| D16 cleanup                        | All test rows deleted after each wave (7+5+1); test SEO page archived via UI; test news draft archived                      | PASS   |

## Evidence Table

| Claim                       | Fresh evidence                                                                                                                                                                        | Result           | Remaining risk                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| Full unit suite green       | npx vitest run: 75 files / 429 tests passed (final run, post-W4)                                                                                                                      | PASS             | —                                                                    |
| Types clean                 | npx tsc --noEmit exit 0                                                                                                                                                               | PASS             | —                                                                    |
| Lint clean                  | npx eslint src --max-warnings=0 exit 0                                                                                                                                                | PASS             | —                                                                    |
| Production build succeeds   | npx next build completed, all routes emitted                                                                                                                                          | PASS             | —                                                                    |
| Apply journey on PROD build | playwright on next start :3100 → /thank-you-for-applying                                                                                                                              | PASS             | —                                                                    |
| Mobile overflow eliminated  | prod 375px scrollWidth-clientWidth = 0 on / and /case-studies                                                                                                                         | PASS             | latent CMS long-word risk on titles (noted by n9)                    |
| Skip link first tab stop    | prod tab-walk: first stop "Skip to content"                                                                                                                                           | PASS             | —                                                                    |
| axe contrast                | / 3→0, 404 2→0 (n12)                                                                                                                                                                  | PASS             | /news article-body .mt-5 contrast rows out of n12 scope — in P3 tail |
| CLS on production           | Warmed prod: 0.000 across repeated runs with and without scroll (cls-diag, cls-diag2). One 0.263 observation on the very first cold hit after server start (matches dev footer shift) | PASS (monitored) | verify with real-user data (Vercel Analytics) post-deploy            |
| Console errors on prod      | one transient 404 resource on first load, not reproducible on warmed runs; favicon 200                                                                                                | PASS (monitored) | —                                                                    |
| Lead capture invariant      | leads.ts untouched all round (git log); idempotency tests green; 1 row per submit verified in n2                                                                                      | PASS             | —                                                                    |

## Commands

- npx vitest run (429/429) · npx tsc --noEmit · npx eslint src --max-warnings=0 · npx next build · next start -p 3100 + playwright proofs (plans/ux-review-fixes/tools/final-proof.mjs)

## Runtime And Boundary Proof

- Prod curls: SSR stats real; /blog 308 chain; junk 404; /news "blog"-free.
- DB: lead_submissions test rows created during gates were deleted after each wave (7 + 5 + 1); verified by DELETE return counts.
- No migrations required or run. No external contracts changed (redirect is internal; proxy matcher unchanged).

## Skipped Checks

- Admin journeys on the production build: dev-only auth bypass doesn't apply under next start; admin flows were browser-proven on the dev server instead (n1, n4, n6, n11 screenshots).
- E2E/Playwright spec suite: repo has no committed Playwright test suite; browser gates used ad-hoc scripts retained under plans/ux-review-fixes/tools/.
- Real-user validation (D17): handed to James — one real person should submit a test application on a phone now that S1 has landed.

## Behavior Preservation

- Previous intended behaviors: lead persistence + idempotency; admin list/editor flows; news rendering; share links; scheduled publishing untouched.
- Intentional changes: exactly the D1–D13 list (see decisions.md).
- Evidence: full suite green each wave; targeted regression tests added (initial-paint form render, error-contract preservation, builder-page-wins redirect precedence, nav links unchanged test).
- Confidence: 92/100. Held back by: admin flows not re-proven on prod build (bypass constraint), CLS/console "monitored" items, latent long-word title risk.

## Post-proof addendum (2026-06-10)

- C153 (404 page lacked recovery links) had slipped between N12 (contrast-only on 404) and N13 (routed it to N12) — caught via N13's handoff flag. Fixed: not-found.tsx now offers news / about / apply links. Verified: content rendered live, landmarks tests 3/3, tsc + eslint clean.

## Residual Risk

- 10 P2 rows deferred to Kody (K1–K6 themes) and 2 deferred to new nodes: C098 public/admin design-system unification, C124 apply-form draft persistence.
- 93 P3 polish items remain in plans/ux-review-fixes/P3-BACKLOG.md.
- Lead notification webhook fails silently in dev (status notification_failed) — pre-existing; confirm production webhook config during go-live.
