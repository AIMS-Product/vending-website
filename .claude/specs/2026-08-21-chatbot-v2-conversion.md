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

---

## Build status (2026-08-21)

All six items built on `feat/vp-chatbot`. Nothing pushed, nothing deployed.

Commits: `eb78ade` (tools + in-chat booking + attribution), `9119b8a`
(unanswered-question loop, call-first digest, mobile sheet), `a6bde88` (smoke
checks), `a23bebd` (adversarial-review fixes).

Verified locally: typecheck clean, 1590 tests pass, both chatbot smoke
scripts pass, production build succeeds.

### What changed from the plan

- The chat stream is now **NDJSON frames**, not raw text. v1 streamed plain
  text, which had nowhere to put a calendar or a resource card. Frames are
  `text` / `flush` / `msg` / `status`, emitted in transcript order. Both ends
  are ours, so this is a contained contract change.
- **One tool round per turn, not two.** Call 1 may use tools; call 2 is given
  no tools at all, so it can only answer in prose. That is what bounds the
  turn and guarantees it never ends on an unanswered tool call.
- `send_resources_email` does **not** let the model write the covering
  sentence. An earlier draft did; review found that turned a verified-domain
  sender with the sales inbox as reply-to into attacker-steerable text. The
  copy is fixed, the recipient must have typed their own address into the
  chat, and a per-recipient budget (4/day) gates every send and fails closed.
- The Calendly webhook appends its confirmation card through a SQL function
  rather than rewriting the transcript array — a read-modify-write there would
  delete any chat turn that landed during the request.

### Before this goes live

1. **Apply the migration by hand** —
   `supabase/migrations/20260821140000_chatbot_v2_conversion.sql`. It adds two
   columns, one table, and **two functions**
   (`chatbot_append_message`, `chatbot_log_unknown_question`). The code
   tolerates all of it being absent, but until it runs: booked-call KPIs read
   zero, the funnel's third step stays at zero, the Booked badge never shows,
   and no unanswered question is recorded.
2. **Point the Calendly webhook at the deployment** and confirm
   `CALENDLY_WEBHOOK_SIGNING_KEY` is set there. No signing key means every
   webhook 401s and no booking is ever attributed.
3. **Test the booking loop end to end on preview**: open the chat, get the
   calendar, book a real slot, then check the conversation row shows
   `call_booked_at` and the admin funnel's booked count moves. This is the one
   thing that cannot be proven locally.
4. Confirm `NEXT_PUBLIC_DEFAULT_CALENDLY_URL` on the deployment matches the
   event the sales team actually watches.

### Known ceilings (deliberate, documented in code)

- The in-chat booking confirmation card can be overwritten by a chat turn that
  completes just after it (whole-array transcript write). Cosmetic only —
  every consumer of booking state reads `call_booked_at`, which is written
  separately and never clobbered.
- The exit-intent calendar is injected client-side, so it is not in the stored
  transcript and disappears on navigation. Attribution still holds: the URL
  carries the conversation id.
- Two OpenAI calls per turn doubles the worst-case output ceiling per turn
  (700 -> 1400 tokens). `maxDuration = 90` bounds the wall clock.
