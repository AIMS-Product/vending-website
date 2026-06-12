# Persona Review: Tom — "Just Get It Done" Pragmatist

## Summary

- Pages reviewed: 6
- Issues found: 28
- Blockers: 1
- Overall gut feel: 2/5

I run a plumbing business. I came here to change some words on a web page and get
back to a job site. The list page and the simple forms are fine. But the actual
editor — the thing I'd actually use most — is a wall of 82 buttons and 58 boxes
that made me want to close the laptop and call my nephew. If the main job isn't
fast, the rest doesn't matter.

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 4/5** — "This page I get — one big blue button, a list, done."

| #   | Category          | Finding                                                                                                                                                                      | Severity       | Why this matters to me                                                                                                          |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Navigation & Flow | "New SEO page" is one clear blue button, list is right there — primary task is obvious                                                                                       | Low (positive) | This is how I want every screen: the thing I came to do is the biggest button.                                                  |
| 2   | Copy & Labels     | Six filter chips (Needs review, Updating, Needs links, Metadata issues, Scheduled, Schedule failed) plus four tabs plus a sort dropdown — that's a lot of knobs for one list | Medium         | I have one page in the list. All these filters are for someone who has 200 pages, not me — feels like clutter I'll never touch. |
| 3   | Copy & Labels     | Four stat cards (All / Drafts / Published / Archived) — useful at a glance, but "needs work" and "retired" are vague                                                         | Low            | "Needs work" on what? I'd want it to just tell me what to fix.                                                                  |
| 4   | Feedback & State  | The three-dot "Actions" menu is the only way to act on a row and it's tiny on the far right                                                                                  | Medium         | I almost missed it. Common actions (edit, publish) should be visible, not hidden behind dots.                                   |

### /admin/pages/new (Create New Page)

**Gut feel: 3/5** — "Two sets of choices before I can even start — just let me make a page."

| #   | Category          | Finding                                                                                                          | Severity | Why this matters to me                                                                                                        |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 5   | Navigation & Flow | Must pick a "Page type" AND a "Starting point" before "Start building" — two decisions before I've done anything | Medium   | I don't know the difference between a "Resource page" and a "Landing page." Just give me a sensible default and let me start. |
| 6   | Copy & Labels     | "Page type" descriptions are marketing-speak ("conversion path," "proof blocks")                                 | Medium   | I'm a plumber. "Conversion path" means nothing. Tell me "page that sells a service."                                          |
| 7   | Visual & Layout   | Two "Coming soon" cards (From template, AI-assisted) take up the whole bottom of the screen                      | Low      | Why show me two big boxes I can't use? It's wasted space advertising stuff that doesn't exist yet.                            |
| 8   | Forms & Input     | No back/cancel link visible on this screen                                                                       | Medium   | If I landed here by mistake I don't see an obvious way out without the browser back button.                                   |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 1/5** — "82 buttons and 58 boxes to change some text — this is exactly the kind of thing that makes me hate software."

| #   | Category                  | Finding                                                                                                                                                                        | Severity | Why this matters to me                                                                                                                                           |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | Visual & Layout           | Three columns crammed in: block outline on left, live page in middle, "Readiness and publish" + SEO + revision history + governance on the right                               | Critical | My eyes don't know where to land. I just want to click the text and type. Everything competes for attention.                                                     |
| 10  | Navigation & Flow         | Top bar alone has Pages, Blocks, Save draft, Live preview, Copy editor link, Copy public URL, SEO — seven controls before the content even starts                              | High     | Too many doors. "Copy editor link" vs "Copy public URL" — I have no idea which one to send my web guy.                                                           |
| 11  | Feedback & State          | There are TWO save concepts: "Save draft" button AND "Drafts save automatically" text at the bottom                                                                            | High     | So do I need to save or not? Mixed messages make me nervous I'll lose work. Pick one.                                                                            |
| 12  | Copy & Labels             | Right rail has "Readiness and publish," "Next required step," "Action items," "Builder support," "Governance comments," "Revision history" — corporate words for a one-man job | Critical | "Governance comments"? I'm the only one here. This is enterprise bloat I'll never use and have to scroll past every time.                                        |
| 13  | Forms & Input             | 58 input fields on one screen (SEO title, canonical URL, topic cluster, funnel stage, lifecycle, review period, OG title, structured data checkboxes...)                       | Critical | I need maybe three: page title, the words, and "publish." The other 55 are for an SEO specialist, not me.                                                        |
| 14  | Navigation & Flow         | Each block has "Move up / Move down / Remove / Edit settings / Hide eyebrow / Hide body / Hide cta / Block actions / Section and block actions"                                | High     | Two different "actions" menus per block plus a pile of hide/show toggles. I can't tell "Block actions" from "Section and block actions."                         |
| 15  | Copy & Labels             | "Eyebrow," "Card grid," "Rich text block," "CTA," "FAQ schema" — jargon everywhere                                                                                             | High     | "Eyebrow" is the little text above a heading? Nobody outside an office knows that. Plain words, please.                                                          |
| 16  | Feedback & State          | A floating purple "AI" bubble sits over the content                                                                                                                            | Medium   | One more mystery widget. Floats on top of what I'm reading. I don't know what it does and didn't ask for it.                                                     |
| 17  | Visual & Layout           | "Add page content" opens a modal with 9 content types and then 4 hero layout variations to choose from                                                                         | High     | I clicked "add content" and got hit with a second wall of choices. Standard vs Split vs Compact vs Editorial hero — just give me one and let me change it later. |
| 18  | Feedback & State          | Disabled "Up" and "Down" buttons appear on blocks with no explanation                                                                                                          | Medium   | Greyed-out buttons everywhere with no reason given. Is it broken or just the top item? I shouldn't have to guess.                                                |
| 19  | Trust & Safety            | "Publish" is a big blue button right next to draft notes, "Remove" buttons scattered through blocks                                                                            | High     | One wrong click and I've published a half-finished page or deleted a section. With this much crammed together, a mistake feels one slip away.                    |
| 20  | Accessibility & Inclusion | Tiny eye icons next to content for show/hide, small text labels everywhere                                                                                                     | Medium   | My eyes aren't 25 anymore. Lots of small icons and dense text — hard to hit the right thing on the first try.                                                    |

### /admin/pages/[id] (Editor — Mobile)

**Gut feel: 1/5** — "On my phone it's a pile of floating pill buttons — useless on a job site."

| #   | Category          | Finding                                                                                                                                            | Severity | Why this matters to me                                                                                                                                                           |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | Visual & Layout   | Mobile shows 7 floating pill buttons stacked at the top (Pages, Blocks, SEO, Save draft, Live preview, Editor link, Public URL) before any content | Blocker  | I do half my admin from my phone in the van. I can barely see the page for all the buttons, and editing a block this way would be a nightmare. This kills mobile editing for me. |
| 22  | Navigation & Flow | The right-rail publish/SEO panel is gone or buried on mobile — unclear how I publish from a phone                                                  | High     | If I can't finish and publish from my phone, the mobile view is just a preview, not a tool.                                                                                      |
| 23  | Feedback & State  | The purple "AI" bubble covers the bottom-left content on mobile                                                                                    | Medium   | On a small screen that floating bubble eats real estate I need for the actual words.                                                                                             |

### /admin/pages/authors (Authors)

**Gut feel: 4/5** — "Finally, a plain form — name, slug, bio, one button. This I can do."

| #   | Category      | Finding                                                   | Severity | Why this matters to me                                                                                                                    |
| --- | ------------- | --------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | Copy & Labels | "Slug" and "Avatar asset ID" with no hint of what to type | Medium   | "Avatar asset ID"? Where do I get an ID? I'd just leave it blank and hope. A "browse images" button would be obvious; an ID field is not. |
| 25  | Forms & Input | No placeholder examples in any field                      | Low      | Half a second of "oh, that's what goes here" saves me a wrong guess. The redirects page does this right; this one doesn't.                |

### /admin/pages/redirects (Redirects)

**Gut feel: 4/5** — "Clear table, example text in the boxes, one button. Good."

| #   | Category        | Finding                                                                                  | Severity       | Why this matters to me                                                                                                               |
| --- | --------------- | ---------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 26  | Copy & Labels   | "301 permanent / 302 temporary / 307 / 308" status codes in a dropdown                   | Medium         | I have no idea what those numbers mean. Default it to the right one and hide the rest, or say "use this one unless you know better." |
| 27  | Visual & Layout | Placeholder text in the path fields (/resources/old-page) actually shows me what to type | Low (positive) | This is the difference. Show me an example and I know what to do without thinking. The editor should learn from this page.           |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 2/5** — "A giant scrolling catalog of every block style — interesting, but why am I looking at this?"

| #   | Category          | Finding                                                                                                                        | Severity | Why this matters to me                                                                                                                                      |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | Navigation & Flow | An endless page showing every variation of every block (4 heroes, 4 text styles, 3 FAQs, 3 forms, etc.) with no action buttons | Medium   | This looks like an internal developer reference, not something I should ever see. If I landed here I'd be lost — no "use this" button, just scroll forever. |

## Blockers

- **#21 — Editor is unusable on mobile.** Seven floating pill buttons stacked over
  the content, no clear way to edit a block or publish from a phone, AI bubble
  covering the screen. I do real work from my phone in the van. If I can't make a
  quick text fix and publish on mobile, this tool fails at the one thing I'd use
  it for most.

## My Top 10 Issues

1. **Editor unusable on mobile (#21)** — floating button pile, can't realistically edit or publish from a phone. Blocker for a guy who works from a van.
2. **58 input fields to edit one page (#13)** — I need title, words, publish. The other 55 are specialist clutter I have to scroll past every single time.
3. **Right rail is enterprise bloat (#12)** — "Governance comments," "Action items," "Builder support," "Revision history." I'm a one-man shop; none of this applies to me.
4. **No clear visual hierarchy in the editor (#9)** — three competing columns, my eyes don't know where to go. I just want to click text and type.
5. **Two conflicting save messages (#11)** — "Save draft" button vs "saves automatically." Mixed signals make me scared I'll lose work.
6. **Too many top-bar controls (#10)** — seven buttons before content; "Copy editor link" vs "Copy public URL" with no clue which is which.
7. **Jargon everywhere (#15)** — "Eyebrow," "Rich text block," "FAQ schema," "conversion path." Use plain words a tradesperson understands.
8. **Add-content is a wall of choices on a wall of choices (#17)** — 9 types, then 4 hero variations. Just give me a default and let me change it later.
9. **Two decisions before I can even start a page (#5)** — page type AND starting point, both in marketing-speak. Let me start and pick later.
10. **Hidden row actions on the list (#4)** — common actions buried behind a tiny three-dot menu on the far right. Make the things I do most visible.
