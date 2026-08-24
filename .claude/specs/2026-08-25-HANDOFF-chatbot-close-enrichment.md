# HANDOFF — chatbot open items + Close engagement enrichment

Written 2026-08-24 at the end of a long session. Paste the "PROMPT" section at
the bottom into a fresh session; everything above it is the context that prompt
assumes.

---

## Where things are

- Repo `/Users/adamwolfe/vending-website`, branch `main`, everything pushed.
- **A push to `main` publishes to www.vendingpreneurs.com within ~1 minute.**
  Deploy by merging to `main`, never `vercel --prod` from a working tree.
- Worktree `.claude/worktrees/vp-chatbot` exists and is fully merged. Safe to
  reuse or delete.
- Read first: `.claude/specs/2026-08-24-chatbot-prices-and-attribution.md`
  (today's work, with the live verification results and two known gaps).
- Prod Supabase `aacisvhkmsaabqdvdmmf`. **Local dev writes to the PRODUCTION
  database.** There is no staging. A test lead reaches the real Close CRM within
  ~2 minutes, so use obviously-labeled test data and clean up after.

## What shipped today (do not redo)

1. **The chatbot never states a price.** Root cause was `PROGRAM_FACTS` in
   `src/lib/chatbot/site-knowledge.ts` carrying "$1,500-$5,000 a month in
   revenue per member"; the model used it as an anchor and invented a fresh cost
   range on every ask. Four layers now: figure removed, cost-labelled
   case-study stats filtered out of the prompt index, an absolute PRICING rule,
   and `price-guard.ts` flagging any reply that pairs a currency amount with
   cost language. Verified live.
2. **Cost questions force the calendar** (`shouldForceBookingCalendar` in
   `tools.ts`). `hasCostIntent` deliberately vetoes "how much can I make" and
   "how much time" so earnings questions keep their real answer.
3. **Booking attribution**: email-match fallback, `attribution_source`
   (`in_chat` | `email_match`), a daily reconciliation sweep, a "came via
   chatbot" note on the Close lead, a 7/30/90 funnel on `/admin/chatbot`, and
   the chatbot as its own channel on `/admin/analytics`.
4. **Backfill run and complete.** 659 bookings recorded, `calendly_bookings`
   holds 693 rows across the Aug 3 freeze. **Michael Esan booked** — conversation
   `d6910956`, `call_booked_at` 2026-08-24T16:27, `in_chat`, one minute after he
   said "yes for tomorrow morning".
5. Migration `20260824120000_chatbot_booking_attribution_source.sql` is
   **applied** and the CHECK constraint is verified.
6. Homepage: partner strip renamed, program numbers changed to 2-15 hrs /
   < 90 days / $1K-$250K, video case studies moved under the partner ticker,
   the one peach benefits card recoloured to brand blue, CTAs reframed to
   "See if your market is a fit?" with the closing band asking "Curious if your
   market is a fit?" and its button answering "Book here", header CTA
   "Get in Touch".
7. `CALENDLY_API_TOKEN` is set in Vercel Production + Preview. Valid scopes,
   **no `exp` claim so it never times out**, lives until revoked.

## OPEN ITEMS, highest value first

### 1. The production Calendly webhook is still dead (do this first)

`CALENDLY_WEBHOOK_SIGNING_KEY` exists on **Preview only**, and
`vercel env pull` returns `""` for sensitive vars so the Preview value cannot be
copied. Worse, the existing subscription points at a **preview branch alias
URL**, not www.

Consequence: new bookings only reach us on the daily 8am sweep, not in real
time, and the in-chat booking confirmation card never appears for the visitor.

Fix: create a new webhook subscription against
`https://www.vendingpreneurs.com/api/webhooks/calendly` via the Calendly API
(the stored token has `webhooks:write`), take the **signing key returned at
creation time** — Calendly never shows it again — and set it in Vercel
**Production**. Org uri `https://api.calendly.com/organizations/277c4839-a060-431e-b88b-722bd5526e51`.
Events: `invitee.created`, `invitee.canceled`. Then book a real test slot
through the in-chat calendar and confirm the conversation flips to
`call_booked_at` with `attribution_source = 'in_chat'` immediately rather than
on the next cron.

**Adam asked to be asked before anything touches Calendly config.** Creating a
subscription does not affect calendars or bookings, but confirm before doing it.

### 2. Income-claim disclaimer no longer matches the numbers

`src/lib/content/home.ts` `statsDisclaimer` still says "\*Based on the **average
results** of Vendingpreneur community members." The stat above it is now
`$1K-$250K` a month, which is a full spread, not an average. This is an income
claim on a business-opportunity page. Kody or legal should reword to "range of
results" or similar. Copy decision, not a code one.

### 3. Em dashes reach the browser during streaming

`turn-stream.ts` streams each raw OpenAI `delta` to the client and only runs
`stripChatbotFormatting()` on the text it PERSISTS. Stored transcripts are
clean; the visitor watches the unsanitized text render, and the `flush` event
carries no payload to replace it with. Fixing it means changing the streaming
contract in `turn-stream.ts` **and** `ChatWidget.tsx` — send the sanitized final
text with the flush and have the client swap it in. Pre-existing, display-only.

### 4. Narration without action, and the model tier

The bot still sometimes writes "I'll pull up the calendar now" without calling
the tool, on paths that are not force-tooled. Every forced-tool workaround in
this codebase exists because of `gpt-4o-mini`.

**Cheapest fix: change the model.** `/admin/chatbot` already offers
`gpt-4o`, `gpt-4.1-mini`, `gpt-4.1` in a dropdown. One click, no deploy, no code
change. Do this before writing any more guards. If a guard is still wanted
after: reply promises a calendar + no calendar card this turn -> emit one.

### 5. Rotate the Calendly PAT

It was pasted into a chat log. It has no expiry, so it is valid until revoked.
Rotating means pasting the new one into `vercel env add CALENDLY_API_TOKEN`
(production + preview, `--force`). Scopes needed: Scheduling read,
User management read, Webhooks read + write.

### 6. Smaller, real, not urgent

- **Two video-proof blocks on the homepage.** `CaseStudiesStrip` (4 case-study
  videos) high up, and `TestimonialsV2` lower down which renders 4 _different_
  video testimonials plus the written quotes. Adam may want the lower one cut
  back to quotes only. Design call.
- **Sweep does not reconcile cancellations.** It lists `status: "active"` events
  and skips non-active invitees, so a booked-then-cancelled call stays booked in
  our tables until the webhook works or Close's reconciler clears the lead.
  Documented in `booking-reconcile.ts`. Fixing item 1 largely removes this.
- **Close note dedupe reads only the newest 50 notes** (`_limit=50`, unpaginated,
  in `close/client.ts`). A lead with 50 newer notes could take a duplicate
  booking note. `ponytail:` comment marks it in `close-booking-note.ts`.
- **`priorBackgroundFrom` in `emails.ts` is dead code.** Pre-existing.
- **Michael's `lead_submissions` row still shows no booking** while his
  conversation does. Close has not caught up. `isBooked()` reads either signal
  so the funnel is right. Cosmetic.
- **Daily sweep request budget.** This org runs ~14 Calendly events a day across
  its calendars and the sweep needs one invitee lookup per event, so a 90-day
  window is ~3000 calls. The cron keeps the 500 default (fine for a day);
  `maxRequests` is an explicit option for a one-off backfill.

### 7. Pre-existing lead-sync backlog (unrelated to the chatbot)

13 leads stuck all-time: 7 `dead_letter`, 5 `needs_review`, 1 `failed`. The
`/admin/leads` banner says 3 because it counts only the default 7-day view.
**Zero are chatbot-sourced.** Three distinct causes: invalid phone numbers
rejected by Close with a 400, "Qualification enrichment is missing a Close lead
ID", and "Multiple Close contacts matched". Separately 77 leads sit `pending`
with a retry scheduled, oldest 2026-07-28, all `form_type: contact`, all
attempted at least once. Its own piece of work.

## Hard constraints — do not relearn these

- **Never write `entry_source` in Close.** It is a strict `choices` field; an
  unexpected value fails the whole lead update. Chatbot leads tag via
  `metadata.source = "chatbot"` (`CHATBOT_LEAD_SOURCE` in `lead-capture.ts`).
- **Never write Recapture State or Ever Had Call.** Close's own Lane 2
  automation owns them (Stephen, 2026-08-06). Writing them changes which leads
  that automation picks up. See the comments on `closeTaggingPayload`.
- Entry Source / Resource Tag are written on lead **CREATE only** — both are
  first-touch attribution and re-sending stomps rep and automation edits.
- Migrations are **hand-applied to prod** via the Supabase SQL editor. Code must
  tolerate a missing column first (see the `isMissingColumnError` /
  `updateTolerantly` pattern in `booking-attribution.ts`).
- OpenAI via **raw fetch only**, no SDK.
- **No em or en dashes in any visitor-facing string.** No emojis anywhere
  (Lucide icons). No dark theme.
- Copy strings live in `src/lib/content/`, never inline in JSX
  (`.claude/rules/components.md`).
- Never push without green `npx tsc --noEmit`, `npx vitest run`, and
  `npm run build`. Suite is currently **1758 passing**.
- `scripts/guard-next-build.mjs` blocks `next build` while a dev server runs.
- Every scripted/`sed`-style edit needs an assertion. Two silent no-op edits
  were reported as applied earlier in this project because a formatter had
  rewritten the target text.

---

## PROMPT — paste this into a fresh session

Continue the vendingpreneurs.com chatbot. It is live on
www.vendingpreneurs.com, taking real leads, and the team is happy with it — the
work now is making it feed the sales team better. Read first:
`.claude/specs/2026-08-25-HANDOFF-chatbot-close-enrichment.md` (this file, all
sections above), then
`.claude/specs/2026-08-24-chatbot-prices-and-attribution.md`.

**Priority 0, before anything else:** fix the production Calendly webhook
(OPEN ITEM 1 above). It is a five-minute job and everything below is more
useful once bookings arrive in real time instead of on a daily cron. Ask Adam
before creating the subscription.

**Priority 1: enrich Close leads with website engagement context.**

The goal, in the team's words: when a rep opens a chatbot-sourced lead in
Close, they should already know what page the prospect was on, what they asked,
which member story they engaged with, and what they do for a living — before
they dial. Today the Close lead only carries name, email, phone and source
page.

Push these onto the Close lead:

1. **Entry page** — the page the visitor was on when the chatbot first engaged
   them. **Largely already wired:** `closeCustomFieldPayload` already sends
   `firstLandingUrl`, `firstLandingPath`, `landingPath`, `sourcePath` and
   `firstReferrer`, and `chatbot_conversations.page_url` holds the page the chat
   started on. Verify it records the initial page and not a post-redirect one,
   then close the gap rather than rebuilding it.
2. **The conversation transcript** — as a Close **note**, plus a link to the
   admin conversation view. `close-booking-note.ts` already writes a note via
   `createNote` with a check-then-act dedupe; extend that rather than adding a
   second note writer. The transcript is already in
   `chatbot_conversations.messages` (jsonb).
3. **Testimonial / case study shared** — which member story the bot showed them.
   **No new capture needed:** the prompt forces every story mention to carry a
   `/case-studies/<slug>` markdown link, so parse the slugs out of the assistant
   messages in the transcript. See `parse-chat-links.tsx`.
4. **What they do for work** — already extracted. `prospect_profile` on the
   conversation (`extract-prospect-profile.ts`) holds the occupation and other
   signals the digest email already uses. Map it to a field rather than
   re-deriving it.
5. **Pages visited during the session** — **this is genuinely new work.** There
   is no page-view tracking anywhere; `lead-attribution.ts` only keeps
   first/latest landing URL in the `vp_attr` localStorage blob. A per-session
   page list needs a client-side accumulator and somewhere to store it. Scope
   and price this separately before building it.
6. **Content engaged with** — resource sends ARE already recorded in the
   transcript as a `resource_card`, so "which resources were offered/sent" is
   derivable today. **Email opens and in-chat link clicks are NOT tracked at
   all** and would need new instrumentation (Resend open tracking, plus a click
   handler on chat links). Treat as a separate, later slice — say so rather than
   half-building it.

**Where to do the work.** The 2-minute `/api/admin/close-sync/run` cron
(`adminRunCloseSync` in `src/lib/close/sync.ts`) already has service-role access
and an outbox with dedupe (`close_sync_events`, `dedupe.ts`). Add an enrichment
pass there: after the Close lead exists, backfill the field values from the
chatbot conversation data in Supabase. On the Calendly webhook, add a final pass
that marks the booking as chatbot-sourced and attaches the conversation context.

**Close custom fields needed.** Every Close field in this codebase is addressed
by an ID from an env var (`CLOSE_*_FIELD_ID`). So the first step is not code:
**Stephen has to create the fields in Close and hand over the IDs**, which then
go into Vercel. Ask for them before writing the payload code, and make every new
field optional so a missing ID is skipped rather than fatal (follow
`assignCustom` in `close/client.ts`). Proposed fields: Chatbot Conversation ID,
Entry Page URL, Pages Viewed, Testimonial Shared, Content Engaged With, Chatbot
Transcript Link, Chatbot Captured (tag/boolean).

**Rules this must respect:**

- Never write `entry_source`, Recapture State, or Ever Had Call. See the hard
  constraints above — these are not style preferences, they break Close.
- **Do not overwrite a field a human rep has edited.** Prefer write-once on
  create, and add later context as a note rather than a field update.
- **Do not push enrichment to a lead that already has a booked-call status.**
- Aggregate across sessions where the same visitor returns: conversations carry
  `visitor_hash` (a sha256 of the `vp_chat_vid` cookie), which is the join key.
- The same enrichment shape should work for a visitor who fills in the contact
  form instead of chatting — different lead source, same fields.
- Fail-soft throughout: enrichment failing must never fail lead creation, the
  Close sync, or a webhook.

**Verification, non-negotiable:** green `npx tsc --noEmit`, `npx vitest run`
(1758 passing today) and `npm run build` before any push. Test with an
obviously-labeled address; a test lead reaches the real Close CRM within two
minutes, so clean up after. Adversarially review the changed surfaces, then
merge and push once.

**Do not** run a multi-agent review workflow on this. One focused review pass.
The last session burned a very large number of tokens on a three-reviewer,
ten-verifier workflow for findings a single pass would have caught.
