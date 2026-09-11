# Booking attribution polish — overnight report

Branch: `feat/booking-attribution-polish` (off `origin/main` @ `0a4b5b2`)
Run: 2026-09-10 22:10 PT → 2026-09-11

Follows `2026-09-10-booking-credit-split.md` (PRs #23, #25, #26).

## P0 — backfill verified

The reconciler's first full wave finished before this run started.

| Column | Rows |
| --- | --- |
| `lead_submissions` total | 956 |
| with `close_lead_id` | 935 |
| with `close_lead_created_at` | **914** |
| with `booked_by_setter` | 201 |
| with `entry_resource_tag` | 652 |

914 of 935 Close-linked leads carry the date. The remaining 21 are the tail of
the 6h re-check cycle, not a fault.

### Gerald Winslow

Lead `658838f1`, Close `lead_UJEW7ovrFU7IM5nnmAcrH47mgxeRz9qlz8lLp6VCVIg`.

- `booked_by_setter` = **Connor George** ✓
- `entry_resource_tag` = **chatbot** ✓
- `close_lead_created_at` = `2026-09-07T00:44:45Z`, chat started
  `2026-09-07T00:42:38Z` — the chat came **2 minutes first** ✓

So first touch chatbot, last touch Connor George: the "Chatbot, then setter"
bucket. Both rules resolve as the spec says.

### Touch buckets recomputed from the database

Recomputed independently against production (not by calling the app's code),
replicating `isBooked`, `attributionSourceOf`, `resolveBookingCredit`,
`resolveFirstTouch` and `touchBucket`. 136 conversations in the list window,
30 of them booked.

| Bucket | Before this branch | After |
| --- | --- | --- |
| Chatbot end to end | 5 | **6** |
| Chatbot, then setter | 4 | 4 |
| Chatbot, booked elsewhere | 3 | 3 |
| Earlier source, then chat | 10 | **14** |
| No lead linked | — | **3** |
| Not checked yet | 8 | **0** |
| **Total** | 30 | 30 |

The buckets sum to all booked in both columns.

### The 12-of-37 finding has moved, and that is expected

Yesterday: 12 of 37 chatbot conversations linked to a Close lead had a Close
record predating the chat. Today: **19 of 39**. Yesterday's count was taken
mid-backfill, when most leads had no `close_lead_created_at` yet and therefore
resolved to "not checked". 19 of 39 is the first complete measurement. Not a
regression — a partial number completed.

## P1 — "Not checked yet" was never going to be checked

All 8 conversations in that bucket had **no `lead_submission_id` at all**. None
were waiting on the reconciler; there was no lead for it to read. The label
promised an answer that could never arrive.

Root cause: `applyChatbotBookingAttribution` stamps `call_booked_at`,
`booked_event_uri` and `attribution_source` onto the conversation but never
writes `lead_submission_id`. Meanwhile `recordCalendlyBooking` links the
`calendly_bookings` row to a lead by invitee email. A visitor who books
straight from the in-chat calendar without giving the bot their details ends
up with the booking on the conversation and the lead on the Calendly row, and
nothing joining them.

**Fix (read-only):** `fetchBookedEventLinks` joins
`chatbot_conversations.booked_event_uri` → `calendly_bookings.scheduled_event_uri`.
That key matched **8 of 8**; `utm_content` matches only 7 (it misses every
`email_match` booking — Nora Gollihar's). Resolving at read time fixes rows
already written as well as new ones, which a write-time stamp could not.

5 of the 8 recover a lead: Joe Sharp, Tammy A, Alesha Minott, Nora Gollihar
(all earlier-source) and Ashley Valenzuela (chatbot end to end). 3 have no lead
anywhere — Madalynn Johnson, Melvin Berry, "Jean Bejean" — and now read
**"No lead linked"** rather than "Not checked yet".

`resolveFirstTouch` takes a `leadLinked` flag and returns a distinct `unlinked`
kind, so the two states are never merged again. New `no_lead` bucket and chip;
six buckets still add up to all booked.

The new `calendly_bookings` read is wrapped in try/catch: it may cost the
first-touch labels, never the whole dashboard.

## P1 — consistency audit

| Surface | Verdict |
| --- | --- |
| `/admin/chatbot` "Calls booked · Nd" | **Fixed.** Counted every chat that ended on the calendar, setter bookings included. Caption now leads with the chatbot's own number. |
| Conversations strip "Booked" | **Fixed.** Caption now reads "N chatbot end to end". |
| `/admin/chatbot/insights` (`chatbot-insights.ts`) | **Clean.** Reports conversations, capture rate, avg messages, flags and tasks. No booking counts at all. |
| `learning/digest.ts` + `emails.ts` | **Clean.** "Already booked a call." describes the person, for a rep deciding whether to call. No chatbot credit claimed. Email surface, so untouched by policy anyway. |
| `/api/admin/chatbot-digest/run` | **Clean.** No booking copy. |
| `chatbot/slack.ts` | **Clean.** No booking copy. |

No user-facing string anywhere claims the chatbot booked a call.

## P2 — setter-field coverage (report only, nothing built)

8 booked chats resolve to "Booked elsewhere" (no `in_chat` stamp, no setter
name in Close). Close activity before `call_booked_at`, read-only:

| Person | Calls/SMS before booking | By |
| --- | --- | --- |
| Ashley Valenzuela | 6 | Joe Vaughan |
| Birdlee | 9 | Spencer Reynolds, Christian Hartwell |
| Zetta S Murray | 4 (2 calls) | Luke Herman |
| Khalid Khalil | 3 | Joe Vaughan |
| "Already" | 3 | Joe Vaughan |
| Aaron Boh | 1 | Shreya Bechra |
| Estuardo | 0 | — |
| Benny W Rangel | 0 | — |

**6 of 8 show setter-style outreach with `booked_by_setter` blank.** Close's
"Reactivation - Setter Name" is evidently filled for the reactivation motion
only, not for every setter-worked lead.

**Recommendation: do not infer a setter from activity.** Joseph Vaughan,
Shreya Bechra and Christian Hartwell all appear as Calendly **hosts** in the
same window — they are closers as well as names on these SMS threads. An SMS
thread before a booking therefore cannot distinguish "a setter booked them"
from "the closer followed up" or "they booked themselves off an emailed link".
Inferring credit from it would put back exactly the guess PR #23 removed.

The fix belongs in Close, not in our code: either the team fills the setter
field for non-reactivation bookings, or Close gains a second field for them.
If Adam wants the context on screen in the meantime, show it as "last human
touch before booking" — explicitly activity, never credit.

## Found, not fixed: one booked call can count twice

30 booked conversations resolve to **28 distinct leads**. Two people have two
booked conversations each:

- **Ashley Valenzuela** — `c00dded8` (20:43, captured the lead, no booking
  stamp) and `acb42a4c` (20:45, booked in chat, no lead of its own)
- **Nora Gollihar** — `37de4e1c` (18:34, holds the lead) and `6a5ce1a6`
  (18:46, carries the booking)

Both started a chat, then started a second chat minutes later that did the
booking. `isBooked` counts a conversation as booked if *either* the
conversation or its linked lead has `call_booked_at`, so one call is counted on
both rows. This predates this branch — it is how "booked" has always been
counted — and the headline is inflated by 2 (7%).

Not changed here: deciding which of the two conversations owns the booking
changes the "Calls booked" number Adam watches, which is his call, not a
polish-pass call. **Needs Adam's decision.**

## P3

- **Closer column** in the Booked view: who Calendly assigned the call to,
  populated for **17 of 30** booked chats. Costs no extra query — the
  lead-recovery read already hits `calendly_bookings` by event uri, so it
  returns `raw_payload` in the same batch. `hostNameFromPayload` moved to
  `lib/chatbot/calendly-host.ts` so both the rollup and the admin service can
  reach it without an import cycle; `chatbot-admin` re-exports it.
  Marked `ponytail:` — it pulls ~2.4KB blobs to read one name; the upgrade is a
  `host_name` column written by `recordCalendlyBooking`.
- **Unused `CHATBOT_FLAGS` import** dropped from `chatbot-admin.ts`; the
  re-export stays.

## Checks

- `tsc --noEmit` — clean (exit 0)
- `vitest run` — **256 files, 2101 tests, all passing**
- eslint + prettier — clean on every touched file
- New tests: `unlinked` vs `unknown` first touch, no-lead-vs-recovered buckets,
  the Calendly recovery path, and the closer coming from the same batched read

## P2 — browser QA did NOT run, and the PR is therefore NOT merged

Two independent login walls, both of which the rules say to stop at rather
than push through:

1. **Aside cannot be driven.** `Aside.app` is running (pid 804) but its daemon
   never answers the CLI's auth challenge ("Failed to request daemon auth
   challenge: operation aborted due to timeout"), and `aside host list` returns
   403. Both the CLI and the `mcp__aside__*` tools fail identically. Recovering
   it needs an interactive `aside login`.
2. **The Vercel preview is behind Vercel SSO.** Every path 302s to
   `vercel.com/sso-api`, the site root included:

   ```
   /                                       -> 302 vercel.com/sso-api
   /admin/chatbot                          -> 302 vercel.com/sso-api
   /admin/chatbot/conversations?outcome=booked -> 302 vercel.com/sso-api
   ```

The fallback would mean driving Adam's own Chrome session unattended at 22:40
PT, which is not something to do without him asking. **So the merge gate is not
met and PR #27 is left open for Adam.** Everything else on the gate is green.

What was verified statically instead:

- The chip row is `inline-flex flex-wrap`, so the sixth chip wraps rather than
  overflowing at ~400px.
- "All booked" is computed as the sum of `TOUCH_CHIPS`, and `no_lead` was added
  to that list, so the chips still add up to all booked by construction —
  confirmed against live data (six buckets, 30, equal to `outcomeCounts.booked`).
- The table stays inside its own `overflow-x-auto`; only its `min-w` moves
  (880px -> 1040px) and only in the booked view, so the page body still never
  scrolls horizontally.
- Vercel built the branch successfully, which is a real compile gate.

**Still owed: a human-eye pass on `/admin/chatbot` and the Booked view at
desktop and ~400px.**

## CodeRabbit's green check is hollow

The check reports success but CodeRabbit explicitly did not review:

> This repository does not receive automatic reviews because it has fewer than
> 10 stars.

and, separately:

> Billing warning: we have not been able to collect payment for this
> subscription for more than 72 hours.

So no automated review ran on this PR despite the green tick. Triggering one
needs a bare `@coderabbitai full review` comment, and the billing needs Adam.

## Deliberately not done

- No production rows written. Every check above is a PostgREST GET or a Close
  GET; the recovery is a read-time join, not a backfill.
- The duplicate-booking count is reported, not changed (see above).
- No inference of setters from Close activity (see above).
- The digest email's copy is untouched, per the email/Slack rule.
- **PR #27 is not merged.** Browser verification is part of the merge gate and
  could not be done (see above). Left for Adam.
