# Pre-call video: long-term tracking cleanup (2026-09-23)

## Why

Adam: the Pre-call video tab "keeps resetting daily" and he wasn't sure it
tracks watching over the long term. It doesn't reset: `lead_video_views`
keeps every row (306 since 09-21). The tracking start moved twice (09-21
went live, 09-22 23:45Z muted-autoplay fix), which read as a reset.

Real problems, measured on prod 09-23:

- 18 browsers watched after the fix; 3 could be named. 10 of the other 15 came
  from the webinar /start booking page (utm internal-webinar/sept22_end_cta).
  Those bookers have no site lead row, and the lead row was the only route
  from a booking to a browser.
- The strip led with 1,049 "booked prospects", ~96% of them booked before
  recording existed.
- There was no link from watching to whether the person showed up.

## What shipped (branch feat/pre-call-video-longterm)

1. `calendly_booking_sessions` (invitee_uri -> vp_session_id, first write
   wins). The on-site embed listener sends `booking_linked` with the invitee
   URI from `calendly.event_scheduled` before redirecting; the cookie-checked
   attribution route records it and does not forward it to the money page.
2. `resolveBookingSessions`: lead-row session first (so no existing match
   moves), booking link second. Used by the Pre-call video tab,
   /admin/bookings and the pre-call Close note.
3. Strip: Tracked prospects / Opened a video / Watched nothing / Can't tell
   (sums exactly). The window's booked count and the before-tracking count
   became one footnote.
4. First-call outcome per person (Showed / No-show / Not yet / Not logged /
   Not a first call) and a "Do watchers show up?" panel: counts always, a
   percentage only at 20+ logged first calls per group.

## Verified

- tsc, eslint (changed files), vitest 340 files / 2,939 tests, next build.
- Live read-only run, old vs new: all 45 listed people identical (table not
  yet created, so the link adds nothing); tracked 45 = 3 + 6 + 36.

## Owed by Adam

- Merge the PR.
- Paste section 6 of `supabase/migrations/APPLY-IN-SQL-EDITOR.md`.
- After the next webinar: `calendly_booking_sessions` should gain rows,
  and those bookers should move from "No session" to real rows.

## Not done

- Chat-widget bookings do not send `booking_linked` (ChatWidget is under
  open PRs #57-#59); add it once they merge.
- Bookings through sales-sent Calendly links remain unlinkable; that needs
  a signed token keyed on the Calendly booking or Close contact.
- Won deals vs watching: calls since tracking are weeks from maturing
  (CLOSE_MATURITY_DAYS = 30). Add when there is data.
- Pre-call Close note for webinar bookers: they have no lead row, so no Close
  lead id; could resolve via close_lead_funnel.email -> lead_id.
