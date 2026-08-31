# Slice S1: Legacy URL redirect completion (2026-08-31)

From `reports/seo-audit-2026-08-31/ACTION-PLAN.md` S1. Backlink audit found 34 formerly-live URLs (Wayback CDX, WordPress-era) now dead — 30 `/news/*` hard 404s + 4 soft-404 shell hits — bleeding inbound link equity.

## Change

`next.config.ts` only: extend the existing redirect map with permanent (308) redirects.

- 30 legacy `/news/*` slugs → topic-matched live article where clear (locations cluster → `best-vending-locations`, program cluster → `top-5-questions-vending-entrepreneurship-program`, products cluster → `top-10-profitable-products-to-stock-in-your-vending-machine`), `/news` index otherwise.
- `/booking-referral`, `/booking-webinar` → `/contact?source_path=…` (existing legacyLeadRedirects pattern).
- `/vending-route-builder` → `/vending-route-blueprint?source_path=…` (mirrors `/vending-blueprint`).
- `/wp-sitemap.xml` → `/sitemap.xml`.

## Invariants

- No source collides with a live route or published post (all 34 verified 404/shell on prod 2026-08-31).
- Config redirects shadow filesystem routes: never publish a new post at a redirected slug — noted in code comment.
- Targets verified 200 on prod: the 3 pillar articles, `/news`, `/contact`, `/vending-route-blueprint`, `/sitemap.xml` (content intermittency tracked separately, finding T2).

## Verify

Build green + typecheck + redirect-shape self-check (unique sources, all destinations live).
