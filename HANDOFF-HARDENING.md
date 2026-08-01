# Handoff — vending-website hardening, round 2

Written 2026-07-31 at the end of the first autonomous hardening run.
Round 1 is on branch `autonomous-hardening-20260731` (14 commits, unmerged, never pushed).

---

## Decisions Adam made (do not re-ask)

1. **Close contact overwrite** → _Never touch name/phone._ On an email match the sync worker may
   only ADD emails/phones and update qualification fields. It must never rewrite an existing
   contact's `name` or replace its `phones` array.
2. **Rate limiting** → _Postgres counter, no new dependency._ Per-IP + per-email sliding window
   in a small Supabase table. Storing request IPs is approved; use a short retention window and
   say what it is.
3. **Scope** → all four tracks: security, performance, test coverage, and the giant-file
   refactor.

---

## Ground rules

- Work in a **git worktree**, not the main checkout. A concurrent session was writing
  lead-magnet files (`src/lib/content/lead-magnets.ts`,
  `src/components/sections/CodedLeadMagnetPage.tsx`, `src/app/resources/roadmap*`) into
  `/Users/adamwolfe/vending-website` during round 1. Never touch those files.
- **Production is live** at `www.vendingpreneurs.com` and handles real lead PII. Local commits
  only — no push, no deploy, no writes to the remote database.
- Every behavioral fix ships with a regression test, and you must **prove the test fails without
  the fix** (stash the source file, re-run, restore). Round 1 did this for all 13 new tests.
- Run the **full** suite after any cross-cutting change, not a file-scoped one. Round 1's single
  regression came from trusting a file-scoped run.
- `rtk`'s vitest wrapper reports `PASS (0) FAIL (0)` for a suite that **failed to compile**. Use
  `rtk proxy npx vitest run` to see real output. Same for `tsc`.
- A `*/2` cron expression inside a JSDoc block comment closes the comment and breaks the parse.
- Read `AGENTS.md` first. Next.js 16 differs from training data; middleware is `src/proxy.ts`.

## Setup

```bash
git -C /Users/adamwolfe/vending-website worktree add \
  /Users/adamwolfe/vending-website-r2 autonomous-hardening-20260731
ln -s /Users/adamwolfe/vending-website/node_modules /Users/adamwolfe/vending-website-r2/node_modules
cp /Users/adamwolfe/vending-website/.env.local /Users/adamwolfe/vending-website-r2/.env.local
```

Baseline to confirm before starting: **1245 tests passing, 0 type errors, 0 lint errors,
4 lint warnings, build passing, 67.1% statement coverage.**

---

## Work queue, in priority order

### 1. Close contact overwrite (the most serious open finding)

`src/lib/close/sync.ts` — `updateMatchedCloseContact` (~:437-453) and the payload builder
(~:646-659), reached from `syncUnknownCloseLead` (~:351).

Today: an unauthenticated public form submit carrying a known customer's email and an attacker's
phone number causes the cron to `PUT /contact/{id}/` within ~2 minutes, replacing that contact's
`name` and `phones`. Sales then dials the attacker.

Per Adam's decision: drop `name` and `phones` from the email-match update path; additively merge
new emails/phones instead of replacing the arrays. Qualification/custom fields still update.
Tests: an email match must not change an existing contact's name; a new phone is appended, not
substituted; a first-time contact still gets created with full details.

### 2. Rate limiting on the public lead endpoints

Entry points: `src/app/lead-action-handler.ts:16`, `src/app/qualification-intake/actions.ts`
(both stages), `src/app/booking/actions.ts:10`, `src/app/apply/actions.ts:7`.

Postgres sliding window keyed on IP + email. Write the migration but **do not apply it** — DDL
needs the Supabase SQL editor here. State the retention window in the migration comment.

While you are in this file: `qualification-intake/actions.ts:56` and `:67` call
`drainCloseSync()` in an `after()` hook on _every_ submit. That is the amplification factor that
makes a flood expensive, and the 2-minute cron already covers the work. Consider dropping the
inline drain — note that round 1 made the queue safe against concurrent drains, so this is now a
cost decision, not a correctness one.

Also harden `src/app/api/attribution/events/route.ts` — its "first-party" check is CSRF-grade,
not auth-grade (`vp_sid` is set client-side, so an attacker supplies both halves), and it relays
to `MONEY_PAGE_INGEST_URL` using the server's secret. Rate-limit it the same way.

### 3. `next` 16.2.6 → 16.2.11

Published advisories including an App Router proxy bypass. Its own branch, its own verification.
Mitigating factor already confirmed: all 21 admin pages call `requireAdmin`/`requireSuperAdmin`
themselves and RLS is on every table, so a proxy bypass alone exposes no data.

### 4. CSP

Round 1 deliberately shipped every security header **except** CSP —
`src/lib/security-headers.ts` explains why. The site loads Meta Pixel, HubSpot, ClickMagick,
Vidalytics, Wisepops, ManyChat, RightMessage, GA4, plus YouTube and Calendly frames. Do a
`Content-Security-Policy-Report-Only` rollout measured against real traffic; do not guess an
enforcing policy.

### 5. Performance (all confirmed by reading code, none fixed yet)

- `src/lib/services/media-assets.ts:274-304` — `adminBulkDeleteMediaAssets` recomputes the full
  usage index per asset (~6 round trips each, ~125 queries for 20 assets, re-parsing every SEO
  page's content JSON 20 times). Pass the precomputed count in; batch the deletes with `.in()`.
- `src/lib/services/media-assets.ts:242-272` — `adminBulkAddTagsToAssets`, 3 round trips per
  asset. One `.in()` select, one batched update.
- Unbounded `.select()` with no limit: `adminListMediaAssets` (:70-89),
  `adminBuildMediaUsageIndex` (:207-240), `adminListSeoPageRevisions`
  (`seo-pages.ts:706-719` — `page_revisions` is append-only and only `manual_save` rows are ever
  pruned), and `fetchLeads` (`admin-analytics.ts:385-399`, which pulls **two years** of leads
  into Node for the `1y` range to group them in JS).
- `src/lib/close/sync.ts` `getLead` (~:582) is called per event in the drain loop; batch with
  one `.in('id', ids)` before the loop.
- `src/components/admin/MediaLibraryManager.tsx:89,92` — `selectedAssets` and
  `selectedDeletableCount` run an O(n·m) scan in the render body, unmemoized, on every keystroke.

### 6. Test coverage — the highest-risk untested surface left

- `src/app/admin/media/actions.ts` — **6.5% covered, 123 statements** of server-action mutations.
  Server actions are public HTTP endpoints. Cover: an image asset with neither `externalUrl` nor
  storage path fails validation; `bulkCreateMediaAssets` rejects >20 items and reports partial
  success rather than all-or-nothing; `bulkDeleteMediaAssets` with `skipped > 0 && deleted === 0`
  returns an error ("still in use") rather than a false success.
- `src/app/admin/libraries/actions.ts` — 9.1% covered.
- Then the admin editor client components (`AiBuilderAssistant` 7.3%,
  `useSeoPageEditorController` 31.3%, `MediaLibraryManager` 13.3%).

Keep new fakes strict: `close/sync.test.ts` applies updates at await time so conditional updates
can match zero rows, and `qualification-sessions.test.ts` enforces the unique dedupe index. A
lenient fake is exactly how a missing guard passed tests before.

### 7. Giant-file refactor (24 files over the 800-line house limit)

Seams already identified:

- `src/lib/services/seo-pages.test.ts` (2266) → split by lifecycle area: create, publish/rollback
  (the biggest cluster, ~lines 536-1197), redirects, comments-and-previews.
- `src/lib/page-builder/ai-chat.ts` (1833) → `ai-chat-schemas.ts` (zod, :47-467),
  `ai-chat-tool-executor.ts` (:468 + helpers :797-1512), `ai-chat-block-format.ts` (:1581-1831).
- `src/components/admin/seo-page-editor/AiBuilderAssistant.tsx` (1829) → already 5 self-contained
  components in one file: `ChatMessageList`, `DocumentImportPanel`, `SeoAssistantReviewPanel`,
  `AiAssistantPanelEdgeResize`, and the shell.
- `src/lib/services/seo-pages.ts` (1744) → CRUD/lifecycle vs redirect validation
  (:1650-1730) vs media/content resolution (:1360-1615).

Pure churn unless done carefully — no behavior change, suite green after each split.

### 8. Small open decisions

- `adminResolvePageComment` (`seo-pages.ts:1012`) is a complete implementation with zero callers.
  Comments can be created but never resolved. Wire it up or delete it.
- `seo-pages-status-labels.ts` exports `pageStatusLegend`, `readinessLegend`, `dotToneClass`, and
  `StatusLegendEntry`, now referenced only by their own test after round 1 removed the dead
  legend components. Keep or delete.
- **F5, not fixed in round 1**: `insertQualificationSession`
  (`qualification-intake.ts:145`) has no uniqueness guard, so a repeat submit reuses the lead but
  mints a second session with a different token. Both can complete independently and write
  conflicting Close fields. Reusing the lead's open session changes resume semantics for
  in-flight visitors, so it wants a deliberate slice.

### 9. Blocked on Adam, carried over

- `supabase/migrations/20260731120000_lead_submissions_email_index.sql` is **written but not
  applied**. The table indexes `lower(email)` while both callers filter the plain column, so
  Postgres sequentially scans an unbounded table on every form submit and every booking webhook.
  Needs the Supabase SQL editor, a Management API PAT, or the DB password.

---

## Finish by

Updating `AUTONOMOUS_IMPROVEMENT_LOG.md` with a round-2 section in the same shape: before/after
numbers, what was completed, what is blocked and why, and what needs human review. Report
honestly — if something was skipped, say so.
