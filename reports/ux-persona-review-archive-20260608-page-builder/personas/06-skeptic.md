# Persona Review: Rachel — Skeptical Buyer

> 42, marketing director. I've been sold "page builders" before. They demo
> beautifully, then I find out publishing is irreversible, the autosave ate my
> work, or "coming soon" features were the whole reason I bought. I read the fine
> print and I want proof before I trust this with our live marketing pages.

## Summary

- Pages reviewed: 6
- Issues found: 24
- Blockers: 0
- Overall gut feel: 3.5/5

Honest first impression: this is more polished and more honest than most CMS
tools I've evaluated. The status language ("This page is not live yet", "No hard
blockers remain", explicit draft badges) is genuinely reassuring — someone
thought about consequences. But there are real trust dents: a silent-ish "Could
not copy link" failure with no fix path, two prominent "Coming soon" tiles on the
very first creation screen, governance/revision panels that render empty with no
explanation, and a publish button I can reach without ever being told what
publishing actually does to a live URL. It feels maintained, not sketchy — but
not yet fully finished, and that's the gap between a 3.5 and a 5 for me.

---

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 4/5** — "Clear, honest status counts and a 'super_admin access' badge make this feel like a real, governed product — the row-level ⋮ menu hiding destructive actions is my only real worry."

| #   | Category          | Finding                                                                                                                                                                                                                | Severity       | Why this matters to me                                                                                                                       |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Trust & Safety    | Status tiles (All/Drafts/Published/Archived) with plain-language subtitles ("needs work", "publicly visible", "retired") are excellent — I instantly know what state my content is in.                                 | Low (positive) | This is the transparency I never get from SaaS demos; it earns trust on first glance.                                                        |
| 2   | Trust & Safety    | Row-level destructive actions (Duplicate/Publish/Archive) live behind a ⋮ icon with no labels visible until opened. I can't tell from the list whether Archive is reversible or whether Publish pushes live instantly. | High           | I won't trust a tool where the consequence of "Publish" is one un-narrated click away and I can't see the guardrail before opening the menu. |
| 3   | Copy & Labels     | "Published 0 publicly visible" alongside "Archived 5 retired" — I have 5 archived pages but 0 published. As a buyer evaluating this, that screams "nothing has ever successfully gone live here."                      | Medium         | Makes me question whether the publish flow actually works in production or just in the demo.                                                 |
| 4   | Feedback & State  | Governance column shows "Drafting / Review: 6 mo / Needs links" — useful, but "Review: 6 mo" is ambiguous (in 6 months? overdue by 6 months?).                                                                         | Medium         | Vague governance metadata undermines the credibility of the governance feature it's trying to sell me.                                       |
| 5   | Navigation & Flow | Lots of filter chips (Needs review, Updating, Needs links, Metadata issues, Scheduled, Schedule failed) with no counts on most — I can't tell which are populated without clicking each.                               | Low            | Minor, but empty-clicking to discover state is the kind of friction that adds up.                                                            |
| 6   | Visual & Layout   | "Sign out" button overlaps the floating "N" avatar/widget in the bottom-left on desktop.                                                                                                                               | Low            | Small visual collision, but on a paid tool it reads as "nobody QA'd this corner."                                                            |

### /admin/pages/new (Create New Page)

**Gut feel: 3/5** — "Clean choice architecture, but two 'Coming soon' tiles front-and-center on the first screen is exactly the kind of half-built oversell that makes me close the tab."

| #   | Category         | Finding                                                                                                                                                                                                                               | Severity       | Why this matters to me                                                                                                                                        |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Trust & Safety   | "From template — Coming soon" and "AI-assisted template — Coming soon" occupy a full row on the primary creation screen.                                                                                                              | High           | This is the #1 thing that burns me on SaaS — paying for a roadmap. Putting two greyed-out promises on the entrance screen signals the product isn't finished. |
| 8   | Forms & Input    | The "form-filled" screenshot is identical to the load screenshot — there are no text inputs here at all, just selectable cards. Yet the explorer attempted to "fill" it.                                                              | Medium         | I expected to name my page / set a slug at creation; deferring all that means I can't tell what I'm committing to before "Start building."                    |
| 9   | Copy & Labels    | "Choose the page path first so the builder can start with scoped templates and AI context." — but I'm choosing a _page type_, not a path. Mismatch between instruction and the actual control labels ("Page type", "Starting point"). | Medium         | If the copy doesn't match the controls on the very first screen, I distrust the labelling everywhere else.                                                    |
| 10  | Feedback & State | The two disabled "Coming soon" tiles are styled like clickable cards (border, hover affordance) — I'd try to click and get nothing, with no tooltip explaining when they'll ship.                                                     | Low            | Disabled-without-explanation is a recurring pet peeve; tell me _why_ I can't use it.                                                                          |
| 11  | Visual & Layout  | "SELECTED SETUP" panel correctly mirrors my choices (SEO/Resource page, Blank page) — good.                                                                                                                                           | Low (positive) | This live-summary-before-commit is reassuring; I know what I'm about to create.                                                                               |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 4/5** — "The status/readiness panel is the most trust-building thing in the whole product, but a swallowed 'Could not copy link' failure and empty Revision/Governance panels show the seams."

| #   | Category         | Finding                                                                                                                                                                                                                                                             | Severity       | Why this matters to me                                                                                                                                     |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | Trust & Safety   | "STATUS — draft / This page is not live yet. Save the draft now, then publish when it is ready." plus "NEXT REQUIRED STEP — Ready to publish / No hard blockers remain." This is genuinely excellent — it tells me exactly what state I'm in and what happens next. | Low (positive) | This is the proof I look for: the tool is honest about live-vs-draft and guards me from accidentally shipping.                                             |
| 13  | Trust & Safety   | "Could not copy link." appears in muted grey, stacked under "Preview link created." with no retry button, no error reason, no toast. It just sits there.                                                                                                            | High           | A payment/marketing tool that fails silently on a clipboard action makes me wonder what _else_ fails quietly — like a publish that half-completes.         |
| 14  | Feedback & State | Revision history section renders with the heading and "Versions appear after publishing, library refreshes, or draft revisions" but the panel body looks empty/unbuilt in the load shot.                                                                            | Medium         | I publish to live pages — version history is non-negotiable for rollback. An empty-looking history panel makes me doubt I can actually undo a bad publish. |
| 15  | Trust & Safety   | Governance comments section is present but the load screenshot shows it essentially blank with a form. No example, no existing threads, unclear who sees these.                                                                                                     | Medium         | "Governance" is a selling point; an empty, context-free comment box doesn't prove the governance workflow exists.                                          |
| 16  | Feedback & State | Save feedback is strong: "Saving draft..." → "Draft saved. Autosaved 3:51 PM", and "Opening preview...". Autosave is explicitly stated ("Drafts save automatically. Use Save draft to save manually.").                                                             | Low (positive) | Explicit autosave + manual save + timestamp is exactly what I want — my work won't vanish. This builds real trust.                                         |
| 17  | Copy & Labels    | The publish CTA ("Publish") is reachable in the right panel, but nothing on screen tells me what publishing _does_ — does it push to the live URL instantly? Is there a confirm step? A scheduled-publish field exists separately, which adds ambiguity.            | High           | I will not click "Publish" on a tool that hasn't told me whether it's reversible or instant on a public URL. The fine print isn't here.                    |
| 18  | Forms & Input    | "Hide from search engines" (noindex) and "Include in sitemap" are plain checkboxes with no warning copy. Toggling noindex on a live page is a serious SEO consequence.                                                                                              | Medium         | As a marketing director, an unguarded noindex toggle could silently tank organic traffic — I'd want a confirmation or warning.                             |
| 19  | Visual & Layout  | The desktop load screenshot is dense and slightly chaotic at full zoom (left blocks panel, center canvas, right SEO panel all competing). The "Rendering..." pill lingers bottom-left.                                                                              | Low            | Not broken, but the persistent "Rendering..." makes me unsure if the page ever finished loading.                                                           |
| 20  | Accessibility    | Many icon-only controls (eye/visibility toggles, ⋮ menus, move handles) — from the screenshots I can't confirm they have labels; 82 buttons is a lot of unlabeled-looking targets.                                                                                  | Medium         | Dense icon-only UIs are usually keyboard/screen-reader traps; a maintained product should prove otherwise.                                                 |

### /admin/pages/authors (Authors)

**Gut feel: 3/5** — "A bare create-form with no list of existing authors and no required-field markers — functional, but it doesn't look finished or prove anything was ever created."

| #   | Category        | Finding                                                                                                                                                                     | Severity       | Why this matters to me                                                                                                                |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | Visual & Layout | The page is just a form floating above a thin empty divider — no list of existing authors, no empty state ("No authors yet"). After "Create author" the result isn't shown. | High           | I can't tell if creating an author worked or where it went. An action with no visible result is the definition of "feels half-built." |
| 22  | Forms & Input   | Display name and Slug are required (per the log) but the labels show no asterisk or "required" marker on screen.                                                            | Medium         | Unmarked required fields mean I find out via an error — exactly the sloppy validation that erodes trust.                              |
| 23  | Copy & Labels   | "Manage public author identities separately from admin users." is a good clarifying line — tells me these are public-facing, not login accounts.                            | Low (positive) | Clear data-separation explanation; I know what I'm exposing publicly.                                                                 |

### /admin/pages/redirects (Redirects)

**Gut feel: 4/5** — "Sensible, honest redirect form with proper 301/302 options and a clear empty table — this is the most production-grade screen here."

| #   | Category         | Finding                                                                                                                                                                                 | Severity       | Why this matters to me                                                                                        |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| 24  | Forms & Input    | Status dropdown offers 301/302/307/308 with "permanent/temporary" labels — proper, correct redirect semantics. Placeholder examples (/resources/old-page → /blog/new-page) are helpful. | Low (positive) | Whoever built this understands SEO redirects; that's a real competence signal that builds buyer confidence.   |
| 25  | Feedback & State | Empty redirect table shows column headers (Old path, Destination, Status, Source, Created) but no empty-state message — just headers over blank space.                                  | Medium         | A bare header row with nothing under it looks like the feature is broken rather than simply empty.            |
| 26  | Trust & Safety   | No visible validation/guard against redirect loops or pointing a path at itself.                                                                                                        | Low            | I can't confirm from the screenshot, but a redirect tool without loop protection is a footgun on a live site. |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 4/5** — "An exhaustive gallery of every block in every variant is a strong proof-of-maintenance artifact — it shows the system is real, not vaporware."

| #   | Category        | Finding                                                                                                                                                                                         | Severity       | Why this matters to me                                                                                                                                     |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | Trust & Safety  | A full audit page rendering every block type (hero ×4, text ×4, image ×4, CTA ×3, FAQ ×3, cards ×3, proof, video ×3, form ×3) is genuinely reassuring — every component is real and renders.    | Low (positive) | This is the closest thing to "proof before I commit" in the product — I can see the actual building blocks exist and look consistent.                      |
| 28  | Copy & Labels   | This is clearly an internal/QA page (literally "Block preview audit") exposed under /admin with full sidebar nav. As a buyer I'd wonder why a dev test harness is shipped in the admin product. | Medium         | An internal audit tool left in the production admin reads as "unfinished housekeeping" — minor, but it's a fingerprint of a tool still under construction. |
| 29  | Visual & Layout | Across the long gallery the blocks look stylistically consistent (typography, button styling, spacing) — no obviously broken or mismatched variants.                                            | Low (positive) | Consistency across 30+ block variants tells me the design system is maintained, which is what I'm paying for.                                              |

---

## Blockers

None. Nothing here is broken to the point I cannot proceed. My concerns are
trust-and-finish issues, not hard stops. The closest things to deal-breakers
during a _real_ evaluation would be #17 (no explanation of what Publish does to a
live URL) and #13 (silent failure), but on these screenshots they fall short of
"cannot proceed."

## My Top 10 Issues

1. **(#7, High)** Two "Coming soon" template tiles on the primary Create-page
   screen — paying for a roadmap is my #1 SaaS burn signal.
2. **(#13, High)** "Could not copy link." fails quietly with no reason and no
   retry — if a clipboard action fails silently, what else does?
3. **(#17, High)** I can reach "Publish" without ever being told whether it's
   instant, reversible, or what it does to the live public URL. No fine print.
4. **(#2, High)** Destructive row actions (Publish/Archive) hidden behind an
   unlabeled ⋮ menu — I can't see the guardrails before I open it.
5. **(#21, High)** Authors page shows no list of existing authors and no result
   after creating one — an action with no visible outcome feels half-built.
6. **(#14, Medium)** Revision history panel looks empty/unbuilt — version history
   is non-negotiable for me if I'm publishing to live pages and need rollback.
7. **(#3, Medium)** "0 published / 5 archived" makes it look like nothing has
   ever successfully gone live — I'd ask for proof the publish flow works in prod.
8. **(#15, Medium)** Governance comments box is empty and context-free — doesn't
   prove the "governance" selling point actually functions.
9. **(#18, Medium)** Unguarded "Hide from search engines" (noindex) checkbox on a
   page that can be live — a quiet SEO footgun with no warning.
10. **(#28, Medium)** A dev "Block preview audit" harness shipped inside the
    production admin — small, but it's a fingerprint of an unfinished product.

---

**The good, in fairness:** the draft-vs-live status messaging (#12), explicit
autosave + manual save + timestamp (#16), the correct 301/302/307/308 redirect
semantics (#24), and the full block-audit gallery (#27) are all real
trust-builders. This is a maintained product with honest status language — it's
just carrying visible seams that a skeptic like me notices immediately.
