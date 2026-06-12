# Persona Review — Mike, Competitor's User (33)

**Persona**: Project manager, 2 years on the leading competitor, evaluating a switch. Public-site mental model = polished course/coaching "apply" funnels. Admin mental model = WordPress / Webflow / Notion-grade CMS editors.

## Summary

- **Pages reviewed**: 28 (all routes in the exploration log) + 8 journeys
- **Issues found**: 24
- **Blockers**: 2 (News CMS has no sidebar entry; created SEO page list verification raced/unclear + no list-level delete)
- **Overall gut feel**: 3 / 5 — The bones are genuinely competitive: the SEO Page Builder's 3-step create wizard, three-pane editor, readiness gating, and the filterable Media library would not embarrass Webflow. But the content model is split across two disconnected CMSes (SEO pages vs Blog/News) with no nav bridge, list rows have no row actions I'd expect (delete/duplicate/archive), there's no global content search, no bulk operations, and the public apply funnel "succeeds" with a whisper. As a switcher I'd be impressed by the editor and immediately nervous about the missing table-stakes plumbing.

---

## Journey Review

| Journey                  | Score | Could I complete it?              | Where I'd give up                                                                                        |
| ------------------------ | ----- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| discover-and-apply       | 3     | Yes                               | Almost resubmitted — success is a tiny green line; my competitor redirects to a real thank-you page      |
| contact-the-team         | 2     | Only because I guessed the footer | No Contact in the header nav — every funnel I know puts it there or in a sticky CTA                      |
| read-a-news-article      | 3     | Yes                               | "NEWS" in nav vs "BLOG" heading made me think I'd mis-clicked; one article thumbnail is a broken image   |
| evaluate-trust           | 4     | Yes                               | Fine — About/Case Studies in header, legal in footer is the convention                                   |
| pre-call-prep            | 3     | Yes                               | Page is just links; competitor pre-call pages embed the video so I don't bounce to YouTube               |
| admin-create-news-draft  | 2     | Only via typed URL                | No News/Blog item in the studio sidebar — a CMS hiding a whole content type is disqualifying             |
| admin-create-seo-page    | 3     | Yes, with friction                | Quick Tour overlay covered the panel; couldn't confirm the new page in the list without a manual recheck |
| admin-manage-content-ops | 2     | Partially                         | Redirects manager is an orphan route with zero inbound links; Settings only deep-links to Users          |

### Per-journey notes

**discover-and-apply** — The form itself is good: typed selects for state/stage/budget/timeline, clear required markers. But after "SUBMIT APPLICATION" the only feedback is "Thanks. We received your details and will follow up shortly." in small green text beside the button (`journey-discover-and-apply-004-04-submit-continue-round-1-.png`), the form does not clear, and there is no redirect — even though a `/thank-you-for-applying` page exists in the app. Every coaching/application funnel I've used routes to a dedicated confirmation page. The automation itself resubmitted 5 times because the success state was so subtle; a real prospect will too.

**contact-the-team** — Contact lives only in the footer ("CONTACT US"), not in the header nav (`apply-text.md` ARIA: Primary nav = About, Resources, Case Studies, News only). My competitor and essentially every B2B funnel keeps Contact in the header or a persistent CTA. I'd assume there was no way to reach a human.

**read-a-news-article** — Works, but the section is called "NEWS" in the nav and "BLOG" as the page H1 (`news-001-load.png` shows "BLOG"). On a competitor I'd expect one consistent label. The listing also shipped a broken thumbnail (500 on a Webflow CDN image, exploration log /news Console Errors).

**admin-create-news-draft** — Functionally complete (title/excerpt/body, Save draft persists), but the studio sidebar shows only "SEO pages" and "Media library" (`admin-pages-text.md` ARIA navigation "Admin sections"). The entire Blog/News CMS is reachable only by typing `/admin/news`. In WordPress, Posts is a top-level menu item; hiding a content type behind a URL is something I'd flag as broken, not "not built."

**admin-create-seo-page** — The strongest flow. The create wizard (`admin-pages-new-001-load.png`) and three-pane editor (`journey-admin-create-seo-page-r06-06-editor-add-a-block-save.png`) with live preview + SEO readiness/publish gating is genuinely competitive with Webflow's designer. Two things hurt: a "Quick Tour" overlay covers the very panel it points at on first open, and after saving I couldn't cleanly confirm the page in the list (the check raced) — and there's no Delete in the row actions menu.

---

## Page-by-Page Review

### / (home) — gut feel 3/5

Clear value prop above the fold ("TURN VENDING INTO YOUR PATH TO FINANCIAL FREEDOM", `home-001-load.png`), standard hero + CTA. But CLS 0.263 and horizontal scroll on mobile-375 (exploration log) are things a competitor switcher notices immediately.

### /apply — gut feel 3/5

Good form ergonomics; weak success state (see journey note).

### /news — gut feel 2/5

"BLOG" heading vs "NEWS" nav; broken CDN thumbnail (500); cards are scroll-reveal so above-fold can look empty.

### /contact — gut feel 3/5

Form is fine; discoverability is the problem (footer-only).

### /pre-call-resources — gut feel 3/5

14 links, 0 embedded videos (exploration log) — competitor pre-call pages embed media inline.

### /admin/pages — gut feel 3/5

Polished list with status tabs, workflow filters, readiness dots (`admin-pages-001-load.png`). But: row "Actions" is a single "⋮" that didn't expose delete/duplicate to automation; no bulk select; the readiness/status dots are 10×10px unlabeled buttons (exploration log small-target notes); there's a "Schedule failed" filter exposed even though scheduling is barely surfaced.

### /admin/pages/new — gut feel 4/5

Clean, conventional 3-step wizard with progress bar (`admin-pages-new-001-load.png`). Best-in-class moment for this app.

### /admin/media — gut feel 4/5

Filter chips (type, purpose, in-use/unused/needs-metadata), grid/list toggle, Upload (`admin-media-001-load.png`). Competitive with a real DAM. Minor: "Content libraries" is the only path to /admin/libraries (not in sidebar).

### /admin/pages/redirects — gut feel 1/5

Functional redirects manager with **zero inbound links from any explored admin page** (journeys.md sidebar-truth table). Orphan route = looks broken to an evaluator.

### /admin/settings/users — gut feel 3/5

Real RBAC user table (roles, reset, remove, invite). Good for a switcher. But every row action button is 32×32px (exploration log) and /admin/settings itself only redirects to /users — there's no settings home.

---

## Blockers

1. **Blog/News CMS has no studio-sidebar entry** — an entire content type is invisible unless you know the URL (`admin-pages-text.md` ARIA, journey 6). For a CMS this is disqualifying, not a polish item.
2. **No list-level delete/duplicate, and new-page list verification is unreliable** — I cannot confidently manage content from the list view the way I can in WordPress/Webflow (journeys.md SEO-page result, admin-pages "⋮" actions).

---

## My Top 10 Issues

1. Apply success state is a whisper; no redirect to existing `/thank-you-for-applying` (blocker-adjacent for conversion). `journey-discover-and-apply-004`.
2. Blog/News CMS absent from studio sidebar — content type hidden behind a URL. `admin-pages-text.md`.
3. Same content type named four ways: route "News", nav "NEWS", page H1 "BLOG", editor "Blog CMS"/"New blog post". journeys.md.
4. Contact not in header nav — only footer. `apply-text.md` ARIA Primary nav.
5. No row-level delete/duplicate/bulk actions in /admin/pages list. `admin-pages-001-load.png`.
6. Redirects manager is an orphan route (no inbound links). journeys.md sidebar-truth table.
7. Quick Tour overlay covers the panel it describes on first editor open. `journey-admin-create-seo-page-r06`.
8. Broken article thumbnail on /news (500 from Webflow CDN). exploration log /news Console Errors.
9. Home CLS 0.263 + mobile horizontal scroll. exploration log /.
10. No global content search across pages + news; search is per-CMS only. `admin-pages-text.md` ("Search SEO pages").
