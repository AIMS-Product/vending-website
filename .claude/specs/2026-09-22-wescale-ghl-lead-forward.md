# WeScale GHL lead forward

**Date:** 2026-09-22 · **Tier:** 1 (customer PII leaves our system over a webhook)

## Slice

Every lead submission on vendingpreneurs.com is forwarded into WeScale's
GoHighLevel sub-account, either by POSTing to an inbound-webhook URL they
create, or by upserting a contact through the GHL v2 API. Off until they send
credentials.

## Why the queue, not an inline POST

Two code paths write `lead_submissions`:

- `submitLead` (`src/lib/services/leads.ts`) — the apply form, chatbot, newsletter.
- `createQualificationIntake` (`src/lib/services/qualification-intake.ts`) — `/contact`
  and every `booking-*` page. This is the larger path (515 of 559 submissions
  in the 30 days to 2026-09-22).

Both already enqueue a `close_sync_events` row, so that queue is the one choke
point both paths share. Hanging the forward off it gets claim/CAS, backoff,
dead-lettering and admin visibility for free, and survives a GHL outage. The
Money Page fan-out (an inline fetch in `submitLead`) was the other candidate
and was rejected: it misses the intake path and has no retry.

## Invariant

A failure to reach GHL never fails a submit and never marks a lead's Close sync
unhealthy. `ghl_forward` joins `warm_reply_activity` as an event type excluded
from `writesLeadSyncState`.

## Outbound contract

Frozen at submit time in the event payload, so the forward can never pick up a
field added to `lead_submissions` later. Every key is always present (null when
absent) so one GHL field mapping covers both form types.

```
first_name, last_name, email, phone, submitted_at, form_type,
source_page, utm_source, utm_medium, utm_campaign, utm_term,
utm_content, gclid, fbclid,
city, state, business_stage, budget, timeline, message   (application only)
```

`form_type` is `"booking"` (our `contact`) or `"application"` (our `apply`).

Deliberately withheld: the attribution session blob (session ids, referrer
chain, landing URLs), user agent, Close lead/contact ids, lifecycle and
call-status columns, notification state, qualification session ids.

## Config

- `WESCALE_GHL_WEBHOOK_URL` — option A. Wins if both are set.
- `WESCALE_GHL_TOKEN` + `WESCALE_GHL_LOCATION_ID` — option B, private
  integration token with `contacts.write`.
- `WESCALE_GHL_FIELD_IDS` — option B only. JSON map of payload key to GHL
  custom field **id**. The OpenAPI spec marks `id` required on a customFields
  entry, so field keys alone are not enough.

None set means nothing is enqueued — no dead rows accumulate before go-live.

## Unsafe outcomes checked

- Duplicate contacts in their GHL on a re-submit → dedupe key `ghl_forward:<leadId>`,
  one forward per lead forever, same rule as `lead_create_or_update`.
- Two drains forwarding the same event → existing claim/CAS on `attempt_count`.
- A GHL outage marking leads Close-failed → excluded from `writesLeadSyncState`.
- A submit failing because GHL is down → forward is queued, never inline.
- Over-sharing → payload is built by one function and asserted field-for-field
  in tests.
- Token in an error string → error text is bounded and the token never appears
  in a response body we echo.

## Verification

Unit tests on the payload builder, target resolution, both transports and the
disabled path. Live verification is blocked until WeScale sends a URL or token;
`scripts/ghl-forward-test.mjs` fires one sample payload at a URL on demand,
which is also what their ops team needs to map fields against.
