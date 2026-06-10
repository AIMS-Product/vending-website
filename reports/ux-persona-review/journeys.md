# Core User Journeys

Derived: 2026-06-10 (no user-supplied journeys; derived from route map, nav structure, and app purpose)
App: Vendingpreneurs — vending-business education/program marketing site + admin content studio

---

## Journey 1: discover-and-apply

- **Name**: Discover & Apply
- **Goal**: A prospective vendingpreneur lands on the homepage, understands what the program is, and submits an application.
- **Entry point**: /
- **Success state**: Application form submitted; user lands on /thank-you-for-applying (or sees clear confirmation).
- **Source**: derived

## Journey 2: contact-the-team

- **Name**: Contact the Team
- **Goal**: A visitor with a question finds the contact page and successfully sends a message.
- **Entry point**: /
- **Success state**: Contact form submitted with visible success confirmation.
- **Source**: derived

## Journey 3: read-a-news-article

- **Name**: Read a News Article
- **Goal**: A visitor browses to the news section, picks an article, and reads it — then can navigate to related content or back.
- **Entry point**: /
- **Success state**: Full article visible; clear path back to listing or to another article.
- **Source**: derived

## Journey 4: evaluate-trust

- **Name**: Evaluate Trust Before Committing
- **Goal**: A skeptical prospect checks who is behind the program (about), proof it works (case studies), and the legal pages (privacy/terms) before deciding to apply.
- **Entry point**: /
- **Success state**: About, case studies, privacy, and terms all reachable from visible navigation, each loading real content.
- **Source**: derived

## Journey 5: pre-call-prep

- **Name**: Pre-Call Resources
- **Goal**: An applicant who booked a call opens the pre-call resources page and consumes the prep material.
- **Entry point**: /pre-call-resources (typically linked from email)
- **Success state**: Resources visible and consumable.
- **Source**: derived

## Journey 6: admin-create-news-draft

- **Name**: Admin: Create a News Draft
- **Goal**: An admin signs into the studio, creates a new news post draft with a title and some content, and saves it.
- **Entry point**: /admin
- **Success state**: New draft visible in the /admin/news list.
- **Source**: derived

## Journey 7: admin-create-seo-page

- **Name**: Admin: Create an SEO Page Draft
- **Goal**: An admin creates a new page in the SEO Page Builder, adds at least one block, and saves the draft.
- **Entry point**: /admin/pages
- **Success state**: New draft page appears in the pages list; editor saves without error.
- **Source**: derived

## Journey 8: admin-manage-content-ops

- **Name**: Admin: Media & Settings Walkthrough
- **Goal**: An admin orients themselves in the studio — media library, libraries, redirects, settings/users. View-only on pre-existing records.
- **Entry point**: /admin/pages
- **Success state**: Each section reachable from admin navigation and renders its content/list state.
- **Source**: derived

---

# Execution Results (FINAL — evidence-verified)

Methodology note: journeys were executed by automation acting as a naive user
(visible affordances only). Where the first run's measurement was wrong
(URL read before navigation settled; scroll-reveal content not scrolled to;
wizard steps not understood), the journey was RE-RUN with corrected mechanics.
Step-level detail for the re-runs is in `journeys-rerun.md`. The verdicts below
are the canonical, evidence-checked results. Database state was independently
verified via the backing store where noted.

## Journey results: Discover & Apply — FINAL

- Status: **completed-with-friction**
- Clicks: 2 (minimal path) | Page loads: 2
- Verified: lead row created in `lead_submissions` on FIRST submit (DB-checked, form_type=apply)

| #   | Page   | Action                                                                              | Result                                                                                                                                                                                      | Screenshot                                                         |
| --- | ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 01  | /      | load homepage                                                                       | homepage loaded                                                                                                                                                                             | journey-discover-and-apply-001-01-load-homepage.png                |
| 02  | /      | click Apply CTA in nav                                                              | navigated to /apply                                                                                                                                                                         | journey-discover-and-apply-002-02-find-and-click-apply-cta.png     |
| 03  | /apply | fill all fields (name, email, phone, city, state, stage, budget, timeline, message) | all filled                                                                                                                                                                                  | journey-discover-and-apply-003-03-fill-visible-fields-round-1-.png |
| 04  | /apply | click "SUBMIT APPLICATION"                                                          | submission SUCCEEDED server-side; small green inline text "Thanks. We received your details and will follow up shortly." appears beside the button; NO redirect, NO page-level confirmation | journey-discover-and-apply-004-04-submit-continue-round-1-.png     |

### Wrong turns / dead ends

- Automation itself missed the success state and re-submitted 5 more times — evidence of how subtle the confirmation is. (Server-side: only ONE lead row was created despite 6 submit clicks, so duplicate suppression works.)

### Friction notes

- The success state is a single small line of green text next to the submit button (`journey-discover-and-apply-004`). The page does not redirect to the existing `/thank-you-for-applying` page, does not clear or disable the form, and shows no prominent confirmation. A user who scrolled or glanced away can easily believe nothing happened and resubmit.
- A dedicated `/thank-you-for-applying` page EXISTS in the app but the apply form does not route to it.

## Journey results: Contact the Team — FINAL

- Status: **blocked (by safety policy, not by the app)**
- Clicks: 1 | Page loads: 2
- Blocked at: /contact submit — sending was skipped per safety policy (outbound email to real recipient). Path up to submit was fully followable.

| #   | Page     | Action             | Result                                                                                   | Screenshot                                                           |
| --- | -------- | ------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 01  | /        | load homepage      | loaded                                                                                   | journey-contact-the-team-001-01-load-homepage.png                    |
| 02  | /        | click Contact link | navigated to /contact (link is in the FOOTER only — "CONTACT US"; not in the header nav) | journey-contact-the-team-002-02-find-and-click-contact-link.png      |
| 03  | /contact | fill form          | filled: full_name, email, phone, city, state_region, message — submission SKIPPED        | journey-contact-the-team-003-03-fill-contact-form-not-submitted-.png |

### Friction notes

- Contact is not in the header navigation; the only paths are the footer link and knowing the URL.

## Journey results: Read a News Article — FINAL (re-run)

- Status: **completed**
- Clicks: 3 | Page loads: 4

| #   | Page    | Action                         | Result                                                                                                                                       | Screenshot                                                            |
| --- | ------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 01  | /       | load homepage                  | loaded                                                                                                                                       | journey-read-a-news-article-r01-01-load-homepage.png                  |
| 02  | /       | click NEWS in nav              | navigated to /news                                                                                                                           | journey-read-a-news-article-r02-02-navigate-to-news-via-nav.png       |
| 03  | /news   | scroll to reveal article cards | article cards are scroll-reveal animated — they render as BLANK card outlines until scrolled into view; 3 article links present after scroll | journey-read-a-news-article-r03-03-scroll-to-reveal-article-cards.png |
| 04  | /news   | open first article             | navigated to /news/how-to-choose-the-perfect-location-for-vending-machine                                                                    | journey-read-a-news-article-r04-04-open-first-article.png             |
| 05  | article | verify content + scroll        | article heading present, full body readable                                                                                                  | journey-read-a-news-article-r05-05-verify-article-content-scroll.png  |
| 06  | article | return to listing              | clicked visible link back to /news                                                                                                           | journey-read-a-news-article-r06-06-return-to-news-listing.png         |

### Friction notes

- Page is headed "BLOG" while the nav item that leads here says "NEWS" and the route is /news. Same section, two names.
- Above-the-fold on /news shows three empty card outlines before any scrolling (see news-001-load.png) — first paint looks broken/unfinished.

## Journey results: Evaluate Trust Before Committing — FINAL (re-run)

- Status: **completed**
- Clicks: 4 | Page loads: 9

| #   | Page | Action                                   | Result                                               | Screenshot                                                   |
| --- | ---- | ---------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| 01  | /    | load homepage                            | loaded                                               | journey-evaluate-trust-r01-01-load-homepage.png              |
| 02  | /    | navigate to About (header nav)           | /about loads; heading "MEET THE FOUNDER / MEET MIKE" | journey-evaluate-trust-r02-02-navigate-to-about.png          |
| 03  | /    | navigate to Case Studies (header nav)    | /case-studies loads with real content                | journey-evaluate-trust-r04-04-navigate-to-case-studies.png   |
| 04  | /    | navigate to Privacy Policy (footer link) | /privacy loads                                       | journey-evaluate-trust-r06-06-navigate-to-privacy-policy.png |
| 05  | /    | navigate to Terms (footer link)          | /terms loads                                         | journey-evaluate-trust-r08-08-navigate-to-terms.png          |

### Friction notes

- Privacy and Terms are reachable only from the footer (standard pattern, acceptable).

## Journey results: Pre-Call Resources — FINAL

- Status: **completed**
- Clicks: 0 | Page loads: 1

| #   | Page                | Action                  | Result                                                   | Screenshot                                                                |
| --- | ------------------- | ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| 01  | /pre-call-resources | open (email-link entry) | loads; heading "PREPARE FOR YOUR VENDING STRATEGY CALL." | journey-pre-call-prep-001-01-open-pre-call-resources-email-link-entry.png |
| 02  | /pre-call-resources | scroll through          | 0 embedded videos/iframes, 14 visible links              | journey-pre-call-prep-002-02-scroll-through-resources.png                 |

## Journey results: Admin: Create a News Draft — FINAL (re-run)

- Status: **completed-with-friction**
- Clicks: 3 | Page loads: 4
- Verified: draft persisted (DB-checked), then archived via the editor's Archive control during cleanup.

| #   | Page            | Action                      | Result                                                                                                                                        | Screenshot                                                                                                   |
| --- | --------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 01  | /admin          | open studio                 | redirects to /admin/pages                                                                                                                     | journey-admin-create-news-draft-s01-01-open-admin.png                                                        |
| 02  | /admin/pages    | look for News in studio nav | **NO News/Blog item in the sidebar** — sidebar offers only "SEO pages", "Media library", and "Settings". Continued via direct URL /admin/news | journey-admin-create-news-draft-s02-02-look-for-news-in-studio-nav.png                                       |
| 03  | /admin/news     | click New post              | /admin/news/new — page is headed "New blog post" under breadcrumb "Blog CMS"                                                                  | journey-admin-create-news-draft-s03-03-click-new-post.png                                                    |
| 04  | /admin/news/new | fill title, excerpt, body   | filled                                                                                                                                        | journey-admin-create-news-draft-s04-04-fill-title-excerpt-body.png                                           |
| 05  | /admin/news/new | click "Save draft"          | saved → redirected to /admin/news/{id}?saved=1                                                                                                | journey-admin-create-news-draft-s05-05-click-save-draft-not-publish-.png                                     |
| 06  | /admin/news     | verify draft in list        | draft visible in list                                                                                                                         | journey-admin-create-news-draft-s06-06-verify-draft-in-news-list.png                                         |
| 07  | /admin/news     | delete from LIST            | **no delete control in the list row**; the EDITOR has an Archive button (used for cleanup — worked with the flow ending in archived state)    | journey-admin-create-news-draft-s07-07-delete-created-draft-session-created-per.png, cleanup-news-editor.png |

### Wrong turns / dead ends

- Admin sidebar has no News/Blog section. /admin/news is unreachable from visible studio UI — an admin must know the URL.

### Friction notes

- Naming is inconsistent across the same content type: sidebar-less section is "News" in the route, "Blog CMS"/"New blog post" in the editor, "NEWS" in public nav, "BLOG" as the public page heading.
- List rows offer no destructive/archive affordance; archiving requires opening each post's editor.

## Journey results: Admin: Create an SEO Page Draft — FINAL (re-run, list-verification corrected by screenshot + DB)

- Status: **completed-with-friction**
- Clicks: 6 | Page loads: 3
- Verified: page persisted as draft `/resources/ux-review-test-1781052712783` (DB-checked); it appears at the top of the /admin/pages list (screenshot journey-admin-create-seo-page-s09 — the automated list check raced, the page IS in the list).

| #   | Page             | Action                                  | Result                                                                                                                                                                                                                                                                                                                                                      | Screenshot                                                                                                                             |
| --- | ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | /admin/pages     | open list                               | loaded                                                                                                                                                                                                                                                                                                                                                      | journey-admin-create-seo-page-s01-01-open-admin-pages.png                                                                              |
| 02  | /admin/pages     | click "Create page"                     | 3-step wizard opens (Page type → Starting point → Ready to build)                                                                                                                                                                                                                                                                                           | journey-admin-create-seo-page-s02-02-click-create-page.png                                                                             |
| 03  | /admin/pages/new | choose "SEO / Resource page" → Continue | step 2                                                                                                                                                                                                                                                                                                                                                      | journey-admin-create-seo-page-s03-03-wizard-choose-type-continue.png                                                                   |
| 04  | /admin/pages/new | continue → "Start building page"        | builder editor opens IN PLACE (URL stays /admin/pages/new until saved). On FIRST open a "Quick Tour" overlay (Step 1 of 3) covers the outline panel and blocks interaction until dismissed                                                                                                                                                                  | journey-admin-create-seo-page-s04-04-wizard-starting-point-build.png, journey-admin-create-seo-page-r06-06-editor-add-a-block-save.png |
| 05  | editor           | fill Page title, Slug, Target keyword   | filled; publish remains gated: "PUBLISH STATUS draft — Fix SEO title" / "Fix URL slug" readiness warnings until fields completed                                                                                                                                                                                                                            | journey-admin-create-seo-page-s06-06-fill-page-title-slug-keyword.png                                                                  |
| 06  | editor           | add first block                         | "Add your first block" affordance was inconsistently clickable for automation across runs (tour overlay; panel state). Block picker did open on one run                                                                                                                                                                                                     | journey-admin-create-seo-page-s07-07-add-first-block.png                                                                               |
| 07  | editor           | click "Save draft"                      | saved → redirected to /admin/pages/{id}                                                                                                                                                                                                                                                                                                                     | journey-admin-create-seo-page-s08-08-save-draft.png                                                                                    |
| 08  | /admin/pages     | verify in list                          | page present at top of list (see screenshot)                                                                                                                                                                                                                                                                                                                | journey-admin-create-seo-page-s09-09-verify-page-in-list.png                                                                           |
| 09  | /admin/pages     | cleanup attempt                         | row "⋮" actions menu did not expose Archive/Delete items to automation; the page EDITOR has no Archive control either (visible editor buttons: Blocks, Save draft, Live preview, SEO, Add page content, Publish, Open SEO settings, Add CTA, AI, Refresh libraries, Create preview link, Add comment). **Test page left in place as a clearly-named draft** | cleanup-seo-row-menu.png                                                                                                               |

### Friction notes

- The builder editor offers no archive/delete path that automation could find — unclear where page retirement lives (the list shows 2 "Archived" pages, so a path exists somewhere).
- Quick Tour overlay on first editor open blocks the panel it points at.
- NOTE FOR CLEANUP: draft "UX Review Test Page 1781052712783" (/resources/ux-review-test-1781052712783) remains in /admin/pages — safe to archive manually.

## Journey results: Admin: Media & Settings Walkthrough — FINAL (corrected against ARIA extracts)

- Status: **completed-with-friction**

Sidebar truth (from ARIA snapshots of every admin page): the studio sidebar contains exactly —
"SEO pages" (/admin/pages), "Media library" (/admin/media), and "Settings : Users and access" (/admin/settings/users), plus "Sign out".

| Section       | Reachable from visible UI?                                                                                                    | Evidence                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Media library | YES — sidebar                                                                                                                 | text/admin-media-text.md ARIA                                     |
| Libraries     | INDIRECT ONLY — a "Content libraries" link in the Media library page header; nothing in sidebar                               | text/admin-media-text.md ("Content libraries" → /admin/libraries) |
| Redirects     | **NO PATH FOUND** — /admin/pages/redirects is not linked from any explored admin page (zero links to it in all ARIA extracts) | grep across text/admin-\*.md                                      |
| News/Blog CMS | **NO PATH FOUND** from sidebar (see Journey 6)                                                                                | journey-admin-create-news-draft-s02                               |
| Settings      | YES — sidebar, but it deep-links to /admin/settings/users; /admin/settings itself is only reachable by URL                    | ARIA extracts                                                     |
| Users         | YES — via Settings sidebar link                                                                                               | admin-settings-users screenshots                                  |

### Wrong turns / dead ends

- Redirects manager and News CMS are orphaned routes — functional pages with no inbound navigation.
- Block-preview-audit (/admin/pages/block-preview-audit) is likewise only reachable by URL (internal tool, may be intentional).
