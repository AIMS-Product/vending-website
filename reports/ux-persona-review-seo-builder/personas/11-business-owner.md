# Persona Review — Priya, Overwhelmed Small Business Owner (39)

> I run a bakery. I do the orders, the marketing, the books, the staff roster — all of
> it, between serving customers. I've got maybe 10 minutes before the next person walks
> in. I am not here to learn a tool. I'm here to put a page up, get it live, and get back
> to the counter. If this thing makes me think hard or makes me lose work, I'm out.

Scope: SEO Page Builder only (`/admin/pages` and children). Evidence cited from the
exploration log, journey log, text extracts, axe results, and screenshots in
`reports/ux-persona-review-seo-builder/`.

---

## Part 1 — Journey Review (Category 0)

The headline question for me: **could I get a page live in one 10-minute window, and
what happens if a customer interrupts me halfway through?** That second part is my whole
life, so I weighted "what happens when I'm interrupted" heavily.

### Journey 1 — create-first-page — **Score: 3/5**

I got there, but it took 13 clicks and a 3-step wizard before I could even type a word
(journeys.md: "Clicks: 13 | Page loads: 3"; step "3-step choice gate (Resource → Blank
page → Start building)"). For someone who just wants to make a page, three screens of
"what kind of page are you creating?" before the editor feels like overhead. The good
news: the empty editor actually tells me what to do — "Add your first block below: a hero
or text section to introduce the page. A CTA or lead-form block is required before you can
publish." (screenshot `admin-pages-new-013-editor-unsaved.png`). That sentence is the most
helpful thing in the whole builder. **Justification:** I completed it and the empty state
guided me, but the wizard front-loads decisions I don't care about before I can start.

### Journey 2 — publish-and-view-live — **Score: 1/5**

This is where I would have given up. To publish, the tool blocks me and reveals the
reasons **one at a time** in a tiny chip, in language I don't understand. First it said
"Fix SEO title" (screenshot `journey-publish-and-view-live-02-read-publish-blocker.png`)
— but the SEO title field literally says "Leave blank to use page headline"
(text extract line 304), so I'm being told to fix a field the tool says I can leave blank.
Then after I dealt with that, it said "Fix content 1 · Cta Label", then "Fix content 1 ·
Destination URL" — and that Destination URL field isn't even on the page I'm looking at;
it's hidden inside a block settings pop-up (journeys.md: "the destination field is NOT on
the canvas; it lives in Block actions → Edit settings modal"). I'd have hunted for that
until my 10 minutes were gone. **Justification:** publish is a whack-a-mole of one-at-a-time
blockers in internal jargon, with a required field hidden in a sub-menu — this is the single
worst part of the whole tool for me.

### Journey 3 — preview-draft — **Score: 4/5**

One click, preview opened in a new tab (journeys.md: "Clicks: 1 | Page loads: 1"). This
is how everything should work. **Justification:** fast, obvious, did exactly what I expected.

### Journey 4 — revision-restore — **Score: 2/5**

The thing that scares me: **saving a draft does not create a restore point.** The revision
panel says "Revisions appear after publishing, library refreshes, or draft restores."
(journeys.md). So if a customer interrupts me, I come back, and I accidentally wreck my
draft before I've ever published — there's no "undo" at the page level. For me, who works
in interrupted bursts, that's exactly when I'd lose work. After publishing it worked fine.
**Justification:** restore only exists after publish, which is the opposite of when an
interrupted user needs it.

### Journey 5 — schedule-publish — **Score: 1/5**

I filled in a date and time to schedule the page, hit save, and the field went **blank
with no confirmation anywhere** that a schedule existed (journeys.md: "the field re-rendered
EMPTY and no 'Scheduled for …' status appeared"). I would have no idea whether my page is
scheduled or not — and that's the kind of uncertainty that makes me not trust the tool with
anything important. On top of that the help text says "Uses Pacific Time (America/Los_Angeles)"
(screenshot `journey-schedule-publish-05-verify-scheduled.png`) — I'm Australian, so I'd have
to do timezone maths in my head to schedule a 9am post. **Justification:** I can't tell if my
schedule saved, and the timezone is wrong for me — I'd never rely on this.

### Journey 6 — create-redirect — **Score: 3/5**

Creating the redirect was quick (2 clicks + form). But there's **no way to delete or edit a
redirect once it's made** (exploration-log.md: "Redirects table has no delete/edit controls
— created redirects cannot be removed from this UI"). If I fat-finger a path between customers,
that mistake is permanent from where I'm sitting. **Justification:** easy to create, impossible
to fix — exactly the kind of one-way door an overwhelmed person dreads.

### Journey 7 — find-duplicate-archive — **Score: 3/5**

Search found my page, duplicate and archive both worked with a confirm dialog. But archiving
is one row at a time with no bulk select (journeys.md), and the duplicate came out named "Copy
of {title}" with a random slug "draft-4020bd0f" that I'd have to clean up. **Justification:**
functional with confirmations, but tidying up is fiddly and per-row.

**Journeys summary:** I could only _cleanly_ complete preview and (barely) create-first-page.
Publish and schedule — the two things that actually get my page in front of customers — are
where I'd give up.

---

## Part 2 — Per-Page Review

### `/admin/pages` (Pages list) — **Gut feel: 3/5**

The top summary cards (All / Drafts / Published / Archived) are genuinely good for me — I can
glance and see "1 published, 4 drafts" without thinking (screenshot `admin-pages-001-load.png`).
But then there are **two rows of filters I don't understand**: a status row (All/Drafts/Published/
Archived) AND a "workflow" row with "Needs review", "Updating", "Needs links", "Metadata issues",
"Scheduled", "Schedule failed" (text extract lines 66-72). That's 7 more buttons of jargon. I
don't know what "orphaned" / "Needs links" means and I don't have time to find out. The readiness
column is just **coloured dots with no legend** — a red dot, an amber dot, a blue dot, and I have
no idea which is worse (screenshot `admin-pages-001-load.png`, readiness column). For someone whose
cognitive load is maxed, the dots add anxiety without information.

- **Navigation & Flow:** Two parallel filter rows compete for attention; unclear which is primary.
- **Copy & Labels:** "Needs links", "Updating", "Metadata issues", "Schedule failed" are internal
  terms with no explanation.
- **Visual:** Readiness dots have no legend — colour alone, no label.

### `/admin/pages/new` (Create page wizard) — **Gut feel: 3/5**

Clear, but it's a 3-screen gate before I can type. The page-type cards (SEO/Blog/Landing/Video)
are well written (text extract lines 24-31). The empty editor's guidance is excellent. My problem
is purely that it's three steps of choosing before doing.

### `/admin/pages/{id}` (Page editor) — **Gut feel: 2/5**

This screen is **overwhelming.** On the right I count: a readiness chip, a publish-status dropdown,
Page title, Slug, Target keyword, SEO title, Meta description, Advanced SEO, a "Search Preview"
card, then EIGHT scored rows (Search visibility / Search result / Page content / FAQ help / Internal
links / Images / Enquiries / Trust proof), then an "Action Items" list of seven items, then Media
assets, Approved claims, an AI button, Revision history, Draft preview, and Governance comments
(text extract lines 44-198). I just want to type my page and publish. Instead I'm staring at an SEO
audit dashboard. The label "Improve SEO title" (text extract line 53) sits right next to the publish
button as if it's blocking me, but I don't know if it's a warning or a hard stop.

- **Copy & Labels:** "Governance comments", "Approved claims and CTAs", "Internal links" readiness —
  agency/marketing jargon I don't use.
- **Visual:** No clear "do this first" hierarchy — every panel looks equally important.
- **Feedback & State:** The "Improve SEO title" link next to Publish doesn't tell me whether I _can_
  still publish or not.

### `/admin/pages/redirects` — **Gut feel: 3/5**

Clean form, plain-English status labels ("Permanent move (301)", text extract line 36). The killer
is no delete control (covered in Journey 6).

### `/admin/pages/{id}/revisions/{rev}` — **Gut feel: 4/5**

Simple read-only preview with a "Back to editor" link (text extract lines 7-11). Nothing scary here.

### Published page `/resources/...` & draft preview — **Gut feel: 4/5**

The actual public page renders cleanly with my hero, CTA and FAQ (screenshot
`resources-ux-seo-review-test-1781071765035-001-load.png`). The end result is fine — it's the road
to get there that's the problem.

---

## Findings

| #   | Page                   | Journey               | Category          | Finding                                                                                                                           | Evidence                                                                                                                                  | Severity                              | Suggested Fix                                                                                                             | Rationale                                                                                            |
| --- | ---------------------- | --------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | editor                 | publish-and-view-live | Forms & Input     | Publish blockers revealed one at a time in a tiny chip                                                                            | `journey-publish-and-view-live-02-read-publish-blocker.png` ("Fix SEO title")                                                             | Critical                              | Show a single checklist of ALL remaining blockers at once, each linking to its field                                      | I have 10 minutes; fixing one, re-clicking, finding the next, repeat, burns my whole window          |
| 2   | editor                 | publish-and-view-live | Copy & Labels     | "Fix SEO title" blocker contradicts the field's own helper "Leave blank to use page headline"                                     | text extract line 304                                                                                                                     | High                                  | Don't block on SEO title when it can fall back to the headline; reword to "Add the keyword to your headline or SEO title" | Being told to fix a field the tool says I can leave blank makes me distrust every message            |
| 3   | editor                 | publish-and-view-live | Forms & Input     | Required "Destination URL" blocker points at a field hidden in a block-settings pop-up, not on the canvas                         | journeys.md ("the destination field is NOT on the canvas; it lives in Block actions → Edit settings modal")                               | Critical                              | Surface the CTA destination field inline on the block, or make the blocker a deep-link that opens the right modal         | I'd hunt for a field that isn't where the error points and give up                                   |
| 4   | editor                 | schedule-publish      | Feedback & State  | After saving a scheduled publish the field blanks and no "Scheduled for…" status appears anywhere                                 | journeys.md ("field re-rendered EMPTY and no 'Scheduled for …' status appeared")                                                          | Critical                              | After save, show a persistent "Scheduled to publish {date} {time}" banner with a cancel button                            | If I can't see that my schedule saved, I can't trust the tool to publish while I'm serving customers |
| 5   | editor                 | schedule-publish      | Copy & Labels     | Schedule help text says "Uses Pacific Time (America/Los_Angeles)" for an Australian business                                      | `journey-schedule-publish-05-verify-scheduled.png`                                                                                        | High                                  | Use the business's local timezone (Australia) or let the admin pick; show the resolved local time                         | I'd have to do US timezone maths to schedule a morning post — I'll get it wrong                      |
| 6   | editor                 | revision-restore      | Trust & Safety    | Saving a draft creates no restore point; revisions only appear after publishing                                                   | journeys.md ("Revisions appear after publishing, library refreshes, or draft restores")                                                   | High                                  | Snapshot the draft on each save so a pre-publish mistake can be undone                                                    | I work in interrupted bursts — a wrecked draft before first publish is exactly when I need undo      |
| 7   | /admin/pages/redirects | create-redirect       | Trust & Safety    | No delete or edit control on created redirects — mistakes are permanent from the UI                                               | exploration-log.md ("Redirects table has no delete/edit controls")                                                                        | High                                  | Add a delete (with confirm) and edit action per redirect row                                                              | A fat-fingered path between customers becomes a permanent error I can't take back                    |
| 8   | /admin/pages           | —                     | Visual & Layout   | Readiness column is coloured dots with no legend                                                                                  | `admin-pages-001-load.png` (Readiness column: red/amber/blue dots, no labels)                                                             | Medium                                | Add a label or tooltip per dot ("Ready / Needs work / Blocked") and a small legend                                        | The dots make me anxious without telling me what action to take                                      |
| 9   | /admin/pages           | —                     | Copy & Labels     | Two parallel filter rows; workflow row uses jargon ("Needs links", "Updating", "Metadata issues", "Schedule failed")              | text extract lines 66-72                                                                                                                  | Medium                                | Collapse the workflow filters under a single "Filter" control with plain-language labels and tooltips                     | Seven extra jargon buttons add mental load when I just want to find my page                          |
| 10  | editor                 | create-first-page     | Visual & Layout   | Editor SEO panel is an information dump: readiness chip + 5 form fields + 8 scored rows + 7 action items + comments/governance/AI | text extract lines 44-198                                                                                                                 | High                                  | Default to a minimal "Title, content, publish" view; tuck the SEO audit behind an "SEO score" expander                    | I want to write and publish, not read an SEO audit dashboard before I can act                        |
| 11  | /admin/pages/new       | create-first-page     | Navigation & Flow | 3-step wizard (13 clicks) before any content can be entered                                                                       | journeys.md ("Clicks: 13                                                                                                                  | Page loads: 3"; "3-step choice gate") | Medium                                                                                                                    | Default to "Resource page" and drop straight into the editor with a one-line "change page type" link | Three screens of choices before I can type is overhead for a quick job |
| 12  | editor                 | publish-and-view-live | Feedback & State  | After "Changes published." toast, the inline confirm-publish card stays open asking to publish again                              | journeys.md ("'Changes published.' toast appears BUT the confirm card remains open"); `journey-publish-and-view-live-13-confirm-card.png` | Medium                                | Dismiss the confirm card on success and replace it with "Published ✓ — View live page"                                    | I can't tell if it actually published or if I need to click again, so I'd re-click and worry         |
| 13  | editor                 | publish-and-view-live | Navigation & Flow | No "Open live page" link shown after publishing in the default panel state                                                        | journeys.md ("No 'Open live page' link was visible after publishing… URL had to be typed manually")                                       | Medium                                | Show a "View live page" link in the success state after publish                                                           | After all that work I want one click to see my page, not to type a URL                               |

---

## Overall — **2/5**

The finished public page is fine and preview is genuinely quick, but the two journeys that
actually matter to me — getting a page **published** and **scheduled** — are where I'd give up.
Publish hides its blockers one at a time in jargon and points at a field that isn't on screen;
scheduling gives me no confirmation it saved; and saving a draft doesn't protect my work if a
customer interrupts me before I publish. For someone with 10 minutes and no patience for an SEO
audit dashboard, this is more cognitive load than I can carry.
