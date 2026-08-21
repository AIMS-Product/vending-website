# HANDOFF — Site chatbot v2 (2026-08-21)

Read this first, then `.claude/specs/2026-08-21-chatbot-v2-conversion.md` for the
full design and the deliberate simplifications.

## Where things are

- Worktree `/Users/adamwolfe/vending-website/.claude/worktrees/vp-chatbot`,
  branch `feat/vp-chatbot`, **10 commits, nothing pushed**, tree clean.
- Verified locally: typecheck clean, 1593 tests pass, both chatbot smoke
  scripts pass, production build succeeds.
- Migration **applied to production** (`aacisvhkmsaabqdvdmmf`, AIMS org) and
  verified live: both columns, the table, and both functions exist and are
  executable by `service_role` (`ask_count` round-tripped 1 -> 2).
- Two adversarial review passes, both returned "block", all findings closed.

## What v2 does

The bot's goal changed from "capture an email" to "book a call". It opens a
real Calendly calendar **inside the chat**, actually emails resources, records
contact details structurally, and reports questions it could not answer into
an admin rail where one click puts the answer in its live knowledge base.

## The two things that are NOT obvious

**1. Booked calls come from Close, not from Calendly.**
`CALENDLY_WEBHOOK_SIGNING_KEY` exists on Vercel **Preview only**, never
Production, so `/api/webhooks/calendly` 401s every delivery and
`calendly_bookings` has been frozen since 2026-08-03. This was found and
decided on 2026-08-20 (`.claude/specs/2026-08-20-booking-attribution.md`):
Close is the source of truth, reconciled onto `lead_submissions.call_booked_at`
every 2 minutes. 308 of 573 leads already carry it.

A conversation counts as booked from **either** signal — its own
`call_booked_at` (Calendly webhook) or the linked lead's (Close). So the KPI,
funnel and digest report real numbers today and upgrade for free if anyone
ever fixes Calendly. Do not "fix" this by making it Calendly-only.

**2. `gpt-4o-mini` narrates actions instead of taking them.**
It answers "how do I book a call?" by writing "I'll open the calendar for you,
one moment!" and then not calling the tool. The plumbing was never the
problem — proven by forcing the same request through the API.

So on unambiguous booking language, and only while no calendar is open yet,
the turn **forces** `tool_choice` to `show_booking_calendar` rather than
asking the model to choose (`hasExplicitBookingIntent` in `lib/chatbot/tools.ts`).
Vaguer interest is still left to its judgement. If the model is ever upgraded,
leave this in — it costs nothing and removes a whole class of failure.

## Open items, in priority order

1. **Resend keys — the only real blocker.** Production has no
   `RESEND_API_KEY` or `LEAD_NOTIFICATION_FROM` (nor does `.env.local`), so
   `send_resources_email` and the sales digest cannot send anywhere. The bot
   degrades honestly (it never claims a send that did not happen), but "I'll
   email that over" is the credibility unlock for the whole persona. Adam to
   supply the key, or authorise copying it from another of his projects.
2. **Model tier — Adam's call, costs money.** `chatbot_config.model` is
   `gpt-4o-mini`. `gpt-4o` / `gpt-4.1-mini` are materially better at tool use.
   One dropdown at /admin/chatbot, no code change.
3. **Which calendar should she book onto?** Currently
   `NEXT_PUBLIC_DEFAULT_CALENDLY_URL` = `.../cxv9-jg6-m53/vending-accelerator-call`
   locally; the production value is set but unreadable via the CLI. The code
   silently falls back to a **different** event
   (`cvsd-wxt-cvb/vendingpreneurs-quick-discovery`) if the var is ever missing.
   The site contains 8+ distinct Calendly events. Adam must name the right one;
   then pin it across all environments and replace the fallback with it.
4. **Push / deploy.** Nothing has left the machine. Preview URL needs a branch
   push; production needs a merge to `main` (which publishes straight to
   www.vendingpreneurs.com — see AGENTS.md).
5. **Next slice, agreed but not started: calendar inventory.** An admin view of
   which page points at which Calendly event. Every ingredient already exists
   (per-page `calendlyUrl` in the content layer, `scheduled_event_name` on every
   booking row, per-page booking rates from 2026-08-20) — nothing joins them.
   Expect it to reveal legacy calendars still reachable that nobody watches.

## Testing it

`npm run dev` in the worktree, then localhost:3000. **Local dev writes to the
PRODUCTION database** — there is no staging, one Supabase project.

- Say "how do I book a call?" -> calendar opens inline (forced path).
- Any email given to the bot creates a **real Close lead** within ~10 minutes.
  Use a `+tag` address.
- Completing a booking in the inline calendar books a **real call** on the
  team's calendar.
- Clean up test rows afterwards: delete from `chatbot_conversations` by
  `session_id`.

## Ceilings, deliberate and documented in code

- The in-chat booking confirmation card can be overwritten by a chat turn that
  finishes just after it (whole-array transcript write). Cosmetic only — every
  consumer of booking state reads `call_booked_at`, written separately.
- The exit-intent calendar is client-injected, so it vanishes on navigation.
  Attribution still holds; the URL carries the conversation id.
- Two OpenAI calls per turn doubles the worst-case output ceiling (700 -> 1400
  tokens). `maxDuration = 90` bounds the wall clock.

## Lesson worth keeping

Two scripted edits silently matched nothing (a formatter had rewritten the
target text) and were reported as applied. The second review caught both. Every
scripted edit needs an assertion, or it fails silently and claims success.
