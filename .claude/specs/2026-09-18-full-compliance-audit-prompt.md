# Full compliance audit — every dashboard number vs its source system

Paste this whole file into a fresh session in `~/vending-website`.

## Mission

Adam is sending /admin/analytics to the CEO. Every number on every tab must
either **tie to its source system** or be **visibly marked as not tracked**,
with the gap named. No silent zeros, no unexplained differences. Work until
the compliance table at the bottom is all PASS or all gaps are named and
accepted by Adam. Do not ask Adam to re-explain anything; everything needed is
here and in `AGENTS.md` Learnings.

## Read first (in this order)

1. `AGENTS.md` → Learnings (last 4 bullets are today's fixes: Close wins,
   show rule, visits repair).
2. `.claude/specs/2026-09-18-trust-the-numbers-handoff.md` (sections 1, 1b, 2-4).
3. `.claude/specs/2026-09-18-one-lead-definition.md`.
4. `git log --oneline -15` — another session shipped fixes today; do not redo.

## Rules (non-negotiable)

- **Verify against the live source, not our tables.** Close via the Close MCP
  (`mcp__claude_ai_Close__*`), GA4 via `scripts/ga4-reconcile.mjs`, GHL via its
  API, Calendly via `calendly_bookings` + API, webinar via `webinar_events` and
  the vp-webinars sheet. Read-only on every external system.
- **Use existing fields only.** Close already has contact-level
  `utm_source/medium/campaign/content/term` and the lead/opp picklist
  `Funnel Name DEAL (Opp)`, `Marketing Source Type`, `First Call Show Up (Opp)`,
  `Qualified (Opp)`, `First Sales Call Booked Date`. **Do not create any Close
  fields.** Adam said so explicitly.
- Run the real services against prod read-only (recipe at the bottom of the
  trust-the-numbers handoff). Paste real numbers, never inferred ones.
- Every fix: test first, suite green, `tsc` clean, `next build` green, then push.
  Batch pushes. If a Vercel build hangs in "Initializing" >5 min, cancel it and
  `vercel redeploy <url> --target production --scope aimanagingservices`.
- Plain-English status to Adam. He is exhausted; short answers, no jargon.

## The audit — do each, record PASS / FIXED / GAP in the table

For each check use **two windows**: August 2026 (complete month) and the
SteelTrap week **Fri 2026-09-11 → Thu 2026-09-17** (Adam's weeks run Fri–Thu).

A. **Leads** — Overview, Funnels, Executive, Channels, Journeys, YouTube, link
coverage, reporting API all equal the `collapseToLeads` count. Spot-check 10
random leads: each exists in Close with the same email.
B. **Visits** — Channels/KPI `channel_daily.visits` and Funnels
`ga4_page_views` each within 2% of GA4's own total (`ga4-reconcile.mjs`).
C. **Booked** — two definitions, both must tie:

- Site funnel: leads with `call_booked_at` = Close `First Sales Call Booked
Date` set, for those leads.
- Close view: every first call booked in the week by `First Sales Call
Booked Date` = SteelTrap's **162** for Sep 11–17, per Funnel Name row
  (Instagram 13, LinkedIn 1, YouTube 9, VSL 1, Website 11, Internal Webinar
  37, Mike Newsletter 1, WWWS 1, Reactivation Scrapers 77, Google Ads 10,
  LTF 1).
  D. **Showed** — `First Call Show Up = yes` only (today's rule), = SteelTrap
  **97**, per row.
  E. **Qualified** — `Qualified (Opp) = yes` = SteelTrap **62**. If the
  dashboard has no rep-qualified number, add it to the Close view (label it
  "Qualified (rep)"), distinct from "Qs done" (online questions).
  F. **Won / revenue** — `close-wins.ts` by `date_won` = SteelTrap **14 /
  $87,134** for the week, per row; and August total = Close exactly.
   Webinar wins must show (webinar_events says 14 wins / $116,276 since June 16;
  reconcile that with Close's Internal Webinar wins and explain any gap).
  G. **Webinar** — for Sep 8 and Sep 15 webinars: registrations, attendees,
  booked, showed, won vs the vp-webinars sheet and GHL. Explain why the sheet
  has booked_night_of 30 > booked_within_7d 26 on Sep 15 (should be
  impossible) and which number Jess's count uses.
  H. **Source attribution** — for Close leads with no site row, source comes
  from the existing contact UTMs or `Funnel Name DEAL`. Report how many
  Sep 11–17 Close first calls have **no source at all** (show them as
  "No source", never drop them). Calendly: 73 of 93 first-call bookings that
  week had no UTM — name which booking links are untagged.
  I. **Spend / CPL** — Metricool ad spend per channel for August vs Google Ads
  and Meta Ads Manager totals (ask Adam for a screenshot only if no API access).
  J. **Internal toggle** — every tab moves when "Include test & internal" is on.
  K. **Confidence panel** (Channels) — every check green or its gap named.
  L. **Show-rate / 0-vs-dash** — every zero on every tab is observed-zero; every
  unobserved value is a dash. Grep the panels for `?? 0` on metric values.

## Deliverables

1. Fixes shipped, with tests.
2. A one-page **"Numbers you can trust"** note for the CEO:
   what each number means, its source system, and the SteelTrap tie-out table.
3. The compliance table below, filled in, pasted to Adam.

| Check                   | Window    | Dashboard | Source                 | Diff | Status |
| ----------------------- | --------- | --------- | ---------------------- | ---- | ------ |
| A Leads                 | Aug       |           | Close / DB             |      |        |
| B Visits                | Aug       |           | GA4                    |      |        |
| C Booked (Close view)   | Sep 11–17 |           | SteelTrap 162          |      |        |
| D Showed                | Sep 11–17 |           | SteelTrap 97           |      |        |
| E Qualified             | Sep 11–17 |           | SteelTrap 62           |      |        |
| F Won / revenue         | Sep 11–17 |           | SteelTrap 14 / $87,134 |      |        |
| F Won / revenue         | Aug       |           | Close                  |      |        |
| G Webinar Sep 15        | event     |           | sheet / GHL            |      |        |
| H No-source first calls | Sep 11–17 |           | Close                  |      |        |
| I Spend                 | Aug       |           | Ads platforms          |      |        |
| J Internal toggle       | any       |           | —                      |      |        |
| K Confidence panel      | 30d       |           | —                      |      |        |
| L Zero vs dash          | all tabs  |           | —                      |      |        |
