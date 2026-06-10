# Persona Review — 04 David (Accessibility-Dependent User, 45)

**Lens:** Low vision (200% zoom + screen reader). Keyboard-only, no mouse. Motor
impairment. Knows tech well, depends on correct implementation. I need a coherent
landmark structure, visible focus everywhere, real text alternatives for state, large
targets, and a tab order that doesn't make me crawl through 27 stops to reach the field
I want.

I read the full `axe-results.json`. The headline numbers: the editor ships a **serious**
`aria-prohibited-attr` violation, the editor / revision / new pages all break landmark
structure (`landmark-complementary-is-top-level`, `landmark-no-duplicate-main`,
`landmark-unique`, `landmark-main-is-top-level`), and **every page** records a
`nextjs-portal` tab stop with "no visible focus indicator". Those are my world, and they
are real walls — not nitpicks.

---

## Category 0 — Journey Completion

| #   | Journey                | Score | Justification                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | create-first-page      | 2     | I can complete it, but the SEO-panel form fields I must fill are tab stops 28-33 of 50 in the editor — I crawl past the entire rendered page preview and footer nav to reach "Page title".                                                                                                                               |
| 2   | publish-and-view-live  | 1     | The blocker is exposed as small orange text ("Fix SEO title") with the Publish button visually greyed and no programmatic explanation of _why_ it is disabled; one required field ("CTA destination URL") lives only in a modal the blocker text never names. With a screen reader I cannot tell what is gating publish. |
| 3   | preview-draft          | 3     | One click, opens a new tab — but a new tab opening with no announced context is disorienting with a screen reader; I don't know focus moved.                                                                                                                                                                             |
| 4   | revision-restore       | 2     | Works after publish, but the "Restore draft" control is tab stop 44; finding it by keyboard means tabbing past the whole SEO panel. The pre-publish empty state silently denies undo.                                                                                                                                    |
| 5   | schedule-publish       | 1     | The schedule field is buried in Advanced SEO (stop 34+), uses "Pacific Time" for an AU business, and after save the field re-renders EMPTY with no status text anywhere — a screen reader user gets zero confirmation the schedule was set or cleared.                                                                   |
| 6   | create-redirect        | 3     | The form is keyboard-reachable and labelled, but the redirects table has no edit/delete control, so a typo I make by keyboard is permanent from this UI.                                                                                                                                                                 |
| 7   | find-duplicate-archive | 2     | The row ⋮ menu is a native details/summary (good, keyboard-openable), but "Archive page" is distinguished from the other items by red text ALONE — at 200% zoom with reduced color perception I cannot tell the destructive item apart from "Move to draft".                                                             |

**Journey verdict:** Two outright blockers for me (publish, schedule), the rest
completable only with disproportionate effort. The builder _works_ with a keyboard but
treats the keyboard/SR path as an afterthought.

---

## Per-Page Review

### /admin/pages (Pages list) — Gut feel: 2

- **Landmark structure is inverted.** ARIA snapshot: `main:` directly contains
  `complementary:` (the whole sidebar nav) as its first child. A screen reader announces
  the primary navigation as _inside_ the main content region. (text/admin-pages-text.md)
- **Readiness and Status are color-only.** Both columns render as bare colored dots
  (yellow/red/blue/green) — screenshot `admin-pages-001-load.png`. The accessible name
  is on a button ("SEO readiness: Needs work") but the _visible_ signal is a dot with no
  text or shape; at 200% zoom with low color discrimination I cannot read page state at a
  glance, which is the entire purpose of the column.
- **Tab path is long and loops.** axe tabOrder runs 50 stops; the `nextjs-portal` stop 46
  has "no visible focus indicator" (tabIssues).

### /admin/pages/new (Choice gate) — Gut feel: 3

- **`landmark-unique` (moderate)** — duplicated region landmark `.p-0`; ARIA snapshot
  shows `region "Create page"` nested directly inside `region "Create page"` with the
  same accessible name. A screen reader announces two identical regions. (axe id
  `landmark-unique`; text/admin-pages-new-text.md)
- Six `nextjs-portal` "no visible focus indicator" stops in tabIssues.
- Otherwise the cleanest page for me: clear step list, real headings, focusable cards.
  (screenshot `admin-pages-new-001-load.png`)

### /admin/pages/{id} (Editor) — Gut feel: 1

- **`aria-prohibited-attr` (SERIOUS)** — `span[aria-label="Hero block"]` and
  `span[aria-label="FAQ block"]` carry `aria-label` on a role that prohibits it, so the
  label is dropped; with a screen reader those block markers are unnamed. (axe id
  `aria-prohibited-attr`, count 2)
- **`landmark-complementary-is-top-level` (moderate)** — the Draft-preview `aside` is
  nested, not top-level; ARIA snapshot confirms `complementary:` sits inside
  `main > region "Edit SEO page"`. (axe id; text lines `- complementary:` under main)
- **Brutal tab order.** axe tabOrder: the SEO form I must edit is stops 28 ("Page title")
  → 33 ("Meta description"); "Publish changes" is stop 27; "Restore draft" stop 44;
  "Add comment" stop 50. To reach the publish controls by keyboard I tab through the
  entire rendered page preview (logo, primary nav, "Step inside", every block field) and
  footer nav first. (axe tabOrder, this page)
- **Disabled Publish gives no reason.** screenshot `admin-pages-e44f0fc3-...-001-load.png`
  / `journey-publish-and-view-live-02-read-publish-blocker.png`: button greyed, the only
  cue is "Fix SEO title" in small orange text. ARIA snapshot names the button "Publish
  status Published Improve SEO title" — the blocker is crammed into the accessible name
  rather than associated via `aria-describedby`, so I can't navigate to the explanation.
- **Show/hide field toggles are tiny eye icons** ("Show eyebrow", "Show body", "Hide cta")
  — small icon-only targets below the 24px AAA / 44px touch guidance, hard to hit with a
  motor impairment. (screenshot `...-001-load.png`, ARIA buttons "Show eyebrow"/"Show body")

### /admin/pages/{id}/revisions/{rev} (Revision preview) — Gut feel: 1

- **`landmark-no-duplicate-main` + `landmark-main-is-top-level` + `landmark-unique`
  (all moderate)** — ARIA snapshot shows `main:` directly nested inside `main:`. Two main
  landmarks; a screen reader's "jump to main" is now ambiguous. (axe ids, this page;
  text/...-revisions-...-text.md lines 23-24)
- Eight `nextjs-portal` "no visible focus indicator" stops in tabIssues.

### /admin/pages/redirects (Redirects) — Gut feel: 3

- Form is labelled and keyboard-reachable; select has real options. But the
  `complementary` sidebar is again nested inside `main` (text/admin-pages-redirects-text.md).
- Three `nextjs-portal` "no visible focus indicator" stops in tabIssues.
- No delete control on the table — a keyboard typo is uncorrectable here.
  (exploration-log: "Redirects table has no delete/edit controls")

### /admin/pages/block-preview-audit — Gut feel: 3

- 0 axe violations, but 5 `nextjs-portal` "no visible focus indicator" stops, and the
  tabOrder loops the sidebar repeatedly (50 stops, all nav/sign-out). Dev QA page; low
  stakes for me.

### /resources/{slug} (Published, public) — Gut feel: 4

- 0 axe violations; clean landmark/heading structure (`heading [level=1]`, named navs).
  Two `nextjs-portal` focus-indicator gaps. This is the most accessible surface I touched.

---

## Findings

| #                    | Page                                        | Journey                | Category                  | Finding                                                                                                                                                                         | Evidence                                                                                                                                                                      | Severity | Suggested Fix (current → proposed)                                                                                                                                     | Persona Rationale                                                                                                                          |
| -------------------- | ------------------------------------------- | ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 04-accessibility-001 | /admin/pages/{id}                           | publish-and-view-live  | Accessibility & Inclusion | Hero/FAQ block markers carry `aria-label` on an element whose role prohibits it; label is dropped, blocks are unnamed to a screen reader                                        | axe `aria-prohibited-attr` (serious), `span[aria-label="Hero block"]`, `span[aria-label="FAQ block"]`                                                                         | critical | `<span aria-label="Hero block">` → move the label to a focusable element with an allowed role, or use `<span><span class="sr-only">Hero block</span>…</span>`          | I navigate blocks by screen reader; an unnamed block marker means I can't tell where one block ends and the next begins.                   |
| 04-accessibility-002 | /admin/pages                                | find-duplicate-archive | Accessibility & Inclusion | Readiness and Status columns convey meaning by colored dot alone (no text/shape)                                                                                                | screenshot `admin-pages-001-load.png`; text/admin-pages-text.md `cell "SEO readiness: Needs work": button` (name only, no visible text)                                       | critical | Bare color dot → dot + short text label ("Needs work" / "Published") or distinct shapes/icons per state                                                                | At 200% zoom with low color discrimination I cannot read the two most important status columns; the dot is invisible signal to me.         |
| 04-accessibility-003 | /admin/pages/{id}                           | publish-and-view-live  | Feedback & State          | Disabled Publish button gives no programmatically-associated reason; blocker is small orange text and stuffed into the button's accessible name                                 | screenshot `journey-publish-and-view-live-02-read-publish-blocker.png`; text snapshot `button "Publish status Published Improve SEO title"`                                   | critical | Greyed button + "Fix SEO title" text → keep button enabled, `aria-describedby` pointing at a listed, focusable "Why can't I publish?" region enumerating every blocker | A screen reader announces the button name but I can't navigate to or enumerate the blockers; I don't know what to fix or where.            |
| 04-accessibility-004 | /admin/pages/{id}                           | create-first-page      | Accessibility & Inclusion | SEO panel form fields (Page title…Meta description) are tab stops 28-33 of 50; the publish/SEO controls sit behind the entire rendered page preview and footer nav in tab order | axe `tabOrder` (this page): stop 28 "Page title", stop 33 "Meta description", stop 27 "Publish changes", stop 44 "Restore draft"                                              | high     | Single DOM order forcing 27 stops before the editing panel → make the SEO panel a top-level landmark early in tab order, or add a skip-link ("Skip to SEO settings")   | Keyboard-only, I must tab through ~27 controls I don't want to reach the fields I edit on every single page.                               |
| 04-accessibility-005 | /admin/pages/{id}/revisions/{rev}           | revision-restore       | Accessibility & Inclusion | Two nested `main` landmarks on the revision page                                                                                                                                | axe `landmark-no-duplicate-main` + `landmark-main-is-top-level` + `landmark-unique` (moderate); text/...-revisions-...-text.md lines 23-24 `main:` inside `main:`             | high     | `<main><main>…` → single `<main>`; inner wrapper becomes a `<div>` or `<section>` with heading                                                                         | "Jump to main content" is ambiguous with two mains; I land in the wrong region.                                                            |
| 04-accessibility-006 | /admin/pages, /redirects, /admin/pages/{id} | —                      | Accessibility & Inclusion | Sidebar `complementary` landmark is nested inside `main` instead of being top-level                                                                                             | axe `landmark-complementary-is-top-level` (editor); text/admin-pages-text.md & admin-pages-redirects-text.md show `main:` → `complementary:`                                  | high     | `<main><aside>nav</aside>…` → move the sidebar `<aside>`/`<nav>` out of `<main>` to top-level document landmarks                                                       | Screen-reader landmark navigation is how I orient; the nav announcing as "inside main content" breaks my mental map of the page.           |
| 04-accessibility-007 | all 8 pages                                 | —                      | Accessibility & Inclusion | A `nextjs-portal` element receives focus with no visible focus indicator on every page (multiple stops per page)                                                                | axe `tabIssues`: "no visible focus indicator" — /admin/pages stop 46, /new stops 6/14/22/30/38/46, revision 8 stops, redirects 3 stops, block-preview 5 stops, public 2 stops | high     | Focusable portal element with no outline → set `tabindex="-1"` on non-interactive portals, or apply a visible `:focus-visible` outline                                 | Keyboard-only, an invisible focus stop means my focus vanishes and I don't know where I am on the page.                                    |
| 04-accessibility-008 | /admin/pages                                | schedule-publish       | Feedback & State          | After saving a scheduled publish the field re-renders empty and no "Scheduled for…" status appears anywhere; no confirmation reaches a screen reader                            | journeys.md schedule-publish "field re-rendered EMPTY and no 'Scheduled for …' status appeared anywhere"; screenshot `journey-schedule-publish-02-open-advanced-sections.png` | high     | Silent empty field after save → persist the value and render a `role="status"` line ("Scheduled to publish {date} {tz}") announced on save                             | I rely on announced confirmations; with no status text I cannot tell if the schedule saved, failed, or cleared.                            |
| 04-accessibility-009 | /admin/pages                                | find-duplicate-archive | Trust & Safety            | Destructive "Archive page" item in the row menu is distinguished only by red text                                                                                               | screenshot `admin-pages-017-row-menu-open.png` (red "Archive page" among black items)                                                                                         | medium   | Red-text-only "Archive page" → add a warning icon + keep it visually grouped/separated, so destructiveness isn't color-dependent                                       | At 200% zoom with reduced color perception I can't tell the irreversible item from "Move to draft" and may archive a live page by mistake. |
| 04-accessibility-010 | /admin/pages/{id}                           | create-first-page      | Accessibility & Inclusion | Field-level show/hide toggles are tiny icon-only eye buttons below comfortable target size                                                                                      | screenshot `admin-pages-e44f0fc3-0dcf-480f-9c99-f3409c690378-001-load.png`; ARIA buttons "Show eyebrow", "Show body", "Hide cta"                                              | medium   | ~16px eye icon target → enlarge hit area to ≥24px (AAA 24×24 / touch 44×44) and keep the existing accessible name                                                      | Motor impairment makes small targets a real miss-and-retry cost on a control I use per field.                                              |
| 04-accessibility-011 | /admin/pages/new                            | create-first-page      | Accessibility & Inclusion | Duplicate identically-named `region "Create page"` nested landmarks                                                                                                             | axe `landmark-unique` (moderate), selector `.p-0`; text/admin-pages-new-text.md `region "Create page"` inside `region "Create page"`                                          | medium   | Two `region` landmarks named "Create page" → make the inner wrapper a non-landmark `<div>`, keep one named region                                                      | Two identically-named regions in the landmark list give me no way to tell them apart when jumping.                                         |
| 04-accessibility-012 | /admin/pages/{id}                           | publish-and-view-live  | Forms & Input             | A required field ("CTA destination URL") lives only inside the Block settings modal; the publish blocker text never says where to find it                                       | journeys.md "the destination field is NOT on the canvas; it lives in Block actions → Edit settings"; screenshot `journey-publish-and-view-live-11-block-settings-modal.png`   | high     | Blocker "Fix content 1 · Destination URL" with no location → make the blocker a link that moves focus into the modal field, or surface the field on the canvas         | A screen-reader user gets a blocker naming a field that isn't in the reading order; I'd never find it without sighted trial-and-error.     |

---

## Overall

**Overall gut feel: 2/5.** The public output and the create-page wizard are genuinely
accessible. The editor — where the actual work happens — is not built for me: a serious
ARIA violation, inverted landmark structure on three pages, a 27-stop crawl to my fields,
a disabled Publish with no navigable reason, color-only status everywhere, and
focus-indicator gaps on every page. As a keyboard + screen-reader user I could technically
finish most journeys, but publishing and scheduling were effectively blockers, and the
whole flow assumes a sighted mouse user.
