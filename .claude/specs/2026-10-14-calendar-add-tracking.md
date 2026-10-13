# Calendar-add tracking (who, how many, which calendar) -> cancel AddEvent

Status: SPEC, queued for 2026-10-14 (no edits on webinar day 10-13). Adam: "track who and how many people add that
to their calendar and which calendar they add it to ... otherwise we should cancel [AddEvent]".
Tier 1 (writes to GHL contacts) -> `safe-feature-slice`.

## Verified 2026-10-13

- `/masterclass-confirmed` renders Google / Apple(.ics) / Outlook buttons for anyone (no session needed), dated from
  GHL "Webinar Date n Time". Meta CompleteRegistration is CAPI-only, page visits do not inflate it.
- Buttons already carry `data-track="calendar_added"` + `data-track-detail="google|apple|outlook"`
  (`ConfirmedSections.tsx` ~L138-169) -> `trackClick` -> PostHog `calendar_added {detail}` + GA4 `vp_calendar_add`.
  So HOW MANY and WHICH exist today, anonymous, in PostHog/GA4 only. No `posthog.identify`; board has no PostHog key.
- Missing: WHO, and a number on the board.
- AddEvent is used only by GHL custom value "AddEvent Link" (now https://evt.to/bs3wczt0825l, Oct 13, organizer
  Anthony) in 3 emails: "You're in!", "Before you spend an hour with me...", "Sorry, I have homework for you."

## Design: GHL tags are the single source (board already reads GHL tags)

1. Page button (site) -- BUILT 10-13 (`feat/calendar-add-tracking`): server action `recordCalendarAdd(app)` in
   `src/app/masterclass-confirmed/actions.ts` (POSTs to the page path, so the `mc_session` cookie is sent). Verifies
   the cookie -> contactId (never from the request), zod enum google|apple|outlook, rate limit
   `masterclass_calendar` 10/10 min per contact (fail closed), adds GHL tag `<eventTag>-calendar-<app>`, e.g.
   `webinar-oct20-calendar-google` (`calendarTag`, `tagCalendarAdd` in `lib/ghl/webinar-registration.ts`).
   Client: `CalendarAddRecorder` (mounted only with a session) listens for `data-track="calendar_added"` clicks.
   Every miss returns `{recorded:false}` + logs without PII; the link always opens.
   Known gaps: session cookie lives 2 h and is expired by an intake save, so a click after the intake form or from
   another device is a PostHog count only (step 2 covers email returners).
2. Email link (GHL, Ivan): "Add to your calendar" -> GHL Trigger Link to
   `https://www.vendingpreneurs.com/masterclass-confirmed?utm_source=email&utm_content=add-to-calendar`, action adds
   tag `<eventTag>-calendar-email` (Ivan re-points the trigger link's tag weekly, or uses a static
   `calendar-email` tag and the board intersects it with the week's registrants). Covers people who come back from the email on another device (no session cookie).
   One edit: point the "AddEvent Link" custom value / the 3 email links at the trigger link.
3. Board (vp-webinars): week card "Added to calendar": count of this week's tagged registrants per tag
   (google / apple / outlook / email-link) over registrants, same GHL query path as the existing tag counts.
   Drill = list of Close-linked people (ids only in committed data; names render live).

## Then cancel AddEvent (vp-webinars cleanup)

Remove step `addevent` (run-steps.ts), "AddEvent link" from `custom-values` title, `addEvent`/`addEventDash` in
links.ts (+ LINK_GROUPS), handoff-content.ts lines 57-58 and the AddEvent row, automation README row 2 -> done,
`MANUAL` in ghl_custom_values.py, automation-map.ts entry. Update the Google Doc handoff to match.
Adam cancels the $99/mo plan after one real email click lands on the page.

## Tests

- Route: valid cookie + `to` -> tag call with right tag; no/invalid cookie -> 204, no GHL call; bad `to` -> 400.
- Button still navigates when the beacon fails.
- Board count: tag counts per webinar week, zero-safe.

## Done means

Oct 20 cohort: board shows N added / registrants split by calendar; GHL contact shows the tag; AddEvent gone from
board, handoff page and Google Doc; plan cancelled.
