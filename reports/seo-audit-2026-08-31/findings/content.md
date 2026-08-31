# Content / SXO / Cluster Audit — vendingpreneurs.com

Date: 2026-08-31 · Scope: seo-content + seo-sxo + seo-cluster · Method: live HTTP fetch of production pages, no repo edits.

Pages fetched: `/`, `/about`, `/solutions`, `/solutions/coaching`, `/solutions/financing`, `/solutions/vendscout`, `/process`, `/case-studies`, `/case-studies/jason-500-machines`, `/news`, `/news/best-vending-locations`, `/news/top-10-profitable-products-to-stock-in-your-vending-machine`, `/apply`, `/book-now`, `/resources`, `/booking`, `/booking-t5-socials`, `/booking-ak-t5`, `/booking-b5-socials`, `/booking-ak-b5`.

---

## Summary

The site's biggest problem isn't content quality — the case studies and two live news articles are genuinely well-built (real numbers, FAQPage schema, decent length). The problem is **indexation and internal linking architecture**: the entire `/solutions` and `/process` content silo — the pages that would target the niche's core commercial-investigation queries (coaching, financing, equipment, locations, contracts) — is either `noindex` or orphaned from every other page on the site, and the homepage title tag carries zero keyword signal. The blog has only 3 posts against a niche with dozens of high-intent, low-competition queries unaddressed.

---

## Findings by Severity

### CRITICAL

**C1. 7 of 8 `/solutions/*` pages are `noindex, follow` — including the core "coaching" money page.**
`src/lib/content/solutions.ts` sets `noindex: true` on `marketplace`, `equipment`, `national-contracts`, `coaching`, `partners`, `financing`, `support`. Only `vendscout` is indexable. Confirmed live: `/solutions/coaching` and `/solutions/financing` both return `<meta name="robots" content="noindex, follow">`. `coaching` is literally "The Vending Accelerator Program" — the mentorship product this whole business sells — titled `Professional Coaching — The Vending Accelerator Program | Vendingpreneurs`, and it is invisible to Google. `financing` targets "vending machine business financing," also invisible.
**Impact:** the pages best positioned to rank for "vending machine mentorship," "vending machine business course," "vending equipment financing" don't compete at all.
**Fix:** these read as launched, complete pages (full hero, steps, features, CTAs) — get sign-off and flip `noindex` to `false` in `solutions.ts`, or if copy genuinely isn't ready, prioritize `coaching` and `financing` first since they map directly to two of the highest-intent queries in this niche.

**C2. All 7 `/process/*` steps and the `/process` index are `noindex, follow`, and `/process` is deliberately excluded from `site-routes.ts` / sitemap.**
Comment in `site-routes.ts`: _"the section is on production but held back from search until its copy is signed off."_ Confirmed live: `/process` returns `noindex, follow`. Step titles are strong informational-intent matches already written and shipped: "Draft Your Contract," "Select a Winning Product Mix," "Review & Optimize Your Vending Location," "Scale Your Vending Route" — these map almost one-to-one to long-tail "how to start a vending machine business" sub-topics.
**Fix:** same as C1 — this is finished content sitting on a switch. Prioritize for sign-off.

**C3. `/solutions` and `/process` are structurally orphaned — zero internal links found anywhere in global nav, homepage, `/about`, `/case-studies`, or `/news`.**
Grepped every fetched page's internal `<a href>` set. Homepage links to `/about /apply /case-studies /contact /news /pre-call-resources /privacy /spam-policy /terms /vending-route-blueprint` and a handful of individual case-study slugs — never `/solutions` or `/process`. The visible global nav text is "About · Resources · Case Studies · News · Get in Touch" with no "Solutions" or "Process" item at all. `/case-studies` and both news articles link to `/apply` and `/contact` but never to `/solutions`.
**Impact:** even the one indexable solution page (`vendscout`) and the indexable `/solutions` hub itself receive no internal link equity from anywhere Google is likely to already be crawling. Combined with C1/C2, this silo is functionally invisible twice over — once by `noindex`, once by omission from the link graph.
**Fix:** add a "Solutions" item to the global nav (it already exists in code, `/solutions` itself isn't noindexed) and link relevant solution/process pages contextually from case studies and news articles once C1/C2 are resolved.

**C4. Homepage `<title>` is bare brand name — no keyword, no differentiation, worst-in-class among fetched pages.**
Confirmed: `<title>Vendingpreneurs</title>` (15 characters). Meta description is acceptable (`"Mentorship, tools, and exclusive discounts to launch and scale a profitable vending machine business."`) but the title wastes the highest-authority URL on the domain.
**Fix — exact replacement:**
`Vendingpreneurs | Vending Machine Business Mentorship & Coaching` (66 chars)
Meta description (keep close to current, tighten to ~155 chars):
`Learn how to start and scale a profitable vending machine business with hands-on mentorship, location-finding tools, and equipment discounts.`

### HIGH

**H1. Zero author attribution or E-E-A-T byline on any `/news` article.** Checked both fetched articles' full HTML and the `/news` index card markup: no author name, no `author` schema property, no visible "By [Name]," no published/updated date anywhere in the rendered page (the "by" hits found in text are false positives — product copy like "by pairing jerky with..."). Neither article carries `Article`/`BlogPosting` schema at all — one has `FAQPage`/`Question`/`Answer`, the other has no schema. For a YMYL-adjacent niche (people making business/financial decisions), unattributed, undated advice content is a real trust gap and hurts AI-citation eligibility (LLMs weight named, dated expertise).
**Fix:** add `author` (Person, tie to Mike or a named contributor) + `datePublished`/`dateModified` to `BlogPosting` schema and render a visible byline + date on every article template.

**H2. `/about` has no last name, no photo/credential verification, no schema, no external validation.** Full text reviewed: "Mike" is never given a surname anywhere on the page or in visible metadata. Claims ("Human Performance and Longevity consultant") have no linked credential, cert, or third-party profile. No `Person`/`Organization` schema on the page. This is the single page most responsible for trust signal in a coaching business and it currently reads as anonymous.
**Fix:** add full name, a linked professional credential/certification or LinkedIn profile, and `Person` schema (`name`, `jobTitle`, `sameAs`).

**H3. Blog has only 3 posts total — massive under-coverage of a niche with dozens of clear, low-competition long-tail queries.** `/news` index lists exactly 3 URLs (`best-vending-locations`, `top-10-profitable-products-to-stock-in-your-vending-machine`, `top-5-questions-vending-entrepreneurship-program`). See cluster gap table below — most money-adjacent informational queries have no page at all.

**H4. No dedicated page targets "how to start a vending machine business," "is a vending machine business profitable," "vending machine business for beginners," or "buy a vending machine route."** These are core purchase-journey queries for this niche and none of the fetched pages (home, about, apply, news x2, case study) target them as a primary H1/title. The closest matches are locked behind noindex (`coaching`) or don't exist.

### MEDIUM

**M1. Duplicate title/meta/H1 between `/apply` and `/book-now`.** Both: title `Apply | Vendingpreneurs`, same meta description, same H1 "Everyday People Are Building $5-$60k/Month Vending Routes." Low risk since `/book-now` is correctly `noindex, nofollow`, but if it's ever indexed accidentally the duplication is exact. Recommend a distinct title anyway for clarity in browser tabs/social shares: `Book Your Vending Business Strategy Call | Vendingpreneurs`.

**M2. `/resources` (bare URL) has no `page.tsx`, returns `noindex`, empty H1, brand-only title — reads as a dead/thin URL.** Only subpaths (`/resources/roadmap`, `/resources/finance-templates`, etc.) have real pages. If `/resources` is linked anywhere (nav, footer) it lands users on nothing. Verify nothing links to the bare `/resources` path, or add a real index page listing the resource sub-pages.

**M3. `/booking-t5-socials`, `/booking-ak-t5`, `/booking-b5-socials`, `/booking-ak-b5` all render the exact same doubled title: `Book Your Call | Vendingpreneurs | Vendingpreneurs`.** Cosmetic (correctly `noindex, nofollow`, so no ranking impact) but the doubled brand suffix suggests a template bug in `bookingMetadata()` worth a quick look since it affects every paid-traffic landing variant's browser tab / social preview.

**M4. Case-study pages use `VideoObject` + `Organization` schema but no `Review`/testimonial-style schema** despite being first-person success-story proof content — a missed structured-data opportunity for rich results and AI-citation (a quotable "$X/month in Y months" claim benefits from being machine-parseable).

### LOW

**L1. `/case-studies/jason-500-machines` and other story titles are strong for their own long-tail ("scaled to 500+ vending machines by buying routes") but nothing internally links case studies to the topically-adjacent `/solutions` pages** (e.g., a route-buying story should link to a future "buy a vending route" solution/guide page). Low priority until C1/C3 are fixed.

---

## Keyword / Cluster Gap Table

| Target query (money/high-intent)                               | Page currently targeting it                                                              | Status                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| vending machine mentorship / coaching                          | `/solutions/coaching` (title: "Professional Coaching — The Vending Accelerator Program") | **Noindex — invisible** (C1)                                                        |
| vending machine business financing                             | `/solutions/financing`                                                                   | **Noindex — invisible** (C1)                                                        |
| vending machine equipment / buy machines                       | `/solutions/equipment`                                                                   | **Noindex — invisible** (C1)                                                        |
| vending machine locations / how to find locations              | `/news/best-vending-locations` (indexed, decent) + `/process/find-locations` (noindex)   | Partial — informational query covered, but the deeper process/how-to step is hidden |
| vending machine business course                                | none                                                                                     | **Gap — no page**                                                                   |
| how to start a vending machine business                        | none (homepage is brand/offer-focused, not this query)                                   | **Gap — no page**                                                                   |
| is a vending machine business profitable                       | none dedicated (numbers exist scattered on homepage/case studies)                        | **Gap — no page**                                                                   |
| vending machine business for beginners                         | none                                                                                     | **Gap — no page**                                                                   |
| buy a vending machine route                                    | `/case-studies/jason-500-machines` (proof, not optimized as a guide)                     | **Gap — no informational/guide page**                                               |
| what products to stock in a vending machine                    | `/news/top-10-profitable-products-to-stock-in-your-vending-machine`                      | Covered, indexed, good                                                              |
| vending machine business cost / how much does it cost to start | none                                                                                     | **Gap — no page**                                                                   |
| vending route contracts / how to pitch a location              | `/process/pitch`, `/process/contract`                                                    | **Noindex — invisible** (C2)                                                        |
| national vending contracts                                     | `/solutions/national-contracts`                                                          | **Noindex — invisible** (C1)                                                        |
| vending machine partnerships/support                           | `/solutions/partners`, `/solutions/support`                                              | **Noindex — invisible** (C1)                                                        |

---

## Proposed Content Roadmap — 10 Highest-Value Pieces

1. **Fix first, build second:** Flip `noindex` off on `/solutions/coaching` and `/solutions/financing` (highest existing-content ROI, zero new writing).
2. **Fix first, build second:** Flip `noindex` off on `/process` index + all 7 steps once copy sign-off clears; add `/process` back to `site-routes.ts`.
3. New page — slug `/news/how-to-start-a-vending-machine-business` — pillar guide, targets "how to start a vending machine business."
4. New page — slug `/news/is-a-vending-machine-business-profitable` — data-driven answer piece (pull real numbers already used in case studies/homepage), strong AI-citation candidate with a clear FAQ block.
5. New page — slug `/news/vending-machine-business-for-beginners` — beginner-intent spoke linking to `/apply` and `/solutions/coaching`.
6. New page — slug `/news/how-much-does-it-cost-to-start-a-vending-machine-business` — cost-breakdown piece, links to `/solutions/financing`.
7. New page — slug `/news/buying-a-vending-machine-route-guide` — how-to/checklist guide, cross-links to `/case-studies/jason-500-machines` and any other route-purchase case studies.
8. New page — slug `/news/vending-machine-business-course-comparison` or reposition `/solutions/coaching` copy to explicitly target "vending machine business course/mentorship program" once indexed.
9. Add a "Solutions" item to global nav + a "How It Works" homepage section linking to `/process` steps and top `/solutions` pages (structural fix, not new content).
10. Add `BlogPosting` schema + visible author byline + date to all `/news` templates (`author`, `datePublished`, `dateModified`) and add `Person` schema + full name/credential to `/about`.

---

## Limitations

- Content evaluated via raw HTML fetch (curl), not JS-rendered browser; if any body copy loads client-side only after hydration, word counts here are a floor, not a ceiling.
- Only 1 of 8 solution pages, 1 of 7 process steps, 1 of 25 case studies, and 2 of 3 news posts were fetched individually; severity findings on noindex/orphan status are confirmed structurally via `solutions.ts`/`process.ts` source, not by fetching all 21 remaining URLs.
- No rank-tracking or SERP data pulled (would require `seo-sxo`'s WebSearch step against live SERPs — not run in this pass); keyword gap table is based on niche knowledge + on-page targeting, not verified SERP position.
