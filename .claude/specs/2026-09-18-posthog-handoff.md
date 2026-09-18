# Handoff: finish the PostHog rollout (vending-website)

Paste this into a fresh session. Everything below was true at 2026-09-18 ~12:00 PT.

## Where things are

- Work lives in the worktree `~/vending-website-posthog`, branch `feat/posthog-conversion-tracking`,
  commit `cabf97b` (+ this handoff commit). PR #35: https://github.com/AIMS-Product/vending-website/pull/35
- `~/vending-website` is the SHARED checkout on `main`. Another session commits there. Do NOT
  `git checkout -b` there, do not `cat >` a path without `ls`-ing it first. Work only in the worktree.
- `main` carries two commits from that other session made today: `bf3d535` (channel journeys) and
  `c799a47` (Close UTMs, cherry-picked onto main after it landed on my branch by accident). Check
  `git log origin/main -3` before merging; PR #35 was rebased onto `c799a47`.
- Spec (read first): `.claude/specs/2026-09-18-posthog-conversion-tracking.md`.
- Repo is npm, not pnpm. In the worktree `node_modules` is a symlink to the main checkout's; run
  `./node_modules/.bin/{tsc,vitest,eslint,prettier,next}` directly and build with `next build --webpack`.
- Verified locally before push: tsc 0 errors · eslint 0 · prettier clean · vitest 306 files /
  2611 tests green · `next build --webpack` compiled. CodeRabbit: no inline findings.

## What PostHog does here (do not widen it)

PostHog owns the pre-submit behaviour layer only: `$pageview`/`$pageleave` (scroll depth),
autocapture, rage + dead clicks, heatmaps, replay, and `form_viewed → form_started →
form_field_completed → form_submit_attempted → form_submitted | form_submit_failed | form_abandoned`
on every `form[data-form-step]`, plus `calendar_viewed`, `calendar_booked`, `chat_opened`,
`chat_started`, and mirrored `landing_viewed` / `cta_clicked` / `popup_*`.
Supabase and Close own everything from the first submit. Never quote PostHog `form_submitted` as
a lead count, never build booked/won goals in PostHog, never map channels in PostHog
(`resolveChannel()` is the only definition). The seam is the `vp_session_id` event property,
stamped on every event in `before_send` together with `source_path` (folded via
`canonicalFunnelPath`, `src/lib/analytics/canonical-path.ts`), `page_group`, `vp_utm_*`,
`environment`. Nobody is identified; persons stay anonymous.

Key files: `src/instrumentation-client.ts` (init, Sentry untouched), `next.config.ts` (rewrites
`/api/ph/*` → us.i.posthog.com, `skipTrailingSlashRedirect: true`), `src/proxy.ts` (public
trailing-slash 308 now lives here), `src/lib/tracking/{posthog,event-context,form-tracking}.ts`,
`src/components/tracking/FormTracker.tsx`, `PublicLeadForm.tsx` / `NewsletterSignupForm.tsx`
(`trackFormResult` beside the GTM pushes), `CalendlyBookingRedirect.tsx`, `ChatWidget.tsx`.

Env: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (US cloud, `phc_kkLx…`) is set in Vercel Production,
Preview, Development and in both `.env.local` files. Inlined at build time: env edits need a
redeploy. Vercel also holds unused `VITE_POSTHOG_*`, `NUXT_PUBLIC_POSTHOG_*`, `PUBLIC_POSTHOG_*`
and `NEXT_PUBLIC_POSTHOG_HOST` from the PostHog wizard; the code reads none of them.

## The blocker, and the order of work

Preview deployments are behind Vercel Deployment Protection (every request 302s to Vercel SSO).
Curl, headless Playwright and the aside browser (not logged into Vercel) all bounced. The repo
rule is: verify on the `*.vercel.app` URL before merging to `main`, because a push to `main`
publishes to www.vendingpreneurs.com within a minute.

1. Unblock the preview. Preferred: Adam enables Vercel → vending-website → Settings → Deployment
   Protection → "Protection Bypass for Automation". Then `vercel env pull` exposes
   `VERCEL_AUTOMATION_BYPASS_SECRET`; send it as header `x-vercel-protection-bypass` (curl) or via
   `scripts/ph-preview-check.mjs` (reads the env var). Alternatives: Adam checks it himself in a
   logged-in browser, or says `ship` to merge on local verification.
2. Verify the preview (branch alias
   `https://vending-website-git-feat-posthog-conv-3a6f11-aimanagingservices.vercel.app`):
   ```
   H="x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET"
   curl -s -o /dev/null -w '%{http_code}\n' -H "$H" -X POST "$P/api/ph/e/?ip=1" -H 'content-type: application/json' -d '{"api_key":"x","batch":[]}'   # 200 (prod today: 308)
   curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H "$H" "$P/about/"                                                             # 308 → /about
   curl -s -o /dev/null -w '%{http_code}\n' -H "$H" "$P/api/ph/static/array.js"                                                            # 200
   VERCEL_AUTOMATION_BYPASS_SECRET=… node scripts/ph-preview-check.mjs "$P"   # prints proxy statuses + decoded events; every event must carry vp_session_id
   ```
   Expected from the script on `/contact`: `$pageview` with `page_group=funnel`,
   `source_path=/contact`, `environment=preview`; `form_started` with `first_field=full_name`;
   `form_field_completed`; on navigating away, `form_abandoned`. Then check PostHog → Activity.
3. Merge PR #35 (squash, repo convention). Then on production:
   `curl -I https://www.vendingpreneurs.com/about/` → 308 `/about`; `POST /api/ph/e/` → 200;
   PostHog Activity shows `$pageview` with `environment=production`; nothing from `/admin/*`;
   `/api/csp-report` shows no new violation kinds.
4. PostHog configuration (clicks, spec section "PostHog configuration"): replay on (mask inputs),
   heatmaps, toolbar URLs; internal-user filter `environment != production` plus staff emails;
   dashboard "Website funnels (pre-submit)" with the per-page funnel broken down by `source_path`
   and by `vp_utm_source`, `form_field_completed` by `field`, `form_abandoned` by `last_field`,
   `calendar_viewed → calendar_booked`, `chat_opened → chat_started`; replay saved filters
   ("started, no submit"; "submit failed"; "saw calendar, no booking"); weekly alert on
   `form_submitted / funnel $pageview` dropping > 25%.
5. `/privacy`: add one sentence on analytics and session recording. Adam approves copy before live.
6. Cleanup: delete the unused Vercel PostHog vars; `git worktree remove ~/vending-website-posthog`
   after merge; delete the remote branch.
7. After 7 days, reconcile: PostHog `form_submitted`/day ÷ `lead_submissions` rows/day should be
   0.85–0.95 (below 0.8 = proxy broken); PostHog sessions vs GA4 sessions on `/booking-youtube`
   within ~10%. Not built on purpose: server-side `lead_captured`/`call_booked` into PostHog
   (one posthog-node call in `submitLead` if replay filters by "became a lead" ever matter).

## Traps

- `rtk` mangles greps with parens/alternation and `git diff`; use `/usr/bin/grep` and `/usr/bin/git`.
- zsh: an unquoted `$VAR` does not word-split, and `ls a b*` aborts entirely if one glob misses,
  so "no matches found" proves nothing. Prefer `bash <<'BASH' … BASH` for multi-file git commands.
- `curl` on a page returns a ~600-byte streamed shell; assert on DOM with Playwright, curl for headers only.
- Test leads on preview reach the real Close org; use `posthog-test+<date>@vendingpreneurs.com`.
- The PostHog chunk is ~94 kB gz (posthog-js itself); recorder loads lazily through `/api/ph/static/`.
