# Persona Review — Alex (Developer Who Judges Everything, 29)

Full-stack engineer. I keep the network tab and console open the whole time. I don't
care how pretty a panel is if it lies to me about state. The two things I hunt for are
**silent failures** (the app says nothing, or worse says "saved" when it didn't) and
**state dishonesty** (the UI shows a state that isn't true — a confirm dialog after the
action already happened, a field that re-renders empty after I saved it). This builder
has a genuinely impressive readiness engine sitting on top of a publish/save state
machine that is not honest at several key moments. That's the headline.

---

## Category 0: Journey Review

### Journey 1: create-first-page — **3/5**

Completable, but the very first thing I see in the network/console layer is a real
runtime error. During the create flow the console logged
`seo page autosave failed TypeError: Failed to fetch` thrown out of the Sentry
instrumentation wrapper (`journey-results.json` consoleErrors[3]). Autosave failed and
the only surface that tells me is a console line — the UI kept showing me a "saved"
affordance. A 13-click create flow (3-step wizard gate before I've typed anything) is
also more ceremony than a power user wants, but the autosave-failed-silently is what
drops this to a 3. The canvas is all placeholder text ("Hero headline", "Hero body
copy", "CTA label") with no signal that those are required for publish.

### Journey 2: publish-and-view-live — **2/5**

This is the worst journey from a state-honesty standpoint, and it's the one I'd open a
bug for first. Three separate problems:

1. **Stale confirm dialog after success.** After I clicked "Confirm publish", the chip
   flipped to "Published" and the toast read "Changes published." — yet the inline
   yellow "Confirm publish" card stayed open, now re-worded to "This will replace the
   current live version at /resources/ux-seo-review-test-1781071765035."
   (`journey-publish-and-view-live-09-after-publish.png`). The action succeeded and the
   UI is still asking me to perform it. A double-click there republishes.
2. **Blocker chip and readiness panel disagree.** The chip said "Fix SEO title" /
   "Improve SEO title" while the panel header said "SEO Needs work" and the readiness
   row said "Search result · Needs work" — three different strings for one gate, and the
   chip's "Fix SEO title" points at a field whose own placeholder says
   "Leave blank to use page headline" (`admin-pages-...-text.md` line 304). Telling me
   to fix a field that's explicitly optional is a logic bug.
3. **Blockers revealed one at a time** ("Fix content 1 · Cta Label" → then
   "Fix content 1 · Destination URL"), and the Destination URL field isn't on the
   canvas at all — it's inside Block actions → Edit settings. The blocker text gives no
   route to the field. The automated run literally got `blocked` here twice
   (`journey-results.json` / `-2.json`, blockedAt "click-publish").

### Journey 3: preview-draft — **4/5**

Clean. One click, token preview opens in a new tab and renders the draft
(`journey-preview-draft-preview-tab.png`). This is the part of the state machine that's
honest. Only knock: the preview token expiry ("Active - expires Jun 13") is shown but
there's no indication the preview reflects the _latest_ autosave vs last manual save.

### Journey 4: revision-restore — **2/5**

Two structural problems. First, **revisions don't exist until first publish** —
empty state "Revisions appear after publishing, library refreshes, or draft restores."
So a draft I mangle before publishing has no page-level undo. For a builder this is a
real data-loss exposure. Second, the automated pass got
`ERROR: no revision Preview link` and the restore step timed out
(`journey-results-2.json`, blockedAt "preview-revision"), and the revision preview page
has **no "Back to editor"** in one pass so the runner fell back to browser-back. The
revision preview route also throws three landmark axe violations including
`landmark-no-duplicate-main` — there are two `<main>` landmarks on that page
(`axe-results.json`).

### Journey 5: schedule-publish — **1/5**

The cleanest example of state dishonesty in the whole app. I filled
`2026-06-11T12:00` into "Scheduled publish" and saved. After save the field
re-rendered to `dd/mm/yyyy, --:-- --` — empty — and **no "Scheduled for …" status
appeared anywhere** (`journey-schedule-publish-05-verify-scheduled.png`). I cannot tell
from the UI whether my schedule was persisted or dropped. The only hint a schedule
might exist is a "Cancel scheduled publish" checkbox. The fact that the pages list even
has a "Schedule failed" filter — "Pages whose scheduled publish did not go through and
need attention" (`n11-pages-schedule-failed.png`; tab present in
`admin-pages-text.md` line 72) — tells me scheduled publishes fail silently as a known
class. And the field is labelled "Uses Pacific Time (America/Los_Angeles)" for an
Australian business. Blocked.

### Journey 6: create-redirect — **3/5**

Works, redirect lands in the table. But two engineering smells: on a validation error
("Path must be root-relative.", `admin-pages-redirects-011-form-invalid-submit.png`)
the form **clears my input** (exploration log: "values preserved: false"), and the
error is a single banner at the top of the form, not next to the offending field. And
there is **no edit/delete control** on the redirects table — a typo'd 301 is permanent
from this UI (exploration log, redirects Notes).

### Journey 7: find-duplicate-archive — **3/5**

Functional. Duplicate produces "Copy of {title}" with an auto slug like
`draft-4020bd0f` — a random hex slug rather than something derived from the source
slug, which is the kind of non-deterministic URL I'd push back on in review. Archive is
per-row only, no bulk select. Confirm dialogs are present, which I credit.

---

## Per-Page Review

### /admin/pages (Pages list) — **4/5**

Clean load (1446ms, CLS 0, 0 axe violations). URL state is sensible — every filter is a
real querystring (`?status=draft`, `?view=scheduled`, `?view=schedule-failed`), which I
like; it's shareable and back-button-safe. Tab order is logical. Only real issue is the
Actions column: each row's action menu renders as a bare `<img>` inside a `group` with
no cell-level text (`admin-pages-text.md` lines 226-228), relying entirely on the
summary's "Open actions for {title}" label.

### /admin/pages/new (Choice gate) — **3/5**

The wizard is well-built visually (`admin-pages-new-001-load.png`) and the step labels
are clear. Two problems. First, the automated load **timed out** here
(`locator.click: Timeout 30000ms exceeded`, exploration log) — a click target on this
route is flaky enough to blow an 8-30s budget. Second, and worse for me: I typed into
Page title in the editor, navigated away, and the **typed title was silently lost with
no unsaved-changes guard** (exploration log supplementary pass, line 289). A 3-step gate
in front of a builder that then drops your work on navigate is the kind of thing I'd
block a PR over. Also one `landmark-unique` axe violation.

### /admin/pages/{id} (Editor) — **2/5**

Powerful, but this is where the state machine misbehaves and where the serious axe
violation lives. `aria-prohibited-attr` (serious) on
`span[aria-label="Hero block"]` and `span[aria-label="FAQ block"]` — aria-label on a
role that prohibits it (`axe-results.json`). The ARIA snapshot ends with a bare
`- alert` node (`admin-pages-...-text.md` line 416) — a live region that's rendered
empty. Two simultaneous, redundant save confirmations: a top-of-canvas banner
"Draft saved. Autosaved 3:45 PM" AND a top-right pill "Draft saved."
(`journey-schedule-publish-05-verify-scheduled.png`). A persistent "Rendering . ."
pill sits bottom-left in that same shot with no completion signal. Combined with the
stale confirm card (Journey 2) and the schedule field amnesia (Journey 5), the editor
reads as "lots of optimistic UI, not enough truth."

### /admin/pages/{id}/revisions/{rev} (Revision preview) — **2/5**

Three moderate landmark axe violations on one page:
`landmark-main-is-top-level`, `landmark-no-duplicate-main`, `landmark-unique` — there
are **two `<main>` elements** (`#main-content > main`, `axe-results.json`). That's a DOM
structure bug, not a nit. "Back to editor" exists in the tab order but one automated
pass couldn't find it and used browser-back.

### /admin/pages/redirects (Redirects) — **3/5**

Clean load, 0 axe violations, real table semantics. But the create form clears input on
error and the error renders as a top banner, not field-level
(`admin-pages-redirects-011-form-invalid-submit.png`), and there's no
edit/delete — covered in Journey 6.

### /admin/pages/block-preview-audit (Dev QA) — **3/5**

30 block parity cases render, 0 axe violations. This is a dev/QA route exposed under
`/admin/pages/` with no auth gate distinct from the rest of admin and no "internal only"
labelling — I'd want it behind a flag or out of the prod route tree.

### /resources/{slug} (Published public page) — **4/5**

Renders correctly, 0 axe violations, CLS 0, 761ms. The only network noise is the
**three 404s** the runner logged for this exact URL
(`failedRequests`, `journey-results.json`) — those are from polling the public URL
before publish completed, i.e. the publish→live propagation isn't instant and nothing in
the editor told me to wait. Once live it's fine.

### /resources/preview/{token} (Draft preview) — **4/5**

Clean token-gated draft render, 0 axe violations. Good.

---

## Overall — **2/5**

The readiness/SEO scoring engine is genuinely good work. But underneath it the
save/publish/schedule state machine is not honest: it shows a confirm dialog after the
action already succeeded, re-renders a saved schedule field as empty with zero status,
swallows an autosave `Failed to fetch` into the console, and drops typed work on
navigate with no guard. Those are exactly the failure modes I exist to catch, and there
are enough of them that I wouldn't trust this to publish a real page without watching the
network tab.
