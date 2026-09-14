# HANDOFF — Q4 reporting, round three: team views, cross-check, polish

Paste-ready brief for a fresh session. Everything below was verified against
live production, Metricool, GHL, Calendly and SteelTrap on 2026-09-13/14.
Trust it, do not re-derive. Previous brief: `2026-09-13-HANDOFF-q4-slices-2.md`
(repo rules, data-source recipes, cron trigger, GHL form table all still hold).

## Shipped this round (all on main, all deployed)

| commit  | slice | what changed                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 203afd2 | 0     | Channel marks on every channel list; Channels-tab funnel is a strip under the KPIs, table full width; KPI stale banner ignores webhook connectors (`manychat-ingest`). ChannelLogo glyphs for webinar / VSL / funnel rows.                                                                                                                                                                                                       |
| 0a53a43 | 1     | `metricool-ads` connector (inside `metricool-sync.ts`): Google + Meta spend, impressions, reach, clicks per campaign per day on `channel_daily`. Google keyed by platform campaign id under `google`/`cpc` (matches lead rows). Meta campaigns named "webinar" -> channel Webinar, rest Meta Ads. `webinar-ingest` no longer writes spend; 20 sheet-spend rows ($110,711) nulled in prod.                                        |
| 98323da | 2     | `youtube-analytics` connector falls back to Metricool `posts/youtube` (from=to=day) when OAuth is absent. `youtube_video_daily` filled 2026-06-29..; YouTube Seen on the spine = daily views joined to the video's utm_campaign. `metricool-posts` no longer writes YouTube spine rows; 398 lifetime-view stamps nulled.                                                                                                         |
| b8f407f | 3     | `FORM_ROUTES` in `ghl-sync.ts` (by form id). MH -> `mike-ig`, AK -> `anthony-ig` (medium lead-magnet), paid magnet -> `meta_ads`, VSL forms -> new `VSL` channel (`vsl` added to EXACT in `lib/analytics/channel.ts`), waitlist -> Webinar, lead scoring -> website, course access excluded. 429 old `ghl_form` rows nulled, history re-run with `days=155`. GHL forms row is now 0.                                             |
| 78a6709 | 4     | `/api/admin/calendly-backfill/run?from=YYYY-MM-DD&to=YYYY-MM-DD` (cron secret) runs `reconcileChatbotBookings` over an explicit call-start window with a 4000-request cap; `?users=uuid,uuid` names Calendly members. Backfilled rows now carry the webhook payload shape (`payload.created_at`, `payload.invitee_scheduled_by`, `payload.scheduled_event.event_memberships`), which the old sweep rows (1,180 of 2,118) lacked. |

## Verified numbers

Ad spend, spine vs SteelTrap `silver_marketing.ad_performance_daily`
(`marketing_object_type='campaign'`, company `88a28173-...`):

| month | Google spine | Google ST                   | Meta spine (Webinar + Meta Ads) | Meta ST   |
| ----- | ------------ | --------------------------- | ------------------------------- | --------- |
| Jun   | 15,862.46    | 15,862.46                   | 36,937.74                       | 36,937.74 |
| Jul   | 20,470.78    | 20,470.83                   | 42,627.21                       | 42,627.21 |
| Aug   | 14,810.81    | 14,818.82                   | 45,322.36                       | 45,322.36 |
| Sep   | 6,900.73     | 6,371.97 (ST stopped 09-06) | 15,962.40                       | 14,346.74 |

YouTube daily views: Aug 154,872 in `youtube_video_daily` vs 158,049 on the
Metricool channel timeline (Metricool drops low-view videos; 80-98% by day).
Metricool YouTube history starts 2026-06-29 and lags ~4 days.

GHL form leads, last 30 days after routing: Instagram/Mike 585, Meta Ads
magnet 82, VSL 96, Website lead-scoring 38, Anthony 15, Webinar waitlist 10.
Emails overlap `lead_submissions` on ~3%, so no double count with the leads
connector.

SteelTrap first calls booked (gold, settled 08-30): Jun 675 / Jul 798 / Aug 580.

## Gotchas learned

- Metricool `timelines?subject=campaign` is rejected ("valid but not
  supported"). Use `/api/v2/analytics/campaigns/{googleads|facebookads}`; it is
  a range aggregate per campaign, so ask for one day at a time. Field is
  `spent`; Google's `providerId` is the campaign id a link carries.
- The Masterclass webinar Meta campaign is renamed weekly; key by id.
- Only the first Metricool brand (6626386) is read for ads; person brands
  share the ad accounts.
- Calendly `/scheduled_events` filters by call START, not booking time.
  A production 404 page returns HTTP 200 HTML; poll for a JSON body when
  waiting on a deploy.
- rtk `grep -r --include=` breaks under zsh; use `/usr/bin/grep`. Put inline
  python in a file, never `-c` with quotes.
- Admin login wall stops the aside browser agent; visual QA needs Adam logged
  in or a screenshot from him.

## Remaining queue

5. **Team views** (Adam 2026-09-13: setters = Lane 1, closers = Lane 2; he
   wants real names and set / show / close stats per person, pulled from
   SteelTrap). Read `close_lead_funnel` for booked, `call-credit.ts` for who
   set it, hosts from `event_memberships` for who closed. SteelTrap
   `gold.crm_subject_current_by_company` has `reactivation_setter_name`,
   `first_call_show_up`, `status_label`; `silver_marketing` is current, gold
   lags. Also webinars (webinar_events vs registrations), socials (Metricool
   posts + youtube_video_daily views), ads (spend, cost/lead, cost/booked from
   the new spend rows). Propose before building.
6. **SteelTrap cross-check job**: app cannot reach Databricks (token is a local
   CLI profile, owner Dom Ellis). Options: a Databricks PAT in Vercel env, or a
   scheduled local script that posts the diff. Decide with Adam.
7. Owners column on the KPI tab is hand-set in `channel-targets.ts`; fill when
   Adam names owners.
8. Seed the 11 named Calendly users into `buildCalendlyDirectory`
   (`call-credit.ts`) — names are in the slice 4 output below.

## Slice 4 outcome (2026-09-14)

- Named via `?users=`: August Young, Naria Torres, Jessica Zatkin, Cassie
  Caraballo, Spencer Reynolds, Pearl Sathekge, Stephen Olivas (seeded in
  `KNOWN_CALENDLY_USERS`, `call-credit.ts`, commit aefa5dd). Four ids
  (c6637e06, 614b9666, f73c204d, BFBCGPH4HWHKW6U4) answer 403: another
  Calendly organization; they stay as ids.
- Whole-month runs hit the 300s function ceiling (client saw HTTP 000). Runs
  are idempotent, so the fix is half-month windows:
  `from=2026-06-01&to=2026-06-16`, etc. Sep 1 to Oct 15 completed in 222s
  (493 events, 7 new bookings).
- `calendly_bookings` went 2,118 -> 3,496 rows. By booked-at: May 142, Jun
  589, Jul 1,225, Aug 1,016, Sep 523. Re-run the half-months until the
  "old-shape" column in the verify script is 0 for Jul and Aug.
- June against SteelTrap 675 first calls booked: Calendly has 589 bookings
  made in June across ALL calendars, of which roughly 374 are first-call
  calendars (Accelerator 101, Consultation Call 69, Route Advisory 58, Quick
  Discovery 69, Consultation 59, New Strategy 14, Route Discovery 4). The
  rest are Onboarding, Rescheduled, Follow-Up, Next Steps and generic
  meetings. The gap to 675 is calendars in the other Calendly organization
  (the four 403 users) plus first calls set in Close without a Calendly
  event. Calendly cannot be the booked-call basis; `close_lead_funnel` stays
  the basis, Calendly supplies who booked it and who hosts.
- Verify script: scratchpad `calverify.py` logic = REST over
  `calendly_bookings` selecting `raw_payload->payload->>created_at`,
  `->>invitee_scheduled_by`, `->scheduled_event->event_memberships`, and
  `raw_payload->invitee->>uri` as the old-shape marker.
