# Chatbot: never state a price, and close the booking attribution hole (2026-08-24)

Continues `.claude/specs/2026-08-21-chatbot-v2-HANDOFF.md`. v2 is live on
www.vendingpreneurs.com and working: real visitors are chatting, being
captured, and syncing to Close. This pass fixes what the first real
conversation exposed.

## 1. The price. Root cause, and why it was one line

On 2026-08-24 a real visitor (conversation `d6910956`) opened with
**"How much does it cost to start?"** Mia answered:

> "members typically spend around $1,500 to $5,000 to get started, which
> covers the machines and initial product inventory"

Nobody wrote that sentence. `site-knowledge.ts` `PROGRAM_FACTS` said
_"$1,500-$5,000 a month in revenue per member"_. The model read a **revenue**
range back as an **investment** range, relabelled it, and stated it with total
confidence to a lead who then went to book.

**It was not reciting that figure. It was inventing a new one every time.** A
live baseline against production on 2026-08-24 at 17:44 UTC, same question, got
a completely different range:

> "Many members typically invest between $3,000 to $10,000 to get their first
> machine and start their route."

So the `$1,500-$5,000` in PROGRAM_FACTS was an **anchor**, not a script: having
any dollar figures in context was enough for the model to confidently
manufacture a plausible cost range on demand. Deleting the one figure was
therefore never going to be sufficient on its own, which is why the defence
below is four layers rather than one edit. That same baseline reply also said
"Want to pick a time?" without opening the calendar, which is the second half
of the fix.

Two things made it worse than a one-off:

- **"How much does it cost to start?" is the first starter-question chip on the
  widget in production.** It is the most likely opening message on the site,
  not an edge case.
- The prod `chatbot_config.knowledge_base` is **empty**, so this was the only
  source. Nothing else needed scrubbing, and nothing else was hiding.

### The four layers now in place

1. **The figure is gone.** `PROGRAM_FACTS` keeps the community proof points
   (850+ launched, 3,000+ locations, $3M+ in sales) and the effort numbers, and
   gained an explicit COST AND PRICING paragraph saying there is no published
   number and why.
2. **Cost-labelled case-study stats can never reach the prompt.**
   `shan-25k-per-month.json` carries a `Setup Cost: $10-12K` stat. It is at
   index 2 today so `headlineResult`'s `slice(0, 2)` happens to miss it. That
   was luck, not design: one reorder of that JSON would have put a dollar cost
   in the index. `COST_STAT_LABEL_PATTERN` in `site-knowledge.ts` now filters
   any cost/price/investment-labelled stat out before the slice.
   Madison's `$10-12K` **monthly revenue** is untouched, because member results
   are the proof engine of the whole chat.
3. **An absolute rule in the prompt.** A dedicated `PRICING_SECTION` plus a
   rewritten `CONTENT RULES`. It names the specific failure ("a member's
   revenue is not a cost, a member's setup cost is not our price") and gives a
   scripted alternative rather than a discouragement, because the failure was
   the model deciding it knew enough to answer. The `BRANCH_C` paragraph that
   used to say _"answer honestly with what you actually know"_ is gone.
   Required answer: several plans, a lot of financing partners, best way to
   find the right one is a quick chat with the team, plus the calendar in the
   same turn.
4. **A detector on the output.** `price-guard.ts` `findPriceLeak()` reads every
   assistant reply after the turn and flags any currency amount sitting next to
   cost language. Revenue framing is checked FIRST and short-circuits, so
   "Shan does $25K/mo since he started" does not trip it. On a hit the chat
   route logs at `console.error` and upserts a `needs_prompt_tuning` flag onto
   the conversation, visible at `/admin/chatbot/conversations`. It **observes,
   never blocks** — a reply already streamed to a visitor cannot be
   un-streamed, and holding the stream to check would slow every visitor's
   every turn to catch a case that should now be rare.

Plus: **cost questions now force the calendar.** `shouldForceBookingCalendar()`
in `tools.ts` treats a cost question as booking intent, because Michael's
question did not open the calendar even though both the prompt and the tool
description told it to. `hasCostIntent()` deliberately vetoes "how much can I
make" and "how much time does this take" — answering an earnings or workload
question with the plans-and-financing line is simply the wrong answer, and the
member results that DO answer it are real.

Regression guard worth keeping: `build-system-prompt.test.ts` runs
`findPriceLeak()` against `SITE_KNOWLEDGE_BLOCK` itself. The same detector that
watches the model's output now fails the build if a future edit puts a
cost-shaped figure back into the prompt.

## 2. Booking attribution

### What was actually broken

`CALENDLY_WEBHOOK_SIGNING_KEY` is on Vercel **Preview only**. Confirmed again
this session, and `vercel env pull` returns an empty string for every sensitive
var, so the Preview value cannot be copied. Worse, the existing webhook
subscription points at a **preview branch alias URL**, not
www.vendingpreneurs.com. So production deliveries 401 AND never arrive.
`calendly_bookings` is frozen at 2026-08-03.

**But bookings are not invisible.** The Close reconciler
(`close-booking-reconcile.ts`, `*/2 * * * *`) is healthy: 603 leads reconciled,
329 carrying `call_booked_at`. It re-checks each lead every 6 hours
(`RECHECK_AFTER_MS`). That is the working backstop, and `isBooked()` in
`analytics.ts` already counts a conversation as booked from EITHER its own
`call_booked_at` or the linked lead's. Do not "fix" this by making anything
Calendly-only.

### Michael Esan, specifically

Reconciled at `16:26:47`, eighteen seconds after his chat, before he could have
booked. Close had him as "New". His next 6-hour sweep answers it definitively
with no Calendly key required.

### What shipped

- **Email-match fallback** in `booking-attribution.ts`. Visitors who chat,
  leave, and book later through `/book-now` or an emailed link are now
  attributed by matching the Calendly invitee email against
  `chatbot_conversations.captured_email`, most recent conversation inside a
  30-day trailing window. `ilike` patterns are escaped so `%` and `_` in an
  address cannot become wildcards.
- **`attribution_source`** (`in_chat` | `email_match`) so an exact conversion
  stays distinguishable from an assisted one. An email match can never
  overwrite an `in_chat` stamp; exact evidence wins.
- **A reconciliation sweep** — `booking-reconcile.ts` +
  `/api/admin/chatbot-booking-reconcile/run`, daily cron. Lists Calendly's own
  event/invitee history and feeds each invitee through the same
  `recordCalendlyBooking` + `applyChatbotBookingAttribution` path the webhook
  uses, so both matchers apply for free and re-runs are no-ops. `?dryRun=true`
  performs zero writes while still running both real matchers.
- **"Came via chatbot" in Close** — `close-booking-note.ts` writes a NOTE on
  the lead, from both the webhook and the sweep. A note only: `entry_source` is
  a strict-choices field that fails the whole lead update on an unexpected
  value, and Recapture State / Ever Had Call belong to Close's own automation.
- **A funnel strip** on `/admin/chatbot`: conversations, engaged (3+ messages),
  captured, booked, with the rate between each stage, at 7/30/90 days, split
  into "booked in chat" vs "chatted first, booked later". When
  `attribution_source` is not yet applied the split says so honestly instead of
  rendering a confident zero.
- **The chatbot is now its own channel on `/admin/analytics`.** Chatbot leads
  carry no `utm_source` (Michael's is null), so they were rolling up as
  "Website" and the chatbot was invisible. `resolveChannel` takes a
  `capturedByChatbot` option that only overrides the **untagged** case: a
  visitor who came from an Instagram ad and then chatted still belongs to
  Instagram, because Instagram is what brought them.

## 3. Book-rate behaviour

- A yes to a call now opens the calendar AND tells them which slot to take,
  tied to what they said. **Mia cannot see actual availability**, so she must
  never name a clock time the visitor did not name first: "grab the first
  morning slot on there", never "the 9am". Inventing a time that does not exist
  is the same class of bug as inventing a price, and it nearly shipped.
- One follow-up, once. On the visitor's first message after the calendar
  appeared, Mia asks whether they found a time and offers alternatives. Gated
  on `userTurnsSinceCalendar === 0` (the chat route measures the transcript
  before appending the current turn, so 0 fires exactly once). Suppressed when
  a booking is confirmed — which today is almost never, because the webhook
  cannot verify its signature in production, so the instruction tells her to
  take their word for it rather than push the calendar again.
- The team digest already led with a "CALL THESE NOW" block, but membership came
  purely from the **LLM-extracted** `profile.call_intent`, null whenever
  extraction had not run. It now also trusts the **deterministic**
  `invite_to_call` follow-up task the learning engine derives from the
  transcript by regex, so a visitor who plainly asked to book cannot be buried
  under "everyone else" in the email the sales team actually reads.

## 4. Stuck leads: not the chatbot

The banner says 3 because it counts only the leads in the default 7-day view.
All time it is 13: 7 `dead_letter`, 5 `needs_review`, 1 `failed`.
**Zero are chatbot-sourced** — the one chatbot lead ever created synced fine.

Three distinct pre-existing causes:

1. Invalid phone numbers rejected by Close with a 400.
2. "Qualification enrichment is missing a Close lead ID" — enrichment running
   without a created lead.
3. "Multiple Close contacts matched <email>".

Separately, 77 leads sit in `close_sync_status = pending` with a retry
scheduled, oldest 2026-07-28, all `form_type: contact`, all attempted at least
once. A real backlog, unrelated to this work, **not touched**.

## Still open

1. **`CALENDLY_API_TOKEN` is not set anywhere.** The sweep returns
   `{ configured: false }` until it lands, so no backfill has run and Michael's
   Calendly-side answer is still unread. Adam declined to supply a token this
   session; the code is ready for it.
2. **`CALENDLY_WEBHOOK_SIGNING_KEY` still absent from Production**, and the
   subscription still points at a preview URL. The clean fix is a new
   subscription against www.vendingpreneurs.com, which returns a fresh signing
   key. Needs the same token.
3. **Migration `20260824120000_chatbot_booking_attribution_source.sql` is NOT
   applied.** Every consumer tolerates its absence (`call_booked_at` still gets
   written, only the label is skipped), and the funnel's split says so honestly.
   Apply by hand via the Supabase SQL editor. No backfill needed: zero
   conversations currently carry `call_booked_at`.
4. `chatbot_config.model` is still `gpt-4o-mini`. Every forced-tool workaround
   in this codebase exists because of it. One dropdown at `/admin/chatbot`.
5. `priorBackgroundFrom` in `emails.ts` is dead code, pre-existing, left alone.

## Lessons

- **A number in the prompt is a number the model will use, in whatever frame it
  likes.** Revenue became cost. The fix that matters is not "tell it not to" but
  "do not give it the number, and give it a scripted answer instead".
- **The same guard belongs on the input and the output.** Running
  `findPriceLeak()` against the prompt in a test caught the class of
  regression, not just the instance.
- **Watch for the fix reintroducing the bug.** "Name a concrete slot" would have
  had Mia inventing calendar times she cannot see, one layer down from
  inventing prices.
