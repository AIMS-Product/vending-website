# Persona 13 — Victoria, Executive With 30 Seconds

> C-suite. Gets briefed by assistants. Opens links in meetings. Needs to understand
> value and status in a glance. Will not scroll, will not read paragraphs.

My test for everything here: **in 30 seconds, without scrolling and without clicking,
can I tell what state this thing is in?** On the pages list the answer is "almost,
then no" — the summary cards are excellent but the per-page status is encoded in tiny
unlabelled colour dots. In the editor the answer is mostly no — readiness is a wall of
text, and the publish gate dribbles out one cryptic blocker at a time. I never confirmed
a scheduled page is actually scheduled.

---

## Category 0 — Journey Completion (scored first)

| Journey                | Score | Justification                                                                                                                                                                                          |
| ---------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| create-first-page      | 3     | Reached a saved draft, but the create flow is a 3-step wizard and the canvas is all grey placeholder — at a glance I can't tell a real page from an empty one.                                         |
| publish-and-view-live  | 1     | Publishing took resolving a chain of blockers revealed **one at a time** in jargon ("Fix content 1 · Destination URL"), and the field wasn't even on screen. No executive completes this in a meeting. |
| preview-draft          | 4     | One click on "Live preview" opened the draft in a new tab. The only journey that respected my time.                                                                                                    |
| revision-restore       | 2     | Worked, but I had to learn that revisions don't exist until after first publish — there is no glanceable "you have N saved versions."                                                                  |
| schedule-publish       | 1     | After saving a schedule the field rendered **empty** and nowhere does it say "Scheduled for {date}". I cannot verify a scheduled page is scheduled — the core thing I'd glance for.                    |
| create-redirect        | 4     | Filled three fields, hit Create, the row appeared with a clear "301" status. Scannable table. Fine.                                                                                                    |
| find-duplicate-archive | 3     | Search found the page and the row menu worked, but status after archiving is only confirmable by switching to the Archived tab — no inline state change I can see.                                     |

**Headline:** the two journeys an executive most wants to glance-verify — _is it live?_ and
_is it scheduled?_ — are the two that score 1. That is the wrong place to be weakest.

---

## Per-page review

### /admin/pages — Pages list — Gut feel: 3

The top of this page is genuinely good for me: four big summary cards ("All 5", "Drafts 4
needs work", "Published 1 publicly visible", "Archived 4 retired") are above the fold and
scannable in two seconds (`admin-pages-001-load.png`). That's the executive view done right.
Then the per-page table undoes it: **Readiness and Status are coloured dots with no labels
and no legend** (`admin-pages-001-load.png`, `admin-pages-002-full.png`). I see a yellow dot
and a green dot next to a row and have no idea if that means good, warning, or broken — and
hovering for a tooltip is not "glancing." The data exists (the ARIA labels say "SEO readiness:
Needs work", "Page status: Published" per `admin-pages-text.md`) but none of it is visible.

### /admin/pages/{id} — Page editor — Gut feel: 2

The publish state I need is technically present — a "Needs work" / "Blocked" pill top-right
and a "Published · SEO Needs work" line (`admin-pages-e44f0fc3-…-001-load.png`,
`journey-publish-and-view-live-02-read-publish-blocker.png`). But the right rail below it is a
paragraph-dense readiness report ("Search visibility Strong", "Search result Needs work",
"Page content Needs work" … eight rows plus seven Action Items per `admin-pages-…-text.md`).
This is a briefing document, not a glance. The publish blocker label "Fix SEO title" /
"Improve SEO title" sits in small text next to a disabled button — I can't tell from a glance
that the button is even disabled or why.

### /admin/pages/new — Create page wizard — Gut feel: 3

Clean and well-labelled ("Step 1 of 3", "What kind of page are you creating?" —
`admin-pages-new-001-load.png`), but it's a three-step gate before I see anything. For me
that's three clicks to start; an assistant should be the one in here, not me.

### /admin/pages/redirects — Redirects — Gut feel: 4

Scannable table, plain-English intro ("Send old page addresses to their new destinations"),
clear "301" status column (`admin-pages-redirects-001-load.png`). This page respects a glance.

### Mobile pages list — Gut feel: 3

Summary cards stack cleanly and stay scannable on a phone (`admin-pages-mobile.png`) — exactly
how I'd see this if an assistant texted me the link. The dot-status problem carries over below
the fold.

---

## Findings

| #                | Page              | Journey                | Category          | Finding                                                                                                                                     | Evidence                                                                                                                                                                                 | Severity | Fix (current → proposed)                                                                                                                     | Why it matters to me                                                                                                        |
| ---------------- | ----------------- | ---------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 13-executive-001 | /admin/pages      | find-duplicate-archive | Feedback & State  | Per-row Readiness and Status are unlabelled colour dots with no legend — status is not glanceable                                           | `admin-pages-001-load.png`; `admin-pages-text.md` ("SEO readiness: Needs work", "Page status: Published")                                                                                | high     | Coloured dot only → coloured pill with the word ("Published", "Draft", "Needs work") visible inline                                          | I scan a list to know what's live and what's broken; a dot tells me nothing without hovering, and I don't hover.            |
| 13-executive-002 | /admin/pages/{id} | schedule-publish       | Feedback & State  | After saving a schedule, the field renders empty and no "Scheduled for {date}" status appears anywhere                                      | `journey-schedule-publish-05-verify-scheduled.png`; journeys.md schedule-publish note ("field re-rendered EMPTY and no 'Scheduled for …' status appeared anywhere")                      | critical | Empty field, no confirmation → persistent banner "Scheduled to publish {date, time}" in the publish panel and a "Scheduled" pill in the list | "Is this going live Monday?" is a question I must answer in 5 seconds; right now I cannot confirm a schedule exists at all. |
| 13-executive-003 | /admin/pages/{id} | publish-and-view-live  | Copy & Labels     | Publish is gated behind blockers revealed one at a time in internal jargon ("Fix content 1 · Cta Label", "Fix content 1 · Destination URL") | journeys.md publish-and-view-live ("revealed ONE AT A TIME in the status chip, in terse internal naming"); `journey-publish-and-view-live-02-read-publish-blocker.png` ("Fix SEO title") | critical | One cryptic blocker at a time → a single checklist showing all remaining items in plain language with a jump-to link each                    | Publishing is the one action I might do myself; a guessing game of one-at-a-time error codes is unusable in a meeting.      |
| 13-executive-004 | /admin/pages/{id} | publish-and-view-live  | Feedback & State  | After confirming publish, the "Changes published" toast fires but the confirm card stays open asking to publish again                       | journeys.md publish-and-view-live ("'Changes published.' toast appears BUT the confirm card remains open asking to publish again"); `journey-publish-and-view-live-13-confirm-card.png`  | high     | Toast + card stays open → on success, dismiss the confirm card and switch the status pill to "Published"                                     | I can't tell if it worked or if I'm about to double-publish; ambiguous success states erode trust instantly.                |
| 13-executive-005 | /admin/pages/{id} | publish-and-view-live  | Navigation & Flow | No "Open live page" / "View live page" link surfaced after publishing in the default panel — the live URL had to be typed manually          | journeys.md publish-and-view-live ("No 'Open live page' link was visible after publishing in the default panel state — the live URL had to be typed manually")                           | high     | No visible link → show "View live page →" link in the publish panel the moment status is Published                                           | After I publish, the only thing I want is to click through and see it live; making me type a URL is a dead end.             |
| 13-executive-006 | /admin/pages/{id} | —                      | Visual & Layout   | Readiness for a single page is a paragraph-dense report (8 signal rows + 7 action items) with no one-line summary                           | `admin-pages-e44f0fc3-…-text.md` (lines "Search visibility Strong" … "Action Items / Highest impact first"); `admin-pages-e44f0fc3-…-001-load.png`                                       | medium   | Wall of readiness text → one summary line at top ("Ready to publish" / "2 blockers, 3 suggestions") with the detail collapsed                | I will not read seven action items; I need the verdict in one line and the option to delegate the rest.                     |
| 13-executive-007 | /admin/pages      | —                      | Feedback & State  | The publish gate's disabled "Publish" button isn't visibly disabled at a glance — greyed state is subtle next to small blocker text         | `journey-publish-and-view-live-02-read-publish-blocker.png` ("Publish" greyed, "Fix SEO title" in small text)                                                                            | medium   | Subtle grey button → clearly disabled button with an inline "Can't publish yet — 1 blocker" label beside it                                  | I shouldn't have to study the screen to learn why an action won't work; it should announce its own state.                   |

---

## Overall: 2 / 5

The summary cards prove this team _can_ build a glanceable executive view — they did it at the
top of the pages list and on Redirects. But the two states I most need to verify at a glance
(is it live, is it scheduled) are the weakest in the product: status is hidden in unlabelled
dots, scheduling gives no confirmation at all, and publishing is a one-blocker-at-a-time maze.
For a tool I'd open in a meeting, that's a fail on its core promise.
