# Route Map — Page Builder

Discovered: 2026-06-04
Scope: SEO Page Builder (`/admin/pages/*`) — the page builder part of the admin studio.
Auth: Supabase email/password, gated behind `/admin/login`. Explored using
`ADMIN_DEV_AUTH_BYPASS=1` (resolves to `dev-admin@dev.invalid`, role `super_admin`).

## Pages (page builder surface)

| Route                                    | File                                                 | Auth Required? | Dynamic? | Role                           |
| ---------------------------------------- | ---------------------------------------------------- | -------------- | -------- | ------------------------------ |
| /admin/pages                             | app/admin/pages/page.tsx                             | Yes            | No       | Pages list / dashboard         |
| /admin/pages/new                         | app/admin/pages/new/page.tsx                         | Yes            | No       | Create new page                |
| /admin/pages/[id]                        | app/admin/pages/[id]/page.tsx                        | Yes            | Yes      | **Page builder editor (core)** |
| /admin/pages/authors                     | app/admin/pages/authors/page.tsx                     | Yes            | No       | Author management              |
| /admin/pages/redirects                   | app/admin/pages/redirects/page.tsx                   | Yes            | No       | Redirect rules                 |
| /admin/pages/block-preview-audit         | app/admin/pages/block-preview-audit/page.tsx         | Yes            | No       | Block preview audit / dev tool |
| /admin/pages/[id]/revisions/[revisionId] | app/admin/pages/[id]/revisions/[revisionId]/page.tsx | Yes            | Yes      | Revision viewer                |

Sample existing page id used for `[id]`: `f7eb8024-bbba-42d9-8b13-932e337f7e32`

## API Routes (page builder)

| Endpoint                            | Methods | File                                            |
| ----------------------------------- | ------- | ----------------------------------------------- |
| /api/page-builder/ai/chat           | POST    | app/api/page-builder/ai/chat/route.ts           |
| /api/admin/scheduled-publishing/run | POST    | app/api/admin/scheduled-publishing/run/route.ts |

## Server Actions

- app/admin/pages/actions.ts — page CRUD, publish, status
- app/admin/pages/authors/actions.ts — author CRUD
- app/admin/pages/redirects/actions.ts — redirect CRUD
- lib/services/seo-pages.ts — page data layer
- lib/services/page-builder-libraries.ts — block/section libraries
