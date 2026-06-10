# Persona Review — Victoria, Executive With 30 Seconds (55)

**Lens:** Can I grasp value/status in a glance, above the fold, without scrolling or
clicking? Is the most important information surfaced and scannable? I do not read
paragraphs and I do not hunt.

## Summary

- Pages reviewed: 22 (all public + admin routes in the exploration log)
- Issues found: 14
- Blockers: 0
- Overall gut feel: **3.5 / 5** — The admin studio is genuinely excellent for an
  executive (every list page opens with a 4-card status summary I can read in two
  seconds). The public marketing site is mostly clear above the fold, but the
  homepage's single most persuasive element — the proof-stat counters — reads as
  literally "0+ / $0M+ / 0+" in a glance, which is worse than showing nothing.

My world is the above-the-fold frame and the scannable dashboard. On that axis the
back office beats the storefront: the SEO pages, Blog, Media, and Users screens all
lead with big numeric KPI cards exactly the way I want. The storefront undermines
itself with zeroed credibility numbers and colored status dots that carry no legend.

---

## Journey Review

| Journey                  | Score | Could I complete it?                                                                                                                               | Where I'd give up                                                                                   |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Discover & Apply         | 3/5   | Yes, but the "done" signal is a tiny green line of text next to the button — I would not register it in a glance and would assume nothing happened | At the success state: I scan, see the form still full, and move on thinking it failed               |
| Contact the Team         | 3/5   | Yes if I know the URL; Contact is footer-only, not in the header                                                                                   | I'd look at the top nav for "Contact", not find it, and stop                                        |
| Read a News Article      | 3/5   | Yes, but the listing's above-fold shows empty/broken card thumbnails and is titled "BLOG" while I clicked "NEWS"                                   | First glance at /news looks half-loaded; I'd question whether the site is maintained                |
| Evaluate Trust           | 4/5   | Yes — About, Case Studies, Privacy, Terms all reachable and real                                                                                   | Minor: the homepage proof stats read as zero, which weakens the trust case                          |
| Pre-Call Resources       | 4/5   | Yes — heading and intent are clear above the fold                                                                                                  | No real friction for my glance test                                                                 |
| Admin: Create News Draft | 3/5   | Yes, but only by URL — there is no News item in the studio sidebar                                                                                 | I'd scan the sidebar, see only "SEO pages / Media library / Settings", and conclude news isn't here |
| Admin: Create SEO Page   | 3/5   | Yes — the 3-step wizard is clean and scannable                                                                                                     | A first-run "Quick Tour" overlay covers the panel; as an exec I'd dismiss it blindly                |
| Admin: Media & Settings  | 4/5   | Yes for Media/Settings/Users via sidebar; Redirects has no inbound link                                                                            | I'd never find Redirects — it's an orphaned route                                                   |

### Per-journey notes

- **Discover & Apply**: The form above the fold is clear and the value prop ("APPLY TO
  BUILD YOUR VENDING BUSINESS WITH MIKE.") is unmistakable. The failure is the success
  state. Per `journey-discover-and-apply-004-04-submit-continue-round-1-.png` the only
  confirmation is small green text — "Thanks. We received your details and will follow
  up shortly." — beside an unchanged, still-populated form. Even the automation missed
  it and re-submitted five times. I glance, see no obvious change, and leave unsure.

- **Read a News Article**: The above-fold of /news (`news-001-load.png`) shows three
  card outlines where two thumbnails are blank and one renders raw alt text instead of
  an image. The console log confirms a 500 on the article image. First paint looks
  broken to a glancer.

- **Admin journeys**: Once I'm on an admin list page, the experience is exactly right
  for me — see the KPI cards finding below. The friction is navigation discoverability
  (News and Redirects are not in the sidebar), not scannability.

---

## Page-by-Page Review (above-the-fold focus)

### / (home) — 2.5/5

Strong, legible hero value prop above the fold (`home-001-load.png`). But the proof
block renders "0+ / $0M+ / 0+" (`home-002-full.png`, text extract lines 23-28). For my
glance test this is the worst possible outcome on the most important persuasion element.

| #   | Category          | Finding                                                                                                             | Evidence                                                                                  | Severity |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| 001 | Visual & Layout   | Credibility counters read "0+", "$0M+", "0+" in the captured frame — proof stats appear to be zero at a glance      | `home-002-full.png`; text extract lines 23-28: "0+ / ENTREPRENEURS LAUNCHED / $0M+ / ..." | high     |
| 002 | Visual & Layout   | Homepage above-fold renders at a cramped, downscaled width vs other pages — header nav is squeezed and CLS is 0.263 | `home-001-load.png`; exploration-log: "Layout shift (CLS): 0.263"                         | medium   |
| 003 | Navigation & Flow | Contact is not in the header nav — only in the footer                                                               | text extract lines 5-8 (header: ABOUT/RESOURCES/CASE STUDIES/NEWS, no Contact)            | medium   |

### /apply — 4/5

Hero and form both legible above the fold (`apply-001-load.png`). Confirmation is the
problem, not the page intent.

| #   | Category         | Finding                                                                                                  | Evidence                                                                                                                                                                       | Severity |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 004 | Feedback & State | Submit success is a tiny inline green line, no banner/redirect, form stays full — invisible to a glancer | `journey-discover-and-apply-004-04-submit-continue-round-1-.png` ("Thanks. We received your details and will follow up shortly."); journeys.md Discover & Apply friction notes | high     |

### /news — 2.5/5

| #   | Category        | Finding                                                                                            | Evidence                                                                                                  | Severity |
| --- | --------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| 005 | Visual & Layout | Above-fold article cards show blank/broken thumbnails (one shows raw alt text) — looks half-loaded | `news-001-load.png`; exploration-log /news Console Errors: "500 (Internal Server Error)" on /\_next/image | high     |
| 006 | Copy & Labels   | Page heading is "BLOG" but the nav item and route are "NEWS" — same section, two names             | text extract line 13 ("BLOG") vs line 8 ("NEWS")                                                          | medium   |

### /case-studies — 4/5

Clear above-fold ("CASE STUDIES", "REAL PEOPLE, REAL ROUTES") with video thumbnails
visible (`case-studies-001-load.png`). Good for a glance.

| #   | Category        | Finding                                   | Evidence                                                              | Severity |
| --- | --------------- | ----------------------------------------- | --------------------------------------------------------------------- | -------- |
| 007 | Visual & Layout | Horizontal scroll present at mobile width | exploration-log /case-studies Responsive: "horizontal scroll present" | low      |

### /contact — 4/5

Form and intent legible above the fold (`contact-001-load.png`). Only the
discoverability of the page (finding 003) detracts.

### /pre-call-resources — 4/5

Heading "PREPARE FOR YOUR VENDING STRATEGY CALL." and intent are clear above the fold
(`pre-call-resources-001-load.png`). No glance-test friction.

### /thank-you-for-applying — 4/5

Clear, scannable confirmation page ("THANKS FOR APPLYING.", 3 next-step cards)
(`thank-you-for-applying-001-load.png`).

| #   | Category          | Finding                                                                                                                                                                | Evidence                                                                                                                                           | Severity |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 008 | Navigation & Flow | This well-designed confirmation page exists but the apply form never routes to it — the clear success page is orphaned while the real flow shows the buried green text | `thank-you-for-applying-001-load.png`; journeys.md ("A dedicated /thank-you-for-applying page EXISTS ... but the apply form does not route to it") | high     |

### /admin/pages — 5/5

This is exactly what I want: a 4-card KPI strip (All 4 / Drafts 4 / Published 0 /
Archived 2) I read in two seconds (`admin-pages-001-load.png`).

| #   | Category         | Finding                                                                                                                                  | Evidence                                                                                                                                 | Severity |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 009 | Visual & Layout  | Readiness and Status columns are bare colored dots (red/blue/amber) with no visible legend — I can't tell what a color means at a glance | `admin-pages-001-load.png`; text extract ARIA: buttons "SEO readiness: Blocked / Opportunities / Needs work" carry meaning only on hover | medium   |
| 010 | Feedback & State | A "Schedule failed" filter/state is surfaced but its meaning/severity isn't summarized in the KPI cards                                  | exploration-log /admin/pages skips: a "Schedule failed"; text extract line 68                                                            | low      |

### /admin/news — 5/5

Excellent KPI strip (Total 32 / Drafts 0 / Published 3 / Archived 29) plus a clear
status column with text labels — better than the SEO pages dots
(`admin-news-001-load.png`).

| #   | Category          | Finding                                                                                                              | Evidence                                                                              | Severity |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| 011 | Navigation & Flow | "Blog and news" lives under breadcrumb "Blog CMS" with no sidebar entry — I'd never reach it by scanning the sidebar | `admin-news-001-load.png`; journeys.md Journey 6 ("NO News/Blog item in the sidebar") | medium   |

### /admin/media — 4/5

Clear scannable filter chips with counts (All assets 1 / In use 0 / Unused 1 / Needs
metadata 1) (`admin-media-001-load.png`). Good at a glance.

### /admin/settings/users — 5/5

Best status view on the site for my lens: KPI cards (Active 6 / Pending 1 / Super
admins 3 / Admins 4) plus a status column with text pills ("Active", "Pending setup")
(`admin-settings-users-001-load.png`).

### /admin/pages/new — 4/5

Clean, scannable 3-step wizard with a clear progress bar and labeled page-type cards
(`admin-pages-new-001-load.png`).

| #   | Category         | Finding                                                                                                         | Evidence                                                                                                                       | Severity |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 012 | Feedback & State | On first open the builder shows a "Quick Tour" overlay that covers the panel it points at, blocking interaction | journeys.md Journey 7 ("a 'Quick Tour' overlay (Step 1 of 3) covers the outline panel and blocks interaction until dismissed") | low      |

### /admin/pages/redirects — 3/5

| #   | Category          | Finding                                                                                   | Evidence                                                                                        | Severity |
| --- | ----------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| 013 | Navigation & Flow | Redirects manager has zero inbound links from any explored admin page — an orphaned route | journeys.md Journey 8 ("Redirects ... NO PATH FOUND ... zero links to it in all ARIA extracts") | medium   |

### Cross-cutting

| #   | Category      | Finding                                                                                                                                                            | Evidence                                                                  | Severity |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | -------- |
| 014 | Copy & Labels | Same content type is named four ways: route "News", public heading "BLOG", editor "Blog CMS"/"New blog post", nav "NEWS" — inconsistent identity slows recognition | journeys.md Journey 6 friction notes; news text extract line 13 vs line 8 | medium   |

---

## Blockers

None. Every page loads and core journeys are completable. My concerns are
glanceability and credibility, not broken functionality.

---

## My Top 10 Issues

1. **Homepage proof stats read as "0+ / $0M+ / 0+"** (001) — the most persuasive
   block on the site shows zero at a glance. For an exec scanning for proof, this is
   worse than omitting it.
2. **Apply success is invisible at a glance** (004) — tiny green text, no banner, form
   stays full; I'd assume it failed.
3. **/news above-fold looks broken** (005) — blank/raw-alt-text thumbnails from a 500
   image error; first paint reads as unfinished.
4. **A clean "Thanks for applying" page exists but is never used** (008) — the good
   confirmation is orphaned while the real flow buries the signal.
5. **SEO pages status/readiness shown as legend-less colored dots** (009) — I see
   color but can't decode it without hovering each row.
6. **News CMS is unreachable from the studio sidebar** (011) — only via URL.
7. **Same content type named four different ways** (014) — News/Blog/Blog CMS slows
   recognition.
8. **Contact missing from header nav** (003) — footer-only is non-obvious to a scanner.
9. **Homepage renders cramped/downscaled with CLS 0.263** (002) — layout instability
   undercuts a confident first impression.
10. **Redirects manager is an orphaned route** (013) — functional but unfindable.
