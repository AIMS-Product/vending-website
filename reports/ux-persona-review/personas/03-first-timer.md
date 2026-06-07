# Persona Review: Sam — First-Time Visitor

## Summary

- Pages reviewed: 6
- Issues found: 28
- Blockers: 2
- Overall gut feel: 2.5/5

> I clicked a link and landed in something called "Studio / Admin CMS." Some screens
> told me what they were for in one line, which I appreciated. But the moment I opened
> the actual page builder I had no idea what I was looking at, what "readiness," "governance,"
> or "block" meant, and there was no tour, no "start here," and no explanation of the jargon.
> I'd have bounced inside 10 seconds on the editor screen. The list, authors, and redirects
> screens are calmer and clearer.

---

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 3/5** — "I can tell it's a list of pages and there's a big blue 'New SEO page' button, but I don't actually know what 'SEO page' means or why I'd make one."

| #   | Category          | Finding                                                                                                                                                                                                                             | Severity | Why this matters to me                                                                                                                           |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Copy & Labels     | The product is called "Studio" / "Admin CMS" with no one-line statement of what the whole tool is or who it's for. The subhead "Manage structured SEO pages with the same CMS shell ready for resource content" is internal jargon. | High     | I clicked a link with zero context — "the same CMS shell ready for resource content" means nothing to me and doesn't tell me what I can do here. |
| 2   | Copy & Labels     | "SEO page," "keyword," "governance," "readiness" appear as column headers with no tooltip or explanation.                                                                                                                           | High     | I don't know what "governance" or "readiness" measure, so the most data-rich part of the table is noise to me.                                   |
| 3   | Feedback & State  | The status filter chips (Needs review, Updating, Needs links, Metadata issues, Scheduled, Schedule failed) assume I already understand the page lifecycle.                                                                          | Medium   | As a newcomer these read like error codes; I can't tell which are problems vs normal states.                                                     |
| 4   | Navigation & Flow | The clearest "do something" action for a first-timer is "New SEO page," but there's no onboarding hint pointing me to it or explaining what happens after.                                                                          | Medium   | I'd want a nudge — "Start by creating your first page" — instead of guessing the blue button is the main path.                                   |
| 5   | Visual & Layout   | The READINESS and STATUS columns use single-letter colored circle badges ("+", "D") with no legend.                                                                                                                                 | Medium   | A colored "D" circle tells me nothing; I can't decode the page's state at a glance.                                                              |
| 6   | Trust & Safety    | The kebab (three-dot) ACTIONS menu hides what are likely destructive options (duplicate/publish/archive per the log) behind an unlabeled icon.                                                                                      | Low      | I'm cautious clicking a mystery menu when I don't know if something irreversible is inside.                                                      |
| 7   | Copy & Labels     | "super_admin access" badge top-right is developer-speak shown to the user.                                                                                                                                                          | Low      | It reads like leaked internal role plumbing, slightly eroding the "polished product" feeling.                                                    |

### /admin/pages/new (Create New Page)

**Gut feel: 4/5** — "This is the best-explained screen — clear title, each option has a plain-English description, and the live 'Selected setup' panel told me exactly what I'd get."

| #   | Category         | Finding                                                                                                                                                           | Severity | Why this matters to me                                                                                  |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| 8   | Copy & Labels    | The intro "Choose the page path first so the builder can start with scoped templates and AI context" uses jargon ("page path," "scoped templates," "AI context"). | Medium   | The card descriptions are great, but the one sentence meant to orient me is the one I don't understand. |
| 9   | Feedback & State | Two options ("From template," "AI-assisted template") are greyed with "Coming soon" but still look like clickable cards.                                          | Low      | Mild tease — I might try clicking them and feel stalled, though the label does soften it.               |
| 10  | Forms & Input    | "Start building" is the commit action but there's no indication of how much work follows or whether I can back out.                                               | Low      | As a first-timer I hesitate to commit when I can't see what's on the other side of the button.          |
| 11  | Visual & Layout  | On mobile the right-hand "Selected setup" summary panel disappears below the fold, so the live confirmation of my choice is lost on phones.                       | Medium   | On mobile I lose the one element that reassured me I picked the right thing.                            |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 1/5** — "I opened this and was instantly overwhelmed — three dense panels, jargon everywhere, an 'AI' bubble, and no 'here's how this works.' I'd leave."

| #   | Category                  | Finding                                                                                                                                                                                | Severity | Why this matters to me                                                                                                    |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| 12  | Visual & Layout           | Three-column wall of controls (block outline, live preview, SEO/readiness/publish sidebar) loads at once with no progressive disclosure or first-run tour.                             | Blocker  | I have 10 seconds and zero context; this screen gives me nothing to anchor on and I'd bounce immediately.                 |
| 13  | Copy & Labels             | "Readiness and publish," "Governance comments," "Revision history," "Next required step," "Opportunities," "draft · SEO Opportunities" — heavy CMS/SEO vocabulary with no definitions. | Blocker  | I literally cannot tell what most of these sections do; the page assumes I already run an SEO content operation.          |
| 14  | Copy & Labels             | "Block," "section," "eyebrow" are core to the builder but never explained for a newcomer.                                                                                              | Critical | If I don't know what a "block" or "eyebrow" is, I can't add or edit content — the primary job is gated behind vocabulary. |
| 15  | Navigation & Flow         | The top bar offers "Pages, Blocks, Save draft, Live preview, Copy editor link, Copy public URL, SEO" with no clear "what do I do first."                                               | Critical | Six peer actions and no obvious starting point — I freeze rather than act.                                                |
| 16  | Feedback & State          | A floating purple "AI" bubble appears with no label of what it does or that it's safe to press.                                                                                        | Medium   | Mystery floating buttons make me wary; I don't know if it'll rewrite my whole page.                                       |
| 17  | Forms & Input             | The SEO sidebar exposes ~50 fields (canonical URL, noindex, structured data, funnel stage, topic cluster, lifecycle, review period). None marked optional vs essential for a beginner. | Critical | This looks like a tax form. As a first-timer I can't tell which 2 fields matter and which 48 I can ignore.                |
| 18  | Copy & Labels             | "Add page content" and "Add card" are decent, but adjacent icon-only controls (move, eye/hide, kebab) are unlabeled.                                                                   | High     | I can't tell what the eye icon or the up/down arrows do without clicking and risking breaking the page.                   |
| 19  | Feedback & State          | "Drafts save automatically. Use Save draft to save manually." — contradicts itself (auto AND manual) without saying why I'd ever need manual.                                          | Medium   | Mixed message makes me unsure whether my work is actually being saved.                                                    |
| 20  | Trust & Safety            | A big blue "Publish" button sits in the sidebar; for a newcomer it's unclear this pushes content live to the public site.                                                              | High     | I might publish a half-finished test page to the real website because nothing warns me it's a live, public action.        |
| 21  | Accessibility & Inclusion | At default zoom the right sidebar text and the preview are dense and small; the mobile view stacks everything into a long scroll with floating pills overlapping content.              | Medium   | On my phone the "AI" pill overlaps the body text and the layout feels cramped and hard to read.                           |
| 22  | Visual & Layout           | The thumbnail load screenshot shows everything crammed to near-illegibility at first paint.                                                                                            | High     | First impression is "this is for experts," which is exactly when a brand-new user gives up.                               |

### /admin/pages/authors (Authors)

**Gut feel: 3/5** — "Clean form, and the one-line subhead actually explained the point, but it drops me straight into a blank create form with no list and no example."

| #   | Category      | Finding                                                                                                                                        | Severity | Why this matters to me                                                                               |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| 23  | Copy & Labels | "Avatar asset ID" expects me to paste an ID with no picker, no explanation of where to get one, and no example.                                | High     | I have no idea what an "asset ID" is or where to find one — this field is a dead end for a newcomer. |
| 24  | Forms & Input | Required fields (Display name, Slug) aren't visually marked as required on screen; "Slug" itself is jargon with no helper text.                | Medium   | I don't know what a "slug" is or that I must fill it, so I'd hit an error I didn't see coming.       |
| 25  | Copy & Labels | No empty state or existing-authors list — the page is just a form, so I can't tell if authors already exist or what a finished one looks like. | Medium   | Without an example I'm guessing at what good input looks like.                                       |

### /admin/pages/redirects (Redirects)

**Gut feel: 2/5** — "I have genuinely no idea what a redirect is or why I'd create one — this page assumes I'm a technical web person."

| #   | Category      | Finding                                                                                                                                                  | Severity | Why this matters to me                                                                     |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| 26  | Copy & Labels | "Create and inspect builder redirects across page prefixes" — every word here assumes web/SEO knowledge I don't have.                                    | High     | As a first-timer this is the most opaque screen; I can't tell if it's even relevant to me. |
| 27  | Forms & Input | Fields "Old path," "Destination," "Status (301 permanent…)," "Page ID" expect technical URL/HTTP knowledge with no explanation of what 301 vs 302 means. | High     | "301 permanent" is HTTP jargon; I'd be afraid to pick the wrong one and break a link.      |
| 28  | Copy & Labels | Empty table with headers but no empty-state message ("No redirects yet — here's what one does").                                                         | Medium   | A blank table under jargon headers leaves me with nothing to learn from.                   |

---

## Blockers

1. **Editor information overload (Issue #12)** — The page builder editor loads three dense panels of controls and data with no first-run tour, no "start here," and no progressive disclosure. A brand-new user has nothing to anchor on and would bounce within seconds.
2. **Unexplained CMS/SEO vocabulary on the editor (Issue #13)** — "Readiness," "Governance," "Next required step," "Opportunities," "blocks," "eyebrow," "noindex," "topic cluster," "funnel stage" appear with zero definitions. The core workflow is gated behind specialist language a first-timer cannot decode.

---

## My Top 10 Issues

1. (Blocker) Page builder editor is a three-panel wall of controls with no onboarding or "start here" — instant bounce. (#12)
2. (Blocker) Pervasive CMS/SEO jargon on the editor with no definitions or tooltips — "readiness," "governance," "blocks," "eyebrow." (#13)
3. (Critical) ~50 SEO sidebar fields with no separation of essential vs optional for a beginner — looks like a tax form. (#17)
4. (Critical) Core builder concepts "block," "section," "eyebrow" never explained — can't add content without the vocabulary. (#14)
5. (Critical) Editor top bar shows six peer actions with no obvious first step. (#15)
6. (High) "Publish" button doesn't clearly warn it pushes content live to the public site. (#20)
7. (High) No top-level statement of what "Studio / Admin CMS" is or who it's for — I land with zero context. (#1)
8. (High) "Avatar asset ID" and "Slug" fields with no picker, example, or explanation of where values come from. (#23)
9. (High) Redirects screen assumes HTTP/SEO expertise (301 vs 302, "page prefixes") with no plain-English help. (#26, #27)
10. (Medium) READINESS/STATUS use single-letter colored badges with no legend on the list. (#5)

---

**File written:** `reports/ux-persona-review/personas/03-first-timer.md`
**Overall gut feel:** 2.5/5
**Top 3 concerns:** (1) The page builder editor is an instant-bounce wall of controls with no onboarding; (2) specialist CMS/SEO jargon ("readiness," "governance," "blocks," "eyebrow," "slug," "301") is everywhere with no definitions; (3) no top-level explanation of what the tool is or what a first-timer should do first.
