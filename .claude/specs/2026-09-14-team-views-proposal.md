# Slice 5 proposal: team views (setters, closers, webinars, socials, ads)

Status: BUILT 2026-09-14 with Adam's "defaults for the rest". Defaults taken:
Close = Contract Sent or Closed / Won; lane naming untouched on the goals
page, tabs read "Setters (Lane 1)" / "Closers (Lane 2)"; setters not on the
roster show as Unclassified rather than being added; closers are whoever
hosts a first-call calendar (Onboarding Team excluded), no hard roster; 12 IG
posts a week per account; owners left blank; page is read access.
Code: `lib/services/team-report.ts` (pure, tested), `team-report-data.ts`,
`components/admin/TeamPanels.tsx`, `app/admin/team/page.tsx`.

August 2026 as rendered: setters total 321 booked credited + 253 self-booked
= 574 (Close 576 less two internal leads); closers 413 hosted first calls, 249
Close bookings with no Calendly host; Google spend $14,810.81 = spine; three
webinars $30,300 spend (Aug 26-31 spend belongs to the Sep 1 row).

Written 2026-09-14 from live profiling of `close_lead_funnel`,
`calendly_bookings`, `channel_daily`, `metricool_posts`, `webinar_events` and
SteelTrap gold.

## Shape

One page, `/admin/team`, five tabs on a `?tab=` param (same pattern as
`/admin/analytics`), period selector reusing `parseGoalPeriod` / `goalPeriod`
from `goal-report.ts` (Sep, Oct, Nov, Dec, Q4) plus Jul and Aug so the
baseline months are visible. `requireReadAccess()`, so it goes in
`viewer-access.ts` and its test. Nav entry "Team" under Reporting in AdminShell.

Files: `app/admin/team/page.tsx`, one pure reader per tab in
`lib/services/team-*.ts` (aggregation functions unit-tested with vitest, the
DB read thin), `components/admin/TeamPanels.tsx`. Status chips via
`AdminStatusBadge`, marks via `ChannelLogo`, a dash for anything not observed.

## a. Setters (Lane 1)

Basis: `close_lead_funnel` rows whose `first_sales_call_booked_date` falls in
the period. Per setter:

| column | source                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Set    | calls credited to them by `resolveCallCredit`: Close `setter_name` (recorded), Calendly `invitee_scheduled_by` (recorded), setter link tag (tagged), last touch (inferred). Shown as recorded / tagged / inferred. |
| Booked | of those, rows present in `close_lead_funnel` with a booked date in period (a Calendly-only booking never entered Close as a first call is Set but not Booked).                                                    |
| Show   | `first_call_show_up = Yes`                                                                                                                                                                                         |
| Close  | OPEN QUESTION, default: status reached Contract Sent or Closed / Won                                                                                                                                               |
| Won    | `status_label` is Closed / Won                                                                                                                                                                                     |

Join Close row to Calendly booking on lowercase email (Aug to Sep: 1,134 of
1,468 Calendly bookings join). Team line: Reactivation Scrapers +
Sales Reactivation target 330 from `channel-targets.ts`, which the goals page
currently labels "Lane 2".

Cross-check against SteelTrap gold (MAX(updated_at) 2026-09-02T21:29Z, so
September is unusable there):

| month | setter           | mirror booked | gold booked |
| ----- | ---------------- | ------------- | ----------- |
| Jul   | (no setter)      | 514           | 567         |
| Jul   | William Nowak    | 91            | 76          |
| Jul   | Vince Bartolini  | 83            | 69          |
| Jul   | Jacob Hepner     | 56            | 49          |
| Jul   | Pearl Sathekge   | 30            | 20          |
| Jul   | Charlie Ingram   | 21            | 12          |
| Jul   | total            | 798           | 798         |
| Aug   | (no setter)      | 255           | 305         |
| Aug   | William Nowak    | 83            | 75          |
| Aug   | Charlie Ingram   | 58            | 49          |
| Aug   | Vince Bartolini  | 59            | 49          |
| Aug   | August Young     | 27            | 24          |
| Aug   | Pearl Sathekge   | 26            | 23          |
| Aug   | Jacob Hepner     | 25            | 20          |
| Aug   | Connor George    | 15            | 13          |
| Aug   | Jessica Zatkin   | 13            | 11          |
| Aug   | Spencer Reynolds | 6             | 6           |
| Aug   | Cassie Caraballo | 7             | 3           |

Totals agree; every named setter is higher in the mirror because reps filled
the setter field in Close after gold's 09-02 snapshot. Gold is not a usable
per-setter check until it catches up.

Roster gaps: William Nowak, Jacob Hepner, Mariam Olufumi, Jennifer Padilla set
calls in Close but are not in `SETTER_NAMES`. William Nowak also hosted 42
first calls in August.

## b. Closers (Lane 2)

Basis: Calendly bookings on first-call calendars (Consultation Call,
Consultation, Route Advisory, New Strategy, Quick Discovery, Accelerator,
Vending Consult, Route Discovery; Onboarding, Next Steps, Follow-Up,
Rescheduled excluded), host from `event_memberships`, windowed on call start.
Per host: Booked (calls on their calendar), Show / Close / Won from the Close
row joined by email, same definitions as the setters tab. A "no host on
record" row carries Close bookings with no Calendly booking (the other
Calendly organization). "Onboarding Team" excluded.

Hosts of first calls, August: Shreya Bechra 72, Joseph Vaughan 51, Christian
Hartwell 51, William Nowak 42, Robin Perkins 27, Joe Dysert 25, Danny
Santolaya 21, Eric 18, Luke Herman 16, Scott Seymour 9, Pearl Sathekge 5,
Kelly Schrader 4, Ryan Jones 3, jason aaron 3, Ariella 1, Connor George 1,
Dubem Adindu 1.

## c. Webinars

One row per `webinar_events` row in the period: registrations, attendees,
attendance rate vs 25% target, at-offer rate (of attendees) vs 65% target,
booked (`booked_ever`), showed, won, spend, cost per registration, cost per
booked. Spend = `channel_daily` Webinar-channel spend from the day after the
previous webinar through the webinar date. Note: `booked_ever` does not exist
in production yet (migration `20260913140000` unapplied); booked reads as a
dash until it is applied.

## d. Socials

Week rows. Columns: IG posts Mike (brand 6633336), IG posts Anthony
(6633345), Facebook, LinkedIn, X, YouTube uploads, YouTube views
(`youtube_video_daily`). IG cells chip against 12 posts a week. August ran
Mike 104 IG posts, Anthony 22.

## e. Ads

Per campaign from `channel_daily`, channels Google Ads, Meta Ads, Webinar:
spend, impressions, clicks, leads, booked, cost per lead, cost per booked.
Google campaign id keys both spend and lead rows, so joins per campaign. Meta
spend is keyed by platform campaign id and Meta leads by utm slug, so Meta
cost per lead is shown at channel level only; per-campaign Meta lead cells
are a dash. Booked here is the spine's lead-linked booking, not the Close
first-call basis, and the tab says so.
