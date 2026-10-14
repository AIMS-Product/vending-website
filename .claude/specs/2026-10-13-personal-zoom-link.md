# Personal Zoom link at sign-up: email + Google / Outlook / Apple calendar

Status: SPEC, not built. Adam asked 2026-10-13 (no edits on webinar day). Tier 1 (external writes to Zoom and GHL on
every registration, PII) -> `safe-feature-slice`. Build on a branch 10-14, ship before the Oct 20 room opens to sign-ups.

## Problem (verified 2026-10-13)

- "You're in!" (Anthony, `anthony@webinar.vendingpreneurs.co`) fires ~5 s after sign-up; the GHL > Zoom zap writes the
  contact's `Zoom Url` field (`xoutue68ds9zlMLTkabO`, merge `{{contact.zoom_url}}`) at ~6 s. Sampled 25 of today's
  "You're in!" emails: 0 carry a join link (only msgsndr.com tracking). The email tells people to look for Zoom's email.
- The confirmation page's calendar buttons (Google, Outlook, `/masterclass/event.ics`) carry
  `LOCATION: Zoom (link in your confirmation email)` by design (`src/lib/content/masterclass.ts` `MASTERCLASS_ICS_LOCATION`).
- Only Zoom's own confirmation email has the personal link (Gmail auto-adds it, organizer no-reply@zoom.us).

## Goal

Every site registrant gets their own join link (a) in the first email from Anthony, (b) inside the calendar event they
add from the confirmation page or from that email (Google, Outlook, Apple/.ics). No weekly step for anyone.

## Design

### 1. The site registers in Zoom itself (removes the race)

In `registerForMasterclass` (`src/app/masterclass/actions.ts`), after the GHL upsert returns `contactId`:

1. Resolve the current webinar id without a weekly step: Zoom `GET /users/{host}/webinars?type=upcoming`, pick the one
   whose start equals GHL "Webinar Date n Time" (already read by `getMasterclassEvent`, 5-min cache). Cache the id the
   same 5 min. No match, or more than one -> skip steps 2-3 (zap path still works), log `[masterclass] zoom-skip <reason>`.
2. `POST /webinars/{id}/registrants` {email, first_name, last_name} -> `join_url` (zod-parse the response).
   Re-registering the same email returns the same registrant, so the zap running too is harmless.
3. Write onto the GHL contact in the SAME upsert path before the workflow's tag trigger fires:
   `Zoom Url` = join_url, and new field `Calendar Link` = `https://www.vendingpreneurs.com/masterclass/cal/<token>`.
   Order matters: write the fields, then add `site-webinar-registration` (the workflow trigger). Today the tag goes on
   in the first upsert, so this is a reorder inside `registerWebinarContact`; verify in the test.
4. Any Zoom failure: registration still succeeds (never block a sign-up on Zoom); the zap fills `Zoom Url` as today.
   Log with context, no PII. Board alert in vp-webinars via its existing join-link preflight check.

Creds: Zoom S2S on Anthony's account (`ANTHONY_ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET`, same as vp-webinars) as
Vercel Production env on vending-website; scope `webinar:write:registrant:admin` + `webinar:read:list_webinars:admin`.
Fail closed: missing env -> skip to zap path, logged once per instance.

### 2. Personal calendar event

- Token: HMAC-signed {contactId, webinarId, exp = room end + 7 d} with a new `MASTERCLASS_CAL_SECRET` (same pattern
  as `masterclass-session.ts`). Unguessable; carries no PII.
- Route `GET /masterclass/cal/[token]?to=google|outlook|ics`: verify token -> read the contact's `Zoom Url` from GHL
  server-side -> 302 to the Google/Outlook template URL, or serve `text/calendar`. Event: `LOCATION` and `URL` = join
  link, description has the link + passcode note, stable `UID` per webinar+contact so a time change updates instead of
  duplicating. Join link missing (zap not done yet) -> retry read once after 3 s, else generic event (today's behaviour).
- Confirmation page: `calendarLinks` gets a `location`; buttons point at the cal route using the `mc_session` cookie's
  contactId (server-rendered; the cookie path is `/masterclass-confirmed`, so mint the cal token on the page, not the
  route). Add `ph-no-capture` on the buttons so PostHog autocapture never records the href.
- Never put the join link itself in a page URL or query string (PostHog records page URLs).

### 3. "You're in!" email (GHL template edit, Ivan/Jess, after code ships)

Add: "Your personal join link: {{contact.zoom_url}}" and "Add to your calendar: {{contact.calendar_link}}".
Keep the line about Zoom's email as the fallback. No workflow logic change.

### 4. Interim, GHL only (optional, if the build slips past Oct 20)

Before "You're in!": Wait until `Zoom Url` is not empty (timeout 10 min) -> then send, with `{{contact.zoom_url}}`.
Fixes the email, not the calendar.

## Out of scope

GHL-form registrants (fallback pages): keep generic calendar + Zoom's email. AddEvent stays until the cal route is live.

## Tests (one runnable check each)

- Webinar resolver: one match / none / two -> id / skip / skip.
- Zoom registrant response parse (zod) + failure -> registration still redirects to confirmed, zap path untouched.
- Field-before-tag ordering in `registerWebinarContact`.
- Token: valid / expired / tampered; cal route never echoes the join link in a redirect to our own domain.
- `.ics`: LOCATION/URL = join link, stable UID, folding still RFC 5545.

## Done means

Oct 20: one real sign-up on www shows, in order: GHL `Zoom Url` set before the "You're in!" send time; that email
carries the link; Google, Outlook and Apple buttons each create an event whose location is the personal link; Zoom
registrant exists; Close + Sheet zaps unaffected; `lead_cleanup.py` removes the test contact. vp-webinars join-link
preflight stays green.

## Open

- Confirm GHL lets an upsert set the custom fields before a tag-trigger fires within the same request (else: two calls).
- Field name for the new GHL custom field (`Calendar Link`), created by hand once.
- Whether the Zoom > Sheet zap needs the site registration too (today it hangs off the GHL > Zoom zap).
