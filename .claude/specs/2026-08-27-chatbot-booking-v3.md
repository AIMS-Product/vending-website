# Chatbot v3: the bot does the booking (2026-08-27)

Continues `.claude/specs/2026-08-25-HANDOFF-chatbot-close-enrichment.md`.
Audit of all 43 live conversations (Aug 21 to 27): 4 real bookings, verified
in Calendly. Report: https://claude.ai/code/artifact/f3b5d762-5a4d-4bd4-ae76-44f4deed2d16

## What the transcripts showed

- Both Calendly webhook subscriptions that point at us are DISABLED on
  Calendly's side. No booking has reached `calendly_bookings` since the Aug 24
  backfill. The chat never learns anyone booked.
- The Consultation calendar (event type `3acb4582-...-5effe4a1b755`, round
  robin) had ZERO open slots for the next 7 days when checked on Aug 27. Three
  visitors said as much in chat. This is a Calendly availability setting
  (Kody), not code, and the bot must be able to see it and route around it.
- 15 of 43 conversations open with a cost question; 13 got the same sentence;
  11 never replied.
- 7 conversations got a `/book-now` link or "I'll open the calendar, one
  moment" instead of the inline calendar.
- Tone rules are ignored by gpt-4o-mini ("That's awesome!", 3+ exclamation
  marks in 12 chats). Names stored as "Currently Working", "Already".

## Slices

1. **Booking confirmation from the in-page signal.** Widget hears Calendly's
   `calendly.event_scheduled`, POSTs `/api/chatbot/booked` with the invitee
   URI. Server verifies via the Calendly API that the invitee's
   `tracking.utm_content` is THIS conversation, then reuses
   `applyChatbotBookingAttribution` + `recordCalendlyBooking` +
   `stampChatbotBookingOnCloseLead` (same path the webhook takes) and returns
   the confirmation card, which the widget renders immediately.
   Prompt gets a BOOKED section: confirm date, what happens next, stop selling.
2. **Real availability.** New tool `get_available_times` (Calendly
   `event_type_available_times`, 14 days, visitor time zone) so Mia names slots
   that exist. If nothing is open: `flag_for_team` records a callback request
   (phone + preferred window) as a `chatbot_follow_up_tasks` row, marks the
   conversation handed off, and Mia says the team will text.
3. **Prompt rewrite.** Pricing move personalised (question about them first,
   what plans differ on, five phrasings, human second answer). Objection
   handling section (cost, time, experience, pressure/scam, spouse, hearing,
   "just send info", "not interested"). Existing-member path via
   `flag_for_team` + support@vendingpreneurs.com. Tone hardening.
4. **Code guards.** A reply that pastes `/book-now` or announces opening the
   calendar without the tool call gets the calendar opened for it and the
   link rewritten. `flush` frames now carry the sanitised text so the visitor
   sees what is persisted (closes the streaming/persisted mismatch).
   Post-pass strips forbidden openers and caps exclamation marks.
5. **Model.** `chatbot_config.model` gpt-4o-mini -> gpt-4.1 for the chat turn.
6. **Ops.** Recreate the Calendly webhook subscription at
   `https://www.vendingpreneurs.com/api/webhooks/calendly`, store the new
   signing key in Vercel Production, delete the two disabled subscriptions.
   Takes effect on the next production deploy.

7. **Hand-offs reach Close.** Every `flag_for_team` request becomes one note
   (marker-deduped) plus one Close task dated today on the lead, so it shows
   in the owning rep's task list. Runs from the tool and again from the Close
   sync drain after lead creation. Chatbot leads already get Recapture State
   Hot-Inbound from Stephen's Lane 2 reconciler (verified on live leads), so
   they surface in the L2 Setter lists like form fills. Entry Source stays
   blank: adding a "Chatbot" choice to the field was blocked for me; Adam or
   Stephen add it in Close, then `taggingValues()` sends it (one line).

## Invariants (tier 1: webhooks + booking state)

- `/api/chatbot/booked` trusts NOTHING from the browser except the invitee
  URI; the conversation match comes from Calendly's own record of
  `utm_content`. A mismatch is a 404, never a stamp.
- The route is idempotent through `applyChatbotBookingAttribution`'s existing
  same-event guards; a webhook arriving later for the same event is a no-op.
- Never state a price. Unchanged. The pricing rewrite changes framing only.
- `flag_for_team` writes a task and a handoff mark; it never emails a visitor
  and never auto-sends anything.
- Pushed and merged 2026-08-27 on Adam's go-ahead (PR #11).

## Out of scope, flagged

- Calendly availability window (Kody). Until fixed, the bot will report no
  open times honestly and take callback requests. That is the correct
  behaviour and also the reason bookings are near zero this week.
- Non-bookers still create Close leads (open decision from 08-25).
