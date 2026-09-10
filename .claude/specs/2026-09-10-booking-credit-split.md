# Booking credit split: chatbot entry credit vs setter booking credit

Branch: `feat/booking-credit-split`

## Problem

Gerald Winslow chatted with the site bot on Sep 6, qualified, did not book.
Connor George (setter) called him and booked him on Sep 10. The admin showed
the conversation as "Booked" in the chatbot's green, and the Calendly
email-match path wrote "Booked. Check your email for the calendar invite." into
a transcript that ended four days earlier. The chatbot got booking credit for
a setter's work.

Setters and the chatbot share one round-robin Lane 2 calendar, so the booking
link cannot tell them apart. Close already records both facts per lead:

| Close field                  | Meaning                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `Resource Tag`               | how the lead entered (chatbot, website-application, ...) |
| `Reactivation - Setter Name` | who booked them by call/SMS/VM                           |

## Rule (Adam, 2026-09-10)

Entered through the chatbot: the chatbot gets entry credit. A setter booked
them through calls/text/SMS/VM: the setter gets booking credit. Both are shown,
never merged.

Booking credit precedence (`src/lib/chatbot/booking-credit.ts`):

1. `attribution_source = in_chat` (Calendly echoed the chat calendar's utm) -> "Booked in chat"
2. Setter name in Close -> "Set by <name>"
3. Neither -> "Booked elsewhere" (never the chatbot)

## Changes

- Migration `20260910200000_booking_credit.sql`: `lead_submissions.booked_by_setter`, `entry_resource_tag`.
- `close-booking-reconcile.ts`: mirrors both fields on every 2-minute pass (no new API calls; probes the columns once per run so an unapplied migration never breaks the booking mirror).
- `booking-attribution.ts`: confirmation card only on `in_chat` bookings.
- Conversation detail: "Call booked" chip + credit chip + one-line note; transcript stamp says "set by X, outside the chat".
- `/admin/chatbot` overview: `funnels.*.bookedBy` replaces the unused `bySource` buckets ("assisted" mixed setters with unknowns). Journey card: "All N came in through the chatbot. A booked in the chat, B booked by a setter after chatting (names), C booked elsewhere."

## Not done

- Migration must be applied to prod Supabase by hand before names appear. Until then every surface degrades to "Booked elsewhere".
- Close `Entry Source` reads `Rep-Outbound` for Gerald. Not written back; our surfaces read `Resource Tag`.
- Conversations list outcome chip still says "Booked" for setter-booked rows.
