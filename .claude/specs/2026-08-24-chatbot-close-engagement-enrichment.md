# Chatbot: Close engagement enrichment, and the production Calendly webhook (2026-08-24)

Continues `.claude/specs/2026-08-25-HANDOFF-chatbot-close-enrichment.md`.
Closes its OPEN ITEM 1 and delivers its Priority 1.

## 1. The production Calendly webhook is live

Created against the org's API with the stored PAT:

- subscription `a65a4f8c-c66c-4294-8b7f-6eb421c67340`
- callback `https://www.vendingpreneurs.com/api/webhooks/calendly`
- events `invitee.created`, `invitee.canceled`, scope organization, state **active**
- `CALENDLY_WEBHOOK_SIGNING_KEY` set on Vercel **Production** (sensitive)

The listing found **15 subscriptions on this org**, almost all of them other
teams' Make / Zapier / n8n / Supabase automations. None were touched. Worth
knowing before anyone "cleans up" that list: this is a shared Calendly org.

Two facts corrected from the handoff's diagnosis:

- **Zero** subscriptions pointed at www.vendingpreneurs.com, as expected.
- The old preview-URL subscription
  (`vending-website-git-feat-conversion-embeds-...vercel.app`) is **`disabled`**,
  not merely mis-targeted. It was not delivering anywhere. Left in place rather
  than deleted, since deleting it buys nothing and it is inert.

`scripts/calendly-webhook-setup.mjs` is the tool: `list`, `create`, `delete`.
`create` refuses to add a second subscription to a callback URL that already has
one, because duplicates deliver every booking twice. The signing key is captured
at creation because Calendly shows it exactly once.

**The env var only takes effect on a new deployment.** That is this commit.

## 2. Close engagement enrichment

When a rep opens a chatbot lead they now get a "Website engagement" note
carrying: the entry page, the visitor's own questions, which member stories the
bot showed them, what they do for a living, why they are looking, timeline,
capital and market signals, hesitations raised, and what we emailed them, plus a
link to the full transcript.

### Why a note and not custom fields

The handoff proposed seven Close custom fields. Every Close field in this
codebase is addressed by an ID from an env var, and those fields do not exist in
Close yet, so that path is blocked on Stephen creating them and handing the IDs
over. A note needs no field IDs, no migration, no deploy coordination, cannot
overwrite anything a rep edited, and lands in the activity feed where a rep
actually looks. Filterable custom fields remain a clean strict addition on top.

This also satisfies the handoff's own rule: _prefer write-once on create, and add
later context as a note rather than a field update_.

### The two-stage note, and why it exists

`prospect_profile` is written **only** by the digest cron (`learning/digest.ts`),
which runs _after_ the Close sync that creates the lead. At sync time it is null.
A single note written on sync would therefore never carry "what they do for a
living" -- the headline requirement.

So the marker is keyed on whether extraction had run:

- `chatbot-engagement-ref:<conv>:initial` -- written by the Close sync within ~2
  minutes. Entry page, questions, stories, resources. Labelled "first pass".
- `chatbot-engagement-ref:<conv>:full` -- written by the digest once a profile
  exists, carrying the background.

Two notes maximum, and the second only ever when it genuinely adds something.
The two markers are deliberately **distinct strings rather than a shared
prefix**: the dedupe check is a substring match, so an overlapping pair would
have the fuller note suppress itself.

The digest hook hangs off `storeProfile()` rather than its two callers, because
both routes into extraction end there and a guard on one caller would leave the
other silently missing it.

### Three real bugs found while building this

1. **The entry page was being overwritten.** `page_url` was correct on insert but
   `persistConversationTurn` rewrote it on **every** later turn, so a visitor who
   kept chatting while navigating was recorded on their last page, not the one
   that pulled them in. This was the gap the handoff asked to verify, and it was
   real. Now write-once, still filling a null. Same first-touch rule the codebase
   already applies to Entry Source and Resource Tag in Close.
2. **Returning visitors silently got no note.** The digest calls the writer with
   only a conversation id, and a returning visitor's newest session carries no
   `lead_submission_id`. Resolving the Close lead from it found nothing and
   dropped the note -- exactly the multi-session case the `visitor_hash`
   aggregation exists to serve. Now resolved from the newest session that
   actually produced a lead. The regression test fails without the fix.
3. **Heavy visitors lost their recent chats.** The aggregate read is capped at 20
   but was ordered ascending, so the cap dropped the _newest_ sessions including
   the one the note anchors to. Now newest-first.

### Shared note writer

`close-note.ts` now owns lead resolution, marker dedupe and the fail-soft
boundary, and both `close-booking-note.ts` and `close-engagement-note.ts` use it.
The booking note's 7 existing tests pass unchanged. Two copies of that logic is
how one quietly drifts from the other.

### Deliberate scope calls

- **Not hooked to the Calendly webhook.** The sync writes the note when the lead
  is created, which is before a booking in the normal flow, so the note is
  already there. Adding a webhook call would push enrichment at a lead that just
  booked, which the handoff explicitly rules out, for no gain.
- **Pages visited (item 5) and email opens / link clicks (item 6) are NOT built.**
  Both need genuinely new instrumentation and neither is derivable from stored
  data. The note says nothing about whether a resource was opened, on purpose: a
  rep must not read "emailed to them" as "they read it".
- Reads are bounded (20 sessions, 8 questions, 240 chars each). A note is a
  briefing, not an archive.

## 3. Migration

`20260825120000_chatbot_conversations_lead_submission_idx.sql`, **hand-applied to
prod before this commit**. The sync drain runs every two minutes and now looks up
a conversation by `lead_submission_id`; without the index that is a sequential
scan on that cadence. `visitor_hash` was already indexed.

## Still open

1. **Rotate the Calendly PAT.** The current one was pasted into a chat log this
   session. It has no `exp` claim, so it is valid until revoked. Scopes needed:
   scheduling read, user management read, webhooks read + write. It now lives at
   `~/.config/calendly-token` (0600) so future runs never put it in a transcript.
2. **Close custom fields.** Still needs Stephen to create them and hand over the
   IDs. The note covers the reading need today; fields would add filtering and
   reporting. Make every new field optional so a missing ID is skipped, following
   `assignCustom` in `close/client.ts`.
3. Items 2, 3, 4, 6 and 7 of the handoff are untouched and still accurate --
   income-claim disclaimer wording, em dashes during streaming, narration without
   action / the `gpt-4o-mini` model tier, the smaller items, and the pre-existing
   13-lead sync backlog.

## Verification

`npx tsc --noEmit` clean. `npx vitest run` **1788 passing** (1758 before, +30).
`npm run build` compiles, 112 static pages. `eslint` on every changed file clean;
the 5 pre-existing `no-unused-vars` warnings in `chatbot/config.ts` and
`emails.ts` are unchanged and were confirmed present before this work.
