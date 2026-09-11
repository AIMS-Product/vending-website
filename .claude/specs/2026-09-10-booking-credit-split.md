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

## First touch (follow-up, same day)

Adam: order matters for first and last touch. The first cut assumed every
chat was the person's first touch. Live data said otherwise: 12 of 37
chatbot leads linked to Close already existed in Close before the chat
(webinars, Typeform, a website form, one from Dec 2025).

- Migration `20260910220000_close_lead_created_at.sql` (applied by Adam in
  the SQL editor): `lead_submissions.close_lead_created_at`, mirrored from
  Close `date_created` by the reconciler (added to the existing `getLead`
  `_fields`, no new API call).
- `resolveFirstTouch` (`booking-credit.ts`): chatbot when the chat started
  before Close created the lead, or when the earlier Close record is tagged
  `chatbot` (an earlier chat). Otherwise first touch = that lead's Resource
  Tag and the chat was a middle touch. No Close date yet = "Not checked yet".
- Resource Tag is only set when our sync creates a Close lead, never on update
  (`close/client.ts`), so it is a safe label for the earlier source.
- Conversation page: "First touch: Internal webinar, Aug 28. The chat came
  later, Sep 6. Last touch: Connor George booked the call."
- `/admin/chatbot`: booked calls as a first touch x last touch grid, plus
  setter names and earlier sources.

## Not done

- Both migrations are applied. Values fill in as the reconciler re-checks each lead (every lead at most every 6h).
- Close `Entry Source` reads `Rep-Outbound` for Gerald. Not written back; our surfaces read `Resource Tag`.
- Conversations list outcome chip still says "Booked" for setter-booked rows.

## One view of every booked chat (follow-up, same day)

Adam wanted a single place to see chatbot bookings vs setter bookings, first
touch vs last touch. The Conversations list's Booked filter is that view:

- Each booked row's status chip reads "Booked in chat" (green), "Set by <name>",
  or "Booked elsewhere" in place of a bare "Booked", on every filter.
- Booked view adds a First touch column and five chips that always add up to
  all booked: Chatbot end to end · Chatbot, then setter · Chatbot, booked
  elsewhere · Earlier source, then chat · Not checked yet (`?touch=`).
- Same two rules as the conversation page and the dashboard grid
  (`resolveFirstTouch`, `resolveBookingCredit`); lookups reused from
  `analytics.ts` (`fetchLeadCredit`, `attributionSourceOf`).
- Transcript: the pre-fix "Booked. Check your email..." card is hidden on
  `email_match` bookings (5 transcripts, Gerald's included). Hidden at render,
  stored transcript unchanged.
- Not included: a closer column (needs a Calendly read per row; the transcript has it).

## Polish pass (2026-09-11, `feat/booking-attribution-polish`)

Backfill confirmed: 914 of 935 Close-linked leads carry
`close_lead_created_at`. Gerald Winslow verified end to end — setter "Connor
George", tag "chatbot", Close lead created 2 minutes *after* his chat started,
so chatbot first touch and setter last touch, exactly as the rule intends.

The "Not checked yet" bucket turned out to be a lie: all 8 of its rows had no
`lead_submission_id` at all, so nothing was ever going to check them.
`applyChatbotBookingAttribution` stamps the booking onto the conversation but
never the lead, while `recordCalendlyBooking` links the Calendly row to a lead
by email — so for a visitor who books from the in-chat calendar without giving
the bot their details, the booking and the lead live on different rows with
nothing joining them.

`fetchBookedEventLinks` joins them read-only on `booked_event_uri` ->
`calendly_bookings.scheduled_event_uri` (matched 8 of 8, where `utm_content`
misses every `email_match` booking). 5 of the 8 recover a lead; the other 3
now read "No lead linked", a sixth bucket kept separate from "Not checked yet"
because one is a final answer and the other is a pending one.

Buckets, all-time, before -> after: end to end 5 -> 6, then setter 4 -> 4,
booked elsewhere 3 -> 3, earlier source 10 -> 14, no lead — -> 3, not checked
8 -> 0. Still sums to 30.

The 12-of-37 first-touch finding is now 19 of 39: yesterday's number was taken
mid-backfill, this is the first complete one.

Also: a Closer column on the Booked view (17 of 30, from the same batched
read), and the "Calls booked" / "Booked" captions now name the chatbot's own
share so neither headline reads as sole credit.

Open for Adam — one booked call can count twice. 30 booked conversations
resolve to 28 distinct leads: Ashley Valenzuela and Nora Gollihar each started
a second chat minutes later that did the booking, and `isBooked` counts both
the lead-holding row and the booking-holding row. Predates this work; fixing it
moves the headline number, so it is his call. Full detail in
`2026-09-11-booking-attribution-polish-report.md`.
