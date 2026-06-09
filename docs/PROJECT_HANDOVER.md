# Project Handover

Last updated: 2026-06-10
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
  - `/admin/settings/users` for account access, roles, password setup/reset emails, and account audit events.
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
- Role: `super_admin`
- Password: none. This is an environment-controlled local bypass, not a password login.
- Code path: `src/lib/supabase/dev-auth.ts`, `src/lib/supabase/auth.ts`, and `src/proxy.ts`.

Rules:

- Only use the bypass under `next dev`.
- Never set `ADMIN_DEV_AUTH_BYPASS=1` in Vercel, production, preview, or any non-development environment.
- Real hosted admin access uses `/admin/login` email/password auth. Password setup and reset emails come from Supabase Auth and land back on the app reset flow.
- Super admins manage access in `/admin/settings/users`. The `app_user_emails` table remains the invite/access source, `app_users` remains the runtime authorization gate, and `app_user_events` records account-management audit events.
- The placeholder `dev-admin@dev.invalid` does not prove production password auth, reset emails, or Supabase Dashboard redirect/template settings work.

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
- Production email/password admin login and password reset smoke with a real `super_admin` account after Supabase Dashboard auth settings and redirect URLs are configured.

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
- `app_user_events`
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
- Supabase Auth Dashboard needs email/password enabled, anonymous self-signup disabled for the admin app, and recovery/setup redirect URLs allowed for the relevant localhost, preview, and production origins.

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
| P0       | Open    | Admin access handover           | Confirm who will use real email/password admin access while James is away; add/verify their account from `/admin/settings/users`.         | Super admin owner confirmed; do not write real secrets here.                                                 |
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

- Which real admin emails should be invited from `/admin/settings/users` for handover coverage.
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
- For local admin, set `ADMIN_DEV_AUTH_BYPASS=1` and open `/admin/pages` or `/admin/settings/users`.
- Confirm whether you are continuing dirty UX work or starting a clean documentation/status pass.
- Run the verification commands relevant to your change.
- Update this handover when a feature, blocker, deployment, verification result, or handover decision changes.

## Change Log

- 2026-06-10: Auto-recorded commit 11a3464 - chore(handover): record release commits in change log. Files: docs/PROJECT_HANDOVER.md. after `git add docs/PROJECT_HANDOVER.md && git commit -m "$(cat <<'EOF'
  chore(handover): record release commits in change log

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)" 2>&1 | tail -2 && git status --short && echo "TREE_CHECK_DONE"` <!-- handover-auto:commit 11a34646a8f2810d431777b460cabc0032579eb9 -->

- 2026-06-10: Auto-recorded commit 54cc06e - chore(plans): record admin split plan and seo confidence report. Files: plans/react-doctor-admin-component-split/agent-runs/s0-baseline-2026-06-09.md, plans/react-doctor-admin-component-split/agent-runs/s1-admin-shell-2026-06-09.md, plans/react-doctor-admin-component-split/agent-runs/s2-admin-pages-page-2026-06-09.md, plans/react-doctor-admin-component-split/agent-runs/s3-integration-proof-2026-06-09.md, plans/react-doctor-admin-component-split/decisions.md, plans/react-doctor-admin-component-split/plan.md, plans/react-doctor-admin-component-split/progress.md, plans/react-doctor-admin-component-split/screenshots/admin-media-desktop.png; +10 more. after `git add plans/react-doctor-admin-component-split reports/ai-page-builder-seo-confidence-2026-06-09 && git commit -m "$(cat <<'EOF'
  chore(plans): record admin split plan and seo confidence report

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)" 2>&1 | tail -2 && git status --short | head -5 && echo "TREE_STATE_ABOVE" && git log --oneline -6` <!-- handover-auto:commit 54cc06e9559e87232bb704cfd3d6032b8a3a4996 -->

- 2026-06-10: Auto-recorded commit a325b68 - fix(page-builder): harden ai chat contract and split server modules. Files: src/lib/page-builder/ai-chat-draft-copy.ts, src/lib/page-builder/ai-chat-intent-fallback.test.ts, src/lib/page-builder/ai-chat-intent-fallback.ts, src/lib/page-builder/ai-chat-prompt.test.ts, src/lib/page-builder/ai-chat-prompt.ts, src/lib/page-builder/ai-chat.test.ts, src/lib/page-builder/ai-chat.ts, src/lib/services/openai-page-builder-chat.test.ts; +1 more. after `git add src/lib/page-builder/ai-chat.ts src/lib/page-builder/ai-chat.test.ts src/lib/page-builder/ai-chat-prompt.ts src/lib/page-builder/ai-chat-prompt.test.ts src/lib/page-builder/ai-chat-intent-fallback.ts src/lib/page-builder/ai-chat-intent-fallback.test.ts src/lib/page-builder/ai-chat-draft-copy.ts src/lib/services/openai-page-builder-chat.ts src/lib/services/openai-page-builder-chat.test.ts && git commit -m "$(cat <<'EOF'
  fix(page-builder): harden ai chat contract and split server modules

Dynamic edits passing null no longer flatten rich-text structure; the
SEO quality gate now replaces a rejected model draft instead of letting
it apply first; dynamic edit tools resolve by block-id suffix so batches
survive flatten-index drift; image edits honor url through the safe
source allowlist; overlong assistant messages are truncated instead of
discarding valid tool calls; Cerebras failures are labeled correctly.

ai-chat.ts is split into a client-shared apply engine plus server-only
prompt, intent-fallback, and draft-copy modules, keeping the system
prompt and template corpus out of the admin bundle. Fallback-generated
responses now carry source: "intent-fallback".

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)" 2>&1 | tail -3` <!-- handover-auto:commit a325b683caec4c80f6ea9328ae5b36e4e059c700 -->

- 2026-06-10: Auto-recorded commit bcb78a8 - fix(page-builder): own scheduled-publish state and guard the purge path. Files: scripts/purge-seo-pages.mjs, src/app/admin/pages/actions.test.ts, src/app/admin/pages/actions.ts, src/components/admin/seo-page-editor/SeoPublishPanel.tsx, src/components/admin/seo-page-editor/editor-autosave-payload.ts, src/components/admin/seo-page-editor/useSeoPageEditorController.ts, src/lib/services/ai-page-proposals.test.ts, src/lib/services/ai-page-proposals.ts; +12 more. after `git add src/app/admin/pages/actions.ts src/app/admin/pages/actions.test.ts src/components/admin/seo-page-editor/SeoPublishPanel.tsx src/components/admin/seo-page-editor/editor-autosave-payload.ts src/components/admin/seo-page-editor/useSeoPageEditorController.ts src/lib/services/seo-pages.ts src/lib/services/seo-pages.test.ts src/lib/services/seo-page-scheduler.ts src/lib/services/seo-page-scheduler.test.ts src/lib/services/seo-page-snapshots.ts src/lib/services/ai-page-proposals.ts src/lib/services/ai-page-proposals.test.ts src/proxy.ts scripts/purge-seo-pages.mjs supabase/migrations/20260609104500_purge_seo_pages_testing_fn.sql supabase/migrations/20260609110000_fix_purge_seo_pages_testing_fn.sql supabase/migrations/20260609111500_fix_purge_seo_pages_unpublish.sql supabase/migrations/20260609113000_fix_purge_seo_pages_safe_delete.sql supabase/migrations/20260610090000_guard_purge_seo_pages_fn.sql supabase/migrations/20260610091000_schedule_state_ownership.sql && git commit -m "$(cat <<'EOF'
  fix(page-builder): own scheduled-publish state and guard the purge path

Scheduler columns are now written only by explicit schedule actions and
the publish runner: saves/autosaves gate on a schedule-field baseline so
they can never reset the runner lock or re-arm a stale schedule; publish
clears schedule state atomically; archive cancels schedules and builds
redirects from the page's real route prefix with a self-redirect guard;
unpublish cancels schedules; revision snapshots no longer carry scheduler
state; the runner skips archived pages. DST-invalid schedule times now
error instead of silently dropping.

The testing purge function requires an explicit confirmation phrase and
the purge script refuses remote projects without --confirm plus
ALLOW_REMOTE_PURGE=1. Proposal block IDs are remapped on collision,
client autosaves are serialized, the proxy enforces admin role parity,
and the library-refresh action validates its input.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)" 2>&1 | tail -3` <!-- handover-auto:commit bcb78a8b622f1e3735c8e26120dc0b14e02d44e6 -->

- 2026-06-10: Auto-recorded commit fa0da68 - refactor(admin): hoist AdminShell props type and icon glyph constants. Files: src/components/admin/AdminShell.tsx. after `git add src/components/admin/AdminShell.tsx && git commit -m "$(cat <<'EOF'
  refactor(admin): hoist AdminShell props type and icon glyph constants

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)" 2>&1 | tail -2` <!-- handover-auto:commit fa0da68e01abeb0f1109dca206e3dc0d8645d4d2 -->

- 2026-06-10: Auto-recorded commit 4a41eca - feat(monitoring): wire sentry error reporting and source map upload. Files: .env.example, next.config.ts, package-lock.json, package.json, src/app/global-error.tsx, src/instrumentation-client.ts, src/instrumentation.ts, src/sentry.edge.config.ts; +1 more. after `git commit -m "$(cat <<'EOF'
  feat(monitoring): wire sentry error reporting and source map upload

Adds @sentry/nextjs with client/server/edge instrumentation, captures
global errors, and uploads source maps only when CI/Vercel credentials
are present. DSNs come from env; nothing is reported when unset.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)" 2>&1 | tail -5` <!-- handover-auto:commit 4a41ecad401f57e4a78cbdb2b898d74af15b5bd8 -->

- 2026-06-10: Auto-recorded commit 4d61728 - fix(admin): align pages list actions with AdminShell button props. Files: src/app/admin/pages/page.tsx. after `git fetch origin --prune 2>&1 | head -5; echo "---"; git log --oneline origin/main..main | head -8; git log --oneline main..origin/main | head -8; echo "---local main vs HEAD ancestry---"; git merge-base --is-ancestor main HEAD && echo "main IS ancestor of HEAD" || echo "main NOT ancestor"; git merge-base --is-ancestor origin/main HEAD && echo "origin/main IS ancestor of HEAD" || echo "origin/main NOT ancestor"; echo "---cerebras branch ancestry---"; git merge-base --is-ancestor codex/cerebras-seo-agent-provider HEAD && echo "cerebras IS ancestor of HEAD" || echo "cerebras NOT ancestor"` <!-- handover-auto:commit 4d617287e41edec9f98da02bf31f9905a9a238a4 -->
- 2026-05-29: Auto-recorded commit cc83297 - Merge branch 'codex/seo-builder-teardown-remediation' (thermo refactor). Files: no file list available. after `git merge codex/seo-builder-teardown-remediation --no-ff -m "$(cat <<'EOF'
  Merge branch 'codex/seo-builder-teardown-remediation' (thermo refactor)

Behavior-preserving thermo code-quality remediation across the SEO Page
Builder, admin CMS, media upload flows, and page service, plus the two
review-flagged type-assertion hardenings.
EOF
)" 2>&1 | tail -15` <!-- handover-auto:commit cc8329792e7da28437ecac8220d6f0bc09984c2a -->

- 2026-05-29: Auto-recorded commit da835e4 - refactor(seo-builder): remediate thermo code-quality findings. Files: docs/PROJECT_HANDOVER.md, plans/thermo-code-quality-remediation/slice-plan.md, src/app/admin/media/page.tsx, src/app/admin/news/page.tsx, src/app/admin/pages/actions.test.ts, src/app/admin/pages/actions.ts, src/components/admin/MediaLibraryManager.tsx, src/components/admin/MediaPickerProvider.tsx; +20 more. after `git commit -m "$(cat <<'EOF'
  refactor(seo-builder): remediate thermo code-quality findings

Behavior-preserving remediation of the thermo-nuclear maintainability
findings across the SEO Page Builder, admin CMS routes, media upload
flows, and page service orchestration.

- Extract block behavior into descriptors (block-descriptors.ts) to
  collapse duplicated type/variant branching shared by the public
  renderer and editor.
- Split the monolithic resource renderer into focused block components
  (resource-blocks/HeroBlock, RichTextBlock, shared).
- Deduplicate admin list state into media-list.ts / news-list.ts.
- Consolidate page service publish/archive/refresh/rollback and the
  save/preview server-action branching.
- Unify the media upload flow shared by editor-upload, MediaPickerProvider,
  and MediaLibraryManager.
- Harden two type assertions flagged in review: validate CTA variants via
  a type guard and throw on unsupported block types instead of casting.

Public rendering, draft save/autosave/preview/publish, media governance,
lead attribution, and admin auth are unchanged. Verified: lint, tsc,
207 tests, build.
EOF
)" 2>&1 | tail -20` <!-- handover-auto:commit da835e42404801fcd2eed9efc49fb6a68faa17c2 -->

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
