<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:domain-cutover-rules -->

# Custom domain cutover status

CUT OVER 2026-07-27. `vendingpreneurs.com` and `www.vendingpreneurs.com` resolve
through Vercel (apex + www A records at `76.76.21.21`) and serve this app. The
Webflow rollback proxy that previously answered on those hosts (identified by the
`x-vp-rollback-origin: webflow` response header) has been replaced.

Public-domain behavior is now app behavior: treat a wrong response on
`www.vendingpreneurs.com` as a real bug, not as legacy Webflow noise.

Rollback path if production must be reverted: re-promote the last rollback-proxy
production deployment. DNS does not change in either direction.

<!-- END:domain-cutover-rules -->

<!-- BEGIN:production-deploy-rules -->

# Production deploys

Production is live. Pushes to `main` publish to the custom domains.

- `main` is the release branch; deploy by merging into it, never by
  `vercel --prod` from a working tree.
- Verify a deployment on its own `*.vercel.app` URL before promoting anything to
  the custom domains.
- Leads flow to Close CRM from production on a 10-minute cron. Changes to
  `src/lib/close/*` or the qualification intake path are customer-visible the
  moment they deploy — verify on preview against the real Close org first.

<!-- END:production-deploy-rules -->

<!-- BEGIN:admin-studio-design-rules -->

# Admin Studio and SEO Page Builder design contracts

Before changing `/admin` CMS UI, SEO Page Builder UI, editor controls, block editing, visual polish, or browser-facing admin workflows, read:

- `docs/design/admin-studio.md`
- `docs/design/page-builder.md`
- `docs/design/page-builder-blocks.md`
- `docs/design/visual-review-checklist.md`

These are execution contracts, not inspiration docs. Do not introduce UI that violates them without updating the relevant design contract in the same change.

The active product roadmap remains `docs/seo-page-builder/roadmap.md`; the design docs define how the admin/editor experience should be implemented and verified.

<!-- END:admin-studio-design-rules -->

<!-- BEGIN:feature-orchestrator-rules -->

# Feature Orchestrator flow

When work is being executed from a tracked feature graph under `plans/<feature-slug>/`,
keep the canonical workflow inside the `feature-orchestrator` skill. Use stage
skills only as explicit orchestrator stages, such as `feature-slice-worker`,
`feature-integrator`, or `feature-proof`, and do not switch to a standalone
implementation skill as the primary workflow for a graph node.

The orchestrator owns `plan.md` and `progress.md`. Worker evidence belongs under
`plans/<feature-slug>/agent-runs/` and should be integrated back into
`progress.md` only by the orchestrator stage.

<!-- END:feature-orchestrator-rules -->

<!-- BEGIN:builder-release-train-rules -->

# Website Builder release train

For Website Builder / SEO Page Builder work tracked under
`plans/website-builder-feedback-v2/` and follow-up graphs, use a local-only
stacked release train until the user explicitly asks to push a branch or create
a PR.

Use `docs/stack-release.md` as the release-train playbook.

Current release baseline:

- S1-S3 are already landed on `main`.
- S4-S12 and follow-up scheduled publishing runner work should be split from the
  dirty working tree into dependency-ordered local branches/commits.
- Do not push these branches, open PRs, or trigger Vercel previews until the user
  explicitly chooses the next slice to release.

When continuing this work:

- Add new changes to the appropriate local stack branch, or create a new branch
  on top of the latest unreleased stack branch when the work is a later slice.
- Keep branches stacked in dependency order so each future PR can target the
  previous slice branch rather than all PRs targeting `main`.
- Preserve orchestrator evidence in the relevant `plans/<feature-slug>/`
  folder, but avoid mixing unrelated cutover/docs/report/tmp artifacts into
  release-train commits.
- When using `cap` for this release train, run it as a local commit/verification
  flow only. Do not use the default cap push/deploy path for unreleased stack
  branches.
- Treat any push, PR creation, Vercel preview, or production release as an
  explicit user-controlled step, not part of ordinary implementation.
- The repo-local Husky `pre-push` guard blocks stack branch pushes by default.
  Only bypass it for the user-selected release slice with
  `ALLOW_RELEASE_TRAIN_PUSH=1`.

<!-- END:builder-release-train-rules -->

# Learnings

- GHL v2 workflow email stats (`/emails/locations/{loc}/campaigns/stats/workflow-campaigns/{id}`, Version `v3`) are lifetime totals with no date range. The ghl-email connector snapshots them daily into `ghl_email_stats` and writes the day-over-day difference; history starts the day after the first run. There is no per-workflow SMS stats endpoint; SMS counts would need a full `/conversations/search` pass, which is too slow for a cron.
- Metricool's brand summary (`/v2/analytics/brand-summary/posts`) returns every network in one call, but its `metrics` map is untyped in the published OpenAPI file. `readMetric` in `src/lib/metricool/client.ts` reads tolerantly and the raw map is stored on `metricool_posts.metrics`; check the first live row before trusting reach / impressions / clicks names.
- Metricool: the Vendingpreneurs (6626386) and Mike (6633336) brands share one Facebook page, so the same post ids come back under both blog ids; `metricool-sync.ts` lets the first brand in `METRICOOL_BLOG_IDS` own a post. Instagram ids differ between brand-summary (graph id) and the typed `/v2/analytics/posts/instagram` rows (media id); the post URL is the join. Brand-summary never reports reach or clicks; only the typed endpoints do.
- `channel_daily` is keyed on the six link dimensions only; `channel` is derived from `source` (+ `medium` for paid) and overwritten on every upsert. Never put a derived column in a spine key: with `channel` in the key, each rename forked every old row and the dashboard double counted (2,788 keys on 2026-09-11). Webinar rows keep their label via the `channel_daily_keep_program_channel` trigger.
- YouTube Analytics channel reports cannot combine `video` and `day` dimensions; per video per day is one request per day with `dimensions=video`.
- `feat/unified-channels` was cut before PRs #23–#27 landed as squashes, so merging main into it conflicted on ~25 files. Cherry-picking the slice commits onto a fresh branch from main (`feat/unified-channels-main`) applied cleanly.
- Next's trailing-slash 308 is switched off (`skipTrailingSlashRedirect`) so the PostHog reverse proxy at `/api/ph/*` can receive `/e/`, `/s/`, `/flags/` as posthog-js sends them; `src/proxy.ts` performs the 308 for public pages instead. Any proxy-matcher or rewrite change must keep `curl -I /about/` = 308 to `/about` and `curl -X POST /api/ph/e/` = 200.
- `channel_daily.source = 'ghl_form'` going to zero leads after **2026-08-25 is correct, not a broken connector**. Every `ghl_form` row that ever carried leads is the GHL **Waitlist Form** (`LZ4wWLGozv6Gt813E3XM`, medium `waitlist`, channel Webinar, 139 leads all-time); its last submission was 2026-08-25T18:30:34Z and the form still exists in GHL, unfilled. Every other form with live traffic is in `FORM_ROUTES` and writes under its real source (`mike-ig`, `anthony-ig`, `vsl`, `website`, `meta_ads`), so nothing is left to land on the `ghl_form` fallback tag. Verified 2026-09-18 against the GHL API: 3,583 submissions 09-01..09-18, of which 3,144 are webinar-registration forms (skipped by `WEBINAR_FORM_PATTERN`, already counted as registrations) and 1 is Course Access (excluded), leaving 438 — and `channel_daily` holds exactly 438 for those days. **Do not back-fill and do not loosen the skip regex.** Ask whether the waitlist form was retired on purpose.
- Won deals and revenue by channel come from Close opportunities (`src/lib/services/close-wins.ts`: won by `date_won`, credited to the lead's "Funnel Name DEAL (Opp)"), never from `lead_submissions`. Webinar buyers register on GHL and have no site lead row, so any lead-based won count reads them as 0. Verified 2026-09-18: 249 won deals since June 1 = Close exactly.
- A "shown" call is one a rep logged `First Call Show Up = yes` in Close (`classifyBookedCall`), on every tab. Never derive shows as booked minus no-show/canceled; that counted every unlogged call as shown.
- `channel_daily.visits` from May to 2026-09-18 was 13-43% high from GA4 provisional keys left behind; repaired day by day with `scripts/channel-visits-repair.mjs` (every month = GA4 exactly). Re-run it (dry run first) if Channels visits ever drift from GA4 by more than ~2%. Never run GA4 channel reports wider than one day for a repair: wider reports fold into `(other)`.
- SteelTrap's weekly "booked" = Close leads with `First Sales Call Booked Date` in the Fri–Thu week, **minus leads whose current status is "Canceled (by Lead)" or "Outside the US", and the "LTF - Quiz Funnel" funnel** (`crm_silver_to_gold_lakebase.py` `DEFAULT_MEETING_BOOKED_EXCLUDED_*`). No email dedupe, no lane filter. The Close view tab (`close-week-view.ts`) applies the same rule; Sep 11–17 = 162 / 97 / 62 / 14 / $87,134. `close_lead_funnel` must be pruned after each complete crawl, or leads whose booked date was cleared (or were deleted) stay counted forever.
- Metricool ad rows carry the campaign NAME in `content`, which is part of the spine key, and the Meta webinar campaign is renamed every week ("Sep 15" → "Sep 22"). `clearRenamedAdRows` in `metricool-sync.ts` blanks a campaign day stored under an older name after each run; without it Sep 15 counted $462 twice. Verified 2026-09-19: August Meta spend in `channel_daily` = Meta's own account total ($45,322.36) to the cent. Webinar ad spend buys registrations, so it is priced per sign-up on Channels and left out of Executive cost per lead.
