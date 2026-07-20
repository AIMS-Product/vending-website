# Master Funnel / Lead / Booking Tracking Dashboard

Goal: one backend view that tracks every funnel, calendar, and lead source for
the Webflow → new-site cutover. Local/preview only — production stays frozen.

Today `/admin/leads` only sees native-form leads. Typeform + Calendly embeds
bypass our DB. This closes that gap.

## Slice 1 — Capture Calendly bookings (Tier-1: inbound webhook) [IN PROGRESS]

New `calendly_bookings` table + signature-verified webhook that records every
booking with UTM/source attribution and links it to the originating lead by
email.

Files:

- `supabase/migrations/2026072010XXXX_calendly_bookings.sql` — table, indexes,
  RLS (service-role writes, `app_users` admin read — mirror `lead_submissions`),
  `set_updated_at` trigger.
- `src/types/database.ts` — add `calendly_bookings` Row/Insert/Update under
  `Tables` (alphabetical, before `close_sync_events`).
- `src/lib/config.ts` — add `CALENDLY_WEBHOOK_SIGNING_KEY` (optional) to schema
  - the `process.env` map.
- `src/lib/services/calendly-webhook.ts` — pure `verifyCalendlySignature(rawBody,
header, signingKey)` (HMAC-SHA256 over `${t}.${rawBody}`, header format
  `t=<ts>,v1=<sig>`, timing-safe compare) + `parseCalendlyEvent(payload)` (zod).
- `src/lib/services/calendly-bookings.ts` — `recordCalendlyBooking(client, event)`:
  match most-recent `lead_submissions` row by `lower(email)` → set
  `lead_submission_id`; upsert into `calendly_bookings` on `invitee_uri`
  (created → booked; canceled → status=canceled + canceled_at).
- `src/app/api/webhooks/calendly/route.ts` — POST, read raw body, verify sig
  (fail closed if key missing/invalid → 401), parse, record, 200 `{ok:true}`.
- Tests: signature verify (valid/invalid/missing), event parse, record
  (insert + cancel update + lead match) with a fake client.

Idempotency: `invitee_uri` unique. Attribution: pull `payload.tracking.utm_*`

- `utm_content`/`salesforce_uuid` if present.

Setup (ops, note for Adam — not code): register the webhook subscription with
Calendly (`CALENDLY_API_KEY`) pointing at `/api/webhooks/calendly`, and set
`CALENDLY_WEBHOOK_SIGNING_KEY` in Vercel Preview env.

## Slice 2 — Route funnels through our native form → Calendly

Extend the form→Calendly pattern (already built on the `lead_form` block +
`/demo/book-a-call`) to the code-wired conversion pages so every lead lands in
`lead_submissions` before Calendly. Per-page decision with Kody.

## Slice 3 — Analytics rollup screen

`/admin/analytics` — aggregate `lead_submissions` + `calendly_bookings`:
leads by source page / funnel / utm_source / campaign; bookings by calendar +
source; conversion rate (leads → bookings); 7/30-day trend. Server-side
aggregation, simple bars + tables (no external chart lib).

## Guardrails

- Freeze intact: branch `feat/conversion-embeds`, no `main`, no `vercel --prod`.
- RLS on every new table. Service-role only for writes. No secrets in client.
- Migration is additive only (new table) — safe on the live DB.
