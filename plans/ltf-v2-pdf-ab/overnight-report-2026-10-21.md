# Overnight report, 2026-10-21 (vending-website)

Plan: `.claude/specs/2026-10-21-overnight-plan.md`. Six draft PRs; none merged, nothing pushed to main, no prod writes.
Baseline on main `b3486b58`: tsc 0 · eslint 0 · vitest 0 (229 passed, 14 skipped).

## Needs Adam

1. Approve deleting the 10-20 test rows (2 $0 orders, 3 abandoned $5 sessions, their ltf_events/ltf_visitors); kills the transcript-exposed download links too.
2. Delete the old #197/#198 production deployments (immutable URLs still hold readable play pages)? Irreversible, loses rollback targets.
3. Go live: `PLAYBOOK_GUIDE_LIVE=on` in production.
4. Stripe statement descriptor suffix "PLAYBOOK".
5. GA4 `purchase` GTM tag; verify on first real sale.
6. VendHub webhook "unresolved checkout" log noise per $5 sale: fix lives in the vendhub repo; who owns it?
7. Roll the Stripe test key and the live `rk_live` key that appeared in transcripts.
8. Content-funnel decisions D1-D4 (checklist at the top of #205).
9. Merge order: #201 first (leak guard), then #202/#203/#204 (independent; #201 and #202 touch different hunks of `GuidePageViewer.tsx`).

## Slices

Previews sit behind Vercel SSO. Checks = local exit codes; GitHub CI "typecheck, lint, test" green on #201-#203 at report time.

| Slice                    | Status         | PR                                                               | Preview                                                                                                                     | Checks                                                   | Screenshots             |
| ------------------------ | -------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------- |
| S1 leak guard + runbook  | draft PR       | [#201](https://github.com/AIMS-Product/vending-website/pull/201) | [preview](https://vending-website-git-fix-playbook-prev-9e053e-aimanagingservices.vercel.app/playbook/guide)                | tsc 0, eslint 0, vitest 0 (252); negative runs exit 1 x3 | n/a (no visual change)  |
| S2 below-the-fold polish | draft PR       | [#202](https://github.com/AIMS-Product/vending-website/pull/202) | [preview](https://vending-website-git-feat-playbook-gui-279b97-aimanagingservices.vercel.app/playbook/guide)                | tsc 0, eslint 0, vitest 0, axe none @390/1440            | `shots/2026-10-21/s2-*` |
| S3 thank-you + access    | draft PR       | [#203](https://github.com/AIMS-Product/vending-website/pull/203) | [preview](https://vending-website-git-feat-playbook-gui-9936d8-aimanagingservices.vercel.app/playbook/guide-access)         | tsc 0, eslint 0, vitest 0, axe none                      | `shots/2026-10-21/s3-*` |
| S7 PR triage             | done (below)   | -                                                                | -                                                                                                                           | read only                                                | -                       |
| S4 webinar teaser        | draft PR       | [#204](https://github.com/AIMS-Product/vending-website/pull/204) | [preview](https://vending-website-git-feat-playbook-tea-a08245-aimanagingservices.vercel.app) (teaser hidden until flag on) | tsc 0, eslint 0, vitest 0                                | `shots/2026-10-21/s4-*` |
| S5 news CTA swap         | skipped        | -                                                                | -                                                                                                                           | -                                                        | -                       |
| S8 BOFU outlines         | draft PR       | [#205](https://github.com/AIMS-Product/vending-website/pull/205) | n/a (docs)                                                                                                                  | prettier                                                 | -                       |
| S6 organic content view  | WIP, plan only | [#206](https://github.com/AIMS-Product/vending-website/pull/206) | n/a                                                                                                                         | -                                                        | -                       |

- **S5 skipped (already done):** news articles already send both CTAs (sidebar "Step inside" + FinalCta "Book here") to `/contact`; no coded default points at the roadmap. Remaining roadmap exposure on news/resources is DB content (site popups, Page Builder rows, article bodies), which tonight's rules put off limits. To finish Step 1: decide in `/admin` whether popups on `/news/*` should offer the roadmap.
- **S6:** needs a prod read pass to measure `first_referrer` coverage before building; spec has 5 slices.
- Reviews: one opus code-reviewer on #201 (2 HIGH + 2 MEDIUM fixed), #202 (approve; MEDIUM left: final-offer heading sits in the approved order-card section), #203 (approve; LOWs: `/playbook/checkout` and `/playbook/thank-you` also nest `<main>`, "PDF + 8 videos" hardcoded in two places). No codex runs (spend).

## Open PR triage (S7, read only; nothing touched)

| PR                               | Age | CI                          | Conflicts           | Relevant?                                   | Recommendation                                          |
| -------------------------------- | --- | --------------------------- | ------------------- | ------------------------------------------- | ------------------------------------------------------- |
| #196 mike-newsletter copy        | 2d  | pass                        | n                   | yes                                         | merge after your copy read                              |
| #170 UTM registry (draft)        | 7d  | pass                        | **yes** (32 behind) | yes                                         | needs Adam: rebase, then review                         |
| #130 deps minor/patch group      | 12d | pass                        | n                   | yes                                         | merge                                                   |
| #129 newsletter deps minor/patch | 12d | pass                        | n                   | yes                                         | merge                                                   |
| #128 actions/setup-node 6        | 12d | npm audit fail (stale base) | n                   | yes                                         | rebase then merge                                       |
| #98 actions/checkout 7           | 19d | pass                        | n                   | yes                                         | merge (check runner Node version)                       |
| #122 sitemap fail-soft           | 15d | npm audit fail (stale base) | n                   | yes                                         | rebase then merge                                       |
| #119 close note order            | 19d | npm audit fail (stale base) | n                   | yes, customer-visible                       | rebase, verify on preview vs real Close org, then merge |
| #92 perf/a11y/seo (draft)        | 19d | pass                        | n                   | yes                                         | needs Adam: UI review, then merge                       |
| #90 funnel polish (draft)        | 19d | pass                        | n                   | yes                                         | needs Adam: UI review, then merge                       |
| #82 Lane 2 docs                  | 23d | pass                        | n                   | probably stale (rules changed 10-13..10-16) | close or rewrite                                        |
| #106 @types/node 26              | 19d | pass                        | n                   | -                                           | dedicated upgrade session                               |
| #103 newsletter @types/node 26   | 19d | pass                        | n                   | -                                           | dedicated upgrade session                               |
| #102 newsletter TypeScript 7     | 19d | pass                        | n                   | -                                           | dedicated upgrade session                               |
| #101 newsletter ESLint 10        | 19d | pass                        | n                   | -                                           | dedicated upgrade session                               |
| #107 @vitest/coverage-v8 5       | 19d | Vercel + typecheck fail     | n                   | -                                           | dedicated upgrade session                               |
| #105 / #108 stryker 10           | 19d | 2 fail                      | n                   | -                                           | dedicated upgrade session                               |

## What went wrong

- First `Write` in the worktree was blocked: "Another Claude session (78e9f46c) edited ... 1 min ago". It was the pre-clear session that wrote the plan; retry succeeded.
- `git checkout AGENTS.md` (plan rule) also wiped my intended Learnings line once; the next-dev block is already committed on main, so the rule only applies to dev-server rewrites. Re-added.
- Prettier reformatted all of `build.mjs` (69 lines); reverted to the 4-line change.
- Restarting `next dev` corrupted `.next/dev/types/routes.d.ts` (`TS1005: ';' expected`, tsc exit 1/2); cleared it, tsc 0.
- lint-staged backs up via `git stash` on every commit (shared stash stack across worktrees); it cleaned up after itself.

> Reflection: one branch per slice off fresh main plus real-browser checks caught two real bugs (stale-index arrow keys, nested `<main>`) · evolve: the plan's "git checkout AGENTS.md" rule should say "only when next dev rewrote the generated block".
