# Feature Plan: ux-verified-technical-fixes

Status: IN_PROGRESS
Last updated: 2026-06-11
Owner: feature-orchestrator

## Working Brief

- Feature: Close all 31 technically-defensible findings from the June 11 code verification of both June 10 UX reviews (strategy IDs I1–I16; evidence in `reports/ux-review-status-2026-06-11/` — STATUS.md, FIX-GUIDE.md, merged.json).
- Primary actors: public-site visitors (apply/news/case-studies), admin studio users (pages/news/redirects lists and editors).
- Core invariant: no behavior regression on previously-fixed UX work (rounds 1–2); every claim of "fixed" backed by measured fresh evidence.
- Previous intended behaviors: apply-form redirect to /thank-you-for-applying; inline form validation + aria wiring; news naming/301s; image fallback; pages-list row actions/bulk archive; publish checklist; schedule status card; redirect CRUD; Pacific time formatting.
- Intentional behavior changes: only those listed per node (e.g. news rows gain archive; nav links gain tap padding).
- Unsafe outcomes: breaking the apply conversion path; archiving the wrong news post; visual regression of compact admin aesthetic; CLS work that breaks SSR stat values; landmark changes that break the skip link.
- Evidence: per-issue file:line evidence in reports/ux-review-status-2026-06-11/merged.json + FIX-GUIDE.md.
- Assumptions: dev server + Playwright available for browser gates; baseline 606/606 vitest, tsc clean at commit 6c94fbf.
- Out of scope: 39 judgment-call items, 29 Kody deferrals, push/PR/deploy.

## Risk Classification

- Overall tier: T2 (admin workflows + conversion-form UI; no money/permissions/migrations)
- Live-data risk: none (local-only; archive action reversible, reuses existing server action patterns)
- Migration risk: none
- External-contract risk: none

## Dependency Graph

| Node | Title                                                              | Tier | Depends On | Parallel Group | Shared-State Risk               | Status  |
| ---- | ------------------------------------------------------------------ | ---- | ---------- | -------------- | ------------------------------- | ------- |
| S1   | CLS < 0.1 cold loads (I1: C096/C099/C020/C127/C134)                | T2   | none       | W1-A           | globals.css (S4 deferred to W2) | PENDING |
| S7   | News cards visible on first paint (I7: C005)                       | T3   | none       | W1-B           | none                            | PENDING |
| S16  | Verify-first trio (I16: C132/C145/SEO-P3d)                         | T3   | none       | W1-C           | read-only + report              | PENDING |
| S10  | News list row archive + bulk (I10: C141/C033/C019)                 | T2   | none       | W2-A           | none                            | PENDING |
| S8   | Redirect path Zod refine (I8: P2-3)                                | T2   | none       | W2-B           | none                            | PENDING |
| S4   | Article body link contrast (I4: C050)                              | T3   | S1         | W2-C           | globals.css after S1            | PENDING |
| S5   | Hoist nested asides (I5: C052/C057)                                | T3   | none       | W2-D           | none                            | PENDING |
| S14  | Apply error summary (I14: C014)                                    | T2   | none       | W3-A 1/3       | PublicLeadForm.tsx chain        | PENDING |
| S13  | Privacy line at submission (I13: C088)                             | T3   | S14        | W3-A 2/3       | PublicLeadForm.tsx chain        | PENDING |
| S12  | "(optional)" labels (I12: C027)                                    | T3   | S13        | W3-A 3/3       | PublicLeadForm.tsx chain        | PENDING |
| S9   | Create-page success feedback (I9: C140)                            | T3   | none       | W3-B 1/2       | admin/pages/page.tsx chain      | PENDING |
| S15  | Schedule-failed KPI surfacing (I15: C137)                          | T3   | S9         | W3-B 2/2       | admin/pages/page.tsx chain      | PENDING |
| S11  | Libraries sidebar entry (I11: C142)                                | T3   | none       | W3-C           | AdminShell.tsx                  | PENDING |
| S2   | Public nav/footer tap targets ≥44px (I2: C093/C110/C094/C129/C047) | T3   | S1         | W3-D           | Header/Footer after S1          | PENDING |
| S3   | Admin hit areas ≥24px (I3: C010/C107)                              | T3   | S15        | W4-A           | admin/pages/page.tsx after W3-B | PENDING |
| S6   | Case-studies heading order (I6: C053/C086)                         | T3   | none       | W4-B           | none                            | PENDING |
| S17  | Final proof + verification.md                                      | —    | all        | W5             | git (orchestrator)              | PENDING |

S16 reproductions, if any, become new nodes scheduled in W4.

## Nodes

### S1 - Cold-load CLS under 0.1 on public pages

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: first-time visitor cold-loads /, /about, /news, or an article
Behavior to test: When a page is cold-loaded, then cumulative layout shift stays < 0.1 (no footer pop-in shift, no font-swap reflow)
Invariant protected: SSR renders real stat values (500+/$3M+/3,000+); footer content/links unchanged
Intentional behavior changes: footer space reserved before hydration; webfont swap no longer reflows
Previous intended behaviors preserved: N3 SSR stats, N10 image dimensions, hero aspect boxes
Unsafe outcomes: blank reserved gap visible at bottom of short pages; font fallback visibly mismatched
Dependencies: none
Expected files: src/components/site/Footer.tsx, src/app/layout.tsx, possibly src/app/globals.css
Write boundaries: those files + a CLS measurement script under plans/ux-verified-technical-fixes/tools/
Acceptance criteria:

- [ ] Measured cold-load CLS < 0.1 on /, /about, /news, one article (production build, fresh server start)
- [ ] Before measurement recorded for comparison
- [ ] Inter font configured with explicit display strategy (+ adjustFontFallback where applicable)
      Regression guards:
- SSR HTML still contains real stat values (existing AnimatedStatValue tests)
- Footer renders identical link set
  RGR:
- RED: scripted Playwright CLS measurement showing ≥0.263 on cold load (or document current repro)
- GREEN: footer min-height/static rendering + font-display; measurement < 0.1
- REFACTOR: extract measurement script for reuse in final proof
  Gates:
- Repo gate: vitest targeted + tsc
- Browser gate: CLS numbers before/after from `next build && next start` cold hits (REQUIRED, numeric)
- Boundary/migration gate: n/a
  External docs needed: next/font display/adjustFontFallback current docs (node_modules/next/dist/docs)
  Parallelization: parallel-safe (W1-A)
  Worker role: feature-slice-worker
  Exit evidence: before/after CLS table + screenshots + test output

### S7 - News cards visible on first paint

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: visitor lands on /news without scrolling
Behavior to test: When /news first paints, then above-the-fold article cards are visible without any scroll event
Invariant protected: ImageWithFallback behavior (C030 fix); reveal animation below the fold
Intentional behavior changes: in-viewport cards render revealed on mount
Previous intended behaviors preserved: news list data/pagination untouched
Unsafe outcomes: all animation removed (over-fix); cards flash
Dependencies: none
Expected files: src/components/sections/NewsList.tsx (+ its scroll-reveal helper + tests)
Write boundaries: NewsList + reveal helper + their tests
Acceptance criteria:

- [ ] First-paint screenshot (no scroll) shows first row of cards rendered
- [ ] Below-fold reveal still animates
      Regression guards: existing NewsList/ImageWithFallback tests stay green
      RGR:
- RED: test (or scripted browser check) proving cards hidden pre-scroll
- GREEN: honour IntersectionObserver initial callback / mount-time viewport check
- REFACTOR: only safe cleanup
  Gates:
- Repo gate: vitest targeted + tsc
- Browser gate: REQUIRED — /news screenshot at first paint without scrolling
- Boundary gate: n/a
  External docs needed: none
  Parallelization: parallel-safe (W1-B)
  Worker role: feature-slice-worker
  Exit evidence: screenshots + test output

### S16 - Verify-first trio

Status: PENDING
Tier: T3
Type: verification
Actor/trigger: orchestrator needs reproduce/not-reproduce verdicts before scheduling fixes
Behavior to test: three checks — (a) axe on /admin/pages/new: landmark-unique violation present? (C132) (b) 375px viewport on /admin/news/new: can Save scroll out of view? (C145) (c) immediate click on create gate after load: does it ever miss? (SEO-P3d)
Invariant protected: none (read-only)
Dependencies: none
Expected files: report only (agent-runs/S16-1.md + screenshots)
Write boundaries: plans/ux-verified-technical-fixes/agent-runs/ only — NO src changes
Acceptance criteria:

- [ ] Each of the three checks has a REPRODUCED / NOT-REPRODUCED verdict with evidence (axe JSON, screenshots, click-loop results)
      Gates:
- Repo gate: n/a
- Browser gate: REQUIRED (it is the node)
- Boundary gate: n/a
  Parallelization: parallel-safe (W1-C)
  Worker role: feature-slice-worker (verification mode)
  Exit evidence: verdicts + artifacts

### S10 - News list row archive + bulk

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: admin on /admin/news retires posts
Behavior to test: When the admin uses a news row's actions menu and confirms Archive, then the post's status becomes archived and the list updates; bulk select archives multiple
Invariant protected: archive is reversible status change; no hard delete introduced; editor archive path still works
Intentional behavior changes: news rows gain actions menu + bulk archive (pages-list parity)
Previous intended behaviors preserved: Edit link/navigation from rows
Unsafe outcomes: archiving without confirm; archiving wrong row
Dependencies: none
Expected files: src/app/admin/news/page.tsx, src/app/admin/news/actions (new or existing), small client component(s) mirroring pages list pattern, tests
Write boundaries: src/app/admin/news/\*\* + new components under it
Acceptance criteria:

- [ ] Row "⋮" menu with Archive + confirm dialog
- [ ] Bulk select + archive matching pages-list pattern
- [ ] Server action validates ids, reuses existing archive semantics
      Regression guards: existing news page/server tests green
      RGR: RED failing action/component tests first
      Gates:
- Repo gate: vitest targeted + tsc
- Browser gate: REQUIRED — archive a throwaway post via UI, screenshot, restore/clean up
- Boundary gate: archived row state verified via service/page reload
  External docs needed: none (in-repo pattern: src/app/admin/pages/page.tsx PageActionsMenu + BulkArchiveControls)
  Parallelization: parallel-safe (W2-A)
  Worker role: feature-slice-worker
  Exit evidence: tests + browser screenshots + cleanup proof

### S8 - Redirect source/destination path refine

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: admin submits a redirect path not starting with /
Behavior to test: When sourcePath or destinationPath does not start with "/", then the form shows the friendly inline message and the value never reaches the service
Invariant protected: valid paths still create/update; values preserved on error; pageId UUID floor (pre-flight fix) stays
Intentional behavior changes: client/action-level format validation added
Unsafe outcomes: blocking previously-valid formats (e.g. full URLs if the service supports them — check service rules first and mirror them)
Dependencies: none
Expected files: src/app/admin/pages/redirects/actions.ts + actions.test.ts (maybe form component for message display)
Write boundaries: src/app/admin/pages/redirects/\*\*
Acceptance criteria:

- [ ] "foo" → inline "Start the path with /…" message, no service call
- [ ] Mirrors the service's actual path rules (no false rejects)
      Regression guards: all existing redirect action tests green
      RGR: RED test for non-/ path first
      Gates:
- Repo gate: vitest targeted + tsc
- Browser gate: REQUIRED — submit "foo" in the real form, screenshot inline error
- Boundary gate: n/a
  Parallelization: parallel-safe (W2-B)
  Worker role: feature-slice-worker
  Exit evidence: tests + screenshot

### S4 - Article body link contrast

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: reader views article body links
Behavior to test: When an article body renders, then inline link color meets ≥4.5:1 on its background
Invariant protected: byline color (already 5.70:1), underlines kept
Dependencies: S1 (globals.css ownership)
Expected files: src/app/globals.css (.public-news-prose a)
Write boundaries: globals.css link rules only
Acceptance criteria:

- [ ] Computed contrast ≥4.5:1 (use #066a99 unless measured better)
- [ ] axe color-contrast on an article page: 0 serious
      Gates:
- Repo gate: tsc (no test surface) + visual
- Browser gate: REQUIRED — axe run on one article page
  Parallelization: W2-C after S1
  Worker role: feature-slice-worker
  Exit evidence: axe output + contrast math

### S5 - Hoist nested complementary landmarks

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: screen-reader user navigates article pages and the news editor by landmark
Behavior to test: When axe runs on an article page and /admin/news/new, then landmark-complementary-is-top-level reports 0 violations
Invariant protected: skip link + main landmark wiring (N12); visual layout unchanged
Dependencies: none
Expected files: src/components/sections/NewsArticle.tsx, src/components/admin/NewsEditorForm.tsx (+ landmark tests)
Write boundaries: those two files + tests
Acceptance criteria:

- [ ] axe: 0 landmark-complementary violations on both surfaces
- [ ] Visual layout unchanged (screenshot diff acceptable by eye)
      Gates:
- Repo gate: vitest targeted (landmark tests exist in repo) + tsc
- Browser gate: REQUIRED — axe before/after on both pages
  Parallelization: parallel-safe (W2-D)
  Worker role: feature-slice-worker
  Exit evidence: axe JSON before/after

### S14 - Apply form error summary

Status: PENDING
Tier: T2
Type: behavior
Actor/trigger: visitor submits /apply with invalid/missing fields
Behavior to test: When submit fails validation, then a summary box above the form lists each failed field as an anchor that focuses its input, and focus moves to the box
Invariant protected: existing inline per-field errors + aria wiring (C014 partial fix); successful-submit redirect to /thank-you-for-applying
Unsafe outcomes: double announcement (summary + live region) spam; focus traps
Dependencies: none
Expected files: src/components/forms/PublicLeadForm.tsx + test file
Write boundaries: PublicLeadForm.tsx + its tests (chain head for W3-A)
Acceptance criteria:

- [ ] Failed submit renders summary listing failed fields with anchor links
- [ ] Focus management verified
- [ ] Screen-reader semantics: role/aria correct, no duplicate assertive spam
      Gates:
- Repo gate: vitest targeted + tsc
- Browser gate: REQUIRED — submit empty form, screenshot summary, tab through anchors
  Parallelization: W3-A 1/3 (same worker continues S13, S12)
  Worker role: feature-slice-worker
  Exit evidence: tests + screenshots

### S13 - Privacy line at point of submission

Status: PENDING
Tier: T3
Type: behavior
Behavior to test: When the apply form renders, then a consent line with a working /privacy-policy link appears adjacent to the submit button (apply; contact too if shared rendering makes it natural)
Invariant protected: form submit behavior untouched
Dependencies: S14 (same file)
Write boundaries: PublicLeadForm.tsx + tests
Acceptance criteria:

- [ ] Line renders with working link; copy per decisions.md safe default
      Gates: repo + browser screenshot
      Parallelization: W3-A 2/3
      Exit evidence: screenshot + test

### S12 - "(optional)" labels on non-required fields

Status: PENDING
Tier: T3
Type: behavior
Behavior to test: When a shared form field is not required, then its label shows "(optional)" (closes C027: contact's State)
Invariant protected: required fields keep asterisk/required marking
Dependencies: S13 (same file)
Write boundaries: PublicLeadForm.tsx + tests
Acceptance criteria:

- [ ] Contact State shows "(optional)"; apply State unchanged (required)
      Gates: repo + browser screenshot of both forms
      Parallelization: W3-A 3/3
      Exit evidence: screenshots + test

### S9 - Create-page success feedback

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin creates a page and returns to the list
Behavior to test: When a page is created, then the admin sees explicit success feedback with a link to the new page, and the new row is findable at the top of the list
Invariant protected: create flow (one-step gate, N13); revalidation
Dependencies: none
Expected files: src/app/admin/pages/page.tsx and/or create flow files, tests
Write boundaries: src/app/admin/pages/\*\* (chain head W3-B; no redirects/ overlap)
Acceptance criteria:

- [ ] Success state visible after create (toast/banner with "Open" link, or highlighted top row — worker picks the smallest honest pattern consistent with existing toasts)
      Gates: repo + browser (create throwaway page, screenshot, archive it after)
      Parallelization: W3-B 1/2 (same worker continues S15)
      Exit evidence: screenshots + cleanup proof

### S15 - Schedule-failed surfaced in KPI strip

Status: PENDING
Tier: T3
Type: behavior
Behavior to test: When ≥1 page is in schedule-failed state, then the list's KPI/stat strip surfaces the count linking to the existing filter; when 0, nothing shows
Invariant protected: existing stat cards/tones; filter behavior
Dependencies: S9 (same file)
Write boundaries: src/app/admin/pages/page.tsx + tests
Acceptance criteria:

- [ ] Count visible when >0 (seed or mock state), absent at 0
      Gates: repo + browser/screenshot (test-render acceptable if seeding prod-like state is intrusive; then assert via component test + screenshot of 0-state)
      Parallelization: W3-B 2/2
      Exit evidence: test + screenshot

### S11 - Libraries sidebar entry

Status: PENDING
Tier: T3
Type: behavior
Behavior to test: When the admin sidebar renders, then "Content libraries" appears under CONTENT and routes to /admin/libraries with active state
Invariant protected: existing sidebar sections/active-state logic (N1 pattern)
Dependencies: none
Expected files: src/components/admin/AdminShell.tsx + AdminShell.test.tsx
Write boundaries: AdminShell.tsx + its test
Acceptance criteria:

- [ ] Link renders, navigates, active on /admin/libraries
      Gates: repo + browser screenshot
      Parallelization: W3-C
      Exit evidence: test + screenshot

### S2 - Public nav/footer tap targets

Status: PENDING
Tier: T3
Type: behavior
Behavior to test: When header/footer links render, then each link's hit area is ≥44px tall (mobile-first), with unchanged visual text size
Invariant protected: desktop layout density; focus-visible rings (N12)
Dependencies: S1 (Footer.tsx ownership)
Expected files: src/components/site/Header.tsx, src/components/site/Footer.tsx
Write boundaries: those two files (+ test if measurable)
Acceptance criteria:

- [ ] Measured bounding boxes ≥44px height for nav + footer links at 375px viewport
- [ ] No visual regression at desktop (screenshot)
      Gates: repo + browser (Playwright box measurements — numeric)
      Parallelization: W3-D
      Exit evidence: measurement table + screenshots

### S3 - Admin interactive hit areas

Status: PENDING
Tier: T3
Type: behavior
Behavior to test: When the pages list renders, then status-dot buttons and "⋮" row actions expose ≥24px hit areas, visuals unchanged
Invariant protected: compact admin aesthetic (user preference), legend/labels (N7)
Dependencies: S15 (same file)
Write boundaries: src/app/admin/pages/page.tsx (+ component files it owns)
Acceptance criteria:

- [ ] Measured hit areas ≥24px; dot visual size unchanged
      Gates: repo + browser measurement
      Parallelization: W4-A
      Exit evidence: measurement table + screenshot

### S6 - Case-studies heading order

Status: PENDING
Tier: T3
Type: behavior
Behavior to test: When /case-studies renders, then heading levels do not skip (axe heading-order: 0 violations)
Invariant protected: visual hierarchy of cards
Expected files: src/components/sections/CaseStudiesHero.tsx and/or CaseStudyQuotes.tsx
Write boundaries: those files + test
Acceptance criteria:

- [ ] axe heading-order 0 violations on /case-studies
      Gates: repo + axe
      Parallelization: W4-B
      Exit evidence: axe output

### S18 - Create-gate landmark uniqueness (from S16 check A, C132 REPRODUCED)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: screen-reader user on /admin/pages/new
Behavior to test: When axe runs on /admin/pages/new, then landmark-unique reports 0 violations
Root cause (from S16): nested named region landmarks — AdminShell's section[aria-labelledby="admin-shell-title"] plus the create-gate section[aria-labelledby="new-page-choice-title"] (SeoPageEditorShell.tsx:76)
Invariant protected: gate heading semantics/visuals unchanged
Expected files: src/components/admin/SeoPageEditorShell.tsx (inner section → div, heading kept)
Write boundaries: that file + test
Acceptance criteria:

- [ ] axe landmark-unique: 0 on /admin/pages/new
      Gates: repo (tsc + targeted) + axe re-run
      Parallelization: W3 (parallel-safe)
      Exit evidence: axe JSON before/after

### S19 - News editor mobile save visibility (from S16 check B, C145 REPRODUCED)

Status: PENDING
Tier: T3
Type: behavior
Actor/trigger: admin editing a news post at narrow viewport
Behavior to test: When the news editor renders under lg breakpoint, then a Save affordance is visible without scrolling to page bottom (sticky action bar mirroring the SEO editor's MobileEditorActionBar pattern)
Root cause (from S16): NewsEditorForm grid lg:grid-cols-[1fr_320px] stacks the Publish/Save aside below the entire form under lg; Save sits ~1519px down at 375w
Invariant protected: desktop layout unchanged (bar absent ≥lg); existing Save submit semantics reused (no forked logic)
Expected files: src/components/admin/NewsEditorForm.tsx (+ small component/test)
Write boundaries: NewsEditorForm + its tests
Acceptance criteria:

- [ ] 375px: Save visible while title/body focused, screenshots
- [ ] Desktop DOM unchanged/bar absent
      Gates: repo + browser screenshots at 375/768/desktop
      Parallelization: W3 (parallel-safe; do not run alongside S5 — same file NewsEditorForm.tsx; sequence S5 → S19 or same worker)
      Exit evidence: screenshots + tests

### S17 - Final proof

Status: PENDING
Type: verification
Behavior: requirement-by-requirement audit of S1–S16 (+ any S16-spawned nodes); full vitest/tsc/build; browser proof for user-visible nodes; verification.md with PASS/FAIL and behavior-preservation confidence
Write boundaries: plans/ux-verified-technical-fixes/verification.md, progress.md (orchestrator)
Parallelization: single-threaded (W5)
