# YouTube video tracking + Vidalytics cutover

Brief (Adam, 2026-10-14): move every site video from Vidalytics to YouTube so
plays feed YouTube recommendations and Google Ads audiences, and track real
viewing on the site separately from YouTube, without inflating anything.

- Actors: site visitors (play videos), the nightly cron (pulls YouTube), admins (read).
- Invariant: a site view is only ever counted from evidence (YouTube's own
  EMBEDDED playback rows, or our player events with sound on); muted autoplay
  never counts as watching; existing `lead_video_views` readers keep working.
- Previous behaviours kept: `youtube-analytics` connector and
  `youtube_video_daily` unchanged; `VIDEO_VIEWS_TRUSTED_FROM` filter; pre-call
  engagement via `resolveBookingSessions`.
- Unsafe outcomes: autoplay counted as a view; YouTube totals double counted
  with site plays; a failed YouTube call read as "zero views"; connector
  failing every night before its tables exist.
- Out of scope: Google Ads audience setup (Adam, in Google Ads); uploading the
  six Vidalytics-only videos (Adam's team).

| # | Slice | Tier | Depends | Status |
|---|---|---|---|---|
| 1 | `youtube-playback` connector: per video per day per playback location (views, engaged views, minutes), monthly embedding pages; self-backfilling | 2 | - | in_progress |
| 2 | YouTube player with play / 25-100% tracking (sound on only), tap-for-sound, end CTA; swap the 13 videos with YouTube twins; Apply VSL off youtube-nocookie | 2 | - | pending |
| 3 | Admin Videos page: per video and page, site plays (ours) vs YouTube embedded vs on-YouTube, watch time, completion, booked | 3 | 1, 2 | pending |
| 4 | Swap the 6 Vidalytics-only videos once uploaded; remove Vidalytics | 3 | 2, uploads | blocked (uploads) |

## Slice 1 notes

- Report shapes (developers.google.com/youtube/analytics/channel_reports, read 2026-10-14):
  playback location type: dims `insightPlaybackLocationType` (+ `day`), filter `video==X`,
  metrics `views,engagedViews,estimatedMinutesWatched`. Detail: dim
  `insightPlaybackLocationDetail`, filter `insightPlaybackLocationType==EMBEDDED;video==X`,
  `sort=-views`, `maxResults<=25`, no `day`, so it is stored per calendar month.
- One request backfills a video's whole history; `youtube_playback_sync_state`
  remembers how far each video is synced, and a run stops at a time budget and
  resumes next run, so the first nights backfill everything with no manual step.
- Tables ship before they exist in prod (hand-applied, APPLY-IN-SQL-EDITOR §13):
  a missing table is `skipped:`, never a failure.
