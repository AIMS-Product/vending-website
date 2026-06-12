# UX Persona Review — Betty (Tech-Illiterate Grandparent, 78)

_Retired teacher. Uses an iPad for email and Facebook. Reads every word because she's afraid of breaking something. Wants every label plain, every next step obvious, and a clear undo on anything that feels permanent._

---

## Summary

- **Pages reviewed**: 8 (Pages list, Create page choice gate, Page editor, Revision preview, Redirects, Block preview audit, Published public page, Token draft preview)
- **Journeys reviewed**: 7
- **Total issues**: 28
- **Blockers**: 2 (lost work with no warning when leaving the new-page editor; publish gated behind one-at-a-time riddles I couldn't decode)
- **Overall gut feel**: **2 / 5** — I could _look_ at everything, but I would have given up before getting a page live, and I found two places where my work vanished or where I couldn't tell if something saved. This tool feels built for a young office person, not for me.

The screen is beautiful and tidy, but it talks to me in shorthand. Words like "Slug", "Eyebrow", "301", "Pacific Time", and little coloured dots with no labels all made me stop and worry I was about to break the website.

---

## Journey Review

| #   | Journey                | Could Betty complete it?                                | Score | One-line justification                                                                                                       |
| --- | ---------------------- | ------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | create-first-page      | Barely — saved a draft but the empty page scared me     | 2     | The blank page is full of grey ghost words ("Hero headline", "Eyebrow") and nothing tells me they must be filled in.         |
| 2   | publish-and-view-live  | No — I would have given up                              | 1     | Publishing made me fix one hidden riddle after another, in words I didn't understand, and one field wasn't even on the page. |
| 3   | preview-draft          | Yes                                                     | 4     | "Live preview" opened a clean copy of my page in a new tab — this one felt safe and clear.                                   |
| 4   | revision-restore       | Partly — confusing and a little frightening             | 2     | There was no "undo" while I was still working, and "Restore draft" sounded like it might erase what I had.                   |
| 5   | schedule-publish       | No — I couldn't tell if it worked                       | 1     | I typed a date, saved, and the box went blank with no "Scheduled for…" message, so I had no idea if I'd done it.             |
| 6   | create-redirect        | Partly — the error scared me and there's no way to undo | 2     | "Path must be root-relative" meant nothing to me, and once a redirect is made there's no delete button.                      |
| 7   | find-duplicate-archive | Yes, with worry                                         | 3     | Search worked and the menus asked "are you sure", but "Archive" and "Move to draft" sound like things I can't take back.     |

### Per-journey notes

**Journey 1 — create-first-page.** The three-step "What kind of page are you creating?" gate was the _friendliest_ part of the whole tool — big buttons, plain descriptions ("Long-form search page for resources, guides, and services"), a clear "Continue". But the moment the real editor opened, I was lost. The page is covered in faint grey words — "Hero headline", "Hero body copy", "Eyebrow", "CTA label" — and I couldn't tell which were instructions and which were things I had to replace. Nothing said "fill these in first." I managed to save a draft, but only because the green "Draft saved." badge reassured me (screenshot `journey-schedule-publish-05-verify-scheduled.png`).

**Journey 2 — publish-and-view-live.** This is where I would have closed the iPad and phoned my grandson. The blue "Publish" button was greyed out, and a little orange word said "Fix SEO title" (screenshot `journey-publish-and-view-live-02-read-publish-blocker.png`). I don't know what an SEO title is. When I fixed something, a _new_ riddle appeared — "Fix content 1 · Cta Label", then "Fix content 1 · Destination URL". The very last one asked for a "Destination URL" that _wasn't anywhere on the page_ — I learned afterwards it was hidden inside a "Block actions → Edit settings" pop-up (screenshot `journey-publish-and-view-live-11-block-settings-modal.png`). A person like me would never find that. Then, after I finally pressed "Confirm publish" and saw "Changes published.", the yellow confirm box _stayed open_ still asking me to publish again (screenshot `journey-publish-and-view-live-09-after-publish.png`) — so I couldn't tell if it had worked or if I needed to press again.

**Journey 3 — preview-draft.** The one journey I enjoyed. I pressed "Live preview", a new tab opened, and there was my page looking like a real website. Plain and reassuring.

**Journey 4 — revision-restore.** Before I published, I went looking for an "undo" and found only a message that revisions appear later. That worried me — I'd saved my draft and there was _no way back_ if I'd ruined it. After publishing, a "Version 1" row appeared with "Preview" and "Restore draft". "Restore draft" frightened me because I couldn't tell whether it would throw away the work I had open.

**Journey 5 — schedule-publish.** I had to dig into "Advanced SEO" to find a "Scheduled publish" box (screenshot `journey-schedule-publish-05-verify-scheduled.png`). The note under it said "Uses Pacific Time (America/Los_Angeles)" — I live in Australia, so I had no idea what time that meant for me. Worse, after I typed a date and saved, the box went _blank_ and nothing said "Scheduled for…". I genuinely could not tell if I had scheduled it or not.

**Journey 6 — create-redirect.** The form looked simple, but when I submitted I got a red bar saying "Path must be root-relative." (screenshot `admin-pages-redirects-011-form-invalid-submit.png`). That is not English to me. And the table of redirects has _no_ "delete" or "edit" — so if I made a mistake, it's stuck there forever, which makes me afraid to even try.

**Journey 7 — find-duplicate-archive.** Search found my page, which was nice. The menu had "Duplicate page", "Move to draft", and "Archive page" in red (screenshot `admin-pages-017-row-menu-open.png`). At least each asked "are you sure". But "Archive" and "Move to draft" are words I don't trust — I'd be scared they delete the page for good.

---

## Page-by-Page Review

### 1. /admin/pages — Pages list

**Gut feel: 3 / 5** — Clean and not too busy, but the coloured dots and the word "Slug"-style URLs left me unsure what was good and what was broken.

| #   | Category        | Finding                                                                                                                                              | Evidence                                                      | Severity |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| 1   | Visual & Layout | The "Readiness" and "Status" columns are just coloured dots (red/orange/blue/green) with no words, so I can't tell what each one means.              | `admin-pages-001-load.png` (dots in Readiness/Status columns) | high     |
| 2   | Copy & Labels   | The page web addresses are shown in tiny grey code like `/resources/ux-seo-review-test-1781071765035` which looks like a computer error, not a page. | text extract: `/resources/ux-seo-review-test-1781071765035`   | low      |
| 3   | Copy & Labels   | The page is titled "SEO pages" — I don't know what "SEO" means, so I wouldn't know this is where my website pages live.                              | text extract: heading "SEO pages"                             | medium   |

### 2. /admin/pages/new — Create page (choice gate)

**Gut feel: 4 / 5** — The nicest, calmest screen. Big labelled choices, plain descriptions, an obvious "Continue".

| #   | Category          | Finding                                                                                                                     | Evidence                                                   | Severity |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- |
| 4   | Navigation & Flow | On step 1 there's a "Continue" but no "Cancel" or "Back to pages", so if I opened this by mistake I don't see how to leave. | `admin-pages-new-001-load.png` (only "Continue" at bottom) | medium   |

### 3. /admin/pages/{id} — Page editor

**Gut feel: 1 / 5** — Overwhelming. Two busy columns, faint ghost words everywhere, jargon, and an important field hidden in a pop-up.

| #   | Category                  | Finding                                                                                                                                                                                       | Evidence                                                                                                                                                   | Severity |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 5   | Forms & Input             | Leaving the brand-new editor after typing a title takes me straight back to the list with **no "you have unsaved changes" warning** — my typing was silently lost.                            | exploration-log: "navigated straight to /admin/pages with NO unsaved-changes warning — typed title silently lost"; `admin-pages-new-014-leave-unsaved.png` | blocker  |
| 6   | Copy & Labels             | "Eyebrow" is used as a field label. I have no idea what that means on a web page.                                                                                                             | text extract: "Eyebrow"                                                                                                                                    | high     |
| 7   | Copy & Labels             | The publish chip shows a terse riddle "Improve SEO title" / "Fix SEO title" instead of telling me plainly what to type and where.                                                             | `admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-001-load.png` ("Improve SEO title"); text extract: "Fix SEO title"                                       | high     |
| 8   | Forms & Input             | The faint grey words on the page ("Hero headline", "Hero body copy", "CTA label") look like real text, so I can't tell what I'm supposed to replace versus leave alone.                       | `journey-publish-and-view-live-02-read-publish-blocker.png` (ghosted "Hero headline")                                                                      | high     |
| 9   | Copy & Labels             | "Slug" is the label for the web address box — that word means nothing to me and sounds unpleasant.                                                                                            | text extract: "Slug"                                                                                                                                       | medium   |
| 10  | Navigation & Flow         | The screen has two columns plus a floating purple "AI" button, a "Share" menu, "Blocks", "SEO", "Governance comments" — far too much at once for me to know where to even start.              | `admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-002-full.png`                                                                                            | high     |
| 11  | Copy & Labels             | "Governance comments" and "Builder support" are headings I don't understand at all.                                                                                                           | text extract: "Governance comments"; "Builder support"                                                                                                     | medium   |
| 12  | Accessibility & Inclusion | Some icon-only controls (the little eye, the move handle) have no words next to them, so I can't guess what they do without clicking and risking a change.                                    | `admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-001-load.png` (eye/visibility icons near hero)                                                           | medium   |
| 23  | Forms & Input             | A required "CTA destination URL" needed to publish is not on the page at all — it's hidden inside a "Block actions → Edit settings" pop-up, so the publish blocker gave me no way to find it. | `journey-publish-and-view-live-11-block-settings-modal.png`                                                                                                | critical |
| 24  | Feedback & State          | After "Confirm publish" and seeing "Changes published.", the yellow confirm box stays open still asking me to publish again, so I can't tell if it worked.                                    | `journey-publish-and-view-live-09-after-publish.png`                                                                                                       | critical |
| 25  | Feedback & State          | After typing a date in "Scheduled publish" and saving, the box went blank with no "Scheduled for…" message, so I couldn't tell if it worked.                                                  | exploration-log: "field re-rendered EMPTY and no 'Scheduled for …' status appeared"; `journey-schedule-publish-05-verify-scheduled.png`                    | high     |
| 26  | Copy & Labels             | The scheduled-publish note says "Uses Pacific Time (America/Los_Angeles)" — meaningless to me as an Australian; I can't work out when my page would go live.                                  | `journey-schedule-publish-05-verify-scheduled.png`: "Uses Pacific Time (America/Los_Angeles)."                                                             | medium   |

### 4. /admin/pages/{id}/revisions/{rev} — Revision preview

**Gut feel: 2 / 5** — Shows the old version cleanly, but the bare page with one tiny link made me feel stranded.

| #   | Category          | Finding                                                                                                                                                                                             | Evidence                                                                                                       | Severity |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| 13  | Navigation & Flow | This page has only a small "Back to editor" link top-right and nothing else — no sidebar, no clear "this is a preview, you are safe" message, so I felt lost and unsure if I'd left the admin area. | `admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-revisions-7c80faa3-14c9-4f0d-8d2b-af51cb9d7d25-001-load.png` | medium   |
| 14  | Copy & Labels     | The only label is "Revision preview / publish - Jun 10, 3:49 PM" — "publish" sitting there as a single word doesn't tell me this is an older saved copy I can safely look at.                       | text extract: "publish - Jun 10, 3:49 PM"                                                                      | medium   |

### 5. /admin/pages/redirects — Redirects manager

**Gut feel: 2 / 5** — Simple-looking form, but the error wording was frightening and there's no way to undo a mistake.

| #   | Category       | Finding                                                                                                                                             | Evidence                                                                                                                    | Severity |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| 15  | Forms & Input  | The error "Path must be root-relative." is pure jargon — it doesn't tell me what to type instead.                                                   | text extract / `admin-pages-redirects-011-form-invalid-submit.png`: "Path must be root-relative."                           | high     |
| 16  | Trust & Safety | Once I create a redirect there is **no delete or edit button** in the table, so a typo is permanent from here — that makes me too scared to use it. | exploration-log: "Redirects table has no delete/edit controls — created redirects cannot be removed from this UI."          | high     |
| 17  | Copy & Labels  | The status choices say "Permanent move (301)", "Temporary redirect (307)" etc. — the numbers in brackets confuse me and I don't know which to pick. | text extract: "Permanent move (301)" / "Temporary redirect (307)"                                                           | low      |
| 18  | Copy & Labels  | The page title is "Redirects" with no plain explanation of what would happen to visitors — I'd be afraid of sending people to the wrong place.      | text extract: "Send old page addresses to their new destinations." (helpful but the word "Redirects" itself is unexplained) | low      |

### 6. /admin/pages/block-preview-audit — Block preview audit

**Gut feel: 2 / 5** — A long technical comparison page that looks like a developer's test, not something for me; I'd be confused why it exists.

| #   | Category          | Finding                                                                                                                                                               | Evidence                                                                                                                | Severity |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| 19  | Copy & Labels     | The heading "Block preview audit" and "Compare every picker preview against the real resource-page render using mocked block content" is entirely developer language. | text extract: "Compare every picker preview against the real resource-page render using mocked block content."          | medium   |
| 20  | Navigation & Flow | This very long page of repeated "PICKER PREVIEW / ACTUAL RESOURCE RENDER" pairs has no "Back" and no explanation of why I, an editor, would ever need it.             | `admin-pages-block-preview-audit-001-load.png`; text extract repeats "Picker preview / Actual resource render" 31 times | low      |

### 7. /resources/ux-seo-review-test-… — Published public page

**Gut feel: 4 / 5** — This finally looked like a real, friendly website page. Clear heading, button, and a question I could open.

| #   | Category        | Finding                                                                                                                                                                       | Evidence                                                  | Severity |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------- |
| 21  | Visual & Layout | The whole page is one short headline, one orange button, and one FAQ — it looks empty and unfinished, but nothing in the editor warned me a page this thin shouldn't go live. | `resources-ux-seo-review-test-1781071765035-001-load.png` | medium   |

### 8. /resources/preview/{token} — Token draft preview

**Gut feel: 4 / 5** — Looks just like the real page, which is reassuring; but I wouldn't understand the scrambled web address.

| #   | Category       | Finding                                                                                                                                                                                | Evidence                                                                                   | Severity |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| 22  | Trust & Safety | The address is a long scramble like `/resources/preview/2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw` — to me that looks like a broken or suspicious link, not a safe preview to share. | exploration-log page URL: `/resources/preview/2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw` | low      |

---

## Blockers

1. **Lost work, no warning (editor).** Typing a page title in a new page and then leaving sends me back to the list and silently throws my typing away — no "are you sure you want to leave?" Betty's deepest fear is doing work and losing it; this confirms it can happen. Evidence: exploration-log "navigated straight to /admin/pages with NO unsaved-changes warning — typed title silently lost".

2. **Publishing is a chain of one-at-a-time riddles (editor).** To go live I had to solve "Fix SEO title" → "Fix content 1 · Cta Label" → "Fix content 1 · Destination URL", in shorthand I don't understand, and one required field wasn't even visible on the page (hidden in a settings pop-up). Betty would give up here. Evidence: `journey-publish-and-view-live-02-read-publish-blocker.png`, `journey-publish-and-view-live-11-block-settings-modal.png`.

---

## My Top 10 Issues

1. **(Blocker)** Leaving the new editor loses my typed work with no warning. _I would never trust a tool that throws my work away silently._
2. **(Blocker)** Publishing makes me solve hidden riddles one at a time, including a field that isn't on the page. _I'd close the iPad and give up._
3. **(High)** "Readiness" and "Status" are just coloured dots with no words. _I can't tell good from broken._
4. **(High)** Field labels like "Eyebrow" and "Slug" are words I've never seen on a web page.
5. **(High)** The publish chip says "Fix SEO title" instead of telling me plainly what to type and where.
6. **(High)** Faint grey placeholder words look like real text — I can't tell what to replace.
7. **(High)** "Path must be root-relative." error gives me no idea what to type instead.
8. **(High)** Created redirects can't be deleted or edited — a mistake is permanent.
9. **(High)** The editor screen is far too busy — two columns, AI button, comments, jargon headings — I don't know where to start.
10. **(Critical-feeling)** After "Changes published.", the confirm box stays open asking me to publish again, and the schedule box goes blank with no confirmation — so I never know whether things actually worked.
