# Full SEO Audit — vendingpreneurs.com — 2026-08-31

Toolkit: claude-seo v2.2.5 (6 parallel specialists: technical, content/SXO, schema, performance, GEO, backlinks).
Detail per category: `findings/*.md`. Prioritized backlog: `ACTION-PLAN.md`.

## Health scorecard (heuristic, not a PSI/Lighthouse number)

| Category             | Score        | One-line state                                                                                                                                                                                                      |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technical            | 55           | Site-wide soft-404 (200 on every bad URL); intermittent sitemap mis-route; no apex→www redirect. Robots, canonicals, redirects otherwise clean.                                                                     |
| Content / indexation | 45           | The `/solutions` + `/process` silo — the pages that target every money keyword — is noindexed (deliberate holdback) AND orphaned from the link graph. Blog has 3 posts. Existing content quality is genuinely good. |
| Schema               | 40           | Zero Organization/WebSite JSON-LD sitewide. Existing FAQPage/VideoObject valid. Breadcrumb builder exists, unused on hand-coded routes.                                                                             |
| Performance          | 65           | ~390KB third-party JS burst on every page; dead Vidalytics script sitewide; article body images bypass next/image (~1MB/article). Hero/LCP handling is textbook.                                                    |
| GEO / AI visibility  | 58           | AI crawlers fully allowed, full SSR (strong base). But no founder name anywhere authoritative, no entity schema, no llms.txt.                                                                                       |
| Backlinks            | n/a (Tier 0) | Only niche site above Common Crawl's ranking threshold (beats hillvending, ikravevending, thevendingmentors). 30 of 35 legacy blog URLs hard-404 with no redirect — active equity bleed.                            |

**Overall: ~53/100.** The ceiling is high: content quality, SSR, LCP handling, and canonical hygiene are already better than the niche competitors. The score is dragged down by three things — an indexation holdback (a business decision, not a bug), a completed-migration loose end (missing redirects), and missing entity/structured data.

## The one-paragraph diagnosis

The site cannot rank for its niche keywords today mostly because the pages built to rank for them are switched off. `/solutions/coaching`, `/solutions/financing`, all of `/process` — finished, shipped pages mapping 1:1 to "vending machine mentorship", "vending machine business financing", "how to start a vending machine business" sub-topics — are noindexed pending copy sign-off, excluded from the sitemap, and linked from nowhere (no nav item, no homepage link). Meanwhile 30 legacy blog URLs from the WordPress era 404 with no redirect, bleeding what inbound equity the 2.6-year-old domain has earned. Everything else (schema, performance, GEO) is additive; those two are the levers.

## Top findings, deduplicated across all six specialists

### Decision needed (not code)

1. **Copy sign-off is the #1 SEO bottleneck.** 7 of 8 `/solutions/*` + all 8 `/process` pages are deliberately held back (`noindex: true` in `src/lib/content/solutions.ts` / `process.ts`, wired correctly end-to-end per the technical audit). Until sign-off, the site has no page competing for any commercial-investigation query in the niche. Highest-ROI order if staged: `coaching`, `financing`, then `/process`.

### Critical (code)

2. **30 of 35 legacy `/news/*` URLs hard-404 with no redirect** (verified via Wayback CDX + live curl). The redirect mechanism already exists and works (3 slugs 308 correctly via `next.config.ts:65-97`) — it was never completed. Also 4 soft-404 shell hits: `/booking-referral`, `/booking-webinar`, `/vending-route-builder`, `/wp-sitemap.xml`. Full URL list: `findings/backlinks.md` §4.
3. **Site-wide soft-404**: every unknown URL returns HTTP 200 + noindex shell. Root cause: root `src/app/loading.tsx` forces streaming SSR, flushing the 200 before `[legacyLeadPath]`'s `notFound()` (page.tsx:52) runs — documented Next.js streaming behavior. Fix: legacy-route existence check in `src/proxy.ts` (it already has a `notFoundResponse()` helper at proxy.ts:41-49). Detail: `findings/technical.md` #1.
4. **Zero Organization/WebSite JSON-LD sitewide** (`src/app/layout.tsx` has none). Ready-to-use snippets with confirmed sameAs socials in `findings/schema.md` §3a. ContactPoint is BLOCKED: the two support phone numbers appear nowhere on-site or in the repo — verify before publishing them in schema.

### High

5. **Homepage title is `<title>Vendingpreneurs</title>`** — no keyword on the domain's highest-authority URL. Proposed: `Vendingpreneurs | Vending Machine Business Mentorship & Coaching`.
6. **`/solutions` and `/process` are orphaned** — zero internal links from nav, homepage, or any content page. Independent of the noindex holdback; must be fixed for indexing to matter.
7. **Founder is never named** — `/about` is titled "Meet The Founder" but contains no name, surname, credential, or Person schema; "Mike Hoffman" appears only inside a customer testimonial. Biggest entity/E-E-A-T gap for both Google and AI answers.
8. **~390KB of third-party JS fires in one `afterInteractive` burst on every page** (`TrackingScripts.tsx`): GTM 158KB + Meta Pixel 105KB + RightMessage 103KB + more. The Vidalytics player script (17.5KB, sitewide) is confirmed dead code — no page embeds Vidalytics. Next.js also auto-preloads 4 of these scripts in `<head>`, competing with LCP resources.
9. **`/sitemap.xml` intermittently mis-routes** to the `[legacyLeadPath]` catch-all (reproduced once in 26 requests; genuine route-precedence race, not cache). Fixing #3 makes a mis-route fail clean (404) instead of serving HTML as the sitemap; add a content-type monitor.
10. **No author bylines, dates, or Article schema on `/news`** — and per the schema specialist, do NOT add Article/Person schema until a real author entity exists in the CMS; add the visible byline + date first.

### Medium

11. No apex→www redirect (both hosts serve 200; mitigated by correct canonicals). Fix is a Vercel dashboard domain setting, not code.
12. No `/llms.txt` — full drafted file ready in `findings/geo.md` §2 (ship as `public/llms.txt`; fix the founder-name gap first or keep the draft's hedged wording).
13. Article body images are raw `<img>` from the markdown pipeline — ~350KB unoptimized JPEG each, no dimensions (CLS risk). Fix in `src/lib/markdown.ts` (rehype image rewrite).
14. FAQ content exists on `/process`, `/solutions`, and 2 of 3 news articles without FAQPage schema. Note: Google retired FAQ rich results 2026-05; the value here is GEO/AI-citation, not SERP features.
15. Booking variants render doubled titles (`… | Vendingpreneurs | Vendingpreneurs`) — template bug in `bookingMetadata()`; cosmetic (pages are noindex).

### Deliberate non-recommendations (do not "fix")

- Review/AggregateRating markup on testimonials/case studies — policy risk; the codebase already correctly avoids it.
- Course/EducationalOrganization schema — program doesn't meet eligibility; would misrepresent the entity.
- The `/booking-*` noindex,nofollow + canonical→/contact setup — correct for paid-traffic landers.
- CSP report-only / HSTS non-preload — deliberate, documented staging.

## Competitive position

Only site in its direct niche (vs. hillvending.com, ikravevending.com, thevendingmentors.com) with enough link signal to clear Common Crawl's PageRank threshold at all. The niche's money keywords are winnable: competitors are weak on authority, and Vendingpreneurs' case-study depth (25 stories with real numbers) is unmatched raw material. The gap is purely that the targeting pages are switched off and the entity is anonymous.

## Data gaps (what would sharpen this)

- **PSI/CrUX**: keyless quota was exhausted by the parallel run; re-run `claude-seo run pagespeed_check.py` standalone, or set `GOOGLE_API_KEY`.
- **GSC/GA4**: not wired (`google_auth.py --check` fails) — connecting Search Console unlocks indexation + query data and the seo-google specialist.
- **Backlink score**: Tier 0 only; a Moz (free tier) or DataForSEO key unlocks referring domains, anchors, toxicity, and rank tracking.
