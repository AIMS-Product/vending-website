# Persona 15 — Karen, Angry Frustrated User (47)

**Context I walked in with:** I scheduled an SEO page to publish and it never went live. I'm
back to fix it, and I'm already done with this tool. I want a clear path to undo my mistakes,
plain error messages, and a Help link if I get stuck. Let's see how it treats someone who's
already had one bad experience.

**Verdict up front:** This builder is dangerous for a frustrated user. It hides whether a
schedule even saved (the exact thing that burned me), it lets me create permanent redirects I
can't edit or delete, it loses — or silently keeps — unsaved work, and there is no Help or
Support link anywhere when I get stuck. Plenty of polish, but the recovery paths are missing.

---

## Category 0 — Journey Review (the headline question)

| #   | Journey                | Score | Could Karen complete it / where she boils over                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | create-first-page      | **3** | I got a draft saved, but the canvas is all placeholder ("Hero headline", "CTA label") with no guidance, and a "Template" option dead-ends at "No templates created". Workable, not reassuring.                                                                                                                                                                |
| 2   | publish-and-view-live  | **1** | Hostile. Publish is gated behind blockers revealed ONE at a time in internal jargon, the status chip and the readiness panel contradict each other, the "Destination URL" field is hidden in a modal, and after I finally confirm, the success toast fires while the scary "this will replace the live version" card stays open so I can't tell if it worked. |
| 3   | preview-draft          | **4** | Actually fine — one click opened a token preview in a new tab. The one thing that didn't fight me.                                                                                                                                                                                                                                                            |
| 4   | revision-restore       | **2** | Restore works AFTER publishing, but there are no revisions while drafting: "Revisions appear after publishing, library refreshes, or draft restores." If I wreck a draft before first publish, there's no undo. That's the safety net I came looking for, and it isn't there until it's too late.                                                             |
| 5   | schedule-publish       | **1** | This is MY bug. I set a date/time, saved, and the field went blank with zero confirmation — no "Scheduled for…" anywhere. Plus it's in Pacific Time for an Australian site. I now understand exactly why my page never went live: the tool never tells you the schedule took.                                                                                 |
| 6   | create-redirect        | **2** | The redirect got created, but the table has NO edit and NO delete. I came here because I made a redirect with a typo — and this screen shows me the typo and won't let me fix it. And the invalid-path error is jargon that wiped my input.                                                                                                                   |
| 7   | find-duplicate-archive | **3** | Search found the page, duplicate and archive both had confirm dialogs (good), but archiving is one row at a time with no bulk select, and the duplicate got a junk slug ("draft-4020bd0f"). Tolerable.                                                                                                                                                        |

**Worst journeys for me: 2, 5, 6.** They each map directly onto the kind of failure that put
me in this mood — a publish that won't go through, a schedule that silently doesn't save, and a
mistake I'm not allowed to undo.

---

## Per-Page Findings

### /admin/pages/redirects — Gut feel: **1**

_Justification: It shows me my mistake and gives me no button to fix it. For a frustrated user that's the worst possible page._

- **[Critical] No edit or delete on redirects (15-angry-user-001).** Exploration log:
  _"Redirects table has no delete/edit controls — created redirects cannot be removed from this
  UI."_ A 301 with a typo is permanent from here. **Fix:** add an Actions column (Edit + Delete
  with confirm) and allow correcting old path / destination / status in place.
- **[High] Jargon error that wipes input (15-angry-user-002).** Submitting an invalid old path
  returns _"Path must be root-relative."_ and the log confirms _"values preserved: false"_ — I
  have to retype everything. **Fix:** _"The old path must start with a / (for example
  /resources/old-page)."_ and keep what I already typed.

### /admin/pages/{id} editor (publish + schedule) — Gut feel: **1**

_Justification: The two journeys that brought me here both fail here, with no clear feedback and no undo._

- **[Critical] Publish "success" contradicts itself (15-angry-user-003).** The green _"Changes
  published."_ toast fires while the yellow card still says _"This will replace the current live
  version at /resources/ux-seo-review-test-1781071765035."_ (screenshot
  `journey-publish-and-view-live-09-after-publish.png`). I can't tell if it worked. **Fix:**
  close the confirm card on success and show one clear success state with an "Open live page" link.
- **[Critical] Scheduling gives no confirmation (15-angry-user-004).** I filled a date/time,
  saved, and the field re-rendered empty (`journey-schedule-publish-05-verify-scheduled.png`) —
  journeys.md: _"the field re-rendered EMPTY and no 'Scheduled for …' status appeared anywhere in
  the editor."_ This is exactly why my page never published. **Fix:** keep the date/time in the
  field and show a persistent "Scheduled to publish on {date} {time} {timezone}" banner.
- **[Critical] Publish blockers drip out one at a time and contradict each other
  (15-angry-user-006).** journeys.md: _"Chip said 'Fix SEO title' while readiness panel said 'Add
  a hero headline before publishing.' — fixed the wrong thing first."_ **Fix:** list ALL blockers
  at once as a checklist with one consistent message per gate.
- **[High] Blocker points at a hidden field (15-angry-user-007).** _"Fix content 1 · Destination
  URL"_ — but the CTA destination URL only exists inside the Block settings modal
  (`journey-publish-and-view-live-11-block-settings-modal.png`). **Fix:** make the blocker a
  button that opens that modal and focuses the field.
- **[High] Pacific Time on an Australian site (15-angry-user-005).** _"Uses Pacific Time
  (America/Los_Angeles). Leave blank unless this page should publish later."_ **Fix:** show and
  accept the site's own timezone (Australia/Adelaide) and echo back the local time.
- **[High] No undo while drafting (15-angry-user-009).** _"Revisions appear after publishing,
  library refreshes, or draft restores."_ **Fix:** snapshot a revision on every manual draft save.
- **[Medium] Schedule state must be guessed from a Cancel checkbox (15-angry-user-012).** The
  only clue a schedule exists is the appearance of _"Cancel scheduled publish — Keeps the draft
  intact and removes this page from the automatic publishing queue."_ **Fix:** show an explicit
  "Scheduled to publish on {date} {time}" status line.

### /admin/pages/new — Gut feel: **2**

_Justification: It let me walk away and lose typed work with no warning — the exact betrayal I fear._

- **[Critical] Silent data loss / silent save (15-angry-user-008).** Exploration log: _"Leaving
  unsaved editor: navigated straight to /admin/pages with NO unsaved-changes warning — typed
  title silently lost"_, yet a probe titled _"Unsaved data-loss probe (do not save)"_ shows up
  saved in the list (`admin-pages-new-014-leave-unsaved.png`). So I can't trust what's kept.
  **Fix:** a "You have unsaved changes — leave without saving?" confirm on navigating away, and
  never persist a draft I didn't explicitly save.

### /admin/pages (list) — Gut feel: **3**

_Justification: Clean list, but the one filter that matches my problem is broken in label and dead-ends._

- **[Medium] "Schedule failed" filter is truncated and unhelpful (15-angry-user-010).** Shows as
  _"Schedule faile…"_ (`admin-pages-013-filter-scheduled.png`) and, when clicked, gives no reason
  for the failure and no retry. **Fix:** show the full label and surface the failure reason plus a
  "Retry schedule" action.
- **[Medium] No Help or Support anywhere (15-angry-user-011).** The sidebar is SEO pages / Blog
  and news / Media library / Settings / Sign out — no Help, Docs, or Contact. **Fix:** add a
  persistent Help / Support link in the admin sidebar or header.

---

## Karen's bottom line

I came in burned by a schedule that silently failed, and this tool reproduced that failure in
front of me: I scheduled a page, the field went blank, and nothing told me it saved. Then it
showed me a redirect I'd want to fix and gave me no delete button, lost track of whether my
publish actually went through, and offered me no Help link to escape any of it. The visual
polish is real, but the recovery paths — undo, edit, delete, clear confirmation, support — are
exactly where this builder abandons a frustrated user. **Overall: 1.5 / 5.**
