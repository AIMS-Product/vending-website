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

`form_type` carries the capture type verbatim — see **Capture types** below.

Deliberately withheld: the attribution session blob (session ids, referrer
chain, landing URLs), user agent, Close lead/contact ids, lifecycle and
call-status columns, notification state, qualification session ids.

## Config

Edited at **/admin/settings/lead-forwarding** (super admin only), stored in
`lead_forward_settings`:

- on/off, the webhook URL, which capture types forward, whether every traffic
  source forwards or only an allowlist, and the partner's custom field ids.
- A "send test lead" button, because GoHighLevel's inbound-webhook trigger can
  only build a field mapping from a request it has actually received.

Credentials that stay environment variables:

- `WESCALE_GHL_TOKEN` + `WESCALE_GHL_LOCATION_ID` — the API transport's private
  integration token with `contacts.write`. A live partner token does not belong
  in a table an admin session can read.
- `WESCALE_GHL_WEBHOOK_URL`, `WESCALE_GHL_FIELD_IDS` — still honoured, as the
  way to configure a destination before the settings table is applied. The
  admin-entered values win.

Off, or a missing settings table, means nothing is enqueued — no dead rows
accumulate before go-live.

## Capture types

`booking` · `application` · `chat` · `lead_magnet` · `newsletter`. The label
travels in the payload's `form_type`, so a roadmap download is never presented
to a partner's reps as a call request. Defaults forward the first three.

Which types forward is decided once, at submit time, and frozen with the
payload: switching a type on later starts the flow from that moment rather
than back-filling people who were deliberately held back. The destination is
read at drain time instead, so fixing a wrong webhook URL redirects events
already queued.

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

Unit tests on the payload builder, the selection filter, target resolution,
both transports, the fail-soft enqueue and the settings validation; drain tests
proving a forward leaves the lead row untouched and a partner 502 fails only
the event; component tests on the settings page.

Live verification against WeScale's GoHighLevel is blocked until they send a
URL or token. `scripts/ghl-forward-test.mjs` and the page's test button each
fire one sample, which is also what their ops team needs to map fields against.

## Unsafe outcomes checked (page)

- An admin pasting an internal URL and having the server fetch it — the webhook
  URL is https-only and rejects loopback, private ranges and cloud metadata
  hosts.
- Switching the feed on with nowhere to send, nothing selected, or an empty
  allowlist — each refused at save with the fix named.
- A saved traffic source with no recent traffic silently dropped on the next
  save — it stays rendered and ticked.
- A new campaign silently not forwarding — "every traffic source" is the
  default and explicitly covers sources that do not exist yet.
- A read-only admin changing the feed — every control is disabled and the
  action requires super admin.
