# Backlink Profile Audit — vendingpreneurs.com

Date: 2026-08-31 · Sources: Common Crawl web graph (free, Tier 0), WHOIS/domain-history script, Wayback Machine CDX API, live-site verification crawl (curl). No paid backlink API (Moz/Ahrefs/DataForSEO) available — see Tier 0 note below.

## Tier & Confidence

This is a **Tier 0** audit: Common Crawl + live verification only, no Moz/Bing/DataForSEO keys configured. Per the confidence-weighted scoring model, fewer than 4 of the 7 backlink scoring factors have a data source at Tier 0 (no referring-domain count, no domain-quality distribution, no anchor-text data, no toxic-link ratio, no link-velocity, no follow/nofollow split, no geographic split). **A numeric Backlink Health Score is not reported — INSUFFICIENT DATA at Tier 0.** What follows is domain-graph positioning (Common Crawl, confidence 0.50), domain history (WHOIS, confidence 0.95), and a verified-crawl finding on legacy-URL link-equity loss (confidence 0.95, directly observed via curl).

To get a real score: run Moz (`claude-seo run moz_api.py metrics https://vendingpreneurs.com --json`, confidence 0.85) or the DataForSEO extension if it's ever installed.

## 1. Common Crawl Domain Graph — vendingpreneurs.com

Source: Common Crawl web graph, release `cc-main-2026-jan-feb-mar` (confidence: 0.50, quarterly snapshot, https://commoncrawl.org/web-graphs).

| Metric                            | Value                                                |
| --------------------------------- | ---------------------------------------------------- |
| In crawl                          | Yes                                                  |
| In PageRank rankings              | Yes                                                  |
| PageRank score                    | 5.189e-09                                            |
| PageRank rank (global)            | 15,545,983                                           |
| Harmonic centrality               | 13,361,562                                           |
| Harmonic centrality rank (global) | 9,687,014                                            |
| Hosts observed                    | 2 (`vendingpreneurs.com`, `www.vendingpreneurs.com`) |

Raw output:

```json
{
  "domain": "vendingpreneurs.com",
  "in_crawl": true,
  "in_rankings": true,
  "pagerank": 5.189395930460302e-9,
  "pagerank_rank": 15545983,
  "harmonic_centrality": 13361562.0,
  "harmonic_centrality_rank": 9687014,
  "n_hosts": 2
}
```

Interpretation: the domain clears CC's ranking threshold at all, which most sub-niche competitor sites tested did not (see below) — meaning it has enough inbound link volume in Common Crawl's graph to be scored, not that its authority is high in absolute terms (rank ~15.5M of all domains CC indexes is modest). No referring-domain count is available from CC — it doesn't expose that at the domain level, only rank/centrality.

## 2. Competitor Comparison (Common Crawl)

Competitors identified via live web search for "vending machine business course" / "vending machine business coaching mentor program" (see Sources): Hill Vending, iKrave Vending, The Vending Mentors — all direct niche competitors selling vending-business courses/mentorship, same as Vendingpreneurs.

| Domain                | In CC crawl | In rankings | PageRank rank | Note                                                                                  |
| --------------------- | ----------- | ----------- | ------------- | ------------------------------------------------------------------------------------- |
| vendingpreneurs.com   | Yes         | **Yes**     | 15,545,983    | Above ranking threshold                                                               |
| hillvending.com       | Yes         | No          | —             | "Found in CC crawl but below ranking threshold (too small/new for PageRank rankings)" |
| ikravevending.com     | Yes         | No          | —             | Same                                                                                  |
| thevendingmentors.com | Yes         | No          | —             | Same                                                                                  |

**Finding:** all three direct niche competitors tested are present in Common Crawl's raw crawl but fall below its PageRank ranking threshold entirely — vendingpreneurs.com is the only one of the four with enough link signal to be scored at all. This is a real (if coarse) authority edge in this specific niche; it does not mean vendingpreneurs.com has strong authority in absolute terms (rank 15.5M globally is low), only that it currently out-ranks these three named competitors on Common Crawl's link graph. Naturals2Go and Udemy were excluded as competitors — they're a machine vendor and a course marketplace respectively, not niche-comparable single-brand mentorship sites.

## 3. Domain History (WHOIS)

Source: `domain_history.py` (WHOIS-binary, confidence: 0.95).

| Field              | Value                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Registrar          | GoDaddy.com, LLC                                                                                                                    |
| Created            | 2024-01-09                                                                                                                          |
| Updated            | 2026-01-10                                                                                                                          |
| Expires            | 2028-01-09                                                                                                                          |
| Age                | 2.64 years                                                                                                                          |
| Topical shift risk | Unknown (no baseline topic on file — same registrant/topic since creation per available data, no expired-domain repurposing signal) |

Domain is a normal, continuously-owned 2.6-year-old domain — no expired-domain heritage risk. WHOIS creation date (2024-01-09) matches the earliest Wayback capture (2024-05-16) closely enough to confirm this was built as a new site, not acquired.

## 4. CRITICAL: Legacy-URL Link Equity Bleed (Webflow/WordPress → Next.js cutover, 2026-07-27)

Wayback CDX API pull (`web.archive.org/cdx/search/cdx?url=vendingpreneurs.com*&filter=statuscode:200&collapse=urlkey&limit=500`) returned 212 historically-live URLs. Note: the CDX history shows a WordPress + Elementor stack (`/wp-content/plugins/elementor...`), not Webflow — the legacy CMS appears to have been WordPress/Elementor, whichever platform preceded the current Next.js/Vercel site. This doesn't change the finding: these are real formerly-indexed, formerly-linkable URLs now hitting the new site.

Filtered to 63 non-asset HTML page URLs (28 core/booking pages + 35 blog posts) and live-tested each with curl (status, byte size, `<title>`, `robots` meta) against a known-good baseline (homepage = 229KB, real title) and a known-bad baseline (a fabricated nonexistent path = 37,276 bytes, generic title "Vendingpreneurs", `noindex`). Two distinct broken patterns were found — worse than the single "soft-404 shell" pattern initially flagged, because roughly half the loss is a **hard 404** with zero redirect, not just a soft one:

### Pattern A — True soft-404: HTTP 200, noindex, empty generic shell (~37.2–37.3KB)

Confirmed bleeding — a former backlink or bookmark to any of these lands on a contentless page:

| URL                                        | HTTP | Size   | Title                     |
| ------------------------------------------ | ---- | ------ | ------------------------- |
| `/booking-referral`                        | 200  | 37,242 | Vendingpreneurs (generic) |
| `/booking-webinar`                         | 200  | 37,241 | Vendingpreneurs (generic) |
| `/vending-route-builder`                   | 200  | 37,252 | Vendingpreneurs (generic) |
| `/wp-sitemap.xml` (legacy WP sitemap path) | 200  | 37,282 | Vendingpreneurs (generic) |

### Pattern B — True hard 404: no redirect, "Not found" page (374 bytes, noindex)

This is the larger bleed. Of 35 legacy `/news/*` blog post URLs found in Wayback, **30 (86%) now 404 outright** with no `Location` header (verified via `curl -D -`, e.g. `/news/expected-costs-earnings-roi-vending-machines-2025` → bare `HTTP/2 404`, no redirect). These pages had unique blog content and were candidates for earned links/social shares — any inbound link to them now passes zero equity and shows visitors a dead page:

```
/news/7-myths-about-vending-machine-business
/news/best-vending-machines-schools-offices-gyms
/news/eco-friendly-zero-waste-vending-machines
/news/expected-costs-earnings-roi-vending-machines-2025
/news/finance-first-vending-machines-without-loans
/news/from-zero-to-first-vending-machine-guide
/news/how-much-money-do-vending-machines-make-2026
/news/how-to-build-a-self-managed-route-so-you-can-work-less
/news/pros-and-cons-of-hiring-vending-business-mentorship-vs-learning-on-your-own
/news/seasonal-vending-machine-ideas
/news/smart-vending-cashless-payments-iot
/news/top-5-questions-to-ask-before-joining-a-vending-entrepreneurship-program
/news/top-8-vendpreneur-mistakes-how-to-fix-them
/news/vending-business-for-complete-beginners
/news/vending-business-taxes-us-beginners-guide
/news/vending-machine-business-course-mentorship-guide
/news/vending-machine-business-legal-tax-licensing-2025
/news/vending-machine-business-passive-income
/news/vending-machine-innovation-5
/news/vending-machine-insights-5
/news/vending-machine-installation-checklist
/news/vending-machine-locator-high-earning-spots
/news/vending-machine-locator-services-faqs
/news/vending-machine-placement-2
/news/vending-machine-placement-2-c6bb6
/news/vending-machine-success-3
/news/vending-machine-success-3-8b515
/news/vending-machine-tips-4
/news/vending-machine-trends-4
/news/what-to-check-before-installing-a-vending-machine
```

### Encouraging counter-evidence: a redirect map exists but is incomplete

3 of the 35 legacy blog slugs DO correctly 308-redirect to a live canonical post (confirmed via response headers, e.g. `/news/best-vending-locations-1-f15cf` → `308` → `location: /news/best-vending-locations`): `best-vending-locations-1`, `best-vending-locations-1-f15cf`, `how-to-choose-the-perfect-location-for-vending-machine`. Two more legacy slugs are themselves still the live canonical URL, unchanged (`top-10-profitable-products-to-stock-in-your-vending-machine`, `top-5-questions-vending-entrepreneurship-program`). This proves the redirect mechanism/migration map works and was applied to some posts — it just wasn't applied to the other 30.

**Not a bleed (verified, for completeness):** all 19 legacy `/booking-*` UTM/tracking landing pages except the 2 listed above resolve to live, distinct, real content (mostly the "Book Your Vending Route Advisory Call" or "Apply" pages) — several are intentionally `noindex` (normal for paid-traffic landers, not a defect). Core pages (`/about-us`, `/case-studies`, `/join`, `/location-eligibility`, `/news`, `/privacy-policy`, `/terms`, `/vending-blueprint`, `/vending-business-blueprint`, `/vending-training`) are all live with correct unique titles, no noindex, no bleed.

### Fix (impacts ~34 confirmed URLs: 4 shell hits + 30 hard 404s)

1. Pull the full Wayback CDX list (or the old WP sitemap/XML export if archived) and 301-redirect every legacy URL that ever returned 200 to its nearest live equivalent — extend the existing (working) redirect map rather than building a new mechanism.
2. For the 30 dead `/news/*` posts specifically: most have a near-topic match already live (e.g. redirect `vending-machine-business-passive-income` → the closest current post, or to `/news` index as fallback) rather than leaving a 404.
3. `/booking-referral`, `/booking-webinar`, `/vending-route-builder`, `/wp-sitemap.xml` → redirect to their nearest live equivalent (`/booking-*` pattern already proves the destination pages exist) or to `/` if no clean match.
4. Never let the catch-all return HTTP 200 for a genuinely unknown path going forward — a real 404 (already correct for `/news/*`) or a 301 (preferred, for known legacy paths) are both fine; a 200-with-noindex empty shell is not, since it wastes crawl budget and is indistinguishable from a real page to anything that doesn't parse the noindex tag.

## 5. Link-Building Strategy (7 plays for this niche)

| #   | Play                                                                                                                                                                   | Why it fits                                                                                                                                                                 | Effort       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | Vending industry associations (NAMA — National Automatic Merchandising Association)                                                                                    | Member directory listing = a relevant, high-trust .org-adjacent link; NAMA is the trade body every serious vending-course competitor should be listed with                  | Low          |
| 2   | Business-opportunity / franchise directories (e.g. BusinessBroker, Entrepreneur's "Business Opportunities" listings, Side Hustle Nation resource pages)                | Vendingpreneurs sells a business-launch program — this is exactly the directory category it belongs in, and these sites already rank for "vending machine business" queries | Low          |
| 3   | Podcast guest appearances (small-business, side-hustle, passive-income podcasts)                                                                                       | Every podcast gives show-notes backlink; site already has a `/booking-podcast` funnel page built for exactly this — use it as the CTA in guest pitches                      | Medium       |
| 4   | HARO / Featured / Qwoted style journalist requests on "passive income," "side hustle," "vending machine business"                                                      | Earns links from higher-DA news/finance sites; cheap, ongoing                                                                                                               | Medium       |
| 5   | YouTube ecosystem: guest interviews on business/side-hustle YouTube channels + optimizing the existing `/booking-youtube` funnel page's own outbound description links | Site already runs a YouTube-specific booking funnel — creators reciprocally link back in video descriptions when featured/interviewed                                       | Medium       |
| 6   | Case-study / success-story placements on vending-equipment supplier and distributor blogs (non-competing — they sell machines, not courses)                            | Natural partner link: suppliers want content proving their machines make money, Vendingpreneurs wants the backlink + lead referral                                          | Medium       |
| 7   | Reddit/forum niche presence (r/vending, r/sidehustle, Vending Machine Business FB groups) done as genuine participation, not link-drops                                | Long-tail nofollow links + real referral traffic that itself becomes future backlinks (people blog about programs they found via forums)                                    | Low, ongoing |

## Data Source Summary

| Finding                                                                               | Source                                                       | Confidence         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------ |
| PageRank/centrality, vendingpreneurs.com                                              | Common Crawl (cc-main-2026-jan-feb-mar)                      | 0.50               |
| Competitor CC comparison                                                              | Common Crawl (same release)                                  | 0.50               |
| Domain age/registrar                                                                  | WHOIS-binary via `domain_history.py`                         | 0.95               |
| Legacy-URL live/404/shell status                                                      | Direct curl verification against live site                   | 0.95               |
| Historical URL inventory                                                              | Wayback CDX API (`web.archive.org/cdx/search/cdx`)           | 0.90               |
| Competitor identification                                                             | Live web search, cross-checked against 2 independent queries | 0.80               |
| Referring-domain count, anchor text, toxic ratio, link velocity, follow/nofollow, geo | Not available — no Moz/Bing/DataForSEO configured            | N/A — not reported |
