# Persona Review: Mike — Competitor's User

_33, project manager. Two years on Webflow + a stint in WordPress/Sanity. I'm here to decide if my team switches. Everything below is measured against "would this slow us down vs. what we already pay for?"_

## Summary

- Pages reviewed: 6
- Issues found: 27
- Blockers: 1
- Overall gut feel: 3/5

The bones are surprisingly good — the readiness/governance panel and the block-variant gallery are genuinely ahead of stock WordPress. But the core building experience is missing table-stakes interactions I've had for two years (drag-and-drop reordering, a clipboard that actually works, an import path, search-driven block insertion), and there's no migration story at all. It's a competent v1, not a switch-today product.

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 4/5** — "Cleaner and more focused than the WP posts table; the readiness/governance columns are something Webflow doesn't even have."

| #   | Category          | Finding                                                                                                                                                 | Severity | Why this matters to me                                                                                                       |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Navigation & Flow | Only two top-level CMS sections (SEO pages, Media library) plus Authors/Redirects buttons; no global page search across collections, no folders/nesting | Medium   | In Webflow I organize 200+ pages into folders. A flat list with one record won't scale and there's no obvious nesting model. |
| 2   | Forms & Input     | Status filter, view filter, and sort are all separate link rows that each reload the URL — no combined multi-facet filtering                            | Low      | Contentful lets me stack filters in one view; here each click is a full navigation, which feels dated.                       |
| 3   | Copy & Labels     | "Needs links / Orphaned", "Updating", "Metadata issues" filter chips are great, but undefined — no tooltip explaining the threshold                     | Low      | I'd want to know what triggers "Needs links" before I trust it as a workflow gate.                                           |
| 4   | Visual & Layout   | The four stat cards (All/Drafts/Published/Archived) are large and eat the top third of the page for one row of data                                     | Low      | Webflow's collection view is denser; I scan more records per screen.                                                         |
| 5   | Feedback & State  | No bulk-select / bulk actions (publish, archive, tag multiple pages)                                                                                    | High     | Bulk publishing is daily in my current tool. Doing this one row at a time would cost real productivity.                      |
| 6   | Trust & Safety    | Row-level kebab actions (Duplicate/Publish/Archive) exist — good, and Archive over Delete is a safer default than WP's trash                            | Low      | Reassuring; archive-not-delete is the right call.                                                                            |

### /admin/pages/new (Create New Page)

**Gut feel: 4/5** — "The scoped page-type + starting-point picker is a nicer onboarding than Webflow's blank canvas, but two of the best options are 'Coming soon'."

| #   | Category          | Finding                                                                                                                       | Severity | Why this matters to me                                                                                                                                                     |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Copy & Labels     | "From template" and "AI-assisted template" both disabled with "Coming soon"                                                   | High     | Reusable templates are how my team keeps brand consistency. Shipping the page-creation screen with the template path greyed out signals the workflow I rely on isn't done. |
| 8   | Navigation & Flow | No "Import" or "Duplicate from existing" entry point anywhere in the create flow                                              | Critical | This is the migration question. There is zero path to bring my existing Webflow/WP content in. That alone is a switching blocker for a team with content already live.     |
| 9   | Forms & Input     | The screenshot labelled "form-filled" is identical to "load" — no slug/title fields appear on this step; naming happens later | Medium   | In Contentful I name and slug at creation. Deferring it is fine, but I couldn't tell from this screen that nothing was actually fillable here.                             |
| 10  | Visual & Layout   | "Selected setup" summary panel restates the choice clearly with a single primary "Start building" CTA                         | Low      | Good pattern — unambiguous next step, matches what I'd expect.                                                                                                             |
| 11  | Feedback & State  | Selected cards get a blue ring; disabled cards are visually muted                                                             | Low      | Clear affordance, no complaints.                                                                                                                                           |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 3/5** — "Three-pane layout is familiar and the readiness panel is excellent, but the actual block editing is form-fields-in-a-sidebar, not the direct-manipulation canvas I'm used to — and a copy action literally failed in front of me."

| #   | Category          | Finding                                                                                                                     | Severity     | Why this matters to me                                                                                                                                                             |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | Feedback & State  | "Could not copy link." error shown after clicking Copy editor link / Copy public URL                                        | **Blocker**  | Copy-link is a core sharing action. In two years of Webflow I've never had the copy button just fail. If sharing a preview is unreliable, my review loop with stakeholders breaks. |
| 13  | Forms & Input     | Block reordering is via "Up/Down/Move section" buttons, not drag-and-drop                                                   | Critical     | Every competitor — Webflow, Wix, even WP Gutenberg — has drag-to-reorder. Clicking Up/Down to move a section past five others is the single biggest productivity regression here.  |
| 14  | Navigation & Flow | Editing is done in the right SEO/settings rail with stacked form fields (Eyebrow, Heading, Body…), not inline on the canvas | High         | Webflow edits text where it sits. Hunting for the matching field in a 58-input sidebar to change a headline is slow and error-prone on long pages.                                 |
| 15  | Forms & Input     | 58 inputs and 82 buttons render on one editor screen with no block-level collapse-by-default                                | High         | Cognitive overload. I want the selected block's fields, not every block's fields at once.                                                                                          |
| 16  | Copy & Labels     | Two buttons read "Save draft" and the panel says "Drafts save automatically… use Save draft to save manually"               | Medium       | Mixed mental model — is it autosave or manual? Webflow is unambiguously autosave. I'd second-guess whether my work is actually saved.                                              |
| 17  | Feedback & State  | "Add page content" modal block picker has no search/filter field                                                            | Medium       | Notion/Webflow let me type "/faq" to insert. With 9 block types × multiple variants, scanning a scrolling list is slower than typing.                                              |
| 18  | Visual & Layout   | Block picker modal previews are genuinely good — Standard/Split/Compact/Editorial hero thumbnails show real layouts         | Low (praise) | This beats Gutenberg's text-only block list. Surprisingly better.                                                                                                                  |
| 19  | Feedback & State  | "Live preview" / "Open preview" / "Rendering…" toast flow works and shows a faithful render                                 | Low (praise) | Preview fidelity is on par with what I expect.                                                                                                                                     |
| 20  | Trust & Safety    | Revision history section present ("revisions appear after publishing, library refreshes, or draft saves")                   | Low          | Revisions are table-stakes and they're here — good. But I can't tell from the UI if I can diff or one-click restore a version the way Webflow's backups do.                        |
| 21  | Accessibility     | No visible keyboard shortcuts anywhere (save, insert block, undo/redo, move block)                                          | High         | I live on Cmd+Z and Cmd+S. A builder with zero shortcuts means every action is a mouse trip — a measurable daily tax.                                                              |
| 22  | Forms & Input     | Scheduled publish (datetime-local) and publish notes are present                                                            | Low (praise) | Scheduling + version notes is parity with the paid tier of my current stack. Nice to see.                                                                                          |
| 23  | Visual & Layout   | Mobile editor stacks the toolbar into pill rows and shows the canvas, but you clearly can't seriously build on a phone      | Low          | Acceptable — nobody builds on mobile. Webflow doesn't pretend to either.                                                                                                           |

### /admin/pages/authors (Authors)

**Gut feel: 3/5** — "A bare create form with no list of existing authors visible — functional, but feels like a half-built collection editor."

| #   | Category        | Finding                                                                                                             | Severity | Why this matters to me                                                                                                             |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 24  | Forms & Input   | "Avatar asset ID" is a raw text field — I have to know/paste an internal asset ID instead of a media-library picker | High     | Webflow/WP give me an image picker. Asking a content editor to paste an asset ID is a developer-grade UX leak.                     |
| 25  | Visual & Layout | No list of existing authors rendered on load — just an empty create form                                            | Medium   | I can't tell if this is an empty state or if the list is below the fold. A real CMS shows me the collection first, then "add new". |
| 26  | Copy & Labels   | Field labels have no helper text (what's "Slug" used for on an author? does it create a /authors/x page?)           | Low      | Minor, but I'd guess instead of knowing.                                                                                           |

### /admin/pages/redirects (Redirects)

**Gut feel: 4/5** — "A real redirect manager with 301/302/307/308 options — this is more honest than Webflow's redirect tab and better than needing a WP plugin."

| #   | Category        | Finding                                                                                     | Severity     | Why this matters to me                                                                                                          |
| --- | --------------- | ------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 27  | Forms & Input   | No bulk import (CSV/paste) of redirects                                                     | High         | Migrating from another platform means importing hundreds of redirects. One-at-a-time entry is a non-starter for a real cutover. |
| 28  | Trust & Safety  | Full 301/302/307/308 status-code control exposed                                            | Low (praise) | This is more granular than Webflow, which only does 301. Genuinely better for SEO-conscious migrations.                         |
| 29  | Visual & Layout | Empty redirect table with clear column headers (Old path/Destination/Status/Source/Created) | Low          | Clean, predictable. "Source" column hinting at auto vs manual redirects is a nice touch.                                        |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 4/5** — "An internal gallery of every block variant rendered top-to-bottom — I wish more CMS products shipped this; it's basically a living component catalog."

| #   | Category          | Finding                                                                                                                         | Severity     | Why this matters to me                                                                                                    |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 30  | Visual & Layout   | Comprehensive: hero (4 variants), text (4), image (4), CTA (3), FAQ (3), cards (3), proof (3), video (3), form (3) all rendered | Low (praise) | This tells me the block library breadth is respectable — close to a Webflow starter component set. Reassuring for parity. |
| 31  | Navigation & Flow | It's a flat scroll with no in-page jump nav / anchor index for 40+ sections                                                     | Low          | Minor; it's clearly an internal audit page, not a primary workflow.                                                       |

## Blockers

1. **(Editor) "Could not copy link." on Copy editor link / Copy public URL** — a core preview-sharing action visibly failed during the session. Sharing a draft for stakeholder review is daily work; an unreliable copy button breaks the review loop. _(Finding #12)_

_Note: #8 (no import path) and #13 (no drag-and-drop) I've scored Critical rather than Blocker because the product technically functions without them — but for my specific decision (switching a team with existing content) the missing import path is the real dealbreaker._

## My Top 10 Issues

1. **No content import / migration path** (#8) — there's no way to bring existing Webflow/WP pages in. For a team with live content, this is the switch-killer.
2. **"Could not copy link." failure** (#12) — a core sharing action broke in front of me.
3. **No drag-and-drop block/section reordering** (#13) — Up/Down buttons are a real productivity regression vs. every competitor.
4. **No keyboard shortcuts** (#21) — no Cmd+S/Cmd+Z/insert/move; every action is a mouse trip.
5. **No bulk redirect import** (#27) — a cutover needs CSV/paste import of hundreds of redirects; one-by-one won't fly.
6. **No bulk page actions** (#5) — can't multi-select to publish/archive/tag; daily work in my current tool.
7. **Editing happens in a 58-field sidebar, not on the canvas** (#14, #15) — slow and error-prone vs. Webflow's inline editing.
8. **Template creation paths are "Coming soon"** (#7) — reusable templates are how teams stay on-brand; shipping the create screen with them greyed out undercuts the workflow.
9. **Author avatar is a raw "asset ID" text field** (#24) — needs a media-library picker; pasting internal IDs is developer-grade UX.
10. **Block picker has no search/type-to-insert** (#17) — scanning a scrolling variant list is slower than the "/" insert I'm used to.
