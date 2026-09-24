# Handoff: stale data sources on /admin/analytics (2026-09-23)

## What Adam saw (Channels tab, last 30 days, signed in)

- Freshness bar: **Out of date**, "Data as of Sep 11, 1:36 PM PT", the oldest of 13 sources.
  - **ManyChat contacts**: last updated 12 days ago. The push has been dead since 09-11.
  - **Social posts (Metricool)**: last updated 4 days ago.
  - **Bitly clicks**: updated 8 hours ago but shown red (it runs and adds nothing).
- Last night's checks: **15 of 17 passed**. Failing:
  - "Calls on the calendar (disagrees)". The fix is PR #42, merged 09-23 about 18:15 UTC, after that night's 12:30 UTC run, so the 09-24 run should pass. Verify it; don't assume.
  - "Every connector ran cleanly (disagrees)". Find which connector.
- Channels tab: 9 of 26 channels report "Seen" and 5 of 26 report "Clicked". Many channels have no platform feed at all.
- Instagram row, Leads cell: a grey bar renders after "46 -28%", which looks like a stuck skeleton or bar. Check it.

## Everything merged 09-23 (all live)

- Data: #48 lint, #42 Calendly counts distinct events, #44 trust bar, #46 Overview (all bookings, dated by booked-at; Bitly id encoding, 404/403 stamping).
- Chatbot: #30, #57 triage, #58 in-chat calendar, #59 value-first (flag `CHATBOT_VALUE_FIRST`, off).
- UI: #43, #45, #47, #49-#56, #60-#69.
- Design spec: `2026-09-23-chatbot-conversion-design.md`. Full queue record: `2026-09-23-merge-queue-handoff.md`.

## Still owed by Adam

- Apply `supabase/migrations/20260922200000_bitly_link_clicks_day_idx.sql` to production. The permission check blocks Claude from writing to prod.
- Run the chatbot learning pass once (/admin/chatbot/insights).
- Watch the cost video and approve the #59 copy before turning on value-first.
- ManyChat: re-enable the External Request action in the ManyChat flow. It's a push from their side; no cron fixes it.
- Metricool: 35 posts link out without standard UTMs.
