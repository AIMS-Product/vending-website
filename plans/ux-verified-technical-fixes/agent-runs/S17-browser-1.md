# S17 — Final-proof BROWSER portion (live :3000)

Branch `ux-review-fixes`. No `src/` code changed, no git mutations, no builds/restarts.
All checks run against the running dev server at http://localhost:3000 (admin dev-auth bypass).

## Check-by-check verdict

| #   | Check                                                                           | Verdict  | Evidence                                                                                              |
| --- | ------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| 1   | **S20 click-through** (deferred gate)                                           | **PASS** | see below                                                                                             |
| 2   | News cleanup (S19 archive via NEW row menu) + S10 still archived                | **PASS** | `shots/s17-news-s19-before.png`, `shots/s17-news-s19-after.png`, `shots/s17-news-archived-filter.png` |
| 3a  | `/apply` empty submit → error summary + privacy line                            | **PASS** | `shots/s17-3a-apply-errors.png`                                                                       |
| 3b  | `/contact` State label `(optional)`                                             | **PASS** | `shots/s17-3b-contact-optional.png`                                                                   |
| 3c  | `/news` first-paint cards                                                       | **PASS** | `shots/s17-3c-news-cards.png`                                                                         |
| 3d  | `/case-studies` loads, sr-only headings invisible                               | **PASS** | `shots/s17-3d-case-studies.png`                                                                       |
| 3e  | `/admin/pages` ScheduleFailedKpi absent, legend present, 16px checkbox          | **PASS** | `shots/s17-3e-admin-pages.png` + KPI absence probe                                                    |
| 3f  | `/admin/news/new` @375px sticky save bar at bottom                              | **PASS** | `shots/s17-3f-news-new-375-savebar.png`                                                               |
| 3g  | Admin sidebar "Content libraries" item present                                  | **PASS** | `shots/s17-3g-sidebar-libraries.png`                                                                  |
| 4   | Axe sample (news article, /admin/pages/new, /case-studies) — 0 serious/critical | **PASS** | `s17-axe-news-article.json`, `s17-axe-pages-new.json`, `s17-axe-case-studies.json`                    |

## Check 1 — S20 click-through (the deferred gate) — PASS

Flow executed on :3000 by `s17-s20-clickthrough.mjs`:

1. `/admin/pages/new` → create gate → "Start building page" (SEO/Resource type, blank).
2. Opened the SEO panel and typed a title into `#page-title-field`. The derived
   slug populated (`/resources/<title>`) and the readiness "Add a page title"
   item cleared. Screenshot: `shots/s17-s20-0-title-typed.png`.
3. Autosave (S3b) created the draft row and the top-rail **"Pages" back-link href
   flipped from `/admin/pages` to `/admin/pages?created=<id>`** —
   captured live: `autosave assigned page id: 8f994979-0962-4df1-aa9a-e684193b61e5`,
   `href: /admin/pages?created=8f994979-0962-4df1-aa9a-e684193b61e5`.
   The controller also swapped the URL bar to `/admin/pages/<id>` via
   `history.replaceState`, confirming the create succeeded.
4. Clicking the back-link landed on `/admin/pages?created=<id>`. Confirmed on the
   list page (`s17-verify-banner.mjs` against the same id) that the page renders:
   - the green success banner (`role="status"`):
     `Created "uxfix-s17-throwaway-mq8qoh90". It is at the top of the list below.`
     with an **"Open page"** link, and
   - the **highlighted new row** (`data-created-row="true"`) for the slug
     `/resources/uxfix-s17-throwaway-mq8qoh90`.
     Screenshot: `shots/s17-verify-banner.png`.
5. **Archived the throwaway** via the row "⋮" menu (summary
   "Open actions for …" → "Archive page" → portaled `<dialog>` → "Confirm").
   Result: the page moved out of drafts and into the archived filter
   (`beforeRows:1, archivedRows:1, stillInDrafts:0`).
   Screenshots: `shots/s17-page-archive-8f994979-{before,confirm,after}.png`.

**Page id handled: `8f994979-0962-4df1-aa9a-e684193b61e5` (created, then archived).**

### Important findings during check 1

- **The page slug must be unique across active pages.** Re-running with the fixed
  title `uxfix-s17-throwaway` collided with an earlier throwaway holding that slug;
  `createSeoPageDraftForEditor` then returns non-`created` and the back-link stays
  plain `/admin/pages` (no `?created=`). The driver now uses a unique title per run.
  This is correct app behaviour (duplicate-slug guard), not a regression — but it
  means the deferred-gate proof only works against a free slug.
- **First-run orphan cleaned up.** An earlier successful create with slug
  `uxfix-s17-throwaway` (page id `2b7ee5a0-3a59-4142-bb61-9ef4307910af`) was left as
  a draft by an interrupted run. It has been **archived** via the same row-menu flow
  (`beforeRows:1, archivedRows:1, stillInDrafts:0`).
  Screenshots: `shots/s17-page-archive-2b7ee5a0-{before,confirm,after}.png`.

## Check 2 — News cleanup — PASS

`s17-news-cleanup.mjs`:

- `uxfix-s19-throwaway` (id `6078e5be-6829-4b8a-af16-bd0cd9bb1dbf`) archived via the
  NEW news row actions menu (re-proving S10 row archive on a real target):
  `s19BeforeInDrafts:1, s19ArchivedRows:1, s19StillInDrafts:0`.
- The two S10 throwaways remain archived (no action needed, confirmed in the
  archived filter): `uxfix-s10-throwaway-mq8oijc8` → 1,
  `uxfix-s10-throwaway-bulk-mq8oijc8` → 1.

## Check 3 — Smoke sweep — PASS (all 7)

Raw results from `s17-smoke.mjs`:

- 3a `/apply`: error summary visible, 6 anchor links (`a[href^="#lead-"]`), privacy line visible.
- 3b `/contact`: State label text = `State (optional)`.
- 3c `/news`: 6 article cards present on first paint (domcontentloaded).
- 3d `/case-studies`: h1 = "Case Studies", page loaded.
- 3e `/admin/pages`: bulk checkbox 16×16px; readiness legend present (12 hits);
  **ScheduleFailedKpi card absent** — the `[data-kpi="schedule-failed"]` card and any
  "need attention" text both count 0 (the single "Schedule failed" text match is the
  always-present workflow-filter label at page.tsx:90, not the KPI card, which returns
  `null` at count ≤ 0).
- 3f `/admin/news/new` @375px: save bar present, `position: fixed`, in viewport at bottom.
- 3g admin sidebar: "Content libraries" present (2 hits).

## Check 4 — Axe sample (fresh, final) — PASS

`s17-axe.mjs`, full WCAG ruleset (not scoped):

- `/news/how-to-choose-the-perfect-location-for-vending-machine`: 0 total, 0 serious/critical.
- `/admin/pages/new` (create gate): 0 total, 0 serious/critical.
- `/case-studies`: 0 total, 0 serious/critical.

JSONs: `s17-axe-news-article.json`, `s17-axe-pages-new.json`, `s17-axe-case-studies.json`.

## Throwaway ids handled

| id                                     | type                                | final state |
| -------------------------------------- | ----------------------------------- | ----------- |
| `8f994979-0962-4df1-aa9a-e684193b61e5` | SEO page (S20 click-through target) | archived    |
| `2b7ee5a0-3a59-4142-bb61-9ef4307910af` | SEO page (first-run orphan)         | archived    |
| `6078e5be-6829-4b8a-af16-bd0cd9bb1dbf` | news draft (S19 throwaway)          | archived    |

## Artifact paths (all absolute under repo)

Scripts: `plans/ux-verified-technical-fixes/agent-runs/s17-s20-clickthrough.mjs`,
`s17-verify-banner.mjs`, `s17-archive-pages.mjs`, `s17-news-cleanup.mjs`,
`s17-smoke.mjs`, `s17-kpi-check.mjs`, `s17-axe.mjs` (+ probes `s17-probe.mjs`, `s17-probe2.mjs`).
Screenshots: `plans/ux-verified-technical-fixes/agent-runs/shots/s17-*.png`.
Axe JSON: `plans/ux-verified-technical-fixes/agent-runs/s17-axe-*.json`.

## Overall

**All S17 browser checks PASS.** The deferred S20 click-through is proven end to end
(start page → autosave creates id → back-link carries `?created=<id>` → banner +
highlighted row on the list → row-menu archive). All throwaways archived; no live
`src/` code was modified.
