# Autonomous Hardening Log

**Started:** 2026-07-31
**Branch:** `autonomous-hardening-20260731` (cut from `main` @ `0097749`)
**Worktree:** `/Users/adamwolfe/vending-website-hardening` (see "Isolation" below)
**Scope:** local commits only. No push, no deploy, no remote DB writes, no dependency installs, no `.env` changes.

### Isolation — why this run moved to a worktree

Minutes after this session started, untracked files appeared in the main checkout that this
session did not create (`src/lib/content/lead-magnets.ts`,
`src/components/sections/CodedLeadMagnetPage.tsx`, `src/app/resources/roadmap*`), with birth
timestamps one minute old. **A concurrent session is actively building a lead-magnet feature in
`/Users/adamwolfe/vending-website`.**

Two hazards followed from that:

1. This run's commits would have swept up their in-progress, uncommitted work.
2. Creating `autonomous-hardening-20260731` moved _their_ checkout onto this branch, so their
   commits would have landed here.

Mitigation applied immediately: the main checkout was returned to `main` (a no-op for files —
both refs pointed at `0097749`, so nothing was touched and their untracked work is intact), and
this run moved to a dedicated git worktree at `/Users/adamwolfe/vending-website-hardening` with
`node_modules` symlinked and `.env.local` copied. Verified in the worktree: 1212 tests pass,
`tsc --noEmit` clean.

**Nothing in this log touches the other session's files.**

---

## Phase 1 — Reconnaissance (baseline)

**Project:** `vending-website` — Vendingpreneurs marketing site (Webflow → Next.js 16 migration),
React 19, Tailwind 4, Supabase, Close CRM sync, Vitest. **LIVE in production** at
`www.vendingpreneurs.com` since 2026-07-27. Handles real customer lead PII.

**Structure:** 558 source files under `src/`, 183 test files.
6 API routes, admin CMS + SEO page builder, public lead-capture/qualification funnel,
Close CRM sync queue drained by a 10-minute cron.

### Baseline measurements

| Check    | Command                     | Result                                                             |
| -------- | --------------------------- | ------------------------------------------------------------------ |
| Tests    | `npx vitest run`            | **1212 passed, 0 failed**                                          |
| Types    | `npx tsc --noEmit`          | **0 errors**                                                       |
| Lint     | `npx eslint .`              | **0 errors, 6 warnings** (all `@typescript-eslint/no-unused-vars`) |
| Coverage | `npx vitest run --coverage` | **66.9% statements** (8182/12235)                                  |
| Git      | working tree                | clean (tracked files)                                              |

Lowest-covered files carrying real logic (statement coverage, files >20 statements):

| Coverage | Statements | File                                                                      |
| -------- | ---------- | ------------------------------------------------------------------------- |
| 6.5%     | 123        | `src/app/admin/media/actions.ts` — **server actions, untested mutations** |
| 7.3%     | 357        | `src/components/admin/seo-page-editor/AiBuilderAssistant.tsx`             |
| 7.9%     | 114        | `src/components/admin/seo-page-editor/useUnsavedExitGuard.ts`             |
| 9.1%     | 22         | `src/app/admin/libraries/actions.ts` — **server actions**                 |
| 11.4%    | 167        | `src/components/admin/MediaPickerProvider.tsx`                            |
| 13.3%    | 256        | `src/components/admin/MediaLibraryManager.tsx`                            |
| 18.0%    | 139        | `src/components/admin/seo-page-editor/SeoReadinessHelpers.ts`             |
| 27.3%    | 55         | `src/lib/services/news.ts`                                                |
| 31.3%    | 492        | `src/components/admin/seo-page-editor/useSeoPageEditorController.ts`      |

The gap is concentrated in admin editor client components and two **server-action files** —
server actions are public HTTP endpoints, so those two are the highest-risk untested surface.

Lint warnings by file:

- `src/app/admin/pages/page.tsx` (2)
- `src/app/admin/pages/actions.test.ts` (1)
- `s17-s20-clickthrough.mjs` (1)
- `s17-smoke.mjs` (1)
- `s4-axe.mjs` (1)

**Implication:** section 2a of the brief ("fix what's broken") is effectively empty — the suite is
green and the type/lint gates pass. All value in this run comes from 2b–2g: missing tests,
security hardening, bug hunting, performance, code quality, and documentation.

### Project conventions found

- `AGENTS.md` / `CLAUDE.md` (symlinked) — Next.js 16 API warnings, production deploy rules,
  admin studio design contracts, release-train rules.
- `.claude/rules/` — `components.md`, `pages.md`.
- `.claude/specs/` — 8 slice specs, most recent `2026-07-29-studio-admin-brand-restyle.md`.
- `DESIGN.md` — admin `--ui-*` token contract.
- `fallow.toml`, `stryker.conf.mjs` — structural analysis + mutation testing already configured.
- No `.claude/commands/`. One skill: `.claude/skills/react-doctor/`.
- Husky pre-push guard blocks stack-branch pushes (irrelevant here — no pushes).

---

## Phase 2 — Improvement backlog

Five investigators ran in parallel over security, the lead/Close pipeline, test-coverage gaps,
code quality, and performance. Every finding below was **re-verified against the source before
any change was made** — one coverage finding turned out to be wrong (see "Rejected findings").

Marked `- [x]` done · `- [ ]` open · `- [~]` BLOCKED.

### 2a. Fix what's broken

Nothing to fix. The suite was green (1212/1212), `tsc --noEmit` clean, ESLint 0 errors. The 6
lint warnings were all unused variables; 2 of them turned out to be genuinely dead components
(see 2f) and 3 live in historical evidence scripts under `plans/agent-runs/`, which `AGENTS.md`
says to preserve.

### 2b. Missing tests

- [x] `src/app/api/webhooks/calendly/route.ts` — the only one of six route handlers with no
      test, and the only unauthenticated endpoint in the app. 9 cases added.
- [x] Regression tests accompanying every fix below (13 new cases), each verified to **fail
      without its fix**.
- [x] `src/lib/close/sync.test.ts` fake taught to apply updates at await time, so a conditional
      update can match zero rows the way PostgREST does.
- [x] `src/lib/services/qualification-sessions.test.ts` fake taught to enforce
      `close_sync_events_dedupe_key_idx`. It previously accepted duplicate enqueues that the
      real database rejects — which is precisely how the missing guard in F4 passed tests.
- [ ] `src/app/admin/media/actions.ts` — 6.5% covered, 123 statements of server-action
      mutations. Highest remaining coverage gap. Not attempted this run.
- [ ] `src/app/admin/libraries/actions.ts` — 9.1% covered, server actions.
- [ ] Admin SEO-editor client components (`AiBuilderAssistant` 7.3%,
      `useSeoPageEditorController` 31.3%, `MediaLibraryManager` 13.3%).

### 2c. Security hardening

- [x] **No security response headers at all** — none in `next.config.ts`, `vercel.json`, or the
      proxy. Two reachable consequences: the qualification session token travels in the URL path
      and leaked via `Referer`; `/admin/settings/users` was framable for a UI-redress attack on
      a signed-in super admin. Added Referrer-Policy, X-Frame-Options, X-Content-Type-Options,
      HSTS, Permissions-Policy. Verified on a production build against `/`, `/admin/login`,
      `/contact`.
- [x] **Auth email origin taken from `x-forwarded-host`** — a POST carrying
      `X-Forwarded-Host: evil.tld` generated a genuine Supabase recovery email pointing at the
      attacker; the one-time code in it exchanges for an admin session. Affected
      `requestPasswordReset`, `inviteUser`, `resendUserSetup`. Now allowlisted against the
      configured site host, the platform-injected `VERCEL_URL`, and localhost outside
      production. Also removed the duplicated copy of the vulnerable helper.
- [x] **Calendly webhook signature replay** — the HMAC check was correct, but the signed
      timestamp was never compared against the clock, so one captured delivery replayed forever
      (e.g. replaying an old `invitee.canceled` to cancel a live booking). Now a 5-minute
      symmetric window.
- [ ] **No rate limiting on any public lead endpoint** — confirmed: the only limiter in the
      codebase is the admin-only in-memory one in the AI chat route. No CAPTCHA, no honeypot,
      no per-IP counter. Each request writes a row, sends a Slack message, sends a Resend
      email, and (via an `after()` hook) triggers a full Close sync sweep. **Not fixed** — every
      real option needs a decision I should not make unattended: adding an Upstash dependency,
      storing request IPs (a privacy/GDPR choice on a live PII pipeline), or changing the
      submit UX. See "Review needed".
- [ ] **Unauthenticated overwrite of an existing Close contact's name and phone** — the sync
      worker resolves an existing contact by email and does a wholesale update including `name`
      and `phones`. Submitting the public form with a known customer's email and an attacker's
      phone number rewrites that contact within ~2 minutes. **Not fixed**: the safe change
      (stop rewriting `name`/`phones` on an email match, or route unverified matches to
      `needs_review`) alters how the sales team's records get maintained day to day. That is a
      product decision, and getting it wrong silently degrades a live CRM.
- [ ] **`next@16.2.6` has published advisories**, including an App Router proxy bypass, fixed in
      `16.2.11`. Not applied — the brief forbids dependency installs, and a framework bump wants
      its own verified deploy. Mitigating factor confirmed by reading the code: all 21 admin
      pages call `requireAdmin`/`requireSuperAdmin` themselves and RLS is on every table, so a
      proxy bypass alone exposes no data.
- [ ] `/api/attribution/events` first-party check is CSRF-grade, not auth-grade — the `vp_sid`
      cookie is set client-side, so an attacker supplies both halves and uses the endpoint as an
      authenticated write proxy into the downstream analytics ingest. Needs the same rate-limit
      decision as above.

**Checked and found sound** (recorded so these read as verified, not skipped): all six route
handlers' auth; every one of ~40 admin server actions calls `requireAdmin`/`requireSuperAdmin`
first; the `ADMIN_DEV_AUTH_BYPASS` flag is hard-gated on `NODE_ENV === "development"`; both
`dangerouslySetInnerHTML` sites are fed only by `rehype-sanitize`d markdown; no string-interpolated
SQL and all PostgREST filters are bound; no secrets in client bundles and `SUPABASE_SERVICE_ROLE_KEY`
is behind `import "server-only"`; session and preview tokens are `randomBytes(32)`, stored hashed;
RLS enabled on all tables; cron routes use constant-time bearer comparison and fail closed.

### 2d. Bug hunting (the lead → Close pipeline)

- [x] **F1 · A rejecting notification fetch failed the whole submit.** `sendResendEmail` and
      `sendSlackWebhook` called `fetch` with no try/catch, unlike the sibling
      `sendMoneyPageLeadEvent`. A DNS blip or socket hang-up escaped `submitLead` before the
      status patch ran: the lead was stored and queued to Close, the visitor was told the form
      failed, and the row sat at `received` — invisible to the `notification_failed` filter, so
      nobody would ever know.
- [x] **F2 · No exclusive claim on the Close sync queue.** The status check read the in-memory
      snapshot, then set `retrying` unconditionally — and `retrying` is itself retryable. With
      three concurrent drain sources (the 2-minute cron plus an `after()` hook on each submit
      stage), two overlapping runs both reached `createLead` and produced **duplicate Close
      records for one person** — the same class of duplicate the dedupe key fixed at enqueue
      time but never at drain time. Now a compare-and-swap on `attempt_count` plus a lease.
- [x] **F3 · Enrichment parked permanently.** Missing `close_lead_id` threw
      `CloseNeedsReviewError`, which is terminal. One transient Close 5xx on the lead-create
      event inverts the drain order and strands that lead's score, band, timeline, and capital
      outside Close forever, with nothing to alert on. Now retryable.
- [x] **F7 · One bad write abandoned the whole batch.** The bookkeeping writes sit outside
      `processCloseSyncEvent`'s own try block; a PostgREST error 500s the cron route and drops
      the remaining events in the batch of 20 with nothing recorded.
- [x] **F4 · Double-click showed a failure on a successful submit.**
      `enqueueQualificationEnrichment` threw on any insert error including `23505`, while every
      other enqueue site tolerates a duplicate.
- [x] **F6 · Re-submit stranded leads at `close_sync_status: "pending"` forever.** The pointer
      update forced `pending` unconditionally, but the enqueue right after is deduped away, so
      nothing ever moves the lead off it — including already-synced leads. `/admin` reported
      permanently-pending leads that were fine.
- [ ] **F5 · One lead can accumulate multiple qualification sessions.** `insertQualificationSession`
      has no uniqueness guard, so a repeat submit reuses the lead but mints a second session with
      a different token; both can complete independently and write conflicting Close fields. Not
      fixed — reusing the lead's open session changes resume semantics for in-flight visitors and
      deserves a deliberate slice.

### 2e. Performance

- [x] **Missing index on `lead_submissions.email`.** The table indexes `lower(email)` but both
      callers filter the plain column, so Postgres sequentially scans an unbounded table on the
      site's primary conversion action and on every inbound booking webhook. Migration written,
      **not applied** (see BLOCKED).
- [ ] N+1 in `adminBulkDeleteMediaAssets` — recomputes the full usage index per asset, ~6 round
      trips each (20 assets ≈ 125 queries, re-parsing every SEO page's content JSON 20 times).
- [ ] N+1 in `adminBulkAddTagsToAssets` — 3 round trips per asset.
- [ ] Unbounded `.select()` on `media_assets`, `page_revisions`, and the analytics lead reads
      (the `1y` range pulls two years of rows into Node to group them in JS).
- [ ] `getLead` called per event in the sync loop instead of one batched `.in('id', ids)`.
- [ ] `selectedAssets` / `selectedDeletableCount` in `MediaLibraryManager` run an O(n·m) scan in
      the render body, unmemoized, on every keystroke.

### 2f. Code quality

- [x] Removed dead `SeoPagesSummary` and `StatusLegend` from the SEO pages screen, plus
      `MetricPanel`, `metricToneClass`, and `LegendGroup`, which only those two used. −184 lines;
      the file drops from 1309 to 1125. Lint warnings 6 → 4.
- [ ] `adminResolvePageComment` (`seo-pages.ts:1012`) is a complete, working implementation with
      zero callers — comments can be created but never resolved from any code path. Deliberately
      **not deleted**: this is a half-shipped feature, so removing it is a product call, not a
      cleanup.
- [ ] 24 non-generated files exceed the 800-line house limit; the worst are
      `seo-pages.test.ts` (2266), `ai-chat.ts` (1833), `AiBuilderAssistant.tsx` (1829). Clear
      extraction seams exist in each. Not attempted — pure churn without a reason to touch them.

**The sweep found nothing to fix in most categories, which is worth recording**: zero `any` /
`@ts-ignore` anywhere in `src/`, zero `console.log`, no mutation of function inputs, no
duplicated business rules, and all 5 empty `catch {}` blocks are documented best-effort
fallbacks rather than silent failures.

### 2g. Documentation

- [x] `README.md` was still the untouched `create-next-app` scaffold — telling readers to edit
      `app/page.tsx` — on a live production app with a CRM pipeline and an admin CMS. Replaced
      with the real stack, setup, env vars, directory map, all six routes with their auth, the
      two-stage funnel, the Close field-scope trap, the test-fake conventions, and deploy and
      rollback rules.

---

## Phase 4 — Final report

### Before / after

| Metric                       | Before              | After                         |
| ---------------------------- | ------------------- | ----------------------------- |
| Tests                        | 1212 passing / 1212 | **1245 passing / 1245** (+33) |
| Test files                   | 184                 | 186                           |
| Type errors (`tsc --noEmit`) | 0                   | **0**                         |
| Lint errors                  | 0                   | **0**                         |
| Lint warnings                | 6                   | **4**                         |
| Statement coverage           | 66.9%               | **67.1%**                     |
| Production build             | passing             | **passing**                   |

Coverage barely moved because the new tests target branches that were already partly executed —
error paths inside covered functions. The value is in _what_ is now pinned, not the percentage:
every one of the 13 regression tests was verified to fail without its fix.

### Completed — 12 changes, one logical change per commit

| Commit    | Change                                                                       |
| --------- | ---------------------------------------------------------------------------- |
| `9a56b14` | fix: a rejecting notification fetch no longer fails a successful submit      |
| `34e8bcd` | fix: exclusive claim + lease on the Close sync queue (duplicate CRM records) |
| `b89262f` | fix: sync batch survives a bad write; enrichment retries instead of parking  |
| `c0ef425` | security: response security headers on every route                           |
| `0f3c885` | security: auth email origins no longer trust request headers                 |
| `8542714` | security: reject replayed Calendly webhook signatures                        |
| `b3f3d37` | fix: duplicate + sync-status guards on two divergent call sites              |
| `e7a68cc` | perf: migration indexing `lead_submissions.email`                            |
| `7b3dfc0` | test: auth email origin allowlist in the action tests                        |
| `b3ff1ed` | test: Calendly webhook route handler (9 cases)                               |
| `ae868f2` | docs: real README                                                            |
| `c30116b` | refactor: drop dead components from the SEO pages screen                     |

### BLOCKED

- [~] **BLOCKED: the `lead_submissions.email` index migration is written but not applied.**
  Applying it means writing to the remote production database, which this run was told not
  to do. It is also DDL, which this project cannot apply through PostgREST with the
  service-role key — it needs the Supabase SQL editor, a Management API PAT, or the database
  password, same as the other pending DDL here.
- [~] **BLOCKED: `next` 16.2.6 → 16.2.11 security bump.** Dependency installs were out of scope,
  and a framework upgrade needs its own verified deploy rather than riding along in a
  hardening batch.

### One thing that went wrong, and how it was caught

The auth-origin fix broke three admin action tests. I had verified it with a file-scoped test
run (`src/lib/supabase/`) rather than the full suite, so I did not see it until the next
scheduled full-suite check two commits later. It was fixed before any further work
(`7b3dfc0`), and the fix strengthened those tests rather than relaxing them: each file gained a
forged-host case asserting the link never carries the attacker's host. The lesson is in the
log because the file-scoped run gave false confidence on a cross-cutting change.

Separately, `rtk`'s vitest wrapper reported `PASS (0) FAIL (0)` for a suite that had failed to
compile — a green-looking result for a broken file. Every test run after that point used
`rtk proxy` to see real output.

### Review needed before merging

1. **The Close contact-overwrite exposure (2c) is the most serious thing found and is not
   fixed.** Anyone can rewrite an existing Close contact's name and phone number by submitting
   the public form with that customer's email. The fix is small; the _decision_ — whether an
   email match may still update a contact's identity fields at all — is yours and Stephen's.
2. **No rate limiting on the public lead endpoints.** The blocker is that every real option
   needs a call I should not make unattended: a new dependency, storing request IPs on a live
   PII pipeline, or a submit-UX change.
3. **The `next` bump** should go out as its own change with its own deploy verification.
4. **The email index migration** needs applying by hand before it does anything.
5. **`adminResolvePageComment`** — decide whether to wire it up or delete it.
6. **`seo-pages-status-labels.ts`** now has three exports referenced only by their own test,
   after the dead legend components were removed. Keep (the legend may return) or delete.

### Isolation note

All work is on `autonomous-hardening-20260731` in the worktree at
`/Users/adamwolfe/vending-website-hardening`, because a **concurrent session was writing a
lead-magnet feature into the main checkout** during this run. Nothing here touches those files.
Nothing was pushed, deployed, or written to any remote database. To review:

```bash
git -C /Users/adamwolfe/vending-website log --oneline main..autonomous-hardening-20260731
git -C /Users/adamwolfe/vending-website diff main..autonomous-hardening-20260731
```

When finished, remove the worktree with
`git -C /Users/adamwolfe/vending-website worktree remove /Users/adamwolfe/vending-website-hardening`.

### Rejected findings

Recorded so they are not re-investigated:

- An investigator reported `src/lib/qualification/scoring.ts` as having zero tests and called it
  "the single highest-value gap in the repo". **False** — `scoring.test.ts` exists with 22 cases,
  including explicit band-boundary coverage at 30/31/45/46/75/76. No tests were added there.
- The same report listed several `src/lib/close/*` functions as untested; `sync.test.ts` and
  `client.test.ts` already cover the main paths. Only the genuinely uncovered concurrency and
  failure paths got new tests.

---

# Round 2 — 2026-08-01

Continued on `autonomous-hardening-20260731` in the same worktree
(`/Users/adamwolfe/vending-website-hardening`), plus one separate branch and worktree for the
framework bump. Nothing pushed, nothing deployed, nothing written to the remote database.

Adam's three decisions from the handoff were taken as given and not re-asked.

## Before / after

| Metric                       | Round 1 end | Round 2 end    |
| ---------------------------- | ----------- | -------------- |
| Tests                        | 1245        | **1305** (+60) |
| Test files                   | 186         | **191** (+5)   |
| Type errors (`tsc --noEmit`) | 0           | **0**          |
| Lint errors                  | 0           | **0**          |
| Lint warnings                | 4           | **4**          |
| Statement coverage           | 67.1%       | **68.4%**      |
| Production build             | passing     | **passing**    |

Coverage moved 1.3 points on the whole repo, but the two files it targeted moved much further:
`admin/media/actions.ts` 6.5% → 73.2%, `admin/libraries/actions.ts` 9.1% → 100%.

## Completed — 6 commits

| Commit    | Change                                                            |
| --------- | ----------------------------------------------------------------- |
| `2bccb46` | security: public submits can no longer rewrite a Close contact    |
| `a3dff83` | security: rate limiting on every unauthenticated lead entry point |
| `9b357ce` | security: report-only CSP + a report collector                    |
| `3f8b83f` | perf: batched media bulk operations, capped the unbounded reads   |
| `1e4cbb3` | test: media + library server actions                              |
| `ed17808` | refactor: split the AI chat schemas out of `ai-chat.ts`           |

Plus, on its own branch `next-16-2-11` (worktree `/Users/adamwolfe/vending-website-next-bump`):

| Commit    | Change                  |
| --------- | ----------------------- |
| `14b34d1` | `next` 16.2.6 → 16.2.11 |

### 1. Close contact hijack (queue item 1) — fixed

Per Adam's decision, `name` is never sent on an update and `emails`/`phones` only ever grow.

Fixing only the email-match path named in the handoff would have left the hole open one step
later: once a match is recorded on our lead row, the _known-lead_ path (`updateKnownCloseLead`)
reaches the same stranger's contact with the same full payload. Both paths now route through one
helper that reads the contact first and sends an additive payload. Contact creation is untouched —
that contact is genuinely ours.

Cost: one `GET /contact/{id}/` before each contact update. Close's search projection does not
return phones, so the read was needed regardless; making both paths use it keeps one rule instead
of two.

Three tests, each verified to fail without the guard: an email match does not change an existing
name and appends the submitted phone after the real one rather than replacing it; a matched
contact that already holds the submitted details produces no write at all; and the pre-existing
"uses existing Close IDs" test now also asserts no rewrite. Creation with full details was already
pinned by an existing test.

### 2. Rate limiting (queue item 2) — fixed, migration NOT applied

Postgres sliding window, no new dependency, per Adam's decision. One row per accepted attempt,
counted over an IP **or** an email hash so rotating either one does not buy a fresh budget.

Covered: the two public lead forms (apply and booking both route through `submitPublicLeadAction`,
so that is one gate, not two), all four qualification actions sharing one window, and
`/api/attribution/events`.

Three things worth knowing:

- **It fails open.** The migration is not applied, so the table does not exist yet. Every database
  error — including "table missing" — allows the request and logs a warning. Until the migration
  is run by hand, behaviour is exactly what it is today. Losing lead capture to a limiter outage
  would cost far more than the flood it prevents.
- **The table stores no readable contact details.** The email is SHA-256'd; only the request IP is
  stored in the clear, which is what Adam approved.
- **Retention is 24 hours**, stated in the migration comment. Nothing older than the longest
  window (10 minutes) can affect a decision; the rest of the day is so an abuse report can be
  investigated the next morning. The prune runs on the Close sync cron rather than adding a second
  schedule for one `DELETE`.

Six wiring tests (one per entry point) were verified to fail without their guards, plus nine unit
tests against a fake that actually evaluates the window bound and the IP-or-email filter — a fake
answering a fixed count would have passed with either missing. That fake caught one real bug in
itself (splitting an IPv4 on every dot).

One genuine bug was found while writing this: `createAdminClient()` throws when Supabase config is
absent, and it was outside the try block — so a misconfigured environment would have 500'd every
submit the limiter was meant to protect. Moved inside.

**The inline `drainCloseSync()` on every submit was left in place.** The handoff called it the
amplification factor and framed it as a cost decision. With the limiter in front of it the
amplification is now bounded, and removing it delays every lead reaching Close by up to two
minutes, which is a sales-responsiveness call rather than a technical one. Flagged below.

### 3. `next` 16.2.6 → 16.2.11 (queue item 3) — done, own branch

Verified in a **separate worktree with its own `node_modules`** — this worktree's `node_modules` is
a symlink into the main checkout, and installing there would have silently changed the Next version
under the concurrent session. 1305 tests pass, tsc clean, eslint 0 errors, production build
succeeds. The lockfile moves `next` and its nine platform binaries and nothing else.

Remaining `npm audit` findings that name `next` are transitive (`postcss`, `sharp`), not the direct
advisories this closes.

### 4. CSP (queue item 4) — report-only rollout shipped

`Content-Security-Policy-Report-Only`, which blocks nothing, built from the actual tag inventory
in `TrackingScripts.tsx` and the embed components. Plus `/api/csp-report` to measure it.

The collector logs only the **first** report of each distinct directive-and-host pair per instance,
stores nothing in the database, and reduces every URL to its origin — a `/qualify/<token>` page URL
must never reach the logs. What is needed to write the enforcing policy is the set of distinct
hosts, not the traffic volume behind them.

Verified against a real production build: the report-only header is present on `/` and `/contact`,
the enforcing header is absent, the collector answers 204 and logs. A test asserts the enforcing
header is not set, so promoting it can only ever be deliberate.

`script-src` still carries `'unsafe-inline'`, so this cannot catch injected inline script. What it
does catch is any host the page contacts that nobody wrote down, which is the unknown. Removing
`'unsafe-inline'` needs nonces on the tag bootstraps and is called out in the policy file.

### 5. Performance (queue item 5) — four of five fixed

- **Bulk delete**, the flagship: it already computed the usage index for the whole selection, then
  re-asked the same question per asset (five reads each, reparsing every SEO page's content JSON
  every time). ~125 queries for 20 assets → the index plus one `DELETE`. The batch is now
  all-or-nothing where the loop was per-asset; for a delete keyed on ids just proved unreferenced,
  an error means something systemic and stopping is right.
- **Bulk tagging**: three round trips per asset (load, reload inside `adminUpdateMediaAsset`,
  write) → one read plus one write each. Still one write per asset because each row's next tag
  array depends on its own current one.
- **Unbounded selects**: media library grid capped at 500, page revision history at 200
  (append-only, only `manual_save` rows are ever pruned), analytics lead read at 50,000 **with a
  warning** — that one is a ceiling against the function dying, not a display cap. The real fix
  there is grouping in Postgres, which needs an RPC and therefore a migration.
- **`adminBuildMediaUsageIndex` was deliberately left uncapped.** It decides which assets are safe
  to delete; a truncated answer would report a still-referenced asset as unused and delete it.
- **`MediaLibraryManager`**: the selection maths ran array scans in the render body on every
  keystroke. Sets behind `useMemo` now.

Three of the new service tests were verified to fail against the old implementations.

**Not done: batching `getLead` in the Close drain loop.** Reading the code closely, this is not
safe as a plain prefetch. When two events for the same lead are in one batch — a create followed by
its qualification enrichment — the first writes `close_lead_id` back to the lead row and the second
depends on re-reading it. A prefetched snapshot would make the enrichment fail and retry. It can be
done with a write-through cache, but that widens the window in which a concurrent drain's write is
missed, on the live CRM path, to save 20 primary-key lookups per two-minute cron. Round 1 spent its
effort closing exactly that class of race; this did not seem worth reopening it. Left as-is
deliberately, not overlooked.

### 6. Test coverage (queue item 6) — both server-action files done

`admin/media/actions.ts` 6.5% → **73.2%**, `admin/libraries/actions.ts` 9.1% → **100%**.

Covers everything the handoff named — an image with neither an external URL nor a storage path,
bulk create refusing more than twenty without creating any, bulk create saving the good items and
counting the failures rather than discarding files already in storage, and the dangerous bulk
delete shape where everything was skipped as in-use and nothing was deleted (an error, not a false
success) — plus the surrounding branches, and a test in each file that every mutation refuses an
unauthenticated caller before reaching the service layer.

The remaining uncovered part of the media file is `createSignedMediaUpload`, which is a thin
wrapper over a Supabase storage call.

**Not attempted:** the admin editor client components (`AiBuilderAssistant` 7.3%,
`useSeoPageEditorController` 31.3%, `MediaLibraryManager` 13.3%).

### 7. Giant-file refactor (queue item 7) — one of four

`ai-chat.ts` 1833 → 1435 lines, with the schema half moved to `ai-chat-schemas.ts` (481). No
behaviour change and no caller changed: `ai-chat.ts` re-exports exactly the public names it did
before, so the ten importing files are untouched. Suite green, tsc clean, production build passes.

**Not attempted:** `seo-pages.test.ts` (2266), `AiBuilderAssistant.tsx` (1829), `seo-pages.ts`
(1744). The seams the handoff mapped still look right; there was no time left to do them with the
care a no-behaviour-change split needs, and a careless one is worse than the long file.

### 8. Small open decisions (queue item 8) — still open, deliberately

`adminResolvePageComment` (zero callers) and the three `seo-pages-status-labels.ts` exports
referenced only by their own test were both left alone. Both are "wire it up or delete it"
questions about half-shipped features, which is a product call. `insertQualificationSession`'s
missing uniqueness guard (F5) was likewise left: reusing a lead's open session changes resume
semantics for in-flight visitors and wants its own slice.

## BLOCKED

- [~] **`supabase/migrations/20260801090000_public_request_hits.sql` is written but not applied.**
  The rate limiter does nothing until it is. Same blocker as round 1's index: this is DDL, which
  this project cannot apply through PostgREST with the service-role key. Needs the Supabase SQL
  editor, a Management API PAT, or the database password.
- [~] **Round 1's `20260731120000_lead_submissions_email_index.sql` is still not applied.** Carried
  over unchanged.

## Needs your review

1. **Apply the two migrations.** Neither does anything until then. The rate limiter is written to
   fail open, so the site behaves exactly as it does today in the meantime — which also means the
   protection is not real yet.
2. **The `next` bump is on its own branch** (`next-16-2-11`) and wants its own deploy verification
   rather than being merged with the rest.
3. **The CSP is report-only.** It needs real traffic before anyone considers enforcing it. Read the
   `csp report-only violation` lines in the Vercel logs; any legitimate host that appears belongs in
   `content-security-policy.ts` before the switch.
4. **The inline Close drain on every submit** is still there. Removing it makes a flood cheaper;
   keeping it means leads reach Close in seconds instead of up to two minutes. Your call.
5. **Rate limits are guesses**: 8 lead submits and 12 qualification actions per 10 minutes per
   IP-or-email, 60 attribution events per minute. Set well above what a real visitor produces, but
   nobody has measured the actual distribution.
6. **Carried over from round 1, still open**: `adminResolvePageComment`,
   `seo-pages-status-labels.ts`, and F5 (`insertQualificationSession`).

## Honest gaps

Three of the four file splits and all three admin editor client components were not attempted.
`getLead` batching was analysed and deliberately declined, with the reason recorded above rather
than being quietly dropped.

## Reviewing this round

```bash
git -C /Users/adamwolfe/vending-website log --oneline e284b43..autonomous-hardening-20260731
git -C /Users/adamwolfe/vending-website diff e284b43..autonomous-hardening-20260731
git -C /Users/adamwolfe/vending-website diff autonomous-hardening-20260731..next-16-2-11
```

When finished, remove both worktrees:

```bash
git -C /Users/adamwolfe/vending-website worktree remove /Users/adamwolfe/vending-website-next-bump
git -C /Users/adamwolfe/vending-website worktree remove /Users/adamwolfe/vending-website-hardening
```
