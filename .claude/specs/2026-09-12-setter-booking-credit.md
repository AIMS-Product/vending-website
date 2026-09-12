# A setter's calendar is never a chatbot booking

Branch: `fix/setter-booking-credit`

## What Connor saw

Connor George (setter) reported a second lead that "booked through the
chatbot": B, mindfulobserveruc@gmail.com. What actually happened:

- B chatted on /booking-t5-socials on Sep 11 (Instagram in-app browser) and did
  not book. The chat captured her as a lead; Close tagged her `chatbot` as the
  entry source, which is correct entry credit.
- On Sep 12 at 10:22 ET the call was booked on **Vendingpreneurs Momentum -
  Next Steps** (host Robin Perkins) — a calendar the chat never links to, from
  anywhere: not the in-chat calendar, not the follow-up email, not the site's
  booking pages.
- Our own admin already read "Booked elsewhere" for her, not a chatbot booking:
  the Sep 10 booking-credit split holds.

What still claimed the chatbot was Close, which is the only surface a setter
looks at. The moment the setter booked, the Calendly webhook matched the
booking to her chat **on email alone**, stamped the conversation as booked and
wrote a note on the Close lead opening with "This lead chatted with the site
chatbot first...". A rep skimming that reads it as the bot taking the booking.

## Root cause

`applyChatbotBookingAttribution`'s email fallback ignored WHICH calendar was
booked. Any booking by a chatted-with email within 30 days became a chatbot
booking. Every email match on record — 6 of 6 — was on a setter's or closer's
own calendar: Momentum - Next Steps (x3), Follow-Up, Onboarding Call, Vending
Discovery Call - Next Steps. The fallback had never once matched a real chat
booking.

## Fix

- `isChatbotCalendarEventType` (`chatbot/booking.ts`): the three Lane 1 event
  types the chat can actually book. Unknown is not a chatbot calendar.
- The email fallback now requires it (`chatbot/booking-attribution.ts`), and
  bails before the lookup. The exact `utm_content` path is untouched: proof of
  the chat's own calendar still wins regardless of event type.
- `eventTypeUri` carried end to end: Calendly webhook parse, the reconcile
  sweep, and the embed's postMessage route. The event NAME is editable display
  text; the event type URI is the stable identity.
- The remaining email-match Close note now opens "NOT a chatbot booking — the
  chatbot did not book this call. Whoever set the call gets the credit; the
  chat below is background for it."

## Backfill (applied to prod 2026-09-12)

All 6 email-match conversations un-stamped (`call_booked_at`,
`booked_event_uri`, `attribution_source` cleared): B, Susanne Bramblett,
Gerald Winslow, mrmoore723, Lawrence (Simply Smart Marts), Govn2001.

Booked chatbot conversations: 24 -> 18, all `in_chat`. The chatbot's booked-call
count now only contains calls booked in the chat.

## Open

- The old-wording Close notes already written on those 6 leads are still in
  Close (B's went in Sep 12 14:22 UTC). Needs a manual delete or a cleanup pass
  with the Close key — not doable from the local env.
- `booked_by_setter` is blank on B: Close's "Reactivation - Setter Name" was
  never filled for that lead, so the strongest we can say is "not the chatbot",
  never "Set by Connor George". Setters filling that field is what makes their
  credit provable. Do NOT infer a setter from Close activity — the same names
  appear as Calendly hosts (closers).
- The chat -> setter assist is no longer visible on the chatbot dashboard (those
  conversations are no longer booked rows). If that view is wanted back, build
  it from lead -> booking, not by stamping the chat as the booker.
