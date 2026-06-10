# Exploration Log

Base URL: http://localhost:3000
Date: 2026-06-10
Scope: SEO Page Builder only
Pages explored: 8
Journeys executed: 7 (see journeys.md)
Total interactions: 22
Screenshots captured: see screenshots/ (journeys + exploration)
Created artifacts this session: see session-created.json
Skipped destructive actions: 4 (see bottom)

---

## Page: /admin/pages (Pages list)

### Load

- Status: OK
- Screenshot: screenshots/admin-pages-001-load.png (above fold), screenshots/admin-pages-002-full.png (full page)
- Text extract: text/admin-pages-text.md
- Load time: 1446ms (DCL) / 1446ms (load)
- Layout shift (CLS): 0
- Axe violations: 0 across rules [] (details in axe-results.json)

### Interactive inventory

| #   | Element         | Bucket | Text/Label                     | Action Result                              | Screenshot                           |
| --- | --------------- | ------ | ------------------------------ | ------------------------------------------ | ------------------------------------ |
| 1   | details/summary | safe   | Sort dropdown                  | menu opened                                | admin-pages-010-sort-open.png        |
| 2   | link            | safe   | Status filter: Drafts          | filtered view                              | admin-pages-012-filter-drafts.png    |
| 3   | link            | safe   | Status filter: Published       | filtered view                              | admin-pages-012-filter-published.png |
| 4   | link            | safe   | Status filter: Archived        | filtered view                              | admin-pages-012-filter-archived.png  |
| 5   | link            | safe   | Status filter: All             | filtered view                              | admin-pages-012-filter-all.png       |
| 6   | link            | safe   | Workflow filter: Scheduled     | filtered view                              | admin-pages-013-filter-scheduled.png |
| 7   | button          | safe   | Clear search                   | search cleared                             |                                      |
| 8   | details/summary | safe   | Row ⋮ menu (pre-existing page) | menu opened; destructive items NOT clicked | admin-pages-017-row-menu-open.png    |

### Forms

| Form         | Fields | Bucket | Empty Submit               | Invalid Submit                             | Valid Submit           | Screenshots                                                                                                     |
| ------------ | ------ | ------ | -------------------------- | ------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| pages search | search | safe   | submitted (see screenshot) | no-results query → "No matching SEO pages" | query 'test' submitted | admin-pages-014-search-empty-submit.png, admin-pages-015-search-no-results.png, admin-pages-016-search-test.png |

### Responsive

| Viewport | Screenshot             | Issues |
| -------- | ---------------------- | ------ |
| mobile   | admin-pages-mobile.png | OK     |
| tablet   | admin-pages-tablet.png | OK     |

### Console Errors

- none

### Failed Network Requests

- none

---

## Page: /admin/pages/new (Create page (choice gate))

### Load

- Status: Error: locator.click: Timeout 30000ms exceeded.
- Screenshot: screenshots/admin-pages-new-001-load.png (above fold), screenshots/admin-pages-new-002-full.png (full page)
- Text extract: text/admin-pages-new-text.md
- Load time: 349ms (DCL) / 350ms (load)
- Layout shift (CLS): 0
- Axe violations: 1 across rules [landmark-unique(moderate)] (details in axe-results.json)

### Interactive inventory

| #   | Element | Bucket   | Text/Label        | Action Result           | Screenshot                             |
| --- | ------- | -------- | ----------------- | ----------------------- | -------------------------------------- |
| 1   | wizard  | safe     | Step 1: Page type | Resource preselected    | admin-pages-new-001-load.png           |
| 2   | button  | safe     | Continue → Step 2 | starting point step     | admin-pages-new-010-step2.png          |
| 3   | button  | safe     | Back → Step 1     | returned to step 1      | admin-pages-new-011-back-step1.png     |
| 4   | button  | safe     | Continue → Step 3 | ready-to-build step     | admin-pages-new-012-step3.png          |
| 5   | button  | creation | Start building    | editor opened (unsaved) | admin-pages-new-013-editor-unsaved.png |

### Responsive

| Viewport | Screenshot | Issues |
| -------- | ---------- | ------ |

### Console Errors

- none

### Failed Network Requests

- none

---

## Page: /admin/pages/e44f0fc3-0dcf-480f-9c99-f3409c690378 (Page editor (session-created page))

### Load

- Status: OK
- Screenshot: screenshots/admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-001-load.png (above fold), screenshots/admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-002-full.png (full page)
- Text extract: text/admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-text.md
- Load time: 542ms (DCL) / 550ms (load)
- Layout shift (CLS): 0
- Axe violations: 3 across rules [aria-prohibited-attr(serious), landmark-complementary-is-top-level(moderate)] (details in axe-results.json)

### Interactive inventory

| #   | Element         | Bucket | Text/Label                      | Action Result                                                    | Screenshot                                                              |
| --- | --------------- | ------ | ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | button          | safe   | Blocks panel toggle             | sidebar expanded                                                 | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-010-blocks-panel.png   |
| 2   | details/summary | safe   | Share menu                      | menu opened (Copy editor link / Copy public URL)                 | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-011-share-menu.png     |
| 3   | button          | safe   | Add page content (block picker) | picker dialog opened                                             | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-012-block-picker.png   |
| 4   | button          | safe   | Block actions menu              | menu opened (Edit settings / Duplicate content / Remove content) | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-013-block-actions.png  |
| 5   | button          | safe   | Edit settings (block modal)     | settings modal opened                                            | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-014-block-settings.png |
| 6   | section         | safe   | Revision history                | entries visible after publish                                    | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-018-revisions.png      |

### Forms

| Form                | Fields                   | Bucket   | Empty Submit   | Invalid Submit        | Valid Submit      | Screenshots                                                                                                                                               |
| ------------------- | ------------------------ | -------- | -------------- | --------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance comments | blockId (optional), body | creation | see screenshot | n/a (single textarea) | comment submitted | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-016-comment-empty-submit.png, admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-017-comment-submitted.png |

### Responsive

| Viewport | Screenshot                                                  | Issues |
| -------- | ----------------------------------------------------------- | ------ |
| mobile   | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-mobile.png | OK     |
| tablet   | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-tablet.png | OK     |

### Notes

- Block picker types: Hero, Text, Image, CTA, FAQ, Cards, Proof, Video, Form

### Console Errors

- none

### Failed Network Requests

- none

---

## Page: /admin/pages/e44f0fc3-0dcf-480f-9c99-f3409c690378/revisions/7c80faa3-14c9-4f0d-8d2b-af51cb9d7d25 (Revision preview)

### Load

- Status: OK
- Screenshot: screenshots/admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-revisions-7c80faa3-14c9-4f0d-8d2b-af51cb9d7d25-001-load.png (above fold), screenshots/admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-revisions-7c80faa3-14c9-4f0d-8d2b-af51cb9d7d25-002-full.png (full page)
- Text extract: text/admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-revisions-7c80faa3-14c9-4f0d-8d2b-af51cb9d7d25-text.md
- Load time: 576ms (DCL) / 577ms (load)
- Layout shift (CLS): 0
- Axe violations: 3 across rules [landmark-main-is-top-level(moderate), landmark-no-duplicate-main(moderate), landmark-unique(moderate)] (details in axe-results.json)

### Interactive inventory

| #   | Element | Bucket | Text/Label     | Action Result | Screenshot |
| --- | ------- | ------ | -------------- | ------------- | ---------- |
| 1   | link    | safe   | Back to editor | present       |            |

### Responsive

| Viewport | Screenshot                                                                                                 | Issues |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| mobile   | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-revisions-7c80faa3-14c9-4f0d-8d2b-af51cb9d7d25-mobile.png | OK     |
| tablet   | admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-revisions-7c80faa3-14c9-4f0d-8d2b-af51cb9d7d25-tablet.png | OK     |

### Console Errors

- none

### Failed Network Requests

- none

---

## Page: /admin/pages/redirects (Redirects manager)

### Load

- Status: OK
- Screenshot: screenshots/admin-pages-redirects-001-load.png (above fold), screenshots/admin-pages-redirects-002-full.png (full page)
- Text extract: text/admin-pages-redirects-text.md
- Load time: 316ms (DCL) / 317ms (load)
- Layout shift (CLS): 0
- Axe violations: 0 across rules [] (details in axe-results.json)

### Forms

| Form            | Fields                                               | Bucket   | Empty Submit   | Invalid Submit                                 | Valid Submit     | Screenshots                                                                                                                                         |
| --------------- | ---------------------------------------------------- | -------- | -------------- | ---------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create redirect | sourcePath, destinationPath, statusCode, pageId(adv) | creation | see screenshot | error copy: "invalid"; values preserved: false | redirect created | admin-pages-redirects-010-form-empty-submit.png, admin-pages-redirects-011-form-invalid-submit.png, admin-pages-redirects-012-form-valid-submit.png |

### Responsive

| Viewport | Screenshot                       | Issues |
| -------- | -------------------------------- | ------ |
| mobile   | admin-pages-redirects-mobile.png | OK     |
| tablet   | admin-pages-redirects-tablet.png | OK     |

### Notes

- Redirects table has no delete/edit controls — created redirects cannot be removed from this UI.

### Console Errors

- none

### Failed Network Requests

- none

---

## Page: /admin/pages/block-preview-audit (Block preview audit (dev QA))

### Load

- Status: OK
- Screenshot: screenshots/admin-pages-block-preview-audit-001-load.png (above fold), screenshots/admin-pages-block-preview-audit-002-full.png (full page)
- Text extract: text/admin-pages-block-preview-audit-text.md
- Load time: 1446ms (DCL) / 1453ms (load)
- Layout shift (CLS): 0
- Axe violations: 0 across rules [] (details in axe-results.json)

### Responsive

| Viewport | Screenshot                                 | Issues |
| -------- | ------------------------------------------ | ------ |
| mobile   | admin-pages-block-preview-audit-mobile.png | OK     |
| tablet   | admin-pages-block-preview-audit-tablet.png | OK     |

### Notes

- 30 block preview parity cases rendered

### Console Errors

- none

### Failed Network Requests

- none

---

## Page: /resources/ux-seo-review-test-1781071765035 (Published page (public))

### Load

- Status: OK
- Screenshot: screenshots/resources-ux-seo-review-test-1781071765035-001-load.png (above fold), screenshots/resources-ux-seo-review-test-1781071765035-002-full.png (full page)
- Text extract: text/resources-ux-seo-review-test-1781071765035-text.md
- Load time: 761ms (DCL) / 761ms (load)
- Layout shift (CLS): 0
- Axe violations: 0 across rules [] (details in axe-results.json)

### Interactive inventory

| #   | Element    | Bucket | Text/Label      | Action Result | Screenshot                                                    |
| --- | ---------- | ------ | --------------- | ------------- | ------------------------------------------------------------- |
| 1   | link       | safe   | Hero CTA        | href=/about   |                                                               |
| 2   | disclosure | safe   | FAQ item toggle | toggled       | resources-ux-seo-review-test-1781071765035-010-faq-toggle.png |

### Responsive

| Viewport | Screenshot                                            | Issues |
| -------- | ----------------------------------------------------- | ------ |
| mobile   | resources-ux-seo-review-test-1781071765035-mobile.png | OK     |
| tablet   | resources-ux-seo-review-test-1781071765035-tablet.png | OK     |

### Console Errors

- none

### Failed Network Requests

- none

---

## Page: /resources/preview/2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw (Draft preview (token URL))

### Load

- Status: OK
- Screenshot: screenshots/resources-preview-2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw-001-load.png (above fold), screenshots/resources-preview-2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw-002-full.png (full page)
- Text extract: text/resources-preview-2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw-text.md
- Load time: 745ms (DCL) / 746ms (load)
- Layout shift (CLS): 0
- Axe violations: 0 across rules [] (details in axe-results.json)

### Responsive

| Viewport | Screenshot                                                               | Issues |
| -------- | ------------------------------------------------------------------------ | ------ |
| mobile   | resources-preview-2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw-mobile.png | OK     |
| tablet   | resources-preview-2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw-tablet.png | OK     |

### Notes

- Token-based draft preview; checks that draft content renders for reviewers without login.

### Console Errors

- none

### Failed Network Requests

- none

---

## Skipped destructive actions

| Page                                              | Element                               | Target                | Reason                                                               |
| ------------------------------------------------- | ------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| /admin/pages                                      | Duplicate/Publish/Archive in row menu | pre-existing pages    | destructive/creation on pre-existing data                            |
| /admin/pages/e44f0fc3-0dcf-480f-9c99-f3409c690378 | Remove content (block delete)         | session-created block | kept for exploration; destructive flow screenshotted via menu        |
| /admin/pages/e44f0fc3-0dcf-480f-9c99-f3409c690378 | Revoke (preview token)                | session-created token | kept active for preview-page exploration                             |
| /admin/pages/redirects                            | (no delete control exists)            | test redirects        | UI offers no way to delete redirects — cleanup impossible from admin |

## Page: /admin/pages/new — supplementary pass (gate + data-loss test)

- Back button returns to step 1: OK
- Step 3 reached
- Editor opened (unsaved)
- typed into Page title
- Leaving unsaved editor: navigated straight to /admin/pages with NO unsaved-changes warning — typed title silently lost
- Screenshots: admin-pages-new-010-step2.png, admin-pages-new-011-back-step1.png, admin-pages-new-012-step3.png, admin-pages-new-013-editor-unsaved.png, admin-pages-new-014-leave-unsaved.png
- NOTE: the earlier automated pass on this route aborted on a click timeout after the gate; this pass completes the inventory. Initial load/axe/text data in the main /admin/pages/new section remains valid.
