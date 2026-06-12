# Exploration Log — Page Builder

Base URL: http://localhost:3000
Date: 2026-06-04
Scope: SEO Page Builder (`/admin/pages/*`)
Auth: explored with ADMIN_DEV_AUTH_BYPASS=1 (super_admin)
Pages explored: 6

> Screenshots live in `screenshots/`. Each page has `load` (full-page desktop),
> `mobile` (375px), `tablet` (768px), plus interaction shots. Read the images with
> the Read tool — visual assessment is required.

---

## Page: /admin/pages (Pages List)

### Load

- HTTP status: 200 (OK)
- Load screenshot: screenshots/pages-list-001-load.png
- Console errors: none
- Failed network requests: none

### Page structure

- Headings: H2:"Studio", H1:"SEO pages"
- Element counts: 6 buttons, 27 links, 1 inputs

### Buttons (visible)

| Label            | Disabled |
| ---------------- | -------- |
| Collapse sidebar |          |
| Sign out         |          |
| Search           |          |
| Duplicate page   |          |
| Publish page     |          |
| Archive page     |          |

### Inputs / form fields

| Type | Name | Label/Placeholder | Required |
| ---- | ---- | ----------------- | -------- |
| text | q    | Search SEO pages  |          |

### Links

| Text                                    | Href                                              |
| --------------------------------------- | ------------------------------------------------- |
| SEO pages: SEO page content             | /admin/pages                                      |
| Media library: Images and source assets | /admin/media                                      |
| Settings: Users and access              | /admin/settings/users                             |
| Authors                                 | /admin/pages/authors                              |
| Redirects                               | /admin/pages/redirects                            |
| New SEO page                            | /admin/pages/new                                  |
| All1drafts + published                  | /admin/pages                                      |
| Drafts1needs work                       | /admin/pages?status=draft                         |
| Published0publicly visible              | /admin/pages?status=published                     |
| Archived5retired                        | /admin/pages?status=archived                      |
| All                                     | /admin/pages                                      |
| Drafts                                  | /admin/pages?status=draft                         |
| Published                               | /admin/pages?status=published                     |
| Archived                                | /admin/pages?status=archived                      |
| Updated newest                          | /admin/pages                                      |
| Updated oldest                          | /admin/pages?sort=updated-asc                     |
| Published newest                        | /admin/pages?sort=published-desc                  |
| Title A-Z                               | /admin/pages?sort=title-asc                       |
| All metadata                            | /admin/pages                                      |
| Needs review                            | /admin/pages?view=needs-review                    |
| Updating                                | /admin/pages?view=updating                        |
| Needs links                             | /admin/pages?view=orphaned                        |
| Metadata issues                         | /admin/pages?view=metadata-issues                 |
| Scheduled                               | /admin/pages?view=scheduled                       |
| Schedule failed                         | /admin/pages?view=schedule-failed                 |
| Vending in Colleges                     | /admin/pages/f7eb8024-bbba-42d9-8b13-932e337f7e32 |
| Edit page                               | /admin/pages/f7eb8024-bbba-42d9-8b13-932e337f7e32 |

### Interactions performed (safe)

_No safe click interactions recorded (page is view/selection-oriented or interactions navigated away)._

### Skipped (destructive / external)

| Element  | Reason                                           |
| -------- | ------------------------------------------------ |
| Sign out | destructive/external — screenshotted not clicked |
| Sign out | destructive/external — screenshotted not clicked |

### Responsive

| Viewport       | Screenshot                            |
| -------------- | ------------------------------------- |
| Mobile (375px) | screenshots/pages-list-002-mobile.png |
| Tablet (768px) | screenshots/pages-list-003-tablet.png |

---

## Page: /admin/pages/new (Create New Page)

### Load

- HTTP status: 200 (OK)
- Load screenshot: screenshots/pages-new-004-load.png
- Console errors: none
- Failed network requests: none
- Notes: Form filled with test data; submission intentionally NOT performed to avoid creating orphan seed pages (creation flow reviewed visually).

### Page structure

- Headings: H1:"New SEO page", H2:"Create page", H3:"Page type", H3:"Starting point"
- Element counts: 9 buttons, 0 links, 0 inputs

### Buttons (visible)

| Label                                                                         | Disabled |
| ----------------------------------------------------------------------------- | -------- |
| SEO / Resource pageLong-form search page for resources, guides, and services. |          |
| Blog pageArticle-style page with a strong introduction and CTA.               |          |
| Landing pageCampaign page for a focused offer or conversion path.             |          |
| Video pageVideo-led page with supporting copy and conversion blocks.          |          |
| Blank pageStart with an empty editable canvas.                                |          |
| Resource defaultHero, supporting copy, proof, FAQ, and CTA.                   |          |
| Start building                                                                |          |
| From templateComing soonUse a team-approved saved template.                   | yes      |
| AI-assisted templateComing soonUse an approved template from the SEO agent.   | yes      |

### Interactions performed (safe)

_No safe click interactions recorded (page is view/selection-oriented or interactions navigated away)._

### Responsive

| Viewport       | Screenshot                           |
| -------------- | ------------------------------------ |
| Mobile (375px) | screenshots/pages-new-006-mobile.png |
| Tablet (768px) | screenshots/pages-new-007-tablet.png |

---

## Page: /admin/pages/f7eb8024-bbba-42d9-8b13-932e337f7e32 (Page Builder Editor)

### Load

- HTTP status: 200 (OK)
- Load screenshot: screenshots/pages-editor-008-load.png
- Console errors: none
- Failed network requests: none

### Page structure

- Headings: H1:"Edit SEO page", H2:"Page structure", H3:"Builder outline", H2:"Readiness and publish", H3:"Ready to publish", H3:"Search Preview", H3:"Action Items", H3:"Builder support", H2:"Revision history", H2:"Draft preview", H2:"Governance comments"
- Element counts: 82 buttons, 5 links, 58 inputs

### Buttons (visible)

| Label                                                                            | Disabled |
| -------------------------------------------------------------------------------- | -------- |
| Collapse blocks sidebar                                                          |          |
| Save draft                                                                       |          |
| Live preview                                                                     |          |
| Copy editor linkEditor link                                                      |          |
| Copy public URLPublic URL                                                        |          |
| Collapse SEO sidebar                                                             |          |
| Hero1. Vending in Colleges That Works Around Campus LifeSection 1, column 1      |          |
| Edit Hero settings                                                               |          |
| Rich text2. Campus image placeholderSection 1, column 1                          |          |
| Edit Rich text settings                                                          |          |
| Rich text3. A smarter way to serve your campus communitySection 2, column 1      |          |
| Edit Rich text settings                                                          |          |
| Card grid4. Vending options for collegesSection 3, column 1                      |          |
| Edit Card grid settings                                                          |          |
| Rich text5. Designed around your site, students, and scheduleSection 4, column 1 |          |
| Edit Rich text settings                                                          |          |
| FAQ6. Vending in colleges: FAQsSection 5, column 1                               |          |
| Edit FAQ settings                                                                |          |
| CTA7. Book a vending consultationSection 6, column 1                             |          |
| Edit CTA settings                                                                |          |
| Move section 1                                                                   |          |
| Section and block actions                                                        |          |
| Hide eyebrow                                                                     |          |
| Hide body                                                                        |          |
| Hide cta                                                                         |          |
| Move Page content 2                                                              |          |
| Block actions                                                                    |          |
| Show eyebrow                                                                     |          |
| Hide heading                                                                     |          |
| Add page content                                                                 |          |
| Move section 2                                                                   |          |
| Section and block actions                                                        |          |
| Show eyebrow                                                                     |          |
| Hide heading                                                                     |          |
| Add page content                                                                 |          |
| Move section 3                                                                   |          |
| Section and block actions                                                        |          |
| Hide heading                                                                     |          |
| Up                                                                               | yes      |
| Down                                                                             |          |
| Remove                                                                           |          |
| Edit optional link for card 1                                                    |          |
| Up                                                                               |          |
| Down                                                                             |          |
| Remove                                                                           |          |
| Edit optional link for card 2                                                    |          |
| Up                                                                               |          |
| Down                                                                             |          |
| Remove                                                                           |          |
| Edit optional link for card 3                                                    |          |
| Up                                                                               |          |
| Down                                                                             | yes      |
| Remove                                                                           |          |
| Edit optional link for card 4                                                    |          |
| Add card                                                                         |          |
| Add page content                                                                 |          |
| Move section 4                                                                   |          |
| Section and block actions                                                        |          |
| Show eyebrow                                                                     |          |
| Hide heading                                                                     |          |
| …and 22 more                                                                     |          |

### Inputs / form fields

| Type           | Name                                 | Label/Placeholder                 | Required |
| -------------- | ------------------------------------ | --------------------------------- | -------- |
| checkbox       |                                      | Show header                       |          |
| checkbox       |                                      | Show footer                       |          |
| text           |                                      | Eyebrow                           |          |
| textarea       |                                      | Heading                           |          |
| textarea       | block_1780293223024_84211c-hero-body | Body                              |          |
| text           |                                      | CTA label                         |          |
| text           |                                      | Eyebrow                           |          |
| text           |                                      | Heading                           |          |
| textarea       |                                      | Body                              |          |
| text           |                                      | Eyebrow                           |          |
| text           |                                      | Heading                           |          |
| textarea       |                                      | Body                              |          |
| text           |                                      | Heading                           |          |
| text           |                                      | Card title                        |          |
| textarea       |                                      | Card body                         |          |
| text           |                                      | Card title                        |          |
| textarea       |                                      | Card body                         |          |
| text           |                                      | Card title                        |          |
| textarea       |                                      | Card body                         |          |
| text           |                                      | Card title                        |          |
| textarea       |                                      | Card body                         |          |
| text           |                                      | Eyebrow                           |          |
| text           |                                      | Heading                           |          |
| textarea       |                                      | Body                              |          |
| text           |                                      | Heading                           |          |
| text           |                                      | Question                          |          |
| textarea       |                                      | Answer                            |          |
| text           |                                      | Question                          |          |
| textarea       |                                      | Answer                            |          |
| text           |                                      | Question                          |          |
| textarea       |                                      | Answer                            |          |
| text           |                                      | Question                          |          |
| textarea       |                                      | Answer                            |          |
| text           |                                      | CTA label                         |          |
| text           | title                                | Page title                        | yes      |
| select         | routePrefix                          | Route prefix                      |          |
| text           | slug                                 | Slug                              | yes      |
| text           | targetKeyword                        | Target keyword                    |          |
| text           | seoTitle                             | SEO title                         |          |
| textarea       | metaDescription                      | Meta description                  |          |
| text           | canonicalUrl                         | Preferred URL                     |          |
| checkbox       | noindex                              | Hide from search engines          |          |
| checkbox       | sitemapEnabled                       | Include in sitemap                |          |
| checkbox       | structuredDataBreadcrumb             | Breadcrumb trail                  |          |
| checkbox       | structuredDataFaq                    | Visible FAQs                      |          |
| text           | internalTags                         | Internal tags                     |          |
| text           | topicCluster                         | Topic cluster                     |          |
| text           | campaignLabel                        | Campaign                          |          |
| text           | funnelStage                          | Funnel stage                      |          |
| select         | lifecycleStatus                      | Lifecycle                         |          |
| select         | reviewPeriodMonths                   | Review period                     |          |
| date           | nextReviewAt                         | Next review                       |          |
| text           | ogTitle                              | Social title                      |          |
| textarea       | ogDescription                        | Social description                |          |
| datetime-local | scheduledPublishAt                   | Scheduled publish                 |          |
| textarea       | publishNote                          | Optional summary for this version |          |
| text           | blockId                              | Optional block ID                 |          |
| textarea       | body                                 | Add an internal note              | yes      |

### Links

| Text                    | Href             |
| ----------------------- | ---------------- |
| Pages                   | /admin/pages     |
| Go back to dashboard    | /admin/pages     |
| Step inside             | /apply           |
| Open full media library | /admin/media     |
| Open content libraries  | /admin/libraries |

### Interactions performed (safe)

| Element clicked             | Result  | Screenshot                                                      |
| --------------------------- | ------- | --------------------------------------------------------------- |
| Blocks                      | clicked | screenshots/pages-editor-009-click-blocks.png                   |
| Save draft                  | clicked | screenshots/pages-editor-010-click-save-draft.png               |
| Live preview                | clicked | screenshots/pages-editor-011-click-live-preview.png             |
| Copy editor linkEditor link | clicked | screenshots/pages-editor-012-click-copy-editor-linkeditor-l.png |
| Copy public URLPublic URL   | clicked | screenshots/pages-editor-013-click-copy-public-urlpublic-ur.png |
| SEO                         | clicked | screenshots/pages-editor-014-click-seo.png                      |
| Add page content            | clicked | screenshots/pages-editor-015-click-add-page-content.png         |
| Add page content            | clicked | screenshots/pages-editor-016-click-add-page-content.png         |

### Responsive

| Viewport       | Screenshot                              |
| -------------- | --------------------------------------- |
| Mobile (375px) | screenshots/pages-editor-017-mobile.png |
| Tablet (768px) | screenshots/pages-editor-018-tablet.png |

---

## Page: /admin/pages/authors (Authors)

### Load

- HTTP status: 200 (OK)
- Load screenshot: screenshots/pages-authors-019-load.png
- Console errors: none
- Failed network requests: none

### Page structure

- Headings: H2:"Studio", H1:"Author Profiles"
- Element counts: 3 buttons, 4 links, 5 inputs

### Buttons (visible)

| Label            | Disabled |
| ---------------- | -------- |
| Collapse sidebar |          |
| Sign out         |          |
| Create author    |          |

### Inputs / form fields

| Type     | Name          | Label/Placeholder | Required |
| -------- | ------------- | ----------------- | -------- |
| text     | displayName   |                   | yes      |
| text     | slug          |                   | yes      |
| text     | roleTitle     |                   |          |
| text     | avatarAssetId |                   |          |
| textarea | bio           |                   |          |

### Links

| Text                                    | Href                  |
| --------------------------------------- | --------------------- |
| SEO pages: SEO page content             | /admin/pages          |
| Media library: Images and source assets | /admin/media          |
| Settings: Users and access              | /admin/settings/users |
| Back to pages                           | /admin/pages          |

### Interactions performed (safe)

| Element clicked | Result  | Screenshot                                            |
| --------------- | ------- | ----------------------------------------------------- |
| Create author   | clicked | screenshots/pages-authors-020-click-create-author.png |

### Skipped (destructive / external)

| Element  | Reason                                           |
| -------- | ------------------------------------------------ |
| Sign out | destructive/external — screenshotted not clicked |
| Sign out | destructive/external — screenshotted not clicked |

### Responsive

| Viewport       | Screenshot                               |
| -------------- | ---------------------------------------- |
| Mobile (375px) | screenshots/pages-authors-021-mobile.png |
| Tablet (768px) | screenshots/pages-authors-022-tablet.png |

---

## Page: /admin/pages/redirects (Redirects)

### Load

- HTTP status: 200 (OK)
- Load screenshot: screenshots/pages-redirects-023-load.png
- Console errors: none
- Failed network requests: none

### Page structure

- Headings: H2:"Studio", H1:"Redirect Manager"
- Element counts: 3 buttons, 4 links, 4 inputs

### Buttons (visible)

| Label            | Disabled |
| ---------------- | -------- |
| Collapse sidebar |          |
| Sign out         |          |
| Create redirect  |          |

### Inputs / form fields

| Type   | Name            | Label/Placeholder                                  | Required |
| ------ | --------------- | -------------------------------------------------- | -------- |
| text   | sourcePath      | /resources/old-page                                | yes      |
| text   | destinationPath | /blog/new-page                                     | yes      |
| select | statusCode      | 301 permanent302 temporary307 temporary308 permane |          |
| text   | pageId          | Optional                                           |          |

### Links

| Text                                    | Href                  |
| --------------------------------------- | --------------------- |
| SEO pages: SEO page content             | /admin/pages          |
| Media library: Images and source assets | /admin/media          |
| Settings: Users and access              | /admin/settings/users |
| Back to pages                           | /admin/pages          |

### Interactions performed (safe)

| Element clicked | Result  | Screenshot                                                |
| --------------- | ------- | --------------------------------------------------------- |
| Create redirect | clicked | screenshots/pages-redirects-024-click-create-redirect.png |

### Skipped (destructive / external)

| Element  | Reason                                           |
| -------- | ------------------------------------------------ |
| Sign out | destructive/external — screenshotted not clicked |
| Sign out | destructive/external — screenshotted not clicked |

### Responsive

| Viewport       | Screenshot                                 |
| -------------- | ------------------------------------------ |
| Mobile (375px) | screenshots/pages-redirects-025-mobile.png |
| Tablet (768px) | screenshots/pages-redirects-026-tablet.png |

---

## Page: /admin/pages/block-preview-audit (Block Preview Audit)

### Load

- HTTP status: 200 (OK)
- Load screenshot: screenshots/pages-block-audit-027-load.png
- Console errors: none
- Failed network requests: none

### Page structure

- Headings: H2:"Studio", H1:"Block preview audit", H2:"Standard hero", H1:"Launch a vending route with a proven plan", H1:"Launch a vending route with a proven plan", H2:"Split hero", H1:"Launch a vending route with a proven plan", H1:"Launch a vending route with a proven plan", H2:"Compact hero", H1:"Launch a vending route with a proven plan", H1:"Launch a vending route with a proven plan", H2:"Editorial hero", H1:"Build a profitable route with fewer wrong turns", H1:"Build a profitable route with fewer wrong turns", H2:"Standard text", H2:"Write structured page copy", H2:"Write structured page copy", H2:"Intro text", H2:"Write structured page copy", H2:"Write structured page copy", H2:"Compact text", H2:"Write structured page copy", H2:"Write structured page copy", H2:"Checklist text", H2:"What the page should include", H2:"What the page should include", H2:"Standard image", H2:"Wide image", H2:"Inline image", H2:"Feature image", H2:"Primary CTA", H2:"Secondary CTA", H2:"Text link CTA", H2:"Standard FAQ", H2:"Common vending questions", H2:"Common vending questions", H2:"Compact FAQ", H2:"Common vending questions", H2:"Common vending questions", H2:"Accordion FAQ", H2:"Common vending questions", H2:"Common vending questions", H2:"Standard cards", H2:"Compare the next steps", H3:"Plan", H3:"Place", H3:"Launch", H3:"Improve", H2:"Compare the next steps", H3:"Plan", H3:"Place", H3:"Launch", H3:"Improve", H2:"Compact cards", H2:"Compare the next steps", H3:"Plan", H3:"Place", H3:"Launch", H3:"Improve", H2:"Compare the next steps", H3:"Plan", H3:"Place", H3:"Launch", H3:"Improve", H2:"Feature cards", H2:"Compare the next steps", H3:"Plan", H3:"Place", H3:"Launch", H3:"Improve", H2:"Compare the next steps", H3:"Plan", H3:"Place", H3:"Launch", H3:"Improve", H2:"Quote proof", H2:"Stat proof", H2:"Logo proof", H2:"Standard video", H2:"Watch the route planning walkthrough", H2:"Watch the route planning walkthrough", H2:"Wide video", H2:"Watch the route planning walkthrough", H2:"Watch the route planning walkthrough", H2:"Inline video", H2:"Watch the route planning walkthrough", H2:"Watch the route planning walkthrough", H2:"Standard form", H2:"Start your vending plan", H2:"Start your vending plan", H2:"Compact form", H2:"Start your vending plan", H2:"Start your vending plan", H2:"Sidebar form", H2:"Start your vending plan", H2:"Start your vending plan"
- Element counts: 2 buttons, 3 links, 0 inputs

### Buttons (visible)

| Label            | Disabled |
| ---------------- | -------- |
| Collapse sidebar |          |
| Sign out         |          |

### Links

| Text                                    | Href                  |
| --------------------------------------- | --------------------- |
| SEO pages: SEO page content             | /admin/pages          |
| Media library: Images and source assets | /admin/media          |
| Settings: Users and access              | /admin/settings/users |

### Interactions performed (safe)

_No safe click interactions recorded (page is view/selection-oriented or interactions navigated away)._

### Skipped (destructive / external)

| Element  | Reason                                           |
| -------- | ------------------------------------------------ |
| Sign out | destructive/external — screenshotted not clicked |
| Sign out | destructive/external — screenshotted not clicked |

### Responsive

| Viewport       | Screenshot                                   |
| -------------- | -------------------------------------------- |
| Mobile (375px) | screenshots/pages-block-audit-028-mobile.png |
| Tablet (768px) | screenshots/pages-block-audit-029-tablet.png |

---

## Summary

- Pages explored: 6
- Total screenshots: 29
- Safe interactions performed: 10
- Destructive/external actions skipped: 8
- Console errors across all pages: 0
- Failed network requests across all pages: 0

## Skipped destructive actions (all pages)

| Page                             | Element  | Reason                                           |
| -------------------------------- | -------- | ------------------------------------------------ |
| /admin/pages                     | Sign out | destructive/external — screenshotted not clicked |
| /admin/pages                     | Sign out | destructive/external — screenshotted not clicked |
| /admin/pages/authors             | Sign out | destructive/external — screenshotted not clicked |
| /admin/pages/authors             | Sign out | destructive/external — screenshotted not clicked |
| /admin/pages/redirects           | Sign out | destructive/external — screenshotted not clicked |
| /admin/pages/redirects           | Sign out | destructive/external — screenshotted not clicked |
| /admin/pages/block-preview-audit | Sign out | destructive/external — screenshotted not clicked |
| /admin/pages/block-preview-audit | Sign out | destructive/external — screenshotted not clicked |

_Note: the page editor was opened on a pre-existing sample page (`f7eb8024…`). Publish/Unpublish/Delete on that page were screenshotted but not executed (destructive on pre-existing data). The "new page" creation flow was filled/reviewed visually but not submitted to avoid orphan records._
