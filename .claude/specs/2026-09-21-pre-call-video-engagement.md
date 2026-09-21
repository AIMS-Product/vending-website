# Pre-call video engagement

**Branch** `feat/pre-call-video-engagement` · 2026-09-21

## The gap

A prospect books a call and is redirected to `/pre-call-resources`, which holds
fifteen Vidalytics videos. Nothing anywhere recorded whether they pressed play.
Vidalytics' own dashboard has plays and watch time, but per anonymous visitor,
behind a login marketing holds, with no bridge into anything queryable. A rep
could not tell an engaged prospect from a cold one.

The redirect itself carried no identity: `goToPreCallResources()` navigates to a
bare path.

## The join

`vp_sid` — the first-party session id already set on every pageload
(`attribution-client.ts`, 180-day cookie + localStorage) and already stored on
the lead row at `metadata.attribution_session.vp_session_id`.

    video event -> vp_session_id -> lead_submissions -> calendly_bookings -> the rep's prospect

No new identifier, no link parameter, nothing for sales to remember to send.

## What shipped

- **Player API** (`lib/tracking/vidalytics-player.ts`) — Vidalytics' documented
  `getVidalyticsPlayer` init, written as TypeScript rather than a minified
  `<Script>` so it cannot arrive after the player loads. No API key involved;
  the embed id is the whole handshake.
- **Milestones** (`lib/tracking/video-engagement.ts`) — pure; 25/50/75/100,
  progress read from `currentTime()`/`duration()` rather than the undocumented
  event object. 100 comes from `ended`.
- **Listener** (`components/media/VideoEngagement.tsx`) — mounted inside every
  `VidalyticsPlayer`, emits `video_progress` through the existing attribution
  pipeline, so each event carries the session's full UTM + paid-click slice and
  mirrors into PostHog for free.
- **Storage** (`lead_video_views`, `services/lead-video-views.ts`) — one row per
  session per video, furthest point reached. Deliberately does NOT copy
  `recordTaggedPageView`'s UTM-required filter: these visits happen after a
  booking, via redirect, and never carry a campaign.
- **Read** (`services/pre-call-engagement.ts`, `pre-call-briefing.ts`) —
  upcoming calls with what each watched, plus `coldBookings()`.
- **Admin** — "Coming up, and what they have watched" on `/admin/bookings`.
- **Close** (`services/pre-call-note.ts`, hourly cron `/api/admin/pre-call-notes/run`)
  — posts one note per lead ~3h before the call. A note, not a custom field:
  needs nobody with Close admin and no field id in the environment.

## Known ceilings

- **Per browser.** Books on a phone, watches on a laptop = no row. The admin
  column shows that as "No session", kept separate from "Nothing yet", because
  chasing someone who did watch is the one failure that would make reps stop
  trusting the column.
- **Rate limit.** `attribution_event` is 60/min per IP. Fifteen videos watched
  to completion is exactly 60 events. That visitor is maximally engaged and a
  dropped last beacon cannot change what a rep concludes.
- **No note update.** Close has no note-update endpoint, so the note is posted
  once, close to call time, rather than early and corrected.

## Owed by Adam

1. Paste `supabase/migrations/APPLY-IN-SQL-EDITOR.md` (now three migrations:
   thank-you visits, audit history, `lead_video_views`). Until then video events
   are emitted and silently dropped and the admin column stays blank.
2. Merge to `main` when ready — that publishes to www within ~1 minute.

## Not done, deliberately

- `posthog.identify()` on lead submit. It would put a name on every replay and
  make "is THAT person tracked" answerable by eye, but it puts lead emails in
  PostHog — a privacy call, not a code one.
- A Close custom field for engagement. Worth asking Stephen for only if reps
  start filtering smart lists on it.
