# SEO command center (/admin/seo)

Built 2026-09-29 from `.claude/specs/2026-09-28-seo-command-center.md` and the
strategy run in `~/Desktop/vp-seo-output/` (Kody's framework, 2026-09-23).

## Tabs and where each number comes from

| Tab            | Reads                                                                     | Written by                                                                      |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Overview       | `seo_gsc_daily`, `seo_gsc_page_daily`, `seo_gsc_query_daily`, `seo_pages` | nightly `/api/admin/search-console-sync/run` (connector `seo-search-console`)   |
| Pages          | `seo_gsc_page_daily`, `seo_pages`                                         | same                                                                            |
| Keywords & AEO | `seo_keywords`, `seo_rank_snapshots`, `seo_gsc_query_daily`               | weekly `/api/admin/seo-ranks/run` (Mon 13:00 UTC, connector `dataforseo-ranks`) |
| Content Plan   | `seo_content_pieces`, `seo_pages`, `src/lib/seo/interlinking-map.ts`      | seed + edits on the page; "live" = `/resources/{slug}` published                |
| Tasks          | `seo_tasks`                                                               | seed, the page, weekly `/api/admin/seo-triggers/run` (Mon 14:00 UTC)            |
| Social         | `social_account_daily`, `seo_gsc_daily`                                   | nightly `/api/admin/metricool-sync/run` (connector `metricool-accounts`)        |
| Roadmap        | `seo_tasks` (type `roadmap`), `seo_monthly_reviews`                       | seed + the page                                                                 |

## Facts that shape the numbers

- The Search Console property (`sc-domain:vendingpreneurs.com`, a domain
  property) holds data from **2025-11-26** only, not 16 months. Year-over-year
  comparisons appear from 2026-11-26.
- Impressions peaked in March 2026 (45,975) and fell to 9,320 in August and
  about 6,400 in September. Most of September's impressions are branded.
- Branded = `src/lib/seo/brand.ts` (Vendingpreneurs and misspellings, Mike
  Hoffman, Modern Amenities, VendHub). Non-branded = total minus branded, so
  it includes queries Google anonymizes.
- DataForSEO cannot report past rankings. Rank history starts at the first
  pull; the Search Console position per query covers the time before.
- Metricool's account history is short (Instagram from about August 2026,
  YouTube about June 2026). Its OpenAPI metric list is wrong for several
  networks; `src/lib/metricool/timelines.ts` has the names the live API takes.

## Kody's 7 triggers

`src/lib/seo/triggers.ts`, thresholds exactly as `05-task5-tracking-system.md`
section 2. Scope is every www page except the home page (not only
/resources, since none are live yet). Trigger 7 uses the date Google shows
on a top-3 result; the "under 1,000 words" and "product page" checks need a
page fetch and are not automated.
