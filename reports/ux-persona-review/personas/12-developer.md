# Persona Review — Alex, Developer Who Judges Everything (29)

## Summary

- **Pages reviewed:** 28 (full exploration log)
- **Issues found:** 18
- **Blockers:** 0
- **Overall gut feel:** 2.5 / 5 — It mostly _works_, but the console errors, the missing form success/validation states, the two error-page handlers, and a failing Core Web Vital are exactly the things I judge a build on. Nothing is broken enough to be a blocker; almost everything is the kind of "didn't finish the edge" that I'd block a PR on.

I came in inspecting network requests, console output, validation behaviour and URLs — and the app handed me a 500 on a flagship page, a 404 served by the wrong handler, a form that "succeeds" with a whisper, and CLS 0.263 on four pages. The bones are fine; the finishing is not.

---

## Journey Review

| Journey                  | Score | Could I complete it?                                               | Where I'd give up                                                                                                                      |
| ------------------------ | ----- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| discover-and-apply       | 2/5   | Yes, but I double-submitted because the success state is invisible | The submit "succeeds" with one line of green text, form stays filled and enabled — I'd assume it failed and click again                |
| contact-the-team         | 3/5   | Path is followable (submit not executed for safety)                | Contact is footer-only; minor, but I'd hunt for it                                                                                     |
| read-a-news-article      | 2/5   | Yes                                                                | First paint = empty card outlines + a 500 image error + a broken thumbnail; looks half-built before I even click                       |
| evaluate-trust           | 4/5   | Yes — about, case studies, privacy, terms all load                 | A heading-order violation on case studies, otherwise clean                                                                             |
| pre-call-prep            | 3/5   | Yes                                                                | Page loads fine; "0 embedded videos" for a "prep material" page is thin but functional                                                 |
| admin-create-news-draft  | 2/5   | Yes, only because I guessed the URL                                | No sidebar link to /admin/news — the CMS ships with no inbound nav                                                                     |
| admin-create-seo-page    | 2/5   | Yes, with friction                                                 | Unsaved editor isn't URL-addressable; Quick Tour overlay blocks the panel it points at; "add block" was flaky across runs (race smell) |
| admin-manage-content-ops | 3/5   | Mostly                                                             | Redirects manager is a second orphaned route with zero inbound links                                                                   |

### Per-journey notes

- **discover-and-apply (2/5):** The DB confirms a row is created on first submit and duplicate suppression works server-side — but that's the _only_ reason 6 submit clicks didn't create 6 leads. The client gives no guard: button stays enabled, form keeps its values, no redirect to the `/thank-you-for-applying` page that _already exists_ in the app. That's finding 001 and it's my single biggest issue.
- **read-a-news-article (2/5):** `news-001-load.png` is damning — above the fold is the heading "BLOG", a one-line description, and three empty card rectangles. The cards are scroll-reveal-gated content, not skeletons. Plus a `500 /_next/image` in the console and a visibly broken third thumbnail showing raw alt text.
- **admin-create-seo-page (2/5):** "Add your first block was inconsistently clickable for automation across runs" reads like a race between the tour overlay mounting and the panel hydrating. Flaky interactive state is the thing I trust least.

---

## Page-by-Page Review

### / (homepage) — 2/5

Fast TTFB (~160ms) but **CLS 0.263** (failing), **horizontal scroll at 375px**, a **serious color-contrast** axe violation on the stats `dd` elements, and testimonial `<video>`s in the tab order with **no focus indicator + possible focus trap**. Findings 006, 011, 015.

### /apply — 2/5

No client validation on five `(required)` fields (finding 002); invisible success state (finding 001). The form markup itself is decent — proper input types, sensible tab order, real `<select>` elements — which makes the missing validation/feedback layer stand out more.

### /news — 2/5

Empty cards on first paint (004), `500 /_next/image` console error + broken thumbnail (005, 017), CLS 0.263. The "BLOG"/"NEWS"/`/news` naming split (007).

### /news/{article} — 3/5

First article loads in ~2s vs ~130ms siblings (likely the remote image), CLS 0.263, serious contrast violation, and `landmark-complementary-is-top-level` (finding 012).

### /blog/{slug} — 1/5

Legacy path 404s to a **bare unstyled "Not found"** with no nav/footer/recovery link — a different handler from the site's styled 404 (finding 003). Two error pages for two missing routes is a routing defect.

### /this-page-does-not-exist — 4/5

The _good_ 404: styled, "Page not found", "Back to home" link, nav + footer. This is what /blog/\* should have hit. One serious contrast violation on the page.

### /about, /privacy, /terms, /pre-call-resources, /thank-you-for-applying — 3-4/5

Clean: 0 axe violations each, fast loads, CLS 0 on most. `/thank-you-for-applying` is well-built and ironically unreachable from the apply flow.

### /case-studies — 3/5

Real content, but `heading-order` violation (016), horizontal scroll at 375px, video focus issues mirroring the homepage.

### /admin/pages — 3/5

0 axe violations, clean tab order, sensible URL-state filters (`?status=`, `?sort=`, `?view=`) — this is the most developer-respecting part of the app. Tiny touch targets on the 10x10px status pills.

### /admin/pages/new — 2/5

`landmark-unique` violation (014); non-URL-addressable editor + blocking Quick Tour (010).

### /admin/news — 2/5

Orphaned route (008); `aria-prohibited-attr` serious violation (013).

### /admin/news/new — 3/5

`landmark-complementary-is-top-level` violation; otherwise a normal editor with Write/Preview toggle.

### /admin/pages/redirects — 2/5

Orphaned route, zero inbound links (009). Functionally the fix for the /blog 404, hidden from the UI.

### /admin/media, /admin/libraries, /admin/settings/users — 3/5

Media has 3 axe violations; Libraries is reachable only indirectly via a Media header link; settings/users uses URL-state filters well. Lots of 32x32px icon-button touch targets.

---

## Blockers

None. Nothing is fully broken or missing such that the journey cannot complete. The closest is the /blog/\* bare 404 (dead-end with no recovery), but a user who got there via the in-app nav lands on the styled 404 instead.

---

## My Top 10 Issues

1. **(001, critical)** Apply form "succeeds" with one invisible line of green text — no redirect, form stays filled & enabled, double-submit only stopped server-side.
2. **(005, high)** `500 /_next/image` on the News page — optimizer chokes on the Webflow CDN host; thumbnail renders broken with raw alt text.
3. **(003, high)** Legacy `/blog/{slug}` 404s to a bare unstyled "Not found" with no nav/footer/recovery — wrong error handler for that subtree.
4. **(002, high)** No visible validation on five `(required)` apply fields — empty/invalid submit shows nothing.
5. **(006, high)** CLS 0.263 (failing Core Web Vital) repeated on /, /about, /news, and article pages.
6. **(004, high)** /news article cards render as empty outlines on first paint (scroll-reveal gating content, no skeleton).
7. **(008, high)** /admin/news CMS has no sidebar link — orphaned route reachable only by URL.
8. **(010, high)** SEO editor isn't URL-addressable until save; Quick Tour overlay blocks the panel it points at; "add block" flaky across runs (race smell).
9. **(011, medium)** Homepage testimonial videos focusable with no focus ring + possible focus trap; serious contrast violation.
10. **(015, medium)** Horizontal scroll at 375px on /, /case-studies, and an article page — an element overflowing the viewport.
