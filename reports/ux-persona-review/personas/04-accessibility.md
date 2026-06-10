# Persona Review — David, Accessibility-Dependent User (45)

> Low vision (200% zoom + screen reader). Motor impairment — keyboard only, no mouse. Knows technology well, depends on proper implementation.

## Summary

- **Pages reviewed**: 28 (all routes in the exploration log + axe data)
- **Issues found**: 18
- **Blockers**: 0 hard blockers, but **2 critical keyboard focus traps** (homepage + case-studies video walls) that would functionally stop me mid-journey
- **Overall gut feel**: **2 / 5** — Structurally it is a real, semantic site (proper landmarks, accessible names on form fields, native required validation), but the keyboard experience is hostile: focus traps in the testimonial videos, no skip link anywhere, serious contrast failures on exactly the content I most need to read (stats, error page, article meta, admin filter counts), and a success state my screen reader probably never announces.

The single thing that breaks me: **keyboard focus appears to trap inside the testimonial/case-study videos with no visible focus ring**, on the two pages central to deciding whether to apply.

---

## Journey Review

| Journey                  | Score | Could I complete it?                 | Where I'd give up                                                                                                                                                                                      |
| ------------------------ | ----- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| discover-and-apply       | 2     | Probably not unaided                 | Tabbing into the homepage testimonial videos — possible focus trap, no escape, no focus ring (04-001). If I route around it, the success message likely never gets announced (04-018) so I'd resubmit. |
| contact-the-team         | 3     | Yes, if I know to look in the footer | Contact is footer-only; native validation works but no announced error summary.                                                                                                                        |
| read-a-news-article      | 3     | Yes                                  | Reachable and readable, but article meta and inline links fail contrast (04-007) and share icons are bare letters (04-008).                                                                            |
| evaluate-trust           | 2     | Partially                            | The proof videos on /case-studies have the same focus-trap risk (04-002) — the trust content itself becomes a keyboard dead end.                                                                       |
| pre-call-prep            | 4     | Yes                                  | Clean page, only the global no-skip-link friction.                                                                                                                                                     |
| admin-create-news-draft  | 2     | With difficulty                      | Serious aria-prohibited-attr on the list (04-011) plus the section being unreachable from the sidebar (a navigation gap others flagged) makes this hard by screen reader.                              |
| admin-create-seo-page    | 2     | With difficulty                      | Duplicate landmark in the wizard (04-013); the first-run Quick Tour overlay (per journeys.md) blocking the panel is doubly hostile to keyboard/SR users.                                               |
| admin-manage-content-ops | 2     | Partially                            | Media library filter counts fail contrast (04-012) and heading order is broken; I can't read the state counts I navigate by.                                                                           |

### Per-journey notes

- **discover-and-apply**: The whole reason this is my worst journey is the combination of (1) the testimonial video focus traps with no visible focus, and (2) the near-silent success state. The journeys.md note that automation resubmitted five more times because the confirmation was so subtle is exactly my lived experience — if it isn't in an aria-live region, I don't know it worked.
- **evaluate-trust**: I _can_ reach About, Case Studies, Privacy, and Terms. But the case-study videos are the proof, and if focus traps there, the content meant to earn my trust is what locks me out.

---

## Page-by-Page Review

### / (homepage) — Gut feel 2/5

_Strong semantics (banner/nav/main/contentinfo, real headings, labeled images) undercut by keyboard traps, no skip link, and failing stat contrast._

| #      | Category         | Finding                                                                   | Evidence                                                                                    | Severity |
| ------ | ---------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| 04-001 | Accessibility    | Testimonial videos: possible focus trap + no visible focus indicator (×4) | axe: "possible focus trap around stop 11 on video 'Video testimonial from Thomas Rohlader'" | critical |
| 04-003 | Accessibility    | No skip-to-content link; logo → nav → 12 video stops before content       | axe tabOrder stops 1–20; home-text.md banner/main                                           | high     |
| 04-005 | Accessibility    | Serious contrast fail on stat values (`dd`)                               | axe: "color-contrast serious — .grid-cols-[auto_1fr]...> dd"                                | high     |
| 04-015 | Copy & Labels    | Stats render as literal '0+' / '$0M+' — SR reads "zero plus"              | home-text.md: "term: 0+ / definition: Entrepreneurs launched"                               | medium   |
| 04-016 | Navigation       | Two consecutive identical 'APPLY NOW' links; no header Contact            | axe tabOrder stops 7 & 8                                                                    | low      |
| 04-018 | Feedback & State | Success only as subtle green text; empty alert region; no redirect        | home-text.md: "- alert"; journeys.md success note                                           | high     |

### /case-studies — Gut feel 2/5

_The trust content is gated behind the same video focus-trap risk._

| #      | Category      | Finding                                                      | Evidence                                                                                  | Severity |
| ------ | ------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------- |
| 04-002 | Accessibility | Video case studies: possible focus trap + no focus ring (×4) | axe: "possible focus trap around stop 9 on video 'Video case study from Thomas Rohlader'" | critical |
| 04-010 | Accessibility | Heading order broken — h3 with no preceding h2               | axe: "heading-order — li:nth-child(1) > .p-5 > header > h3"                               | medium   |

### /apply — Gut feel 3/5

_Form fields have proper accessible names and native required validation works (the empty-submit screenshot shows a real "Please fill out this field." bubble). Weakness is the lack of a programmatic error summary._

| #      | Category      | Finding                                                                                  | Evidence                                                                                           | Severity |
| ------ | ------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| 04-004 | Forms & Input | Native-only error bubbles; no aria-live error summary; bubble anchors off-screen at zoom | apply-003-form-empty-submit.png; exploration-log "no visible validation errors after empty submit" | high     |

### /news (listing) — Gut feel 3/5

| #      | Category        | Finding                                                                                | Evidence          | Severity |
| ------ | --------------- | -------------------------------------------------------------------------------------- | ----------------- | -------- |
| 04-017 | Visual & Layout | A card cover image fails to load, surfacing raw alt text as a broken-image placeholder | news-001-load.png | medium   |

### /news/\* (articles) — Gut feel 3/5

| #      | Category      | Finding                                                                 | Evidence                                                     | Severity |
| ------ | ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ | -------- |
| 04-007 | Accessibility | Contrast fail on article meta (`.mt-5`) and inline body links (`p > a`) | axe: "color-contrast serious — .mt-5"; "p:nth-child(48) > a" | high     |
| 04-008 | Accessibility | Share icons exposed as bare 'X', 'in', 'f', 'link'                      | news-...-text.md: "X / in / f / link"                        | medium   |
| 04-009 | Accessibility | Complementary/aside landmark not at top level                           | axe: "landmark-complementary-is-top-level — .lg:block"       | medium   |

### /this-page-does-not-exist (404) — Gut feel 2/5

| #      | Category      | Finding                                  | Evidence                                                                             | Severity |
| ------ | ------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| 04-006 | Accessibility | Contrast fail on '404' label and subtext | axe: "color-contrast — .tracking-wide, .mt-2"; this-page-does-not-exist-001-load.png | high     |

### /admin/news — Gut feel 2/5

| #      | Category      | Finding                                                  | Evidence                                              | Severity |
| ------ | ------------- | -------------------------------------------------------- | ----------------------------------------------------- | -------- |
| 04-011 | Accessibility | Serious aria-prohibited-attr on list (`.text-slate-300`) | axe: "aria-prohibited-attr serious — .text-slate-300" | high     |

### /admin/media — Gut feel 2/5

| #      | Category      | Finding                                                                      | Evidence                                                                                      | Severity |
| ------ | ------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| 04-012 | Accessibility | Contrast fail on filter counts (`.mr-1`) + description; broken heading order | axe: "color-contrast — .mr-1, .space-y-2 > p"; "heading-order — h3"; admin-media-001-load.png | high     |

### /admin/pages/new — Gut feel 2/5

| #      | Category      | Finding                                            | Evidence                      | Severity |
| ------ | ------------- | -------------------------------------------------- | ----------------------------- | -------- |
| 04-013 | Accessibility | Duplicate (non-unique) landmark in wizard (`.p-0`) | axe: "landmark-unique — .p-0" | medium   |

### /admin/news/new — Gut feel 2/5

| #      | Category      | Finding                                                | Evidence                                                | Severity |
| ------ | ------------- | ------------------------------------------------------ | ------------------------------------------------------- | -------- |
| 04-014 | Accessibility | Complementary landmark not at top level (`.space-y-5`) | axe: "landmark-complementary-is-top-level — .space-y-5" | medium   |

### Pages with clean axe + tab data (only the global no-skip-link friction applies)

/about, /contact, /privacy, /terms, /thank-you-for-applying, /pre-call-resources, /admin/pages, /admin/libraries, /admin/settings/users, /admin/pages/redirects, /admin/forgot-password. The only tab issue on these is the `nextjs-portal` "no visible focus indicator" stop, which is the dev-tools artifact and is excluded per the brief.

---

## Blockers

No hard 404/broken-feature blockers, but two **critical** issues function as journey-stoppers for me specifically:

1. **04-001 / 04-002 — Keyboard focus traps in the testimonial and case-study videos** with no visible focus indicator. On the two pages most central to deciding to apply, tabbing into a video may strand my focus with no way out and no on-screen cue of where I am.

---

## My Top 10 Issues

1. **04-001** (critical) — Homepage testimonial video focus traps, no focus ring.
2. **04-002** (critical) — Case-studies video focus traps, no focus ring.
3. **04-003** (high) — No skip-to-content link anywhere; I tab through nav + 12 video stops to reach content.
4. **04-018** (high) — Application success state likely never announced to my screen reader; no redirect to /thank-you-for-applying.
5. **04-005** (high) — Homepage credibility stats fail AA contrast.
6. **04-006** (high) — 404 page '404' label and subtext fail AA contrast — unreadable exactly when I need to recover.
7. **04-007** (high) — News article meta and inline body links fail AA contrast.
8. **04-011** (high) — Serious aria-prohibited-attr in the admin news list corrupts SR output.
9. **04-012** (high) — Media library filter counts/description fail contrast + broken heading order.
10. **04-004** (high) — Apply form has no programmatic aria-live error summary; native bubbles anchor off-screen at 200% zoom.
