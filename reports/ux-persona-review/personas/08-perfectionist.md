# Persona Review — 08 · Claire, Detail-Obsessed Perfectionist (37)

UX designer at a Fortune 500. I notice every pixel, every inconsistency, every
violation of design-system norms. My lens for this review: is there _one_ design
system, or several? Are spacings, button shapes, type scales, and colour
semantics consistent across the public site and the admin studio? Are
loading / empty / error states actually designed, or left as defaults?

## Summary

- **Pages reviewed**: 28 (all public routes + admin studio), plus 8 journeys
- **Findings**: 22
- **Blockers**: 0
- **Severity spread**: 0 blocker · 0 critical · 8 high · 8 medium · 6 low
- **Overall gut feel**: **2.5 / 5** — Individually most screens are competent, but
  the product is visibly built from two unrelated design systems (brutalist public
  site, generic SaaS admin) with no shared tokens, and several designed states
  (success page, count-up stats, scroll-reveal cards) are wired wrong or render as
  defaults. As a perfectionist I cannot unsee it.

The single thing I cannot get past: **the public marketing site and the admin
studio do not share a design system** — different type, button shapes, radii,
colour semantics, and shadow language. Everything else is downstream of that.

---

## Journey Review

| #   | Journey                  | Score | Could I complete it?                     | Where I'd give up / wince                                                                                                                                                 |
| --- | ------------------------ | :---: | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | discover-and-apply       |  2/5  | Yes                                      | Hero stats read '0+ / $0M+ / 0+'; on submit I get tiny inline green text instead of the _designed_ /thank-you-for-applying page that already exists but is never reached. |
| 2   | contact-the-team         |  3/5  | Up to submit (submit skipped for safety) | Same form pattern as /apply but the 'State' field's requiredness silently differs; submit button shadow doesn't match /apply's.                                           |
| 3   | read-a-news-article      |  2/5  | Yes                                      | Listing paints as three empty card outlines above the fold (scroll-reveal at rest) and one cover image 500s into raw alt text; section is called 'NEWS' then 'BLOG'.      |
| 4   | evaluate-trust           |  3/5  | Yes                                      | Reachable and real, but case-studies grid has ragged card heights / inconsistent avatars.                                                                                 |
| 5   | pre-call-prep            |  3/5  | Yes                                      | Loads cleanly; nothing egregious, just the same nav under-sizing.                                                                                                         |
| 6   | admin-create-news-draft  |  2/5  | Yes (via direct URL)                     | No News item in the sidebar; 'Save draft' and 'Publish' are two identical blue buttons; body editor is an undesigned empty textarea.                                      |
| 7   | admin-create-seo-page    |  2/5  | With friction                            | Quick Tour overlay sits on top of the 'Add your first block' panel it points at; editor toolbar uses a _third_ button style (outline pills).                              |
| 8   | admin-manage-content-ops |  2/5  | Partly                                   | Per-section eyebrow labels are five different conventions; stat-card colours carry no consistent semantics; Redirects/News are orphaned routes.                           |

### Per-journey notes

- **discover-and-apply** — The proof numbers in the hero are the loudest thing on
  the page and they say zero (`0+ ENTREPRENEURS LAUNCHED`, `$0M+`, `0+`,
  home-text.md). That is a count-up animation captured at its start frame — the
  exact designed-vs-default failure I hunt for. Then on submit the team's own
  `/thank-you-for-applying` page (a fully designed success state) is bypassed in
  favour of one line of inline green text. The right artefact exists and isn't wired.
- **read-a-news-article** — First paint of /news is empty outlined boxes
  (news-001-load.png) because the cards are hidden until scrolled into view, and
  the third card shows broken-image alt text from a 500ing CDN cover. Two visible
  defects on the entry screen of a content section.
- **admin-create-seo-page** — The builder is a different visual world again (dark
  'PAGE BLOCKS' panel, outline-pill toolbar) and the onboarding tour occludes the
  one control a new user needs.

---

## Page-by-Page Review (selected; full findings in findings.json)

### / (homepage) — gut feel 2/5

Bold, confident hero, but the stat band renders zeroes and CLS is 0.263. Mobile
has horizontal scroll.

- Stat counters frozen at `0+ / $0M+ / 0+` (08-perfectionist-002).
- CLS 0.263 — a consistent quarter-viewport jump (08-perfectionist-003).
- Horizontal scroll at 375px (08-perfectionist-021).

### /apply & /contact — gut feel 3/5

Same brutalist shadowed-card form pattern, but not the same components.

- 'State' required on /apply, optional on /contact (08-perfectionist-006).
- Submit-button shadow depth differs between the two (08-perfectionist-007).
- The designed /thank-you-for-applying success page is never reached
  (08-perfectionist-005).

### /news + article — gut feel 2/5

- Empty card outlines above the fold at first paint (08-perfectionist-012).
- Cover image 500s into raw alt text, no fallback (08-perfectionist-013).
- 'NEWS' vs 'BLOG' naming split (08-perfectionist-014).
- Share rail mixes 'X / in / f / link' conventions (08-perfectionist-015).

### /this-page-does-not-exist (404) — gut feel 2/5

The only public page that drops the brand: default sans 'Page not found' and a
thin outline pill inside the branded shell (08-perfectionist-004).

### /case-studies — gut feel 3/5

Ragged testimonial-card heights and inconsistent avatar presence within rows
(08-perfectionist-022).

### Admin studio (pages / news / media / libraries / settings / redirects) — gut feel 2/5

This is where the lack of a system shows most.

- Public vs admin are two design languages with no shared tokens (08-perfectionist-001).
- Five different eyebrow/breadcrumb naming conventions (08-perfectionist-008).
- Stat-card icon-tile colours carry no consistent semantics (08-perfectionist-009).
- Four different primary-button shapes across the studio (08-perfectionist-010).
- 'Save draft' and 'Publish' are identical blue buttons (08-perfectionist-011).
- Blog body editor is an undesigned empty textarea (08-perfectionist-017).
- Quick Tour overlay occludes the panel it describes (08-perfectionist-018).
- READINESS/STATUS encoded only as 10px dots, no legend (08-perfectionist-016).
- 'Blog page' (wizard) vs 'New blog post' (News) are redundant entry points (08-perfectionist-019).

### Global

- Interactive targets systematically undersized (nav ~17–20px, dots 10px, icon
  actions 32px) (08-perfectionist-020).

---

## Blockers

None. Nothing here stops a user dead — these are consistency, polish, and
designed-state failures, which is exactly my remit. The highest-impact items
(unwired success page, zeroed stats, two-design-systems split, broken news image)
are 'high', not blockers, because the underlying task still completes.

---

## My Top 10 Issues

1. **Two unrelated design systems** — public brutalist vs admin generic SaaS, no
   shared tokens (08-perfectionist-001, high).
2. **Hero stats render as `0+ / $0M+ / 0+`** — count-up frozen at start frame
   (08-perfectionist-002, high).
3. **Designed success page (/thank-you-for-applying) is never reached** — apply
   shows tiny inline green text instead (08-perfectionist-005, high).
4. **`Save draft` and `Publish` are identical buttons** — no hierarchy on a
   consequential action (08-perfectionist-011, high).
5. **/news first paint is empty card outlines** — scroll-reveal at rest
   (08-perfectionist-012, high).
6. **News cover image 500s into raw alt text** — no broken-image fallback
   (08-perfectionist-013, high).
7. **404 page abandons the brand** — default sans + outline pill in branded shell
   (08-perfectionist-004, high).
8. **CLS 0.263 across most public pages** — a repeatable layout jump
   (08-perfectionist-003, high).
9. **Four primary-button shapes across the admin studio** — clearest sign there is
   no Button component (08-perfectionist-010, medium).
10. **Five eyebrow/breadcrumb naming conventions in the studio** — CMS Assets /
    Studio Settings / CMS Governance / Blog CMS / (none) (08-perfectionist-008, medium).
