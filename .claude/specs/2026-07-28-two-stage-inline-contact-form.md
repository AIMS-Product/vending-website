# Two-stage inline /contact form (no page change)

Decided 2026-07-28. Kody: "split the current form — start is the contact
details, second stage is the timing and finance questions." Adam approved.
Nothing here is an open question; build it as written.

Tier-1: this is the live lead funnel on a production site taking real leads.
Use `safe-feature-slice`. Verify on a preview deployment before `main`.

---

## What changes for a visitor

Today `/contact` is one submit: name, email, phone, two consents, timeline,
invest — all at once, then the fit result renders in place.

After this: **stage 1** is name, email, phone and both consents. On submit the
lead is captured. **Stage 2** replaces the fields in place — same card, no
navigation, no page load — with the timeline and invest questions. On submit the
answers score and the existing fit-result panel renders, exactly as now.

Consents stay in stage 1. They are permission to contact, and the lead becomes
contactable at the end of stage 1, so they cannot sit behind a second submit.

## Why it is worth doing

The lead is persisted at the end of stage 1 instead of only after all six
fields. Someone who abandons at the questions is still a lead we can call.

It also makes the funnel measurable. `/admin/analytics` has an "offered the
questions → started questions" step that is structurally always 100% today,
because one submit writes both. After this it reports something real. See §4 of
`2026-07-28-analytics-and-tracking-handoff.md`.

## Scope boundary

**In:** `/contact` and its three clones (`/booking-youtube`, `/booking-meta`,
and page-builder `lead_form` blocks with `intent="qualification"`).

**Out:** the four social-ad booking pages (`/booking-t5-socials`,
`/booking-b5-socials`, `/booking-ak-t5`, `/booking-ak-b5`). They use
`BookingForm`, contact-only, straight to Calendly. Untouched.

**Out:** the credit-score follow-up question. Kody and Joe have not decided it,
and it needs conditional-question support the form schema does not have (no
`visibleWhen`/`dependsOn` in `src/lib/qualification/forms.ts`). Do not build it
speculatively.

---

## Server

`src/lib/services/qualification-inline.ts` splits in two. Both new functions are
pure composition over the existing intake/session services, same as the current
one — no new persistence, scoring, or Close-sync logic.

```
startInlineQualification(contact + both consents)
  -> createQualificationIntakeSession({ ...input, variantKey: "A" })
  -> saveQualificationAnswer(consentUpdates)
  -> saveQualificationAnswer(consentContact)
  -> { status: "started", leadId, sessionToken }

finishInlineQualification({ sessionToken, timeline, invest, userAgent })
  -> saveQualificationAnswer(timeline)
  -> saveQualificationAnswer(invest)
  -> completeQualificationSession
  -> { status: "completed", thankYouState, score }
```

Keep `submitInlineQualification` as `start` then `finish`, so the one-shot path
and the staged path cannot drift. Its tests stay green unchanged — that is the
regression net for this refactor.

Carry over from the current function: the null-score guard
(`thankYouState == null || score == null` → `QualificationSessionValidationError`
on timeline/invest) belongs in `finish`.

### The session token

`startInlineQualification` returns the raw session token to the browser, which
the current design deliberately avoids. That is acceptable here and no weaker
than what already ships: the standalone `/qualify/[sessionToken]` route puts the
same token in the URL bar. Stage 2 posts it back in a hidden field.

Do **not** put the lead id in a hidden field. Stage 2 must identify the session
by token only — a lead id in the DOM would let anyone post answers against
someone else's lead.

## Server actions

`src/app/qualification-intake/actions.ts` gains two actions matching the
existing `useActionState` shape. On success, the start action's state must carry
`sessionToken` so the client can hand it to stage 2.

## Client

`PublicLeadForm` (882 lines, shared by every intent — booking pages, `/apply`,
builder blocks). Guard every change behind the existing
`showInlineQualificationFields` (`intent === "qualification" && inlineQualification`)
so no other caller changes behaviour.

- Second `useActionState` for the finish action, plus a `finishAction` prop.
- Stage is derived, not stored: stage 2 when the start action succeeded and
  returned a token. No separate `useState` to fall out of sync.
- Stage 1: first/last name, email, phone, both consents. Submit label from
  `applyQuiz.submitLabel` ("Submit").
- Stage 2: the timeline and invest `SelectField`s, the existing divider removed
  (it separated consents from questions, which are no longer adjacent).
- Stage 2 shows which person it is continuing for — the email from stage 1 — so
  the card does not read as a fresh empty form.
- Keep the `submittedValues` re-seed behaviour per stage: a validation failure in
  stage 2 must not wipe stage 2's selects.
- `FitResultPanel`, `BookingRedirectPanel`, `ContactSuccessPanel` are unchanged.

Copy for the stage-2 heading is Kody's to write. Ship with the existing
`applyQuiz.title` until he sends one; do not invent marketing copy.

## Tests

Write these first.

1. `qualification-inline.test.ts` — `start` persists the lead and both consents
   and returns a token; `finish` scores and completes. The existing
   `submitInlineQualification` cases stay untouched and must still pass.
2. `finish` with a token whose session is already completed → validation error,
   not a second scoring.
3. `PublicLeadForm.test.ts` — stage 1 renders no timeline/invest field; after a
   successful start the timeline/invest fields render and the name/email fields
   do not; a stage-2 validation error preserves the selected answers.
4. A stage-1 submit followed by an abandoned stage 2 leaves a lead row with
   `latest_qualification_started_at` set and no `completed_at` — this is the
   case the analytics funnel now measures.

## Verification before main

On a preview deployment, against the real Close org:

1. Complete both stages. One lead row, one Close contact, correct band and
   calendar for the score.
2. Abandon after stage 1. Lead row exists, is contactable, syncs to Close with
   consents and no timeline/capital. **Tell Stephen this is expected** — he will
   start seeing contacts with those fields blank, which today never happens.
3. Double-submit stage 1. Still one lead, one Close contact. The dedupe fix
   (`lib/close/dedupe.ts`, 2026-07-28) covers this; confirm it still holds.
4. `/admin/analytics` → Pages: "started questions" is now below "offered", not
   equal to it.

## Estimate

Half a day. The multi-step machinery already exists — `QualificationRuntime`
(605 lines, one question at a time, save-as-you-go, resume) was built for
`/qualify/[sessionToken]` and bypassed when the funnel was collapsed onto one
page in July. This spec does not reuse it: Kody asked for two stages, not
one-question-at-a-time, and staging the existing form is a smaller, lower-risk
change than embedding that runtime. Reach for it only if he later wants each
question on its own screen.
