# HANDOFF — Q4 reporting, round two: ads, views, forms, backfill, team views

Paste-ready brief for a fresh session. Everything below was verified against
live production, Close, Metricool, GHL and SteelTrap on 2026-09-13. Trust it.

## Where things stand

Live on `main` (deploys to www.vendingpreneurs.com in ~1 min):

- `/admin/goals` — the 800-call plan vs pace vs actual, per channel, month or
  Q4. Targets in `src/lib/services/channel-targets.ts` (edit there; the plan
  applies from `TARGETS_FROM = "2026-09"`). Pace math in `goal-pace.ts`,
  reader in `goal-report.ts`, UI in `components/admin/GoalPanels.tsx`.
- `close_lead_funnel` — mirror of every Close lead with a First Sales Call
  Booked Date: funnel, show-up, status, setter name, disposition, email.
  Hourly at `/api/admin/close-lead-funnel-sync/run` (cron `5 * * * *`),
  service `close-lead-funnel-sync.ts`, connector name `close-lead-funnel` in
  `channel_sync_runs`. 8,214 leads on first run. **This is the booked-call
  basis for every target.** Verified: Jun 674 / Jul 798 / Aug 576 vs SteelTrap
  gold 675 / 798 / 580; the workbook's six-channel subset 603 / 677 / 523
  reproduces exactly.
- `public/admin/brands/*` + `ChannelLogo.tsx` — real vendor marks. Add a
  brand by dropping a file and one line in `BRANDS`.
- Migrations `20260912120000_lead_closed_won_value` and
  `20260913120000_close_lead_funnel` are applied in production.

Spec with the analysis: `.claude/specs/2026-09-13-q4-targets-baseline-gap-and-pace-proposal.md`.

## Repo rules (unchanged)

```
rtk proxy npx tsc --noEmit          # raw output; plain `npx tsc` through rtk can report a false clean
./node_modules/.bin/vitest run      # NOT npx vitest
./node_modules/.bin/next build      # kill any next-server first
./node_modules/.bin/eslint <files> ; ./node_modules/.bin/prettier --write <files>
```

Paste real output. No emojis, no dark theme, plain English, a dash means "not
observed" never zero, never print a rate over 100%, never touch a Calendly URL
(`lib/chatbot/booking.ts`, `lib/content/booking-pages.ts`,
`lib/qualification/thank-you-links.ts`). Stage files explicitly; never commit
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, or
`.claude/specs/2026-09-10-overnight-polish-handoff.md`. Read
`docs/design/admin-studio.md` before admin UI: status is `AdminStatusBadge`
(it now takes an optional `tone`), imagery is `next/image`, any page using
`requireReadAccess()` must be listed in `src/lib/admin/viewer-access.test.ts`
and `viewer-access.ts`. Commits: conventional prefix, lowercase subject, body
explains the judgement, end with
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The rtk shell hook
mangles inline for-loops and pipelines: put scripts in a file and run the file.

Cron trigger from a shell: `CRON_SECRET` in `.env.local` works against
production, `curl -H "Authorization: Bearer $SECRET" https://www.vendingpreneurs.com/api/admin/<name>/run`.

## Data sources verified live

**SteelTrap (Databricks).** `databricks -p steeltrap api post /api/2.0/sql/statements`
with `warehouse_id dbc96814fa92bd91`; helper script pattern in the previous
session was: submit, poll `GET /api/2.0/sql/statements/{id}` until not
PENDING/RUNNING. Modern Amenities is `company_id = 88a28173-2a61-4cbb-92ea-f6b8be4592f3`.
Tables: `steeltrap_staging.gold.crm_subject_current_by_company`
(`current_data_json` has `first_sales_call_booked_date`, `first_call_show_up`,
`lead_funnel`, `reactivation_setter_name`, `status_label`),
`silver_marketing.ad_performance_daily` (Google and Meta spend by campaign by
day), `gold.marketing_platform_daily_metrics`,
`silver_marketing.marketing_touch_source_events` (GHL form submits and page
views since 2026-08-10), `gold.crm_pipeline_transition_fact_by_company`.
**Gotcha: gold projections lagged eleven days (last 2026-09-02) while the
silver ledger was current to the minute.** Always print `MAX(updated_at)`
before trusting a gold number. Dom Ellis is writing a doc of what is in there.

**Metricool.** Header `X-Mc-Auth: $METRICOOL_API_KEY`, `userId=$METRICOOL_USER_ID`.
Brand 6626386 (Vendingpreneurs) has Facebook Ads, Google Ads (adwords) and
YouTube connected; 6633336 is Mike, 6633345 is Anthony (IG + Facebook Ads).
Ads timelines need the undocumented `subject` parameter:
`/api/v2/analytics/timelines?blogId=6626386&userId=…&from=2026-08-01T00:00:00&to=2026-08-31T23:59:59&metric=Cost&network=adwords&subject=account`
returns daily values (Aug 1: 195.32). Valid adwords metrics: Impressions,
Clicks, Conversions, Ctr, Cost, Engagements, AverageCpm, AverageCpc,
AllConversions, AllConversionValue, AverageCost, ConversionValue,
Interactions, Roas. For `network=facebookads` use `metric=spend`
(probe the metric list the same way if it 400s). `subject=campaign` should
give per-campaign rows; verify. YouTube: `…&metric=views&network=youtube`
(daily channel views, Aug 20: 6,460) and `/api/v2/analytics/posts/youtube`
(per video: videoId, title, watchUrl, metrics). The existing
`src/lib/metricool/client.ts` `analyticsUrl()` builds the base params.

**GHL.** `GET https://services.leadconnectorhq.com/forms/?locationId=$GHL_LOCATION_ID`
with `Authorization: Bearer $GHL_API_KEY`, `Version: 2021-07-28`. 19 forms:

| id                                                                                     | name                                             | proposed channel               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------ |
| TsHS6bjzHkHakUa1ULxu                                                                   | General 2026 Webinar Registration Form           | Webinar (internal-webinar)     |
| nnne5vuyx5sLjhqneIFg                                                                   | Webinar Intake Form                              | Webinar                        |
| v9fthwAAZiQgyOVgyN1U                                                                   | 2026 Webinar Newsletter Registration Form        | Webinar, medium newsletter     |
| KPIdh0AMzOxdBvRjuuyA                                                                   | 2026 Webinar Entrepreneur Registration Form      | Webinar                        |
| vig6vobsefRB3DHZZzo8                                                                   | Route Builder - MH - Info Form                   | Instagram lead magnet, Mike    |
| 74fUmvjrsYdkdhUZRwBn                                                                   | 90 Day Checklist - MH - Info Form                | Instagram lead magnet, Mike    |
| BKYECxtf3IVcpVhhZSzc                                                                   | Financial Templates - MH - Info Form             | Instagram lead magnet, Mike    |
| lWsjML1EFRINeZtzs9ZC                                                                   | 90 Day Checklist - AK - Info Form                | Instagram lead magnet, Anthony |
| 5yq7Ako7Fa2OKl9b53Er                                                                   | Financial Templates - AK - Info Form             | Instagram lead magnet, Anthony |
| B45aIM2IgjOh3FD8RYrl                                                                   | PAID: VP Internal Team: 90 Days Lead Magnet Form | Meta Ads lead magnet           |
| uzY5o2A3dIjg6JvkDKPe                                                                   | VSL                                              | VSL                            |
| 7mfqxsL7RDAPJw7GZNoq                                                                   | General VSL                                      | VSL                            |
| LZ4wWLGozv6Gt813E3XM                                                                   | Waitlist Form                                    | Webinar waitlist               |
| 0vrICJhXXOmSC9aGHj3P                                                                   | Lead Scoring -> Book a Call                      | Website                        |
| 7K87uNNVmBmzjuQOtUdh                                                                   | Course Access Form                               | not a lead (exclude)           |
| mOvuOW3y5tn9hNuti3Si, vlkcLPcAF1y87PjiTRP5, t8hsczZdlRVA2xL3N6tI, cJSjH8KTezpMzSBvxmWz | Form 20 / 19 / 16 / 9                            | unknown, ask Adam              |

**Confirm with Adam: MH = Mike Hoffmann, AK = Anthony Kolodziej.**
Submissions: `GET /forms/submissions?locationId=…&startAt=2026-08-01&endAt=2026-08-31&limit=100` pages with `meta.nextPage`; August alone is 4,616 submissions; rows carry `formId, contactId, name, email, createdAt`.

**Close.** Token is Vercel-only; the app's `createCloseClient` now has
`searchLeads(body)` for `/data/search/` (Advanced Filtering). Custom field
ids are resolved by label in `close-lead-funnel-sync.ts`; labels of interest
also include "Reactivation - Setter Name", "Todays Call Disposition (Opp)",
"Qualified (Opp)". `condition: { type: "exists" }` works; a date-range
condition was never needed.

**Calendly.** Token is Vercel-only (`CALENDLY_API_TOKEN`, sensitive). Data
starts 2026-07 (one June row). Webhook matching is exact lowercase email to
the newest `lead_submissions` row (`calendly-bookings.ts findMatchingLeadId`);
`raw_payload->payload->>invitee_scheduled_by` is the rep who booked.

**Kit.** Adam cannot get into Kit right now; no key. Leave the Newsletter row
as "no target, not measured" until one arrives.

## The queue, in order, with the shape of each slice

1. **Ad spend into the spine (Metricool).** New connector `metricool-ads`
   inside `metricool-sync.ts` or its own file; write `channel_daily.spend`
   daily. Webinar Meta spend already arrives via `webinar_events` as channel
   Webinar / source meta_ads, so pull Meta at `subject=campaign` and route
   webinar campaigns to Webinar and the rest to Meta Ads, or the total double
   counts. Google goes to source google / medium cpc. Cross-check the month
   against SteelTrap `ad_performance_daily` (Aug: Google $14,819, Meta
   $45,322) and print both on the KPI tab until they agree.
2. **YouTube views (Metricool).** `youtube_video_daily` is empty and the
   `youtube-analytics` connector is skipped (no OAuth). Fill it from
   `posts/youtube` + the views timeline; keep the connector name so the
   health table stays green. Then the Funnel Improvement Map's "views to
   booked" has a numerator.
3. **GHL form to channel.** The 801 unattributed leads are `source ghl_form`
   rows written by the ghl-forms connector (`ghl-sync.ts`). Add a form-id
   map (table above) that sets source/medium/content at write time; re-run
   for history with the connector's `days` option. Expect the Instagram and
   Webinar lead counts on the KPI tab to jump and "GHL forms" to shrink.
4. **Calendly June backfill.** Admin route guarded by `CRON_SECRET`, e.g.
   `/api/admin/calendly-backfill/run?from=2026-06-01&to=2026-07-01`, using
   `createCalendlyApiClient` to list scheduled events + invitees for the org,
   upsert on `invitee_uri` through the same row builder the webhook uses,
   with `raw_payload` shaped like a webhook payload so `scheduled_by` and the
   hosts directory still read. Match leads exactly as the webhook does.
   Verify June totals against the Databricks first-call count (June 674) and
   say what does not match. Also resolve the 9 unnamed Calendly user ids via
   `GET /users/{uuid}` while the token is in hand.
5. **Team views**, all reading `close_lead_funnel` for booked and
   `call-credit.ts` for who: setters (per setter, recorded / tagged / inferred
   split, Lane 2 330 as the team line), closers (hosts from event_memberships,
   won from Close), webinars (`webinar_events` vs 3,864 registrations,
   25% attendance, 65% at offer), socials (Metricool posts vs 12 IG posts a
   week, content-intent tags do not exist yet), ads (spend, cost per lead,
   cost per booked call). One page each or tabs; propose before building.
6. **Automate the SteelTrap cross-check**: a monthly job that compares
   `close_lead_funnel` by funnel with the gold table and posts the diff on
   the goals page's basis panel.

## Open questions for Adam

- September counts against the 800 plan today. Baseline-only instead?
- Confirm MH / AK owners and the four numbered GHL forms.
- Dom's SteelTrap doc, when it lands.
- Kit key, when he can get in.
