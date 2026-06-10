# Journeys — SEO Page Builder

Derived: 2026-06-10. Source: derived (no user-supplied journeys; scope = SEO page builder only).
The builder exists so an admin can create, polish, publish, and maintain SEO pages.

---

## Journey 1: create-first-page

- **Goal**: Create a new SEO page from scratch with real content blocks and save it as a draft.
- **Entry point**: /admin/pages
- **Success state**: Draft saved; page appears in the pages list with Draft status; editor confirms save.
- **Source**: derived

## Journey 2: publish-and-view-live

- **Goal**: Publish the draft page (created in Journey 1) and view it live on the public site.
- **Entry point**: /admin/pages (find the page) → editor
- **Success state**: Page status shows Published; "View live page" opens the public URL and the content renders.
- **Source**: derived

## Journey 3: preview-draft

- **Goal**: Preview unpublished draft changes before publishing, the way a careful editor would.
- **Entry point**: editor of the session-created page
- **Success state**: A live preview opens in a new tab showing the draft content.
- **Source**: derived

## Journey 4: revision-restore

- **Goal**: After making an edit, find the revision history, preview an earlier revision, and restore it as the draft.
- **Entry point**: editor of the session-created page
- **Success state**: Revision preview renders; "Restore draft" confirms and the editor reflects the restored content.
- **Source**: derived

## Journey 5: schedule-publish

- **Goal**: Schedule the page to publish at a future time, confirm the schedule is visible, then cancel the schedule.
- **Entry point**: editor of the session-created page (SEO panel → Advanced)
- **Success state**: Schedule shows "Scheduled for {date/time}"; cancelling clears it.
- **Source**: derived

## Journey 6: create-redirect

- **Goal**: Create a 301 redirect from an old path to the session-created page's public URL.
- **Entry point**: /admin/pages → "Redirects"
- **Success state**: Redirect appears in the redirects table with the right status code.
- **Source**: derived

## Journey 7: find-duplicate-archive

- **Goal**: Find the session-created page via search, duplicate it, then archive the duplicate and the original (cleanup-as-journey — tests search, row menu, and the archive flow on records this session owns).
- **Entry point**: /admin/pages
- **Success state**: Search finds the page; duplicate appears; archived pages move to Archived status.
- **Source**: derived

---

# Execution results

(appended during Step 2 exploration)

## Journey results: create-first-page

- Status: completed-with-friction
- Clicks: 13 | Page loads: 3
- Steps: open /admin/pages → "Create page" → 3-step choice gate (Resource → Blank page → Start building) → editor → filled Page title, slug, target keyword, meta description in SEO panel → "Add page content" → block picker (Rich text, then FAQ) → "Save draft" → redirected to /admin/pages/{id}; page visible in list as Draft.

| #   | Page             | Action                                                         | Result                             | Screenshot                                               |
| --- | ---------------- | -------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| 01  | /admin/pages     | Load list                                                      | OK                                 | journey-create-first-page-01-open-pages-list.png         |
| 02  | /admin/pages     | Clicked "Create page"                                          | /admin/pages/new                   | journey-create-first-page-02-click-create-page.png       |
| 03  | /admin/pages/new | Choice gate: Continue → Blank page → Continue → Start building | Editor opened                      | journey-create-first-page-03-choice-gate.png             |
| 04  | editor           | SEO panel open by default                                      | Title/slug/keyword/meta filled     | journey-create-first-page-05-fill-title-slug-keyword.png |
| 05  | editor           | "Add page content" → Rich text → variant                       | Block added                        | journey-create-first-page-06-add-rich-text-block.png     |
| 06  | editor           | "Add page content" → FAQ → variant                             | Block added                        | journey-create-first-page-07-add-faq-block.png           |
| 07  | editor           | "Save draft"                                                   | Saved; URL /admin/pages/e44f0fc3-… | journey-create-first-page-08-save-draft.png              |
| 08  | /admin/pages     | Search by title                                                | Page listed as draft               | journey-create-first-page-09-verify-in-list.png          |

### Friction notes

- New page canvas is entirely placeholder ("Hero headline", "Hero body copy", "CTA label") with no guidance that these must be completed before publishing.
- Choice gate is clear, but a "Template" option exists with "No templates created" (dead-end card for a first-time user).

## Journey results: publish-and-view-live

- Status: completed-with-friction (heavy)
- Clicks: ~12 across attempts | Page loads: 6
- The single biggest friction in the whole review. Publish is gated behind a chain of readiness blockers that are revealed ONE AT A TIME in the status chip, in terse internal naming:
  1. "Fix SEO title" (shown even though the SEO title field says "Leave blank to use page headline")
  2. "Add a hero headline before publishing." (readiness panel wording, shown at the same time the chip said "Fix SEO title" — two different messages for the same gate)
  3. "Fix content 1 · Cta Label"
  4. "Fix content 1 · Destination URL" — the destination field is NOT on the canvas; it lives in Block actions → Edit settings modal ("CTA destination URL"). The blocker text gives no hint where the field is.
- After clicking Publish, confirmation is an inline yellow card ("Confirm publish — This will make this draft visible at /resources/…"). After confirming, "Changes published." toast appears BUT the confirm card remains open asking to publish again ("This will replace the current live version…").
- No "Open live page" link was visible after publishing in the default panel state — the live URL had to be typed manually.
- Live page renders correctly once visited.

| #   | Page         | Action                                              | Result                                   | Screenshot                                                                                            |
| --- | ------------ | --------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 01  | editor       | Read blocker chip                                   | "Fix SEO title", Publish disabled        | journey-publish-and-view-live-02-read-publish-blocker.png                                             |
| 02  | editor       | Filled SEO title                                    | chip → "Fix content 1 · Cta Label"       | journey-publish-and-view-live-08-after-seo-title-fix.png                                              |
| 03  | editor       | Filled hero Heading + FAQ                           | chip → CTA blockers                      | journey-publish-and-view-live-03-resolve-blockers.png                                                 |
| 04  | editor       | Filled CTA label inline                             | chip → "Fix content 1 · Destination URL" | journey-publish-and-view-live-11-block-settings-modal.png                                             |
| 05  | editor       | Block actions → Edit settings → CTA destination URL | Publish enabled                          | journey-publish-and-view-live-12-block-settings-filled.png                                            |
| 06  | editor       | Publish → inline confirm card → Confirm publish     | "Changes published." (card stays open)   | journey-publish-and-view-live-09-after-publish.png, journey-publish-and-view-live-13-confirm-card.png |
| 07  | /resources/… | Typed public URL manually                           | Page live, renders hero/CTA/FAQ          | journey-publish-and-view-live-10-live-page.png                                                        |

### Wrong turns / dead ends

- Chip said "Fix SEO title" while readiness panel said "Add a hero headline before publishing." — fixed the wrong thing first.
- Hunted on canvas for "Destination URL" — it is only in the block settings modal.

## Journey results: preview-draft

- Status: completed
- Clicks: 1 | Page loads: 1
- "Live preview" opened a token preview (/resources/preview/{token}) in a new tab rendering the draft.

| #   | Page   | Action                  | Result                    | Screenshot                                   |
| --- | ------ | ----------------------- | ------------------------- | -------------------------------------------- |
| 01  | editor | Edited meta description | autosave/manual save fine | journey-preview-draft-02-make-small-edit.png |
| 02  | editor | Clicked "Live preview"  | preview tab opened        | journey-preview-draft-preview-tab.png        |

## Journey results: revision-restore

- Status: completed-with-friction
- Clicks: 4 | Page loads: 4
- KEY DISCOVERY: revisions do NOT exist while drafting. Empty state: "Revisions appear after publishing, library refreshes, or draft restores." Saving a draft creates no restore point — a user who mangles a draft before first publish has no undo at the page level. After publishing, a revision appeared and Preview → Back to editor → Restore draft worked.

| #   | Page                  | Action                                | Result           | Screenshot                                            |
| --- | --------------------- | ------------------------------------- | ---------------- | ----------------------------------------------------- |
| 01  | editor (pre-publish)  | Looked for revisions after draft save | Empty state only | journey-revision-restore-04-preview-revision.png      |
| 02  | editor (post-publish) | Revision history                      | Entry present    | journey-revision-restore-07-history-after-publish.png |
| 03  | revision page         | "Preview"                             | Read-only render | journey-revision-restore-08-revision-preview.png      |
| 04  | revision page         | "Back to editor"                      | Returned         | (same)                                                |
| 05  | editor                | "Restore draft" + confirm             | Restored         | journey-revision-restore-09-after-restore.png         |

## Journey results: schedule-publish

- Status: completed-with-friction
- Clicks: 5 | Page loads: 3
- Scheduled publish field is buried at the bottom of SEO panel → Advanced SEO governance area. Label says "Uses Pacific Time (America/Los_Angeles)" — for an Australian business. After filling a date/time and saving, the field re-rendered EMPTY and no "Scheduled for …" status appeared anywhere in the editor; the only hint a schedule might exist is the "Cancel scheduled publish" checkbox ("Keeps the draft intact and removes this page from the automatic publishing queue."). Cancel + save cleared it.

| #   | Page   | Action                                    | Result                                        | Screenshot                                             |
| --- | ------ | ----------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| 01  | editor | Open Advanced SEO, find Scheduled publish | found (buried)                                | journey-schedule-publish-02-open-advanced-sections.png |
| 02  | editor | Filled 2026-06-11T12:00, Save draft       | field shows empty after save, no confirmation | journey-schedule-publish-05-verify-scheduled.png       |
| 03  | editor | Cancel scheduled publish + save           | cleared                                       | journey-schedule-publish-06-cancel-schedule.png        |

## Journey results: create-redirect

- Status: completed
- Clicks: 2 + form fill | Page loads: 2
- Form (Old path / Destination / Status select) submitted; redirect appeared in table. NOTE: the redirects table offers no edit or delete control — mistakes are permanent from this UI.

| #   | Page         | Action                     | Result                 | Screenshot                                            |
| --- | ------------ | -------------------------- | ---------------------- | ----------------------------------------------------- |
| 01  | /admin/pages | "Redirects"                | /admin/pages/redirects | journey-create-redirect-02-click-redirects.png        |
| 02  | redirects    | Filled + "Create redirect" | row appears            | journey-create-redirect-05-verify-redirect-listed.png |

## Journey results: find-duplicate-archive

- Status: completed-with-friction
- Clicks: 8 | Page loads: 5
- Search found the page. Row ⋮ menu (native details) → "Duplicate page" (confirm dialog) created "Copy of {title}" with auto slug "draft-4020bd0f" (original slug not preserved/derived). Archive (confirm dialog) moved pages to Archived. Archiving is per-row only; no bulk select.

| #   | Page         | Action                              | Result                                       | Screenshot                                                  |
| --- | ------------ | ----------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| 01  | /admin/pages | Search by title fragment            | found ("Showing 1 SEO page in active pages") | journey-find-duplicate-archive-01-search-for-page.png       |
| 02  | /admin/pages | Row menu → Duplicate page → confirm | duplicate created in editor view             | journey-find-duplicate-archive-03-duplicate-page.png        |
| 03  | /admin/pages | Row menu → Archive page → confirm   | page archived                                | journey-find-duplicate-archive-05-archive-session-pages.png |
| 04  | /admin/pages | Archived tab                        | session pages listed                         | journey-find-duplicate-archive-06-verify-archived.png       |
