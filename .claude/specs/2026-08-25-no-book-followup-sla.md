# No-book follow-up SLA — spec + handoff

Written 2026-08-25. Prior work this session shipped as `2a715e6` + `d321173`
(both live on www.vendingpreneurs.com). Read `.claude/specs/2026-08-25-HANDOFF-chatbot-close-enrichment.md`
first for the Close constraints; they still apply in full.

## The goal

A lead fills a form, does not book, and a rep calls them fast. Adam wants them
to land in the Close Smart Lists shown in his screenshot:

- `L2 · ⚡ Warm Reply — TODAY`
- `L2 - Setter · ⚡ Warm Reply — TODAY`

Both described as: **"They contacted US in the last 24 hours and nothing is booked."**

## What the numbers say (measured 2026-08-25, prod, 30 days)

- 631 leads, 301 eventually booked.
- 50 booked within 2 minutes (the straight-through Calendly redirect).
- 72 within 15 min, 79 within an hour, 90 within 24 hours.
- **70% of everyone who eventually books does so more than 24h after the form.**
  Late conversion is the dominant path, so follow-up is what produces most
  calls, not an afterthought.
- Threshold that follows: **no booking after 15 minutes = call them.** About
  76% of leads, roughly 16/day at current volume.

## What already exists (verified, do not rebuild)

- **Slack + email alerts DO fire on every form submit.** `SLACK_WEBHOOK_URL`,
  `RESEND_API_KEY`, `LEAD_NOTIFICATION_TO/FROM` are all set in Production.
- ⚠️ The qualification funnel notifies via `notifyQualificationLead` inside
  `after()` (`src/app/qualification-intake/actions.ts`) and **never writes
  `notification_sent_at` back to the lead row**. Only `submitLead` stamps it.
  So the column reads empty for ~80% of leads that were in fact alerted. Do
  not read that column as "was the team told". Worth fixing separately.
- Every lead reaches Close within ~2 min as status **"New"** via the
  `close_sync_events` outbox.
- The only existing automated recapture is `stale_follow_up_task` — a Close
  task when qualification is started but unfinished (57 in 30 days).
- Admin views shipped this session: `/admin/leads?call=not_booked`,
  `/admin/chatbot/conversations?outcome=calendar_abandoned`, and the
  "Who did not book" tab on `/admin/chatbot`. Read-only, sent nowhere.

## THE BLOCKER — a Smart List is a saved search, not a container

You cannot push a record into a Close Smart List. A lead appears in one when it
**matches the list's query**. So the work is not "push", it is "make our leads
satisfy that query". Two unknowns, neither answerable from this repo:

1. **What does "contacted US" key on?** If it is Close's built-in inbound
   communication activity, a website form fill will _never_ match, because we
   create a lead — no inbound email/SMS/call exists on it. Making it match
   would mean logging an inbound-shaped activity on the lead at submit time.
   If instead it keys on a custom field Stephen maintains, we may already be
   one field-write away.
2. **What does "nothing is booked" key on?** Probably lead status not being
   "Call Booked", possibly a custom field.

**"L2" means Lane 2 — Stephen's automation.** The hard constraint from the
previous handoff applies directly here: **never write `Recapture State` or
`Ever Had Call`.** Close's Lane 2 automation owns them; writing them changes
which leads that automation picks up. Also never write `entry_source` (strict
choices field, 400s the whole update on an unexpected value).

### To unblock, get ONE of these

- The saved search definition for both lists (Stephen can screenshot the filter
  builder), **or**
- A Close API key on the machine, then `GET /api/v1/saved_search/` returns the
  query directly. There is no Close key in `.env.local` and `vercel env pull`
  returns empty for encrypted values, so this cannot be self-served.

Do not guess at the query and write fields speculatively. A wrong write to a
Lane 2 field silently changes who Stephen's automation calls.

## Slice 1 — Slack no-book alert (UNBLOCKED, Adam said yes)

Independent of the Close question. Build this first.

- New cron route `/api/admin/no-book-alert/run`, every 10 min in `vercel.json`
  (six crons exist today; confirm the plan's cron limit before adding).
- Query: leads created 15–120 minutes ago, `call_booked_at IS NULL`, not
  already alerted. Bound the upper end so a backlog cannot alert 300 people at
  once on first run.
- Dedupe **without a migration**: write an `alerted_no_book_at` key into the
  existing `metadata` jsonb. A new column here is a hand-applied prod migration
  (see `isMissingColumnError`/`updateTolerantly` pattern) and is not worth it.
- Message: name, phone, email, source page, score/band, and a link to
  `/admin/leads`. Phone must be tappable.
- Reuse `sendSlackWebhook` in `src/lib/services/leads.ts`. Do not write a
  second Slack helper.
- Fail-soft: an alert failure must never touch lead data or the Close queue.
- **Ask Adam which Slack channel first.** The webhook is encrypted, so the
  current destination cannot be read from here.
- Add an 8am digest of yesterday's stragglers as a safety net.

## Slice 2 — Close Smart List membership (BLOCKED on the query definition)

Once the query is known, make the lead match it. Expected shape: log an
inbound-flavoured activity or note on the Close lead at submit time so
"they contacted us" is true, and leave every Lane 2 field alone.

`close-booking-note.ts` and `close-engagement-note.ts` already write notes with
check-then-act dedupe — extend one of those rather than adding a third writer.

## Verification bar (non-negotiable)

Green `npx tsc --noEmit`, `npx vitest run` (1815 passing today), `npm run build`.
A push to `main` publishes to www.vendingpreneurs.com within ~1 minute.
Local dev writes to the PRODUCTION database and a test lead reaches the real
Close CRM within ~2 minutes — use obviously-labelled test data and clean up.
