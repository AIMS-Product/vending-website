# Journey re-run (corrected mechanics) — 2026-06-10T00:49:41.026Z

## Journey results: Read a News Article (RE-RUN)

- Status: completed
- Clicks: 3 | Page loads: 4

| #   | Page                                                         | Action                          | Result                                                                                                  | Screenshot                                                            |
| --- | ------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 01  | about:blank                                                  | load homepage                   | homepage loaded                                                                                         | journey-read-a-news-article-r01-01-load-homepage.png                  |
| 02  | /                                                            | navigate to News via nav        | navigated to /news                                                                                      | journey-read-a-news-article-r02-02-navigate-to-news-via-nav.png       |
| 03  | /news                                                        | scroll to reveal article cards  | after scrolling, 3 article link(s) present (cards are scroll-reveal animated — invisible before scroll) | journey-read-a-news-article-r03-03-scroll-to-reveal-article-cards.png |
| 04  | /news                                                        | open first article              | navigated to /news/how-to-choose-the-perfect-location-for-vending-machine                               | journey-read-a-news-article-r04-04-open-first-article.png             |
| 05  | /news/how-to-choose-the-perfect-location-for-vending-machine | verify article content + scroll | article heading: "HOW TO CHOOSE THE PERFECT LOCATION FOR YOUR VENDING MACHINE IN 2025"                  | journey-read-a-news-article-r05-05-verify-article-content-scroll.png  |
| 06  | /news/how-to-choose-the-perfect-location-for-vending-machine | return to news listing          | navigated to /news/how-to-choose-the-perfect-location-for-vending-machine                               | journey-read-a-news-article-r06-06-return-to-news-listing.png         |

### Friction notes

- Article cards on /news render as blank boxes until scrolled into view (scroll-reveal animation); above-the-fold shows 3 empty card outlines.

## Journey results: Evaluate Trust Before Committing (RE-RUN)

- Status: completed
- Clicks: 4 | Page loads: 9

| #   | Page          | Action                        | Result                                                                  | Screenshot                                                      |
| --- | ------------- | ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| 01  | about:blank   | load homepage                 | homepage loaded                                                         | journey-evaluate-trust-r01-01-load-homepage.png                 |
| 02  | /             | navigate to About             | navigated to /about; heading: "MEET MIKE"                               | journey-evaluate-trust-r02-02-navigate-to-about.png             |
| 03  | /about        | back home from About          | home                                                                    | journey-evaluate-trust-r03-03-back-home-from-about.png          |
| 04  | /             | navigate to Case Studies      | navigated to /case-studies; heading: "CASE STUDIES"                     | journey-evaluate-trust-r04-04-navigate-to-case-studies.png      |
| 05  | /case-studies | back home from Case Studies   | home                                                                    | journey-evaluate-trust-r05-05-back-home-from-case-studies.png   |
| 06  | /             | navigate to Privacy Policy    | navigated to /privacy; heading: "PRIVACY POLICY" (link found in footer) | journey-evaluate-trust-r06-06-navigate-to-privacy-policy.png    |
| 07  | /privacy      | back home from Privacy Policy | home                                                                    | journey-evaluate-trust-r07-07-back-home-from-privacy-policy.png |
| 08  | /             | navigate to Terms             | navigated to /terms; heading: "TERMS OF SERVICE" (link found in footer) | journey-evaluate-trust-r08-08-navigate-to-terms.png             |
| 09  | /terms        | back home from Terms          | home                                                                    | journey-evaluate-trust-r09-09-back-home-from-terms.png          |

## Journey results: Admin: Create a News Draft (RE-RUN)

- Status: blocked
- Clicks: 1 | Page loads: 4
- Blocked at: /admin/news/new — FAILED: no visible Save control

| #   | Page            | Action                                                 | Result                                                                                 | Screenshot                                                                          |
| --- | --------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 01  | about:blank     | open /admin                                            | landed on /admin/pages                                                                 | journey-admin-create-news-draft-r01-01-open-admin.png                               |
| 02  | /admin/pages    | look for News in studio nav                            | NO News nav item in sidebar — used direct URL /admin/news to continue testing the flow | journey-admin-create-news-draft-r02-02-look-for-news-in-studio-nav.png              |
| 03  | /admin/news     | click New post                                         | navigated to /admin/news/new                                                           | journey-admin-create-news-draft-r03-03-click-new-post.png                           |
| 04  | /admin/news/new | fill title, slug, content                              | filled: title, slug, textarea                                                          | journey-admin-create-news-draft-r04-04-fill-title-slug-content.png                  |
| 05  | /admin/news/new | save draft (NOT publish)                               | FAILED: no visible Save control                                                        | journey-admin-create-news-draft-r05-05-save-draft-not-publish-.png                  |
| 06  | /admin/news/new | verify draft in news list                              | FAILED: draft not visible in /admin/news list                                          | journey-admin-create-news-draft-r06-06-verify-draft-in-news-list.png                |
| 07  | /admin/news     | delete the created draft (session-created — permitted) | skipped — nothing created                                                              | journey-admin-create-news-draft-r07-07-delete-the-created-draft-session-created.png |

### Wrong turns / dead ends

- Admin sidebar has no News section — only 'SEO pages' and 'Media library' under CONTENT. /admin/news is unreachable from visible UI.

## Journey results: Admin: Create an SEO Page Draft (RE-RUN)

- Status: blocked
- Clicks: 5 | Page loads: 2
- Blocked at: /admin/pages/new — FAILED: locator.click: Timeout 10000ms exceeded.

| #   | Page             | Action                                  | Result                                           | Screenshot                                                                    |
| --- | ---------------- | --------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| 01  | about:blank      | open /admin/pages                       | SEO pages list loaded                            | journey-admin-create-seo-page-r01-01-open-admin-pages.png                     |
| 02  | /admin/pages     | click Create page                       | navigated to /admin/pages/new                    | journey-admin-create-seo-page-r02-02-click-create-page.png                    |
| 03  | /admin/pages/new | wizard step 1: choose page type         | selected 'SEO / Resource page' → Continue        | journey-admin-create-seo-page-r03-03-wizard-step-1-choose-page-type.png       |
| 04  | /admin/pages/new | wizard step 2: starting point + details | filled: no inputs on this step; advanced         | journey-admin-create-seo-page-r04-04-wizard-step-2-starting-point-details.png |
| 05  | /admin/pages/new | wizard step 3: create the page          | clicked "Start building page" → /admin/pages/new | journey-admin-create-seo-page-r05-05-wizard-step-3-create-the-page.png        |
| 06  | /admin/pages/new | editor: add a block + save              | FAILED: locator.click: Timeout 10000ms exceeded. | journey-admin-create-seo-page-r06-06-editor-add-a-block-save.png              |
| 07  | /admin/pages/new | cleanup: archive/delete created page    | nothing created — skip                           | journey-admin-create-seo-page-r07-07-cleanup-archive-delete-created-page.png  |

## Created in re-run

- none

# Journey re-run 2 (admin flows, corrected) — 2026-06-10T00:52:24.239Z

## Journey results: Admin: Create a News Draft (FINAL)

- Status: completed-with-friction
- Clicks: 3 | Page loads: 4

| #   | Page                                                     | Action                                             | Result                                                                                                                 | Screenshot                                                                          |
| --- | -------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 01  | about:blank                                              | open /admin                                        | landed on /admin/pages                                                                                                 | journey-admin-create-news-draft-s01-01-open-admin.png                               |
| 02  | /admin/pages                                             | look for News in studio nav                        | NO News nav item in sidebar — used direct URL /admin/news                                                              | journey-admin-create-news-draft-s02-02-look-for-news-in-studio-nav.png              |
| 03  | /admin/news                                              | click New post                                     | on /admin/news/new — heading "New blog post"                                                                           | journey-admin-create-news-draft-s03-03-click-new-post.png                           |
| 04  | /admin/news/new                                          | fill title, excerpt, body                          | filled: title, excerpt, body                                                                                           | journey-admin-create-news-draft-s04-04-fill-title-excerpt-body.png                  |
| 05  | /admin/news/new                                          | click Save draft (NOT Publish)                     | clicked Save draft → /admin/news/0abc5b3f-0443-45ca-9ee4-f7433a6e150b?saved=1; messages: Edit post / Vendingpreneurs   | journey-admin-create-news-draft-s05-05-click-save-draft-not-publish-.png            |
| 06  | /admin/news/0abc5b3f-0443-45ca-9ee4-f7433a6e150b?saved=1 | verify draft in news list                          | draft visible in list — flow works via direct URL                                                                      | journey-admin-create-news-draft-s06-06-verify-draft-in-news-list.png                |
| 07  | /admin/news                                              | delete created draft (session-created — permitted) | no Delete control found in list row or editor — draft left in place (titled 'UX Review Test', safe to remove manually) | journey-admin-create-news-draft-s07-07-delete-created-draft-session-created-per.png |

### Wrong turns / dead ends

- Admin sidebar has no News/Blog section — only 'SEO pages' and 'Media library'. /admin/news unreachable from visible sidebar UI. (A 'Blog and news' button exists inside the news editor header, but nothing in the studio sidebar.)

### Friction notes

- Create/save/verify works, but ONLY by typing the /admin/news URL directly — the studio sidebar offers no path to it. Editor is titled 'New blog post' under 'Blog CMS' while the route and public nav say 'News'.

## Journey results: Admin: Create an SEO Page Draft (FINAL)

- Status: blocked
- Clicks: 6 | Page loads: 3
- Blocked at: /admin/pages/badc89ea-6257-4819-8d52-6fe342881125 — FAILED: created page not visible in /admin/pages list

| #   | Page                                              | Action                                                             | Result                                                                                                          | Screenshot                                                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 01  | about:blank                                       | open /admin/pages                                                  | SEO pages list loaded                                                                                           | journey-admin-create-seo-page-s01-01-open-admin-pages.png                         |
| 02  | /admin/pages                                      | click Create page                                                  | wizard opened (Step 1 of 3: page type)                                                                          | journey-admin-create-seo-page-s02-02-click-create-page.png                        |
| 03  | /admin/pages/new                                  | wizard: choose type + continue                                     | type selected → step 2 (starting point)                                                                         | journey-admin-create-seo-page-s03-03-wizard-choose-type-continue.png              |
| 04  | /admin/pages/new                                  | wizard: starting point → build                                     | editor state: /admin/pages/new                                                                                  | journey-admin-create-seo-page-s04-04-wizard-starting-point-build.png              |
| 05  | /admin/pages/new                                  | dismiss Quick Tour overlay                                         | no tour overlay this time                                                                                       | journey-admin-create-seo-page-s05-05-dismiss-quick-tour-overlay.png               |
| 06  | /admin/pages/new                                  | fill page title, slug, keyword                                     | filled: page title, slug, target keyword                                                                        | journey-admin-create-seo-page-s06-06-fill-page-title-slug-keyword.png             |
| 07  | /admin/pages/new                                  | add first block                                                    | no add-block affordance visible                                                                                 | journey-admin-create-seo-page-s07-07-add-first-block.png                          |
| 08  | /admin/pages/new                                  | Save draft                                                         | clicked Save draft → /admin/pages/badc89ea-6257-4819-8d52-6fe342881125; alerts: Edit SEO page / Vendingpreneurs | journey-admin-create-seo-page-s08-08-save-draft.png                               |
| 09  | /admin/pages/badc89ea-6257-4819-8d52-6fe342881125 | verify page in list                                                | FAILED: created page not visible in /admin/pages list                                                           | journey-admin-create-seo-page-s09-09-verify-page-in-list.png                      |
| 10  | /admin/pages                                      | cleanup: archive/delete created page (session-created — permitted) | nothing persisted — skip                                                                                        | journey-admin-create-seo-page-s10-10-cleanup-archive-delete-created-page-sess.png |

### Friction notes

- Creation is a 3-step wizard, then a builder editor with a Quick Tour overlay on first open. Editor URL stays at /admin/pages/new while building (no shareable page URL until saved). Publish is gated by 'SEO Blocked' readiness including 'Fix URL slug' until slug filled.

## Created in re-run 2

- news-draft: UX Review Test 1781052712783
