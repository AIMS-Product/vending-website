# Staging Validation Checklist — Webflow → New Site Cutover

Run every row on the **staging preview** before merging to production and
switching DNS. Nothing here touches production; the freeze stays until every box
is checked and Adam gives the word.

## 0. Pre-conditions (activation)

- [ ] `calendly_bookings` table applied to Supabase (migration
      `20260720120000_calendly_bookings.sql`).
- [ ] Calendly webhook subscription created → `/api/webhooks/calendly`
      (events: `invitee.created`, `invitee.canceled`).
- [ ] `CALENDLY_WEBHOOK_SIGNING_KEY` set in the staging environment.
- [ ] `CLOSE_API_KEY` (+ Close field IDs) present in staging so lead → Close
      sync runs.
- [ ] `NEXT_PUBLIC_TRACKING_ENABLED=1` on staging **only if** the team wants to
      verify pixels fire (otherwise leave off).

## 1. UTM passthrough (native form funnels)

For each native-form page (the 13 former-Typeform booking pages + `/apply`):

- [ ] Visit with test UTMs, e.g.
      `/booking-youtube?utm_source=test_src&utm_medium=test_med&utm_campaign=test_camp`
- [ ] Submit the form with a test name/email.
- [ ] In `/admin/leads` → open the new lead → confirm **Source page, UTM
      source/medium/campaign** all match what was in the URL.
- [ ] Confirm first-touch attribution survives a multi-page path (land on one
      page with UTMs, navigate, submit on another — UTMs should still attach).

## 2. Forms working end-to-end

- [ ] Every native-form page renders the branded form (no Typeform anywhere).
- [ ] Validation errors show correctly (submit blank → inline errors).
- [ ] Successful submit shows the correct completion (thank-you or, where wired,
      the Calendly handoff).
- [ ] Lead appears in `/admin/leads` within seconds.

## 3. Booking on Calendly

- [ ] Calendly pages (`/start`, `book-my-advisory-call-*`, `booking-ig`,
      `booking-insta-b5`) load the scheduler in-page.
- [ ] Form→Calendly handoff pages (e.g. `/demo/book-a-call`): submit → land on
      Calendly with **name + email pre-filled** and UTMs carried in the URL.
- [ ] Complete a real test booking on Calendly.

## 4. Calendly booking captured as data

- [ ] After the test booking, a row appears in `calendly_bookings` (check
      `/admin/analytics` → "Bookings by calendar", or the table directly).
- [ ] The booking is **linked to the originating lead** (matched by email).
- [ ] UTM/source on the booking matches the funnel it came from.
- [ ] Cancel the test booking → the row flips to `canceled`.

## 5. Close CRM sync

- [ ] The test lead syncs to Close (run the sync, then find the lead in Close).
- [ ] Attribution fields (UTM, source page, campaign) are populated on the Close
      lead.
- [ ] `/admin/leads` shows the lead's Close sync status as `synced` (not failed).

## 6. Master dashboard

- [ ] `/admin/analytics` loads (admin login required).
- [ ] Leads-by-source, traffic-source, and bookings-by-calendar reflect the test
      traffic.
- [ ] Booking rate + 14-day trend populate.

## 7. Tracking tags (if enabled on staging)

- [ ] Meta Pixel fires (Meta Pixel Helper shows PageView).
- [ ] HubSpot, ClickMagick, Vidalytics, Wisepops, ManyChat, RightMessage,
      idpixel all load (Network tab).
- [ ] No Typeform script loads anywhere.

## 8. Content / page parity

- [ ] Every Webflow page a visitor can reach has an equivalent on the new site
      (spot-check nav, footer, campaign landing URLs).
- [ ] The 6 pre-existing failing tests (News list + qualification form) are green.

## Cutover (only after every box above is checked)

1. Merge `feat/conversion-embeds` → `main`.
2. Set `NEXT_PUBLIC_TRACKING_ENABLED=1` in production.
3. Point the Calendly webhook at the production domain.
4. Lift the production freeze (`vercel.json`, Ignored Build Step).
5. Switch DNS off the Webflow rollback proxy → the new site.
