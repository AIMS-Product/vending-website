# Site Chatbot v2 — Convert, Book, Attribute ("Fin-level")

Goal: the chatbot's job is BOOKED CALLS the sales team can see attributed to it.
v1 (shipped on `feat/vp-chatbot`) looks and sounds right; v2 makes it a closing
machine with tools, in-chat booking, outbound email, and a provable
chat→call attribution loop. Sales team is low on calls — this is the lever.

## 1. Tool calling (OpenAI function calls in /api/chatbot/chat)

Give the model tools; stream text as today, execute tool calls server-side,
append rich messages to the transcript. Message schema gains
`kind: "text" | "calendar" | "resource_card" | "booking_confirmed"` (default
"text"; widget renders rich kinds; admin transcript viewer shows them too).

- `show_booking_calendar` — the flagship. Emits a `calendar` message; widget
  renders an INLINE Calendly embed (react-calendly or plain iframe embed of
  `NEXT_PUBLIC_DEFAULT_CALENDLY_URL`) inside the transcript, sized to the
  panel, with UTM params: `utm_source=chatbot&utm_content=<conversation_id>`.
  Bot triggers it the moment call intent shows or qualification completes —
  "want to just grab a time right here?" No link-outs, no friction.
- `send_resources_email` — actually emails the visitor (first outbound email
  TO leads): picks from the resource catalog (roadmap, finance templates,
  matching case study), branded template via Resend, from the persona
  ("Mia from Vendingpreneurs"), reply-to the sales inbox. Requires captured
  email; the model calls it only after the visitor says yes. Rate-limit 2/conversation.
  Log to conversation + lead. This makes "I'll send that over" TRUE, which is
  the credibility unlock for the whole persona.
- `capture_contact` — structured capture when the visitor volunteers details
  (name/email/phone) so nothing depends on regex alone.
- `flag_unknown_question` — model self-reports questions it couldn't answer
  confidently → `chatbot_unknown_questions` table → insights page "Questions
  the bot couldn't answer" → one-click "add answer to knowledge base". This is
  the continued-learning loop Adam wants, driven by real gaps.

## 2. Attribution loop (proves the chatbot books calls)

- Site already has `/api/webhooks/calendly`. Extend: when the invitee payload
  carries `utm_content` matching a conversation id → mark that conversation
  `call_booked` (+ `call_booked_at`), stamp the linked lead, write a
  `booking_confirmed` message into the transcript (widget shows a
  confirmation card if the visitor is still there).
- Admin: "Calls booked (30d)" KPI tile on /admin/chatbot + insights, a
  "Booked" badge on conversation rows, and capture→booked funnel numbers
  (conversations → captured → booked). This is the slide for the sales team.
- Vercel Analytics/Money Page: pass the same UTMs so existing attribution
  surfaces agree.

## 3. Drive-calls behaviors (prompt + product)

- Prompt: primary goal changes from "capture" to "booked call"; capture is the
  fallback when they won't book. After 1-2 qualifying answers, always offer
  the in-chat calendar. Pricing question → answer + "easiest is a free
  15-min call, want to grab a time right here?" + calendar tool.
- Exit-intent card v2: offer the calendar first, email capture second.
- Digest email v2: subject carries hot-lead count; body ranks "call these
  now" (call intent, no booking) at top with one-click Calendly reschedule
  links and phone numbers.
- Follow-up task drafts: every draft ends with the booking link.

## 4. Premium feel (Fin-level polish)

- Rich message cards (resource card with image/button, calendar, confirmation
  with date/time) styled to the site's design system.
- Smooth message entrance animations, typing indicator already shipped.
- "Mia is finding times…" state while the calendar tool renders.
- Mobile: full-screen sheet panel on <640px (current panel is cramped there).

## 5. Data

New/changed:

- `chatbot_conversations`: add `call_booked_at timestamptz`, `booked_event_uri text`.
- `chatbot_unknown_questions` (id, conversation_id, question, status open/answered/dismissed, dedupe_key, created_at).
- Message JSON: `kind` field (backward compatible — absent = text).
- Migrations additive; use the established missing-column-tolerant pattern in
  config.ts/conversation-store so deploys never depend on migration order.

## 6. Constraints / reuse (v1 lessons — do not relearn)

- Branch `feat/vp-chatbot` worktree `.claude/worktrees/vp-chatbot`; never push main.
- Migrations: hand-applied to prod Supabase (Safari SQL editor or Adam);
  tolerant-fallback pattern in code FIRST, so deploys never break pre-migration.
- Close sync: entry_source stays untouched; resource tag `chatbot`; lead
  budget rate limits on every capture path (review C2 lesson).
- Every cron addition needs the timingSafeEqual auth pattern + vercel.json.
- Adversarial review before calling it done (v1 review caught 2 criticals).
- Test live locally against local Supabase or prod-with-care (never let test
  leads reach the real Close sync — 2-min cron window).
- OpenAI raw fetch only (no sdk); tool-call loop max 2 rounds per turn;
  timeouts + output caps stay.

## Order of execution (fresh session: recon-skip, build straight from here)

1. Message-kind schema + widget rich rendering + migrations (tolerant).
2. Tool-call loop in chat route + `show_booking_calendar` + prompt v2. ← the
   conversion core; ship/test this before anything else.
3. Calendly webhook attribution + admin KPIs/funnel.
4. `send_resources_email` + resource catalog + templates.
5. `capture_contact` + `flag_unknown_question` + insights "unanswered" rail.
6. Mobile sheet + polish + adversarial review + preview push.
