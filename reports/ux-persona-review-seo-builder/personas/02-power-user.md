# SEO Page Builder — Power User Review (Marcus, 34)

## Summary

I judge tools in three seconds and abandon anything that wastes my time. This builder is _capable_ — token previews, revision history, redirects, a readiness engine — but it's built for someone with all day. The publish flow alone cost me more clicks than creating the entire page. Blockers are revealed one at a time in terse internal jargon ("Fix content 1 · Destination URL"), the field I needed wasn't even on the canvas, and the confirm card stayed open re-asking me to publish _after_ it told me it published. There are zero keyboard shortcuts anywhere — no `Cmd+S`, no `Cmd+Enter` to publish, no `/` to insert a block. Every new page forces a 3-step wizard plus a "Quick Tour" overlay I have to dismiss. The bones are good; the friction is everywhere a fast user actually lives.

Overall gut feel: **2/5** — functional but I'd be cursing at it by the third page.

---

## Journey Review

| Journey                | Score | Justification                                                                                                                                                                                                     |
| ---------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create-first-page      | **2** | 13 clicks to a draft, with a forced 3-step gate and a tour overlay before I can type a single character — half of that is ceremony.                                                                               |
| publish-and-view-live  | **1** | The single worst flow in the app: blockers revealed one-at-a-time in internal naming, a required field hidden in a modal, contradictory chip vs panel messages, and a confirm card that stays open after success. |
| preview-draft          | **4** | One click, opens a tokenized preview in a new tab — this is the one flow that respects my time.                                                                                                                   |
| revision-restore       | **2** | Works _after_ publishing, but there's no restore point while drafting — mangle a pre-publish draft and there's no page-level undo.                                                                                |
| schedule-publish       | **2** | Field is buried under SEO → Advanced, set in Pacific Time for an Aussie business, and after saving the field re-renders empty with no "Scheduled for…" confirmation anywhere.                                     |
| create-redirect        | **3** | Two clicks plus a form, redirect appears — fine, except there's no edit/delete so a typo is permanent.                                                                                                            |
| find-duplicate-archive | **3** | Search works and the row menu is discoverable, but it's per-row only — no bulk select, and duplicate doesn't derive a sane slug.                                                                                  |

---

## Page-by-Page

### /admin/pages (Pages list) — Gut feel **3**

Loads fast (1446ms, CLS 0), scannable summary cards, status + workflow filters up top. But the **Readiness** and **Status** columns are nothing but colored dots — no text label, no tooltip in the static view (`admin-pages-001-load.png`). I have to hover or open each page to know if a dot means "blocked" or "opportunities." The row `⋮` menu is a native `<details>` with the action buttons rendered as bare `img` inside a `group` (text extract ARIA snapshot: `cell: - group: - img`), so they're invisible to keyboard/AT until expanded. No bulk actions.

### /admin/pages/new (Create page) — Gut feel **2**

A 3-step wizard (`Page type` → `Starting point` → `Ready to build`) to make a blank page. Step 3 is a pure "Review your choices" screen showing only "SEO / Resource page" + "Blank page" (`admin-pages-new-012-step3.png`) — a wasted click. Then on entering the editor a **forced "QUICK TOUR · STEP 1 OF 3" overlay** blocks the canvas (`admin-pages-new-error.png`). And the killer: I typed a title, navigated away, and it was **silently lost — no unsaved-changes warning** (exploration log: "navigated straight to /admin/pages with NO unsaved-changes warning — typed title silently lost").

### /admin/pages/{id} (Editor) — Gut feel **2**

Dense but powerful. The problem is the publish gate (see Blockers). Move/Block-action buttons are icon-only `img` with the wrong ARIA (`aria-prohibited-attr` serious: `span[aria-label="Hero block"]`). No `Cmd+S` — I have to mouse to "Save draft changes." The header reads "Save draft changes" / "Live preview" / "Share" — clear enough, but everything is a mouse target.

### /admin/pages/{id}/revisions/{rev} (Revision preview) — Gut feel **3**

Read-only render with a "Back to editor" link. Fine. Three landmark axe violations (`landmark-no-duplicate-main`, `landmark-unique`) but nothing that stops me.

### /admin/pages/redirects — Gut feel **3**

Clean form, good status descriptions ("Use permanent for most renamed or moved pages"). But the table has **no edit or delete control** (`admin-pages-redirects-002-full.png`) — a mistyped redirect is permanent from this UI. For a power user who'll create dozens, that's a trap.

### /resources/{slug} (Published page) — Gut feel **4**

Renders correctly, fast (761ms, CLS 0), hero/CTA/FAQ all present. No complaints as output.

### /resources/preview/{token} (Draft preview) — Gut feel **4**

Token preview works, no login needed for reviewers. This is the right pattern.

### /admin/pages/block-preview-audit — Gut feel **3**

Dev QA page, 30 block parity cases. Not a user surface; no opinion beyond "it loads."

---

## Blockers & Top Friction

**The publish chain (Journey 2) is the headline failure.** Blockers surface one at a time in the status chip using internal naming, and the messaging contradicts itself:

- Chip said **"Fix SEO title"** (`journey-publish-and-view-live-02-read-publish-blocker.png`) while the SEO title field placeholder literally says **"Leave blank to use page headline"** (text extract) — so the gate demands I fill a field the field itself says is optional.
- The readiness panel simultaneously said **"Add a hero headline before publishing."** — two different messages for the same locked state.
- Next blocker: **"Fix content 1 · Destination URL"** — and that field is **not on the canvas**. It only exists in Block actions → Edit settings → "CTA destination URL" (`journey-publish-and-view-live-11-block-settings-modal.png`). The blocker gives zero hint where to look.
- After confirming, **"Changes published." toast fires but the yellow confirm card stays open** re-asking me to publish (`journey-publish-and-view-live-13-confirm-card.png`).

---

## Top 10 (priority order)

1. **Publish blockers revealed one-at-a-time in internal jargon** — show all blockers at once, in plain language, each deep-linking to the field. (Blocker)
2. **Required CTA "Destination URL" is hidden in a modal** but the blocker names it without a path — surface it on the canvas or make the blocker click-to-field. (Critical)
3. **Unsaved new-page edits are silently discarded** with no warning. (Critical)
4. **No keyboard shortcuts** — no `Cmd+S` to save, `Cmd+Enter` to publish, `/` to insert a block. (High)
5. **Confirm-publish card stays open after success**, re-prompting to publish. (High)
6. **Forced 3-step wizard + Quick Tour overlay** on every new page. (High)
7. **Redirects can't be edited or deleted** — a typo is permanent. (High)
8. **Schedule field shows no confirmation after save** and uses Pacific Time for an AU business. (High)
9. **Readiness/Status are unlabeled colored dots** with no text in the list view. (Medium)
10. **No bulk actions** (archive/publish/duplicate) in the pages list. (Medium)
