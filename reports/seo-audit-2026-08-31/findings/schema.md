# Schema / Structured Data Audit — vendingpreneurs.com

Date: 2026-08-31 · Agent: seo-schema

## Method

- Live fetch (raw HTML, `render_page.py --mode never`, confirmed not an SPA — `is_spa: false`) of: `/`, `/about`, `/news`, `/news/best-vending-locations`, `/news/top-10-profitable-products-to-stock-in-your-vending-machine`, `/news/top-5-questions-vending-entrepreneurship-program`, `/case-studies`, `/case-studies/dj-50k-per-month`, `/solutions`, `/solutions/coaching`, `/apply`, `/book-now`, `/contact`.
- Repo grep: `grep -rn "application/ld+json" src/` and full read of every `structured-data.ts` file and the pages that render them.
- No repo edits, no builds.

## 1. Detection results — what schema exists today

| Page                                                     | Live JSON-LD blocks                                                                         | Source file                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/`                                                      | **0**                                                                                       | — (no Organization/WebSite schema anywhere)                                                           |
| `/about`                                                 | **0**                                                                                       | —                                                                                                     |
| `/news` (index)                                          | **0**                                                                                       | —                                                                                                     |
| `/news/best-vending-locations`                           | 1 — `FAQPage`                                                                               | `src/lib/news/structured-data.ts` → `src/app/news/[slug]/page.tsx:58-67`                              |
| `/news/top-10-profitable-products-...`                   | **0** (body has no `## Frequently asked questions` heading, so the extractor emits nothing) | same file, conditional                                                                                |
| `/news/top-5-questions-vending-entrepreneurship-program` | **0** (same reason)                                                                         | same file                                                                                             |
| `/case-studies` (index)                                  | **0**                                                                                       | —                                                                                                     |
| `/case-studies/dj-50k-per-month`                         | 1 — `VideoObject` (nested `publisher: Organization`)                                        | `src/lib/case-studies/structured-data.ts` → `src/app/case-studies/[slug]/page.tsx:70-80`              |
| `/solutions` (index)                                     | **0**                                                                                       | —                                                                                                     |
| `/solutions/coaching`                                    | **0**                                                                                       | `src/app/solutions/[slug]/page.tsx` — static content page, never wired to any structured-data builder |
| `/apply`                                                 | 308 → `/contact`, then **0**                                                                | `next.config.ts:75-78` redirect; final page has none                                                  |
| `/book-now`                                              | **0** (also `noindex,nofollow`)                                                             | `src/app/book-now/page.tsx`                                                                           |
| `/contact`                                               | **0**                                                                                       | `src/app/contact/page.tsx`                                                                            |

A third generator exists but is unused on every page fetched: `buildResourcePageStructuredDataGraphs` (`src/components/sections/resource-page-structured-data.ts`), which emits `BreadcrumbList` + `FAQPage` for CMS "resource pages" (`route_prefix` in `/blog`, `/landing`, `/resources`, `/videos`, `/solutions`-via-page-builder). It only fires for pages built through the SEO Page Builder (`ResourcePageRenderer.tsx`) — the static `/solutions/*` routes under `src/app/solutions/` are a different, hand-coded page and never reach it.

No microdata or RDFa found anywhere.

## 2. Validation of existing schema

**FAQPage (`/news/best-vending-locations`)** — syntactically valid, `@context` correct, 5 Question/Answer pairs, no placeholder text.

- Severity: **Info, not Critical.** Google retired FAQ rich results for all sites 2026-05-07 (this supersedes the Aug-2023 gov/health-only restriction). This markup earns **no SERP feature**. Any AI-Overview/GEO benefit is unconfirmed. Not worth removing, but do not invest further in it and do not add more FAQPage blocks expecting a rich result.

**VideoObject (`/case-studies/dj-50k-per-month`)** — syntactically valid. Has `name`, `description`, `thumbnailUrl`, `uploadDate` (ISO 8601 ✓), `embedUrl`, `contentUrl`, `url`, `publisher`.

- **Missing recommended property: `duration`** (ISO 8601, e.g. `PT4M32S`). Google's Video rich result docs list `duration` as recommended for eligibility signals; the source data (`youtube_video_id`) doesn't carry a stored duration, so this would need a new column or a YouTube oEmbed/API lookup at build time. Severity: **Low.**
- Deliberate, documented, and correct omission: no `Review`/`AggregateRating`. The code comment explicitly states self-reported/unaudited revenue figures must not be marked up as ratings. This matches Google's self-serving-review policy — **do not override this decision.**

## 3. Missing opportunities & recommendations

### 3a. Organization + WebSite — CRITICAL, sitewide, currently zero coverage

Every page inherits `src/app/layout.tsx`, and it has no JSON-LD at all. This is the single highest-value fix: it's what backs the Knowledge Panel, sitelinks search box eligibility, and logo-in-search.

**Evidence gap on phone numbers:** the brief's two support lines (+1-541-214-2221 / +1-949-676-1373) do **not appear anywhere** in the repo (`grep -rn "phone\|tel:"` across `src/` — no literal number, no CallRail/DNI script) or on any live page fetched (checked raw HTML of all 13 fetches for both numbers — zero matches). **Do not publish a `ContactPoint` with these numbers until they are confirmed live on the site or with the business owner** — schema making a claim (a working support line) that isn't visible on the page is exactly the kind of markup Google's spam policies target, and a wrong/dead number in a Knowledge Panel is a trust problem. Recommendation below includes the `ContactPoint` block ready to enable once the numbers are verified/published somewhere on-site (e.g., footer or `/contact`).

Confirmed `sameAs` sources (`src/lib/content/nav.ts:65-89`, comment says "confirmed live against the real account on 2026-08-20"):

- `https://www.youtube.com/@Vendingpreneurs`
- `https://www.instagram.com/vendingpreneurs/`
- `https://www.tiktok.com/@vendingpreneurs`
- `https://www.linkedin.com/company/vendingpreneurs`
- Facebook and X deliberately excluded (dead/nonexistent per code comment) — do not add them.

Logo: `public/brand/wordmark.png` is used sitewide (seen in preload links on every fetch) — confirm there's also a square/icon-shaped mark for the `logo` property; Google prefers a non-wordmark square logo ≥112×112px for the Knowledge Panel. If only the wordmark exists, it still works but flag as **Medium** — consider a square icon asset.

**File to add to:** `src/app/layout.tsx` (server component, renders once, applies to every route — the same pattern `ResourcePageRenderer.tsx` already uses for its per-page graphs).

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.vendingpreneurs.com/#organization",
  "name": "Vendingpreneurs",
  "url": "https://www.vendingpreneurs.com/",
  "logo": "https://www.vendingpreneurs.com/brand/wordmark.png",
  "sameAs": [
    "https://www.youtube.com/@Vendingpreneurs",
    "https://www.instagram.com/vendingpreneurs/",
    "https://www.tiktok.com/@vendingpreneurs",
    "https://www.linkedin.com/company/vendingpreneurs"
  ]
}
```

Add `contactPoint` ONLY after confirming the numbers are real/live:

```json
"contactPoint": [
  {
    "@type": "ContactPoint",
    "telephone": "+1-541-214-2221",
    "contactType": "customer support",
    "areaServed": "US"
  },
  {
    "@type": "ContactPoint",
    "telephone": "+1-949-676-1373",
    "contactType": "customer support",
    "areaServed": "US"
  }
]
```

WebSite (same file, separate `<script>` tag or same graph as an array):

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.vendingpreneurs.com/#website",
  "url": "https://www.vendingpreneurs.com/",
  "name": "Vendingpreneurs",
  "publisher": { "@id": "https://www.vendingpreneurs.com/#organization" }
}
```

Skip `SearchAction`/sitelinks-searchbox — no internal site search exists (confirmed: no search route/component found in `src/app/`), and a `SearchAction` pointing nowhere real would be invalid markup.

**Implementation note:** follow the existing pattern exactly — a small `structuredData()` builder function (mirroring `newsStructuredData`/`caseStudyStructuredData`) in a new `src/lib/site-structured-data.ts`, rendered from `layout.tsx` via `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />` (server-rendered, static data only — same "never from user input" comment the other two files already carry).

### 3b. BreadcrumbList — Medium, missing on every content page

`/news/*`, `/case-studies/*`, `/solutions/*` (and their index pages) have no breadcrumb markup, despite the exact builder (`resource-page-structured-data.ts`) already existing and being wired for CMS pages. These three sections are hand-coded routes, not CMS pages, so they never call it.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.vendingpreneurs.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Case Studies",
      "item": "https://www.vendingpreneurs.com/case-studies"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "DJ: How He Built a $50,000/Month Vending Business in One Year",
      "item": "https://www.vendingpreneurs.com/case-studies/dj-50k-per-month"
    }
  ]
}
```

Same shape for `/news/[slug]` (crumb 2 = "News", `/news`) and `/solutions/[slug]` (crumb 2 = "Solutions", `/solutions`).

**Where:** add alongside the existing structured-data blocks in `src/app/news/[slug]/page.tsx`, `src/app/case-studies/[slug]/page.tsx`, and (new) `src/app/solutions/[slug]/page.tsx` — cheapest as three small `breadcrumbGraph(...)` helper functions colocated with each route's existing `structured-data.ts`, since each already knows title + slug.

### 3c. VideoObject on the VSL pages (`/contact`, `/apply`→`/contact`, `/book-now`) — Medium-High

`ApplyVsl` (`src/components/sections/apply/ApplyVsl.tsx`) renders a real, always-present (server-rendered thumbnail + click-to-play) YouTube embed — `youtubeId: "P-Z1BZ9M-Fg"` from `src/lib/content/apply-page.ts:43-50` ("Watch Mike's story"). This is the primary VSL on the highest-intent page in the funnel and has **zero VideoObject markup**, confirmed live (0 blocks on `/contact`).

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Watch Mike's story — Vendingpreneurs",
  "description": "Mike's free training on how to launch and scale a vending machine business.",
  "thumbnailUrl": ["https://i.ytimg.com/vi/P-Z1BZ9M-Fg/maxresdefault.jpg"],
  "embedUrl": "https://www.youtube-nocookie.com/embed/P-Z1BZ9M-Fg",
  "contentUrl": "https://www.youtube.com/watch?v=P-Z1BZ9M-Fg",
  "uploadDate": "<REQUIRED — pull real publish date, do not fabricate>",
  "publisher": {
    "@type": "Organization",
    "name": "Vendingpreneurs",
    "url": "https://www.vendingpreneurs.com/"
  }
}
```

**Blocker:** `uploadDate` is required for VideoObject rich-result eligibility and there is no stored date for this VSL anywhere in `src/lib/content/apply-page.ts`. Do not invent one (violates the "no placeholder text" / no-fabricated-data rule). Either add a real `publishedAt` field to the content module, or pull it via the YouTube Data API at build time. Until that exists, this should ship without `uploadDate` and be treated as **not rich-result eligible yet** — flag as **Info** until the date is sourced, then it becomes a real win.

**Where:** `src/components/sections/apply/ApplyVsl.tsx` is shared across `/contact`, `/book-now`, `/booking-youtube`, and Anthony's persona variant — safest to build the graph once (new `src/lib/apply/vsl-structured-data.ts`) and render it from `ApplyLandingPage.tsx` (the shared wrapper) rather than duplicating in every page that mounts it, since the `youtubeId`/copy vary by variant and the component already accepts a `vsl` prop.

Note: `/book-now` is `noindex,follow` with canonical → `/contact`, so schema there is low priority — Google won't index it regardless. Skip it; put the VideoObject only where it's actually indexable (`/contact`).

### 3d. Article/BlogPosting + Person author on `/news/*` — Not recommended as scoped

Checked `src/lib/services/news` types and both non-FAQ news articles for byline/author data: **no author/Person entity exists anywhere in the news content model** (no `author` column referenced, no Person component). Adding `Article`/`BlogPosting` schema with a fabricated or generic "Vendingpreneurs" author would be low-value (Google increasingly ignores Article schema without a real, consistent author entity backing E-E-A-T) and Person schema cannot be built at all without a real author record. **Recommendation: do not add Article/Person schema until the CMS captures a real author per post.** If/when it does, `Article` (not `NewsArticle` — this is evergreen educational content, not news-cycle journalism) with `author: Person`, `datePublished`, `dateModified`, `image`, `publisher` is the correct shape, added the same way the existing `newsStructuredData()` works (extend that same file, same page).

### 3e. Course / EducationalOrganization — Honest eligibility call: **do not add**

The program (`ProgramV2`/`accelerator` content, `src/lib/content/home.ts` + `home-v2.ts`) is a mentorship/coaching + equipment/financing accelerator, not a structured course with a syllabus, enrollment dates, or credential. Google's Course rich result requires `hasCourseInstance` with real `courseMode`/dates or a `Course` with `provider` as an `EducationalOrganization` — neither fits a rolling-enrollment business mentorship offer. `EducationalOrganization` as the org `@type` would also be inaccurate (Vendingpreneurs is not an accredited educational institution) and would misrepresent the entity type to Google. **Skip both.** If a future cohort-based product with real start/end dates ships, revisit — the eligibility bar is specific, not a stretch fit here.

### 3f. Review / AggregateRating — Do not add (policy risk)

No star ratings, no aggregate score, no third-party review platform integration found on `/`, testimonials (`TestimonialsV2.tsx`), or case studies. The case-studies structured-data file already documents _why_ this was deliberately skipped (self-reported/unaudited revenue figures). This reasoning is correct and should extend sitewide: **do not mark up the video testimonials or case-study revenue claims as `Review`/`AggregateRating`** — doing so would violate Google's guidance against self-serving/unverifiable review markup and risks a manual action. No action needed; flagging only so a future PR doesn't reintroduce it.

## Summary table

| Item                                          | Severity        | Status                                                      |
| --------------------------------------------- | --------------- | ----------------------------------------------------------- |
| Sitewide Organization + WebSite schema        | **Critical**    | Missing entirely                                            |
| ContactPoint phone numbers                    | **Blocked**     | Numbers not found on-site or in repo — verify before adding |
| BreadcrumbList on news/case-studies/solutions | Medium          | Missing (builder exists, unused)                            |
| VideoObject on `/contact` VSL                 | Medium-High     | Missing; needs a real `uploadDate` source                   |
| VideoObject `duration` on case studies        | Low             | Missing recommended prop                                    |
| Existing FAQPage (1 article)                  | Info            | Valid but zero Google SERP value post-2026-05-07 retirement |
| Article/Person on news                        | Not recommended | No author entity exists to back it                          |
| Course/EducationalOrganization                | Not recommended | Program doesn't meet rich-result eligibility                |
| Review/AggregateRating                        | Do not add      | Self-serving-review policy risk; correctly avoided already  |
