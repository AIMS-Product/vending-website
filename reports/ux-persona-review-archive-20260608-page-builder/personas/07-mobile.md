# Persona Review: Jake — Distracted Mobile User

## Summary

- Pages reviewed: 6
- Issues found: 27
- Blockers: 2
- Overall gut feel: 2/5

> I live on my phone. I do everything thumb-only, half-watching a lecture, one
> bar of patience. Most of the simple list/form pages here actually adapt fine —
> credit where it's due. But the part this whole product is named after — the
> Page Builder — and the block audit page fall apart on a 375px screen. If I
> can't actually build or check a page on my phone, the "builder" is a desktop
> tool wearing a responsive costume.

---

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 4/5** — "Surprisingly clean on my phone — cards stack, buttons are thumb-sized, I can find my page."

| #   | Category          | Finding                                                                                                                                                                                                             | Severity | Why this matters to me                                                                                                                    |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual & Layout   | Stat cards (All / Drafts / Published / Archived) stack into a single tall column on mobile, pushing the actual page list way below the fold — I have to scroll through 4 big stat tiles before I see any pages.     | Medium   | I opened this to find a page, not read a dashboard. On my phone that's 3-4 thumb-flicks of scrolling before the real content even starts. |
| 2   | Navigation & Flow | The whole filter system (search, All/Drafts tabs, sort dropdown, 7 "All metadata / Needs review / ..." chips) sits between the stats and the list. On mobile that's another full screen of controls to scroll past. | Medium   | I just want the list. Burying it under a wall of filters I'll never use on mobile makes the page feel heavier than it is.                 |
| 3   | Visual & Layout   | The "super_admin access" badge is shoved to the top-right and on the smallest view nearly collides with the page title area.                                                                                        | Low      | Minor, but it's the kind of cramped corner that makes a screen feel like it wasn't drawn for my width.                                    |
| 4   | Accessibility     | A floating dark circular avatar/widget ("N") overlaps the bottom-left of the content on every page. On mobile it sits right over the first list/stat content.                                                       | Medium   | On a small screen that floating blob covers tappable stuff and I can't tell if it's a button or a chat bubble — it's just in my way.      |
| 5   | Feedback & State  | Mobile list view doesn't show the readiness/status columns (KEYWORD, GOVERNANCE, READINESS, STATUS) that the desktop/tablet table shows.                                                                            | Low      | Fine for me honestly — but if I needed to check publish status from my phone, that info just isn't there in the mobile layout.            |

### /admin/pages/new (Create New Page)

**Gut feel: 4/5** — "Cards collapse to one column, big tap targets, easy to pick — this is how mobile should work."

| #   | Category         | Finding                                                                                                                                                                                                                   | Severity | Why this matters to me                                                                                                                             |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Visual & Layout  | On mobile the "Selected setup" summary card and the primary "Start building" button are pushed far below all the page-type and starting-point options — I have to scroll the whole list before I can confirm and proceed. | Medium   | The one button I need (Start building) is the hardest to reach. Thumb has to travel the entire screen after every choice.                          |
| 7   | Feedback & State | The two disabled "Coming soon" cards (From template / AI-assisted) still take a full-width row each on mobile, adding more to scroll past for features I literally can't use.                                             | Low      | Dead options eating my limited screen height is annoying when I'm scrolling one-handed.                                                            |
| 8   | Forms & Input    | Page-type and starting-point are two separate selectable groups but on mobile they read as one long list of identical cards — easy to not realize you're picking from two different sets.                                 | Medium   | Scrolling fast on my phone, the "Starting point" heading is small and I could easily tap a second page-type thinking I'm refining the same choice. |
| 9   | Trust & Safety   | No explicit "you can change this later" reassurance near the big blue commit button.                                                                                                                                      | Low      | On mobile I commit faster and think less — a tiny "you can edit blocks after" would stop me hesitating on Start building.                          |

### /admin/pages/{id} (Page Builder Editor)

**Gut feel: 1/5** — "This is the core feature and it's basically unusable on my phone — controls float in a cloud of pills, text gets cut off, and there's no way I'm editing 58 fields by thumb."

| #   | Category          | Finding                                                                                                                                                                                                                                   | Severity | Why this matters to me                                                                                                                                                           |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Visual & Layout   | On mobile the top toolbar becomes a loose cloud of 7 floating pill buttons (Pages / Blocks / SEO / Save draft / Live preview / Editor link / Public URL) wrapping across 3 rows with no grouping or bar background.                       | Critical | It looks broken, like the toolbar exploded. I can't tell what's primary — Save draft and Public URL get equal weight as floating bubbles.                                        |
| 11  | Visual & Layout   | The hero block heading "Vending in Colleges That Works..." is clipped — "CAMPUS VENDING SOLUT" and "Vending in Colleges That" cut off at the right edge on mobile.                                                                        | High     | Content cut off at the edge is my #1 trigger. If the preview is clipping text, I can't trust what I'm actually editing.                                                          |
| 12  | Navigation & Flow | The editor relies on 3 collapsible side panels (Pages/Builder outline, Blocks, SEO sidebar) that, on mobile, are reduced to pill toggles at the very top — there's no clear panel UI, just buttons that presumably swap the whole screen. | Critical | A builder is about seeing structure + canvas + settings together. On my phone I can only ever see one, with no spatial sense of where I am. Constant context-switching by thumb. |
| 13  | Forms & Input     | The SEO/settings sidebar contains ~58 inputs (title, slug, meta, OG, schedule, governance, etc.). On mobile these are buried behind a single "SEO" pill and stack into an endless vertical form.                                          | Critical | 58 fields one-handed on a phone keyboard is a non-starter. The datetime-local, selects, and tag inputs especially are fiddly on mobile keyboards.                                |
| 14  | Accessibility     | Per-block controls (Edit settings, Move, eye/hide toggles, the "..." actions, Up/Down/Remove on cards) are tiny icon buttons. On mobile the eye-toggle and drag handle look well under the 44px touch target.                             | Critical | Fat-finger city. I'll tap "Remove" when I meant the eye toggle, or fail to grab the drag handle entirely. Reordering blocks by thumb here is a coin flip.                        |
| 15  | Feedback & State  | A floating purple "AI" pill sits bottom-right AND the dark "N" widget sits bottom-left, both overlapping the canvas/inputs on mobile.                                                                                                     | High     | Two floating blobs covering the bottom of my screen — exactly where my thumb rests and where form fields scroll to. They block the content I'm trying to edit.                   |
| 16  | Visual & Layout   | Drag-to-reorder is the implied interaction model (drag handles on blocks/cards) but touch drag-and-drop inside a scrolling page is notoriously broken — page scrolls when I try to drag.                                                  | Critical | Every time I grab a block to move it, the page is going to scroll instead. There are Up/Down buttons as a fallback but they're the same tiny targets as everything else.         |
| 17  | Trust & Safety    | "Save draft" is just one more floating pill among 7, with no visual priority and (from the shots) no visible autosave or "saved" confirmation on mobile.                                                                                  | High     | If I'm editing on my phone between classes and I'm not 100% sure it saved, I'll assume I lost my work. No prominent save state = no trust.                                       |
| 18  | Visual & Layout   | Tablet (768px) still shows the editor as essentially a single narrow column with the same floating pill toolbar — it does NOT use the 3-panel desktop layout, so even an iPad in portrait gets the cramped phone experience.              | High     | A lot of "mobile" CMS editing happens on tablets. If the tablet breakpoint is just the phone layout stretched, the builder is desktop-only in practice.                          |
| 19  | Copy & Labels     | On mobile, "Editor link" and "Public URL" pills lose the "Copy" verb that the desktop buttons have ("Copy editor link"). They just say the noun.                                                                                          | Medium   | "Editor link" as a button — does it copy it? Open it? On my phone I can't tell what tapping does, so I won't tap it.                                                             |

### /admin/pages/authors (Authors)

**Gut feel: 4/5** — "A plain stacked form with full-width inputs — exactly right for a phone, nothing to complain about."

| #   | Category        | Finding                                                                                                                                                                  | Severity | Why this matters to me                                                                                                                     |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 20  | Forms & Input   | Inputs are full-width and stack cleanly, but there's no field-level helper text on mobile — "Slug" and "Avatar asset ID" mean nothing to me with no example/placeholder. | Medium   | On desktop I might infer it; on my phone with no hints I'd guess wrong and get an error after submitting.                                  |
| 21  | Visual & Layout | "Create author" button sits below the Bio textarea (below the fold on mobile) — I have to scroll past every field to find the submit.                                    | Low      | Standard, but combined with no sticky CTA it means a scroll-hunt for the button every time.                                                |
| 22  | Forms & Input   | No visible indication of which fields are required on mobile (Display name + Slug are required per the form spec, but no asterisk/label shows it).                       | Medium   | I'll fill in just Display name, hit Create, and get bounced — annoying on mobile where re-finding the empty field means scrolling back up. |

### /admin/pages/redirects (Redirects)

**Gut feel: 4/5** — "Form stacks fine, native select works with my phone's picker, clean enough."

| #   | Category        | Finding                                                                                                                                                        | Severity | Why this matters to me                                                                                                                                                   |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 23  | Visual & Layout | The results table header (OLD PATH / DESTINATION / STATUS / SOURCE / CREATED) renders as a header row with no rows and no empty-state message on mobile.       | Medium   | On my narrow screen that lone header bar looks like the page failed to load the list. A "No redirects yet" message would tell me it's just empty.                        |
| 24  | Visual & Layout | That 5-column results table will horizontally overflow on mobile once it has data — 5 columns can't fit in 375px without scrolling sideways.                   | High     | When there are real redirects, I'll be swiping the table left-right to read a single row. Horizontal scroll inside a page is exactly what kills mobile usability for me. |
| 25  | Forms & Input   | "Old path" / "Destination" use placeholder examples (good) but the placeholders are light grey and on a bright phone screen outdoors they're nearly invisible. | Low      | Low contrast placeholder text disappears in sunlight — I'd be typing blind on the bus.                                                                                   |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 1/5** — "Wide preview frames blow right past the screen edge — content is literally cut off mid-word and I'm forced to scroll sideways."

| #   | Category          | Finding                                                                                                                                                                              | Severity | Why this matters to me                                                                                                                                                                            |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26  | Visual & Layout   | The "ACTUAL RESOURCE RENDER" preview overflows the container — the H1 is cut off mid-word ("WITH A F...PLAN") and body copy runs off the right edge on BOTH mobile and tablet.       | Blocker  | This is the worst kind of mobile fail: content chopped off with no way to read it except horizontal scrolling. The page's entire job is comparing previews and I can't even see one full preview. |
| 27  | Navigation & Flow | The whole page is a fixed-width desktop comparison grid (picker preview vs actual render side-by-side) crammed into a phone column, forcing horizontal scroll on nearly every block. | Blocker  | Dozens of blocks each requiring me to swipe sideways to see the right half. On a phone this is an endless horizontal-scroll nightmare — I'd give up after the second block.                       |
| 28  | Visual & Layout   | The "super_admin access" badge wraps onto two lines and crowds the breadcrumb ("SEO Page Builder >") at the top on mobile.                                                           | Low      | Cramped header again — small thing, but it's the first thing I see and it already looks squeezed.                                                                                                 |

---

## Blockers

1. **Block Preview Audit content is cut off mid-word on mobile AND tablet (#26)** — the actual-render preview H1 chops to "WITH A F...PLAN" and body text runs off-screen with forced horizontal scroll. The page exists to compare previews and you cannot see a full preview on a phone.
2. **Block Preview Audit forces sideways scrolling on every block (#27)** — a fixed-width desktop side-by-side grid stuffed into a 375px column. Reviewing blocks on mobile means horizontal-swiping dozens of times. Functionally unusable by thumb.

> Note on the Editor: I scored it 1/5 and flagged six Critical issues (#10–#16). It's not technically "broken" so I didn't mark it a Blocker, but in practice the Page Builder is the named feature of this product and it is effectively desktop-only. For a mobile user that's as good as blocked.

---

## My Top 10 Issues

1. **(#26, Blocker)** Block audit preview cut off mid-word ("WITH A F...PLAN") on mobile + tablet — content I literally cannot read.
2. **(#27, Blocker)** Block audit forces horizontal scroll on every single block — endless sideways swiping on a phone.
3. **(#12, Critical)** Builder's 3-panel structure collapses to top pills on mobile — I can only ever see one of canvas/structure/settings, lost in space.
4. **(#14, Critical)** Per-block icon controls (eye toggle, drag handle, remove) are way under 44px — guaranteed mis-taps and lost work.
5. **(#16, Critical)** Drag-to-reorder blocks fights the page scroll on touch — grabbing a block scrolls the page instead.
6. **(#13, Critical)** ~58 SEO/settings fields buried behind one "SEO" pill — filling them one-handed on a phone keyboard is a non-starter.
7. **(#10, Critical)** Editor toolbar explodes into 7 ungrouped floating pills across 3 rows — looks broken, no visual priority for Save.
8. **(#11, High)** Hero block heading clipped at the right edge in the editor preview — can't trust what I'm editing.
9. **(#18, High)** Tablet (768px) still gets the cramped phone editor layout, not the 3-panel desktop one — iPad editing is just as bad.
10. **(#24, High)** Redirects 5-column results table will overflow horizontally on mobile once it has data — swiping left/right to read one row.
