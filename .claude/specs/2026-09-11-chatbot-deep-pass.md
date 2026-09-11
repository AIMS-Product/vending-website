# Chatbot deep pass: 138 chats, Aug 21 - Sep 11

Trigger: Kody, Sep 11. Visitor (conversation 68ead512) was told every date she
picked was unavailable while the live calendar showed them open.

Method: every conversation since Aug 21 dumped read-only from
`chatbot_conversations`, read in full by four parallel reviewers (one per date
range), then cross-checked against production logs and the live Calendly
availability. Transcripts stayed in /tmp; nothing with PII is in this repo.

## Numbers

| Range | Chats | Calendar shown | Booked in chat |
|---|---|---|---|
| Aug 21-26 | 41 | 25 | 6 (+1 unrecorded) |
| Aug 27-Sep 2 | 39 | 12 | 3 |
| Sep 3-7 | 34 | 14 | 8 |
| Sep 8-11 | 24 | 10 | 3 |

Median visitor messages per chat: 2 to 3. Booking counts are slightly
inflated: at least 7 chats carry duplicate `booking_confirmed` rows.

## Root causes found and fixed (branch `fix/chatbot-dates-and-retry`)

1. **The model was never told today's date.** It assumed 2025, called Tuesday
   Sep 15 "Monday", asked the calendar for 2025 dates and relayed "No open
   times" as "fully booked". Live calendar on Sep 11: Sep 14 = 21 slots, Sep 15
   = 41, Sep 16 = 17. Seen in 7 chats, about 20 false "full" statements, at
   least 3 lost bookings. Fix: date line + 14-day weekday list in the prompt;
   the tool now rejects a past or out-of-window day instead of saying "none".
2. **Every "Sorry, something glitched" was an OpenAI rate limit.** The org is
   capped at 30,000 tokens/minute on gpt-4.1 and one turn sends ~9,500. 5
   failures in 7 days, all mid-booking. Fix: one retry when OpenAI names a wait
   of 8s or less (covers 4 of the 5). The real fix is raising the OpenAI tier.
3. **Calendar did not open on clear start intent** (19 chats): "take a call",
   "enroll", "how do I join", "how to start", "first step", and "how much money
   is needed to get started" (vetoed as an earnings question). Patterns added.
4. **Mia never named a real time** (0 of 12 calendar opens in one range). The
   calendar tool result now carries the open-times summary.
5. Stale site fact ("book at /book-now after a quiz") drove pasted /book-now
   links; dead example link `/case-studies/mallorie-rauch` (real slug
   `mallerie-rouch`, 4 of 8 links dead in one range); dashes between numbers
   became commas ("2, 4 machines").

## Proposed next, needs a yes (prompt and copy changes)

Ranked by bookings plausibly lost.

1. **Shorter first reply.** "How does the program work?" (the starter chip)
   gets the same 60-110 word five-feature brochure in every range; 4-8 visitors
   per range leave right after it. Cap the first reply at ~40 words, one
   question, no feature list.
2. **Name ask.** "Who do I have the pleasure..." appears in about 75 chats,
   usually stacked with a second question, sometimes asked twice; 10 unbooked
   chats in one range end right after it. Ask once, alone, only after they
   have shared something, never when the form already gave it. One question
   per message, hard rule. Ban the stock openers ("Before we get into",
   "Funny enough", "Happy to break it down", "Who do I have the pleasure").
3. **Price pushback loops.** 4 chats lost after repeated refusals ("I'm not
   going to book a call if I don't know the price", "I'll join another
   program that doesn't hide cost"). One scripted answer, then pivot to what
   the call gives them; never repeat the refusal; on a second push offer a
   text from the team via flag_for_team. Business decision below.
4. **Unkept promises.** "Will text you today" (nobody did for 5 days,
   7947526c), "I'll hold that slot", "someone will reach out" with no hand-off
   recorded (53f6ebbb). Rule: promise human action only in the turn
   flag_for_team succeeded; there is no "hold".
5. **"The calendar is open" when it is not** (10 chats). Extend the
   narration guard's phrase list.
6. **Bent member stories.** Andy's timeline told backwards, Shan called "he",
   Javier's first month quoted as monthly, invented "members from education".
   Stories only from the case study index, always with the link.

## Data bugs (not in this branch)

- **Recalled phone beats the one typed in chat.** bae84501: a 9-digit number
  from the contact form won over the correct 10-digit number the visitor typed,
  so the Close callback task carries a wrong number. Fix: a stored phone that
  is not a valid 10-digit US number yields to a valid one from this turn.
  Touches Close sync, so it gets its own slice.
- Duplicate `booking_confirmed` rows inflate booking counts (7+ chats).
- One visitor_hash recalled "Aaron Boh" onto three different people.

## Questions for Kody

1. The prompt and emails promise a "free 15-minute call". The Lane 1 event is
   45 minutes (a visitor booked "10 to 10:45"). Which is true?
2. The primary calendar had only 3 open days (Sep 14-16) in the next 30 on
   Sep 11. Can availability be widened?
3. ANSWERED (Adam, Sep 11): price is never answered directly, in chat, text
   or email. It only comes on the call. A consultant may text to set up the
   call, never to send a number. (Cost-forced calendars on a first message
   booked 1 of 16 in two ranges, so the pushback wording still matters.)
4. Who works `flag_for_team` callbacks, and how fast?

## What works (keep)

Bookings come when the calendar opens on the visitor's own "yes" after 6-8
messages of real back-and-forth with one member story matched to their job,
linked. They book within 1-4 minutes of it appearing.
