# Route Map

Discovered: 2026-06-10
Base URL: http://localhost:3000
Total page files: 34
Total API routes: 2
Scope: full app — public marketing site + admin studio

## Public Pages

| Route                      | File                                       | Auth Required? | Dynamic? | Notes                                                                                                                                                                              |
| -------------------------- | ------------------------------------------ | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| /                          | src/app/page.tsx                           | No             | No       | Homepage                                                                                                                                                                           |
| /about                     | src/app/about/page.tsx                     | No             | No       |                                                                                                                                                                                    |
| /apply                     | src/app/apply/page.tsx                     | No             | No       | Lead application form (core conversion)                                                                                                                                            |
| /case-studies              | src/app/case-studies/page.tsx              | No             | No       |                                                                                                                                                                                    |
| /contact                   | src/app/contact/page.tsx                   | No             | No       | Contact form                                                                                                                                                                       |
| /news                      | src/app/news/page.tsx                      | No             | No       | News listing                                                                                                                                                                       |
| /news/[slug]               | src/app/news/[slug]/page.tsx               | No             | Yes      | 3 published: how-to-choose-the-perfect-location-for-vending-machine, top-5-questions-vending-entrepreneurship-program, top-10-profitable-products-to-stock-in-your-vending-machine |
| /blog/[slug]               | src/app/blog/[slug]/page.tsx               | No             | Yes      | Legacy path — 404 on unknown slug                                                                                                                                                  |
| /pre-call-resources        | src/app/pre-call-resources/page.tsx        | No             | No       |                                                                                                                                                                                    |
| /privacy                   | src/app/privacy/page.tsx                   | No             | No       |                                                                                                                                                                                    |
| /terms                     | src/app/terms/page.tsx                     | No             | No       |                                                                                                                                                                                    |
| /thank-you-for-applying    | src/app/thank-you-for-applying/page.tsx    | No             | No       | Post-apply confirmation                                                                                                                                                            |
| /resources/[slug]          | src/app/resources/[slug]/page.tsx          | No             | Yes      | CMS (seo_pages) — NO published rows; all draft/archived → public 404                                                                                                               |
| /resources/preview/[token] | src/app/resources/preview/[token]/page.tsx | Token          | Yes      | Preview link route                                                                                                                                                                 |
| /solutions/[slug]          | src/app/solutions/[slug]/page.tsx          | No             | Yes      | CMS — no published rows                                                                                                                                                            |
| /videos/[slug]             | src/app/videos/[slug]/page.tsx             | No             | Yes      | CMS — no published rows                                                                                                                                                            |
| /landing/[slug]            | src/app/landing/[slug]/page.tsx            | No             | Yes      | CMS — no published rows                                                                                                                                                            |
| /authors                   | src/app/authors/                           | No             | ?        | Directory exists; verify at runtime                                                                                                                                                |
| /[legacyLeadPath]          | src/app/[legacyLeadPath]/page.tsx          | No             | Yes      | Legacy Webflow lead paths                                                                                                                                                          |

## Admin Pages (Supabase auth; local dev uses ADMIN_DEV_AUTH_BYPASS=1 → dev-admin@dev.invalid, super_admin)

| Route                                    | File                                                     | Notes                                        |
| ---------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| /admin                                   | redirect → /admin/pages                                  | 307                                          |
| /admin/login                             | src/app/admin/login/page.tsx                             |                                              |
| /admin/forgot-password                   | src/app/admin/forgot-password/page.tsx                   |                                              |
| /admin/reset-password                    | src/app/admin/reset-password/page.tsx                    | Requires recovery session                    |
| /admin/pages                             | src/app/admin/pages/page.tsx                             | SEO Page Builder list                        |
| /admin/pages/new                         | src/app/admin/pages/new/page.tsx                         |                                              |
| /admin/pages/[id]                        | src/app/admin/pages/[id]/page.tsx                        | Editor                                       |
| /admin/pages/[id]/revisions/[revisionId] | src/app/admin/pages/[id]/revisions/[revisionId]/page.tsx |                                              |
| /admin/pages/redirects                   | src/app/admin/pages/redirects/page.tsx                   |                                              |
| /admin/pages/block-preview-audit         | src/app/admin/pages/block-preview-audit/page.tsx         | Internal audit tool                          |
| /admin/news                              | src/app/admin/news/page.tsx                              |                                              |
| /admin/news/new                          | src/app/admin/news/new/page.tsx                          |                                              |
| /admin/news/[id]                         | src/app/admin/news/[id]/page.tsx                         |                                              |
| /admin/media                             | src/app/admin/media/page.tsx                             |                                              |
| /admin/libraries                         | src/app/admin/libraries/page.tsx                         |                                              |
| /admin/settings                          | src/app/admin/settings/page.tsx                          |                                              |
| /admin/settings/users                    | src/app/admin/settings/users/page.tsx                    | User management — NO mutations on real users |

## Navigation Targets (from code grep + live homepage crawl)

/, /about, /apply, /case-studies, /contact, /news, /pre-call-resources, /privacy, /terms,
/admin/pages, /admin/pages/new, /admin/media, /admin/news, /admin/news/new, /admin/libraries

## API Routes

| Endpoint                            | File                                                |
| ----------------------------------- | --------------------------------------------------- |
| /api/admin/scheduled-publishing/run | src/app/api/admin/scheduled-publishing/run/route.ts |
| /api/page-builder/ai/chat           | src/app/api/page-builder/ai/chat/route.ts           |
