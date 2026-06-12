# Persona Review — 06 Rachel, the Skeptical Buyer

**Persona**: Rachel, 42, marketing director. Burned by SaaS that oversells. Reads the
fine print, wants proof, and will not hand a tool the keys to her company's public
pages until it shows me it's honest about what it actually did.

**Scope**: SEO Page Builder (`/admin/pages` and children).

**My headline question**: _Can I trust what this tool tells me, and will it stop me — or
at least warn me — before something half-baked or irreversible hits the live site?_

The short answer: the builder is capable, but it repeatedly tells me one thing while
doing (or not doing) another. Two of the highest-stakes actions — publishing and
scheduling — give dishonest or absent confirmation, and the one genuinely permanent
action (redirects) can't be undone. That's the exact pattern that makes me walk away.

---

## Category 0: Journey Completion

| #   | Journey                | Score | Justification                                                                                                                                                                                                                                                                                           |
| --- | ---------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | create-first-page      | 3     | I got a draft saved, but the canvas is all greyed placeholders with no cue they must be replaced, and the "Template" path dead-ends on "No templates created." Functional, not reassuring.                                                                                                              |
| 2   | publish-and-view-live  | 2     | Publish works _eventually_, but the readiness gate drips blockers one at a time in internal jargon, points me at a field that isn't on the canvas, and then — worst of all — shows "Changes published." while leaving an active "Confirm publish" button up. I could not tell if it actually published. |
| 3   | preview-draft          | 4     | One click, token preview opened in a new tab and rendered the draft. This is the one flow that behaved exactly as promised.                                                                                                                                                                             |
| 4   | revision-restore       | 2     | Restore works _after_ publishing, but there is no undo at all before the first publish — "Revisions appear after publishing…". The riskiest editing window has no safety net.                                                                                                                           |
| 5   | schedule-publish       | 1     | I scheduled a publish, saw only a generic "Draft saved." toast, and the field re-rendered empty with no "Scheduled for…" anywhere. I have no evidence my site is queued to go live. For an unattended action, that's disqualifying. The timezone is also Pacific for an Australian business.            |
| 6   | create-redirect        | 2     | The redirect was created, but there is no edit or delete control. A 301 — permanent and search-cached by design — cannot be removed from this UI. Creating something irreversible with no undo is a trust failure even though the form "worked."                                                        |
| 7   | find-duplicate-archive | 3     | Search, duplicate, and archive all have confirm dialogs (good), but the duplicate ships with a gibberish slug ("draft-4020bd0f") despite a readable title.                                                                                                                                              |

---

## Trust & Safety — where this tool loses me (weighted heaviest)

This is the category I'm here for, and it's where the builder is weakest.

**1. Publish confirms success while inviting a second publish (Critical).**
After I clicked "Confirm publish," the toast said **"Changes published."** — and yet the
inline confirm card stayed open, now reading _"This will make this draft visible at
/resources/…"_ → _"This will replace the current live version at
/resources/ux-seo-review-test-1781071765035."_ with a live blue **Confirm publish**
button still sitting there
(`journey-publish-and-view-live-09-after-publish.png`). So which is it — did it publish,
or do I still need to? A tool that says "done" and "click here to do it" at the same time
has just told me it doesn't reliably know its own state. An anxious user clicks again and
republishes.

**2. Scheduling gives no honest confirmation (Critical).**
Scheduling a page to publish _itself_ while I'm not watching is the single most
trust-dependent thing this tool offers. I entered a date/time, saved, and got a generic
**"Draft saved."** The Scheduled publish field came back **empty** ("dd/mm/yyyy, --:-- --")
and there is no "Scheduled for {date}" status anywhere
(`journey-schedule-publish-05-verify-scheduled.png`). I cannot confirm the schedule
exists. I'd never trust this — I'd publish manually, which kills the feature. The helper
text **"Uses Pacific Time (America/Los_Angeles)"** on an Australian business
(`journey-schedule-publish-04-save-schedule.png`) compounds it: even if it worked, I'd be
~17.5 hours off.

**3. Redirects are permanent from this UI (Critical).**
The redirects table has columns OLD PATH / DESTINATION / STATUS / SOURCE / CREATED and
**no Actions column** (`journey-create-redirect-05-verify-redirect-listed.png`;
exploration-log: _"Redirects table has no delete/edit controls — created redirects cannot
be removed from this UI."_). A typo'd 301 becomes an unremovable, search-cached redirect
on the live site. Creating irreversible public-facing records with no undo is a liability.

**4. Silent data loss leaving the editor (High).** Typed a title into a fresh editor,
navigated away, and it was discarded with **no** unsaved-changes warning
(exploration-log: _"navigated straight to /admin/pages with NO unsaved-changes warning —
typed title silently lost"_).

**5. No undo before first publish (High).** Revision history is empty for a draft —
_"Revisions appear after publishing, library refreshes, or draft restores."_ A mangled
unpublished draft cannot be rolled back. Recoverability is backwards: it protects me only
after I've already gone live.

What the tool does get right on safety: Duplicate and Archive both use confirm dialogs,
the draft preview is token-gated, and the publish gate does block genuinely incomplete
pages. The problem isn't a lack of guards — it's that the _confirmation_ of what happened
is unreliable.

---

## Copy & Labels

- **Two messages for one blocker.** The chip said **"Fix SEO title"** while the readiness
  panel said **"Add a hero headline before publishing."** at the same time (journeys.md).
  When a tool contradicts itself about what's blocking me, I stop trusting its read of my
  page.
- **Internal jargon as user copy.** Blockers read **"Fix content 1 · Cta Label"** and
  **"Fix content 1 · Destination URL"** — that's a database row, not guidance
  (`journey-publish-and-view-live-02-read-publish-blocker.png` shows the disabled Publish
  beside "Fix SEO title").
- **Placeholders that look like content.** A new page is all greyed "Hero headline" /
  "Hero body copy" / "CTA label" with no "replace before publishing" cue — that's how
  empty pages get shipped.

## Forms & Input

- **Blocker points at a hidden field.** "Fix content 1 · Destination URL" — but Destination
  URL is only inside Block actions → Edit settings → "CTA destination URL"
  (`journey-publish-and-view-live-11-block-settings-modal.png`). Told to fix a field I
  can't see, with no link to it.
- **Gibberish duplicate slug.** Title "Copy of UX SEO Review Test…" but slug
  "draft-4020bd0f" (`journey-find-duplicate-archive-03-duplicate-page.png`).

## Feedback & State

- The publish and schedule confirmation failures above are fundamentally feedback bugs:
  the success state doesn't honestly reflect what happened.
- **Readiness as colour-only dots.** The list's Readiness column is a bare coloured dot
  with no legend (`admin-pages-001-load.png`); the meaning ("SEO readiness: Needs work")
  exists only in the accessible name (admin-pages-text.md). I have to click every row.

## Navigation & Flow

- The 3-step create gate (Page type → Starting point → Ready to build) is clear and
  honest about where I am (`admin-pages-new-001-load.png`). Filters and status tabs on the
  list are sensible. Navigation is the strongest area — no complaints worth flagging
  beyond the editor's silent-exit data loss already noted.

## Visual & Layout

- Genuinely clean and intentional-looking: consistent cards, stable layout (CLS 0 on every
  page per exploration-log), designed empty/preview states. As a buyer the _look_ reassures
  me — which makes the behavioural dishonesty more jarring, not less.

## Accessibility & Inclusion

- Not my primary lens, but worth noting the editor carries axe violations
  (`aria-prohibited-attr` serious, `landmark-complementary-is-top-level`) and the revision
  preview duplicates `<main>` landmarks (axe-results.json). I read these as "QA isn't
  fully buttoned up," which feeds my skepticism.

---

## Gut Feel

| Page                       | Score | Justification                                                                                                                                                        |
| -------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| /admin/pages (list)        | 4     | Clean, scannable, good summary cards — only let down by colour-only readiness dots.                                                                                  |
| /admin/pages/new (gate)    | 4     | Clear 3-step wizard; the "Template" dead-end and silent-exit data loss keep it off 5.                                                                                |
| /admin/pages/{id} (editor) | 2     | Capable and good-looking, but the publish-confirm and schedule-confirm dishonesty are exactly what I distrust.                                                       |
| /admin/pages/redirects     | 2     | Works to create, but irreversible — no edit/delete on a permanent public-facing record.                                                                              |
| revision preview           | 3     | Renders correctly; the deeper issue (no pre-publish revisions) sits in the editor.                                                                                   |
| public published page      | 4     | Renders cleanly, CLS 0 — the output is fine; my trust issue is the path to get there.                                                                                |
| draft preview (token)      | 4     | The one flow that did exactly what it promised.                                                                                                                      |
| **Overall**                | **2** | A polished tool I don't yet trust: its two highest-stakes actions (publish, schedule) confirm dishonestly, and its one permanent action (redirects) can't be undone. |

---

## What would move me from 2 to 4

1. Make publish _settle_: dismiss the confirm card on success and show "Published · just
   now · View live page." Never leave a live Confirm button after the action completed.
2. Make scheduling _visible and honest_: keep the entered time, show "Scheduled to publish
   on {date} ({local tz})," and surface it on the list — in the business's timezone.
3. Make redirects _reversible_: add Edit/Delete with a confirm.
4. Guard the editor against silent data loss and give drafts a pre-publish undo.

Get those four right and this becomes a tool I'd actually trust with our public pages.
