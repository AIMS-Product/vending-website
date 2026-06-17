# Decisions: post-submit-qualification-builder

## Confirmed Decisions

- 2026-06-17: Build a post-submit qualification system, not a generic first-step
  form replacement. The short landing-page contact form captures the initial
  contact, then immediately routes the visitor into a mandatory Typeform-style
  follow-up.
- 2026-06-17: The short contact form remains intentionally small: required full
  name, email, phone, plus hidden attribution. Richer qualification questions
  belong in the follow-up flow.
- 2026-06-17: The local database is the source of truth. The short contact is
  saved locally first, then the qualification answers append to that same local
  lead/contact record through linked response tables.
- 2026-06-17: Use separate qualification tables linked to
  `lead_submissions`, with a compact summary/status mirrored onto the lead for
  admin scanning.
- 2026-06-17: Landing pages and lead-form blocks can explicitly select a saved
  qualification form, with a global default fallback.
- 2026-06-17: V1 records experiment and variant attribution, but does not assign
  traffic between variants.
- 2026-06-17: After short-form submit, redirect to a dedicated tokenized
  qualification route such as `/qualify/[sessionToken]`. The token must not
  expose lead IDs or email addresses.
- 2026-06-17: The qualification session must append to the same contact/lead
  created by the short form.
- 2026-06-17: Integrate with Close CRM directly. Short-form submit creates or
  updates a Close Lead and Contact immediately; qualification completion enriches
  those same Close records. Close Opportunity creation is deferred.
- 2026-06-17: Deduplicate by email. Reuse the same Close Contact/Lead for repeat
  submitters, while preserving full local submission/session/source history for
  attribution.
- 2026-06-17: Close sync failure must not block the visitor. Save locally,
  record sync status/error, continue to qualification, and retry Close sync in a
  backfill mechanism.
- 2026-06-17: Persist qualification answers step-by-step as the visitor advances,
  not only on final completion.
- 2026-06-17: V1 question types: short text, long text, email/phone
  display/confirm if needed, single choice, multiple choice, yes/no, number,
  currency or budget range, state/region dropdown, date or timeframe choice,
  and final consent/confirmation checkbox.
- 2026-06-17: No conditional branching, file uploads, payments, calendars,
  calculated scoring, or arbitrary scripts in V1.
- 2026-06-17: Admins control form content and sequencing only. Public
  qualification design, colors, fonts, layout, animation, and button styling are
  locked in code.
- 2026-06-17: Published qualification forms are immutable versions. Admin edits
  happen in draft; new sessions use the latest published version; existing
  sessions continue on the version they started.
- 2026-06-17: Completion routes to a campaign/page/form configurable next step,
  with a global thank-you fallback.
- 2026-06-17: Close enrichment pushes a readable qualification note/activity
  with all answers, and mirrors only selected normalized fields into Close custom
  fields.
- 2026-06-17: Real public qualification submission is session-token-only in V1.
  Admin preview can exist, but standalone public forms are out of scope.
- 2026-06-17: Qualification sessions are resumable. Returning to the token URL
  preloads saved answers, resumes at the first unanswered required step, and
  lets visitors edit prior answers.
- 2026-06-17: Qualification tokens expire after 30 days. Incomplete sessions
  become internally stale after 7 days.
- 2026-06-17: Lead/contact lifecycle status and Close sync status are separate.
  Lifecycle includes contact captured, qualification pending, qualification
  stale, qualified, and qualification expired. Sync includes pending, synced,
  failed, retrying, and dead letter.
- 2026-06-17: V1 admin surfaces include `/admin/forms`, attachment settings in
  the landing/page editor, and a lightweight `/admin/leads` backstop for lead
  status, source/UTM/variant, qualification status, Close sync state, and retry.
- 2026-06-17: Rollout is opt-in first. Existing `/apply` and contact flows remain
  stable until the new short-contact-plus-qualification flow is proven.
- 2026-06-17: Close Lead/Contact is created or updated immediately with a
  qualification-pending status, but sales task/notification creation waits until
  qualification completion. If a session becomes stale after 7 days, create an
  incomplete-qualification follow-up task.
- 2026-06-17: V1 opt-in uses the existing page-builder `lead_form` block first,
  not a separate new landing-page form system. Block settings select
  qualification form, experiment key, variant key, and completion redirect. The
  public block renders a short name/email/phone contact form, then redirects to
  the tokenized qualification route.
- 2026-06-17: Qualification form selection lives at both page and block level.
  The page can define a default qualification form and completion redirect for
  all lead forms; an individual `lead_form` block can override them. The session
  stores the resolved form, form version, redirect, experiment key, and variant
  key.
- 2026-06-17: Close configuration is environment/code-owned in V1. Secrets such
  as `CLOSE_API_KEY` stay in env only. Custom-field IDs and status labels live in
  typed server config. Admin UI can show sync status/errors/retry but cannot edit
  Close API keys or mappings.
- 2026-06-17: V1 does not include an automated lead score/fit rules engine.
  Qualification questions can be marked with normalized roles such as budget,
  timeline, state, business stage, goal, or available capital. Completion
  produces a readable summary and mirrors selected normalized values into Close.
  Automated scoring is deferred until real answer patterns are available.
- 2026-06-17: The public qualification runtime uses a Typeform-style one-question
  screen with visible progress, Back and Continue controls, autosave on
  Continue, safe refresh/resume behavior, and no aggressive exit-blocking
  messaging beyond unsaved-current-step protection.
- 2026-06-17: The default qualification form should include a required final
  consent/confirmation question. Consent capture stores timestamp, rendered
  question/version text snapshot, user agent when available, and source
  attribution. Exact compliance wording should be code/content-configured and
  reviewable rather than invented per form by admins.
- 2026-06-17: `/admin/leads` V1 is operational only: list/filter leads, inspect
  qualification answers, review source/UTM/variant and Close sync state, and
  retry failed Close sync. CSV export, dashboards, A/B winner analysis, and
  attribution reporting are deferred.
- 2026-06-17: The user does not have Close credentials yet. Build should proceed
  with local database persistence, optional Close env config, mocked Close tests,
  retryable sync events, and admin-visible failure states. Final live Close proof
  is deferred until `CLOSE_API_KEY` and real Close custom-field/status IDs exist.

## Safe Defaults

- Save the local lead synchronously before any Close call.
- Run Close sync immediately when possible, but persist a retryable sync event
  for every create/update/enrich attempt.
- Store `close_lead_id`, `close_contact_id`, sync status, attempt count,
  `next_retry_at`, and last error locally.
- Store question and option snapshots with answers so old analytics remain
  readable after future form edits.
- Missing Close config degrades to local capture plus retryable sync failure; it
  must not break the visitor flow.
- Store source path, landing path, UTM params, referrer, source page/block/CTA,
  selected qualification form/version, experiment key, and variant key on the
  qualification session.
- Close duplicate handling: reuse an existing local `close_contact_id` /
  `close_lead_id` first. If no local mapping exists, search Close by email. If
  there is one clear matching Contact, reuse it and its parent Lead. If Close has
  multiple plausible matches, do not guess; keep the local flow moving, mark the
  sync event `needs_review`, and surface it in `/admin/leads`.
- Normalized fields to mirror into local summaries and selected Close custom
  fields: qualification status, source path, landing path, experiment key,
  variant key, state/market, business stage, budget range, available capital,
  purchase timeline, location status, machine count goal, primary goal, consent
  status, and latest qualification completed timestamp.
- Default qualification form content and order:
  1. Confirm state/market.
  2. Current business stage.
  3. Primary goal for vending.
  4. Available budget or capital range.
  5. Desired timeline to start or grow.
  6. Location status or access to possible locations.
  7. Target number of machines/routes.
  8. Biggest constraint or question.
  9. Best contact preference/time.
  10. Required consent/confirmation.

## Rejected Options

- Replacing the current `/apply` flow immediately.
- Building a generic standalone public form/survey tool in V1.
- Building live A/B traffic assignment in V1.
- Building CSV export, dashboards, A/B winner analysis, or attribution reporting
  before the event model is proven.
- Blocking qualification if Close CRM sync fails.
- Storing all detailed qualification answers directly on the existing
  `lead_submissions` row.
- Giving admins visual design controls for the Typeform-style runtime.
- Creating Close custom fields for every arbitrary builder question in V1.
- Hardcoding automated lead scoring rules before real qualification answer data
  exists.

## Open Questions

- Exact Close custom-field IDs and status values must come from the Close
  account configuration or environment, not guesswork.
