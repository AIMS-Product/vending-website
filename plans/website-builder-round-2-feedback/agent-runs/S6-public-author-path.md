# Agent Run: S6 public author path

Status: DONE
Worker: Codex
Started: 2026-06-05
Completed: 2026-06-05

## Scope

- Node: S6 - Decide and implement public author path.
- Allowed write scope: Author path display/routing, public author route, route helper tests, proxy redirect, sitemap/canonical behavior, and graph evidence.
- Files changed:
  - `src/lib/page-builder/author-paths.ts`
  - `src/lib/page-builder/author-paths.test.ts`
  - `src/lib/services/author-profiles-public.ts`
  - `src/lib/services/author-profiles-public.test.ts`
  - `src/app/authors/[slug]/page.tsx`
  - `src/app/authors/author-profile-page.test.ts`
  - `src/app/admin/pages/authors/page.tsx`
  - `src/app/admin/pages/authors/page.test.ts`
  - `src/proxy.ts`
  - `src/proxy.test.ts`
  - `src/app/sitemap.ts`

## RGR Evidence

- RED: Added failing tests for canonical `/authors/{slug}` formatting, legacy `/blog/author/{slug}` redirect mapping, safe public author profile loading, admin display path, proxy redirect, and public author metadata/rendering.
- GREEN: Implemented central author path helpers, a server-only public author profile loader that selects only safe public fields, `/authors/[slug]` public profile page with canonical metadata, 308 proxy redirect from legacy blog-author paths, sitemap inclusion for public author profiles, and admin author cards that show `/authors/{slug}`.
- REFACTOR: Kept the public read path narrow instead of adding table-wide anonymous RLS, and left authored-page listings out of scope because the current published-page view does not expose `author_id`.

## Gates

- Repo Gate:
  - `npm run test -- src/lib/page-builder/blocks.test.ts src/components/sections/ResourcePageRenderer.test.ts src/lib/page-builder/seo-readiness.test.ts src/lib/page-builder/internal-link-suggestions.test.ts src/lib/media/editor-upload.test.ts src/lib/page-builder/author-paths.test.ts src/lib/services/author-profiles-public.test.ts src/app/authors/author-profile-page.test.ts src/app/admin/pages/authors/page.test.ts src/proxy.test.ts` passed: 10 files, 62 tests.
  - `npx eslint ...` over all touched source/test files passed.
  - `npm run typecheck` passed.
  - `git diff --check` passed.
  - `npx react-doctor@latest --verbose --diff` passed with score 99/100; remaining warning is accepted as a false positive because `adminListAuthorProfiles()` must remain after `requireAdmin()`, as covered by `src/app/admin/pages/authors/page.test.ts`.
- Browser Gate:
  - Public route verified on `http://localhost:3000/authors/mike-hoffmann`: rendered `Mike Hoffmann`, `/authors/mike-hoffmann`, and no legacy `/blog/author` text.
  - Legacy route verified in browser: `http://localhost:3000/blog/author/Mike%20Hoffmann` landed on `http://localhost:3000/authors/mike-hoffmann`.
  - Admin route verified on `http://localhost:3000/admin/pages/authors`: rendered `Author Profiles`, `/authors/mike-hoffmann`, and no legacy `/blog/author` text.
  - Narrow viewport checks at 390px passed for public and admin author pages with `documentElement.scrollWidth === clientWidth`.
  - Screenshots saved to `/tmp/round2-s6-public-author-page.jpg`, `/tmp/round2-s6-admin-authors-page.jpg`, `/tmp/round2-s6-admin-authors-mobile.jpg`, and `/tmp/round2-s6-public-author-mobile.jpg`.
- Boundary/Migration Gate:
  - Read-only Supabase lookup found existing author `mike-hoffmann`; no database writes or migrations were performed.
  - HTTP check passed: `curl -I -s http://localhost:3000/blog/author/Mike%20Hoffmann` returned `HTTP/1.1 308 Permanent Redirect` with `location: /authors/mike-hoffmann`.

## Behavior Preservation

- Previous intended behaviors checked: Admin author list still requires admin auth before reading profiles, existing `/blog/[slug]` builder route remains covered by proxy tests, public news/resource route checks remained in the broader targeted suite, and sitemap still includes news/resource entries while adding author profile URLs.
- Evidence: Existing admin auth-order test, proxy redirect test, public author route test, focused rich-text/media/page-render tests, typecheck, eslint, browser route proof, and HTTP redirect proof.
- Confidence: High.

## Residual Risk

- Public author pages do not list authored pages yet; that needs a later data-model/view change because `published_seo_pages` does not currently expose `author_id`.
- The public author loader uses a server-only service-role read to avoid widening anonymous RLS in this slice.

## Defaults Applied

- Treat `/authors/{slug}` as canonical and redirect legacy `/blog/author/{slug}` with HTTP 308.
- Include public author profile URLs in sitemap because author profiles are explicitly public identities.
- Keep public author profiles separate from admin users and expose only display/profile fields.

## Handoff Notes

- Continue using `authorPathForSlug()` anywhere future blog/page-builder author links are displayed.
- If authored-page listings ship later, update the public published-page view or add a dedicated safe view instead of leaking admin-only author/profile data.

## Recommendation

DONE
