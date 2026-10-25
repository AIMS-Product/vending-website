# Spec: "Organic content" admin view (content-funnel Step 5), 2026-10-21

Status: PLAN + slice 1 done (2026-10-21 pm, read-only prod counts below). Not built overnight on purpose: the plan's bar is "numbers verified against a direct query",
and a half-correct analytics page is worse than none (AGENTS.md history: channel_daily double counts, shows derived
wrongly). Source: `reports/content-funnel-2026-10-18/CONTENT-FUNNEL-PLAN.md` section 2 Step 5.

## Question it answers

For organic and AI-referred visitors: which landing pages produce leads, booked calls, shows and wins?
Rows = `first_landing_path`; columns = leads -> booked -> shown -> closed-won (+ revenue); filter = `first_referrer`
host in Google, Bing, chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com; AI referrers split out as
their own group.

## Rules it must follow (AGENTS.md learnings)

- Leads from `lead_submissions` only, which **starts 2026-07-06**; blank (not zero) before that.
- Booked = `keptByMtdRule` (`close-mtd-funnel.ts`), shown = `first_call_show_up` (never `call_disposition`, never
  booked minus no-shows), won/revenue = `close-wins.ts` by `date_won`. **Never** from `channel_daily` (its
  showed/won cover only site-matched bookings).
- Join lead -> Close by the lead's Close id / email as the existing loaders do; reuse, don't re-implement.
- Read with `readAllPages` (`paged-read.ts`), never a 1,000-row loop.
- Every table the loader reads goes into `TAB_FEEDS` in `data-trust-bar.ts` in the same commit (a test reads loaders
  for `.from("table")`). Page opens with `DataTrustBar`.
- New terms ("AI referral", "Organic content") defined in `AnalyticsGlossary.tsx` in the same commit.
- UI per `docs/design/admin-studio.md` + `docs/design/visual-review-checklist.md`; it is a drill-down under
  `/admin/analytics` (METRICS.md section 16), not a new top-level dashboard.

## Slices

1. **Confirm the data path (read-only).** Where `first_landing_path` / `first_referrer` are persisted on
   `lead_submissions` (column vs jsonb; `SESSION_ATTRIBUTION_FIELDS` in `src/lib/close/sync.ts` sends them to Close,
   `attribution-session.ts` builds them). Measure coverage: share of leads since 07-06 with a non-empty
   `first_referrer`. If coverage is low, stop and report; the view would mislead.
2. **Pure classifier + tests.** `classifyOrganicReferrer(host) -> "google" | "bing" | "ai:<name>" | null`, path
   normaliser (strip query, trailing slash, map retired article slugs to their redirect target). Vitest table tests.
3. **Loader.** `organic-content-data.ts`: leads by path x referrer group; join to Close mirror for booked/shown/won
   via the existing helpers. Unit-test with fixtures. Add feeds to `TAB_FEEDS`.
4. **Validate script.** `scripts/organic-content-validate.ts`: for one month, recompute totals with a direct SQL/Close
   query and assert equality (leads exact; booked/shown/won exact vs the Close mirror for the same leads). This is
   the "verified" gate.
5. **Page.** `/admin/analytics/organic`: trust bar, date range, table (path, leads, booked, shown, won, revenue),
   AI group toggle, glossary entries. Screenshots 390/1440, design checklist.

## Risks / open questions for Adam

- Organic lead volume may be tiny (plan: organic footprint is thin), so per-page rows will be single digits; show
  totals first, pages second.
- `first_referrer` is often empty (Safari/ITP, in-app browsers, `noreferrer`). Slice 1 decides if the view is honest.
- AI assistants frequently strip referrers; "AI referral" will undercount. Label it as a floor.

## Slice 1 result (2026-10-21 ~22:00 PT, prod, counts only via PostgREST HEAD + `count=exact`; no rows read)

**Data path:** `lead_submissions.metadata -> 'attribution_session' ->> 'first_referrer'` (and `first_landing_path`),
written by `attributionSessionMetadata` in `src/lib/services/leads.ts`. Not a column. Absent keys are dropped
(`compactObject`), so "missing" = key not present. Paid tags are the `utm_source` / `utm_medium` columns.

| Month (from 07-06) | Leads | With attribution_session | With first_referrer | google.\* | bing.com | chatgpt / perplexity / gemini / copilot |
| ------------------ | ----- | ------------------------ | ------------------- | --------- | -------- | --------------------------------------- |
| Jul (06-31)        | 135   | 124                      | 103 (76%)           | 26        | 2        | 0                                       |
| Aug                | 625   | 575                      | 444 (71%)           | 195       | 4        | 0                                       |
| Sep                | 562   | 551                      | 394 (70%)           | 166       | 6        | 0                                       |
| Oct (to 10-21)     | 375   | 364                      | 273 (73%)           | 132       | 6        | 0                                       |

Organic = search referrer **and** no UTM (`utm_source` and `utm_medium` null), all-time since 07-06 (1,697 leads):

- Google organic **129**, Bing organic **17**. Total 146 (8.6% of leads). All 129 Google organic leads have `first_landing_path`.
- YouTube referrer with no UTM: 5 (YouTube traffic is almost all tagged).
- No referrer and no UTM ("direct/unknown"): 246 (14.5%). Organic is undercounted by some share of these.
- Most `google.*` referrers (390 of 519) carry UTMs, i.e. paid Google; the classifier must exclude them.

**Verdict: usable, with labels.** ~72% referrer coverage is enough for a totals-first view. 146 organic leads over
3.5 months means single-digit counts per landing page, so slice 5 should show totals and the top ~10 paths only.
**AI referral is zero** in every month: ship it as a row that says "0 (floor; assistants often strip referrers)", or drop
it until it is non-zero. Decision for Adam; default is to keep the row.

Next: slice 2 (classifier). Rule from this pass: `organic = host in {google.*, bing.com} && !utm_source && !utm_medium`.
