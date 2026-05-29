# Project Handover

Last updated: 2026-05-29
Last verified: 2026-05-11, by the commands listed in [Verification](#verification)  
Owner/context: James AIMS / Vendingpreneurs website and admin CMS

## Snapshot

- Purpose: Vendingpreneurs marketing site, lead capture surface, News CMS, and SEO resource page builder.
- Primary users/operators: public visitors and applicants; internal admins creating resource pages, blog/news posts, media assets, reusable claims, proof, CTAs, and source material.
- Production URL: `https://vendingpreneurs.com`
- Repository: /Users/jamesaims/Desktop/Development/vending-website
- Current branch at handover creation: `codex/seo-builder-ux-hierarchy`
- Framework/runtime: Next.js `16.2.4`, React `19.2.4`, Supabase, Vercel.
- Current status: SEO Page Builder v1 is implemented per `docs/seo-page-builder/roadmap.md`, but the repo currently has uncommitted admin/page-builder UX, PRD, and renderer changes. Treat the working tree as active work, not a clean release branch.

## Current State

What works now:

- Public marketing routes live under `src/app`, including core pages, lead routes, news routes, resource routes, `sitemap.ts`, and `robots.ts`.
- Admin CMS routes are protected by Supabase auth plus `app_users` authorization and are wrapped in `AdminShell`.
- Admin CMS sections currently include:
  - `/admin/pages` and `/admin/pages/new` for SEO resource pages.
  - `/admin/news` and `/admin/news/new` for blog/news posts.
  - `/admin/media` for reusable media.
  - `/admin/libraries` for proof items, CTA presets, source documents, source excerpts, and approved claims.
- SEO resource pages render publicly at `/resources/[slug]`; draft previews render at `/resources/preview/[token]`.
- Builder-managed resource redirects are database-backed; legacy/cutover redirects that are not builder-owned still live in `next.config.ts`.
- Lead capture stores server-side audit rows in Supabase before notification attempts.
- News CMS migration guidance exists in `docs/news-cms/migration-handoff.md`.

In progress:

- Admin Studio and SEO builder usability polish are actively being worked on.
- `plans/seo-page-builder-usability/slice-plan.md` records S1-S5 as done and S6 verification blocked by Chrome automation being blocked by an extension UI.
- `plans/seo-readiness-autopilot/slice-plan.md` records S1-S7 as done, S8/S9 pending, and S10 blocked until launch plus Search Console access.
- The current branch has modified files across admin pages, page-builder components, lead form rendering, PRD/roadmap docs, and page-builder content operations.

Blocked or at risk:

- Full verification has not been rerun during this handover-doc pass.
- Chrome smoke for `/admin/pages/new` needs to be rerun after dismissing the blocking Chrome extension UI.
- Production deployment status and live credentials were not rechecked in this pass.
- Launch/cutover still needs production connection checks, section-by-section CMS workflow verification, and owner/admin handover.
- `plans/cutover-readiness/slice-plan.md` still records legacy cutover risks: notification env, editor review of imported news, manual admin live login, DNS owner/window, and PostCSS audit timing.

## Placeholder Admin Access

Use this for local development only.

```bash
# .env.local
ADMIN_DEV_AUTH_BYPASS=1
```

- Local URL: `http://localhost:3000/admin/pages`
- Placeholder local admin email: `dev-admin@dev.invalid`
- Placeholder local admin user id: `00000000-0000-4000-8000-000000000001`
- Role: `admin`
- Password: none. This is an environment-controlled local bypass, not a password login.
- Code path: `src/lib/supabase/dev-auth.ts`, `src/lib/supabase/auth.ts`, and `src/proxy.ts`.

Rules:

- Only use the bypass under `next dev`.
- Never set `ADMIN_DEV_AUTH_BYPASS=1` in Vercel, production, preview, or any non-development environment.
- Real hosted admin access uses `/admin/login` magic links sent to an email that is allowlisted through the Supabase `app_user_emails` / `app_users` flow.
- The placeholder `dev-admin@dev.invalid` does not prove production auth works.

## Working Tree Notes

At handover creation, `git status --short --branch` showed:

- Branch: `codex/seo-builder-ux-hierarchy...origin/codex/seo-builder-ux-hierarchy`
- Modified docs: `docs/seo-page-builder/prd.html`, `docs/seo-page-builder/roadmap.md`
- Modified admin/editor files: admin pages, login, news, media, libraries, `SeoPageEditorForm`, `SeoPageRevisionPanel`, `NewsEditorForm`, `MediaLibraryManager`
- Modified public/builder files: `PublicLeadForm`, `ResourcePageRenderer`, `blocks.ts`, `content-ops.ts`, `content-ops.test.ts`
- Untracked: `.agents/`, `plans/seo-readiness-autopilot/`, `src/components/admin/AdminUi.tsx`, `src/components/sections/ResourcePageContent.tsx`, and temporary browser screenshots.

Before making changes:

```bash
git status --short --branch
git diff --stat
```

Do not revert or overwrite existing dirty files unless James explicitly asks. Assume they are active user/Codex work.

## Recent Changes

- 2026-05-11: Created this living handover doc for temporary developer takeover.
- 2026-05-11: Usability plan shows the first-time SEO page creation flow, technical label cleanup, CTA attribution defaults, next-step card, and inline support panels implemented; Chrome route smoke remains blocked.
- 2026-05-07: Admin CMS shell and local dev auth bypass were documented in the SEO Page Builder roadmap.
- 2026-05-07: SEO Page Builder roadmap records v1 launch-readiness smoke as done, with remaining polish and connection checks tracked separately.
- 2026-05-06: SEO readiness autopilot plan was created with readiness, inspector, publish gate, rich text links, internal link index, and one-click link application slices.
- 2026-05-04 to 2026-05-06: Legacy cutover plan captured lead capture, news import, redirects, sitemap/robots, and launch blockers.

## How To Run

Prerequisites:

- Node/npm compatible with this repo's lockfile.
- Supabase project access or a local `.env.local` populated from Vercel/Supabase.
- Vercel CLI access if pulling env vars or checking deployments.
- For code changes involving Next.js APIs, read the relevant local Next 16 guide in `node_modules/next/dist/docs/` first. This repo uses Next 16 conventions, including `src/proxy.ts` rather than old `middleware.ts`.

Setup:

```bash
npm ci
cp .env.example .env.local
```

Then fill `.env.local` with real non-public secrets from the approved source. Do not paste secret values into this document.

Local development:

```bash
npm run dev
```

Common local URLs:

- Public site: `http://localhost:3000`
- Admin login: `http://localhost:3000/admin/login`
- Admin resource pages: `http://localhost:3000/admin/pages`
- New resource page: `http://localhost:3000/admin/pages/new`
- Admin news: `http://localhost:3000/admin/news`
- Admin media: `http://localhost:3000/admin/media`
- Admin libraries: `http://localhost:3000/admin/libraries`

## Verification

Commands run while creating this handover doc:

```bash
git status --short --branch
git log --oneline -8
git diff --stat
rg --files | rg -i '(^|/)(handover|project[-_ ]?handover|status|context|onboarding|runbook|continuity|transfer|readme)\.md$'
sed -n '1,220p' package.json
sed -n '1,260p' docs/seo-page-builder/roadmap.md
sed -n '1,260p' plans/seo-page-builder-usability/slice-plan.md
sed -n '1,260p' plans/seo-readiness-autopilot/slice-plan.md
sed -n '1,220p' .env.example
sed -n '1,260p' src/lib/supabase/dev-auth.ts
sed -n '1,220p' src/proxy.ts
```

Recommended checks before handing work to another developer:

```bash
npm run typecheck
npm run lint
npm run test
npm run format:check
npm run build
git diff --check
```

Focused checks for current work:

```bash
npm test -- src/lib/page-builder/blocks.test.ts src/lib/page-builder/seo-readiness.test.ts
npm test -- src/lib/page-builder/content-ops.test.ts
npm test -- src/lib/services/seo-pages.test.ts src/lib/services/seo-page-public.test.ts
npm test -- src/lib/services/leads.test.ts
```

Browser checks still needed:

- Local Chrome smoke for `/admin/pages/new` after the Chrome extension UI blocker is dismissed.
- Admin section pass for pages, news, media, and libraries.
- Public resource render and lead submission smoke after the next deploy.
- Production magic-link admin login smoke with a real allowlisted email.

## Architecture

Key entrypoints:

- `src/app/page.tsx`: public homepage.
- `src/app/[legacyLeadPath]/page.tsx`: legacy lead path handling.
- `src/app/apply/page.tsx` and `src/app/contact/page.tsx`: lead forms.
- `src/app/admin/**`: admin CMS routes.
- `src/app/resources/[slug]/page.tsx`: published resource page route.
- `src/app/resources/preview/[token]/page.tsx`: draft preview route.
- `src/app/news/**`: public news routes and RSS feed.
- `src/app/sitemap.ts` and `src/app/robots.ts`: crawl surfaces.
- `src/proxy.ts`: Next 16 proxy for Supabase cookie refresh, admin route gate, resource redirect lookup, and resource 404 protection.

Important modules:

- `src/lib/supabase/auth.ts`: `requireAdmin()` and admin authorization.
- `src/lib/supabase/dev-auth.ts`: local-only placeholder admin bypass.
- `src/lib/supabase/admin.ts`: service-role Supabase client for server-only admin operations.
- `src/lib/services/seo-pages.ts`: page builder service layer.
- `src/lib/services/seo-page-public.ts`: public resource lookup, preview, and redirect helpers.
- `src/lib/services/news.ts`: News CMS service layer.
- `src/lib/services/leads.ts`: lead validation, storage, and notification flow.
- `src/lib/page-builder/blocks.ts`: block schema and validation contract.
- `src/lib/page-builder/seo-readiness.ts`: SEO readiness contract.
- `src/lib/page-builder/internal-link-suggestions.ts`: deterministic internal link suggestions.
- `src/components/admin/AdminShell.tsx`: shared admin frame.
- `src/components/admin/SeoPageEditorForm.tsx`: main SEO page editor.
- `src/components/admin/AdminUi.tsx`: shared admin UI classes/components.
- `src/components/sections/ResourcePageRenderer.tsx` and `src/components/sections/ResourcePageContent.tsx`: public/editor resource rendering.

Data flow summary:

1. Admin signs in via `/admin/login` or uses the local-only dev bypass.
2. `src/proxy.ts` refreshes Supabase session cookies and blocks non-admin users from `/admin/*`.
3. Admin pages and Server Actions call `requireAdmin()` as a second app-layer gate.
4. Supabase RLS and service-role-only server modules form the database boundary.
5. SEO page drafts are stored as structured content and publish to immutable snapshots/revisions.
6. Public resource pages render only published content; preview tokens are separate and should not be indexed.
7. Lead forms write audit rows first, then attempt notification.

## Data And Integrations

Data stores:

- Supabase Postgres.
- Supabase Auth.
- Supabase Storage buckets:
  - `news-images`
  - `page-builder-media`

Core tables represented in migrations:

- `news_posts`
- `app_users`
- `app_user_emails`
- `lead_submissions`
- `media_assets`
- `seo_pages`
- `page_revisions`
- `redirects`
- `page_preview_tokens`
- `proof_items`
- `cta_presets`
- `source_documents`
- `source_excerpts`
- `approved_claims`
- `ai_page_proposals`

External services:

- Vercel for hosting, env vars, analytics, and speed insights.
- Supabase for auth/database/storage.
- Resend for lead notification email.
- Slack webhook is optional for lead notifications.
- OpenAI is used by the SEO Page Builder AI proposal agent.
- Webflow remains useful as historical/cutover evidence, not as the current implementation source of truth.

Background jobs, webhooks, queues, or scheduled tasks:

- No cron or queue worker was found in this handover pass.
- Lead notifications run inline after lead audit storage.
- Any future Search Console or ranking import is blocked until launch and account/property access are available.

## Environment

Required or supported variables by name only:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_DEV_AUTH_BYPASS`
- `RESEND_API_KEY`
- `LEAD_NOTIFICATION_TO`
- `LEAD_NOTIFICATION_FROM`
- `LEAD_NOTIFICATION_SUBJECT_PREFIX`
- `SLACK_WEBHOOK_URL`
- `OPENAI_API_KEY`
- `OPENAI_SEO_MODEL`
- `OPENAI_SEO_REASONING_EFFORT`
- `NEXT_PUBLIC_GA_ID`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Where variables are managed:

- Local: `.env.local`
- Template: `.env.example`
- Hosted: Vercel project env vars, likely pullable with `vercel env pull` once authenticated.
- Supabase project values come from the Vendingpreneurs Supabase project.

Rules:

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `OPENAI_API_KEY`, Sentry tokens, or real webhook URLs in browser code or docs.
- Only `NEXT_PUBLIC_*` variables are browser-visible.
- `ADMIN_DEV_AUTH_BYPASS=1` is local-only and should stay absent or `0` outside local development.

## Deployment

Deployment target:

- Vercel.

Deploy process:

- Normal flow is commit and push, then Vercel builds the branch/production target.
- Use repo-appropriate checks before pushing: typecheck, lint, tests, format check, build, and browser smoke for affected flows.
- If using `/cap`, keep unrelated dirty files out of the commit and verify deploy/env state before final push.

Rollback notes:

- For code: revert or redeploy the last known good Vercel deployment.
- For database: migrations are forward-only; write a corrective migration rather than editing applied migrations.
- For published resource pages: use admin revision rollback where appropriate.
- For redirects: builder-owned redirects are database-backed; legacy static redirects live in `next.config.ts`.

Needs verification:

- Current production deployment ID and readiness.
- Vercel env variable parity across local, preview, and production.
- Supabase redirect URL allowlist for the active production and preview origins.

## Safety Notes

- Admin access has three layers: Next 16 proxy gate, `requireAdmin()`, and Supabase RLS.
- Do not trust Supabase `auth.getSession()` for authorization; current auth code uses `auth.getUser()` for server-side verification.
- Service-role Supabase client belongs in server-only modules only.
- Lead submissions contain PII. Do not log full payloads or expose rows publicly.
- Public forms must store audit rows before notification. Notification failure should not lose the lead.
- AI proposals must remain source-bound, schema-validated, and admin-approved before insertion.
- Published pages use snapshots/revisions. Do not mutate published content silently through library changes.
- Preview URLs must not be added to sitemap or indexed.
- Resource slug changes should create database-backed redirects.
- Static redirects in `next.config.ts` should remain for legacy cutover paths, not builder-owned URL changes.
- Any migration touching RLS, storage policies, lead data, admin auth, or redirects is launch-sensitive and needs focused review.

## Active Docs

Read these first in a new session:

- `AGENTS.md`: repo-specific agent rule. Important: read local Next 16 docs before writing Next-specific code.
- `docs/PROJECT_HANDOVER.md`: this handover.
- `docs/seo-page-builder/roadmap.md`: active SEO Page Builder source of truth.
- `docs/seo-page-builder/prd.html`: polished PRD/status artifact.
- `plans/seo-page-builder-usability/slice-plan.md`: current UX polish and verification plan.
- `plans/seo-readiness-autopilot/slice-plan.md`: SEO readiness/autopilot roadmap.
- `plans/cutover-readiness/slice-plan.md`: legacy Webflow/cutover evidence and launch blockers.
- `docs/news-cms/migration-handoff.md`: News CMS migration operating instructions.
- `docs/cutover/webflow-url-inventory.md` and `docs/cutover/redirect-matrix.md`: legacy route evidence.

## Takeover Roadmap

Use this roadmap for the next few days while James is away. Update the status column as work progresses.

| Priority | Status  | Workstream                      | Next action                                                                                                                               | Evidence to record                                                                                           |
| -------- | ------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| P0       | Open    | Protect current worktree        | Run `git status --short --branch` and identify which dirty files are part of the current UX/admin pass.                                   | Diff summary and any files intentionally left untouched.                                                     |
| P0       | Blocked | SEO builder UX verification     | Dismiss the Chrome extension UI blocker and rerun Chrome smoke on `/admin/pages/new`.                                                     | Screenshot or notes proving first-time creation, drawer, save/publish controls, and no fresh console errors. |
| P0       | Open    | Automated quality gate          | Run typecheck, lint, tests, format check, build, and `git diff --check` after the current dirty UX changes are stable.                    | Command list, date, and pass/fail summary.                                                                   |
| P0       | Open    | Admin access handover           | Confirm who will use real magic-link admin access while James is away; add/verify their Supabase allowlist row.                           | Admin email owner confirmed; do not write real secrets here.                                                 |
| P1       | Open    | Production connection check     | Verify Vercel env vars, Supabase URL/keys, storage buckets, Resend sender/recipient, optional Slack webhook, and OpenAI SEO env.          | Checklist with current/verified/blocked state.                                                               |
| P1       | Open    | CMS section pass                | Browser-test pages, news, media, libraries, resource preview, and public resource render.                                                 | Section-by-section notes with issues and screenshots where useful.                                           |
| P1       | Open    | Docs sync                       | Reconcile `docs/seo-page-builder/roadmap.md`, `docs/seo-page-builder/prd.html`, this handover, and any Asana tracking after verification. | Updated docs with consistent status language.                                                                |
| P1       | Open    | Josh handover                   | Schedule or prepare a handover walkthrough covering admin routes, auth, content workflow, verification gates, and launch blockers.        | Meeting notes or checklist of covered items.                                                                 |
| P2       | Pending | SEO readiness autopilot         | Continue S8 audit snapshots/diffs after UX verification and quality gates.                                                                | Migration/design notes, tests, and UI evidence.                                                              |
| P2       | Pending | AI semantic recommendations     | Continue S9 only after S8 exists; keep source-bound validation and approval-only insertion.                                               | Proposal data contract and approval evidence.                                                                |
| P2       | Blocked | Search Console/ranking feedback | Continue S10 only after site launch and Search Console property/access are available.                                                     | GSC access confirmed and integration plan.                                                                   |

## Open Work

Next recommended actions:

- Finish the current admin/SEO builder UX verification gate before adding new features.
- Run the full automated check suite after the dirty working tree settles.
- Complete a production connection check before any launch/cutover claim.
- Keep this document updated after each meaningful feature, verification pass, deployment, or blocker decision.

Open decisions:

- Which real admin emails should be allowlisted for handover coverage.
- Who owns final migrated-news review/publish decisions.
- Whether landing pages/campaign pages remain planned only or enter the active admin scope.
- Final launch/DNS cutover window and owner.
- Whether to enable Slack notifications in addition to Resend.
- When to revisit the PostCSS advisory and Next stable upgrade path.

Known issues:

- Chrome automation was blocked by an extension UI during the latest UX verification attempt.
- Current branch is dirty with substantial implementation work.
- Production deployment and env parity were not rechecked during this handover pass.
- Search Console/ranking feedback is intentionally blocked until launch and access are available.

## Takeover Checklist

First 30-60 minutes:

- Read this handover.
- Read `AGENTS.md`, then read any relevant local Next 16 docs under `node_modules/next/dist/docs/` before touching Next-specific APIs.
- Run `git status --short --branch` and `git diff --stat`.
- Review `docs/seo-page-builder/roadmap.md`, `plans/seo-page-builder-usability/slice-plan.md`, and `plans/seo-readiness-autopilot/slice-plan.md`.
- Populate `.env.local` from approved sources without copying secrets into docs or chat.
- For local admin, set `ADMIN_DEV_AUTH_BYPASS=1` and open `/admin/pages`.
- Confirm whether you are continuing dirty UX work or starting a clean documentation/status pass.
- Run the verification commands relevant to your change.
- Update this handover when a feature, blocker, deployment, verification result, or handover decision changes.

## Change Log

- 2026-05-29: Auto-recorded commit ca44990 - Merge branch 'codex/seo-builder-teardown-remediation'. Files: no file list available. after `git merge codex/seo-builder-teardown-remediation --no-ff -m "$(cat <<'EOF'
  Merge branch 'codex/seo-builder-teardown-remediation'

SEO builder teardown remediation: atomic state-transition functions,
loud public page-load errors, slimmed admin resource list, and the
missing list-state library that the slim-list page depends on.
EOF
)" 2>&1` <!-- handover-auto:commit ca449902cc4803095fc7af99505da6d60cc030db -->

- 2026-05-29: Auto-recorded commit 1032772 - fix(admin): commit missing seo-pages list-state library. Files: src/lib/admin/list-state.test.ts, src/lib/admin/list-state.ts, src/lib/admin/seo-pages-list.ts. after `git commit -m "$(cat <<'EOF'
  fix(admin): commit missing seo-pages list-state library

b07e2da imported @/lib/admin/seo-pages-list in pages/page.tsx but the
library files were never staged, breaking the Vercel preview build with
module-not-found. Adds list-state.ts (shared pagination/filter utils),
seo-pages-list.ts (SEO page list state builder), and list-state.test.ts.
EOF
)"` <!-- handover-auto:commit 10327722b99c04f3767dc3c11ac418edb3e75f64 -->

- 2026-05-29: Auto-recorded commit b07e2da - feat(admin): slim resource list to title/keyword/readiness/status/actions. Files: docs/design/admin-studio.md, src/app/admin/pages/page.tsx, src/components/admin/seo-page-editor/SeoPublishPanel.tsx. after `git push -u origin HEAD 2>&1` <!-- handover-auto:commit b07e2da51ebf7dea7823875cfde47e9468d4ebb2 -->
- 2026-05-11: Created initial living handover with current repo state, local placeholder admin access, run/verify commands, architecture notes, env names, safety notes, and takeover roadmap.
