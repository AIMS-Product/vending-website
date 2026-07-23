# Slice: Inline /contact qualification funnel

**Date:** 2026-07-22 · **Branch:** `feat/conversion-embeds` (preview only — PROD FROZEN)
**Tier:** 1 (lead scoring, consent/compliance, Close CRM sync, conversion path)

## Goal (Kody's asks, unified)

Collapse the `/contact` funnel into ONE on-page form. Today: `/contact` (name/email/phone)
→ redirect `/qualify/[token]` (questions) → redirect `/thank-you?state=` (result).
Target: a single `/contact` form that collects contact + consent + the two scoring
questions, scores on submit, and renders the fit result INLINE (no page hops).

## Feature

- **Actor:** unauthenticated prospect.
- **Core invariant:** a completed submission stores name/email/phone + BOTH consents +
  timeline + invest, scores correctly (Variant A dollar-ladder), sets the lead's
  qualification band, queues Close sync, and shows the matching fit result — all from one submit.
- **Unsafe outcomes to prevent:** scoring a partial/invalid submission; losing consent;
  losing UTM/attribution; duplicate leads on retry; exposing the session token to the client;
  silent scoring failures.

## The seeded form (already exists — DO NOT recreate)

Form `a1b2c3d4-0000-4000-8000-000000000001` (`vp-lead-capture`), version `…002`.
Required questions (must all be answered to complete):

- `consent_updates` (type `consent`, role `consent`) — "Email me the guide and vending resources."
- `consent_contact` (type `consent`, role `contact_preference`) — "I agree to receive calls and texts about my request. Msg rates may apply."
- `timeline` (type `single_choice`, role `timeline`) — "When do you want your first machine placed and earning?"
  values: `asap` / `few_weeks` / `1_3_months` / `unsure`
- `invest` (type `single_choice`, role `available_capital`) — "How much are you ready to invest?"
  values: `lt_3k`(disqualifies) / `3_5k` / `5_10k` / `10_15k` / `15k_plus`
  Optional (leave OUT of the inline form): `pull_to_launch`, `learn_most`.
  Labels/values above match the seed migration verbatim — reuse them, don't hardcode new copy.

## Design (reuse existing services — no scoring/session rewrite)

New server-side orchestrator (one atomic path):

1. `createQualificationIntakeSession({ ...contact, ...attribution, qualificationFormId: VP_ID, variantKey: "A" })`
   → creates lead + session (force Variant A so A/B is retired), returns the session token.
   **Contract change:** add `sessionToken` (raw token) to `CreateQualificationIntakeResult` so the
   orchestrator can drive the session. Token stays server-side (never returned to the browser).
2. `saveQualificationAnswer` for each: `consent_updates`=true, `consent_contact`=true,
   `timeline`=<value>, `invest`=<value>.
3. `completeQualificationSession({ sessionToken, userAgent })` — scores, sets band on lead,
   queues Close sync, returns `redirectPath` = `/thank-you?state=<thankYouState>&score=<total>`.
   **Contract change (additive):** also return `thankYouState` + `score` on
   `CompleteQualificationSessionResult` so the caller renders inline without parsing the URL.
   (Existing /qualify caller ignores the new fields.)
4. Orchestrator returns `{ leadId, thankYouState, score }`.

### Action + state

- New action `submitInlineQualification(prev, formData)` in `src/app/qualification-intake/actions.ts`
  wrapping the orchestrator. On success return `PublicLeadActionState` success carrying
  `qualification: { thankYouState, score }`. Reuse `QualificationIntakeValidationError` → fieldErrors.
- `lead-action-state.ts`: extend the `success` variant with optional
  `qualification?: { thankYouState: ThankYouStateKey; score: number }`. `resolveLeadSuccessTransition`:
  for qualification intent with a `qualification` result, return a NEW transition kind
  `{ kind: "qualification-result"; state; score }` (instead of `null`/redirect).

### Form (PublicLeadForm.tsx)

- New inline mode for `intent="qualification"` (gate behind a prop, e.g. `inlineQualification`):
  render, in order: first/last name, email, phone, then a **consent group** (two required
  checkboxes: consent_updates, consent_contact), then two **required dropdowns** (timeline, invest)
  using the seed form's labels + option {value,label}. Submit `variant_key=A` (hidden),
  `consent_updates`/`consent_contact` = "true" when checked, `timeline`, `invest`.
- Add a `CheckboxField` (required-checkbox with error), reuse `SelectField` (needs a
  {value,label} option variant — current one takes `string[]`; extend or add a sibling).
- On success (`qualification-result` transition), replace the form with an inline
  `FitResultPanel` rendering `THANK_YOU_STATES[state]` (label/headline/body/cta) + a booking
  button → `THANK_YOU_LINKS.calendlyUrl` (the accelerator call). No navigation.
- Keep attribution hidden fields + idempotency_key exactly as today.

### ApplyQuiz.tsx

- Point the form at `submitInlineQualification`, pass `inlineQualification`, keep
  `hiddenFields={{ qualification_form_id: VP_ID }}` and add `variant_key: "A"`.

## Keep intact / do NOT touch

- `/qualify/[token]` and `/thank-you` routes stay (QA seam `/vp-quiz`, other forms may use them).
- The scoring engine (`scoring.ts`), Close sync, attribution, idempotency — reuse, don't rewrite.
- Prod freeze in `vercel.json`/Vercel — untouched. No `vercel --prod`.

## Tests (safe-feature-slice matrix — write FIRST, must fail for the right reason)

Orchestrator/service (mock client via existing `deps`):

- happy path each band: `perfect_fit` (asap+15k_plus), `strong_fit`, `good_potential`, `not_right_time`.
- disqualify: `invest=lt_3k` → band `disqualify` → `not_right_time`, regardless of timeline.
- consent required: missing either consent → validation error (no completion, no scoring).
- missing timeline/invest → validation error.
- idempotency: same `idempotency_key` → single lead (no duplicate).
- token never leaks into the returned action state (only leadId + thankYouState + score).
  Action: maps validation error → fieldErrors; success carries `qualification`.
  Form: renders consent checkboxes + both dropdowns; on success shows FitResultPanel with the
  right headline + booking href; error summary still works.
  Run the FULL `vitest run` green before shipping.

## Acceptance

- `/contact`: fill name/email/phone + both consents + both dropdowns → submit → fit result +
  booking button appear on the SAME page. No navigation to `/qualify` or `/thank-you`.
- Lead in DB has band + consent_accepted_at; Close sync event queued with band.
- `npx tsc --noEmit`, `vitest run`, `next build` all green.
