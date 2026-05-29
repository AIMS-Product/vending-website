# SEO Builder Teardown Remediation Thin Slice Plan

Status: READY
Last updated: 2026-05-28
Owner: Codex

## Working Brief

- Feature or fix: Remediate the confirmed SEO Page Builder teardown findings across security/RLS, framework risk, public route semantics, metadata, structured data, lead forms, admin UX/a11y, performance, mutation coverage, and tool hygiene.
- Primary actors: Public visitors and crawlers, anonymous Supabase clients, admin content editors, admin publishers, lead reviewers, future code agents, and deployment reviewers.
- Core invariant: The builder must keep draft/admin data private, publish only valid resource pages, render public pages with correct HTTP/SEO semantics, preserve source-bound AI and lead attribution contracts, and remain browser-verified before any slice is called done.
- Previous intended behaviours: Resource drafts can be saved and previewed, published pages render at `/resources/[slug]`, preview tokens remain secret/noindex, admin routes remain auth-protected outside local dev bypass, block picker previews match public rendering, sitemap/robots reflect publish settings, and source-bound AI proposals stay admin-approved only.
- Unsafe outcomes: Public exposure of drafts or admin metadata, auth/proxy bypasses, indexing soft 404s, duplicate/misleading titles, hidden or dead SEO controls, weakened lead qualification, broken preview/publish flows, source-less AI insertion, broad unverified UI churn, and mutation/test gates that appear green while important logic is untested.
- Current evidence:
  - Audit artifacts: `/tmp/vending-builder-audit-rerun`.
  - Baseline passed: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `supabase db lint --local`.
  - Baseline failed: `npm run format:check`, `npm audit --audit-level=moderate`, `npm run test -- --coverage`.
  - Rendered evidence: `/tmp/vending-builder-audit-rerun/e2e/*.png`, `/tmp/vending-builder-audit-rerun/axe/*.json`, `/tmp/vending-builder-audit-rerun/lighthouse/ztest1.json`.
  - Mutation evidence: `/tmp/vending-builder-audit-rerun/mutation/*.log`.
  - RLS evidence: `/tmp/vending-builder-audit-rerun/rls/anon-surface.json`.
  - Source contracts: `AGENTS.md`, `docs/seo-page-builder/roadmap.md`, `docs/design/admin-studio.md`, `docs/design/page-builder.md`, `docs/design/page-builder-blocks.md`, `docs/design/visual-review-checklist.md`.
- Assumptions:
  - Use the safest default when a decision is required: public Supabase access should use a narrow published-page surface, not table-wide `seo_pages`.
  - Compact and sidebar lead form variants may change layout density, but must not downgrade required apply-form qualification unless explicitly approved later.
  - Card link text can be derived from card content by default, then made editable in block settings.
  - Next.js route/status fixes must be checked against local Next 16 docs before implementation.
- Out of scope:
  - New page templates, new AI features beyond hardening existing proposal flow, live production deployment, Search Console integration, final DNS/cutover, broad visual redesign unrelated to confirmed findings, and rewriting the builder architecture.

## Risk Classification

- Overall tier: T1/T2 mixed.
- Why: S1 changes data exposure and RLS/public data contract. S2 changes framework/proxy dependency risk. Several slices affect public indexing and admin publish workflows.
- Live-data risk: Medium. Published SEO pages and existing drafts must keep rendering/editing while public database access is narrowed.
- Migration risk: Medium. RLS/view/RPC changes require non-destructive migrations and type refresh.
- External-contract risk: Medium. Next 16 route/proxy behavior and npm advisories must be validated against current local docs and build output.

## Dependency Graph

| Node                                   | Depends on                | Parallel? | Shared-state risk | Notes                                                                                   |
| -------------------------------------- | ------------------------- | --------- | ----------------- | --------------------------------------------------------------------------------------- |
| S1 Public data contract and RLS fix    | None                      | No        | High              | Blocks any public-launch confidence. Migration and generated types are single-threaded. |
| S2 Next/security dependency update     | None                      | No        | High              | Package and lockfile edit, proxy/auth blast radius.                                     |
| S3 Soft 404 correction                 | S2 preferred              | No        | Medium            | Next 16 route behavior should be understood after dependency/docs pass.                 |
| S4 Title normalization                 | None                      | Yes       | Low               | Metadata-only, but shares public route verification with S3.                            |
| S5 Breadcrumb JSON-LD absolute URLs    | None                      | Yes       | Low               | Renderer-only structured-data correctness.                                              |
| S6 Structured-data settings contract   | S5                        | No        | Medium            | Decide and wire real behavior, or retire dead setting.                                  |
| S7 Card-grid descriptive links         | S6 not required           | Yes       | Medium            | Schema/render/editor change, public copy impact.                                        |
| S8 Lead-form apply qualification       | None                      | No        | Medium            | Conversion and lead data contract.                                                      |
| S9 Admin status-dot a11y               | None                      | Yes       | Low               | Narrow admin list fix.                                                                  |
| S10 Immersive editor landmarks and H1  | None                      | No        | Medium            | Shared shell/editor landmarks.                                                          |
| S11 Admin contrast pass                | S9, S10 preferred         | Yes       | Low               | Visual token/class pass with screenshots.                                               |
| S12 Empty draft preview state          | S3 preferred              | Yes       | Low               | Preview UX only; preserve token behavior.                                               |
| S13 Block-preview audit semantics      | S10 preferred             | Yes       | Low               | Internal QA route semantics; parity must stay 30/30.                                    |
| S14 Public render performance pass     | S4, S5 preferred          | Yes       | Low               | LCP/CLS improvement and Lighthouse proof.                                               |
| S15 Mutation and coverage harness      | None                      | No        | Medium            | Package/dev dependency and Stryker config; single-threaded.                             |
| S16 Domain mutation hardening          | S15                       | Yes       | Medium            | Readiness, blocks, content ops.                                                         |
| S17 Service mutation hardening         | S15, S1/S8 where relevant | Yes       | Medium            | SEO services, public service, leads, attribution.                                       |
| S18 AI/admin action mutation hardening | S15                       | Yes       | Medium            | AI proposal service, OpenAI agent, admin actions imports.                               |
| S19 Tooling artifact hygiene           | None                      | No        | Medium            | Dirty worktree/untracked audit artifacts need careful scoping.                          |
| S20 Integrated release verification    | S1-S19                    | No        | High              | Full verification gate only.                                                            |

## Audit Triage

Source artifact: `/tmp/vending-builder-audit-rerun` and current thread teardown.
Audit date: 2026-05-28
Findings reviewed: 20

| Finding                                                                    | Verified against current code/runtime?                                                          | Disposition                    | Reason                                                                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------- |
| F1 Published `seo_pages` exposes draft/admin columns to anon               | yes - anon `select('*')` returned `draft_content`, `draft_settings`, `created_by`, `updated_by` | sliced as S1                   | T1 code+migration, no product ambiguity for privacy default                                                           |
| F2 Non-published SEO rows blocked from anon                                | yes - anon non-published query returned 0 rows                                                  | recorded as preserved behavior | must stay true in S1                                                                                                  |
| F3 `next@16.2.4` high/moderate advisories                                  | yes - `npm audit` JSON                                                                          | sliced as S2                   | dependency/proxy/auth blast radius                                                                                    |
| F4 Invalid preview token soft 404                                          | yes - `/resources/preview/not-a-real-token-for-audit` returned 200 with 404 UI                  | sliced as S3                   | public indexing/monitoring bug                                                                                        |
| F5 Missing news slug soft 404 ripple                                       | yes - `/news/not-a-real-news-slug-audit` returned 200 with not-found UI                         | sliced as S3                   | shared route/status pattern                                                                                           |
| F6 Missing resource slug returns true 404                                  | yes - `/resources/this-slug-should-not-exist-for-audit` returned 404                            | preserved behavior             | regression guard for S3                                                                                               |
| F7 Duplicate branded titles on resource and `/about-us`                    | yes - rendered titles include `                                                                 | Vendingpreneurs                | Vendingpreneurs`                                                                                                      | sliced as S4 | public SEO issue with ripple |
| F8 Breadcrumb JSON-LD uses relative URLs                                   | yes - rendered JSON-LD contains `/`, `/resources`, `/resources/ztest1`                          | sliced as S5                   | code-only renderer fix                                                                                                |
| F9 `structured_data_settings` exists but no real admin/render behavior     | yes - DB/service type exists; form/renderer ignore it                                           | sliced as S6                   | dead control/data contract                                                                                            |
| F10 Card-grid links all say `Learn more` to `/apply`                       | yes - rendered page has four identical links; Lighthouse link-text score 0                      | sliced as S7                   | UX/a11y/SEO issue                                                                                                     |
| F11 Compact/sidebar lead forms drop qualification fields                   | yes - renderer maps both to compact; backend requires only name/email                           | sliced as S8                   | conversion and lead-quality contract                                                                                  |
| F12 Status-dot ARIA violation                                              | yes - axe `aria-prohibited-attr` on admin page list                                             | sliced as S9                   | admin a11y                                                                                                            |
| F13 Immersive editor has no H1, duplicate/nested `main`, landmark warnings | yes - axe and screenshots                                                                       | sliced as S10                  | admin a11y/navigation                                                                                                 |
| F14 Contrast failures on public/admin surfaces                             | yes - axe/Lighthouse color-contrast failures                                                    | sliced as S11                  | UX/a11y                                                                                                               |
| F15 Save and preview broken                                                | no - rerun with wait opened preview in about 1s                                                 | dropped false alarm            | keep as regression proof in S20                                                                                       |
| F16 Empty draft preview is blank/confusing                                 | yes - preview screenshot showed header/footer with empty body                                   | sliced as S12                  | admin preview UX                                                                                                      |
| F17 Block-preview parity mismatch                                          | no - fresh audit passed 30/30 desktop+mobile                                                    | dropped false alarm            | keep parity gate in S13/S20                                                                                           |
| F18 Block-preview audit page semantic noise                                | yes - repeated H1s and landmark warnings on internal QA route                                   | sliced as S13                  | internal admin QA UX/a11y                                                                                             |
| F19 Public page LCP/CLS issues                                             | yes - Lighthouse LCP 3.7s, CLS 0.535; dev server LCP image warning                              | sliced as S14                  | user experience/performance                                                                                           |
| F20 Weak mutation coverage and missing coverage dependency                 | yes - Stryker scores 21-63%, some files no tests, coverage missing `@vitest/coverage-v8`        | sliced as S15-S18              | verification credibility gap                                                                                          |
| F21 `format:check` fails on temp audit files                               | yes - Prettier warnings on temp scripts/report                                                  | sliced as S19                  | tooling hygiene, dirty-worktree sensitive                                                                             |
| F22 Published `news_posts` body visible to anon                            | yes - public read returns published body/source columns                                         | not sliced                     | published news body appears intended public content; add regression only if product says markdown source is sensitive |

## Progress

| Slice | Status | Tier | Owner                   | Evidence                                                                                                                                                                                                                                                      | Next gate                              |
| ----- | ------ | ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| S1    | done   | T1   | stronger-model/manual   | Added `published_seo_pages` public surface; anon REST probe denied `select=*` and draft/admin columns; `/resources/ztest1` and `/sitemap.xml` smoke passed on production build                                                                                | S2 Next docs review and package update |
| S2    | done   | T2   | stronger-model/manual   | Upgraded Next packages to 16.2.6; high Next proxy/bypass advisories cleared; full tests/build passed; production admin redirect and dev bypass route smokes passed                                                                                            | S3 route status correction             |
| S3    | done   | T2   | stronger-model/manual   | Invalid preview/news route smokes changed from HTTP 200 to HTTP 404; valid preview/news and missing resource route checks passed                                                                                                                              | S4 metadata title normalization        |
| S4    | done   | T3   | deepseek-agent eligible | Duplicate titles reproduced and fixed; `/about-us`, `/resources/ztest1`, and `/apply` each render one brand suffix                                                                                                                                            | S5 JSON-LD absolute URLs               |
| S5    | done   | T3   | deepseek-agent eligible | Breadcrumb JSON-LD emits absolute URLs; FAQ schema preservation covered by helper test                                                                                                                                                                        | S6 structured-data settings contract   |
| S6    | done   | T2   | stronger-model/manual   | Structured-data settings now persist through admin draft settings, publish snapshots, readiness evidence, and public JSON-LD rendering; admin desktop/mobile screenshots verified                                                                             | S7 card-grid descriptive links         |
| S7    | done   | T3   | stronger-model/manual   | Card-grid links now use editor labels or title-derived fallbacks; public route rendered unique labels; block-preview parity passed 30/30                                                                                                                      | S8 lead-form apply qualification       |
| S8    | done   | T2   | stronger-model/manual   | Compact/sidebar apply forms render qualification fields; backend rejects apply submissions without qualification; disposable browser lead submission preserved attribution and was cleaned up                                                                 | S9 admin status-dot a11y               |
| S9    | done   | T3   | stronger-model/manual   | Status/readiness dots now expose sr-only labels instead of prohibited `aria-label` on generic spans; `/admin/pages` axe shows zero `aria-prohibited-attr` violations                                                                                          | S10 editor landmarks                   |
| S10   | done   | T3   | stronger-model/manual   | Immersive admin routes now have a hidden H1; editor side panels no longer create nested complementary landmarks; scratch editor has one main landmark and no duplicate/nested-main axe warnings                                                               | S11 contrast pass                      |
| S11   | done   | T3   | stronger-model/manual   | Confirmed color-contrast failures are cleared across public resource, admin list, block-preview audit, new-page choice, and scratch editor routes; remaining axe findings belong to non-contrast slices                                                       | S12 empty draft preview                |
| S12   | done   | T3   | stronger-model/manual   | Empty draft preview now renders preview-only guidance; published renderer path remains blank for empty content; disposable save-and-preview route returned HTTP 200 and was cleaned up                                                                        | S13 block-preview audit semantics      |
| S13   | done   | T3   | stronger-model/manual   | Block-preview audit embeds are inert/aria-hidden visual fixtures; audit route axe is clean and parity remains 30/30 desktop+mobile                                                                                                                            | S14 public render performance          |
| S14   | done   | T3   | stronger-model/manual   | Lighthouse performance score improved 0.69 -> 0.95, LCP 3520ms -> 2995ms, and CLS 0.577 -> 0 on `/resources/ztest1`; screenshots show no rendered overlap/regression                                                                                          | S15 coverage harness                   |
| S15   | done   | T2   | stronger-model/manual   | Coverage now runs with repo-owned `@vitest/coverage-v8`; Stryker core/Vitest runner are installed with a config and dry-run commands; TS and TSX targets both complete dry runs                                                                               | S16 domain mutation coverage           |
| S16   | done   | T2   | stronger-model/manual   | Domain module tests now cover rich-subheading detection, visible-word normalization, internal-link collection/path metadata, root/resource URL validation, invalid-content issue shape, and reorder boundary behavior; mutation reruns improved target scores | S17 service mutation coverage          |
| S17   | done   | T2   | stronger-model/manual   | Service/public/lead tests now cover redirect normalization/rejection, public lookup null/error/invalid snapshots, lead email and Slack notification body contracts, exact resource attribution defaults, and renderer import/render coverage                  | S18 AI/admin action mutation coverage  |
| S18   | done   | T2   | stronger-model/manual   | Admin action Stryker dry run now executes 5 tests instead of reporting no tests; AI proposal score improved 27.27 -> 48.33; OpenAI agent score improved 23.47 -> 26.28 with prompt-bounding coverage; full test/typecheck/lint passed                         | S19 format/artifact hygiene            |
| S19   | done   | T2   | stronger-model/manual   | Prettier now ignores local `tmp-*` browser/audit evidence and `scripts/tmp-*.mjs`; reusable block-preview parity audit script and formatted source/plan files pass `format:check`                                                                             | S19A audit override                    |
| S19A  | done   | T2   | stronger-model/manual   | Added a narrow `postcss@8.5.15` override so Next, Vite, and Tailwind share the patched PostCSS version; `npm audit --audit-level=moderate` now reports zero vulnerabilities                                                                                   | S20 full release verification          |
| S20A  | done   | T2   | stronger-model/manual   | Proxy-level resource/preview/news 404s now return accessible noindex HTML with true HTTP 404; invalid preview axe violations cleared                                                                                                                          | S20 full release verification          |
| S20   | done   | T2   | Codex/manual            | Full automated gates, route smokes, dev save-and-preview, block-preview parity, axe, Lighthouse, and anon Supabase probes passed after S20A                                                                                                                   | complete                               |

Allowed statuses: `pending`, `in_progress`, `blocked`, `done`, `skipped`.

## Slices

### S1 - Narrow Public SEO Page Data Contract

Status: done
Tier: T1
Type: schema/backend/security
Actor/trigger: Anonymous public page render, sitemap generation, and any anon Supabase client.
Action: Replace table-wide anon reads of `seo_pages` with a narrow published-page public surface, then update public services to use that surface.
Invariant protected: Draft content, draft settings, creator/updater IDs, admin metadata, preview tokens, revisions, AI proposals, and lead submissions are not public.
Intentional behaviour changes: Anonymous clients can no longer `select('*')` from `seo_pages` and see admin/draft columns.
Previous intended behaviours preserved: Published resource pages render, sitemap lists public slugs, redirects work, non-published SEO pages remain invisible, admin service-role flows still work.
Unsafe outcomes: Breaking public resource rendering, leaking drafts through a view, allowing anon writes, or hiding published pages from sitemap.
Dependencies: None.
Expected files: Supabase migration, generated database types if the repo requires them, `src/lib/services/seo-page-public.ts`, focused RLS/service tests.
Write boundaries:

- `supabase/migrations/*`
- `src/lib/services/seo-page-public.ts`
- `src/lib/services/seo-page-public.test.ts`
- `src/types/database.ts` only if regenerated from migration.
  Tests required: RLS/policy tests or integration probe proving anon cannot select draft/admin columns; public service test proving same page shape; sitemap/resource route smoke.
  Runtime verification: Anon query against `seo_pages` and new public surface; `curl /resources/ztest1`; `curl /sitemap.xml`.
  Migration/backfill notes: Non-destructive. Prefer a view or RPC such as `published_seo_pages` with explicit columns, then revoke public table select. Do not rewrite existing page rows.
  External docs needed: Supabase/Postgres RLS view behavior as needed.
  Acceptance criteria:
- Anon cannot retrieve `draft_content`, `draft_settings`, `created_by`, or `updated_by` from public page access.
- Public renderer still receives the exact fields it needs.
- Non-published rows remain invisible.
  Exit evidence:
- `supabase db lint --local`
- targeted tests
- redacted anon probe output
- route smoke for `/resources/ztest1` and `/sitemap.xml`
  Completed evidence:
- `npm test -- src/lib/services/seo-page-public.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `supabase --workdir /tmp/vending-s1-supabase.Jp7DDx db lint --local`
- Temp Supabase REST probe: `published_seo_pages` returned only published safe fields; draft row hidden; anon `seo_pages?select=*` and explicit draft/admin columns returned HTTP 401.
- Production build route smoke on `localhost:3020`: `/resources/ztest1` HTTP 200 with page title, `/sitemap.xml` HTTP 200 with `/resources/ztest1`, and no rendered forbidden error/draft/admin strings.
  Parallelization: single-threaded; migration/shared public contract.
  Blocked on: none.

#### AgentTaskContract

Eligible: no - T1 migration/RLS/public data contract requires stronger-model/manual orchestration.
Current adapter: stronger-model/manual
Model route: gpt-5.5 high; no cheap-agent write.
Model routing reason: Permission boundary and migration semantics.
Read scope:

- `supabase/migrations/*seo_page*`
- `src/lib/services/seo-page-public.ts`
- `src/app/resources/[slug]/page.tsx`
- `src/app/sitemap.ts`
  Allowed writes:
- listed in Write boundaries only
  Must not touch:
- unrelated admin UI, package files, current dirty temp artifacts, production data.
  Acceptance commands:
- `npm test -- src/lib/services/seo-page-public.test.ts`
- `npm run typecheck`
- `npm run build`
- `supabase db lint --local`
  Parent verification:
- redacted anon Supabase probes for allowed and disallowed fields
- production-build route smoke
  Failure policy:
- Stop if the fix requires destructive data migration, production policy changes without local proof, or secrets in logs.

### S2 - Patch Next And Re-verify Admin Proxy/Auth

Status: done
Tier: T2
Type: ops/security
Actor/trigger: Any request passing through Next proxy/middleware or App Router.
Action: Upgrade `next` and `eslint-config-next` to a patched compatible version, then verify build, admin auth redirect, public routes, and preview routes.
Invariant protected: Admin routes redirect to `/admin/login` without local dev bypass, local `ADMIN_DEV_AUTH_BYPASS=1` works only in development, and public routes continue rendering.
Intentional behaviour changes: Dependency graph moves off vulnerable Next 16.2.4.
Previous intended behaviours preserved: Next 16 app behavior, Turbopack build, React 19, admin dev bypass guard, public route rendering.
Unsafe outcomes: Lockfile churn beyond Next, changed proxy behavior that exposes admin routes, broken production build.
Dependencies: None.
Expected files: `package.json`, `package-lock.json`; possibly tests only if upgrade reveals breakage.
Write boundaries:

- `package.json`
- `package-lock.json`
- minimal code fixes required by the upgrade, recorded explicitly.
  Tests required: full lint/typecheck/test/build, audit rerun, admin route redirect probes.
  Runtime verification: `next start` without bypass redirects `/admin/pages`; dev bypass still serves `/admin/pages`.
  Migration/backfill notes: None.
  External docs needed: local `node_modules/next/dist/docs/` for any changed API encountered.
  Acceptance criteria:
- `npm audit --audit-level=moderate` no longer reports the Next advisories fixed by 16.2.6 or later.
- Admin and public route smoke passes.
  Exit evidence: audit JSON, command logs, route-smoke JSON.
  Completed evidence:
- Read local Next 16 docs: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `18-upgrading.md`, and `02-guides/authentication.md`.
- `npm install next@16.2.6 eslint-config-next@16.2.6`.
- `npm audit --audit-level=moderate --json`: high Next advisories fixed by 16.2.6 are gone; residual moderate audit risk remains for Next's vendored `postcss@8.4.31`, plus unrelated `brace-expansion` and `ws`.
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- Production route smoke on `next start -p 3020`: `/admin/pages` HTTP 307 to `/admin/login`, `/resources/ztest1` HTTP 200, `/sitemap.xml` HTTP 200.
- Development route smoke on `next dev -p 3021` with `ADMIN_DEV_AUTH_BYPASS=1`: `/admin/pages` HTTP 200 and did not render login copy.
  Parallelization: single-threaded dependency graph.
  Blocked on: none.

#### AgentTaskContract

Eligible: no - package/lockfile and proxy/security verification are not cheap-agent safe.
Current adapter: stronger-model/manual
Model route: gpt-5.5 high
Model routing reason: Dependency graph and auth/proxy blast radius.
Read scope:

- `package.json`
- `package-lock.json`
- `src/proxy.ts`
- `src/app/admin/**`
- local Next docs as needed
  Allowed writes:
- `package.json`
- `package-lock.json`
- minimal upgrade fallout files only after explicit parent review
  Must not touch:
- migrations, page-builder schema, unrelated UI refactors.
  Acceptance commands:
- `npm audit --audit-level=moderate`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
  Parent verification:
- admin/public route smoke on production build and dev bypass
  Failure policy:
- Stop if the upgrade requires broad rewrites or semver-major changes.

### S3 - Return True 404 Status For Not Found Dynamic Routes

Status: done
Tier: T2
Type: backend/routing
Actor/trigger: Crawlers and users requesting invalid preview or news URLs.
Action: Make invalid `/resources/preview/[token]` and `/news/[slug]` requests return HTTP 404, not 200 with a not-found UI.
Invariant protected: Valid preview tokens and published news posts still render; missing `/resources/[slug]` stays true 404.
Intentional behaviour changes: Invalid preview/news responses change from 200 to 404.
Previous intended behaviours preserved: Preview pages remain noindex, valid previews render drafts, news metadata still renders for valid posts.
Unsafe outcomes: Invalid preview tokens becoming indexable, valid preview tokens breaking, static params behavior regressing.
Dependencies: Prefer S2 first.
Expected files:

- `src/app/resources/preview/[token]/page.tsx`
- `src/app/news/[slug]/page.tsx`
- `src/proxy.ts`
- `src/lib/services/news.ts`
- `src/lib/services/seo-pages.ts`
- route tests if repo supports them.
  Write boundaries:
- listed files and focused tests only. Proxy/service predicates are included because Next 16 docs confirm pre-render rejection is needed for true HTTP status when streamed page `notFound()` stays 200.
  Tests required: HTTP status tests for invalid preview, invalid news, missing resource, valid public page.
  Runtime verification: `next build && next start`; `fetch(..., { redirect: "manual" })` route smoke.
  Migration/backfill notes: None.
  External docs needed: local Next 16 docs for `notFound()`, metadata, streaming/status behavior.
  Acceptance criteria:
- Invalid preview and invalid news return 404.
- Valid preview token created through admin still opens.
- `/resources/this-slug-should-not-exist-for-audit` remains 404.
  Exit evidence: route-smoke JSON and screenshot only if UI changes.
  Completed evidence:
- Read local Next 16 docs: `not-found.md`, dynamic routes, and streaming HTTP contract. The docs explain that streamed `notFound()` can keep status 200 and recommend early proxy rejection for real 4xx status.
- Reproduced before fix on production build: invalid `/resources/preview/not-a-real-token-for-audit` HTTP 200, invalid `/news/not-a-real-news-slug-audit` HTTP 200, missing `/resources/this-slug-should-not-exist-for-audit` HTTP 404.
- Added proxy-level existence checks for preview tokens and news slugs, with focused service predicates.
- `npm test -- src/lib/services/news.test.ts src/lib/services/seo-pages-previews.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- Production route smoke: invalid preview HTTP 404, invalid news HTTP 404, valid preview HTTP 200, valid news HTTP 200, missing resource HTTP 404, no visible forbidden error strings.
  Parallelization: no with S2; yes with S4 after S2 is stable.
  Blocked on: none.

#### AgentTaskContract

Eligible: no - framework status semantics require local Next docs and parent runtime verification.
Current adapter: stronger-model/manual
Model route: gpt-5.5 medium
Model routing reason: App Router status behavior can be subtle.
Read scope:

- listed Expected files
- local Next docs for not-found/status behavior
  Allowed writes:
- listed Expected files
- focused tests
  Must not touch:
- global not-found design, unrelated routes, public layout.
  Acceptance commands:
- `npm run typecheck`
- `npm run build`
  Parent verification:
- production-build route smoke for invalid and valid routes
  Failure policy:
- Stop if the only solution requires global layout changes or losing the branded not-found UI.

### S4 - Normalize Branded Metadata Titles

Status: done
Tier: T3
Type: frontend/backend
Actor/trigger: Public crawlers and browser tabs reading metadata.
Action: Prevent page-level titles from embedding the brand when the root metadata template appends it.
Invariant protected: Every route keeps a useful non-empty title and canonical where applicable.
Intentional behaviour changes: Duplicate `| Vendingpreneurs` suffixes are removed.
Previous intended behaviours preserved: Branded site template remains in one place; titles like `Apply | Vendingpreneurs` continue.
Unsafe outcomes: Removing brand entirely from pages, changing canonical URLs accidentally.
Dependencies: None.
Expected files:

- `src/app/about-us/page.tsx`
- `src/app/resources/[slug]/page.tsx` or the title data source normalization helper
- focused metadata tests if available.
  Write boundaries:
- listed files and tests only.
  Tests required: metadata/title assertions for `/resources/ztest1`, `/about-us`, and one route that already works.
  Runtime verification: production-build route smoke captures titles.
  Migration/backfill notes: None.
  External docs needed: none unless Next metadata behavior changes after S2.
  Acceptance criteria:
- `/resources/ztest1` title has one brand suffix.
- `/about-us` title has one brand suffix.
- Existing good titles remain branded once.
  Exit evidence: route-smoke JSON.
  Completed evidence:
- Reproduced before fix on production build: `/about-us` and `/resources/ztest1` titles contained `| Vendingpreneurs | Vendingpreneurs`; `/apply` was already branded once.
- Added `normalizeBrandedPageTitle` and used the root metadata title template as the single brand suffix.
- `npm test -- src/lib/metadata-titles.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- Production route smoke: `/about-us`, `/resources/ztest1`, and `/apply` HTTP 200 with exactly one `Vendingpreneurs` in `<title>`.
  Parallelization: parallel-safe with S5/S9.
  Blocked on: none.

#### AgentTaskContract

Eligible: yes.
Current adapter: deepseek-agent
Model route: deepseek-v4-flash:3 with GPT-5.5 parent review.
Model/effort: deepseek-v4-flash / high
Model routing reason: Narrow deterministic metadata cleanup.
Candidate strategy: tournament deepseek-v4-flash:3 -> gpt-5.5-medium consolidator
Read scope:

- `src/app/layout.tsx`
- `src/app/about-us/page.tsx`
- `src/app/resources/[slug]/page.tsx`
- route smoke artifact for title examples
  Allowed writes:
- `src/app/about-us/page.tsx`
- `src/app/resources/[slug]/page.tsx`
- focused metadata tests if created
  Must not touch:
- package files, migrations, unrelated route copy.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Page title includes brand | Rendered `<title>` contains one brand suffix | no | route smoke |
  | Page title excludes brand | Template appends brand once | yes | route smoke |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Title source | static metadata, dynamic DB title, fallback title | yes |
  | Brand suffix | absent, present once, present with spaces | yes |
- Previous-behavior preservation:
  - Canonicals unchanged.
- Parent hidden/strong validator:
  - Parent curls affected routes after production build.
    Agent task prompt:

```text
Fix duplicate Vendingpreneurs title suffixes by normalizing page-level metadata only. Preserve root metadata templating and canonicals. Do not change page copy or layout.
```

Acceptance commands:

- `npm run typecheck`
- `npm run build`
  Parent verification:
- route smoke titles for `/resources/ztest1`, `/about-us`, and `/apply`
  Failure policy:
- Stop if the fix needs broad metadata architecture changes.

### S5 - Emit Absolute Breadcrumb JSON-LD URLs

Status: done
Tier: T3
Type: frontend/SEO
Actor/trigger: Crawlers reading resource-page JSON-LD.
Action: Build breadcrumb structured data with absolute site URLs using the existing site URL helper.
Invariant protected: FAQ JSON-LD remains generated from visible FAQ blocks only.
Intentional behaviour changes: Breadcrumb `item` values change from relative paths to absolute URLs.
Previous intended behaviours preserved: Resource pages still render BreadcrumbList and FAQPage when FAQs exist.
Unsafe outcomes: Wrong production host, preview tokens in structured data, invalid JSON-LD.
Dependencies: None.
Expected files:

- `src/components/sections/ResourcePageRenderer.tsx`
- focused renderer test.
  Write boundaries:
- listed files only.
  Tests required: JSON-LD test for absolute breadcrumb item URLs and FAQ preservation.
  Runtime verification: `curl /resources/ztest1` parse JSON-LD.
  Migration/backfill notes: None.
  External docs needed: none unless validating Google rich result requirements.
  Acceptance criteria:
- Breadcrumb items are absolute `https://www.vendingpreneurs.com/...`.
- FAQ JSON-LD stays unchanged for visible FAQs.
  Exit evidence: parsed JSON-LD output.
  Completed evidence:
- Extracted structured-data construction into a pure helper using `absoluteUrl`.
- `npm test -- src/components/sections/resource-page-structured-data.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- Production-site route smoke: `/resources/ztest1` HTTP 200 and BreadcrumbList items were `https://www.vendingpreneurs.com/`, `https://www.vendingpreneurs.com/resources`, and `https://www.vendingpreneurs.com/resources/ztest1`; no visible forbidden error strings.
- FAQPage preservation covered by helper test with a visible FAQ block.
  Parallelization: parallel-safe with S4.
  Blocked on: none.

#### AgentTaskContract

Eligible: yes.
Current adapter: deepseek-agent
Model route: deepseek-v4-flash:3 with GPT-5.5 parent review.
Model/effort: deepseek-v4-flash / medium
Model routing reason: Narrow renderer output change.
Candidate strategy: tournament deepseek-v4-flash:3 -> gpt-5.5-medium consolidator
Read scope:

- `src/components/sections/ResourcePageRenderer.tsx`
- `src/lib/site.ts`
- renderer tests if present
  Allowed writes:
- `src/components/sections/ResourcePageRenderer.tsx`
- focused test file
  Must not touch:
- page builder schemas, admin UI, migrations.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Resource page slug | Breadcrumb item absolute URL | no | renderer/route test |
  | FAQ block visible | FAQPage JSON-LD still emitted | yes | renderer/route test |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Site URL | trailing slash, no trailing slash | yes |
  | Slug | normal slug, encoded-safe slug | yes |
- Previous-behavior preservation:
  - No structured data on invalid preview 404.
- Parent hidden/strong validator:
  - Parent parses rendered JSON-LD.
    Agent task prompt:

```text
Update resource-page breadcrumb JSON-LD to emit absolute URLs using the existing site URL contract. Preserve FAQ schema behavior and public rendering.
```

Acceptance commands:

- `npm run typecheck`
- targeted tests if added
  Parent verification:
- parse JSON-LD from production build route
  Failure policy:
- Stop if the fix requires changing DB content.

### S6 - Make Structured Data Settings Real Or Explicitly Retire Them

Status: done
Tier: T2
Type: backend/frontend
Actor/trigger: Admin edits SEO settings; public renderer emits schema.
Action: Define the supported `structured_data_settings` contract, wire it from admin form to draft/settings snapshots and renderer, or remove it from user-facing expectations if not needed for v1.
Invariant protected: Renderer never emits hidden/misleading schema and publish readiness does not claim schema controls that do nothing.
Intentional behaviour changes: Dead structured-data settings become real behavior or intentionally non-user-facing data.
Previous intended behaviours preserved: FAQ schema from visible FAQ blocks remains valid; published snapshots remain renderable.
Unsafe outcomes: Admin thinks schema is disabled while renderer emits it, admin thinks schema is enabled while renderer ignores it, invalid JSON-LD, migration breaking existing rows.
Dependencies: S5.
Expected files:

- `src/app/admin/pages/actions.ts`
- `src/lib/services/seo-pages.ts`
- `src/components/admin/SeoPageEditorForm.tsx`
- `src/components/sections/ResourcePageRenderer.tsx`
- `src/lib/page-builder/seo-readiness.ts`
- tests.
  Write boundaries:
- listed files and focused tests only.
  Tests required: form parse, draft save, publish snapshot, renderer schema output, readiness evidence.
  Runtime verification: admin edit/save/reload and public/preview render for a disposable page.
  Migration/backfill notes: Existing JSONB default is `{}`. Add migration only if a stricter shape or defaults are required.
  External docs needed: Google structured-data guidelines if adding new schema toggles.
  Acceptance criteria:
- There is no longer a storage field that product treats as a control while renderer ignores it.
- Existing pages with `{}` keep working.
  Exit evidence: tests plus rendered JSON-LD proof.
  Completed evidence:
- Implemented v1 settings contract `{ breadcrumb: boolean, faq: boolean }` with existing `{}` rows defaulting both controls enabled.
- `npm test -- src/lib/page-builder/structured-data-settings.test.ts src/components/sections/resource-page-structured-data.test.ts src/lib/page-builder/seo-readiness.test.ts src/lib/services/seo-pages.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Temp Supabase route proof: `/resources/ztest1` returned HTTP 200 with no JSON-LD graphs when both settings were disabled.
- Admin rendered verification with dev bypass on `localhost:3026`: disabled controls loaded unchecked, checking both controls and saving survived reload, publishing cleared `draft_settings` and updated `structured_data_settings` to `{ breadcrumb: true, faq: true }`.
- Admin screenshots reviewed: `/tmp/vending-s6-admin-structured-data-desktop.png` and `/tmp/vending-s6-admin-structured-data-mobile-controls.png`.
- Production route proof after publish on `localhost:3025`: `/resources/ztest1` returned HTTP 200 with `BreadcrumbList` and `FAQPage` JSON-LD graphs.
  Parallelization: single-threaded; shared contract.
  Blocked on: none, using assumption that v1 supports breadcrumb/FAQ visibility controls only if implemented.

#### AgentTaskContract

Eligible: no - cross-layer settings contract and possible migration need stronger-model/manual execution.
Current adapter: stronger-model/manual
Model route: gpt-5.5 high
Model routing reason: Shared data contract across admin, service, publish snapshot, renderer.
Read scope:

- listed Expected files
- design docs and roadmap
  Allowed writes:
- listed Expected files
- migration only if justified
  Must not touch:
- unrelated block schemas, AI proposal prompts, package files.
  Acceptance commands:
- focused tests
- `npm run typecheck`
- `npm run build`
  Parent verification:
- admin save/reload and rendered JSON-LD inspection
  Failure policy:
- Stop if product must decide additional schema types beyond breadcrumb/FAQ.

### S7 - Add Descriptive Card Link Labels

Status: done
Tier: T3
Type: frontend/schema
Actor/trigger: Public visitor/crawler and admin editing card-grid blocks.
Action: Add a descriptive card link label path with backward-compatible fallback derived from card title.
Invariant protected: Existing card-grid content remains valid; public card href safety remains enforced.
Intentional behaviour changes: Visible/accessibility link text is no longer repeated `Learn more` for every card.
Previous intended behaviours preserved: Existing `href` values continue, card count/layout limits continue, block preview parity remains.
Unsafe outcomes: Breaking old card JSON, inventing misleading labels, making cards unlinkable, losing href validation.
Dependencies: None.
Expected files:

- `src/lib/page-builder/blocks.ts`
- `src/components/sections/ResourcePageContent.tsx`
- `src/components/admin/SeoPageEditorForm.tsx`
- `src/lib/page-builder/block-preview-cases.ts`
- tests.
  Write boundaries:
- listed files and focused tests.
  Tests required: schema backward compatibility, renderer label fallback, editor persistence, Lighthouse/link-text rerun.
  Runtime verification: `/resources/ztest1` rendered links and block-preview parity `30/30`.
  Migration/backfill notes: Backward-compatible JSON schema default; no DB migration expected.
  External docs needed: none.
  Acceptance criteria:
- Existing cards without `linkLabel` render a descriptive link.
- Admin can edit visible link label if implemented.
- Lighthouse no longer reports the same link-text failure for card links.
  Exit evidence: targeted tests, parity report, Lighthouse/link extraction.
  Completed evidence:
- Added optional `linkLabel` to card-grid cards while preserving old card JSON without the field.
- Public card links now render editor-provided labels or fallback to `Learn more about {card title}`.
- Admin card settings expose `Card link label (optional)`; desktop and mobile screenshots reviewed: `/tmp/vending-s7-card-link-label-editor.png` and `/tmp/vending-s7-card-link-label-editor-mobile.png`.
- Fixed the block settings dialog z-index so it appears above mobile sidebars while editing card settings.
- `npm test -- src/lib/page-builder/blocks.test.ts src/lib/page-builder/block-preview-cases.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Block-preview parity audit on `localhost:3026`: 30 pass / 0 fail / 30 total across desktop and mobile.
- Production route link extraction on `localhost:3025/resources/ztest1`: four card labels rendered as `Learn more about Plan your route`, `Learn more about Compare locations`, `Explore launch support`, and `Learn more about Improve profits`; zero bare `Learn more` links.
  Parallelization: parallel-safe after current dirty block-preview files are understood.
  Blocked on: none.

#### AgentTaskContract

Eligible: yes, after parent confirms current dirty block-preview files are not user-owned work in conflict.
Current adapter: deepseek-agent
Model route: deepseek-v4-flash:5 with GPT-5.5 consolidator.
Model/effort: deepseek-v4-flash / high
Model routing reason: Bounded schema/render/editor change with tests.
Candidate strategy: tournament deepseek-v4-flash:5 -> gpt-5.5-medium consolidator
Read scope:

- listed Expected files
- design block contract
  Allowed writes:
- listed Expected files
- focused tests
  Must not touch:
- migrations, package files, unrelated block types, current temp screenshots.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Card has no label and has title | Link text/fallback is descriptive | no | unit/render test |
  | Card has explicit label | Explicit label renders | no | unit/render test |
  | Card has unsafe href | Existing href validator rejects | yes | block schema test |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Label | absent, empty, explicit, too long | yes |
  | Title | present, empty editor fallback | yes |
  | Property presence | absent property vs own property with `undefined` | yes |
- Previous-behavior preservation:
  - Existing card JSON validates.
  - Card layout variants unchanged.
- Parent hidden/strong validator:
  - Lighthouse/link extraction and parity script.
    Agent task prompt:

```text
Add descriptive card-grid link labels without breaking existing card JSON. Preserve href validation and layouts. Use a title-derived fallback when no explicit label exists, and add focused tests.
```

Acceptance commands:

- `npm test -- src/lib/page-builder/blocks.test.ts`
- `npm run typecheck`
  Parent verification:
- block-preview parity and Lighthouse link-text check
  Failure policy:
- Stop if resolving editor support requires a broad `SeoPageEditorForm` refactor.

### S8 - Preserve Apply Lead Qualification In All Lead Form Variants

Status: done
Tier: T2
Type: frontend/backend
Actor/trigger: Public visitor submits a builder lead form with `intent="apply"`.
Action: Ensure compact/sidebar variants do not bypass required application qualification data, or explicitly render as contact-only forms if product chooses that later.
Invariant protected: Lead attribution remains page/keyword/block/CTA/UTM/referrer-aware; apply leads contain required qualification fields.
Intentional behaviour changes: Compact/sidebar lead forms either collect qualification fields or are prevented from acting as application forms.
Previous intended behaviours preserved: Standard form still works; hidden attribution persists; idempotency stays intact.
Unsafe outcomes: More name/email-only application leads, broken lead submission, lost attribution, spam increase.
Dependencies: None.
Expected files:

- `src/components/sections/ResourcePageRenderer.tsx`
- `src/components/forms/PublicLeadForm.tsx`
- `src/lib/services/leads.ts`
- `src/lib/page-builder/blocks.ts`
- tests.
  Write boundaries:
- listed files and focused tests.
  Tests required: form rendering for all variants, backend validation for apply vs contact, lead service tests, browser submission with disposable cleanup if needed.
  Runtime verification: Public/preview page with compact/sidebar lead form; form fields visible and submit behavior confirmed safely.
  Migration/backfill notes: No schema change expected unless new required fields must be enforced at DB level.
  External docs needed: none.
  Acceptance criteria:
- No builder apply form variant can submit only name/email.
- Existing attribution hidden fields remain.
  Exit evidence: tests plus browser screenshot or safe E2E.
  Completed evidence:
- `npm test -- src/components/forms/PublicLeadForm.test.tsx src/lib/services/leads.test.ts`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- Rendered compact/sidebar apply forms on `/resources/ztest1` with required qualification fields visible:
  - `/tmp/vending-s8-compact-apply-fields.png`
  - `/tmp/vending-s8-sidebar-apply-fields.png`
  - `/tmp/vending-s8-compact-apply-mobile-fields.png`
- Safe browser E2E submitted a disposable compact apply lead with qualification fields and source attribution, confirmed the inserted row included `state_region`, `business_stage`, `budget`, `timeline`, `source_block_id`, and `source_cta_tracking_name`, then deleted lead `992aa74c-79c4-4b68-85c2-b9ed19d485dc` from the temp Supabase stack.
  Parallelization: single-threaded due conversion contract.
  Blocked on: none, defaulting to "layout variant must not weaken apply data".

#### AgentTaskContract

Eligible: no - conversion/lead contract affects customer-facing records and requires stronger review.
Current adapter: stronger-model/manual
Model route: gpt-5.5 high
Model routing reason: Lead data integrity and public form behavior.
Read scope:

- listed Expected files
- lead submission actions/tests
  Allowed writes:
- listed Expected files
- focused tests
  Must not touch:
- database lead table unless explicitly required, unrelated forms.
  Acceptance commands:
- lead/form targeted tests
- `npm run typecheck`
- `npm run build`
  Parent verification:
- rendered form screenshots and optional disposable lead cleanup
  Failure policy:
- Stop if product chooses compact apply forms should intentionally be low-friction name/email only.

### S9 - Replace StatusDot ARIA With Accessible Status Text

Status: done
Tier: T3
Type: frontend/a11y
Actor/trigger: Screen reader or keyboard user scans `/admin/pages`.
Action: Fix status/readiness dots so status is conveyed through valid accessible text without prohibited ARIA attributes.
Invariant protected: Visual table density and hover tooltip affordance remain.
Intentional behaviour changes: Assistive tech can read status labels; axe no longer flags `aria-prohibited-attr`.
Previous intended behaviours preserved: Dot colors, table sorting/filtering, page status/readiness labels.
Unsafe outcomes: Removing status information from screen readers or bloating the table visually.
Dependencies: None.
Expected files:

- `src/app/admin/pages/page.tsx`
- focused a11y helper test if practical.
  Write boundaries:
- listed file and focused test only.
  Tests required: typecheck; axe on `/admin/pages`.
  Runtime verification: Playwright+axe screenshot on `/admin/pages`.
  Migration/backfill notes: None.
  External docs needed: axe rule docs if needed.
  Acceptance criteria:
- `aria-prohibited-attr` no longer appears for status dots.
- Visible UI remains compact and understandable.
  Exit evidence: axe JSON.
  Completed evidence:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Rendered `/admin/pages` with desktop/mobile screenshots:
  - `/tmp/vending-s9-admin-pages-desktop.png`
  - `/tmp/vending-s9-admin-pages-mobile.png`
- Hover tooltip proof:
  - `/tmp/vending-s9-admin-pages-dot-tooltip-visible.png`
- Axe JSON:
  - `/tmp/vending-s9-admin-pages-axe.json`
- Axe result: `aria-prohibited-attr` count is 0. The remaining `/admin/pages` axe violation is `color-contrast`, already tracked as S11.
  Parallelization: parallel-safe.
  Blocked on: none.

#### AgentTaskContract

Eligible: yes.
Current adapter: deepseek-agent
Model route: deepseek-v4-flash:3 with GPT-5.5 parent review.
Model/effort: deepseek-v4-flash / medium
Model routing reason: Narrow TSX a11y fix.
Candidate strategy: tournament deepseek-v4-flash:3 -> gpt-5.5-medium consolidator
Read scope:

- `src/app/admin/pages/page.tsx`
- admin design contract
  Allowed writes:
- `src/app/admin/pages/page.tsx`
- focused test if needed
  Must not touch:
- admin services, filters, data fetching, migrations.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Readiness dot | Valid accessible name/status text | no | axe |
  | Status dot | Valid accessible name/status text | no | axe |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Tone | red, amber, green, slate | yes |
  | Tooltip | hover/focus, screen reader | yes |
- Previous-behavior preservation:
  - Visual dot and tooltip remain.
- Parent hidden/strong validator:
  - axe route pass.
    Agent task prompt:

```text
Fix the admin page list status dots so status/readiness labels are exposed accessibly without prohibited ARIA. Preserve the compact visual dot UI and tooltip behavior.
```

Acceptance commands:

- `npm run typecheck`
- `npm run lint`
  Parent verification:
- Playwright axe on `/admin/pages`
  Failure policy:
- Stop if the fix requires redesigning the table.

### S10 - Repair Immersive Editor Landmarks And Heading Structure

Status: done
Tier: T3
Type: frontend/a11y
Actor/trigger: Admin opens `/admin/pages/new` or an existing page editor.
Action: Ensure the immersive editor has one top-level `main`, an appropriate H1 or equivalent page name, and valid top-level complementary landmarks.
Invariant protected: Public-like canvas remains page-like and admin shell still suppresses marketing header/footer.
Intentional behaviour changes: Landmarks/headings become valid for assistive tech.
Previous intended behaviours preserved: Editor layout, sticky sidebars, save/publish actions, start panel and scratch flow.
Unsafe outcomes: Losing the page-like canvas, adding visible clutter, breaking save/reload, hiding primary actions.
Dependencies: None.
Expected files:

- `src/components/admin/AdminShell.tsx`
- `src/components/admin/SeoPageEditorForm.tsx`
- possibly small admin layout helper.
  Write boundaries:
- listed files and focused tests only.
  Tests required: typecheck/lint; axe on new choice and editor after From scratch.
  Runtime verification: desktop and mobile screenshots for `/admin/pages/new`.
  Migration/backfill notes: None.
  External docs needed: none.
  Acceptance criteria:
- No duplicate/nested main landmark warnings.
- Page has an H1 or valid equivalent that passes axe.
- Editor still visually matches design contract.
  Exit evidence: axe JSON and screenshots.
  Completed evidence:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Axe before fix reproduced `page-has-heading-one`, `landmark-complementary-is-top-level`, `landmark-main-is-top-level`, `landmark-no-duplicate-main`, and `landmark-unique` on `/admin/pages/new` after From scratch.
- Axe after fix:
  - `/tmp/vending-s10-new-choice-axe.json`: no violations.
  - `/tmp/vending-s10-scratch-editor-axe.json`: only the pre-existing `color-contrast` violation remains for S11.
- Landmark probe after fix: scratch editor has one `main`, one H1 (`New resource page`), zero `aside` landmarks, and labeled editor panel sections.
- Rendered verification:
  - `/tmp/vending-s10-new-choice-desktop.png`
  - `/tmp/vending-s10-scratch-editor-desktop.png`
  - `/tmp/vending-s10-new-choice-mobile.png`
  - `/tmp/vending-s10-scratch-editor-mobile.png`
    Parallelization: no with S11; shares UI/a11y surface.
    Blocked on: none.

#### AgentTaskContract

Eligible: no - shared shell/editor landmark semantics need parent UX judgment.
Current adapter: stronger-model/manual
Model route: gpt-5.5 medium
Model routing reason: Cross-component landmark fix with rendered verification.
Read scope:

- listed Expected files
- design docs
  Allowed writes:
- listed Expected files only
  Must not touch:
- server actions, block schemas, migrations.
  Acceptance commands:
- `npm run typecheck`
- `npm run lint`
  Parent verification:
- Playwright screenshots and axe for new choice and scratch editor
  Failure policy:
- Stop if the only fix makes the canvas less page-like or hides controls.

### S11 - Fix Confirmed Contrast Failures

Status: done
Tier: T3
Type: frontend/a11y
Actor/trigger: Public visitor/admin using affected pages.
Action: Adjust color classes/tokens on confirmed failing text/control surfaces.
Invariant protected: Brand look remains recognizable and state colors remain meaningful.
Intentional behaviour changes: Foreground/background contrast passes WCAG AA for confirmed nodes.
Previous intended behaviours preserved: Layout, copy, links, and status meanings.
Unsafe outcomes: One-off color changes that create new contrast failures elsewhere or collapse state distinction.
Dependencies: Prefer S9/S10 first.
Expected files:

- affected public section components
- admin shell/list/editor components
- global CSS only if a token-level fix is safer.
  Write boundaries:
- exact files determined by axe target mapping before implementation.
  Tests required: axe on `/resources/ztest1`, invalid preview page, `/admin/pages`, `/admin/pages/block-preview-audit`, editor.
  Runtime verification: screenshots and axe JSON.
  Migration/backfill notes: None.
  External docs needed: none.
  Acceptance criteria:
- No confirmed color-contrast violations remain on audited routes.
- UI still matches design contracts.
  Exit evidence: axe JSON and screenshots.
  Completed evidence:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Target map before fix:
  - `/tmp/vending-s11-contrast-map.json`
- Axe after fix:
  - `/tmp/vending-s11-contrast-after.json`
  - `color-contrast` count is 0 for `/resources/ztest1`, `/resources/preview/not-a-real-token-for-audit`, `/admin/pages`, `/admin/pages/block-preview-audit`, `/admin/pages/new`, and `/admin/pages/new` after From scratch.
  - Remaining non-contrast findings are the already-sliced invalid-preview document/landmark semantics and block-preview audit complementary landmark semantics.
- Rendered verification:
  - `/tmp/vending-s11-resource-desktop.png`
  - `/tmp/vending-s11-resource-mobile.png`
  - `/tmp/vending-s11-admin-pages-desktop.png`
  - `/tmp/vending-s11-block-preview-audit-desktop.png`
  - `/tmp/vending-s11-scratch-editor-desktop.png`
  - `/tmp/vending-s11-scratch-editor-mobile.png`
    Parallelization: parallel-safe after target mapping.
    Blocked on: none.

#### AgentTaskContract

Eligible: yes after parent maps exact axe targets to files.
Current adapter: deepseek-agent
Model route: deepseek-v4-flash:3 with GPT-5.5 parent review.
Model/effort: deepseek-v4-flash / medium
Model routing reason: Bounded visual token/class edits after target mapping.
Candidate strategy: tournament deepseek-v4-flash:3 -> gpt-5.5-medium consolidator
Read scope:

- axe JSON target map
- exact affected component files
- design contracts
  Allowed writes:
- exact mapped component/CSS files only
  Must not touch:
- content, routes, services, schemas, migrations.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Confirmed failing text node | Contrast passes | no | axe |
  | Status/control colors | Meaning remains visible | yes | screenshot |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Route type | public, admin list, admin editor, audit page | yes |
- Previous-behavior preservation:
  - No layout/copy changes.
- Parent hidden/strong validator:
  - Full axe rerun on audited routes.
    Agent task prompt:

```text
Fix only confirmed axe color-contrast failures using the provided target-to-file map. Preserve layout, copy, and state meaning. Do not broaden into visual redesign.
```

Acceptance commands:

- `npm run typecheck`
- `npm run lint`
  Parent verification:
- axe and screenshots
  Failure policy:
- Stop if target mapping is unclear.

### S12 - Add A Useful Empty Draft Preview State

Status: done
Tier: T3
Type: frontend/UX
Actor/trigger: Admin clicks Save and preview on a draft with no public body blocks.
Action: Render a clear noindex preview-only empty state instead of a blank body between header/footer.
Invariant protected: Preview token security and public published rendering remain unchanged.
Intentional behaviour changes: Empty previews explain that the draft has no content yet.
Previous intended behaviours preserved: Valid non-empty draft previews render the actual page; invalid tokens return true 404 after S3.
Unsafe outcomes: Empty preview state appearing on published pages, leaking admin-only details, indexing preview pages.
Dependencies: Prefer S3 first.
Expected files:

- `src/components/sections/ResourcePageRenderer.tsx` or preview route wrapper
- focused tests.
  Write boundaries:
- listed file(s) and tests only.
  Tests required: empty draft preview render, non-empty preview render, published empty state not possible or handled.
  Runtime verification: Save-and-preview disposable empty page screenshot.
  Migration/backfill notes: None.
  External docs needed: none.
  Acceptance criteria:
- Empty preview communicates "No page content yet" or equivalent preview-only guidance.
- Published renderer does not show admin guidance.
  Exit evidence: screenshot and route status.
  Completed evidence:
- `npm test -- src/components/forms/PublicLeadForm.test.ts src/components/sections/ResourcePageRenderer.test.ts src/lib/services/leads.test.ts`
- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Disposable browser save-and-preview created empty draft slug `codex-s12-empty-preview-1779968497526`, opened preview URL with HTTP 200, rendered "No page content yet", then deleted page `01a3734c-13aa-4905-a278-80eefaf7f375` and its preview token from the temp Supabase stack.
- Rendered verification:
  - `/tmp/vending-s12-empty-preview-desktop.png`
  - `/tmp/vending-s12-empty-preview-mobile.png`
    Parallelization: parallel-safe.
    Blocked on: none.

#### AgentTaskContract

Eligible: yes.
Current adapter: deepseek-agent
Model route: deepseek-v4-flash:3 with GPT-5.5 parent review.
Model/effort: deepseek-v4-flash / medium
Model routing reason: Narrow render state.
Candidate strategy: tournament deepseek-v4-flash:3 -> gpt-5.5-medium consolidator
Read scope:

- `src/app/resources/preview/[token]/page.tsx`
- `src/components/sections/ResourcePageRenderer.tsx`
- preview tests
  Allowed writes:
- listed files and focused tests
  Must not touch:
- preview token service, migrations, public published route unless needed for shared prop.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Preview page with no blocks | Shows preview-only empty state | no | browser |
  | Preview page with blocks | Renders blocks | yes | browser/test |
  | Published page | No admin preview guidance | yes | route smoke |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Content | zero blocks, one block, invalid token | yes |
- Previous-behavior preservation:
  - Token noindex remains.
- Parent hidden/strong validator:
  - disposable save-preview E2E.
    Agent task prompt:

```text
Add a preview-only empty-body state for resource draft previews. Do not change published page rendering or preview token validation.
```

Acceptance commands:

- `npm run typecheck`
- targeted tests if added
  Parent verification:
- disposable save-preview screenshot and cleanup
  Failure policy:
- Stop if implementation requires changing preview token storage.

### S13 - Clean Up Block Preview Audit Semantics Without Breaking Parity

Status: done
Tier: T3
Type: frontend/internal QA
Actor/trigger: Admin/internal QA opens `/admin/pages/block-preview-audit`.
Action: Reduce semantic/landmark noise from repeated embedded public renders while keeping the visual comparison and parity markers intact.
Invariant protected: The parity script must still pass 30/30 on desktop and mobile.
Intentional behaviour changes: The audit route should no longer produce avoidable landmark/H1 axe noise from repeated previews.
Previous intended behaviours preserved: Picker preview vs actual render can still be compared; script still writes report outside repo when run from `/tmp`.
Unsafe outcomes: Hiding real preview content from the parity script, breaking QA markers, reducing visual fidelity.
Dependencies: Prefer S10 first.
Expected files:

- `src/app/admin/pages/block-preview-audit/page.tsx`
- `src/lib/page-builder/block-preview-cases.ts`
- `scripts/block-preview-parity-audit.mjs` only if needed.
  Write boundaries:
- listed files and focused tests.
  Tests required: parity script, axe on audit page.
  Runtime verification: screenshot and parity report.
  Migration/backfill notes: None.
  External docs needed: none.
  Acceptance criteria:
- `block-preview-parity-audit.mjs` remains 30 PASS.
- Avoidable audit-page landmark warnings are resolved or documented as intentional.
  Exit evidence: parity log and axe JSON.
  Completed evidence:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Axe on `/admin/pages/block-preview-audit`:
  - `/tmp/vending-s13-block-preview-audit-axe.json`
  - violation count 0
- Parity script:
  - `PLAYWRIGHT_IMPORT_PATH=file:///tmp/vending-playwright-s6/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' SMOKE_BASE_URL=http://localhost:3026 node scripts/block-preview-parity-audit.mjs`
  - Summary: 30 pass, 0 fail, 0 needs human, 0 skip, 30 total.
  - Report: `tmp-block-preview-parity-report.json`
- Rendered verification:
  - `/tmp/vending-s13-block-preview-audit-desktop.png`
    Parallelization: parallel-safe, but current dirty files in this area must be reviewed first.
    Blocked on: none.

#### AgentTaskContract

Eligible: yes after dirty worktree review.
Current adapter: deepseek-agent
Model route: deepseek-v4-flash:3 with GPT-5.5 parent review.
Model/effort: deepseek-v4-flash / medium
Model routing reason: Internal route semantics with hard parity validator.
Candidate strategy: tournament deepseek-v4-flash:3 -> gpt-5.5-medium consolidator
Read scope:

- listed Expected files
- current parity report
  Allowed writes:
- listed Expected files only
  Must not touch:
- public renderer, block schemas, unrelated screenshots.
  Agent Task Module readiness gate:
- Semantic delta count: 1.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | Audit page | Lower semantic noise | no | axe |
  | Parity markers | Still detectable | yes | parity script |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Viewport | desktop, mobile | yes |
- Previous-behavior preservation:
  - 30 preview cases still render.
- Parent hidden/strong validator:
  - parity script and screenshot.
    Agent task prompt:

```text
Clean up block-preview audit route semantics without changing public renderer behavior or parity marker behavior. Keep the 30-case parity script passing.
```

Acceptance commands:

- `npm run typecheck`
- parity script
  Parent verification:
- axe and parity report
  Failure policy:
- Stop if parity script fails for content changes.

### S14 - Improve Public Resource Page LCP And CLS

Status: done
Tier: T3
Type: frontend/performance
Actor/trigger: Public visitor loading resource pages.
Action: Address confirmed LCP image warning and CLS on `/resources/ztest1` without broad visual redesign.
Invariant protected: Public layout and content stay visually equivalent except for stability/performance improvements.
Intentional behaviour changes: Above-the-fold image/loading strategy and layout reservation improve metrics.
Previous intended behaviours preserved: Page content, CTA behavior, structured data, and mobile layout remain.
Unsafe outcomes: Hidden content, distorted images, worse mobile layout, unbounded image priority everywhere.
Dependencies: Prefer S4/S5 first to avoid repeated Lighthouse baselines.
Expected files:

- `src/components/site/Wordmark.tsx`
- `src/components/site/Header.tsx`
- `src/app/resources/[slug]/loading.tsx`
  Write boundaries:
- exact mapped files only.
  Tests required: build and Lighthouse rerun.
  Runtime verification: Lighthouse desktop and mobile if practical; screenshot comparison.
  Migration/backfill notes: None.
  External docs needed: local Next Image docs if using image priority/loading changes.
  Acceptance criteria:
- LCP improves from 3.7s or warning is resolved with clear reason.
- CLS materially improves from 0.535 and no visible overlap/regression.
  Exit evidence: Lighthouse JSON before/after and screenshots.
  Completed evidence:
- `npm run typecheck`
- `npm run lint`
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55431 NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_DEV_AUTH_BYPASS=1 npm run build`
- Lighthouse desktop on `http://localhost:3025/resources/ztest1`:
  - Before: `/tmp/vending-s14-before.json`
  - After: `/tmp/vending-s14-after.json`
  - Performance score: 0.69 -> 0.95
  - LCP: 3520ms -> 2995ms
  - CLS: 0.577 -> 0
  - Layout-shift items: 2 -> 0
  - Fresh baseline had no `largest-contentful-paint-element` or `prioritize-lcp-image` audit object; the confirmed LCP/CLS regression was the route-level loading fallback letting the footer render inside the viewport before dynamic resource content streamed in.
- Rendered verification:
  - `/tmp/vending-s14-resource-after-desktop.png`
  - `/tmp/vending-s14-resource-after-mobile.png`
  - Desktop/mobile screenshots show no horizontal overflow and stable wordmark boxes: header 159x48, footer 119x36.
    Parallelization: parallel-safe after target mapping.
    Blocked on: none.

#### AgentTaskContract

Eligible: no - performance tuning needs rendered measurement and target mapping.
Current adapter: stronger-model/manual
Model route: gpt-5.5 medium
Model routing reason: Metrics can regress subtly; parent browser proof required.
Read scope:

- Lighthouse JSON
- affected render/image components after mapping
- local Next Image docs
  Allowed writes:
- exact mapped component files only
  Must not touch:
- content copy, DB, admin UI, unrelated global layout.
  Acceptance commands:
- `npm run build`
- Lighthouse rerun
  Parent verification:
- screenshots and metric comparison
  Failure policy:
- Stop if metric improvement requires product-level visual changes.

### S15 - Add Stable Coverage And Stryker Harness

Status: done
Tier: T2
Type: verification/tooling
Actor/trigger: Developer runs verification gates.
Action: Add repo-owned coverage dependency/config and Stryker mutation config/scripts for builder-critical modules.
Invariant protected: Verification should fail honestly and not depend on ad hoc `/tmp` tooling.
Intentional behaviour changes: `npm run test -- --coverage` and mutation commands become reproducible.
Previous intended behaviours preserved: Existing tests still pass; package scripts remain understandable.
Unsafe outcomes: Lockfile churn beyond verification deps, slow default `npm test`, mutation config that hides weak areas, CI instability.
Dependencies: None.
Expected files:

- `package.json`
- `package-lock.json`
- `stryker.conf.*` or equivalent
- `eslint.config.mjs`
- docs/plan notes if needed.
  Write boundaries:
- listed files only.
  Tests required: coverage command dry run; Stryker dry run/targeted module run.
  Runtime verification: none.
  Migration/backfill notes: None.
  External docs needed: current Stryker/Vitest docs if config behavior is uncertain.
  Acceptance criteria:
- Coverage command runs.
- Stryker can target TS/TSX modules without `/tmp` installs.
- Related-test gaps are documented or configured intentionally.
  Exit evidence: command logs.
  Completed evidence:
- `npm run test -- --coverage`
  - 31 test files passed.
  - 154 tests passed.
  - Coverage provider: v8 via repo-owned `@vitest/coverage-v8@4.1.5`.
  - Summary: statements 66.3%, branches 51.24%, functions 72.46%, lines 70.17%.
- `npm run mutate:dry`
  - Stryker found 10 configured source files to mutate.
  - Instrumented 4045 mutants.
  - Initial Vitest dry run succeeded: 107 tests in 1 second.
- `npm run mutate:dry -- --mutate src/components/sections/ResourcePageRenderer.tsx --testFiles src/components/sections/ResourcePageRenderer.test.ts`
  - TSX target accepted without `/tmp` installs.
  - Instrumented 1 source file with 41 mutants.
  - Initial Vitest dry run succeeded: 3 tests.
- `npm run typecheck`
- `npm run lint`
- `npm audit --audit-level=moderate`
  - Remaining finding is the known Next/PostCSS moderate advisory requiring a force downgrade path.
  - Stryker's transitive `typed-rest-client -> qs` advisory was cleared with an npm override to `qs@6.15.2`.
- Install note: npm emitted non-fatal `EBADENGINE` warnings for transitive `ini`/`mute-stream` under local Node `v25.8.1`; coverage and Stryker dry runs still passed.
  Parallelization: single-threaded package/lockfile.
  Blocked on: none.

#### AgentTaskContract

Eligible: no - package/lockfile/tooling graph is single-threaded.
Current adapter: stronger-model/manual
Model route: gpt-5.5 medium
Model routing reason: Dependency and config changes.
Read scope:

- package files
- current mutation logs
- Vitest config
  Allowed writes:
- `package.json`
- `package-lock.json`
- Stryker config file
- optional verification docs
  Must not touch:
- production runtime code, migrations.
  Acceptance commands:
- `npm run test -- --coverage`
- targeted Stryker dry run
  Parent verification:
- no package audit regression beyond known dependencies
  Failure policy:
- Stop if adding coverage/mutation tooling requires large dependency upgrades unrelated to this repo.

### S16 - Harden Domain Logic Mutation Coverage

Status: done
Tier: T2
Type: verification/tests
Actor/trigger: Mutation runner targets page-builder pure/domain modules.
Action: Add/strengthen tests until core domain modules kill important surviving mutants.
Invariant protected: Tests prove behavior, not implementation details.
Intentional behaviour changes: Test coverage only unless a test reveals a real bug that must become a new slice.
Previous intended behaviours preserved: Existing public/editor behavior.
Unsafe outcomes: Brittle tests that bless current bugs, broad runtime changes hidden in test slice.
Dependencies: S15.
Expected files:

- `src/lib/page-builder/seo-readiness.test.ts`
- `src/lib/page-builder/blocks.test.ts`
- `src/lib/page-builder/content-ops.test.ts`
- possibly `src/lib/page-builder/block-preview-cases.test.ts`.
  Write boundaries:
- test files only unless a real bug is split into a new implementation slice.
  Tests required: targeted tests and mutation reruns for `seo-readiness.ts`, `blocks.ts`, `content-ops.ts`.
  Runtime verification: none.
  Migration/backfill notes: None.
  External docs needed: none.
  Acceptance criteria:
- Meaningful mutation improvement for domain modules, with surviving mutants triaged.
- No runtime code changes in this slice unless separately approved.
  Exit evidence: mutation logs.
  Completed evidence:
- Added test-only coverage in:
  - `src/lib/page-builder/seo-readiness.test.ts`
  - `src/lib/page-builder/blocks.test.ts`
  - `src/lib/page-builder/content-ops.test.ts`
- `npm run test -- src/lib/page-builder/seo-readiness.test.ts src/lib/page-builder/blocks.test.ts src/lib/page-builder/content-ops.test.ts`
  - 3 files passed.
  - 35 tests passed.
- `npm run test`
  - 31 files passed.
  - 162 tests passed.
- `npm run typecheck`
- `npm run lint`
- Mutation reruns:
  - `/tmp/vending-s16-seo-readiness.log`: `seo-readiness.ts` score 21.05 -> 28.08; killed 148 -> 185, timeouts 0 -> 9.
  - `/tmp/vending-s16-blocks.log`: `blocks.ts` score 58.44 -> 60.04; covered score 77.84.
  - `/tmp/vending-s16-content-ops.log`: `content-ops.ts` score 42.15 -> 43.05; added boundary coverage for invalid move/reorder inputs.
- Surviving-mutant triage:
  - `content-ops.ts` still has equivalent/guarded survivors around `moveItem` out-of-range checks because `moveItemToIndex` independently rejects the same invalid targets.
  - `blocks.ts` survivors remain around broader `http:`/media-source acceptance and rich-text node-shape guards; new tests now prove external CTA/hero links are excluded from internal-link collection and root/resource paths are accepted.
  - `seo-readiness.ts` still has broad survivor clusters in private normalization/completion helpers; new tests prove body heading nodes clear the missing-subsection opportunity and repeated whitespace is counted correctly.
    Parallelization: parallel-safe after S15.
    Blocked on: S15.

#### AgentTaskContract

Eligible: yes after S15.
Current adapter: deepseek-agent
Model route: deepseek-v4-pro:1 or deepseek-v4-flash:5 with GPT-5.5 consolidator.
Model/effort: deepseek-v4-pro / high
Model routing reason: Branch-heavy tests and mutation triage.
Candidate strategy: tournament deepseek-v4-flash:5 -> gpt-5.5-medium consolidator
Read scope:

- listed Expected files
- mutation logs for domain modules
- corresponding source modules
  Allowed writes:
- listed test files only
  Must not touch:
- runtime code, package files, migrations, snapshots unrelated to tests.
  Agent Task Module readiness gate:
- Semantic delta count: 1 test-hardening pass.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | surviving readiness mutant | test fails mutant | yes | Stryker |
  | surviving block schema mutant | test fails mutant | yes | Stryker |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Optional values | absent, empty, null, undefined | yes |
  | Boundary counts | min, max, over max | yes |
- Previous-behavior preservation:
  - Existing tests still pass.
- Parent hidden/strong validator:
  - Parent reruns Stryker subset.
    Agent task prompt:

```text
Strengthen tests only for page-builder domain modules using the provided surviving-mutant logs. Do not change runtime code. If a mutant exposes a real runtime bug, stop and report the needed new slice.
```

Acceptance commands:

- targeted Vitest
- targeted Stryker modules
  Parent verification:
- mutation score/log review
  Failure policy:
- Stop if runtime code edits are needed.

### S17 - Harden Service, Public Render, And Lead Mutation Coverage

Status: done
Tier: T2
Type: verification/tests
Actor/trigger: Mutation runner targets service/public/lead modules.
Action: Add/strengthen tests for `seo-pages`, public page lookup, leads, attribution, and renderer import coverage.
Invariant protected: Service tests cover security-sensitive branches and public contract behavior.
Intentional behaviour changes: Test coverage only unless real bugs are split out.
Previous intended behaviours preserved: Public rendering, lead submission, preview creation, redirects.
Unsafe outcomes: Mock-only tests that miss RLS/data-shape risk, runtime changes inside a test hardening slice.
Dependencies: S15 and relevant implementation slices when tests depend on new behavior.
Expected files:

- `src/lib/services/seo-pages.test.ts`
- `src/lib/services/seo-page-public.test.ts`
- `src/lib/services/leads.test.ts`
- `src/lib/page-builder/resource-lead-attribution.test.ts`
- renderer tests if added.
  Write boundaries:
- test files only unless new bug slice is created.
  Tests required: targeted Vitest and Stryker for service modules.
  Runtime verification: none, unless RLS/public shape tests are integration-style.
  Migration/backfill notes: None.
  External docs needed: none.
  Acceptance criteria:
- Important surviving mutants around error paths, redirects, normalization, lead validation, public selection, and attribution are killed.
- TSX renderer has at least import/render coverage or is documented as browser-only with parent axe/Lighthouse gates.
  Exit evidence: mutation logs.
  Completed evidence:
- Added test-only coverage in:
  - `src/lib/services/seo-pages.test.ts`
  - `src/lib/services/seo-page-public.test.ts`
  - `src/lib/services/leads.test.ts`
  - `src/lib/page-builder/resource-lead-attribution.test.ts`
  - Existing renderer coverage from `src/components/sections/ResourcePageRenderer.test.ts` remains in the targeted S17 gate.
- `npm run test -- src/lib/services/seo-pages.test.ts src/lib/services/seo-page-public.test.ts src/lib/services/leads.test.ts src/lib/page-builder/resource-lead-attribution.test.ts src/components/sections/ResourcePageRenderer.test.ts`
  - 5 files passed.
  - 39 tests passed.
- `npm run test`
  - 31 files passed.
  - 168 tests passed.
- `npm run typecheck`
- `npm run lint`
- Mutation reruns:
  - `/tmp/vending-s17-seo-pages-alltests.log`: `seo-pages.ts` score 46.24 -> 48.96; killed 418 -> 449. Redirect normalization/rejection survivors remain around equivalent root-path/trailing-slash guards.
  - `/tmp/vending-s17-seo-page-public.log`: `seo-page-public.ts` score 47.37 -> 71.88; covered score 82.14. Remaining survivors are mostly Supabase client option/select-string assertions and list error branches.
  - `/tmp/vending-s17-leads.log`: `leads.ts` score 36.40 -> 61.09; covered score 66.83. Remaining survivors are mostly optional Slack label/format separator variants and response-body truncation.
  - `/tmp/vending-s17-resource-lead-attribution.log`: `resource-lead-attribution.ts` score 63.16 -> 73.68; remaining default-empty-field survivors are overwritten by actual page/block identity in the returned attribution.
    Parallelization: parallel-safe with S16 after S15, except when touching shared test helpers.
    Blocked on: S15.

#### AgentTaskContract

Eligible: yes after S15, except RLS/integration cases remain parent-owned.
Current adapter: deepseek-agent
Model route: deepseek-v4-pro:1 or deepseek-v4-flash:5 with GPT-5.5 consolidator.
Model/effort: deepseek-v4-pro / high
Model routing reason: Branch-heavy service tests.
Candidate strategy: tournament deepseek-v4-flash:5 -> gpt-5.5-medium consolidator
Read scope:

- listed Expected files
- corresponding source modules
- mutation logs
  Allowed writes:
- listed test files only
  Must not touch:
- runtime code, migrations, package files.
  Agent Task Module readiness gate:
- Semantic delta count: 1 test-hardening pass.
- Runtime contract table:
  | Input/state | Expected output/effect | Must preserve? | Verification |
  | --- | --- | --- | --- |
  | service error branch | stable error/null behavior | yes | unit/mutation |
  | lead apply input missing qualifiers | rejected or covered per S8 | yes | unit/mutation |
  | redirect normalization | trailing slash/query behavior preserved | yes | unit/mutation |
- Edge-case matrix:
  | Dimension | Required cases | Included in validator? |
  | --- | --- | --- |
  | Service responses | data, null, error | yes |
  | Path values | root-relative, external http(s), protocol-relative, trailing slash | yes |
  | Lead fields | absent, empty, malformed email, duplicate key | yes |
- Previous-behavior preservation:
  - Existing tests still pass.
- Parent hidden/strong validator:
  - Parent reruns Stryker subset.
    Agent task prompt:

```text
Strengthen tests only for SEO services, public lookup, leads, attribution, and renderer import coverage using the surviving-mutant logs. Do not change runtime code; report any real bug as a new slice.
```

Acceptance commands:

- targeted Vitest
- targeted Stryker modules
  Parent verification:
- mutation score/log review
  Failure policy:
- Stop if runtime code edits are needed.

### S18 - Harden AI Proposal And Admin Action Mutation Coverage

Status: done
Tier: T2
Type: verification/tests
Actor/trigger: Mutation runner targets AI proposal services, OpenAI agent helper, and admin page actions.
Action: Add importable tests or refactor test seams narrowly so Stryker can execute meaningful tests for these files.
Invariant protected: AI proposals remain source-bound, schema-valid, admin-approved, and action errors do not leak unsafe details.
Intentional behaviour changes: Testability seams only if required; otherwise tests only.
Previous intended behaviours preserved: AI cannot directly publish; admin accepts selected blocks only; service-role RPC remains guarded.
Unsafe outcomes: Weakening AI validation, exposing raw errors to UI, changing RPC permissions, broad server-action refactor.
Dependencies: S15.
Expected files:

- `src/lib/services/ai-page-proposals.test.ts`
- `src/lib/services/openai-seo-agent.test.ts`
- `src/app/admin/pages/actions.ts` only if extracting pure helpers is necessary
- new test file for action helpers if needed.
  Write boundaries:
- tests and tiny pure-helper extraction only.
  Tests required: AI warning/source-ref cases, invalid proposal schema, accepted block IDs, admin action error mapping, Stryker rerun.
  Runtime verification: none unless action behavior changes.
  Migration/backfill notes: None.
  External docs needed: OpenAI structured output docs only if prompt/API behavior is changed, which this slice should avoid.
  Acceptance criteria:
- Stryker no longer reports "No tests were executed" for admin action ranges or documents an intentional non-mutated boundary.
- AI/OpenAI mutation scores improve materially or survivors are triaged.
  Exit evidence: mutation logs.
  Parallelization: parallel-safe with S16/S17 after S15 if write files are disjoint.
  Blocked on: S15.

#### AgentTaskContract

Eligible: no for admin action extraction; AI pure-test subsets may be delegated only after parent creates exact test seams.
Current adapter: stronger-model/manual
Model route: gpt-5.5 high
Model routing reason: Server actions, AI validation, and error exposure are safety-sensitive.
Read scope:

- listed Expected files
- mutation logs
  Allowed writes:
- listed files only
  Must not touch:
- OpenAI prompt semantics, migrations, RPC grants, package files.
  Acceptance commands:
- targeted Vitest
- targeted Stryker modules
  Parent verification:
- review surviving mutants for safety relevance
  Failure policy:
- Stop if testability requires broad server-action redesign.

#### Evidence

- Added importable admin action tests covering missing page IDs, safe OpenAI configuration error mapping, invalid UUID rejection before service calls, successful AI block insertion, and AI proposal validation error display.
- Added AI proposal service coverage for rejecting proposal creation when selected source excerpts are not approved.
- Added OpenAI agent coverage for source-bound prompt input and bounded/truncated source material without leaking API keys.
- Targeted Vitest: `npm run test -- src/app/admin/pages/actions.test.ts src/lib/services/ai-page-proposals.test.ts src/lib/services/openai-seo-agent.test.ts` passed 15 tests.
- Admin action Stryker dry run: `/tmp/vending-s18-admin-actions-dry.log` found `src/app/admin/pages/actions.ts`, ran 5 tests, and no longer reports "No tests were executed".
- AI proposal mutation rerun: `/tmp/vending-s18-ai-page-proposals.log` score 27.27 -> 48.33, killed 57 -> 101.
- OpenAI agent mutation rerun: `/tmp/vending-s18-openai-seo-agent.log` score 23.47 -> 26.28, covered score 46.00 -> 50.74, killed 92 -> 103.
- Full gates: `npm run test` passed 32 files / 175 tests; `npm run typecheck` passed; `npm run lint` passed.
- Surviving mutants are triaged as lower-risk prompt/response parsing and Supabase query-chain observability gaps; no prompt semantics, RPC grants, migrations, or action behavior changed.

### S19 - Resolve Audit Artifact And Format Gate Hygiene

Status: done
Tier: T2
Type: tooling/docs
Actor/trigger: Developer runs `npm run format:check`.
Action: Decide and apply a repo-safe policy for temporary audit scripts/reports: keep and format as intentional tooling, move to a tracked plan/report folder, or delete/ignore disposable artifacts with user approval when needed.
Invariant protected: Do not delete or rewrite user-owned untracked work accidentally.
Intentional behaviour changes: `format:check` returns green for intended repo state.
Previous intended behaviours preserved: Useful parity audit script/report remains available if product wants it.
Unsafe outcomes: Removing evidence the user wanted retained, sweeping unrelated dirty files, hiding format failures with broad ignores.
Dependencies: None.
Expected files:

- current untracked temp scripts/report
- `.prettierignore` only if intentionally ignoring generated temp reports
- possible `scripts/block-preview-parity-audit.mjs` if promoted.

Write boundaries:

- exact artifact files after ownership decision.

Tests required: `npm run format:check`.
Runtime verification: none.
Migration/backfill notes: None.
External docs needed: none.
Acceptance criteria:

- Format gate passes.
- Retained audit tooling is intentionally named/locationed.
- Unrelated dirty files are not swept into the slice.

Exit evidence: `git status --short` before/after, format log.
Parallelization: single-threaded due dirty worktree.
Blocked on: none, but implementation must re-check current git status first.

#### AgentTaskContract

Eligible: no - dirty worktree and artifact ownership need manual judgment.
Current adapter: stronger-model/manual
Model route: gpt-5.5 medium
Model routing reason: User-change preservation.
Read scope:

- `git status --short`
- temp files listed by format failure

Allowed writes:

- exact agreed artifact files only

Must not touch:

- any unrelated modified/untracked file.

Acceptance commands:

- `npm run format:check`

Parent verification:

- git diff/status review

Failure policy:

- Stop and ask if file ownership is ambiguous.

#### Evidence

- Initial `npm run format:check` failed on 11 files: the S19 plan, reusable parity script, two scratch `scripts/tmp-*.mjs` files, several source/test files, and `tmp-block-preview-parity-report.json`.
- Added `.prettierignore` entries for root `/tmp-*` browser/audit evidence and `/scripts/tmp-*.mjs` scratch scripts; no temp evidence files were deleted.
- Formatted the reusable `scripts/block-preview-parity-audit.mjs` script plus the source/test/plan files Prettier flagged.
- Final `npm run format:check` passed with `All matched files use Prettier code style!`.
- `git status --short --untracked-files=all` still shows local temp evidence as untracked, confirming S19 did not sweep or remove those files.

### S19A - Resolve PostCSS Audit Finding

Status: done
Tier: T2
Type: package/security
Actor/trigger: S20 `npm audit --audit-level=moderate` gate.
Action: Add a narrow package override for the vulnerable transitive PostCSS range instead of downgrading Next.
Invariant protected: Keep the patched Next 16.2.6 package graph while clearing the remaining moderate dependency advisory.
Intentional behaviour changes: Dependency graph only; no application runtime code changed.
Previous intended behaviours preserved: Next remains 16.2.6; existing `qs` override remains in place.
Unsafe outcomes: Downgrading Next, changing app code to satisfy an audit tool, or masking the advisory without updating the package graph.
Dependencies: S2, S15.
Expected files:

- `package.json`
- `package-lock.json`

Write boundaries:

- package metadata only.

Tests required: `npm audit --audit-level=moderate`, package graph inspection, S20 verification rerun.
Runtime verification: covered by S20.
Migration/backfill notes: None.
External docs needed: npm package metadata only.
Acceptance criteria:

- `npm audit --audit-level=moderate` reports zero vulnerabilities.
- `npm ls postcss next` shows Next using the patched PostCSS version.

#### Evidence

- Added `overrides.postcss = "8.5.15"` next to the existing `qs` override.
- `npm install` updated the lockfile, removed the nested vulnerable Next PostCSS copy, and reported zero vulnerabilities.
- `npm ls postcss next` shows `next@16.2.6` using deduped `postcss@8.5.15`.
- `npm audit --audit-level=moderate` passed with `found 0 vulnerabilities`.

### S20A - Return Accessible Proxy 404 HTML

Status: done
Tier: T2
Type: runtime/a11y
Actor/trigger: S20 Playwright+axe check on invalid preview route.
Action: Replace bare proxy `Response("Not found", { status: 404 })` bodies with a minimal accessible noindex HTML response.
Invariant protected: Invalid resource, preview, and news paths still return true HTTP 404 and remain non-indexable.
Intentional behaviour changes: Proxy-level 404 bodies now include `lang`, title, main landmark, H1, and noindex headers/meta.
Previous intended behaviours preserved: Valid preview tokens, published resources, published news, redirects, and admin auth proxy behavior are unchanged.
Unsafe outcomes: Regressing invalid paths back to HTTP 200, weakening preview token checks, or introducing broad route rewrites.
Dependencies: S3, S20 runtime evidence.
Expected files:

- `src/proxy.ts`

Write boundaries:

- proxy 404 response helper only.

Tests required: lint, typecheck, test, env-matched build, route smoke, axe rerun.
Runtime verification: invalid preview/resource/news 404 route smoke and axe check.
Migration/backfill notes: None.
External docs needed: local Next proxy docs.
Acceptance criteria:

- Invalid resource, preview, and news paths return HTTP 404 with accessible HTML.
- Axe reports zero violations for the invalid preview 404 route.

#### Evidence

- Read local Next 16 proxy docs confirming proxy can return a `Response` directly.
- Added a shared proxy `notFoundResponse()` with HTML `lang`, title, noindex meta, main landmark, H1, `Content-Type: text/html; charset=utf-8`, and `X-Robots-Tag: noindex`.
- `npm run lint`, `npm run typecheck`, and `npm run test` passed after the proxy change.
- Env-matched `npm run build` passed.
- Production route smoke confirmed missing resource, invalid preview, and invalid news return HTTP 404 with `Not found | Vendingpreneurs` titles.
- Fresh axe rerun reported zero violations for invalid preview 404 and the audited admin/public routes.

### S20 - Full Integrated Remediation Verification

Status: done
Tier: T2
Type: verification
Actor/trigger: Codex after all implementation slices are done or intentionally skipped.
Action: Run the full proof suite and record evidence in this plan.
Invariant protected: No slice can be marked complete from narrow checks that do not cover its blast radius.
Intentional behaviour changes: none.
Previous intended behaviours preserved: all listed in Working Brief.
Unsafe outcomes: Calling the remediation complete while any finding remains unverified.
Dependencies: S1-S20A.
Expected files: no implementation files.
Write boundaries: this plan only for evidence updates.
Tests required:

- `npm run lint`
- `npm run format:check`
- `npm run typecheck`
- `npm run test`
- `npm run test -- --coverage`
- `npm run build`
- `supabase db lint --local`
- `npm audit --audit-level=moderate`
- Stryker configured subset
  Runtime verification:
- production build route smoke for admin redirects, public resources, preview invalid/valid, news invalid/valid, sitemap, robots
- dev bypass admin flow for `/admin/pages`, `/admin/pages/new`, save-and-preview disposable draft, block-preview audit
- Playwright+axe on public and admin audited routes
- Lighthouse on representative public resource page
- redacted anon Supabase probes
  Migration/backfill notes: migrations checked locally before any deploy.
  External docs needed: local Next docs if route behavior changed.
  Acceptance criteria:
- Every non-skipped finding in Audit Triage has exit evidence.
- Cleared findings remain cleared: block-preview parity 30/30, save-and-preview opens valid token, non-published rows blocked.
  Exit evidence: command logs, JSON reports, screenshots, redacted DB probe summaries.
  Parallelization: single-threaded final gate.
  Blocked on: all prior required slices.

#### AgentTaskContract

Eligible: no - parent verification only.
Current adapter: stronger-model/manual
Model route: gpt-5.5 high
Model routing reason: Cross-slice release proof.
Read scope:

- whole plan
- changed files
- test/runtime artifacts
  Allowed writes:
- `plans/seo-builder-teardown-remediation/slice-plan.md` evidence updates only
  Must not touch:
- implementation files unless opening a new slice.
  Acceptance commands:
- listed Tests required and Runtime verification
  Parent verification:
- all evidence reviewed by main Codex session
  Failure policy:
- If any gate fails, open a new slice or move the relevant slice back to pending/blocked; do not mark COMPLETE.

#### Evidence

- Automated gates passed:
  - `npm run lint`
  - `npm run format:check`
  - `npm run typecheck`
  - `npm run test` passed 32 files / 175 tests.
  - `npm run test -- --coverage` passed 32 files / 175 tests; coverage summary: statements 63.53%, branches 50.5%, functions 71.45%, lines 66.5%.
  - Env-matched `npm run build` passed on Next 16.2.6.
  - `supabase db lint --local` reported no schema errors.
  - `npm audit --audit-level=moderate` reported zero vulnerabilities after S19A.
- Stryker configured subsets completed in S15-S18: dry-run config checks passed; S16-S18 mutation reruns improved domain/service/AI target scores and admin actions no longer report "No tests were executed".
- Production route smoke on `localhost:3025` passed for admin redirect, `/resources/ztest1`, missing resource 404, invalid preview 404, valid preview token, invalid/valid news, `/sitemap.xml`, `/robots.txt`, `/about-us`, and `/apply`.
- Dev-bypass admin flow on `localhost:3026` passed for `/admin/pages`, `/admin/pages/new`, disposable Save & preview, and `/admin/pages/block-preview-audit`; disposable preview drafts/tokens were cleaned up.
- Block-preview parity audit passed 30/30 on desktop and mobile with report `tmp-block-preview-parity-report.json`.
- Fresh axe report `/tmp/vending-s20-axe.json` reported zero violations for public resource, invalid preview 404, admin pages, block-preview audit, new-page choice, and scratch editor.
- Lighthouse `/tmp/vending-s20-lighthouse.json` for `/resources/ztest1`: performance 0.94, LCP 3150ms, CLS 0, TBT 4ms.
- Redacted anon Supabase probe `/tmp/vending-s20-anon-surface.json` confirmed anon `seo_pages` reads are denied, `published_seo_pages` exposes only safe published fields, and draft `draft-secret-page` is hidden.

## Verification Gates

- Automated checks:
  - `npm run lint`
  - `npm run format:check`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test -- --coverage`
  - `npm run build`
  - configured Stryker subset
- Runtime checks:
  - production build route smoke for `/resources/ztest1`, invalid resource, invalid preview, valid disposable preview, invalid news, sitemap, robots
  - dev bypass admin smoke for `/admin/pages`, `/admin/pages/new`, save-and-preview, `/admin/pages/block-preview-audit`
  - Playwright screenshots for public desktop/mobile and admin desktop/mobile states touched by the slice
  - Lighthouse for representative resource page
- Migration checks:
  - `supabase db lint --local`
  - local migration application/reset if the repo flow supports it
  - generated type diff reviewed when migrations change types
- Security/auth checks:
  - redacted anon Supabase probes for allowed/disallowed public data
  - admin route redirect checks without bypass
  - dev bypass checks only under `NODE_ENV=development`
  - `npm audit --audit-level=moderate`
- Observability/audit checks:
  - record command logs and screenshots under a disposable artifact directory
  - update Progress only after evidence exists

## Subagent Plan

| Agent | Role                         | Slice(s) | Model/reasoning                                           | Read scope       | Write scope        | Must not touch                       | Evidence required                         |
| ----- | ---------------------------- | -------- | --------------------------------------------------------- | ---------------- | ------------------ | ------------------------------------ | ----------------------------------------- |
| A1    | Metadata cleanup writer      | S4       | deepseek-agent / flash tournament                         | S4 read scope    | S4 allowed writes  | package, migrations, layout redesign | route-title smoke                         |
| A2    | JSON-LD renderer writer      | S5       | deepseek-agent / flash tournament                         | S5 read scope    | S5 allowed writes  | admin UI, schemas                    | parsed JSON-LD                            |
| A3    | Card link label writer       | S7       | deepseek-agent / flash tournament after dirty-file review | S7 read scope    | S7 allowed writes  | migrations, unrelated blocks         | tests, parity, Lighthouse link extraction |
| A4    | Admin status-dot a11y writer | S9       | deepseek-agent / flash tournament                         | S9 read scope    | S9 allowed writes  | services, data fetching              | axe admin page                            |
| A5    | Contrast fixer               | S11      | deepseek-agent after target mapping                       | exact target map | exact mapped files | copy, layout, services               | axe contrast pass                         |
| A6    | Empty preview state writer   | S12      | deepseek-agent / flash tournament                         | S12 read scope   | S12 allowed writes | token service, DB                    | disposable preview screenshot             |
| A7    | Audit route semantics writer | S13      | deepseek-agent after dirty-file review                    | S13 read scope   | S13 allowed writes | public renderer                      | parity 30/30 and axe                      |
| A8    | Domain mutation test writer  | S16      | deepseek/pro test-only                                    | S16 read scope   | S16 test files     | runtime code                         | targeted Stryker logs                     |
| A9    | Service mutation test writer | S17      | deepseek/pro test-only                                    | S17 read scope   | S17 test files     | runtime code                         | targeted Stryker logs                     |

Main Codex keeps S1, S2, S3, S6, S8, S10, S14, S15, S18, S19, and S20 because they touch security, migrations, package graphs, cross-layer contracts, lead records, framework semantics, or dirty-worktree ownership.

## Blocked Decisions

- None block starting S1.
- S6 may need product approval if the desired structured-data controls extend beyond breadcrumb and visible FAQ behavior.
- S8 should use the safe default that apply forms require qualification fields; product can later create a separate low-friction contact-form slice if desired.
- S19 may require user confirmation if untracked temp artifacts appear user-owned when implementation begins.

## Update Rules

- Move only one slice to `in_progress` per worker unless the Subagent Plan explicitly allows parallel work.
- Mark `done` only after exit evidence is recorded in the Progress table.
- Mark `blocked` with the exact missing decision, dependency, or failing check.
- Add newly discovered work as a new slice or follow-up; do not silently expand an active slice.
- Keep skipped work visible with the reason.
- Do not mark this plan `COMPLETE` until every required slice is `done` or explicitly `skipped`, S20 passes, and the current audit triage has no unresolved actionable finding.
