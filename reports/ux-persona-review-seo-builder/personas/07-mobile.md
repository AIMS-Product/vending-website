# Persona 07 — Jake, Distracted Mobile User (22)

I'm on my phone between classes, thumb only, half-watching a video. I wanted to
see if I could just knock out a page edit from my couch. Short version: the
public-facing stuff (the live page, the draft preview, the redirect form, even
the pages list) is genuinely nice on a phone. But the actual **editor** — the
thing this whole tool exists for — is a desktop two-pane layout crammed into one
endless vertical scroll, and the buttons I need (Save, Publish) are nowhere near
the thing I'm editing. That's where I'd bail.

---

## Journey Completion (Category 0)

| Journey                | Score | Justification                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create-first-page      | 2     | The choice gate is fine, but once in the editor I'm scrolling through a full desktop layout on a 375px screen; the SEO fields and Save button are a marathon scroll away from the canvas blocks (`admin-pages-e44f0fc3-...-mobile.png` shows only canvas + a floating AI button, no Save/Publish in view).            |
| publish-and-view-live  | 1     | On desktop this is already the worst journey (blockers revealed one at a time in terse chip text per `journeys.md`); on mobile the Publish button and the readiness panel that explains _why_ it's blocked are in completely different scroll regions, so I'd be thumb-scrolling up and down hunting for what to fix. |
| preview-draft          | 4     | "Live preview" opens a clean, fully responsive draft render (`resources-preview-...-mobile.png`) — this one actually works great on a phone.                                                                                                                                                                          |
| revision-restore       | 3     | The revision preview page is mobile-perfect with a clear "Back to editor" button (`...-revisions-...-mobile.png`), but per `journeys.md` revisions don't exist until after publishing, so a phone user who fat-fingers a draft has no undo.                                                                           |
| schedule-publish       | 1     | Per `journeys.md` the schedule field is buried at the bottom of SEO → Advanced, says "Uses Pacific Time" for an Aussie business, and after saving shows no "Scheduled for…" confirmation — on a phone, buried + no feedback = I have no idea if it worked.                                                            |
| create-redirect        | 4     | The redirect form is the best mobile experience in the tool — stacked fields, a real Status `<select>`, full-width "Create redirect" button (`admin-pages-redirects-mobile.png`).                                                                                                                                     |
| find-duplicate-archive | 3     | Pages list and search adapt well on mobile (`admin-pages-mobile.png`), but the per-row ⋮ menu lives in a table; on a phone tapping a tiny ⋮ inside a horizontally-constrained row is fiddly.                                                                                                                          |

---

## Per-page review

### /admin/pages (Pages list) — Gut feel: 4

Honestly nice on mobile. The summary cards (All / Drafts / Published / Archived)
stack into a clean vertical list with big tap-friendly cards, and the
"Create page" button is full-width and obvious (`admin-pages-mobile.png`). The
search box is reachable. My only worry is the results **table** — once I scroll
to the rows, a 5-column table (`Title Keyword Readiness Status Actions` per
`text/admin-pages-text.md`) has to squeeze onto 375px, and the per-row ⋮ actions
menu is a small target.

### /admin/pages/new (Create page gate) — Gut feel: 3

No mobile screenshot was captured for this route, so I'm judging from the
desktop shot + ARIA. The cards are big and each has a full description
("SEO / Resource page — Long-form search page for resources, guides, and
services." per `text/admin-pages-new-text.md`), which means they'll stack into
nice tall tap targets on a phone. The "Continue" button is clear. Fine for a
thumb — assuming it actually stacks (unverified, no mobile shot).

### /admin/pages/{id} (Editor) — Gut feel: 1

This is the problem child. On desktop it's a clean two-pane layout — canvas on
the left, SEO/Readiness panel on the right, toolbar (Pages / Blocks / Save draft
changes / Live preview / Share / SEO) across the top
(`admin-pages-e44f0fc3-...-001-load.png`). On my phone, that all collapses into
ONE enormous vertical scroll: toolbar, then the entire canvas (which renders the
real public **nav bar AND footer** inline — `admin-pages-e44f0fc3-...-tablet.png`
shows the footer baked into the editing surface), then the whole SEO panel, then
revision history, then a comments form. The mobile shot
(`admin-pages-e44f0fc3-...-mobile.png`) catches me mid-scroll on a FAQ block with
a "Rendering…" pill and a floating "AI" button — and crucially **no Save or
Publish button anywhere in view**. To edit a hero headline and then save, I have
to scroll past the footer and half the SEO panel to find the controls. That's
hostile on a phone.

### /admin/pages/redirects — Gut feel: 5

The one page clearly built for a phone. Stacked labeled fields, native Status
dropdown, full-width primary button, and a green "Redirect created." confirmation
banner right at the top (`admin-pages-redirects-mobile.png`). This is what the
rest of the tool should feel like.

### /admin/pages/{id}/revisions/{rev} (Revision preview) — Gut feel: 4

Clean, readable, full-width content, clear "Back to editor" button up top
(`...-revisions-...-mobile.png`). No complaints.

### /admin/pages/block-preview-audit (dev QA) — Gut feel: 3

Stacks fine on mobile (`admin-pages-block-preview-audit-mobile.png`) but it's an
internal QA page, not something I'd ever touch.

### /resources/{slug} (Published public page) — Gut feel: 5

Exactly what I expect on a phone: hamburger menu, huge readable hero, full-width
CTA button, FAQ as a tappable disclosure (`resources-...-mobile.png`). The output
is great — it's the editing-it part that hurts.

---

## Summary

The tool has a split personality on mobile. Everything that's a _simple form or a
rendered page_ (redirects, pages list, previews, the live site) is genuinely good
on a phone. But the **editor**, the core surface, is a desktop layout that
reflows into an unusable single-column marathon where the Save/Publish controls
are detached from the content. I could create a redirect from my phone in 20
seconds; I would give up trying to publish a page from my phone.
