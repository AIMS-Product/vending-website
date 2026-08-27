# Chatbot admin: one-screen Overview (2026-08-27)

Adam: "I don't get any use from it... I have to scroll, lots of white space,
I'm not learning a lot." Wants to see at a glance: how chats are going, what
to improve, what people ask, where they get blocked.

## Shape

- `/admin/chatbot` becomes an Overview (Intercom-style, one laptop screen).
  Settings + lead routing move to `/admin/chatbot/settings`.
- Header: 5 KPIs w/ delta vs prior window (conversations, engaged, captured,
  booked, book rate). 7/30/90 toggle via `?range=`.
- Flow: proportional horizontal bars, conversations -> engaged -> calendar
  shown -> booked, with the two leaks named and linked to
  `/admin/chatbot/conversations?outcome=...`.
- Where people stop: stacked bars of outcome by number of visitor turns
  (1, 2, 3-4, 5-9, 10+). New `dropOff` in analytics.
- What people ask: top opening questions + the cost cohort's own funnel.
- Trend: 30-day SVG area chart, conversations vs booked. `dailyTrend` rows
  gain `booked`.
- Needs you: unanswered questions, follow-ups due, flagged chats; links into
  Insights.
- No chart library (none installed); inline SVG + CSS. Admin `--ui-*` tokens.

## Out of scope

- Insights page stays; the Overview only summarises it.
- SQL-side aggregation (rollup still in-memory, FETCH_CAP 4000).

## Addendum (same day)

- Blue chart treatment (PR #18): smooth gradient area trend with dashed
  prior-30 line + hover tooltip, sparklines in KPI cards, journey bars.
- Booking stamp at the foot of every booked transcript: booked-at, call time,
  and the consultant Calendly assigned. Host comes from
  `raw_payload.scheduled_event.event_memberships[].user_name` (webhook) or the
  same key the embed `/api/chatbot/booked` route now stores. Close-only
  bookings stamp `call_booked_at` without a host. No migration.
- Adam's test chats: deleting prod rows was blocked for me; SQL handed to Adam.
