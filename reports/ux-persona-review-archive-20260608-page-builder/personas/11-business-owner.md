# Persona Review: Priya — Overwhelmed Small Business Owner

> I run a bakery. I have 10 minutes between customers, three browser tabs already open, and a
> head full of orders, payroll, and a supplier who hasn't called back. I came here to update
> one page on my website. I do not have the bandwidth to "learn the builder." Surface what
> matters, let me do the one thing, save my work if I get pulled away, and let me leave.

## Summary

- Pages reviewed: 6
- Issues found: 27
- Blockers: 0
- Overall gut feel: 3/5

The bones are good — autosave exists, there's a clear "next required step," and the page list
tells me what needs work. But the editor is a wall of 82 buttons and 58 fields, the create
flow makes me choose abstract "page types" before I've typed a single word, and several screens
assume I already speak SEO/CMS jargon (canonical URL, topic cluster, funnel stage, avatar
asset ID). On a busy morning that's the difference between "done in 4 minutes" and "I'll deal
with this later" — and "later" never comes.

---

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 4/5** — "This is the one screen here that respects my time — it tells me at a glance what needs work and gives me a big obvious 'New page' button."

| #   | Category                 | Finding                                                                                                                                                                  | Severity       | Why this matters to me                                                                                                                         |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual & Layout          | The four status cards (All / Drafts / Published / Archived) up top give me an instant read on where things stand. Clean hierarchy.                                       | Low (positive) | This is exactly what I need — I can see "1 needs work, 0 published" in one glance and know if I even need to be here today.                    |
| 2   | Copy & Labels            | Filter chips like "Needs review", "Updating", "Needs links", "Metadata issues", "Schedule failed" sit in a row with no explanation of what they mean or how they differ. | Medium         | I don't know if "Needs links" is urgent or cosmetic. I'll either ignore all of them (risky) or click each one to find out (time I don't have). |
| 3   | Copy & Labels            | The GOVERNANCE column shows "Drafting / Review: 6 mo / Needs links" stacked together. "Review: 6 mo" is ambiguous — reviewed 6 months ago? due in 6 months?              | Medium         | If a page is overdue for review I want to know NOW. Ambiguous dates make me stop and decode instead of act.                                    |
| 4   | Feedback & State         | READINESS and STATUS columns use small coloured dots/icons with no text label visible in the row.                                                                        | Medium         | I shouldn't have to learn a colour code. A busy owner reads words faster than decoding a blue circle vs an orange "D".                         |
| 5   | Navigation & Flow        | Authors and Redirects are tucked top-right as plain buttons, separate from the left nav.                                                                                 | Low            | Minor, but I'd hunt for "Authors" in the sidebar first and not find it.                                                                        |
| 6   | Visual & Layout (mobile) | On mobile the status cards stack into a tall vertical scroll; I have to scroll past All/Drafts/Published just to reach the actual page list.                             | Medium         | On my phone between customers, the thing I came for (the list) is buried below four summary cards.                                             |

### /admin/pages/new (Create New Page)

**Gut feel: 3/5** — "It looks tidy, but it makes me make two abstract decisions before I've done anything, and I don't actually know which one is right."

| #   | Category         | Finding                                                                                                                                                           | Severity | Why this matters to me                                                                                                                                             |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7   | Forms & Input    | I must pick a "Page type" AND a "Starting point" before I can do anything — but I just want to write a page. The mental model is the builder's, not mine.         | High     | I came to write about my new catering menu. "SEO / Resource vs Landing vs Video" is a decision I'm not equipped to make in 10 minutes and I'll fear picking wrong. |
| 8   | Copy & Labels    | "SEO / Resource page", "Landing page", "Funnel" thinking — the differences ("Long-form search page" vs "Campaign page for a focused offer") are marketing jargon. | High     | I don't know if my page is "long-form" or "a campaign." I'd guess, then worry I've locked myself into the wrong template.                                          |
| 9   | Trust & Safety   | Nothing tells me whether the Page type / Starting point can be changed later.                                                                                     | High     | If this is a one-way door, I'm paralysed. If it's not, say so — "You can change this later" would let me just pick one and move on.                                |
| 10  | Feedback & State | Two big cards ("From template", "AI-assisted template") are greyed with "Coming soon".                                                                            | Low      | Fine that they're disabled, but they take up the bottom third of the screen with features I can't use — visual noise on a decision screen.                         |
| 11  | Copy & Labels    | "Choose the page path first so the builder can start with scoped templates and AI context."                                                                       | Medium   | "Scoped templates and AI context" means nothing to me. Tell me the benefit in plain words: "Pick a type so we start you with the right sections."                  |
| 12  | Forms & Input    | No name/title field on this screen at all — I select abstractions but never type what the page actually IS.                                                       | Medium   | I'd expect step one to be "What's this page called?" That's the thing in my head. Instead I'm sorting it into categories first.                                    |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 2/5** — "82 buttons, 58 fields, three columns — this is the opposite of '10 minutes between customers'; I'd freeze the moment it loaded."

| #   | Category                  | Finding                                                                                                                                                                                                     | Severity       | Why this matters to me                                                                                                                                                       |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | Visual & Layout           | The editor is a dense three-pane wall: block outline left, live page centre, SEO/readiness/revision/governance right. The full-page load shot is overwhelming at a glance.                                  | Critical       | This is information overload incarnate. My cognitive load is already maxed; I don't know where to look first or what the ONE thing I need to do is.                          |
| 14  | Navigation & Flow         | The right rail crams Readiness, Search Preview, Action Items, Builder support, Revision history, Draft preview, AND Governance comments into one scroll.                                                    | High           | I just wanted to fix a typo. Now I'm scrolling past "Governance comments" and "Revision history" — features for a content team, not a solo owner.                            |
| 15  | Feedback & State          | POSITIVE: "Drafts save automatically" + a green "Draft saved." toast appears, and there's a clear "NEXT REQUIRED STEP — Ready to publish" panel.                                                            | Low (positive) | This is the single most reassuring thing in the whole tool. Autosave means if a customer pulls me away mid-edit, I don't lose work. That's huge for me.                      |
| 16  | Copy & Labels             | The SEO panel asks for: Target keyword, Canonical/Preferred URL, Topic cluster, Funnel stage, Lifecycle, Campaign, OG/Social title.                                                                         | High           | I have data for maybe two of these. The rest is jargon I'd have to Google. If any are required I'm blocked; if optional, nobody told me I can skip them.                     |
| 17  | Forms & Input             | 58 inputs and the required ones (Page title, Slug, internal note) are scattered among dozens of optional ones with no "required vs optional" visual grouping.                                               | High           | I can't tell what I MUST fill in to publish vs what's nice-to-have. I'll either over-fill (slow) or miss a required field and hit an error.                                  |
| 18  | Copy & Labels             | "Add page content" button opens a modal — but the same label "Add page content" appears many times down the outline, and there's also "Add card", "Add comment".                                            | Medium         | Repeated identical button labels make me unsure what each one adds and where.                                                                                                |
| 19  | Visual & Layout           | "Hide eyebrow / Hide body / Hide cta / Show eyebrow / Hide heading" toggles litter the block actions. "Eyebrow" is design jargon.                                                                           | Medium         | I don't know what an "eyebrow" is on a webpage. I'd be afraid to toggle it in case I break the layout.                                                                       |
| 20  | Feedback & State          | The "Save draft" click shows "Saving draft…" — good — but with autosave ALSO running, I'm unsure whether I even need to press Save draft.                                                                   | Medium         | Mixed signals. Tell me clearly: either it's all automatic, or Save draft does something extra. Right now I'd press it anxiously "just in case."                              |
| 21  | Visual & Layout (mobile)  | On mobile the editor collapses to floating pill buttons (Pages / Blocks / SEO / Save draft / Live preview / Editor link / Public URL) stacked over the page. The three panels become hidden behind toggles. | High           | Editing a structured page on my phone looks genuinely hard — tiny section controls, a floating "AI" bubble overlapping content. I'd give up and wait until I'm at a desktop. |
| 22  | Trust & Safety            | "Remove" buttons sit right next to "Up/Down" reorder arrows on cards, with no visible confirm in the static shot.                                                                                           | Medium         | One mis-tap near the reorder arrows and I delete a card. With my fat-finger phone taps between customers, that's a real risk.                                                |
| 23  | Accessibility & Inclusion | Block selection and the small eye (visibility) icons are tiny targets in a very dense layout.                                                                                                               | Medium         | Small tap targets + dense layout = errors when I'm rushing.                                                                                                                  |

### /admin/pages/authors (Authors)

**Gut feel: 3/5** — "Simple enough form, but the fields have no helper text and 'Avatar asset ID' is something I'd never know how to fill in."

| #   | Category        | Finding                                                                                                                              | Severity       | Why this matters to me                                                                                                                          |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | Forms & Input   | "Avatar asset ID" is a free-text field with no picker, no helper text, no "browse media" link visible.                               | High           | An "asset ID" is a developer concept. I have a photo, not an ID. I'd have no idea what to type and would just leave it blank, hoping that's OK. |
| 25  | Copy & Labels   | Fields (Display name, Slug, Role/title, Bio) have no required indicator in the desktop view and no explanation of what "Slug" means. | Medium         | "Slug" is jargon. I'd guess it's the web address bit, but I shouldn't have to guess.                                                            |
| 26  | Visual & Layout | Clean, uncluttered, one clear "Create author" button. The whole screen does one job.                                                 | Low (positive) | THIS is the kind of focused single-task screen I wish the editor felt like.                                                                     |

### /admin/pages/redirects (Redirects)

**Gut feel: 3/5** — "Clean and single-purpose, but I genuinely don't know what a redirect is or when I'd need one — it assumes knowledge I don't have."

| #   | Category        | Finding                                                                                                                               | Severity | Why this matters to me                                                                                                                                                           |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | Copy & Labels   | "Create and inspect builder redirects across page prefixes." No plain-language explanation of what a redirect is or why I'd want one. | High     | I don't know what this page is FOR. Without a one-line "Use this to send an old web address to a new one," I'd avoid it entirely — and maybe break links I should've redirected. |
| 28  | Forms & Input   | "Status" dropdown offers "301 permanent / 302 temporary / 307 / 308". The numbers are HTTP codes — pure developer jargon.             | Medium   | I'd have no idea which to pick. "Permanent" vs "temporary" I can just about reason about; the numbers are noise that makes me doubt myself.                                      |
| 29  | Visual & Layout | Empty redirect table shows just column headers with no "No redirects yet" empty-state message.                                        | Low      | A blank table makes me wonder if it's loading or broken. A friendly "No redirects yet" would reassure me.                                                                        |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 2/5** — "This is clearly a developer/QA tool — an endless scroll comparing 'picker preview' vs render; I have no idea why it's in my CMS or whether I should touch it."

| #   | Category          | Finding                                                                                                                                           | Severity | Why this matters to me                                                                                                                                                     |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | Navigation & Flow | This page is an enormous (18,000px tall) vertical audit of every block variant — clearly an internal QA/dev screen, not a task an owner would do. | Medium   | If I stumbled onto this I'd be lost and a little alarmed — "am I supposed to be here? did I break something?" It adds to my mental load just by existing in the same area. |
| 31  | Copy & Labels     | "Compare every picker preview against the real resource-page render using mocked block content."                                                  | Medium   | This sentence is 100% engineer-speak. Nothing here is for me; it should be hidden from non-technical roles.                                                                |
| 32  | Visual & Layout   | Mobile view is the same near-infinite scroll of preview/render pairs.                                                                             | Low      | On a phone this is an unusable scroll-marathon. Reinforces that it's not a real user-facing page.                                                                          |

---

## Blockers

None that hard-stop me from completing a task in the explored (non-destructive) state — autosave
and a working "Start building" / "Create" path exist on every screen. My pain is friction and
cognitive load, not broken functionality. The closest thing to a blocker is the **editor's sheer
density (Critical, #13)** combined with **unclear required-vs-optional SEO fields (#16, #17)** —
together those could realistically make me abandon the task and "come back later," which for an
overwhelmed owner is functionally a failure even though nothing is technically broken.

## My Top 10 Issues

1. **Editor is information overload (#13, Critical)** — 82 buttons / 58 fields / 3 panels on load. I freeze and don't know what the one thing I need to do is. This is the single biggest barrier to me using the tool in a 10-minute window.
2. **Can't tell required vs optional fields in the editor (#17, High)** — required fields are scattered among dozens of optional SEO fields with no visual grouping, so I either over-fill or hit a surprise error at publish.
3. **SEO panel is wall-to-wall jargon I have no data for (#16, High)** — canonical URL, topic cluster, funnel stage, lifecycle, OG title. I need plain language and a clear "you can skip these."
4. **Create flow forces abstract choices before I can start (#7, #8, High)** — picking "page type" and "starting point" in builder-speak before I've typed anything; I fear choosing wrong.
5. **No reassurance that early choices are reversible (#9, High)** — one "You can change this later" line on the create screen would unlock my paralysis.
6. **"Avatar asset ID" free-text field (#24, High)** — I have a photo, not an ID. Needs a media picker / browse link, not a developer field.
7. **Redirects page assumes I know what a redirect is (#27, High)** — no plain-language explanation; I'd avoid it and risk breaking old links.
8. **Mobile editing is impractical (#21, High)** — floating pills + hidden panels + tiny section controls; I'd abandon and wait for a desktop, which kills the "quick fix between customers" use case.
9. **Status/readiness shown as colour dots without labels (#4, High-ish/Medium)** — I shouldn't have to learn a colour and letter code; words read faster when I'm rushed.
10. **Save draft vs autosave sends mixed signals (#20, Medium)** — autosave is the best feature here, but the manual "Save draft" button makes me anxious about whether my work is actually safe.
