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

## THE QUERY — decoded from Adam's screenshot 2026-08-25 (no longer a blocker)

A Close Smart List is a saved search, not a container: you cannot push a record
into one. A lead appears when it MATCHES the query. Here is the real query for
`L2 · ⚡ Warm Reply — TODAY` (11 filters, 13 leads at time of reading):

```
Where all of:
  Current status:  NOT (4 statuses, collapsed in the screenshot - STILL NEEDED)
  Local time:      between 08:00am and 9:00pm
and any of:
  there IS an SMS Activity   with Direction "Incoming" and Date created within 1 day
  or  there IS an Email Activity with Direction "Incoming" and Date created within 1 day
  or  there IS a  Call Activity  with Direction "Incoming" and Date created within 1 day
and there IS NOT an Opportunity with Current status in (3 statuses)
and any of:
  Lead Owner = Me   OR   Lead Owner not present
```

Its own description: "They contacted US in the last 24 hours and nothing is
booked. The hottest cohort we have and historically the biggest leak.
Same-day SLA - this list should self-clear."

### What this means, concretely

**"Contacted US" is real communication activity, not a tag and not a custom
field.** It requires an SMS, Email or Call activity ON the lead, with
`direction = incoming`, created within the last day.

**A website form submit creates none of those.** We create a Close lead and a
contact. No activity is logged. So today our form leads can never appear in
this list, no matter what tags or custom fields we set. Tagging cannot fix
this; only an activity can.

**The fix: log an incoming Email Activity on the Close lead at submit time**,
carrying what the visitor actually submitted. This is accurate rather than
synthetic - they did contact us, through the website form. Close supports it:
`POST /api/v1/activity/email/` with `direction: "incoming"` (SMS and Call
activity endpoints exist too; email is the honest fit for a form).

### Do NOT write Recapture State

It is a visible column on this list with values `Hot-Inbound`, `Booked`,
`Active-Nurture`. Stephen's Lane 2 automation computes it FROM the activity
above. The standing constraint holds: never write `Recapture State` or
`Ever Had Call`. Log the activity and let his automation do its job. Same for
`entry_source` (strict choices field, 400s the whole update).

### Still needed from Stephen before building

1. **The 4 excluded lead statuses** behind `Current status: not [4]`. Our leads
   land as **"New"** (`CLOSE_LEAD_STATUS_ID`). If "New" is one of the four,
   every website lead is excluded and logging activity achieves nothing.
2. The 3 Opportunity statuses in the "is not" clause, to confirm a website lead
   with no opportunity passes it (it should).
3. Confirmation that `Lead Owner not present` is how our unowned leads read.

**The list itself** (Adam, 2026-08-25):
`https://app.close.com/leads/save_B1CX357cPu2Kn55opAdDrKXtSiWYPtglciwruVcU7NJ/`
so the saved-search id is `save_B1CX357cPu2Kn55opAdDrKXtSiWYPtglciwruVcU7NJ`.
With a key, `GET /api/v1/saved_search/save_B1CX357cPu2Kn55opAdDrKXtSiWYPtglciwruVcU7NJ/`
returns the full query including the collapsed status ids.

A Close API key on the machine would answer all three via
`GET /api/v1/saved_search/` and `GET /api/v1/status/lead/`. There is none in
`.env.local`, and `vercel env pull` returns empty for encrypted values.

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

## Slice 2 — Close Smart List membership (query known, needs the 4 statuses)

Log an **incoming Email Activity** on the Close lead when a form is submitted,
so "they contacted us" becomes true in Close's own terms. Leave every Lane 2
field alone and let Stephen's automation stamp Recapture State.

- New event type on the existing outbox (`close_sync_events`), not a new
  delivery path. It already has dedupe, retry, and needs_review parking.
- `close-booking-note.ts` / `close-engagement-note.ts` show the house pattern
  for writing to Close with check-then-act dedupe. An activity is a different
  endpoint from a note, but follow the same shape rather than inventing one.
- Idempotent: one activity per lead submit, never one per sync attempt. A
  duplicate incoming activity would re-warm a lead that has gone cold and put
  it back in a same-day SLA list it has already left.
- The list self-clears after 24 hours by design. Do not re-log activity to keep
  someone in it.
- Gate behind an env flag so it can be switched off without a deploy if it
  floods the setters' list.

**Verify on ONE obviously-labelled test lead before enabling it broadly**, and
confirm with Stephen that it lands in his list the way he expects.

## Verification bar (non-negotiable)

Green `npx tsc --noEmit`, `npx vitest run` (1815 passing today), `npm run build`.
A push to `main` publishes to www.vendingpreneurs.com within ~1 minute.
Local dev writes to the PRODUCTION database and a test lead reaches the real
Close CRM within ~2 minutes — use obviously-labelled test data and clean up.
