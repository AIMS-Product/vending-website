# Persona Review — 06 Rachel, The Skeptical Buyer (42)

**Background**: Marketing director. Burned by SaaS tools that oversell and underdeliver. Reads the fine print, looks for proof before committing, distrusts anything that smells like a "get rich quick" funnel.

**Lens**: Does this feel trustworthy? Is pricing transparent? Hidden costs? Real social proof? Can I try before I buy? Is the company legit, with accessible legal/privacy pages? Are the income claims defensible?

---

## Summary

- **Pages reviewed**: 11 public pages (home, about, case-studies, apply, contact, privacy, terms, pre-call-resources, thank-you-for-applying, news, a news article) + the 5 public journeys.
- **Issues found**: 17
- **Blockers**: 0 (nothing stopped me cold — but several findings would stop me from _committing_)
- **Overall gut feel**: **2 / 5** — The legal pages are genuinely strong and the testimonials are plentiful, but the headline social-proof numbers literally render as `0+` / `$0M+` / `0+`, the program never states a price anywhere, and the whole thing leans on a single first-name founder and an income-freedom pitch. As a skeptic I would not hand over my details.

---

## Journey Review

| Journey                          | Score | Could I complete it?           | Where I'd give up                                                                                                                                                                                                                                     |
| -------------------------------- | ----- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover & Apply                 | 2/5   | Yes, mechanically              | I'd hesitate to submit: the "proof" stats are zeros and no price is stated, so I don't know what I'm applying _to_ or what it costs. After submit, the only confirmation is a tiny green line — I'd doubt it even sent.                               |
| Contact the Team                 | 3/5   | Yes, if I find it              | Contact is footer-only, not in the header. A skeptic who wants to ask a hard question before applying has to hunt for it, which reads as "they'd rather you apply than ask."                                                                          |
| Read a News Article              | 3/5   | Yes                            | Page is titled "BLOG" but the nav says "NEWS"; one article card shows a broken image rendering raw alt text. Small things, but they tell me the site isn't finished.                                                                                  |
| Evaluate Trust Before Committing | 2/5   | Reachable, yes; convincing, no | About is one founder's personal story with hard dollar figures and no surname/credentials; case studies are all 5-star with no dates or verifiable detail; the homepage proof counters are zeros. The pieces exist but none of them survive scrutiny. |
| Pre-Call Resources               | 2/5   | Yes                            | "Resources" in the nav leads to a thin checklist of three bullet points — no actual resources. As a buyer told "review the resources," I'd feel the label oversold the page.                                                                          |

### Per-journey notes

**Discover & Apply** — The path is two clicks and the form is reasonable. But this journey is exactly where my skepticism peaks and the page gives me nothing to hold onto: no price, no "here's what happens on the call," no "no obligation," and proof numbers that read `0+`. The success state (`journey-discover-and-apply-004`) is a single line of green text — _"Thanks. We received your details and will follow up shortly."_ — beside the still-full form. The automation itself missed it and resubmitted five more times; I would have assumed it failed too.

**Contact the Team** — Per `journeys.md`, Contact is reachable only via the footer "CONTACT US" link, not the header nav. A skeptic's instinct before any commitment is "let me ask a question first"; burying contact signals the funnel is one-directional.

**Evaluate Trust** — This is my home-turf journey. All four destinations load, but the _content_ is what fails me (see findings 06-skeptic-001, -004, -005, -007). The legal pages (privacy/terms) are the one bright spot — thorough, real company addresses, an income disclaimer.

**Pre-Call Resources** — The "RESOURCES" nav item points at `/pre-call-resources`, a page with three preparation bullets and _"0 embedded videos/iframes, 14 visible links"_ (per journeys.md). It's labeled like a resource library and delivers a checklist.

---

## Page-by-Page Review

### / (Home) — Gut feel: 2/5

Strong testimonial volume, but the credibility spine — the stat counters — is broken, and the pitch is income-freedom heavy.

| #              | Category                  | Finding                                                                                                                                                | Evidence                                                                                                                      | Severity |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 06-skeptic-001 | Trust & Safety            | The three hero proof-stats render as `0+`, `$0M+`, `0+` with labels "Entrepreneurs launched", "Snack/Drink sales…", "Vending locations w/our guidance" | text/home-text.md "0+ / ENTREPRENEURS LAUNCHED", "$0M+", "0+"; home-002-full.png                                              | critical |
| 06-skeptic-002 | Trust & Safety            | No price, price range, or "how pricing works" anywhere on the site; the program is unnamed-cost                                                        | text/home-text.md (full page, no $ figure for the program); text/terms-text.md "All fees… are stated at the time of purchase" | high     |
| 06-skeptic-003 | Copy & Labels             | Headline promises "FINANCIAL FREEDOM" / "passive income" with "minimal time investment" — classic overselling for a skeptic                            | text/home-text.md "TURN VENDING INTO YOUR PATH TO FINANCIAL FREEDOM", "with minimal time investment"                          | high     |
| 06-skeptic-004 | Trust & Safety            | Testimonials have no dates, no last names in several cases, no verifiable links — unfalsifiable social proof                                           | text/home-text.md "ADAM S", "ABBY C", all "5 out of 5 stars"                                                                  | medium   |
| 06-skeptic-005 | Copy & Labels             | Income-specific claim quoted approvingly in a testimonial ("making $10,000 a month in vending machines") with no disclaimer near it                    | text/home-text.md "(making $10,000 a month in vending machines)"                                                              | high     |
| 06-skeptic-006 | Accessibility & Inclusion | Serious color-contrast violation on the homepage                                                                                                       | axe-results.json "/ … color-contrast                                                                                          | serious" | medium |
| 06-skeptic-007 | Trust & Safety            | "Featured partners" logos (PepsiCo, Doritos, Poppi, Prime, etc.) implied as endorsements with no relationship stated                                   | text/home-text.md region "Featured partners": PepsiCo, Doritos, Poppi, Prime…                                                 | medium   |

### /about — Gut feel: 2/5

A single first-name founder story built on personal income figures.

| #              | Category       | Finding                                                                                                                                                           | Evidence                                                                                                   | Severity |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| 06-skeptic-008 | Trust & Safety | Founder is "Mike" with no surname, no photo caption credentials, no company registration link — thin for someone asking me to trust them with money               | text/about-text.md "MEET MIKE"; only "Mike, founder of Vendingpreneurs"                                    | high     |
| 06-skeptic-009 | Copy & Labels  | "I'm not here to sell a dream, I'm here to show you a system that works" — protesting-too-much line that raises my guard                                          | text/about-text.md "I'm not here to sell a dream, I'm here to show you a system that works."               | medium   |
| 06-skeptic-010 | Trust & Safety | Specific personal financials ($1,200/mo job, $70k fixer-upper, $250k condo, "thousands of dollars in monthly income") presented as proof with zero substantiation | text/about-text.md "paid me only $1,200/month", "$250,000 condo", "thousands of dollars in monthly income" | medium   |

### /case-studies — Gut feel: 3/5

Best proof asset on the site — video testimonials — but undermined by missing detail.

| #              | Category                  | Finding                                                                                                                                                                                              | Evidence                                                                                                                                                   | Severity  |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --- |
| 06-skeptic-011 | Trust & Safety            | The four top "case studies" are video thumbnails with names only and no written outcome/context; the page never gives concrete, dated numbers (machines, revenue, time-to-first-location) per person | case-studies-001-load.png (4 video tiles, names only); text/case-studies-text.md (Thomas Rohlader / Joe Natoli / Jason Priest / Anthony have no body text) | medium    |
| 06-skeptic-012 | Accessibility & Inclusion | Heading-order violation (skipped levels) on case studies                                                                                                                                             | axe-results.json "/case-studies … heading-order                                                                                                            | moderate" | low |
| 06-skeptic-013 | Copy & Labels             | Every single testimonial is "5 out of 5 stars" — a uniform perfect-score wall reads as curated, not credible                                                                                         | text/case-studies-text.md (10× "5 out of 5 stars", zero anything-less)                                                                                     | medium    |

### /apply — Gut feel: 2/5

Reasonable form, but no validation and a near-invisible success state.

| #              | Category         | Finding                                                                                                                                            | Evidence                                                                                                                                                                                                    | Severity |
| -------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 06-skeptic-014 | Forms & Input    | Submitting empty or invalid shows no validation errors at all — I can't tell if the form is even working, which deepens distrust                   | exploration-log.md "/apply … empty: no visible validation errors after empty submit", "invalid: no visible validation errors on invalid data"                                                               | high     |
| 06-skeptic-015 | Feedback & State | Success confirmation is one small green line beside the button; form stays full, no redirect to the existing /thank-you-for-applying page          | journey-discover-and-apply-004-04-submit-continue-round-1-.png "Thanks. We received your details and will follow up shortly."; journeys.md "does not redirect to the existing /thank-you-for-applying page" | high     |
| 06-skeptic-016 | Trust & Safety   | The apply form collects budget tier and contact details but never links to Privacy Policy near the submit button or states what happens to my data | text/apply-text.md (form ends at "SUBMIT APPLICATION" with no consent/privacy line)                                                                                                                         | medium   |

### /news + article — Gut feel: 2/5

Unfinished signals on a content section.

| #              | Category       | Finding                                                                                                                                  | Evidence                                                                                                                                                            | Severity |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 06-skeptic-017 | Trust & Safety | A news card image fails to load (500 from a leftover Webflow CDN URL), rendering raw alt text; "BLOG" heading contradicts the "NEWS" nav | exploration-log.md "/news … 500 … cdn.prod.website-files.com…ChatGPT Image…"; news-001-load.png (broken third card); text/news-text.md heading "BLOG" vs nav "NEWS" | medium   |

### /privacy & /terms — Gut feel: 4/5

The one place the site earns my trust. Thorough, specifics present, real addresses.

- Privacy and Terms both have a "Last Updated: January 26, 2026" date, a physical address (91302 Coburg Industrial Way, Coburg, OR 97408), CCPA/VCDPA/CPA/CTDPA/UCPA state rights, SMS consent terms, and contact emails. (text/privacy-text.md, text/terms-text.md)
- Terms §15 carries a proper income disclaimer: _"We make no guarantees regarding income, business success, or specific outcomes."_ — which is good, **but it lives only in the Terms**, not next to the income claims on the home/about pages where a skeptic actually sees them.
- No findings logged against the legal pages themselves; they are a credibility asset.

### /pre-call-resources — Gut feel: 2/5

Covered under journey notes; the "RESOURCES" label oversells a 3-bullet checklist (text/pre-call-resources-text.md).

---

## Blockers

None that hard-stop navigation. But from a _buying-decision_ standpoint, the combination of broken proof-stats (06-skeptic-001) + total price opacity (06-skeptic-002) is a soft blocker: I would leave without applying.

---

## My Top 10 Issues

1. **06-skeptic-001 (critical)** — Homepage proof counters render as `0+`, `$0M+`, `0+`. The single most damaging thing on the site for a skeptic: your headline evidence is literally zero.
2. **06-skeptic-002 (high)** — No price anywhere. I can't evaluate value or risk if I never learn what it costs.
3. **06-skeptic-014 (high)** — Apply form gives no validation feedback; I can't trust a form that doesn't react.
4. **06-skeptic-015 (high)** — Apply success is a tiny green line, no redirect to the existing thank-you page; I'd assume it failed.
5. **06-skeptic-005 (high)** — A "$10,000 a month" income claim sits in a testimonial with no disclaimer nearby.
6. **06-skeptic-003 (high)** — "Financial freedom / passive income / minimal time investment" framing is textbook overselling.
7. **06-skeptic-008 (high)** — Founder is a first name only ("Mike"), thin credibility for a money decision.
8. **06-skeptic-013 (medium)** — A uniform wall of "5 out of 5 stars" reads as curated.
9. **06-skeptic-017 (medium)** — Broken news image (500 from a Webflow CDN leftover) + "BLOG" vs "NEWS" naming = unfinished site.
10. **06-skeptic-016 (medium)** — No privacy/consent reference at the point I hand over my contact details.
