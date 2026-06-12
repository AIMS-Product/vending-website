# Persona Review: Marcus — Impatient Power User

## Summary

- Pages reviewed: 6
- Issues found: 24
- Blockers: 0
- Overall gut feel: 3/5

I run 40+ tools a day and I judge fast. The good news: this builder is clean, has real status feedback (autosave toasts, "Saving draft...", "Draft saved · 3:51 PM"), and a sensible status panel that tells me exactly what's blocking publish. The bad news: it is mouse-first to its bones. I found zero keyboard shortcuts, zero command palette, every block reorder is a click-the-tiny-arrow chore, search needs a manual button press, and I literally watched a copy action silently fail ("Could not copy link."). It is competent but it never once tries to make me faster. For a power user that is the difference between a 4 and a 3.

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 4/5** — "Dense, scannable, good filter/sort/status chips — but the search forces a button click and there are no keyboard shortcuts to drive any of it."

| #   | Category                  | Finding                                                                                                                                         | Severity       | Why this matters to me                                                                                                                                    |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Forms & Input             | Search box has a separate "Search" button instead of search-as-you-type / Enter-to-submit being obvious. I have to type then mouse to a button. | High           | I filter lists constantly. Forcing a discrete submit on a search field is 1980s friction — I expect debounced live filter or at minimum an obvious Enter. |
| 2   | Accessibility & Inclusion | No visible keyboard shortcut to focus search (no `/` or `Cmd+K`). Every filter chip, sort dropdown, and status tab is a mouse target.           | High           | A power user lives on the keyboard. If I can't jump to search with one keystroke, the tool slows me down on every visit.                                  |
| 3   | Navigation & Flow         | Filters (All/Drafts/Published/Archived), sort, and metadata views are all URL-backed — good, shareable, bookmarkable.                           | Low (positive) | I can bookmark `?view=needs-review`. That's the one genuinely power-user-friendly thing here.                                                             |
| 4   | Feedback & State          | The row "Actions" column is a 3-dot kebab — every action (duplicate/publish/archive) is hidden behind an extra click.                           | Medium         | Hover-revealed inline actions would save me a click per operation. Burying everything in a kebab is death by a thousand clicks at scale.                  |
| 5   | Visual & Layout           | Stat cards (All/Drafts/Published/Archived) duplicate the filter tabs right below them. Two ways to do the same filter eats horizontal space.    | Low            | Redundant chrome. Not harmful, but it's visual noise I have to parse every load.                                                                          |
| 6   | Copy & Labels             | Empty Published state shows "0 publicly visible" cleanly, and list says "Showing 1 SEO page in active pages" — clear counts.                    | Low (positive) | I can trust the counts at a glance. Good.                                                                                                                 |

### /admin/pages/new (Create New Page)

**Gut feel: 3/5** — "A two-axis card picker with a smart default pre-selected is fine, but it's an extra full-screen gate before I can build, and two of the options are dead 'Coming soon' tiles taking up prime space."

| #   | Category                  | Finding                                                                                                                                                  | Severity       | Why this matters to me                                                                                                   |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 7   | Navigation & Flow         | Creating a page is a mandatory selection screen (Page type + Starting point) before I reach the editor. No "just give me a blank page, go" express path. | Medium         | I know what I want. Make "Start building" the instant default on Enter; don't make me confirm two card grids first.      |
| 8   | Forms & Input             | SEO/Resource + Blank page are pre-selected and "Selected setup" summarises the choice — decent smart defaulting.                                         | Low (positive) | At least the defaults are sane, so the lazy path is one click on "Start building." Credit where due.                     |
| 9   | Visual & Layout           | Two large "Coming soon" tiles (From template, AI-assisted) occupy the bottom third of the screen but do nothing.                                         | Medium         | Disabled marketing tiles waste my screen and my attention. Ship features or hide them — don't dangle dead controls.      |
| 10  | Accessibility & Inclusion | No keyboard hint to pick a card (arrow keys / number keys) and submit. It's all click-driven.                                                            | Medium         | A keyboard-driven picker (1-4 then Enter) would let me blow through this gate. Instead I'm reaching for the mouse again. |
| 11  | Feedback & State          | "Start building" gives no indication whether it's instant or spins up a page — no pending state shown on this screen.                                    | Low            | Minor, but I want to know if clicking will hang.                                                                         |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 3/5** — "Genuinely good status/autosave feedback and a clean three-pane layout, but reordering blocks via tiny up/down arrows with no drag-and-drop and zero keyboard shortcuts is brutal for anyone building real pages fast — and I caught a silent copy failure."

| #   | Category                  | Finding                                                                                                                                                                        | Severity       | Why this matters to me                                                                                                                                       |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 12  | Feedback & State          | Copy action failed with toast "Could not copy link." while "Preview link created." succeeded. A core action silently broke.                                                    | High           | If "Copy public URL" doesn't reliably copy, I'm hunting for the URL manually. Copy-to-clipboard must never fail quietly — that's a trust killer.             |
| 13  | Forms & Input             | Block reordering is per-block Up/Down arrow buttons (and "Move section N"). No drag-and-drop visible.                                                                          | High           | Moving a block from position 7 to 2 means six clicks. For a page builder, drag-to-reorder is table stakes; arrow-clicking is punishing at volume.            |
| 14  | Accessibility & Inclusion | No keyboard shortcuts anywhere: no Cmd+S to save (there's a "Save draft" button), no shortcut to open SEO panel, blocks panel, or preview.                                     | High           | I save reflexively with Cmd+S. The editor has a manual Save draft button but the muscle-memory shortcut appears unbound. Every panel toggle is a mouse trip. |
| 15  | Feedback & State          | Autosave + manual save feedback is excellent: "Saving draft...", "Draft saved.", "Autosaved 3:51 PM", "Saved automatically · 3:51 PM".                                         | Low (positive) | This is the best part of the app. I always know my work is safe. More tools should do this.                                                                  |
| 16  | Visual & Layout           | The 3-dot "Section and block actions" and "Block actions" menus hide reorder/remove/visibility behind nested clicks; the outline has dozens of "Edit X settings" buttons.      | Medium         | With 7+ sections and per-card controls, the action surface is a maze of identical kebabs. I can't tell at a glance which action lives where.                 |
| 17  | Feedback & State          | "Up" button disabled at top, "Down" disabled at bottom — but disabled state isn't explained; for a first-time user it reads as broken.                                         | Low            | I get why (it's the boundary), but a power user scanning fast still registers "why is this greyed out."                                                      |
| 18  | Trust & Safety            | Status panel clearly states "This page is not live yet" and "No hard blockers remain" with a green "Ready to publish" callout. Publish is gated and explained.                 | Low (positive) | I know exactly what state I'm in and what's left before going live. That's the right amount of guardrail without nagging.                                    |
| 19  | Navigation & Flow         | Floating "AI" button bottom-right and a "Rendering…" pill — purpose of the AI button is unlabelled beyond the icon.                                                            | Medium         | I don't know what the AI button does or whether clicking it triggers a slow generation. Unlabelled magic buttons are a power-user trap.                      |
| 20  | Visual & Layout           | Mobile editor collapses the toolbar into stacked pills and the canvas shows block chrome (SECTION 1 / Standard hero) — usable but clearly not a real editing surface on phone. | Low            | I'd never build on mobile anyway, but it's fine that it degrades to view/light-edit.                                                                         |

### /admin/pages/authors (Authors)

**Gut feel: 3/5** — "A bare inline create form that does the job, but 'Avatar asset ID' as a raw text field and no list of existing authors makes it feel like a database admin screen, not a tool."

| #   | Category      | Finding                                                                                                                           | Severity | Why this matters to me                                                                                                                           |
| --- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 21  | Forms & Input | "Avatar asset ID" is a free-text field — I'm expected to know/paste an internal asset ID rather than pick from the media library. | High     | Asking me to hand-type an opaque ID is exactly the friction I hate. Give me a media picker; don't make me go find an ID elsewhere and paste it.  |
| 22  | Forms & Input | "Slug" appears to be a manual required field with no auto-generate-from-display-name.                                             | Medium   | I'll type the display name then have to type the slug again. Auto-slug with an override is standard; making me do it twice is wasted keystrokes. |
| 23  | Copy & Labels | No empty-state copy and no visible list of existing authors below the form — just the form and a divider.                         | Medium   | I can't tell if authors already exist or confirm my create worked without a list. Feels like a write-only form.                                  |

### /admin/pages/redirects (Redirects)

**Gut feel: 3/5** — "Clean inline create row with a sensible 301 default and a results table, but the table is empty with no empty-state guidance and there's no bulk import for redirects."

| #   | Category      | Finding                                                                                                                                | Severity       | Why this matters to me                                                                                                                 |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | Forms & Input | Status defaults to "301 permanent" and source/destination have realistic placeholder examples — good smart defaults.                   | Low (positive) | The most common case (301) is pre-picked. That's the right default; I can create a redirect in seconds.                                |
| 25  | Copy & Labels | Redirect results table renders headers (OLD PATH / DESTINATION / STATUS / SOURCE / CREATED) with zero rows and no empty-state message. | Medium         | A bare header row with nothing under it reads as "did it not load?" Tell me "No redirects yet."                                        |
| 26  | Forms & Input | One-at-a-time inline form only — no bulk paste / CSV import for redirects.                                                             | Medium         | During a domain cutover I'm adding dozens of redirects. Entering them one row at a time with a mouse-click submit each time is a slog. |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 4/5** — "Actually a power-user gift: one long scrollable page showing every block variant's picker preview vs real render side by side — fast to scan, no clicking through a picker to compare."

| #   | Category          | Finding                                                                                                                                                 | Severity       | Why this matters to me                                                                                                              |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 27  | Navigation & Flow | Single long-scroll comparison of all block variants (heroes, text, cards, FAQ, video, forms) with clear section labels — no clicking required to audit. | Low (positive) | This is how I want to evaluate blocks: everything on one page, scroll, done. Whoever built this gets how power users work.          |
| 28  | Navigation & Flow | It's an extremely long page (18k+ px) with no in-page jump nav / anchor index to leap to "Forms" or "Cards".                                            | Medium         | At this length I want a sticky TOC or `Cmd+F`-friendly anchors. Scrolling 18,000px to find the form block is the one friction here. |
| 29  | Visual & Layout   | Mobile view stacks each block's picker preview cleanly with HERO/STANDARD labels — degrades fine.                                                       | Low (positive) | Comparison still readable on a phone. Fine.                                                                                         |

## Blockers

None. Nothing here stops me from getting work done. The closest thing to a blocker is the silent "Could not copy link." failure (#12) — if that's reproducible it crosses into Critical, but as observed it's a High-severity reliability flag, not a hard stop.

## My Top 10 Issues

1. **No keyboard shortcuts anywhere in the editor** (#14) — no Cmd+S, no shortcut to toggle Blocks/SEO/Preview panels. The single biggest thing keeping this from being a fast tool.
2. **Block reordering is up/down arrow clicks, no drag-and-drop** (#13) — moving a block several positions is a multi-click grind on a _page builder_, the one tool where drag-reorder is mandatory.
3. **"Could not copy link." — a copy action silently failed** (#12) — clipboard actions must be bulletproof; a quiet failure on "Copy public URL" erodes trust immediately.
4. **List search requires a separate "Search" button** (#1) — no live filter / obvious Enter-to-search; friction on the action I do most.
5. **No global keyboard nav / command palette** (#2) — no `/` to focus search, no `Cmd+K`. The whole app is mouse-target hunting.
6. **"Avatar asset ID" is a raw text field** (#21) — make me paste an opaque internal ID instead of picking from media. Classic avoidable friction.
7. **Row actions buried in a 3-dot kebab** (#4) — every duplicate/publish/archive is an extra click; inline hover actions would halve the clicks.
8. **Create-page is a mandatory two-grid selection gate with dead "Coming soon" tiles** (#7, #9) — extra step before building, and two large disabled tiles waste prime screen space.
9. **No bulk redirect import** (#26) — during a cutover I need to add many redirects; one-row-at-a-time with a click-submit each is painfully slow.
10. **18k-px Block Audit page has no jump nav** (#28) — great concept, but give me a sticky TOC/anchors so I'm not scrolling forever to reach a specific block.

---

**Final note:** File written to `reports/ux-persona-review/personas/02-power-user.md`. Overall gut feel **3/5** — competent, clean, and the autosave/status feedback is genuinely good, but it's relentlessly mouse-first and never tries to make a power user faster. My top 3 concerns: (1) zero keyboard shortcuts in the editor (no Cmd+S, no panel toggles), (2) block reordering by clicking tiny up/down arrows with no drag-and-drop, and (3) a copy-to-clipboard action that silently failed ("Could not copy link.").
