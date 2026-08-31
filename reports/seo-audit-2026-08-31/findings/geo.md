# GEO / AI-Visibility Audit — vendingpreneurs.com

Date: 2026-08-31 · Auditor: seo-geo · Method: live HTTP fetches (curl + trafilatura extraction), no repo/build access used, no edits made.

## GEO Readiness Score: 58 / 100

| Dimension                 | Weight | Score  | Notes                                                                                                                                     |
| ------------------------- | ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Citability                | 25%    | 65/100 | Strong quotable stats and one FAQ-schema article; inconsistent across other content pages                                                 |
| Structural Readability    | 20%    | 70/100 | Good question-shaped H2s on news content; homepage/process are visually laid out, not heading-structured                                  |
| Multi-Modal Content       | 15%    | 55/100 | Testimonial video/VideoObject schema on case studies; no video/image alt-text audit possible without JS render but YouTube channel exists |
| Authority & Brand Signals | 20%    | 30/100 | No founder name on /about, no legal entity name anywhere, no Organization schema, no founding year                                        |
| Technical Accessibility   | 20%    | 75/100 | Fully SSR (`is_spa: false` everywhere), robots.txt open, no bot-specific blocking detected                                                |

---

## 1. AI Crawler Access

**robots.txt (live, fetched 2026-08-31):**

```
User-Agent: *
Allow: /
Disallow: /admin/

Host: https://www.vendingpreneurs.com
Sitemap: https://www.vendingpreneurs.com/sitemap.xml
```

No bot-specific rules exist for GPTBot, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, CCBot, or Bytespider. They all fall under the wildcard `User-Agent: *` rule, which is `Allow: /` (minus `/admin/`). **Confirmed: all listed AI crawlers are currently allowed to crawl the entire public site.**

**Implication both ways:**

- **Allowing (current state) → AI citability upside.** GPTBot/PerplexityBot/ClaudeBot can freely index every marketing page, case study, and article, making the site eligible to be cited in ChatGPT Search, Perplexity, and Claude answers. Given the near-total absence of any explicit block, this is the correct default for a lead-gen/mentorship business whose entire goal is to be found and quoted.
- **Tradeoff.** Allowing `CCBot` and generic AI crawlers also means content (testimonials, case-study numbers, program pricing signals) can be scraped for LLM **training** data, not just retrieval-time citation — with no attribution or traffic back to the site. Some sites split this by allowing PerplexityBot/OAI-SearchBot/ClaudeBot (retrieval, drives citations) while disallowing GPTBot/CCBot (training-only crawlers). Vendingpreneurs currently makes no such distinction — it's all-or-nothing open. Given the business is early on the "get cited" curve (no llms.txt, no entity schema — see below), the citability upside outweighs the training-scrape cost right now. Revisit only if the program's proprietary case-study numbers/pricing start showing up verbatim in competitor AI-generated content.

**WAF/bot-blocking check:** Fetched `/` with `User-Agent: GPTBot` vs. a standard browser UA. Both returned `HTTP/2 200`, identical byte count (229,350 bytes), identical `x-vercel-cache: HIT`, no challenge page, no Vercel firewall interstitial. **No bot-blocking signal detected** — Vercel is serving GPTBot the same cached HTML as a real browser. Severity: informational (this is the desired state, not a problem).

---

## 2. llms.txt

**Status: MISSING.** `curl https://www.vendingpreneurs.com/llms.txt` returns `HTTP/2 200`, but the body is the Next.js soft-404 page (`<title>Vendingpreneurs</title>`, literal "404" in the body, byte-identical in structure to a request for a random nonexistent path). There is no catch-all-route 404 status code being returned (all unknown paths 200), so status code alone can't be used to detect this — confirmed via content diff against a known-real page and a known-fake path. **No real /llms.txt exists.**

Severity: **Medium**. llms.txt has no confirmed effect on Google/Search ranking and is ignored by Google, but several AI answer engines (Perplexity, some ChatGPT plugins/connectors) do fetch it when present, and it costs nothing to add. Given this site has no other machine-readable "here's who we are" summary (no Organization schema either — see §4), llms.txt is currently the cheapest lever available.

### Proposed `/llms.txt`

```
# Vendingpreneurs

> Vendingpreneurs is a mentorship and community program that teaches
> aspiring entrepreneurs how to launch and scale a vending machine
> business — from securing locations to selecting machines to running
> a multi-machine route as passive/semi-passive income.

## What this business does

Vendingpreneurs provides step-by-step training, 1:1 and community
mentorship, vetted vendor/discount relationships, and ongoing support
for people starting or scaling a vending machine (and micro-market)
route. The program is not a franchise: members retain full ownership
of their machines, locations, and brand.

## Key facts

- Program model: mentorship + community (Skool-based community),
  not a franchise
- Typical time investment: 2–15 hours/week to run a route
- Typical time to first machine placed: under 90 days
- Reported member revenue range: $1,000–$250,000/month per operator
  (self-reported community results; individual outcomes vary with
  investment, market, and adherence to the program — not guaranteed)
- Startup cost range referenced in program content: $3,000–$10,000
  for 1–3 machines (see /news/top-5-questions-vending-entrepreneurship-program)
- Typical location fees: $50–$300/month; typical insurance: ~$500/year
- Social proof: dozens of published written and video case studies
  from members across the US

## Key pages

- Homepage: https://www.vendingpreneurs.com/ — program overview, member
  results, "why Vendingpreneurs"
- About / Meet the Founder: https://www.vendingpreneurs.com/about
- The Vendingpreneurs Process: https://www.vendingpreneurs.com/process —
  the 7-step method every operator follows
- Solutions / VendScout: https://www.vendingpreneurs.com/solutions/vendscout
- Case studies (member results): https://www.vendingpreneurs.com/case-studies
- News / educational articles: https://www.vendingpreneurs.com/news
  - How to Find and Secure the Best Vending Machine Locations:
    https://www.vendingpreneurs.com/news/best-vending-locations
  - Top 5 Questions to Ask Before Joining a Vending Entrepreneurship
    Program: https://www.vendingpreneurs.com/news/top-5-questions-vending-entrepreneurship-program
  - Top 10 Profitable Products to Stock in Your Vending Machine:
    https://www.vendingpreneurs.com/news/top-10-profitable-products-to-stock-in-your-vending-machine
- Resources: https://www.vendingpreneurs.com/resources/vending-machines-in-high-schools,
  https://www.vendingpreneurs.com/resources/vending-in-colleges
- Contact / book a call: https://www.vendingpreneurs.com/contact

## Notes for AI assistants

- Revenue and time figures on this site are self-reported by program
  members and explicitly disclaimed as non-guaranteed averages, not
  audited financials.
- The site currently does not publish the founder's name on the About
  page; community references identify the founder as Mike Hoffman.
  Verify against https://www.vendingpreneurs.com/about before citing
  a name.
```

Note: this draft is written from what is publicly stated on the live site today, including the founder-name gap flagged in §4. Fix that gap on `/about` first (see below), then update this line before publishing.

---

## 3. Citability (fetched without JS — trafilatura extraction, `is_spa: false` on every page tested)

All four pages tested rendered fully server-side; no client-side-only content was needed to get the main copy. This is a strong technical baseline for AI crawlers, which generally do not execute JS.

| Page       | Extractable w/o JS             | Quotable factual statements found                                                                                                                                                                                  |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`        | Yes (9,874 chars extracted)    | "$1K–$250K in revenue generated per month... 2–15 hours a week... under 90 days to place your first machine" (labeled as self-reported average, disclaimed); 3 named member outcomes with specific $/month figures |
| `/about`   | Yes (2,150 chars)              | Founder narrative with concrete numbers ($1,200/month job → $70K property → $250K condo) but **no founder name, no founding year, no company facts**                                                               |
| `/process` | Yes (931 chars — thin)         | Clear 7-step named process, each step is a self-contained one-line definition — good citation shape but very short overall                                                                                         |
| &          | `/news/best-vending-locations` | Yes (13,636 chars)                                                                                                                                                                                                 | Contains an actual `FAQPage` JSON-LD block with 5 direct Q&A pairs (see §5) |

**Scoring:** Citation-readiness = **7/10**. Strengths: SSR content, disclaimed stat ranges (reduces hallucination/liability risk when quoted), one article with real FAQ schema, question-shaped H2s on articles (`What actually makes a vending location profitable`, `How to qualify a location before you commit`). Weaknesses: `/process` is too thin (931 characters is below a useful passage-extraction threshold for most of its 7 steps individually); only 1 of 3 sampled news articles has FAQ schema; the "300% boost... per industry reports on 5,000+ operators" claim on the questions article cites no actual source, which is a citability risk (unattributed stats get filtered out or hedged by careful LLM answer engines).

---

## 4. Brand-Mention / Entity Consistency (NAP-equivalent for a fully-online mentorship business)

Cross-checked `/about`, footer, schema (JSON-LD across all fetched pages), and `/terms`.

| Fact                                                             | Where stated                                                                                                                                                                                                    | Consistent?                                                                                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Founder name                                                     | **Not stated anywhere on `/about` or homepage.** Only appears inside customer testimonials on the homepage: "Mike Hoffman" (full name, once) and "Mike" (first name, ~6 times).                                 | **Fail — inconsistent/missing.** An AI system trying to answer "who founded Vendingpreneurs" has to infer the name from a testimonial rather than an authoritative statement.                |
| Founding year                                                    | Not stated on `/about`, homepage, footer, or `/terms`.                                                                                                                                                          | **Missing entirely.**                                                                                                                                                                        |
| Legal entity name (LLC/Inc.)                                     | Not found on `/terms`, footer, or anywhere fetched. Member testimonials mention _their own_ vending LLCs (e.g., "DenCo Vending LLC," "Oceanside Vending, LLC") — none of these are Vendingpreneurs' own entity. | **Missing entirely.**                                                                                                                                                                        |
| Organization/Person schema (JSON-LD)                             | Checked `/`, `/about`, `/process`: **zero `application/ld+json` blocks of any kind.**                                                                                                                           | **Missing — no machine-readable entity object at all on the pages that should carry it.**                                                                                                    |
| Program stats (revenue range, hours/week, days-to-first-machine) | Stated once on homepage with disclaimer; referenced with different framing ($3K–$10K startup cost) on the "top 5 questions" article.                                                                            | Consistent in spirit, not duplicated verbatim — acceptable, no contradiction found.                                                                                                          |
| Social/brand handles                                             | Footer links to YouTube (`@Vendingpreneurs`), Instagram (`@vendingpreneurs`), TikTok, LinkedIn — all present and consistently branded.                                                                          | **Pass** — this is the single strongest entity signal on the site today; YouTube presence in particular correlates most strongly (~0.74) with AI-citation likelihood per the GEO literature. |

**Severity: High.** The lack of a founder name on the About page (titled "Meet The Founder," yet the founder is never named) and the total absence of Organization/Person schema means AI systems have no authoritative entity anchor for "who runs Vendingpreneurs" or "is Vendingpreneurs a real, verifiable company." This is the single biggest authority gap found in this audit.

---

## 5. Structured-Answer Coverage — Top 10 AI-Answerable Queries in This Niche

| #   | Likely AI query                                                    | Citable answer on site today?                                                                                                                                                                                | Where / gap                                                                                 |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | "How much does a vending machine business make?"                   | **Partial.** Homepage gives a disclaimed $1K–$250K/month range and 3 anecdotal figures ($12K, $18K, $90K/month), but no dedicated, quotable single-answer block or FAQ entry phrased as this exact question. | Add a direct FAQ answer; the range exists, the query-matched framing doesn't.               |
| 2   | "How much does it cost to start a vending machine business?"       | **Yes, weakly.** "$3,000–$10,000 for 1-3 machines" appears in the top-5-questions article, cited to unnamed "industry reports."                                                                              | Needs a first-party sourced/owned version, ideally with FAQ schema.                         |
| 3   | "Where should I place a vending machine for best profit?"          | **Yes, strong.** `/news/best-vending-locations` has full FAQPage schema answering this near-directly.                                                                                                        | Best-covered query on the site.                                                             |
| 4   | "What sells best in a vending machine?"                            | **Yes.** Answered in the same FAQPage block, plus a dedicated "Top 10 Profitable Products" article (no FAQ schema on that one).                                                                              | Add FAQ schema to the products article too.                                                 |
| 5   | "Is a vending machine business passive income?"                    | **Partial.** Strong prose theme throughout ("passive income, done right," founder narrative), no direct FAQ-style answer.                                                                                    | Easy FAQ addition — high search/AI-query volume phrase already used as a tagline.           |
| 6   | "Do you need a permit/license to place a vending machine?"         | **Yes.** Covered in the same FAQPage block on `/news/best-vending-locations`.                                                                                                                                | Covered.                                                                                    |
| 7   | "What is a vending machine mentorship/entrepreneurship program?"   | **Yes.** Directly defined in `/news/top-5-questions-vending-entrepreneurship-program` ("A vending entrepreneurship program is a structured service...").                                                     | Good, but no FAQ schema on that article.                                                    |
| 8   | "How many vending machines do I need to make $X/month?"            | **Yes.** One of the 5 FAQ answers on `/news/best-vending-locations` addresses this directly.                                                                                                                 | Covered.                                                                                    |
| 9   | "Who is Vendingpreneurs / who founded Vendingpreneurs?"            | **No.** No named founder on `/about`, no Organization schema, no bio.                                                                                                                                        | Biggest gap — see §4. Fix `/about` and add Person/Organization schema.                      |
| 10  | "What is the Vendingpreneurs process / how does the program work?" | **Yes, structurally** (`/process` lays out 7 named steps clearly) but the page is thin (931 extracted chars) and has zero schema.                                                                            | Expand each step to a self-contained ~100-150 word passage and add HowTo or FAQPage schema. |

**Summary:** 5 of 10 queries have a genuinely citable, schema-backed or clearly-stated answer today (mostly concentrated in one article: `/news/best-vending-locations`). The other 5 have raw material on the site but lack either FAQ framing, schema markup, or (for the founder-identity query) any answer at all. The fastest ROI is: (a) roll the same FAQPage-schema pattern already proven on `/news/best-vending-locations` out to the other two news articles and `/process`, and (b) name the founder and add Person/Organization JSON-LD.

---

## Prioritized Findings (severity-rated)

1. **[High]** No founder name stated on `/about` (or anywhere authoritative) despite the page being titled "Meet The Founder"; name ("Mike Hoffman") only surfaces inside a customer testimonial. Fix: state the name, role, and a one-line credential directly in the About copy.
2. **[High]** Zero Organization/Person JSON-LD schema anywhere on `/`, `/about`, or `/process`. AI systems have no machine-readable entity object to anchor citations to. Fix: add Organization schema (name, founder, sameAs → YouTube/Instagram/TikTok/LinkedIn) sitewide.
3. **[Medium]** No `/llms.txt` (confirmed soft-404, not a real file). Draft provided above — cheap to ship, currently the only proposed answer-engine-specific summary the site would have.
4. **[Medium]** FAQPage schema exists on only 1 of 3 sampled news articles, and not on `/process` or `/solutions` despite clearly FAQ-shaped content existing there. Fix: extend the same schema pattern already live on `/news/best-vending-locations`.
5. **[Low]** `/process` page is thin (931 characters across all 7 steps) and missing from `sitemap.xml` entirely (confirmed: page returns real content at HTTP 200, distinct from the site's soft-404, but no `<loc>` entry for it exists in `/sitemap.xml`). Fix: add to sitemap; expand each step to a full quotable passage.
6. **[Low]** Unsourced statistic ("300% boost... per industry reports on 5,000+ operators") with no citation/link — reduces confidence for citation-conscious answer engines. Fix: link the source or reframe as an internal/first-party stat.
7. **[Informational / good]** robots.txt and Vercel serve GPTBot identically to a normal browser (verified byte-for-byte identical response) — no bot-blocking issue exists today.
