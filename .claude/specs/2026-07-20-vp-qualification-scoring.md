# VP Lead Capture — Qualification, Scoring, Routing & Thank-You States

Source: Kody spec, relayed by Adam 2026-07-20. Status: **captured, not yet built.**

## Form units

### Window 1 · Contact (all required)

- First name — text
- Last name — text
- Phone number — tel
- Consent (checkboxes, both required):
  - ☐ Email me the guide and vending resources.
  - ☐ I agree to receive calls and texts about my request. Msg rates may apply.

### Window 2 · Phone + Qualification (all required, dropdowns)

- Email — email
- **Q: When do you want your first machine placed and earning?** (dropdown)
  - As soon as possible
  - In the next few weeks
  - 1–3 months out
  - Still figuring that out
- **Q: How much are you ready to invest?** (dropdown · A/B test)
  - **Variant A (dollar ladder):** Less than $3,000 (disqualifies) · $3,000–$5,000 · $5,000–$10,000 · $10,000–$15,000 · $15,000+
  - **Variant B (capital posture):** $5,000–$10,000 in cash ready · $1,000–$2,000 cash, finance rest · Limited capital, willing to explore · Not able to invest yet (disqualifies)

### Post-submission · Optional (multi-select, below the booking/asset)

Framing: "Optional — so we send you the resources that actually fit you."

- **What's pulling you to launch your own business?** (multi-select): Replace full-time job · Build generational wealth · Diversify income · Speed up paying off debt · Other
- **What do you want to learn most?** (multi-select): Getting started right · Machines & products · Finding & securing locations · Financing & funding ($0-down, ROI) · Permits, legal & state rules

## Form text options (page starting-point copy — pick per page)

- **Informational Exploration** — "Find out if starting a vending business is right for you." CTA: _See if I qualify_
- **Contact to Book** — "Should you start a vending business?" CTA: _Show me if I'm ready_
- **Content Asset** — "Get your free \_\_\_" CTA: _Get instant access_

## Scoring (2 questions, 100 pts max — will change when credit score is added)

**Timeline:** ASAP 40 · Next few weeks 30 · 1–3 months 25 · Still figuring 10

**Invest — Variant A:** <$3k = 0 (auto-disqualify) · $3–5k 20 · $5–10k 40 · $10–15k 50 · $15k+ 60
**Invest — Variant B:** $10–15k cash 60 · $5–10k cash 40 · $1–2k + finance 30 · Limited/explore 10 · Not able 0 (disqualify)

> Note: Variant B copy in the form-units list omits the "$10,000–$15,000 in cash" top rung that appears in the scoring table. **Reconcile with Kody before build.**

## Routing bands

| Score  | Routes to                               | Meaning                            |
| ------ | --------------------------------------- | ---------------------------------- |
| 0–39   | Disqualify → soft-redirect + downsell   | No capital or no timeline          |
| 40–64  | Setting team (standard setters, 15-min) | Qualified, needs warming           |
| 65–84  | Lane 1 (priority / closer track)        | Strong, ready to move              |
| 85–100 | Top closers                             | Best — capital + urgency both high |

## Thank-you states (by score)

- **85–100 · Perfect fit** — "You're a perfect fit for vending." CTA: _Book my call_
- **65–84 · Strong fit** — "You're a strong fit to launch." CTA: _Book my call_
- **40–64 · Good potential** — "You're in a good spot to start." CTA: _Book my 15-min call_
- **0–39 · Not the right time yet** — "Now may not be the best time to launch a business." CTA: _Get the 90-Day Guide_ · secondary: _Book a readiness session_

## Gap analysis vs. current code

Present today: question types (text/dropdown/consent/multi-select-ish), session capture, single redirect, Close sync.
**Missing (all new):** point scoring engine · A/B variant selection + capture · score→band routing · disqualify/downsell path · 4 conditional thank-you states · post-submission optional multi-selects · two-window form structure · per-page starting copy.

## Slices + status

1. **✅ DONE — Scoring core** (`src/lib/qualification/scoring.ts` + tests, 18 tests).
   - `scoreQualification({timeline, invest, variant})` → points/total/band/disqualified/thankYouState
   - `assignInvestVariant(seed)` → deterministic 50/50 A/B
   - `deriveQualificationScore(normalizedSummary, variantKey)` → ScoreResult | null (the bridge)
   - `THANK_YOU_STATES` copy for all 4 states. Data-driven tables.
2. **TODO — Question schema (data, not code):** author a published `qualification_forms` version whose questions use existing types — timeline = `single_choice` (normalizedRole `timeline`), invest = `single_choice` (normalizedRole `available_capital`), optional multi-selects = `multiple_choice`. **Option `value`s MUST equal the scoring engine values** (`asap`/`few_weeks`/`1_3_months`/`unsure`; `lt_3k`/`3_5k`/… or `10_15k_cash`/…). Consent pair = two `consent` questions (or a new type).
3. **TODO — Two-window flow:** current forms are single-step (`PublicLeadForm` intent=qualification: name/email/phone only) OR one-question-per-screen (`QualificationRuntime`). Need to group into 2 pages. Decide: page-group `QualificationRuntime` vs a new two-step intake.
4. **TODO — Wire scoring into completion + Close.** Seam: `completeQualificationSession` (`src/lib/services/qualification-sessions.ts` ~L214) after `buildNormalizedSummary`: call `deriveQualificationScore(normalizedSummary, session.variant_key)`, put score/band into the result + the `enqueueQualificationEnrichment` payload (~L407). Close: add `CLOSE_QUALIFICATION_SCORE_FIELD_ID`/`_BAND_FIELD_ID` (`src/lib/config.ts` ~L121-178) + map in `qualificationCustomFields()` (`src/lib/close/sync.ts` ~L628). A/B: assign `variant_key` via `assignInvestVariant(session id)` at session creation (`src/lib/services/qualification-intake.ts` ~L319/L360).
5. **TODO — 4 thank-you states + disqualify path + FIX /thank-you 404.** `safeCompletionRedirect` defaults to `/thank-you` which **does not exist** (only `/thank-you-for-applying`). Build the thank-you route to render one of `THANK_YOU_STATES[band]` (pass band via the redirect / a session field). Disqualify → 90-Day Guide asset + readiness-call secondary.
6. **TODO — Post-submission optional multi-selects** ("below the booking/asset"): new step after `completeAction` succeeds, before final navigation (`QualificationRuntime` `CompletionPanel` is terminal today).
7. **TODO — Per-page starting copy** (3 form-text options) wired per SEO-page lead block.

### Default decisions made (flag to change)

- Variant B: 5-rung scoring table is authoritative.
- A/B: random 50/50 per session via `assignInvestVariant(session id)`, stored in `variant_key` (already an end-to-end column/Close-field/hidden-field).
- Disqualify downsell → existing 90-Day Guide asset; secondary → readiness call.
- Score/band written to lead + Close (new field) — falls back to DB-only if no Close field mapped.

### Real entry point

The two-window qualification flow ships through **SEO page-builder lead blocks** (`ResourcePageRenderer`), NOT the legacy `[legacyLeadPath]` conversion pages (those use single-step `PublicLeadForm` intent=apply and bypass qualification).

## Open questions for Kody

1. Variant B top rung ($10–15k cash) — in scoring table but not form list. Which is canonical?
2. A/B split mechanism — random 50/50, or per-page/campaign assignment? Where is the variant recorded (for later analysis)?
3. Disqualify "soft-redirect + downsell" — target URL / asset?
4. Does the band routing need to write a specific field into Close (so setters/closers see the lane)?
