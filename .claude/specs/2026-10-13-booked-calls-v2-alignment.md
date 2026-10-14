# Booked calls V2: align vending-website with Dom's `booked_calls.v2.2`

Source: Dom's memo "Booked-call reporting V2: shared rules and October MTD results" (2026-10-13, rule version
`booked_calls.v2.2`, config SHA `6949a5ee…581a`). Supersedes the "waiting on Dom" list in
`2026-10-13-booked-calls-alignment.md`: Dom has now answered meeting-level counting, title list, 60-day repeat,
booking date vs call date, and TLG/PPA. Title regexes: `AIMS-Product/close-first-sales-meeting/update_field.py`
(`SCRAPER_TITLE_MAP`, `CLOSER_PATTERNS`, `EXCLUDED_OWNERS`, `SETTER_OWNERS`). Dom's package
(`shared/booked_call_rules/`) is local to him, not on GitHub.

## Audit: where we disagree with V2

| #   | Topic                      | Us today                                                                                                               | V2.2                                                                                                                                                                                                                                                                                             | Surfaces                                                                                |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| F1  | Unit + date                | One row per lead, first call ever, dated by "First Sales Call Booked Date" (the call's scheduled day)                  | One credit per qualifying Close meeting activity, dated by meeting `date_created` (Pacific)                                                                                                                                                                                                      | Every booked figure (`close_lead_funnel` readers, 30+ files)                            |
| F2  | Repeats                    | Never; a lead counts once                                                                                              | Credit again when the scheduled day is >= 60 Pacific calendar days after the immediately preceding scheduled meeting (any meeting, credited or not)                                                                                                                                              | Same                                                                                    |
| F3  | Booked By                  | Lead-level Close "Booked By" field (#158)                                                                              | Per meeting, from the title map: Pearl's "Next Steps Session" = Social DMs, 24 others = Lane 2, else Marketing. Lead field never overrides                                                                                                                                                       | Scorecard `bookedByLane2`, vp-webinars `is_lane2`                                       |
| F4  | Lane 2 / reactivation band | Funnel in {Reactivation Scrapers, Sales Reactivation} (`isReactivation`, `GOAL_CHANNELS["lane-2"]`)                    | Funnel is origin only. `Reactivation Scrapers` is a retired origin (resolve from contact UTMs, then Resource Tag, else Unknown); `Sales Reactivation` never establishes Lane 2                                                                                                                   | Marketing-only switch (#167), KPI split, flow card band, goals Lane 2 row, channel rows |
| F5  | Marketing credit           | Every FSCBD lead not in the reactivation funnels                                                                       | Approved first-call title (12 families) AND a supported origin; otherwise Unknown/review, not counted                                                                                                                                                                                            | All marketing totals                                                                    |
| F6  | Exclusions                 | Current lead status Canceled (by Lead) / Outside the US, LTF Quiz funnel, TLG/PPA brands, (company view) Lane 1 roster | Meeting status/outcome canceled, declined, rescheduled; canceled-title prefix; follow-up/reschedule/enrollment/Q&A titles; excluded callers (Stephen Olivas, Ahmad Bukhari); setter-only callers (Kristin Nelson, Spencer Reynolds). TLG counts (6 in Oct). No brand, Quiz or Outside-US rule    | `isExcludedCall`, company MTD view                                                      |
| F7  | Rosters                    | `LANE2_ROSTER` 13 names; Spencer = scraper; Pearl = Lane 2                                                             | 25 title setters (adds Tony Parton, Ashley Atencio, Ibraheem Khan, Monde, Finley Eastlake, Kaylane Nunes, Josh Stoffel, Catalina, Connor Mason, Jonathan Quinn, Owen Hart, Brad Savage, Rob Maxfield, Igor Trojanowski); Spencer's meetings earn nothing unless title-mapped; Pearl = Social DMs | Team page, call credit                                                                  |
| F8  | Rep credit                 | Calendly scheduled_by > UTM > … > Close setter field                                                                   | Mapped setter from title; caller = meeting `user_id`; current-setter disagreement shown, not reassigned                                                                                                                                                                                          | Team page, /admin/bookings                                                              |
| F9  | Review state               | None; every row counts or is excluded                                                                                  | Held: source unavailable, unlinked reschedule, ambiguous simultaneous calls. Never counted                                                                                                                                                                                                       | New                                                                                     |
| F10 | Data                       | Close client has no org-wide meeting listing; mirror holds only leads with FSCBD                                       | Needs full retained meeting history per candidate lead + lead/contact origin fields                                                                                                                                                                                                              | Ingestion                                                                               |

Already aligned (keep): No Show still counts; Pacific days (#163); Funnel Name = origin (#162).
Out of repo: vp-webinars `is_lane2` reads the lead Booked By field (F3); fix there after V2 lands here.

## Plan (side by side, not a cutover: Dom's own next step is "MTD V2 view alongside the current view")

1. **Meetings mirror.** Migration `close_meetings` (id PK, lead_id, user_id, user_name, title, status, outcome,
   starts_at, date_created, date_updated, raw jsonb, synced_at; RLS on, service role only) and
   `close_meeting_leads` (lead_id PK, funnel, contact UTMs jsonb, resource tags, setter name/user, business line).
   `listMeetings` in `src/lib/close/client.ts`: whole-second `date_*` fences (Dom's fractional-cutoff bug),
   split-and-reread on capped pages. Hourly incremental by `date_updated`, nightly full crawl + prune.
   Separate table on purpose: `close_lead_funnel` is "leads that booked a first call" and readers rely on that.
2. **Rules + engine.** `src/lib/booked-calls-v2/{rules,engine,sources}.ts`, pure. Rules are data carrying
   `version: "booked_calls.v2.2"`; when Dom shares `rules.json`, vendor it verbatim and pin its SHA. Engine: full
   history per lead before the period filter; sort by `starts_at`, then id; one disposition + primary reason per
   candidate; historical exceptions only when `date_created < 2026-10-14T07:00:00Z`.
3. **Tests** (Dom's list): 25 title/setter pairs incl. Charlie vs Vince hyphen, cutoff boundary, source precedence,
   retired Reactivation Scrapers, unknown origin, cancel / No Show, day 59 vs 60, DST, internal/unapproved reference
   meetings, cross-month create/schedule, verified replacement, unlinked reschedule held, duplicate collapse,
   conflicting copies held.
4. **Prove it against Dom's certified pull.** Window `2026-10-01T07:00:00Z` to fence `2026-10-13T21:54:08Z`.
   Target: 524 candidates, 206 counted (Marketing 84, Lane 2 119, Social DMs 3), 280 excluded (104/56/64/48/8),
   38 held (13/21/4), 12 historical-exception credits. Every difference gets a named reason (Close edits since
   his read, or our bug). No V2 number goes on screen before this passes.
5. **V2 panel** on the Months page beside Company MTD: counted by Booked By, origin x bucket, exclusion reasons,
   held queue, unknown origin/offer counts, rule version + snapshot time. Legacy panels get a "legacy (first call
   booked date)" label. Nightly audit row: V2 subtotals sum to total; candidates = counted + excluded + held.
6. **Rosters + docs.** `LANE2_ROSTER` gains the 14 title setters, Spencer moves to setter-only, Pearl to Social
   DMs. METRICS.md, glossary, one AGENTS.md line.
7. **Switch (later, gated on Adam + Dom).** After the two-week side-by-side: re-point marketing-only, KPI split,
   flow band, goals Lane 2 row and scorecard to V2 buckets; note the switch date on the page.

## Needs from Adam

- Apply the step-1 migration in the Supabase SQL editor before merge.
- `CLOSE_API_KEY` is empty in `.env.local`; step 4 runs locally only with the key (or via a prod-only route).
- Optional: ask Dom for `rules.json` + engine tests + the redacted decisions file; turns step 4 into a row-level diff.

## Status 2026-10-14 (branch `feat/booked-calls-v2`)

- Done: steps 1, 2, 3, 5, 6 (roster: 13 title setters added as off-roster bookers, roles not guessed; Spencer and
  Pearl roles left as Adam's sheet has them, V2 handles their credit). Validation script for step 4 written.
- Not done: step 4 run (no `CLOSE_API_KEY` locally), migration not applied, step 7 (switch) gated on sign-off.
- Unverified against live Close: `/activity/meeting/` `date_created__gte/lt` filters, `/outcome/` list, the
  `or`-of-`id` lead search, contact `utm_source`/`utm_medium` labels. The validation script exercises all four.

## Validation 2026-10-14 (step 4) — live Close, read-only, ~490 GETs

Window/fence identical to Dom's. Candidates 524 = 524 and candidate leads 399 = 399 (exact). Counted 205 vs 206:
Marketing 85/84, Lane 2 117/119, Social DMs 3/3; unknown origin 45/46. Marketing via Funnel Name = 84 exactly.
Fixes the run forced: (1) Calendly's boilerplate "Reschedule: <link>" is in every note; the signal is
"Rescheduled from connected calendar" (215 held -> 20); (2) reschedule hold before the 60-day check (Dom's
order: repeat 55 -> 49, reschedule 14 -> 20); (3) snapshot fence also bounds history; (4) Resource Tag only
with no UTMs and only `internal-webinar`; UTM map gains ghl+pearl, anthony-li, instagram*, ltf, web.
Residual 1-2 per bucket; canceled 110 vs 104 shows Close edits since Dom's read. Row-level diff needs Dom's
redacted decisions file.
