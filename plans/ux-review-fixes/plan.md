# Feature Plan: ux-review-fixes

Status: IN_PROGRESS
Last updated: 2026-06-10
Owner: feature-orchestrator

## Working Brief

- Feature: Implement the grilled UX-review fix round — 2 P0s, 7 P1s, 40 P2s from reports/ux-persona-review/UX-REVIEW.md per decisions D1–D19 in decisions.md.
- Primary actors: public visitors (apply/contact/news), admin content editors (studio).
- Core invariant: lead capture keeps working (idempotency_key dedupe preserved; every valid submission produces exactly one lead row); published-content rendering unchanged except intended copy/visual fixes; no publish/outbound side effects triggered by fixes.
- Previous intended behaviors: apply/contact submissions persist via lead-action-handler with idempotency; nav/footer links work; news articles render with share links; admin SEO pages list/editor/wizard flows work; scheduled publishing untouched.
- Intentional behavior changes: apply success → redirect to /thank-you-for-applying; contact success → inline panel; dropdowns gain "Not sure yet"; public "Blog" labels → "News"; SSR stat values real; native validation bubbles replaced with inline errors; tour repositioned; sidebar gains Blog-and-news link; /admin/pages gains Redirects link; /blog/{slug} 301s to /news/{slug}.
- Unsafe outcomes: breaking lead submission (T1); accidental publish of draft content; emailing real people; touching real users in settings; pushing/deploying (forbidden, D13).
- Evidence: reports/ux-persona-review/final-findings.json (P2 checklist), UX-REVIEW.md, verified facts in decisions.md "Verification rules".
- Assumptions: dev server localhost:3000 available for browser gates; Playwright installed.
- Out of scope: K1–K6 (Kody), 93 P3s (P3-BACKLOG.md), push/PR/deploy.

## Risk Classification

- Overall tier: T2 (one T1 node: lead form success/validation).
- Live-data risk: lead_submissions writes during browser-gate testing (clearly-labelled test rows; delete after verification — permitted pattern per D16).
- Migration risk: none (no schema changes).
- External-contract risk: none (no API/webhook changes; redirect is internal).

## Dependency Graph

| Node | Title                                                     | Tier | Depends On | Parallel Group | Shared-State Risk                  | Status  |
| ---- | --------------------------------------------------------- | ---- | ---------- | -------------- | ---------------------------------- | ------- |
| N1   | Admin sidebar Blog/News link                              | T3   | none       | W1-A           | none                               | PENDING |
| N2   | Lead form success states (apply redirect + contact panel) | T1   | none       | W1-B           | lead_submissions test rows         | PENDING |
| N3   | Hero stats SSR real values                                | T3   | none       | W1-C           | none                               | PENDING |
| N4   | Quick Tour reposition                                     | T3   | none       | W1-D           | none                               | PENDING |
| N5   | Form validation + "Not sure yet" options                  | T2   | N2         | W2-A           | lead_submissions test rows         | PENDING |
| N6   | Redirects link + row-menu verify + test-page archive      | T3   | none       | W2-B           | archives one session-created draft | PENDING |
| N7   | Public News naming                                        | T3   | none       | W2-C           | none                               | PENDING |
| N8   | /blog/{slug} 301 → /news/{slug}                           | T2   | none       | W2-D           | none                               | PENDING |
| N9   | Mobile horizontal scroll + article H1 break               | T3   | N7         | W3-A           | none                               | PENDING |
| N10  | News image fallback + CLS dimensions                      | T3   | N7         | W3-B           | none                               | PENDING |
| N11  | Admin P2 sweep (aria, tooltips, contrast)                 | T3   | N1,N4,N6   | W3-C           | none                               | PENDING |
| N12  | Public a11y sweep (focus, skip link, contrast)            | T3   | N9         | W4-A           | globals.css single-writer          | PENDING |
| N13  | P2 remainder triage (reproduce-first)                     | T3   | N9,N10,N11 | W4-B           | none                               | PENDING |
| N14  | Final proof                                               | —    | all        | W5             | none                               | PENDING |

## Nodes

### N1 - Admin sidebar Blog/News link

Status: PENDING | Tier: T3 | Type: behavior
Behavior to test: When an admin views any studio page, then the sidebar "Content" nav contains "Blog and news" linking to /admin/news.
Invariant protected: existing SEO pages / Media library / Settings nav links unchanged.
Expected files: src/components/admin/AdminShell.tsx (+ existing AdminShell test if present).
Write boundaries: src/components/admin/AdminShell.tsx, its test file only.
Acceptance: sidebar shows the item on /admin/pages AND /admin/news marks it active; verified in browser.
RGR: RED = test (or Playwright assert) that sidebar contains link → currently fails; GREEN = add `blogSection` to `contentSections` (defined at ~line 28, omitted at line 36); REFACTOR = none expected.
Gates: repo (tsc + targeted test), browser (screenshot of sidebar).
Exit evidence: screenshot + passing test.

### N2 - Lead form success states

Status: PENDING | Tier: T1 | Type: behavior
Behavior to test: (a) When the apply form submits successfully, then the browser navigates to /thank-you-for-applying. (b) When the contact form submits successfully, then the form is replaced by a prominent success panel echoing the submitted email.
Invariant protected: exactly one lead row per submission (idempotency_key path in src/lib/services/leads.ts untouched); contact submissions still persist.
Intentional change: replaces tiny inline success text (D2/D3).
Expected files: src/components/forms/PublicLeadForm.tsx, src/app/lead-action-handler.ts, src/app/lead-action-state.ts, src/lib/services/leads.test.ts or new component test.
Write boundaries: those files + new test files only. MUST NOT touch validation styling/fields (N5's scope) beyond what success-state requires.
Unsafe outcomes: breaking lead persistence; redirecting contact (must stay on-page); double-submit regression.
Acceptance: apply browser run lands on /thank-you-for-applying with a lead row created; contact browser run shows panel WITHOUT sending (use a draft submission against local route — contact submissions persist to DB and notify; for browser gate use test data clearly labelled, delete row after, and confirm notification path is env-gated in dev).
RGR: RED = failing test that successful apply action result triggers redirect (e.g., handler returns redirect or component navigates on success state); GREEN = minimal redirect + panel; REFACTOR = dedupe shared success logic.
Gates: repo (vitest leads/action tests, tsc), browser (Playwright: fill+submit apply with test+uxfix-{ts}@example.com → assert URL; contact → assert panel), boundary (verify exactly 1 row per submit via test or log; delete created test rows afterwards via the UI if possible, else report row ids for orchestrator cleanup).
Exit evidence: test output, screenshots, created/deleted row ids.

### N3 - Hero stats SSR real values

Status: PENDING | Tier: T3 | Type: behavior
Behavior to test: When the homepage HTML is server-rendered (curl, no JS), then the stat block contains 500+, $3M+, 3,000+ and never 0+.
Invariant protected: count-up animation still plays for JS users (progressive enhancement); stat values still sourced from src/lib/content/home.ts.
Expected files: src/components/sections/AnimatedStatValue.tsx (+ usages, + test).
Write boundaries: AnimatedStatValue.tsx, its test, and (only if required) the section component rendering it.
Acceptance: `curl localhost:3000 | grep` shows real values in rendered DOM text, zero occurrences of `>0+<`; animation verified in browser.
RGR: RED = test/curl assert fails today (SSR DOM contains <span>0+</span> — verified fact); GREEN = initial render = real value (animate from 0 only after hydration+in-view, or animate value→value); REFACTOR = tidy.
Gates: repo (tsc, test), browser (animation still visible on scroll).
Exit evidence: curl grep output before/after + screenshot.

### N4 - Quick Tour reposition

Status: PENDING | Tier: T3 | Type: behavior
Behavior to test: When the builder editor opens with the walkthrough active, then the tour card does not overlap the panel it highlights (step-1 target = left rail).
Invariant protected: tour still dismissible (Skip tour) and advanceable (Next); editor unaffected when tour closed.
Expected files: src/components/admin/seo-page-editor/BuilderEditorWalkthrough.tsx (+ test).
Write boundaries: that file + test only.
RGR: RED = positioning test (card rect vs target rect overlap) or documented manual repro; GREEN = fallback position beside target (verified root cause: fallback `targetRect.top-180` clamps onto the target for full-height rails); REFACTOR = tidy.
Gates: repo (tsc/test), browser (screenshot of step 1 not overlapping; use a NEW page via wizard, do NOT publish; archive created draft after, or hand row id to orchestrator).
Exit evidence: before/after screenshots.

### N5 - Form validation + "Not sure yet"

Status: PENDING | Tier: T2 | Type: behavior | Depends: N2
Behavior to test: (a) When the apply form is submitted empty, then inline per-field errors render adjacent to fields with an aria-live summary, values preserved, no native bubbles. (b) When a user opens Business stage / budget / timeline selects, then a "Not sure yet" option exists and submits successfully.
Invariant protected: server-side zod validation still rejects invalid payloads; "Not sure yet" value accepted end-to-end into lead row.
Expected files: src/components/forms/PublicLeadForm.tsx, lead options/schema source (likely src/lib/... lead constants), src/app/lead-action-handler.ts schema, tests.
Write boundaries: those files + tests. MUST NOT alter success-state behavior from N2.
Gates: repo (vitest, tsc), browser (empty-submit screenshot showing inline errors; submit with "Not sure yet" succeeds → redirect), boundary (lead row contains the new value; delete/report test row).
Exit evidence: screenshots + test output + row id.

### N6 - Redirects link + row-menu verify + test-page archive

Status: PENDING | Tier: T3 | Type: behavior + ops
Behavior to test: When an admin views /admin/pages, then a visible "Redirects" link navigates to /admin/pages/redirects.
Ops subtasks (browser): (1) confirm the pages-list row "⋮" details menu opens for a real click and shows Edit/Duplicate/Archive (closes the review's medium-confidence gap); (2) archive the session-created draft "UX Review Test Page 1781052712783" via that menu with confirmation (permitted: session-created; D16).
Expected files: src/app/admin/pages/page.tsx (link only) + test.
Write boundaries: that file + test. MUST NOT modify PageActionsMenu behavior.
Gates: repo (tsc/test), browser (link works; menu screenshot open; archive confirmation screenshot; archived page leaves active list).
Exit evidence: screenshots incl. open row menu; archived-state proof.

### N7 - Public News naming

Status: PENDING | Tier: T3 | Type: behavior
Behavior to test: When a visitor opens /news, then the page heading reads "NEWS" (not "BLOG"); when they open an article, then the breadcrumb reads "News".
Invariant protected: admin-internal "Blog and news" label unchanged; routes/sitemap unchanged.
Expected files: src/components/sections/NewsHero.tsx (heading, ~line 9), src/components/sections/NewsArticle.tsx (breadcrumb, ~line 41) + tests/snapshots.
Write boundaries: those two files + tests.
Gates: repo, browser (both pages screenshot).
Exit evidence: screenshots + grep showing no public-facing "Blog" label remains (excluding admin).

### N8 - /blog/{slug} 301 → /news/{slug}

Status: PENDING | Tier: T2 | Type: behavior
Behavior to test: When /blog/how-to-choose-the-perfect-location-for-vending-machine is requested, then the response permanently redirects to the matching /news/ article; unknown slugs still 404.
Invariant protected: /news/\* rendering unchanged; no redirect loops.
Expected files: src/app/blog/[slug]/page.tsx (or next.config redirects / middleware — worker picks the idiomatic spot per existing patterns) + test.
Write boundaries: blog route file, next.config.ts redirects section if chosen, test file. Single-writer on next.config.ts (no other node touches it this wave — N10 may touch images config: N10 is W3, sequential; safe).
Gates: repo (test for redirect + 404 case), boundary (curl -I shows 301/308 and Location for live slug; 404 for junk).
Exit evidence: curl output both cases.

### N9 - Mobile horizontal scroll + article H1 break

Status: PENDING | Tier: T3 | Type: behavior | Depends: N7 (NewsArticle overlap)
Behavior to test: When /, /case-studies, and a news article render at 375px, then document.scrollWidth <= clientWidth+4 and the article H1 wraps within the viewport.
Expected files: offending section components (locate via review screenshots home/case-studies/article mobile) + NewsArticle heading styles. Avoid globals.css if possible; if global change required, note it (N12 depends on this node to serialise globals access).
Write boundaries: public section components + NewsArticle styles (+ globals.css if unavoidable).
Gates: repo, browser (Playwright 375px scrollWidth assertions + screenshots for all three pages).
Exit evidence: assertion output + screenshots.

### N10 - News image fallback + CLS dimensions

Status: PENDING | Tier: T3 | Type: behavior | Depends: N7
Behavior to test: When a news card image fails to load, then a designed fallback (not raw alt text/broken glyph) renders; images declare explicit dimensions to avoid layout shift.
Expected files: src/components/sections/NewsList.tsx (+ next.config.ts images only if needed) + test.
Write boundaries: NewsList.tsx, test, next.config.ts images section.
Gates: repo, browser (simulate failure by pointing one card at a bad URL in a test harness or onError trigger; screenshot fallback; CLS re-measure on /news).
Exit evidence: screenshot + CLS numbers.

### N11 - Admin P2 sweep

Status: PENDING | Tier: T3 | Type: behavior | Depends: N1,N4,N6
Scope: all admin-page P2 rows in final-findings.json not covered by N1/N4/N6 — includes aria-prohibited-attr on /admin/news list (.text-slate-300), "Schedule failed" filter tooltip/explanation, admin contrast items. REPRODUCE-FIRST rule: verify each row against the live app; record not-reproduced rows without fixing.
Write boundaries: src/components/admin/** and src/app/admin/** EXCEPT AdminShell.tsx, BuilderEditorWalkthrough.tsx, admin/pages/page.tsx (already owned/landed); tests.
Gates: repo, browser per fixed item, axe re-run on touched pages.
Exit evidence: per-row table (fixed / not-reproduced / deferred) + axe before/after.

### N12 - Public a11y sweep

Status: PENDING | Tier: T3 | Type: behavior | Depends: N9
Scope: visible focus indicators on testimonial video tiles (/ and /case-studies), skip-to-content link, WCAG-AA contrast fixes (stat labels, error page, article meta). REPRODUCE-FIRST for contrast rows.
Expected files: video/testimonial section components, src/components/site/Header.tsx (skip link), stat/section styles, globals.css (single writer this wave).
Gates: repo, browser (tab-walk screenshots showing focus rings; axe color-contrast re-run on / and /case-studies).
Exit evidence: axe before/after counts + focus screenshots.

### N13 - P2 remainder triage

Status: PENDING | Tier: T3 | Type: verification + behavior | Depends: N9,N10,N11
Scope: every P2 row in final-findings.json not claimed by N1–N12. For each: reproduce → fix if real and within a small, declared write boundary → else record not-reproduced/deferred with reason. New large work becomes a proposed node, not scope creep.
Write boundaries: declared per-fix in the report; MUST NOT touch files owned by other active nodes (W4 peers: N12's globals.css/Header/video sections).
Gates: repo + browser per fixed item.
Exit evidence: full P2 disposition table (every row accounted for).

### N14 - Final proof

Status: PENDING | Type: verification | Depends: all
Full vitest + tsc + lint + build; production build re-measure of CLS/console (decisions verification rule); browser proof of the changed journeys (apply redirect, contact panel, news naming, blog redirect, admin nav); write verification.md with behavior-preservation confidence; confirm D17 real-user checkpoint handed to James.
