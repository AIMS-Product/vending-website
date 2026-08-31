# SEO Action Plan — vendingpreneurs.com — 2026-08-31

Sequenced backlog from the full audit. Each code slice ships via the normal flow: slice → implement → review → `/cap` (merge to main = live in ~1 min). Nothing here auto-ships.

## P0 — Decisions (Adam, zero code)

| #   | Action                                                                                                                                                                                                            | Why                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D1  | **Sign off copy for `/solutions/coaching` + `/solutions/financing`, then `/process`** (or delegate sign-off). Flipping `noindex: false` in `solutions.ts`/`process.ts` is a 2-line change per page once approved. | The single biggest lever. These finished pages target every money keyword in the niche and are currently invisible. |
| D2  | **Vercel dashboard: set apex `vendingpreneurs.com` → redirect to `www`.** Domains settings, ~1 minute.                                                                                                            | Kills the duplicate-host surface. No PR.                                                                            |
| D3  | **Confirm the two support phone numbers** (+1-541-214-2221 / +1-949-676-1373) are real and should be public. They appear nowhere on-site.                                                                         | Gates the ContactPoint schema block.                                                                                |
| D4  | **Approve founder identity copy for `/about`** — full name, role, one-line credential.                                                                                                                            | Gates the E-E-A-T/entity fixes (slice S4).                                                                          |

## P0 — Code slices

**S1. Legacy redirect completion** (~34 URLs, lowest risk, highest immediate value)

- Extend the existing redirect map (`next.config.ts`) with 301s for the 30 dead `/news/*` slugs → nearest live post or `/news`, plus `/booking-referral`, `/booking-webinar` → `/booking`, `/vending-route-builder` → nearest live equivalent, `/wp-sitemap.xml` → `/sitemap.xml`.
- Full URL list + suggested targets: `findings/backlinks.md` §4.

**S2. Real 404s (kill the site-wide soft-404)**

- Add legacy-route existence check for unknown single-segment paths in `src/proxy.ts` using its existing `notFoundResponse()` (proxy.ts:41-49), mirroring the `REMOVED_PUBLIC_PATHS` pattern (proxy.ts:51,158-160).
- Ship AFTER S1 so newly-redirected URLs never 404 in between.
- Also mitigates the sitemap mis-route symptom (a race would 404 clean instead of serving HTML as the sitemap).

## P1 — Code slices

**S3. Metadata quick wins**

- Homepage: `Vendingpreneurs | Vending Machine Business Mentorship & Coaching` + tightened description (exact strings in `findings/content.md` C4).
- Fix doubled `| Vendingpreneurs | Vendingpreneurs` in `bookingMetadata()`.
- Distinct title for `/book-now`.

**S4. Entity foundation** (needs D3/D4)

- New `src/lib/site-structured-data.ts`: Organization + WebSite JSON-LD rendered from `layout.tsx` (ready snippets: `findings/schema.md` §3a; confirmed sameAs socials; ContactPoint only after D3).
- `/about`: founder name + credential in copy (D4) + Person schema.
- Wire BreadcrumbList into `/news/[slug]`, `/case-studies/[slug]`, `/solutions/[slug]` (builder already exists in `resource-page-structured-data.ts`).

**S5. Third-party script diet**

- `TrackingScripts.tsx`: RightMessage + HubSpot loader → `lazyOnload`; DELETE the Vidalytics script (confirmed dead code — re-add scoped to VSL pages when the Vidalytics embed actually ships). Keep GTM + Meta Pixel as-is.
- Cuts the post-hydration JS burst ~390KB → ~185KB and removes 3-4 head preloads competing with LCP.
- Verify attribution still fires on preview before merging (GTM/Pixel untouched, but confirm RightMessage personalization isn't load-order-sensitive).

**S6. Internal linking** (pairs with D1)

- Add "Solutions" to global nav; homepage "How It Works" section linking `/process`; contextual links from case studies/news into solutions.

## P2 — Code slices

**S7. `public/llms.txt`** — drafted file in `findings/geo.md` §2; update the founder line after S4.
**S8. Article image pipeline** — rehype pass in `src/lib/markdown.ts` rewriting body `<img>` to optimized/resized output with dimensions (~1MB/article savings, CLS fix).
**S9. FAQ/GEO rollout** — extend the proven FAQPage pattern to the 2 other news articles + `/process` steps; add visible byline + date to news template (schema-backed Article/Person only once a real author entity exists in the CMS).
**S10. VideoObject for the `/contact` VSL** — blocked on sourcing a real `uploadDate` for YouTube `P-Z1BZ9M-Fg` (never fabricate); snippet ready in `findings/schema.md` §3c.

## P3 — Content & authority (ongoing)

- **New articles** (priority order, slugs + rationale in `findings/content.md` roadmap): how-to-start pillar, profitability answer piece, beginners spoke, cost breakdown, route-buying guide. Each with FAQ block + internal links to `/solutions` money pages.
- **Link building** (7 plays in `findings/backlinks.md` §5): NAMA listing, business-opportunity directories, podcast circuit (the `/booking-podcast` funnel already exists as the CTA), HARO/Qwoted, YouTube collabs, supplier-blog case-study placements, genuine r/vending presence.

## Monitoring (standing)

- **Drift baseline** captured 2026-08-31 via `claude-seo run drift_baseline.py` — future `/seo-drift` runs diff against it.
- **Sitemap watch**: add a CI/uptime check asserting `content-type: application/xml` on `/sitemap.xml` (catches the routing race silently regressing).
- **Wire GSC/GA4** (`claude-seo run google_auth.py --check`) to unlock indexation/query data in future audits.
- Re-audit cadence: monthly `/seo-audit`, or after each P0/P1 slice ships.
