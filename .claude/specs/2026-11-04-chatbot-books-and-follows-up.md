# Chatbot books calls and follows up by email (2026-11-04)

Why: of 334 chats, 61 saw the calendar and did not book, 45 left contact
details and never booked, 155 left with nothing. The bot could only open the
Calendly embed; nobody followed up.

## Slice 1 — the chat books the call itself (BUILT, branch feat/chatbot-books-calls)

- `propose_call_time(start_time)` → only a slot `resolveBookingCalendar` reports
  open; writes a `booking_proposed` message (start_time + event_type_uri).
- `book_call(start_time)` → server refuses unless: that exact slot is the latest
  proposal, a user message came after it, name + email captured, slot > 5 min
  out, chat not already booked. Then Calendly `POST /invitees` (no `location`,
  round robin rejects it) with tracking utm_source=chatbot, utm_medium=site_chat,
  utm_content=<conversation id>, so existing attribution applies unchanged.
- Recording shared with the embed route: `record-booking.ts`
  (`chatbotInviteeEvent` + `recordChatbotBooking`), raw_payload nested under
  `payload` per AGENTS.md.
- Calendly 400/409 → "slot just taken, propose another"; anything else → open
  the calendar. Never claims a booking it did not get.
- Flag: `CHATBOT_DIRECT_BOOKING=on`. Off = identical to today.
- Needs: `CALENDLY_API_TOKEN` with `scheduled_events:write` (confirm Calendly
  plan allows it). Unverified: whether API-created invitees fire the
  `invitee.created` webhook (harmless either way; the tool records directly).

Acceptance (to prove on preview before turning on in prod):

1. Chat "can you book me Friday 2pm" → proposal line shows a real open slot.
2. "yes" → booking card; Calendly invite email arrives; round robin assigns a closer.
3. `chatbot_conversations.call_booked_at` stamped; Close lead gets the booking note.
4. Saying "yes" with no proposal, or a different time, books nothing.

## Slice 2 — Close check + follow-up emails (NEXT)

- Candidates: chats with captured email, no booking, last message > 1h ago.
- Before EVERY send, ask Close: meeting / opportunity / booked status on the
  lead, or any human call / SMS / email in the last 72h → stop for good.
- Sequence +1h / +1d / +3d, each with 2-3 real open slots as one-click links
  (prefilled Calendly URL, utm_content = conversation id). Stop on booking,
  unsubscribe, "not interested", existing member, or after 3.
- Week one: drafts only; a setter approves in /admin/chatbot.
- From/reply-to on `reply.vendingpreneurs.com` (Resend domain verified
  2026-11-04, receiving ON; DNS at GoDaddy: MX reply, TXT
  resend.\_domainkey.reply, CNAME send.reply, CNAME rsend.reply).

## Slice 3 — two-way email agent (AFTER 2)

- Resend `email.received` webhook → match thread to conversation → same model,
  same tools (get_available_times, propose_call_time, book_call) → reply.
- Same Close check before every reply; log each email to the Close lead.

## Not now

- SMS: needs explicit per-lead consent (same open issue as Retell calls).
