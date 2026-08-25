# No-book follow-up SLA - what was built

Written 2026-08-25, same day as the spec
(`.claude/specs/2026-08-25-no-book-followup-sla.md`). Read that first for the
measurements and the decoded smart-list query. This file is only what landed and
what is still owed.

## State

Both slices are built, typechecked, tested and built clean. Slice B (Slack) is
live the moment this deploys. Slice A (Close activity) is behind a flag that
ships **off** and needs a hand-applied migration plus one answer from Stephen
before it can be switched on.

## Slice A - incoming Email Activity on the Close lead

`src/lib/close/warm-reply-activity.ts`.

- Logs `POST /activity/email/` with `status: "inbox"` and the visitor's own
  address as `sender`. **`direction` is not a writable field** on that endpoint;
  Close derives it, and `inbox` is the status that yields
  `direction: "incoming"` - the only thing the smart list filters on. Verified
  against developer.close.com, not assumed.
- **No new cron and no new delivery path.** `close_sync_events.next_retry_at`
  already gates the drain, so the job is queued with
  `next_retry_at = capture + 15 minutes` and the existing 2-minute
  `/api/admin/close-sync/run` picks it up. The outbox brings dedupe, retry and
  needs_review parking with it.
- "Still unbooked" is re-checked **at drain time**, against
  `calendly_bookings` (the live webhook, fresh within seconds) and
  `lead_submissions.call_booked_at`. A lead who booked in the interval is marked
  synced without touching Close, because "they booked" is a final answer, not a
  transient failure.
- Both sources covered. The chatbot reaches Close through the same `submitLead`
  pipeline as the contact form, so hooking `submitLead` covers it; the
  qualification funnel is hooked separately in `qualification-intake.ts`.
- One activity per **Close lead**, forever. The outbox dedupe key is per
  lead_submissions row (it protects the queue); the marker written into the Close
  activity body is keyed on the **Close lead id**, because one person routinely
  has several of our lead rows resolving to a single Close lead: `/contact` and
  `/book-now` mint a fresh `idempotencyKey` on every page render, and
  `insertQualificationLead` always inserts a new row while only copying
  `close_lead_id` across. A row-keyed marker let a reload put two incoming
  activities on one Close lead 15 minutes apart, which is the exact re-warming
  this feature must not cause. Caught in review, fixed, and pinned by a test.
- Nothing ever re-logs to keep somebody in the list.
- **Newsletter signups are excluded.** They reach
  `createQualificationIntakeSession` through the same function as the
  qualification funnel (`newsletter-signup.ts` passes `NEWSLETTER_FORM_ID`), so
  without the `isBookingIntentForm` gate a newsletter subscriber would land in a
  same-day setter list under the words "asked about getting started".
- The warm reply no longer writes the **lead's** `close_sync_status`. It is the
  only event type that runs on every capture, which made it the usual last writer
  of that column: it was overwriting the real diagnosis on a lead parked at
  `needs_review`, and stamping leads `synced` over a dead-lettered enrichment,
  both of which corrupt the `/admin/leads` failed-sync banner. The event row
  still records its own status and errors.
- Writes **no Close fields at all**. Not Recapture State, not Ever Had Call, not
  `entry_source`. A test asserts this by passing a Close client that only has
  the two activity methods.

### Still owed before switching it on

1. **Apply `supabase/migrations/20260825130000_close_warm_reply_activity.sql`**
   in the Supabase SQL editor. It extends the `close_sync_events` event_type
   CHECK. Until it is applied the enqueue would violate the constraint, which is
   why the enqueue is gated on the flag AND swallows its own errors.
2. **Get the four excluded lead statuses from Stephen** (question below).
3. Set `CLOSE_WARM_REPLY_ACTIVITY_ENABLED=true` in Vercel Production.
4. Submit **one** obviously-labelled test lead, wait about 17 minutes, confirm it
   appears in Stephen's list, then delete the test lead from Supabase and Close.

### The question for Stephen

> Your smart list "L2 - Warm Reply - TODAY"
> (`save_B1CX357cPu2Kn55opAdDrKXtSiWYPtglciwruVcU7NJ`) starts with
> "Current status: not [4 statuses]". Which four are they? Website and chatbot
> leads land in Close as status **"New"**. If "New" is one of the four, they can
> never appear in the list no matter what activity we log, and we need to know
> that before we start logging.
>
> Two smaller ones while you are there: the three Opportunity statuses in the
> "is not an Opportunity with status in (...)" clause, and whether our unowned
> leads read as "Lead Owner not present" for the last filter.
>
> What we are about to do: log a real incoming Email Activity on the lead 15
> minutes after someone fills in the website form or gives the chatbot their
> details, if they have not booked. That is what makes "they contacted us" true
> in Close's own terms. We are not touching Recapture State or Ever Had Call -
> your Lane 2 automation computes those from the activity, and we want it to keep
> doing that.

A Close API key would answer all three from here in one call
(`GET /api/v1/saved_search/save_B1CX357cPu2Kn55opAdDrKXtSiWYPtglciwruVcU7NJ/`
and `GET /api/v1/status/lead/`). There is still none on the machine and
`vercel env pull` returns empty for encrypted values.

## Slice B - Slack no-book alert

`src/lib/services/no-book-alert.ts`, route
`/api/admin/no-book-alert/run`, cron every 10 minutes (7 crons now).

- Window: leads created **15 to 120 minutes ago**, `call_booked_at IS NULL`, no
  `calendly_bookings` row, not already alerted. Max 25 per run.
- The 120-minute ceiling is the safety catch, not a nicety: it stops the first
  run after deploy from alerting every unbooked lead in the table, and makes a
  cron outage self-limit instead of flooding on recovery.
- Dedupe is `metadata.alerted_no_book_at` in the existing jsonb. No migration:
  a dedicated column here is a hand-applied prod migration for one timestamp.
- Stamped only after Slack accepts the post. An undelivered alert stays eligible
  for the next run, because the dedupe is on "was told", not "was looked at".
- Message: name, tappable `tel:` phone, email, source page, band, minutes since
  submit, link to `/admin/leads?call=not_booked`.
- **Newsletter subscribers are excluded**, same root cause as Slice A. Two
  filters, because the two states live in different places: `lifecycle_status`
  only becomes `newsletter_subscribed` once the signup completes, so a subscriber
  still mid-session is caught by the form id instead. The form-id filter is an
  `or()` that keeps NULL, because a bare `neq()` would drop every plain
  contact-form lead.
- **One message per person, not per lead row.** Verified against production
  2026-08-25: two rows for the same address eight minutes apart, both inside one
  120-minute window, because `/contact` and `/book-now` mint a fresh
  `idempotencyKey` on every page render. Rows are collapsed on lowercased email,
  the oldest is reported, and every row sharing the address is stamped so the
  duplicate cannot resurface next run.
- `NO_BOOK_ALERT_ENABLED` is a kill switch, default ON. It exists so the alert
  can be silenced in Vercel without unsetting `SLACK_WEBHOOK_URL`, which would
  also stop the real lead notifications.
- Reuses the house Slack poster. `sendSlackWebhook` in `services/leads.ts` was
  split into `postSlackWebhook(url, text, fetch)` and both callers now share it,
  so there is still exactly one Slack fetch in that file.
- Destination: the existing `SLACK_WEBHOOK_URL` (Adam's call, 2026-08-25). Same
  channel the form and chatbot lead alerts already go to.

### Known ceilings, deliberately not fixed

- A systematically failing `metadata` update would re-send one lead's alert on
  every run inside its 105-minute window (up to about ten messages). Marked with
  a `ponytail:` comment. Fixing it needs the column this design deliberately
  avoids.
- The `metadata` stamp is read-modify-write, not atomic `jsonb_set`. This cron is
  the only writer of that key and Vercel does not overlap a cron with itself.
- **The 8am digest of yesterday's stragglers from the original spec was not
  built.** It was not in the build request. Add it if the 10-minute cron turns
  out to miss people.

## Review pass

One focused adversarial review was run on the finished diff. It found two
criticals and both were real:

1. **Duplicate incoming activities per person** (marker keyed on the wrong
   object). Fixed, test added.
2. **Newsletter subscribers alerted and logged as no-book leads**, and the Slack
   cron shipping with no kill switch. Fixed, tests added.

Also fixed from that pass: the lead-level Close-sync bookkeeping corruption
above; an explicit `contact_id: null` sent to Close (now omitted, matching the
note writer); two divergent copies of the booking check (now one shared
`services/calendly-booking-check.ts`); and an unescaped `ilike` that treated `_`
and `%` in an email address as wildcards, so `john_doe@x.com` matched
`johnXdoe@x.com` and silently suppressed a real follow-up.

Two review points were judged non-issues and deliberately not changed: em dashes
in code comments are this repo's house style, and the rule is about
visitor-facing strings, which are clean; and a lead-magnet download is a real
prospect, unlike a newsletter signup, so it stays eligible. Flag it if you
disagree on lead magnets.

Still open, and worth knowing: an alert whose Slack post keeps failing for more
than two hours is lost for good once the lead leaves the 120-minute window. That
is the deliberate cost of bounding the window.

## Checked against production before pushing

Read-only, no writes. The cron's exact query was run against prod
(`aacisvhkmsaabqdvdmmf`) and is valid PostgREST: `metadata->>alerted_no_book_at`,
the `neq` on `lifecycle_status`, and the `or()` on `latest_qualification_form_id`
all parse (`NEWSLETTER_FORM_ID` is a real UUID against a uuid column, so no type
error). `alerted_no_book_at` exists on zero rows today, as expected.

**The first live run alerts 8 people** from 9 rows in the window. That is a real
two-hour backlog of unbooked leads, well inside the 25-per-run cap. The
duplicate-person collapse above was found by this check, not by the review.

## Verified

`npx tsc --noEmit` clean. `npx vitest run` **1852 passing**, up from 1815 (37
new).
`npm run build` compiled, `/api/admin/no-book-alert/run` registered. No live
test lead has been sent yet.
