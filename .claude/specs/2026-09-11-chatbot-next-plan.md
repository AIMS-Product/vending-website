# Chatbot next plan: beat the setters on booked calls

Approved by Adam 2026-09-11. Execute in a fresh session, one slice at a time,
starting from `2026-09-11-chatbot-HANDOFF.md`. Merge #29 then #30 first.

Facts checked 2026-09-11 (read-only):
- `chatbot_config.starter_questions` = ["Do I need experience?", "How does the
  program work?"]; the cost chip is already gone. Model = gpt-4.1.
- `_dmarc.vendingpreneurs.com` has THREE TXT records (invalid DMARC, receivers
  may ignore all of them). No root SPF; Resend sends via `send.` which has SPF.
- Credit split `32d1202` is the first unpushed commit on
  `feat/booking-credit-split`, directly on origin/main.

## S1. Scoreboard: chatbot vs setter credit (tier 1, safe-feature-slice)
Goal: a weekly number, chatbot-credited bookings vs setter-credited bookings.
- Cherry-pick `32d1202` onto a fresh branch from origin/main (AGENTS.md
  learning: cherry-pick beats merging a stale branch).
- `20260910200000_booking_credit.sql` must be hand-applied in the Supabase SQL
  editor before deploy; every reader must tolerate its absence until then.
- Verify: the Gerald Winslow case (chat Sep 6, setter booked Sep 10) shows as
  setter credit with chatbot entry credit.

## S2. Objections answered with real members
- Case study JSON already carries objection tags (`objection-price`,
  `objection-spouse`, `objection-trust`, `objection-status-quo`). Check whether
  the SITE_KNOWLEDGE case study index includes them; if not, add the tag and one
  verbatim quote per member to the index line.
- Prompt: OBJECTIONS matches a worry to a member who had the same one, quote +
  link ("my wife asked 'are you really doing this?'", Andy). PRICING unchanged.
- Tests: index carries tags; existing no-price-in-index tests still pass.

## S3. Open with what we already know
- Visitors from /thank-you-for-applying and booking pages were still asked
  their name (2bbdde18, 33d96433). Pass landing page + that visitor's form
  answers (lead_submissions) into the prompt; greet by page, never re-ask.

## S4. Replay eval + weekly review
- Script replays visitor turns from recent real chats through the current
  prompt + guard with side-effect tools stubbed (no email, no Close, no DB
  writes). LLM judge scores: under 45 words, one question, no invented fact,
  never a price, every day/time matches slots, no promise without hand-off.
- Weekly cron posts the five worst replies to Slack. Watch OpenAI rate limits.
- Gate: every later prompt or model change must not lower the score.

## S5. Texting rhythm + model test
- Split a reply into at most two bubbles with a short typing pause (two flush
  frames; the widget already renders frames in order with a typing delay).
- Try a stronger model only through S4's replay score.

## S6. Email follow-up for chat non-bookers (tier 1, safe-feature-slice)
Adam, 2026-09-11: "extremely careful". Two hard concerns, both design
constraints, not polish: (1) who gets the replies, and an email bot cannot
keep up a conversation; (2) when email and setters both touch a lead,
attribution must say exactly who touched them and who did the work to book.

BLOCKED until Adam answers all four:
  a. Does the chatbot get the first 24h with its own non-bookers before
     setters work them?
  b. Who owns replies: which inbox / which person, and is that address
     connected to Close so replies land on the lead?
  c. The credit rule when both touch (proposed below).
  d. DNS owner collapses the three DMARC records into one:
     `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`.
And after S1 ships: the credit rule has to exist before a second channel
starts adding touches.

**One-way by design. It never holds a conversation.**
- At most two emails: one ~1h after a chat that captured an email and did
  not book, one on day 2. Written from that chat (their question, a real
  open slot). No AI replies to email, ever.
- Reply-To is the human-owned address from (b). ANY reply stops all
  automation for that lead permanently and creates a Close task for the lead
  owner with the reply attached. A person answers, not the bot.
- Stop before each send if: booked (fetchBookedLeadIds), replied, unsubscribed,
  or ANY setter call / SMS / email on the Close lead since the chat.
- Price rule applies: no number, ever. Unsubscribe footer.

**Attribution: every touch has an owner, every booking has one credit.**
- Touch ledger per lead, in order: chat (chatbot), follow-up email 1/2
  (chatbot_email), each setter call/SMS/email (setter, by Close user id).
- Each email sent writes a Close note ("Chatbot follow-up email 1 sent,
  link: ...") so setters see the touch before they call and never double up.
- Distinct links: follow-up emails use `utm_source=chatbot`,
  `utm_medium=email_followup`, `utm_campaign=followup_1|followup_2`,
  `utm_content=<conversation id>`; in-chat stays `utm_medium=site_chat`.
  Verify booking-attribution.ts records the medium, not just the id.
- Proposed credit rule (Adam to confirm in c): the booking goes to whoever
  produced the booking action. Booked through a chatbot link (chat or email)
  = chatbot, booked by a setter (their link, their call, manual booking) =
  setter. The other side gets an "assist". Entry credit (who first captured
  the lead) is recorded separately, as S1 already does. Never both.

**Proof it helps, not just adds noise.**
- 50/50 holdout by conversation id hash for two weeks. Success = more
  chatbot-credited bookings in the emailed half WITHOUT fewer total bookings
  (no stealing setter bookings, no annoyed leads). Report both.
- Reuse: emails.ts (Resend), outcomes.ts (captured_no_booking),
  availability.ts, close-handoff.ts (Close task), S1 credit fields.
- Pool: ~25 captured-no-booking chats per three weeks, so the holdout needs
  the full two weeks before anyone reads it.

## Adam / Kody actions (not code)
- Raise the OpenAI usage tier.
- DMARC collapse (above).
- Kody: call length 15 vs 45 minutes; widen calendar availability (3 of 30 days).
- Fix the callback number on conversation bae84501's Close task.
