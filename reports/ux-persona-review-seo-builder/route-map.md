# Route Map — SEO Page Builder (scoped review)

Discovered: 2026-06-10
Scope: SEO Page Builder only (per user instruction "ONLY of the seo page builder")
Total pages in scope: 8

## Pages

| Route                                    | File                                                     | Auth Required?          | Dynamic? | Notes                                                                               |
| ---------------------------------------- | -------------------------------------------------------- | ----------------------- | -------- | ----------------------------------------------------------------------------------- |
| /admin/pages                             | src/app/admin/pages/page.tsx                             | Yes (dev bypass active) | No       | Pages list: filters, search, sort, row ⋮ menus, pagination                          |
| /admin/pages/new                         | src/app/admin/pages/new/page.tsx                         | Yes                     | No       | Choice gate (page type → starting point) then editor                                |
| /admin/pages/[id]                        | src/app/admin/pages/[id]/page.tsx                        | Yes                     | Yes      | Core editor: top rail, blocks panel, canvas, SEO/publish panel, revisions, comments |
| /admin/pages/[id]/revisions/[revisionId] | src/app/admin/pages/[id]/revisions/[revisionId]/page.tsx | Yes                     | Yes      | Read-only revision preview                                                          |
| /admin/pages/redirects                   | src/app/admin/pages/redirects/page.tsx                   | Yes                     | No       | Create redirect form + read-only list                                               |
| /admin/pages/block-preview-audit         | src/app/admin/pages/block-preview-audit/page.tsx         | Yes (dev-only)          | No       | QA parity tool: picker preview vs actual render                                     |
| /resources/[slug]                        | src/app/resources/[slug]/page.tsx                        | No                      | Yes      | Published output of builder pages                                                   |
| /resources/preview/[token]               | (preview route)                                          | Token                   | Yes      | Draft preview via preview token                                                     |

## Navigation targets (from code)

| Target URL                               | Found In                            | How  |
| ---------------------------------------- | ----------------------------------- | ---- |
| /admin/pages                             | AdminShell nav "SEO pages"          | Link |
| /admin/pages/new                         | Pages list "Create page"            | Link |
| /admin/pages/redirects                   | Pages list "Redirects"              | Link |
| /admin/pages/[id]                        | Row menu "Edit page"                | Link |
| /resources/[slug]                        | Row menu "View live page" (new tab) | Link |
| /admin/pages/[id]/revisions/[revisionId] | Revision panel "Preview"            | Link |
| /admin/pages                             | Editor top rail "Pages" back link   | Link |

## Out of scope (not explored)

/admin/news, /admin/media, /admin/libraries, /admin/settings, public marketing pages
(other than the published output of pages created during this run).
