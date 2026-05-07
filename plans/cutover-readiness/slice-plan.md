# Vendingpreneurs Legacy Cutover Readiness Thin Slice Plan

Status: LEGACY/CUTOVER TRACK
Last updated: 2026-05-06
Owner: Codex

## Scope Note

This plan tracks the older Webflow-copy and cutover-readiness work from
2026-05-04. It is still useful evidence for legacy URL handling, lead capture,
news migration, admin auth, and DNS-cutover blockers, but it is **not** the
implementation source of truth for the SEO Page Builder.

The active SEO Page Builder source of truth is
`docs/seo-page-builder/roadmap.md`. The builder is now a pre-ship requirement,
so final launch planning must merge the remaining blockers in this cutover plan
with the SEO Page Builder completion gates before DNS cutover.

## Working Brief

- Feature or fix: Copy the remaining live Webflow surface into the Next.js/Vercel site and clear the known blockers before DNS cutover.
- Primary actors: Anonymous visitors, qualified applicants/leads, site admin/editor, Mike/team receiving lead notifications, search crawlers, Codex implementers.
- Core invariant: No live traffic and no lead submission is lost during or after cutover; every old Webflow URL must resolve to useful content or a deliberate redirect, and every form submission must create an auditable server-side lead record.
- Previous intended behaviours: Existing public marketing pages remain visually aligned with the live brand; News remains CMS-backed; draft news stays admin-only; admin routes stay magic-link gated; Webflow remains authoritative until the cutover gate.
- Unsafe outcomes: Apply/Contact submits but no lead is stored; old paid/ad/booking URLs 404 after cutover; legacy news URLs 500; unauthenticated users reach admin surfaces; low-quality scraped HTML is bulk-published without review; DNS moves before redirects/forms are proven.
- Current evidence: `PLAN.md`, `HANDOFF.md`, `docs/slice-3b-plan.md`, `docs/news-cms/migration-handoff.md`, `src/app/apply/page.tsx`, `src/app/contact/page.tsx`, `src/lib/services/news.ts`, Supabase migrations, live `https://www.vendingpreneurs.com/sitemap.xml`, preview route/browser checks from 2026-05-04, and local verification of the news detail fix.
- Assumptions: We preserve old news slugs where possible; lead-intent Webflow URLs should converge on the new `/apply` flow with source attribution unless the user explicitly wants exact funnel page clones; manual/editor review is required before migrated news articles become published; Slack notification is optional but Resend/email notification is required for launch unless product says otherwise.
- Out of scope: DNS cutover execution, paid-ad account edits, exact pixel-perfect rebuild of every historical funnel variant, Cloudflare Stream migration for testimonials, Sentry setup, and GA4 property creation. Those remain follow-up or parallel plans unless explicitly pulled in.

## Risk Classification

- Overall tier: Tier 1
- Why: This plan touches accepted customer-facing records, lead capture, redirects for live traffic, admin auth, CMS content migration, and eventual production cutover.
- Live-data risk: High once migrations/backfills run against Supabase or redirects deploy to production. Dry runs and preview-only verification are required before production promotion.
- Migration risk: Medium. Lead schema is additive and non-destructive; news import should create draft rows only; redirects are config-level but can affect all traffic.
- External-contract risk: Medium. Supabase Auth, Supabase RLS/storage, Resend email, optional Slack webhook, and Vercel redirects/env vars all require current docs and deployed-env verification.

## Dependency Graph

| Node | Depends on | Parallel?             | Shared-state risk               | Notes                                                                                                                       |
| ---- | ---------- | --------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| S1   | None       | No                    | Git/deploy state                | Commit/deploy the already-local news 500 fix before broader audit claims rely on it.                                        |
| S2   | S1         | No                    | Live sitemap/current site drift | Snapshot sitemap and classify old URLs into canonical content, lead funnels, booking routes, thank-you/resources, and news. |
| S3   | S2         | No                    | Product decision                | Decide which old non-news URLs are exact-page clones versus redirects to `/apply` or other canonical pages.                 |
| S4   | S3         | No                    | Supabase migration              | Add lead schema, RLS, idempotency/audit fields, and generated types.                                                        |
| S5   | S4         | No                    | Server action/contracts         | Implement lead service, notification adapters, idempotency, logging, and tests.                                             |
| S6   | S5         | Yes, with S8 after S3 | Frontend forms                  | Replace `/apply` and `/contact` stubs with real forms and source attribution.                                               |
| S7   | S6         | No                    | Runtime/external email          | Verify Apply/Contact end to end in preview with real or sandbox notification targets.                                       |
| S8   | S3         | Yes, after S3         | Content quality                 | Build legacy content importer as draft-only output; do not publish automatically.                                           |
| S9   | S8         | Yes                   | CMS data                        | Import news articles as drafts, preserve slugs, attach cover URLs/assets, and produce review report.                        |
| S10  | S9         | No                    | Human/editor review             | Review and publish migrated news rows; verify `/news` and `/news/<slug>`.                                                   |
| S11  | S3, S6     | No                    | Routing/global traffic          | Implement old URL aliases/redirect map with source attribution for lead funnels.                                            |
| S12  | S11        | No                    | SEO/global routing              | Add sitemap, robots, canonical/OG coverage, and redirect-map tests.                                                         |
| S13  | S4         | No                    | Auth/provider config            | Resolve Supabase admin email deliverability or choose an accepted admin email.                                              |
| S14  | S12, S13   | No                    | Deploy/cutover                  | Full preview smoke, production deploy, and pre-DNS cutover gate.                                                            |
| S15  | S14        | No                    | Dependency lockfile             | Track Next/PostCSS advisory; upgrade only when a stable Next release carries a fixed PostCSS.                               |

## Audit Triage

Source artifact: Full pass from 2026-05-04 plus live sitemap.
Audit date: 2026-05-04
Findings reviewed: 7

| Finding                                                          | Verified against current code?                                      | Disposition              | Reason                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| F1: Preview public routes load                                   | Yes, desktop/mobile browser and HTTP checks                         | baseline evidence        | Core public routes load with no 4xx/5xx asset failures.                                             |
| F2: `/apply` is a stub                                           | Yes, `src/app/apply/page.tsx` imports `Stub`                        | sliced as S4-S7          | Tier 1 lead path still missing.                                                                     |
| F3: `/contact` is a stub                                         | Yes, `src/app/contact/page.tsx` imports `Stub`                      | sliced as S4-S7          | Tier 1 lead path still missing.                                                                     |
| F4: Legacy news slugs returned 500 on deployed preview           | Yes, preview returned 500; local prod logged `DYNAMIC_SERVER_USAGE` | sliced as S1             | Local working tree now uses anon public client and regression test, but deploy/commit gate remains. |
| F5: Live sitemap has 72 URLs and only core subset is implemented | Yes, live sitemap pulled on 2026-05-04                              | sliced as S2, S3, S8-S12 | Needs inventory, migration, redirects, and tests.                                                   |
| F6: Supabase Auth rejects `james@modernamenities.com`            | Yes, recorded in `HANDOFF.md`                                       | sliced as S13            | Admin access must be reliable before CMS handoff.                                                   |
| F7: `npm audit --omit=dev` reports PostCSS via Next 16.2.4       | Yes, audit output on 2026-05-04                                     | sliced as S15            | No clean stable Next upgrade yet; forced fix downgrades to Next 9.                                  |

## Progress

| Slice | Status  | Tier | Owner        | Evidence                                                                                                                                                                                                                                                                                    | Next gate                                                |
| ----- | ------- | ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| S1    | done    | T2   | Codex        | `npm test`, `typecheck`, `lint`, `build`; local `next start` returned not-found/noindex for legacy news slugs; Vercel preview `dpl_4vYQrbz45c517Qhgdmu6aLxWdjst` built READY, but direct curl is blocked by Vercel Deployment Protection 401                                                | Continue to S2                                           |
| S2    | done    | T2   | Codex        | `docs/cutover/webflow-url-inventory.md`; live sitemap snapshot counted 72 URLs: 6 core, 18 booking, 14 lead/landing, 2 support, 32 news                                                                                                                                                     | Continue to S3                                           |
| S3    | done    | T1   | Codex        | Safe default recorded in URL inventory: lead-intent/booking URLs redirect to `/apply` with `source_path`; support URLs become noindex support pages; core renames redirect canonically                                                                                                      | Continue to S4                                           |
| S4    | done    | T1   | Codex        | `supabase/migrations/20260504090000_lead_submissions.sql`, `src/types/database.ts`; temp Postgres migration apply passed; remote dry-run then `supabase db push --linked --yes` applied; remote lint clean; anon insert blocked by RLS 401; service-role select 200                         | Continue to S5                                           |
| S5    | done    | T1   | Codex        | `src/lib/services/leads.ts`, `src/lib/services/leads.test.ts`, action files, `.env.example`; focused tests cover validation, idempotency, audit-before-notification, provider 5xx, and missing notification env                                                                             | Continue to S6                                           |
| S6    | done    | T1   | Codex        | `/apply` and `/contact` now render server-action forms with hidden source/UTM attribution; local production HTML confirmed form fields and attribution                                                                                                                                      | Continue to S7                                           |
| S7    | partial | T1   | Codex        | Local `next start` progressive POSTs created remote Supabase Apply and Contact rows with source attribution; rows marked `notification_failed` because notification env vars are missing                                                                                                    | Add Resend sender/recipient/API env before launch        |
| S8    | done    | T2   | Codex        | `scripts/import-webflow-news-drafts.mjs`, importer tests, and dry-run report parsed all 32 Webflow news URLs with zero warnings                                                                                                                                                             | Continue to S9                                           |
| S9    | done    | T2   | Codex        | Draft-only write inserted 32 `news_posts` rows with `status=draft`; service-role count returned `0-31/32`; public `/news` did not show drafts and draft slug rendered not-found/noindex                                                                                                     | Continue to S10 editor review                            |
| S10   | blocked | T2   | editor/admin | Draft rows exist and remain private; publishing is intentionally blocked on human/editor review of migrated article quality and claims                                                                                                                                                      | Editor review/publish sample then batch                  |
| S11   | done    | T1   | Codex        | `next.config.ts` legacy redirects and `scripts/check-cutover-routes.mjs`; redirect matrix checked all 72 old sitemap URLs with zero failures, preserving `source_path` and existing UTMs                                                                                                    | Continue to S12                                          |
| S12   | done    | T1   | Codex        | `src/app/sitemap.ts`, `src/app/robots.ts`, canonical metadata, support noindex pages; curl checks for sitemap, robots, and support noindex passed                                                                                                                                           | Continue to S13/S14                                      |
| S13   | partial | T1   | Codex        | Remote `app_user_emails` and `app_users` contain `james@modernamenities.com:admin`; Supabase Admin `generateLink` accepts the address and returns an action link; anonymous `/admin/news` redirects to `/admin/login`                                                                       | Manual inbox/callback login still required               |
| S14   | blocked | T1   | Codex        | Local full gates and redirect matrix pass; preview deployment `dpl_3ZNBYC7hVj2bLhpMQ9taCZWYV1g5` built READY; direct preview HTTP is blocked by Vercel Deployment Protection 401; launch remains blocked by notification env, editor review, manual admin inbox login, and DNS owner/window | Resolve blockers before production cutover               |
| S15   | blocked | T2   | Codex        | `npm audit --omit=dev` still reports PostCSS via stable `next@16.2.4`; npm force fix downgrades to `next@9.3.3`; `next@16.3.0-canary.6` has PostCSS 8.5.10 but is not stable                                                                                                                | Wait for stable Next release or explicitly accept canary |

## Slices

### S1 - Stabilize Legacy News Slugs

Status: done
Tier: T2
Type: backend, verification
Actor/trigger: Visitor or crawler requests an old `/news/<slug>` route before the article exists in Supabase.
Action: Return the app not-found/noindex response or a future redirect, never a server 500.
Invariant protected: Legacy URL misses do not create 5xx errors or leak server internals.
Intentional behaviour changes: Public article lookup uses the anon Supabase client instead of the cookie-aware server client.
Previous intended behaviours preserved: Published CMS articles still render, drafts remain hidden by RLS, build-time static slug generation still uses the public surface.
Unsafe outcomes: Missing article causes `DYNAMIC_SERVER_USAGE` or 500; private/draft articles become visible.
Dependencies: None.
Expected files: `src/lib/services/news.ts`, `src/lib/services/news.test.ts`.
Write boundaries: News service and focused tests only.
Tests required: Regression test proves `getPublishedPostBySlug` does not call the cookie-aware server client.
Runtime verification: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, local `next start`, curl a known legacy news slug, then deployed preview curl after commit/deploy.
Migration/backfill notes: None.
External docs needed: Next 16 local docs for `cookies()` as request-time API and streamed `notFound()` status behavior.
Acceptance criteria: Preview legacy news slug no longer returns 500; no published/draft visibility regression.
Exit evidence: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
local production curl of legacy news slugs, and Vercel preview deployment
`dpl_4vYQrbz45c517Qhgdmu6aLxWdjst` built READY. Direct preview curl returned
Vercel Deployment Protection 401, which is a platform access gate rather than
an app route 500.
Parallelization: No, shared service behavior.
Blocked on: None.

### S2 - Snapshot And Classify Live Webflow URLs

Status: done
Tier: T2
Type: docs, ops
Actor/trigger: Cutover planner needs a stable source-of-truth URL inventory.
Action: Pull the live sitemap, classify each URL, record current live status/title, and save a tracked inventory.
Invariant protected: No old URL is silently forgotten.
Intentional behaviour changes: None.
Previous intended behaviours preserved: Webflow remains authoritative while inventory is created.
Unsafe outcomes: URL inventory is stale, incomplete, or mixes campaign funnels with canonical pages.
Dependencies: S1.
Expected files: `docs/cutover/webflow-url-inventory.md` or `.json`, optional helper script under `scripts/`.
Write boundaries: Docs/scripts only.
Tests required: Script or command can reproduce count and groups from live sitemap.
Runtime verification: `fetch https://www.vendingpreneurs.com/sitemap.xml`; HEAD/GET sample URLs; compare count against 72 from 2026-05-04.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: Inventory lists every sitemap URL with category, current live title/status, intended new destination, and owner decision status.
Exit evidence: `docs/cutover/webflow-url-inventory.md`; live sitemap snapshot
reproduced 72 URLs and grouped them into core, booking, landing, support, and
news categories.
Parallelization: No, shared planning artifact.
Blocked on: None.

### S3 - Decide Funnel Copy Versus Redirect Strategy

Status: done
Tier: T1
Type: product, routing
Actor/trigger: Product owner decides how historical booking/landing URLs should behave.
Action: Decide whether each non-news/non-core URL gets exact copied content, a canonical static page, or a redirect to `/apply` with source attribution.
Invariant protected: Paid/ad/organic lead traffic reaches a working lead path.
Intentional behaviour changes: Likely replaces many old Webflow funnel pages with a safer single lead flow.
Previous intended behaviours preserved: Users from old URLs still understand the offer and can apply/book.
Unsafe outcomes: Exact copying preserves broken/old embedded forms; redirecting loses campaign/source attribution; thank-you pages become public entry points with confusing messaging.
Dependencies: S2.
Expected files: `docs/cutover/webflow-url-inventory.md`, `docs/cutover/redirect-map.md`.
Write boundaries: Docs only until decision is complete.
Tests required: None yet; later redirect tests depend on the decision.
Runtime verification: None.
Migration/backfill notes: None.
External docs needed: Vercel/Next redirect behavior docs when implementing.
Acceptance criteria: Every one of the 34 booking/landing/support URLs has one chosen treatment: clone, redirect, gone/noindex, or blocked.
Exit evidence: `docs/cutover/webflow-url-inventory.md` records canonical
redirects, `/apply?source_path=...` treatment for lead-intent URLs, noindex
support-page treatment, and draft import treatment for news.
Parallelization: No, product decision.
Blocked on: None.

### S4 - Add Lead Submission Schema And RLS

Status: done
Tier: T1
Type: schema
Actor/trigger: Server action stores an Apply or Contact lead.
Action: Add non-destructive Supabase migration for `lead_submissions` and any required notification/audit fields.
Invariant protected: Every accepted lead creates one durable audit row.
Intentional behaviour changes: Adds lead storage backend.
Previous intended behaviours preserved: News CMS tables and RLS continue working.
Unsafe outcomes: Public can read leads; duplicate submissions create noisy records; migrations break existing CMS policies.
Dependencies: S3.
Expected files: `supabase/migrations/<timestamp>_lead_submissions.sql`, `src/types/database.ts`, possibly `src/lib/services/leads.ts`.
Write boundaries: Migration, generated types, lead domain test helpers.
Tests required: RLS/policy review or SQL tests if local Supabase test harness exists; type generation succeeds.
Runtime verification: Remote migration dry-run strategy documented before applying; after apply, service-role can insert and anon cannot select.
Migration/backfill notes: Additive/non-destructive only; no production data deletion.
External docs needed: Current Supabase RLS docs if policy syntax changes.
Acceptance criteria: Schema supports idempotency key, source path, form type, contact fields, consent/status, timestamps, and server metadata without exposing PII publicly.
Exit evidence: `supabase/migrations/20260504090000_lead_submissions.sql`,
`src/types/database.ts`, isolated Postgres migration apply, remote Supabase
dry-run and push, remote schema lint, anon REST insert blocked with RLS 401,
and service-role REST select returning 200.
Parallelization: No, shared database schema.
Blocked on: S3 decisions around lead source/campaign fields.

### S5 - Implement Lead Service And Notification Adapters

Status: done
Tier: T1
Type: backend, integration
Actor/trigger: Server action receives valid form data.
Action: Validate input, create idempotent lead row, send Resend email and optional Slack notification, and return generic user-safe states.
Invariant protected: Accepted leads are stored even if notification delivery fails.
Intentional behaviour changes: Enables real lead processing.
Previous intended behaviours preserved: No client-side trust; server-only secrets stay out of browser bundles.
Unsafe outcomes: Notification failure prevents audit row; PII leaks to logs/browser; duplicate retries create multiple active leads; malformed input reaches Supabase.
Dependencies: S4.
Expected files: `src/lib/services/leads.ts`, `src/lib/services/leads.test.ts`, `src/app/apply/actions.ts`, `src/app/contact/actions.ts`, `.env.example`, maybe package files for Resend SDK.
Write boundaries: Lead service/actions/tests/env docs only.
Tests required: Valid lead insert, malformed payload, duplicate idempotency key, notification 5xx after audit insert, missing notification env, generic error state.
Runtime verification: Use preview env with test recipient/webhook; confirm Supabase row and email/log result.
Migration/backfill notes: None.
External docs needed: Official Resend SDK/API docs and Slack webhook docs if Slack is enabled.
Acceptance criteria: A lead can be accepted, stored, and notified; if notification fails, row remains with failure status for follow-up.
Exit evidence: `npm test -- src/lib/services/leads.test.ts`, full `npm test`,
`npm run typecheck`, `npm run lint`, `npm run build`; tests cover valid insert,
malformed payload, duplicate idempotency, notification 5xx after audit insert,
and missing notification env.
Parallelization: No, central lead contract.
Blocked on: Notification destination values and S4.

### S6 - Replace Apply And Contact Stubs With Real Forms

Status: done
Tier: T1
Type: frontend, server action
Actor/trigger: Visitor opens `/apply`, `/contact`, or redirected legacy lead URL.
Action: Render production forms with validation, submit to lead actions, preserve source path/UTM/referrer, and show non-misleading success/error states.
Invariant protected: Users can submit once and get a clear outcome without silent loss.
Intentional behaviour changes: `/apply` and `/contact` stop being placeholder pages.
Previous intended behaviours preserved: Existing CTAs remain available; brand styling remains aligned; accessibility remains acceptable on mobile.
Unsafe outcomes: Form appears successful while server failed; mobile fields are unusable; source attribution is dropped.
Dependencies: S5.
Expected files: `src/app/apply/page.tsx`, `src/app/contact/page.tsx`, form components under `src/components/`, action files, tests.
Write boundaries: Apply/Contact UI and shared form components only.
Tests required: Server action tests plus component/DOM tests if existing tooling supports them.
Runtime verification: Desktop and 390px mobile browser pass; submit valid/invalid forms in preview.
Migration/backfill notes: None.
External docs needed: Next 16 Server Actions docs from `node_modules/next/dist/docs`.
Acceptance criteria: Apply and Contact can create distinct lead rows with source attribution and no stubs remain.
Exit evidence: Local production `/apply` and `/contact` HTML returned 200,
rendered real forms, and included `idempotency_key`, `source_path`,
`landing_path`, and UTM hidden inputs.
Parallelization: Yes after S5; one frontend worker can own form UI while backend owner finishes S5 only if contracts are frozen.
Blocked on: S5.

### S7 - Verify Lead Capture End To End

Status: partial
Tier: T1
Type: verification, ops
Actor/trigger: Release gate before redirecting old funnel traffic to the new app.
Action: Run full lead smoke tests against preview, including duplicate submit and notification failure path if safely simulatable.
Invariant protected: No accepted lead is lost.
Intentional behaviour changes: None.
Previous intended behaviours preserved: Existing public pages still load; admin remains gated.
Unsafe outcomes: Test rows pollute production without labels; verification misses notification failures.
Dependencies: S6.
Expected files: `docs/cutover/lead-capture-verification.md`.
Write boundaries: Verification doc only.
Tests required: `npm test`, focused lead tests, `npm run typecheck`, `npm run lint`, `npm run build`.
Runtime verification: Browser submit from `/apply`, `/contact`, and one legacy source URL; inspect Supabase row and notification result.
Migration/backfill notes: Mark test rows clearly or delete only if explicitly approved.
External docs needed: Supabase dashboard/API query method.
Acceptance criteria: A future agent can prove from docs/logs that leads survive storage and notification edge cases.
Exit evidence: Local production progressive POSTs to `/apply` and `/contact`
returned 200 success states and created redacted remote Supabase rows with
correct `form_type`, `source_path`, `landing_path`, and UTM values. Rows were
stored with `notification_failed` because `RESEND_API_KEY`,
`LEAD_NOTIFICATION_TO`, and `LEAD_NOTIFICATION_FROM` are missing locally.
Parallelization: No, shared live/preview state.
Blocked on: S6.

### S8 - Build Draft-Only Webflow News Importer

Status: done
Tier: T2
Type: content tooling
Actor/trigger: Content migration operator imports old Webflow news articles.
Action: Fetch each live news article, extract title/excerpt/body/cover where possible, convert or clean to markdown, and prepare draft inserts without publishing.
Invariant protected: Scraped content cannot become public without review.
Intentional behaviour changes: Adds tooling to accelerate the 32-article migration.
Previous intended behaviours preserved: Admin editor remains the review/publish surface; sanitizer still runs on render.
Unsafe outcomes: Bad HTML/scripts are stored and published; duplicate slugs overwrite reviewed content; images hotlink unexpectedly without tracking.
Dependencies: S3.
Expected files: `scripts/import-webflow-news-drafts.*`, `docs/news-cms/import-report.md`, maybe `content/imports/` ignored or tracked sanitized outputs.
Write boundaries: Scripts/docs/import artifacts only; no app runtime changes unless a helper is genuinely needed.
Tests required: Dry-run parser test against saved sample HTML; duplicate slug handling.
Runtime verification: Dry run prints all 32 article slugs and proposed draft fields; no DB writes in dry run.
Migration/backfill notes: Import rows as `draft`; preserve old slugs where possible.
External docs needed: None unless using a new HTML-to-Markdown package, then check current package docs.
Acceptance criteria: Operator can run dry-run and see exactly what will be inserted.
Exit evidence: `scripts/import-webflow-news-drafts.mjs`,
`src/lib/webflow-news-importer.test.ts`, and
`docs/news-cms/import-report.md`; dry run parsed 32/32 article URLs with zero
warnings and no database writes.
Parallelization: Yes after S3; content/tooling worker can proceed while lead backend is built.
Blocked on: S3 if redirect/slug strategy changes.

### S9 - Import News Drafts And Generate Slug Map

Status: done
Tier: T2
Type: migration, content
Actor/trigger: Admin/operator runs approved importer with service-role access.
Action: Insert or upsert draft `news_posts` rows for all existing Webflow news articles and produce old-to-new slug map.
Invariant protected: Draft import must not expose unreviewed content publicly.
Intentional behaviour changes: News CMS gains draft rows for old articles.
Previous intended behaviours preserved: Published `/news` only shows reviewed published rows; RSS only includes published rows.
Unsafe outcomes: Drafts publish accidentally; existing reviewed posts are overwritten; service role leaks.
Dependencies: S8.
Expected files: Import report and slug map under `docs/news-cms/` or `docs/cutover/`.
Write boundaries: Docs/import outputs; DB writes through approved script only.
Tests required: Import script dry-run before write; duplicate slug guard.
Runtime verification: Admin `/admin/news` shows draft count; public `/news` does not show drafts.
Migration/backfill notes: Live DB mutation; require explicit approval before write.
External docs needed: Supabase JS insert/upsert docs if script uses direct API.
Acceptance criteria: All 32 old news URLs map to a draft or documented exception.
Exit evidence: Draft-only import wrote 32 draft `news_posts` rows, generated
`docs/news-cms/import-report.md`, service-role count returned `0-31/32`, public
`/news` did not include draft article titles, and a draft slug returned the
not-found/noindex public response.
Parallelization: No, live DB mutation.
Blocked on: S8 and explicit approval to write draft rows.

### S10 - Review And Publish Migrated News

Status: blocked
Tier: T2
Type: admin workflow, content
Actor/trigger: Admin/editor reviews draft article quality.
Action: Use `/admin/news` to review markdown, cover images, excerpts, and publish approved rows.
Invariant protected: Only reviewed article content becomes public.
Intentional behaviour changes: Legacy news articles appear on `/news`, `/news/<slug>`, and RSS.
Previous intended behaviours preserved: Unreviewed/problem articles remain drafts with documented reason.
Unsafe outcomes: Incorrect legal/earnings claims are republished; duplicate/obsolete articles go live without decision.
Dependencies: S9, S13 if using the real admin email.
Expected files: `docs/news-cms/migration-handoff.md` updates or `docs/news-cms/migration-review.md`.
Write boundaries: Docs and CMS rows via admin UI.
Tests required: None beyond runtime checks unless service bugs appear.
Runtime verification: Publish a sample, verify `/news`, `/news/<slug>`, `/news/feed.xml`, then proceed batch.
Migration/backfill notes: Human content review required.
External docs needed: None.
Acceptance criteria: All migrated articles are either published or explicitly left draft/skipped with reason.
Exit evidence: Blocked by required human/editor review. All migrated rows are
drafts and public-hidden; publishing unreviewed scraped article content remains
unsafe.
Parallelization: Yes across editors after admin access works; not code parallelism.
Blocked on: S9 and admin access.

### S11 - Implement Legacy URL Redirects And Aliases

Status: done
Tier: T1
Type: routing, SEO
Actor/trigger: Visitor or crawler requests an old Webflow URL.
Action: Add redirect/alias handling for every old sitemap URL, including core renames (`/about-us` to `/about`, `/privacy-policy` to `/privacy`) and lead-source paths to `/apply` or chosen clone destinations.
Invariant protected: Old URLs do not 404 after cutover and lead source attribution survives.
Intentional behaviour changes: Historical Webflow paths resolve in the Next app.
Previous intended behaviours preserved: Current canonical routes still work; external Vendhub links remain external.
Unsafe outcomes: Redirect loop; wrong permanent redirect for campaign pages; losing query strings/UTMs; thank-you pages become indexed.
Dependencies: S3, S6.
Expected files: `next.config.ts`, route handlers if needed, redirect map docs, tests/scripts.
Write boundaries: Routing config and redirect test script only.
Tests required: Automated check over all 72 sitemap URLs against local production server; query string preservation test.
Runtime verification: Preview HEAD/GET for every old path returns 200/3xx as intended and no 500.
Migration/backfill notes: None.
External docs needed: Next 16 redirect config docs from `node_modules/next/dist/docs`.
Acceptance criteria: Every old sitemap URL has a tested outcome and source attribution for lead-intent URLs.
Exit evidence: `next.config.ts` redirect map and
`docs/cutover/redirect-matrix.md`; `node scripts/check-cutover-routes.mjs
http://localhost:3010` checked all 72 old sitemap URLs with zero failures.
Parallelization: No, global routing.
Blocked on: S3 and S6.

### S12 - Add SEO Routes And Canonical Coverage

Status: done
Tier: T1
Type: SEO, routing
Actor/trigger: Search crawler requests sitemap/robots/canonical metadata.
Action: Add `sitemap.xml`, `robots.txt`, canonical URLs, OG metadata where missing, and noindex handling for non-canonical or thank-you/resource pages.
Invariant protected: SEO equity transfers cleanly and non-public funnel utility pages are not accidentally indexed.
Intentional behaviour changes: New app exposes crawler metadata.
Previous intended behaviours preserved: Public route content remains unchanged except metadata.
Unsafe outcomes: Sitemap includes draft/private URLs; robots blocks needed pages; old URLs canonicalize incorrectly.
Dependencies: S11 and S10 for final news URLs.
Expected files: `src/app/sitemap.ts` or route, `src/app/robots.ts` or route, metadata updates, tests/scripts.
Write boundaries: SEO route files and metadata only.
Tests required: Sitemap contains canonical public URLs and no private/admin URLs; robots allows public surface.
Runtime verification: Curl `/sitemap.xml`, `/robots.txt`, sample metadata.
Migration/backfill notes: None.
External docs needed: Next 16 metadata/sitemap docs from local docs.
Acceptance criteria: SEO routes are generated from the final redirect/news state and pass crawler smoke.
Exit evidence: `src/app/sitemap.ts`, `src/app/robots.ts`, canonical metadata,
and noindex support pages; curl checks showed canonical sitemap URLs, robots
disallowing `/admin/`, and `noindex, nofollow` on support pages.
Parallelization: No, depends on final URL map.
Blocked on: S10/S11.

### S13 - Fix Admin Auth Email Access

Status: partial
Tier: T1
Type: auth, ops
Actor/trigger: Admin requests magic link at `/admin/login`.
Action: Resolve why `james@modernamenities.com` is rejected or choose/provision an accepted admin address, then verify sign-in and admin access.
Invariant protected: Only allowlisted admins can access CMS, and at least one real admin can operate it.
Intentional behaviour changes: Admin access becomes reliable for handoff.
Previous intended behaviours preserved: Non-allowlisted users remain blocked.
Unsafe outcomes: Broadening auth to any email; exposing admin via service-role mistakes; unverified redirect URL breaks preview/prod login.
Dependencies: S4 is not required, but can run after current CMS work.
Expected files: Docs update if dashboard-only fix; possible migration if adding another allowlisted email.
Write boundaries: Auth docs/migrations only unless app bug is proven.
Tests required: Existing auth tests plus manual magic-link verification.
Runtime verification: Request magic link, complete `/auth/callback`, reach `/admin/news`, sign out.
Migration/backfill notes: Adding allowlist row is non-destructive but live auth data; record who/why.
External docs needed: Current Supabase Auth email/domain validation docs/dashboard evidence.
Acceptance criteria: Real admin email works in preview/prod allowed redirect URLs; outsider remains blocked.
Exit evidence: Remote `app_user_emails` and `app_users` both contain
`james@modernamenities.com:admin`; Supabase Admin `generateLink` accepts the
address and returns an action link; anonymous `/admin/news` redirects to
`/admin/login`. Manual inbox click/callback remains required.
Parallelization: No, auth/config state.
Blocked on: Access to Supabase dashboard/email configuration if CLI cannot diagnose.

### S14 - Final Preview And Production Cutover Gate

Status: blocked
Tier: T1
Type: verification, ops
Actor/trigger: Team considers DNS cutover.
Action: Run full automated and browser checks on preview, then production deployment, then prepare DNS rollback plan.
Invariant protected: DNS is not changed until content, forms, redirects, CMS, and SEO are proven.
Intentional behaviour changes: None until explicit DNS action outside this plan.
Previous intended behaviours preserved: Webflow remains live until all gates pass.
Unsafe outcomes: Moving DNS with broken forms/redirects; no rollback owner; production env differs from preview.
Dependencies: S7, S10, S12, S13.
Expected files: `docs/cutover/pre-dns-checklist.md`, maybe updates to `HANDOFF.md`.
Write boundaries: Verification docs only.
Tests required: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, redirect matrix, browser pass desktop/mobile, lead smoke, admin smoke, RSS/sitemap/robots smoke.
Runtime verification: Preview and production URLs checked; no unexpected 4xx/5xx; lead row created; admin login works.
Migration/backfill notes: Do not run destructive migrations.
External docs needed: DNS provider docs once owner is known.
Acceptance criteria: Written go/no-go with rollback steps and exact DNS owner/window.
Exit evidence: Local full gates and route matrix pass; Vercel preview
deployment `dpl_3ZNBYC7hVj2bLhpMQ9taCZWYV1g5` built READY. Direct preview HTTP
checks returned Vercel Deployment Protection 401, so route-level preview smoke
is blocked without a bypass/auth token. Cutover remains blocked by missing lead
notification env, editor review/publish of imported news, manual admin inbox
login verification, and DNS owner/window.
Parallelization: No, release gate.
Blocked on: DNS owner/cutover window.

### S15 - Track Next/PostCSS Advisory

Status: blocked
Tier: T2
Type: dependency, security
Actor/trigger: `npm audit --omit=dev` reports PostCSS advisory through `next@16.2.4`.
Action: Track stable Next release that updates PostCSS or apply an official mitigation if available; do not run `npm audit fix --force` because it proposes a breaking downgrade.
Invariant protected: Security posture improves without breaking the Next 16 app.
Intentional behaviour changes: Dependency upgrade only when safe.
Previous intended behaviours preserved: Next 16 API behavior and build output remain compatible.
Unsafe outcomes: Forced audit fix downgrades Next; unreviewed canary upgrade breaks app-router behavior.
Dependencies: S14 or can run independently when stable fix exists.
Expected files: `package.json`, `package-lock.json`, release note in docs if needed.
Write boundaries: Dependency files only.
Tests required: Full verification gates after any upgrade.
Runtime verification: Browser smoke and build.
Migration/backfill notes: None.
External docs needed: Official Next release notes and npm advisory.
Acceptance criteria: Audit is clean or advisory risk is explicitly documented with no stable fix available.
Exit evidence: `npm audit --omit=dev` reports two moderate PostCSS findings
through stable `next@16.2.4`; `npm audit fix --force` proposes breaking
downgrade to `next@9.3.3`. `next@16.3.0-canary.6` depends on PostCSS 8.5.10,
but no stable Next release with the fix is available yet.
Parallelization: No, lockfile/shared dependency graph.
Blocked on: Stable Next release with fixed dependency or accepted mitigation.

## Verification Gates

- Automated checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, redirect matrix over all sitemap URLs, focused lead service tests, import dry-run tests.
- Runtime checks: Desktop and 390px mobile browser pass; `/apply` and `/contact` valid/invalid submissions; one legacy source URL submission; `/news`, `/news/<slug>`, `/news/feed.xml`, `/sitemap.xml`, `/robots.txt`; `/admin/news` redirects unauthenticated and loads authenticated.
- Migration checks: Supabase migrations are additive; RLS prevents anon lead/news draft reads; service role insert paths are server-only; draft import requires explicit approval before live DB writes.
- Security/auth checks: Admin magic link works for allowlisted admin only; outsider stays blocked; service role never enters client bundle; generic client error messages for lead/action failures.
- Observability/audit checks: Lead rows record source path, idempotency key, notification status/failure, timestamps, and enough server metadata for follow-up without exposing secrets.

## Subagent Plan

| Agent | Role                          | Slice(s) | Model/reasoning  | Read scope                                                          | Write scope                                             | Must not touch                                                     | Evidence required                                                |
| ----- | ----------------------------- | -------- | ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| A1    | Lead schema/backend worker    | S4-S5    | gpt-5.5 / medium | PLAN, migrations, config, Supabase services                         | Lead migration, lead service/actions/tests, env example | News CMS UI, redirects, package upgrade unless Resend SDK approved | Tests proving validation, idempotency, audit-before-notification |
| A2    | Lead form/frontend worker     | S6       | gpt-5.5 / medium | Apply/Contact pages, shared components, frozen lead action contract | Apply/Contact UI and form components                    | Migration, lead service internals, redirects                       | Browser screenshots desktop/mobile and form-state evidence       |
| A3    | Webflow content/import worker | S8       | gpt-5.5 / medium | Live sitemap/articles, news CMS schema, markdown sanitizer          | Import script and dry-run report                        | Live DB writes, admin auth, lead code                              | Dry-run for all 32 news articles with parse failures listed      |
| A4    | Redirect/SEO worker           | S11-S12  | gpt-5.5 / medium | URL inventory, Next config/docs, app routes                         | Redirect config/tests, sitemap/robots/metadata          | Lead backend, migrations, news import                              | Redirect matrix showing every old URL outcome                    |
| A5    | Auth/ops verifier             | S13      | gpt-5.5 / medium | Auth actions, Supabase migrations, dashboard/CLI evidence           | Docs or allowlist migration only if approved            | Lead code, redirects, news import                                  | Redacted proof admin login works and outsider is blocked         |

Workers are not alone in the codebase. They must not revert edits made by others and must keep to their write boundaries.

## Update Rules

- Move only one slice to `in_progress` per worker unless this plan explicitly allows parallel work.
- Mark `done` only after exit evidence is recorded in the Progress table.
- Mark `blocked` with the exact missing decision, dependency, or failing check.
- Add newly discovered work as a new slice or follow-up; do not silently expand an active slice.
- Keep rejected or skipped work visible with the reason.
