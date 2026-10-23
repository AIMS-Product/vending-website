# Afternoon report, 2026-10-21 (vending-website, $5 Playbook pre-launch)

Handoff: `~/.claude/handoffs/2026-10-22T04-35-12-013Z.md`. Rules: overnight plan section 0. Worktree `~/vending-website-ltf-v2`.
Nothing merged and nothing pushed to main. No prod writes. Prod reads were GETs plus counts-only HEAD queries.
Single agent, no reviewer subagents, no codex.

**Big finding: the $5 offer is already live.** `PLAYBOOK_GUIDE_LIVE` was added to Vercel production about 13h before
this run, and `/playbook` and `/playbook/checkout` 307 to `/playbook/go`. No real sale yet: prod `ltf_orders` holds the 10-20
test rows plus one pending $5 session from 10-21 16:23 UTC.

## Needs Adam (ordered; full click paths in `launch-day.md`, PR #214)

1. **Confirm the flag flip was intended** (`PLAYBOOK_GUIDE_LIVE` on in prod since ~10-21 09:00 PT). If it wasn't, the rollback is in launch-day.md section D.
2. Merge order: #201 (leak guard) first, then #202, #203 and #204. The dry run is clean (below).
3. **#213 report fix:** run section 15 of `APPLY-IN-SQL-EDITOR.md` in the prod SQL editor, then merge. Until then the live
   report shows the two $0 test orders as "2 paid buyers". Either order is safe.
4. Delete the 10-20 test rows (carried item 1). launch-day.md step 3 has a ready-made SQL transaction (counts first).
5. Roll the exposed Stripe test key and the live `rk_live` key (carried item 7). **New:** also rotate the **GHL private
   integration token** (`pit-…`) in `.env.local` line 55, plus whatever secret sits on line 56. My `set -a; . ./.env.local` in
   zsh printed both values into this session's transcript as "command not found" errors. Nothing was committed.
6. Merge vp-webinars **#52** so the board counts $5 sales (still open).
7. Stripe descriptor suffix "PLAYBOOK" (carried 4). GA4 `purchase` check on the first real sale (carried 5).
8. Old #197/#198 deployments (carried 2), VendHub webhook noise owner (carried 6), content-funnel D1-D4 (carried 8): unchanged.
9. **New, S6:** keep the "AI referral" row while it is 0 (labelled as a floor), or drop it until it is non-zero? Default: keep it.
10. **New, local machine:** Docker Desktop stopped responding mid-run (`docker ps` hangs; local Supabase port accepts connections but never answers). I didn't restart it because
    other sessions' stacks (`sm-dbiso`) share it. Restart it when convenient.

## Slices

| #   | Item                              | Status  | PR                                                               | Checks                                                                                                                                                                                                                                                                             |
| --- | --------------------------------- | ------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Merge-train dry run #201-#204     | done    | - (scratch branch, not pushed)                                   | 4 clean merges on main `3d9bb572`; tsc 0 · eslint 0 · vitest 0 (4720 passed). The only auto-merge was `GuideTeaser.tsx` (#204 vs #209-#212), and it reads right. No rebases needed.                                                                                                |
| 2   | #203 review LOWs                  | pushed  | [#203](https://github.com/AIMS-Product/vending-website/pull/203) | Nested `<main>` removed from `/playbook/checkout` and `/playbook/thank-you`. `GUIDE_FORMAT` (from `plays.length`) replaces both "PDF + 8 videos". tsc 0 · eslint 0 · vitest 0 (229). #204's teaser still hardcodes the string; switch it after #203 lands.                         |
| 3   | Admin report QA (seeded local)    | fix PR  | [#213](https://github.com/AIMS-Product/vending-website/pull/213) | All 13 numbers matched hand math in the rendered page (local admin login, playwright). One defect: $0 promo orders counted as buyers. New view and a db-test assertion. tsc 0 · eslint 0 · vitest full 0 · `src/lib/ltf` with the DB tests 0 (24). Negative run blocked by Docker. |
| 4   | Launch-day runbook                | docs PR | [#214](https://github.com/AIMS-Product/vending-website/pull/214) | Claims checked against code and prod GETs (Meta dedup on session id, the access page returns 200, download not gated by the flag).                                                                                                                                                 |
| 5   | S6 organic content, slice 1       | pushed  | [#206](https://github.com/AIMS-Product/vending-website/pull/206) | Counts only. Referrer coverage is about 72% of leads since 07-06. Organic search: 146 leads (Google 129 and Bing 17, no UTMs). AI referrers: 0. Verdict: usable, totals first. Slice 2 is next.                                                                                    |
| 6   | 390/1440 axe pass on merged build | blocked | -                                                                | The dev server hangs on every DB-backed page (local Supabase dead, see Needs Adam 10). The overnight run already did axe on #202 and #203 individually. Redo once Docker is back.                                                                                                  |

Note: there is no A/B "version" in the LTF schema (`ltf_visitors` has no variant column), so the report was QA'd as a single funnel.

## What went wrong

- zsh does not word-split `$F`, so the first prettier/eslint call got one long filename (eslint exit 2). I switched to arrays.
- `set -a; . ./.env.local` leaked two secret values into the transcript (Needs Adam 5). Use `node --env-file=.env.local` instead.
- `rtk npx next dev` in a background task exited 1. `rtk proxy npx next dev` worked.
- The repo's Playwright browsers aren't installed (`chromium_headless_shell-1223` missing), so I used `channel: "chrome"`.
- Docker hung during the old-view negative run of the report test, so that proof is by inspection only.
- The first draft of the #213 PR body had a self-contradicting paragraph. I fixed it with `gh pr edit`.

> Reflection: hand math against seeded data found the one real defect (a $0 order counted as a buyer), and a read-only prod GET found that the flag was already live · next time: never source `.env.local` into the shell, use `node --env-file`.
