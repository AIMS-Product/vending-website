# Newsletter signup page

Decided 2026-08-04 from Kody Wirth's Slack brief and attached
`the-route-signup-page.html`. Production is live; `main` deploys to
`vendingpreneurs.com`. Work stays on `codex/newsletter-page`, is verified on a
preview URL first, and is not pushed to `main` without Adam's confirmation.

Tier 1: this captures consented customer records and queues Close CRM sync.
Use `safe-feature-slice`; tests precede implementation.

## Feature

- **Actor:** unauthenticated newsletter subscriber.
- **Route:** `/newsletter`.
- **Core invariant:** stage 1 creates exactly one lead only after required
  newsletter consent, records optional program consent truthfully, and returns
  a session token; stage 2 may update that same token-owned lead with optional
  phone/SMS consent and newsletter questions, then completes the session and
  queues Close enrichment without exposing a lead id.
- **Previous behaviours preserved:** `/contact`, lead-magnet pages, their
  published `Entrepreneur Lead Magnet` form, scoring, attribution, Close
  idempotency, and existing GTM event contracts remain unchanged.
- **Unsafe outcomes:** false consent, a second lead on retry, answering another
  person's session by lead id, overwriting an already-completed session,
  invalid option values reaching Close, or a coded route being swallowed by
  the proxy.

## Verified inputs

The Slack export is a 4.3 MB bundler artifact. The real document is the JSON
string in script block 5, beginning with `<!DOCTYPE html>`. JSON-decoding it
produced the copy and UI below; raw-file grep was not used as the source.

The production `Entrepreneur Lead Magnet` form was inspected read-only in
Supabase. Published version 2 has `contactPhoneRequired=false`, two required
consents (`first_question`, `question_2`), and the two optional multi-choice
questions (`question_3`, `question_4`). It cannot be reused because its consent
meaning and requiredness do not match the newsletter design. Changing it would
also alter the live roadmap and finance-template funnels.

## Visitor flow

Stage 1:

- Name (required)
- Email address (required)
- `newsletter_email_consent` (required): "Yes — send me The Route each week. I
  can unsubscribe anytime."
- `program_updates_consent` (optional): "Also send me occasional
  Vendingpreneurs program updates and event invites."
- Submit: "Join The Route — free"

Stage 2, all optional:

- Phone
- `sms_updates_consent`: "Text me occasional updates at this number. Message
  and data rates may apply."
- `pull_to_launch`: five multi-select options from Kody's reference
- `learn_most`: five multi-select options from Kody's reference
- Submit: "Finish"

If SMS consent is checked without a phone, return a field error. Otherwise an
empty stage 2 is valid. Completion shows an in-place success panel; it does not
score or route to a fit calendar.

## Persistence and integration

Add a forward-only, idempotent data migration that inserts a dedicated,
published, non-default qualification form and immutable version. It adds no
tables or columns and changes no existing form. Rollback, if needed before the
route is released, is a new forward migration that removes the unused form and
version after confirming no sessions reference them.

Stage 1 composes the existing qualification intake/session services, saves the
two email consent answers, and uses the existing lead notification plus Close
drain. Stage 2 identifies the session by token only, refuses completed sessions,
updates the lead phone through a token-scoped domain service, saves the optional
answers, completes the non-scoring form, and queues/drains Close enrichment.

Preview and production share Supabase and the real Close org. The additive form
seed must be applied before preview runtime verification. Synthetic preview
leads must use the established internal test convention and be cleaned up from
the database and Close after verification.

## Page and tracking

The thin route exports Kody's exact title and meta description. All visible
copy lives in typed `src/lib/content/newsletter.ts`. A dedicated section/form
component renders the supplied hero, proof strip, expert cards, and closing
CTA while retaining the site's root Header/Footer.

Register `/newsletter` in `CODED_ROUTE_PATHS` and extend the coded-route test.

Both forms use stable ids, `data-form-step`, and `data-gtm` attributes. On first
focus each stage emits `vp_form_start`; stage success/error emits the existing
`vp_lead_submit` / `vp_lead_submit_error` helpers with intent
`qualification` and the correct step number. Stage 1 sends email but no phone;
stage 2 sends the optional phone.

## Tests (write first)

1. Content/route: exact metadata, valid `/newsletter` registration, reference
   copy and option values.
2. Service: required newsletter consent blocks all writes; optional program
   consent remains false when unchecked; same idempotency key reuses one lead;
   stage 2 updates only the token-owned lead; empty stage 2 succeeds; SMS
   consent without phone fails; invalid options fail; completed token refuses
   replay; no lead id is accepted from the browser.
3. Actions: rate limiting/error mapping, stage-1 token response, multi-value
   `FormData.getAll`, and Close delivery scheduling remain best effort.
4. UI: stage 1 excludes phone/questions; token success swaps to stage 2;
   stage-2 validation preserves selected values; success panel renders; stable
   form/tracking attributes exist.
5. Regression: existing qualification, lead-magnet, tracking, and coded-route
   tests remain green.

## Required verification

- `npx vitest run`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` (then rerun `npx tsc --noEmit` against fresh generated types)
- `npx react-doctor@latest --verbose --diff`
- Local browser QA at desktop and mobile widths, including stage swap and a
  validation error without visible runtime errors.
- Preview deployment: metadata/route, complete flow, stage-1 abandonment,
  duplicate stage-1 submit, optional empty stage 2, one DB lead/Close contact,
  correct consent/answers, GTM dataLayer events, and cleanup.

## Out of scope

Close to ActiveCampaign/Zapier/API/MCP/webhook integration. Kody supplied access
details, but Adam has not separately asked for that integration in this slice.
