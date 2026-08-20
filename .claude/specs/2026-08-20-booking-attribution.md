# Booking attribution: form fill -> booked call

## Problem

CEO wants to reverse-engineer the funnel: how many people fill out a form on the
site, and how many of those book a call. The site has 8+ booking pages and
several legacy calendars.

## State found (2026-08-20)

- Form fills: tracked well. 556 submissions, 487 synced to Close with
  source_path, UTMs, qualification answers.
- Close tagging: correct. Entry Source `Website-Apply`, Resource Tag
  `website-application`, Application Source = page path, UTMs on the contact,
  qualification note. Hot-inbound smart views read Recapture State / Ever Had
  Call and do pick these leads up.
- Bookings: `/api/webhooks/calendly` exists and links booking -> lead by email,
  but `CALENDLY_WEBHOOK_SIGNING_KEY` was only ever set in Preview, never
  Production. Every live webhook 401s. `calendly_bookings` is frozen at
  2026-08-03. Of the 642 rows it did capture, only 115 (18%) linked to a lead.
- Net: the website could not answer the CEO's question at all.

## Decision

Close is the source of truth for "did this lead book a call", not the Calendly
webhook. Reasons: Close already has it (`First Call Booked Date`, maintained by
Calendly's native Close integration), it covers all calendars including ones the
website never renders, it backfills history, and it needs no new credentials.
We already store `close_lead_id` on every synced lead, so the join is exact --
no email guessing.

The Calendly webhook stays as a secondary real-time signal (cancellations,
which calendar). Fixing it is a separate, Calendly-side task.

## Scope

1. Migration: `call_booked_at`, `call_status`, `call_reconciled_at` on
   `lead_submissions`.
2. `getLead` on the Close client (read-only).
3. `close-booking-reconcile` service: batch-reads Close by `close_lead_id`,
   writes booking state to our rows. Bounded per run, 404-tolerant.
4. Piggyback on the existing close-sync cron (every 2 min), same best-effort
   pattern as `prunePublicRequestHits`. No new schedule.
5. Admin: "Call" column on /admin/leads; form -> booking conversion by page on
   /admin/analytics.
6. Future exact matching: pass the lead submission id to Calendly as
   `salesforce_uuid` (Calendly's passthrough tracking field) so a restored
   webhook links by id instead of email.

## Non-goals

- No writes to Close. This is read-only against the CRM.
- Not re-pointing the Calendly webhook (needs Calendly admin access).

## Measured baseline (full scan, 2026-08-20)

478 real website leads -> 271 booked a call (56.7%). 13 Closed/Won.
Per page: /booking-t5-socials 96%, /booking-youtube 61%, / 56%,
/booking-meta 39%, /newsletter 8%.
