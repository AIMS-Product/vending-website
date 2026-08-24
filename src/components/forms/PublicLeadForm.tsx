"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  initialLeadActionState,
  resolveLeadSuccessTransition,
  type LeadIntent,
  type PublicLeadActionState,
} from "@/app/lead-action-state";
import {
  deriveLeadErrorSummary,
  type LeadErrorSummaryItem,
} from "./lead-error-summary";
import {
  mergeLeadAttributionWithSession,
  parseAttributionSession,
  VP_ATTRIBUTION_STORAGE_KEY,
} from "@/lib/attribution-session";
import { CalendlyEmbed } from "@/components/embeds/CalendlyEmbed";
import { emitPopupConversionIfAttributed } from "@/lib/attribution-client";
import type { LeadAttribution } from "@/lib/lead-attribution";
import {
  buildCalendlyBookingUrl,
  isCalendlyUrl,
} from "@/lib/content/lead-embed";
import {
  bookingClickEvent,
  formStartEvent,
  leadQualifiedEvent,
  leadSubmitErrorEvent,
  leadSubmitEvent,
  pushDataLayerEvent,
} from "@/lib/tracking/lead-events";
import { US_STATES } from "@/lib/content/us-states";
import {
  VP_BOTTLENECK_FIELD_OPTIONS,
  VP_BOTTLENECK_LABEL,
  VP_CONFIDENCE_FIELD_OPTIONS,
  VP_CONFIDENCE_LABEL,
  VP_CONSENT_CONTACT_LABEL,
  VP_CONSENT_UPDATES_LABEL,
  VP_INVEST_FIELD_OPTIONS,
  VP_INVEST_LABEL,
  VP_INVEST_OPERATOR_FIELD_OPTIONS,
  VP_INVEST_OPERATOR_LABEL,
  VP_OPERATOR_FIELD_OPTIONS,
  VP_OPERATOR_LABEL,
  VP_PERSONA_FIELD_OPTIONS,
  VP_PERSONA_LABEL,
  VP_QUESTION_IDS,
  VP_TIMELINE_FIELD_OPTIONS,
  VP_TIMELINE_LABEL,
  type VpFieldOption,
} from "@/lib/qualification/vp-fields";
import {
  THANK_YOU_STATES,
  type ThankYouStateKey,
} from "@/lib/qualification/scoring";
import {
  THANK_YOU_LINKS,
  THANK_YOU_STATE_LINKS,
} from "@/lib/qualification/thank-you-links";
import { cn } from "@/lib/utils";

type PublicLeadFormProps = {
  action: PublicLeadFormAction;
  attribution: LeadAttribution;
  hiddenFields?: Record<string, string | null | undefined>;
  idempotencyKey: string;
  submitLabel: string;
  intent: LeadIntent;
  layout?: "standard" | "compact";
  // Optional Calendly scheduling link. When set, a successful submission hands
  // the lead off to Calendly (name/email pre-filled, UTM carried through) so
  // they can pick a time — the lead is already captured in the CRM by then.
  bookingRedirectUrl?: string;
  // Gates the inline /contact qualification funnel: renders the consent +
  // timeline + invest questions inline (intent="qualification" only) and,
  // on success, replaces the form with a FitResultPanel instead of
  // navigating to /qualify or /thank-you. Other qualification embeds
  // (/vp-quiz, resource page blocks) omit this and keep today's redirect
  // handoff.
  inlineQualification?: boolean;
  // Splits the inline qualification form in two. Stage 1 collects the contact
  // details and both consents (the lead is captured there, so someone who
  // leaves is still contactable); stage 2 replaces those fields in the same
  // card with the Form V2 question stepper (operator gate, then the Operator
  // or Standard path one question at a time) and posts the answers to this
  // action, identified by the session token stage 1 returned. Without it the
  // form keeps the one-shot behaviour — there is nowhere for a stage 2 to
  // submit.
  finishAction?: PublicLeadFormAction;
  // Skips stage 2 entirely (the /book-now funnel, Kody 2026-08-10): once stage 1
  // has captured the contact details and both consents, this calendar replaces
  // the card instead of the timeline/invest questions. Nothing is scored and no
  // fit result is shown — every lead lands on the same calendar. Requires the
  // same inlineQualification + finishAction pairing as the scored funnel so
  // stage 1 behaves identically (lead persisted, Close synced, Slack alerted);
  // the finishAction simply never gets dispatched.
  bookingEmbedUrl?: string;
  // Simplified "Book Your Call" form (social-ad booking pages): renders only
  // name/email/phone — no qualifying dropdowns, no message, no scoring. Pair
  // with intent="contact" (validates name+email only) and bookingRedirectUrl so
  // the lead is captured with UTM attribution and then handed to Calendly.
  simpleContact?: boolean;
  // Mirrors the resolved qualification form's `contactPhoneRequired` so the
  // input renders as optional when the form says so. Presentation only — the
  // intake service re-checks the policy against the form it actually resolves.
  // Defaults to true: an embed that does not resolve a form keeps asking.
  phoneRequired?: boolean;
  // Override the initial action state. Production always uses the idle default;
  // this exists so SSR-rendered tests can exercise the field-error layer.
  initialState?: PublicLeadActionState;
  // Same escape hatch for the stage-2 action state and for the re-seeded
  // values. Production always starts idle and empty.
  initialFinishState?: PublicLeadActionState;
  initialSubmittedValues?: Record<string, string>;
};

export type PublicLeadFormAction = (
  prev: PublicLeadActionState,
  formData: FormData,
) => Promise<PublicLeadActionState>;

type FieldProps = {
  name: string;
  errorKey: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  errors?: Record<string, string[]>;
  // Last submitted values, keyed by field name. Re-seeds defaultValue after a
  // failed submit so the user does not lose what they typed.
  values?: Record<string, string>;
};

const inputClass =
  "min-h-12 w-full rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2d9fd6] focus:ring-2 focus:ring-[#55b8e8]";

// fallow-ignore-next-line complexity
export function PublicLeadForm({
  action,
  attribution,
  hiddenFields,
  idempotencyKey,
  submitLabel,
  intent,
  layout = "standard",
  bookingRedirectUrl,
  bookingEmbedUrl,
  inlineQualification = false,
  simpleContact = false,
  phoneRequired = true,
  finishAction,
  initialState = initialLeadActionState,
  initialFinishState = initialLeadActionState,
  initialSubmittedValues = {},
}: PublicLeadFormProps) {
  const router = useRouter();
  const [submittedValues, setSubmittedValues] = useState<
    Record<string, string>
  >(initialSubmittedValues);

  const [state, dispatch, pending] = useActionState(action, initialState);
  const [finishState, finishDispatch, finishPending] = useActionState(
    finishAction ?? noopLeadAction,
    initialFinishState,
  );

  // Capture the submitted values before delegating to the server action. React
  // resets uncontrolled inputs once a form action resolves, so on a validation
  // failure we re-seed each field's defaultValue from this snapshot to preserve
  // what the user typed. The email is also surfaced in the contact success
  // panel. This runs in the submit event, not during render, and the wrapper
  // returns the action's value unchanged, so the {success/error} contract is
  // untouched.
  const formAction = (formData: FormData) => {
    mergeStoredAttributionIntoFormData(formData, attribution);
    // Window 1 collects first + last name; combine them into the single
    // full_name the intake service validates and stores.
    if (intent === "qualification") {
      const first = readTrimmed(formData, "first_name");
      const last = readTrimmed(formData, "last_name");
      const combined = [first, last].filter(Boolean).join(" ");
      if (combined) formData.set("full_name", combined);
    }
    setSubmittedValues((previous) => mergeSubmitted(previous, formData));
    return dispatch(formData);
  };

  // Stage 2 of the two-stage funnel. Merging rather than replacing keeps the
  // stage-1 email (used to say who the card is continuing for) alongside the
  // stage-2 answers, so a validation failure re-seeds both.
  const finishFormAction = (formData: FormData) => {
    setSubmittedValues((previous) => mergeSubmitted(previous, formData));
    return finishDispatch(formData);
  };

  const isQualification = intent === "qualification";
  const showInlineQualificationFields = isQualification && inlineQualification;
  // Two stages need somewhere for stage 2 to submit, so the split is on
  // exactly when a finishAction is supplied. Every other caller of this
  // component — including inline qualification without one — is untouched.
  const isTwoStage = showInlineQualificationFields && Boolean(finishAction);
  const startedSessionToken =
    state.status === "success" ? state.sessionToken : undefined;
  // Derived, not stored: stage 2 is simply "the start action came back with a
  // token". There is no second piece of state to fall out of sync.
  const atStageTwo = isTwoStage && Boolean(startedSessionToken);
  // Whichever stage is on screen owns the errors, the pending flag and the
  // success transition. In one-stage mode this is the only action state there
  // has ever been.
  const activeState = atStageTwo ? finishState : state;
  const activePending = atStageTwo ? finishPending : pending;
  const submittedEmail = submittedValues.email ?? "";

  // When a Calendly handoff is configured, a successful submit sends the lead
  // straight to the scheduler (name/email pre-filled) instead of the internal
  // thank-you page or success panel. Calendly is a different origin, so this is
  // a full-page navigation, not a client-router push. This takes precedence
  // over the internal transition below.
  const bookingHref =
    activeState.status === "success" && bookingRedirectUrl
      ? buildCalendlyBookingUrl(bookingRedirectUrl, {
          name: submittedValues.full_name,
          email: submittedValues.email,
          attribution,
        })
      : undefined;

  const transition = bookingHref
    ? null
    : resolveLeadSuccessTransition(activeState, intent, submittedEmail);
  const redirectHref =
    transition?.kind === "redirect" ? transition.href : undefined;

  // Apply submissions navigate to a dedicated thank-you page. Navigation is a
  // true external side-effect, so it belongs in an effect rather than render.
  useEffect(() => {
    if (redirectHref) {
      router.push(redirectHref);
    }
  }, [redirectHref, router]);

  // Hand off to Calendly on a successful submit when configured.
  useEffect(() => {
    if (bookingHref) {
      window.location.assign(bookingHref);
    }
  }, [bookingHref]);

  // GTM dataLayer events. Guarded by a ref holding the last state object we
  // already pushed for, so a re-render that does not carry a new action
  // result (e.g. typing after a failed submit) never double-fires — and
  // React 19 strict-mode's double-invoked effects in dev never double-fire
  // either, since both invocations see the same `state` reference.
  const stage1TrackedRef = useRef<PublicLeadActionState | null>(null);
  useEffect(() => {
    if (stage1TrackedRef.current === state) return;
    stage1TrackedRef.current = state;
    if (state.status === "success") {
      // Credits the popup whose CTA drove this visit (no-op otherwise);
      // feeds the Converted tile in /admin/popups.
      emitPopupConversionIfAttributed({ lead_intent: intent });
      pushDataLayerEvent(
        leadSubmitEvent(attribution, intent, 1, {
          leadEmail: submittedValues.email ?? "",
          leadPhone: submittedValues.phone ?? "",
          idempotencyKey,
        }),
      );
      if (state.qualification) {
        pushDataLayerEvent(
          leadQualifiedEvent(attribution, intent, 1, {
            leadEmail: submittedValues.email ?? "",
            leadPhone: submittedValues.phone ?? "",
            idempotencyKey,
            qualificationState: state.qualification.thankYouState,
            qualificationScore: state.qualification.score,
          }),
        );
      }
    } else if (state.status === "error") {
      pushDataLayerEvent(
        leadSubmitErrorEvent(
          attribution,
          intent,
          1,
          deriveLeadErrorSummary(state).map((item) => item.errorKey),
        ),
      );
    }
  }, [state, attribution, intent, idempotencyKey, submittedValues]);

  // Same guard for stage 2. When there is no finishAction, finishState never
  // leaves "idle" so this never fires.
  const stage2TrackedRef = useRef<PublicLeadActionState | null>(null);
  useEffect(() => {
    if (stage2TrackedRef.current === finishState) return;
    stage2TrackedRef.current = finishState;
    if (finishState.status === "success" && finishState.qualification) {
      pushDataLayerEvent(
        leadQualifiedEvent(attribution, intent, 2, {
          leadEmail: submittedValues.email ?? "",
          leadPhone: submittedValues.phone ?? "",
          idempotencyKey,
          qualificationState: finishState.qualification.thankYouState,
          qualificationScore: finishState.qualification.score,
        }),
      );
    } else if (finishState.status === "error") {
      pushDataLayerEvent(
        leadSubmitErrorEvent(
          attribution,
          intent,
          2,
          deriveLeadErrorSummary(finishState).map((item) => item.errorKey),
        ),
      );
    }
  }, [finishState, attribution, intent, idempotencyKey, submittedValues]);

  // Fires once per step on first field interaction, so GTM can tell "started
  // typing" apart from "submitted". onFocusCapture (not onFocus) sees every
  // descendant's focus event, including inputs that never bubble focus.
  const stage1StartedRef = useRef(false);
  const handleStage1FocusCapture = () => {
    if (stage1StartedRef.current) return;
    stage1StartedRef.current = true;
    pushDataLayerEvent(formStartEvent(attribution, intent, 1));
  };
  const stage2StartedRef = useRef(false);
  const handleStage2FocusCapture = () => {
    if (stage2StartedRef.current) return;
    stage2StartedRef.current = true;
    pushDataLayerEvent(formStartEvent(attribution, intent, 2));
  };

  const errors =
    activeState.status === "error" ? activeState.fieldErrors : undefined;
  const summaryItems = deriveLeadErrorSummary(activeState);
  const hasSummary = summaryItems.length > 0;
  const summaryRef = useRef<HTMLDivElement>(null);

  // Move keyboard/SR focus to the error summary the moment it appears after a
  // failed submit. Keyed on the summary count + first key so re-submitting a
  // still-invalid form re-focuses the summary.
  const summarySignature = summaryItems.map((item) => item.errorKey).join(",");
  useEffect(() => {
    if (hasSummary) summaryRef.current?.focus();
  }, [hasSummary, summarySignature]);

  const isApply = intent === "apply";
  const isCompact = layout === "compact";
  // simpleContact forces the lean booking form (name/email/phone only), so it
  // suppresses the city/state/message block and the qualification dropdowns.
  const showQualificationFields =
    isApply || (!isCompact && !isQualification && !simpleContact);
  const showPhoneField =
    isQualification || showQualificationFields || simpleContact;
  // The timeline/invest questions sit alongside the consents only on the
  // one-shot form; the two-stage form holds them back for stage 2.
  const showInlineQuestions = showInlineQualificationFields && !isTwoStage;

  if (bookingHref) {
    return <BookingRedirectPanel />;
  }

  if (transition?.kind === "panel") {
    return <ContactSuccessPanel email={transition.email} />;
  }

  if (transition?.kind === "qualification-result") {
    return (
      <FitResultPanel
        state={transition.state}
        score={transition.score}
        attribution={attribution}
        intent={intent}
        name={submittedValues.full_name}
        email={submittedValues.email}
      />
    );
  }

  // /book-now: stage 1 succeeded, so the lead is captured and opted in. Show
  // the calendar in place of the questions. Prefilled and UTM-tagged the same
  // way FitResultPanel does it, so the Calendly booking webhook still joins
  // back to this lead.
  if (atStageTwo && bookingEmbedUrl) {
    return (
      <div role="status" aria-live="polite" className="grid gap-4">
        <p className="inline-flex w-fit rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
          Details received — pick a time below
        </p>
        <CalendlyEmbed
          url={buildCalendlyBookingUrl(bookingEmbedUrl, {
            name: submittedValues.full_name,
            email: submittedValues.email,
            attribution,
          })}
          attribution={attribution}
          hideDetails
          title="Book your call"
        />
      </div>
    );
  }

  if (atStageTwo && startedSessionToken) {
    return (
      <QualificationQuestionsStage
        action={finishFormAction}
        sessionToken={startedSessionToken}
        email={submittedEmail}
        errors={errors}
        summaryItems={summaryItems}
        summaryRef={summaryRef}
        state={activeState}
        pending={activePending}
        submitLabel={submitLabel}
        values={submittedValues}
        compact={isCompact}
        onFieldFocus={handleStage2FocusCapture}
      />
    );
  }

  return (
    <form
      id={`lead-form-${intent}-step-1`}
      data-form-step="1"
      action={formAction}
      onFocusCapture={handleStage1FocusCapture}
      noValidate
      className={cn(
        "grid gap-5 rounded-[12px] border-2 border-[#111111] bg-white p-5 shadow-[8px_8px_0_#55b8e8]",
        !isCompact && "sm:p-7",
      )}
    >
      <HiddenAttribution
        attribution={attribution}
        hiddenFields={hiddenFields}
        idempotencyKey={idempotencyKey}
      />

      {hasSummary && (
        <LeadErrorSummary
          ref={summaryRef}
          items={summaryItems}
          fieldErrors={errors}
          intent={intent}
        />
      )}

      <div className={cn("grid gap-5", !isCompact && "sm:grid-cols-2")}>
        {isQualification ? (
          <>
            <TextField
              name="first_name"
              errorKey="firstName"
              label="First name"
              autoComplete="given-name"
              required
              errors={errors}
              values={submittedValues}
            />
            <TextField
              name="last_name"
              errorKey="lastName"
              label="Last name"
              autoComplete="family-name"
              required
              errors={errors}
              values={submittedValues}
            />
          </>
        ) : (
          <TextField
            name="full_name"
            errorKey="fullName"
            label="Name"
            autoComplete="name"
            required
            errors={errors}
            values={submittedValues}
          />
        )}
        <TextField
          name="email"
          errorKey="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          errors={errors}
          values={submittedValues}
        />
        {showPhoneField && (
          <TextField
            name="phone"
            errorKey="phone"
            label={
              isQualification && !phoneRequired ? "Phone (optional)" : "Phone"
            }
            type="tel"
            autoComplete="tel"
            required={(isQualification && phoneRequired) || simpleContact}
            errors={errors}
            values={submittedValues}
          />
        )}
        {showInlineQualificationFields && (
          <>
            <CheckboxField
              name={VP_QUESTION_IDS.consentUpdates}
              errorKey="consent_updates"
              label={VP_CONSENT_UPDATES_LABEL}
              required
              errors={errors}
              values={submittedValues}
            />
            <CheckboxField
              name={VP_QUESTION_IDS.consentContact}
              errorKey="consent_contact"
              label={VP_CONSENT_CONTACT_LABEL}
              required
              errors={errors}
              values={submittedValues}
            />
            {showInlineQuestions && (
              <>
                {/* Light divider separating the opt-in checks from the two
                    qualifying questions below (per Kody), with generous
                    spacing so the sections read as distinct groups. */}
                <div
                  data-testid="qualification-divider"
                  aria-hidden
                  className="mt-3 border-t border-slate-200 sm:col-span-2"
                />
                <QualificationQuestions
                  errors={errors}
                  values={submittedValues}
                />
              </>
            )}
          </>
        )}
        {showQualificationFields && (
          <>
            <TextField
              name="city"
              errorKey="city"
              label="City"
              autoComplete="address-level2"
              errors={errors}
              values={submittedValues}
            />
            {/* State renders as the same dropdown on both forms; only
                /apply requires it (matching server-side validation). */}
            <SelectField
              name="state_region"
              errorKey="stateRegion"
              label="State"
              required={isApply}
              errors={errors}
              values={submittedValues}
              options={US_STATES}
            />
            {isApply && (
              <>
                <SelectField
                  name="business_stage"
                  errorKey="businessStage"
                  label="Business stage"
                  required
                  errors={errors}
                  values={submittedValues}
                  options={[
                    "Researching vending",
                    "Buying first machine",
                    "Already operating",
                    "Scaling locations",
                    "Not sure yet",
                  ]}
                />
                <SelectField
                  name="budget"
                  errorKey="budget"
                  label="Available startup budget"
                  required
                  errors={errors}
                  values={submittedValues}
                  options={[
                    "Under $5k",
                    "$5k-$10k",
                    "$10k-$25k",
                    "$25k+",
                    "Not sure yet",
                  ]}
                />
                <SelectField
                  name="timeline"
                  errorKey="timeline"
                  label="Launch timeline"
                  required
                  errors={errors}
                  values={submittedValues}
                  options={[
                    "Immediately",
                    "Next 30 days",
                    "Next 90 days",
                    "Still deciding",
                    "Not sure yet",
                  ]}
                />
              </>
            )}
          </>
        )}
      </div>

      {showQualificationFields && (
        <TextareaField
          name="message"
          errorKey="message"
          label={isApply ? "What are you trying to build?" : "Message"}
          required={!isApply}
          errors={errors}
          values={submittedValues}
        />
      )}

      <SubmitRow
        pending={activePending}
        submitLabel={submitLabel}
        state={activeState}
        muted={hasSummary}
        dataGtm={`lead-form-submit-${intent}-step-1`}
      />

      <PrivacyAssurance intent={intent} />
    </form>
  );
}

// The Form V2 stage-2 question catalog (Kody, 2026-08-14). The gate question
// picks the path: "yes" → the leaner Operator set, "no" → the Standard set.
// Copy and option values live in vp-fields.ts; the invest question is the
// same stored question on both paths, worded around deploying capital for
// operators.
type VpStage2Question = {
  id: string;
  label: string;
  options: readonly VpFieldOption[];
};

const VP_GATE_QUESTION: VpStage2Question = {
  id: VP_QUESTION_IDS.operator,
  label: VP_OPERATOR_LABEL,
  options: VP_OPERATOR_FIELD_OPTIONS,
};

const VP_OPERATOR_PATH: readonly VpStage2Question[] = [
  {
    id: VP_QUESTION_IDS.bottleneck,
    label: VP_BOTTLENECK_LABEL,
    options: VP_BOTTLENECK_FIELD_OPTIONS,
  },
  {
    id: VP_QUESTION_IDS.invest,
    label: VP_INVEST_OPERATOR_LABEL,
    options: VP_INVEST_OPERATOR_FIELD_OPTIONS,
  },
];

const VP_STANDARD_PATH: readonly VpStage2Question[] = [
  {
    id: VP_QUESTION_IDS.persona,
    label: VP_PERSONA_LABEL,
    options: VP_PERSONA_FIELD_OPTIONS,
  },
  {
    id: VP_QUESTION_IDS.confidence,
    label: VP_CONFIDENCE_LABEL,
    options: VP_CONFIDENCE_FIELD_OPTIONS,
  },
  {
    id: VP_QUESTION_IDS.timeline,
    label: VP_TIMELINE_LABEL,
    options: VP_TIMELINE_FIELD_OPTIONS,
  },
  {
    id: VP_QUESTION_IDS.invest,
    label: VP_INVEST_LABEL,
    options: VP_INVEST_FIELD_OPTIONS,
  },
];

function vpStage2Questions(
  gateAnswer: string | undefined,
): readonly VpStage2Question[] {
  if (gateAnswer === "yes") return [VP_GATE_QUESTION, ...VP_OPERATOR_PATH];
  if (gateAnswer === "no") return [VP_GATE_QUESTION, ...VP_STANDARD_PATH];
  return [VP_GATE_QUESTION];
}

/**
 * Stage 2 of the two-stage inline funnel: the same card, with the contact
 * fields swapped for the Form V2 stepper — one question at a time with every
 * answer visible (per Kody, 2026-08-14). Picking an answer advances to the
 * next question in the path; the final answer arms the submit button, which
 * posts every recorded answer. No navigation, no page load — the lead was
 * already captured by stage 1. The session is identified by the token stage 1
 * returned and nothing else; a lead id in the DOM would let anyone post
 * answers against someone else's lead.
 */
function QualificationQuestionsStage({
  action,
  sessionToken,
  email,
  errors,
  summaryItems,
  summaryRef,
  state,
  pending,
  submitLabel,
  values,
  compact,
  onFieldFocus,
}: {
  action: (formData: FormData) => void;
  sessionToken: string;
  email: string;
  errors?: Record<string, string[]>;
  summaryItems: LeadErrorSummaryItem[];
  summaryRef: React.Ref<HTMLDivElement>;
  state: PublicLeadActionState;
  pending: boolean;
  submitLabel: string;
  values: Record<string, string>;
  compact: boolean;
  onFieldFocus: () => void;
}) {
  const hasSummary = summaryItems.length > 0;
  // Answers live in state (not uncontrolled inputs), so they survive the
  // action-resolve reset and re-render as hidden inputs on every step. The
  // SSR-test escape hatch (initialSubmittedValues) seeds them.
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    seedStage2Answers(values),
  );
  const [stepIndex, setStepIndex] = useState(0);

  const questions = vpStage2Questions(answers[VP_QUESTION_IDS.operator]);
  const question = questions[Math.min(stepIndex, questions.length - 1)];
  // The gate is never last: until it is answered the path is unknown, and
  // answering it always reveals the path's questions.
  const isLast = questions.length > 1 && stepIndex >= questions.length - 1;
  const answered = answers[question.id];
  const questionError = errors?.[question.id]?.[0];

  // After a failed submit, jump back to the first question the server
  // flagged so the visitor can fix it. Render-phase state adjustment (the
  // React-documented alternative to setState-in-effect), guarded on the
  // action-state identity so only a new result triggers one jump.
  const [jumpedForState, setJumpedForState] =
    useState<PublicLeadActionState | null>(null);
  if (jumpedForState !== state) {
    setJumpedForState(state);
    if (state.status === "error" && state.fieldErrors) {
      const fieldErrors = state.fieldErrors;
      const errorIndex = questions.findIndex(
        (candidate) => (fieldErrors[candidate.id]?.length ?? 0) > 0,
      );
      if (errorIndex >= 0 && errorIndex !== stepIndex) {
        setStepIndex(errorIndex);
      }
    }
  }

  const selectOption = (value: string) => {
    setAnswers((previous) => {
      // Changing the gate answer switches paths, so the other path's answers
      // no longer apply — drop everything but the new gate answer.
      if (
        question.id === VP_QUESTION_IDS.operator &&
        previous[VP_QUESTION_IDS.operator] !== undefined &&
        previous[VP_QUESTION_IDS.operator] !== value
      ) {
        return { [VP_QUESTION_IDS.operator]: value };
      }
      return { ...previous, [question.id]: value };
    });
    if (!isLast) setStepIndex((index) => index + 1);
  };

  return (
    <form
      id="lead-form-qualification-step-2"
      data-form-step="2"
      data-question={question.id}
      action={action}
      onFocusCapture={onFieldFocus}
      noValidate
      className={cn(
        "grid gap-5 rounded-[12px] border-2 border-[#111111] bg-white p-5 shadow-[8px_8px_0_#55b8e8]",
        !compact && "sm:p-7",
      )}
    >
      <input type="hidden" name="session_token" value={sessionToken} />
      {Object.entries(answers).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="grid gap-1">
        <p className="inline-flex w-fit rounded-[8px] border-2 border-[#111111] bg-[#111111] px-3 py-1 text-xs font-black tracking-[0.08em] text-white uppercase">
          {questions.length > 1
            ? `Question ${Math.min(stepIndex, questions.length - 1) + 1} of ${questions.length}`
            : "Question 1"}
        </p>
        {email ? (
          <p className="text-sm font-semibold text-slate-600">
            Continuing for {email}
          </p>
        ) : null}
      </div>

      {hasSummary && (
        <LeadErrorSummary
          ref={summaryRef}
          items={summaryItems}
          fieldErrors={errors}
          intent="qualification"
        />
      )}

      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <p
            id={`lead-${question.id}-label`}
            className="text-lg leading-snug font-black text-[#111111]"
          >
            {question.label}
          </p>
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              className="shrink-0 text-sm font-bold text-slate-500 underline underline-offset-2 transition hover:text-slate-800"
            >
              Back
            </button>
          )}
        </div>

        <div
          id={`lead-${question.id}`}
          aria-labelledby={`lead-${question.id}-label`}
          className="grid gap-2.5"
        >
          {question.options.map((option) => {
            const selected = answered === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                data-gtm={`lead-form-qualification-${question.id}-${option.value}`}
                onClick={() => selectOption(option.value)}
                className={cn(
                  "min-h-12 rounded-[8px] border-2 border-[#111111] px-4 py-3 text-left text-base leading-snug font-bold transition focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none",
                  selected
                    ? "bg-[#111111] text-white shadow-[4px_4px_0_#55b8e8]"
                    : "bg-white text-slate-900 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#111111]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {questionError && (
          <p className="text-sm font-bold text-red-600">{questionError}</p>
        )}
      </div>

      {isLast && (
        <SubmitRow
          pending={pending}
          submitLabel={submitLabel}
          state={state}
          muted={hasSummary}
          dataGtm="lead-form-submit-qualification-step-2"
        />
      )}

      <PrivacyAssurance intent="qualification" />
    </form>
  );
}

// Seeds the stepper's answers from the SSR-test escape hatch / re-seeded
// submitted values, keeping only recognised stage-2 question ids.
function seedStage2Answers(
  values: Record<string, string>,
): Record<string, string> {
  const questionIds = new Set<string>([
    VP_QUESTION_IDS.operator,
    VP_QUESTION_IDS.persona,
    VP_QUESTION_IDS.confidence,
    VP_QUESTION_IDS.bottleneck,
    VP_QUESTION_IDS.timeline,
    VP_QUESTION_IDS.invest,
  ]);
  return Object.fromEntries(
    Object.entries(values).filter(
      ([name, value]) => questionIds.has(name) && value.length > 0,
    ),
  );
}

// The two scored questions. Shared verbatim by the one-shot form and stage 2
// so the two paths cannot drift on labels, options, or error keys.
function QualificationQuestions({
  errors,
  values,
}: {
  errors?: Record<string, string[]>;
  values: Record<string, string>;
}) {
  return (
    <div className="grid gap-7 sm:col-span-2">
      <SelectField
        name={VP_QUESTION_IDS.timeline}
        errorKey="timeline"
        label={VP_TIMELINE_LABEL}
        required
        errors={errors}
        values={values}
        options={VP_TIMELINE_FIELD_OPTIONS}
      />
      <SelectField
        name={VP_QUESTION_IDS.invest}
        errorKey="invest"
        label={VP_INVEST_LABEL}
        required
        errors={errors}
        values={values}
        options={VP_INVEST_FIELD_OPTIONS}
      />
    </div>
  );
}

function SubmitRow({
  pending,
  submitLabel,
  state,
  muted,
  dataGtm,
}: {
  pending: boolean;
  submitLabel: string;
  state: PublicLeadActionState;
  muted: boolean;
  dataGtm: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="submit"
        disabled={pending}
        data-gtm={dataGtm}
        className="inline-flex min-h-12 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#2a8fcc] px-7 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Submitting..." : submitLabel}
      </button>

      <ActionMessage state={state} muted={muted} />
    </div>
  );
}

/**
 * Snapshot of what was just submitted, merged over what came before. React
 * resets uncontrolled inputs once a form action resolves, so each field's
 * defaultValue is re-seeded from this on a validation failure. Merging (rather
 * than replacing) is what lets stage 2 keep the stage-1 email while still
 * preserving its own selects.
 */
function mergeSubmitted(
  previous: Record<string, string>,
  formData: FormData,
): Record<string, string> {
  const values: Record<string, string> = { ...previous };
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

// Keeps the stage-2 useActionState hook unconditional when no finishAction is
// supplied. It is never dispatched: without a finishAction there is no stage 2.
const noopLeadAction: PublicLeadFormAction = async (prev) => prev;

function readTrimmed(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function mergeStoredAttributionIntoFormData(
  formData: FormData,
  attribution: LeadAttribution,
) {
  try {
    const submittedAttribution = { ...attribution };
    for (const name of Object.keys(attribution) as Array<
      keyof LeadAttribution
    >) {
      const value = formData.get(name);
      if (typeof value === "string") submittedAttribution[name] = value;
    }
    const merged = mergeLeadAttributionWithSession(
      submittedAttribution,
      parseAttributionSession(
        window.localStorage.getItem(VP_ATTRIBUTION_STORAGE_KEY),
      ),
    );
    for (const [name, value] of Object.entries(merged)) {
      formData.set(name, value);
    }
  } catch {
    return;
  }
}

function PrivacyAssurance({ intent }: { intent: LeadIntent }) {
  const lead = privacyLeadCopy[intent];
  return (
    <p className="text-xs leading-5 font-medium text-slate-500">
      {lead}{" "}
      <Link
        href="/privacy"
        className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900"
      >
        Privacy Policy
      </Link>
      . We never sell your data.
    </p>
  );
}

const privacyLeadCopy: Record<LeadIntent, string> = {
  apply: "By applying you agree to our",
  contact: "By sending this note you agree to our",
  qualification: "By continuing you agree to our",
};

function LeadErrorSummary({
  ref,
  items,
  fieldErrors,
  intent,
}: {
  ref: React.Ref<HTMLDivElement>;
  items: LeadErrorSummaryItem[];
  fieldErrors?: Record<string, string[]>;
  intent: LeadIntent;
}) {
  const noun =
    intent === "apply"
      ? "application"
      : intent === "qualification"
        ? "qualification step"
        : "message";
  const count = items.length;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="grid gap-2 rounded-[8px] border-2 border-red-300 bg-red-50 p-4 outline-none focus-visible:ring-2 focus-visible:ring-red-300"
    >
      <p className="text-sm font-bold text-red-700">
        {count === 1
          ? `There is 1 problem with your ${noun}`
          : `There are ${count} problems with your ${noun}`}
      </p>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item.errorKey}>
            <a
              href={`#${item.inputId}`}
              className="text-sm font-semibold text-red-700 underline underline-offset-2 hover:text-red-800"
            >
              {item.label}: {fieldErrors?.[item.errorKey]?.[0]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BookingRedirectPanel() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid gap-4 rounded-[12px] border-2 border-[#111111] bg-white p-7 shadow-[8px_8px_0_#55b8e8]"
    >
      <p className="inline-flex w-fit rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
        Details received
      </p>
      <h3 className="text-2xl font-black text-[#111111] uppercase">
        Taking you to book your call...
      </h3>
      <p className="text-base leading-7 font-semibold text-slate-700">
        We&apos;ve got your details. You&apos;re being redirected to pick a time
        that works for you. If nothing happens, refresh this page.
      </p>
    </div>
  );
}

function ContactSuccessPanel({ email }: { email: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid gap-4 rounded-[12px] border-2 border-[#111111] bg-white p-7 shadow-[8px_8px_0_#55b8e8]"
    >
      <p className="inline-flex w-fit rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
        Message sent
      </p>
      <h3 className="text-2xl font-black text-[#111111] uppercase">
        Thanks. We have your message.
      </h3>
      <p className="text-base leading-7 font-semibold text-slate-700">
        {email
          ? `The team will follow up at ${email} shortly.`
          : "The team will follow up shortly."}
      </p>
    </div>
  );
}

// Renders the scored fit result inline after a successful inline
// qualification submit — no navigation to /qualify or /thank-you. Copy comes
// from THANK_YOU_STATES and links from THANK_YOU_STATE_LINKS
// (src/lib/qualification/*, shared with the /thank-you route) so the two
// surfaces never drift. Each band books its own Calendly (setter / Lane 1 /
// Lane 1 top); not-right-time leads download the 90-Day Roadmap first, with a
// book-a-call subtext fallback.
function FitResultPanel({
  state,
  score,
  attribution,
  intent,
  name,
  email,
}: {
  state: ThankYouStateKey;
  score: number;
  attribution: LeadAttribution;
  intent: LeadIntent;
  name?: string;
  email?: string;
}) {
  const content = THANK_YOU_STATES[state];
  const links = THANK_YOU_STATE_LINKS[state];
  // Calendly links get name/email/UTM prefilled so the booking stays
  // attributed to the same lead and campaign; the roadmap PDF link (the
  // not-right-time primary CTA) is not a Calendly URL and passes through
  // unchanged.
  const resolveHref = (href: string) =>
    isCalendlyUrl(href)
      ? buildCalendlyBookingUrl(href, { name, email, attribution })
      : href;
  const primaryHref = resolveHref(THANK_YOU_LINKS[links.primary]);

  // The three call-worthy bands skip the fit message and put the band's
  // calendar straight in view (per Kody, 2026-08-07): the visitor books
  // without leaving the page. name/email are prefilled via primaryHref and
  // CalendlyEmbed appends UTM attribution, so the booking webhook still joins
  // back to the lead. Disqualified leads keep the roadmap downsell below.
  if (state !== "not_right_time" && isCalendlyUrl(primaryHref)) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-qualification-state={state}
        data-qualification-score={score}
        className="grid gap-4"
      >
        <p className="inline-flex w-fit rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
          {content.label} — pick a time below
        </p>
        <CalendlyEmbed
          url={primaryHref}
          attribution={attribution}
          hideDetails
          title={content.cta}
        />
      </div>
    );
  }
  const secondaryHref =
    content.secondaryCta && links.secondary
      ? resolveHref(THANK_YOU_LINKS[links.secondary])
      : undefined;
  const trackBookingClick = (href: string) => () =>
    pushDataLayerEvent(
      bookingClickEvent(attribution, intent, {
        bookingHref: href,
        qualificationState: state,
      }),
    );
  return (
    <div
      role="status"
      aria-live="polite"
      data-qualification-state={state}
      data-qualification-score={score}
      className="grid gap-4 rounded-[12px] border-2 border-[#111111] bg-white p-7 shadow-[8px_8px_0_#55b8e8]"
    >
      <p className="inline-flex w-fit rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
        {content.label}
      </p>
      <h3 className="text-2xl font-black text-[#111111] uppercase">
        {content.headline}
      </h3>
      <p className="text-base leading-7 font-semibold text-slate-700">
        {content.body}
      </p>
      <a
        href={primaryHref}
        data-gtm="lead-form-booking-primary"
        onClick={trackBookingClick(primaryHref)}
        className="inline-flex min-h-12 w-fit items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#2a8fcc] px-7 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {content.cta}
      </a>
      {secondaryHref && content.secondaryCta && (
        <p className="text-sm font-semibold text-slate-600">
          {content.secondaryNote ? `${content.secondaryNote} ` : null}
          <a
            href={secondaryHref}
            data-gtm="lead-form-booking-secondary"
            onClick={trackBookingClick(secondaryHref)}
            className="font-black text-[#066a99] underline underline-offset-2 hover:text-[#111111]"
          >
            {content.secondaryCta}
          </a>
        </p>
      )}
    </div>
  );
}

function HiddenAttribution({
  attribution,
  hiddenFields,
  idempotencyKey,
}: {
  attribution: LeadAttribution;
  hiddenFields?: Record<string, string | null | undefined>;
  idempotencyKey: string;
}) {
  return (
    <>
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      {Object.entries(hiddenFields ?? {}).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      {Object.entries(attribution).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function FieldLabel({
  id,
  label,
  required,
}: {
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="text-sm font-medium text-slate-700">
      {label}
      {required ? (
        <>
          <span className="ml-0.5 text-[#c2410c]" aria-hidden>
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : (
        <span className="ml-1 font-normal text-slate-600"> (optional)</span>
      )}
    </label>
  );
}

function TextField({
  name,
  errorKey,
  label,
  type = "text",
  required,
  autoComplete,
  placeholder,
  errors,
  values,
}: FieldProps) {
  const error = errors?.[errorKey]?.[0];
  const id = `lead-${name}`;
  return (
    <div className="space-y-2">
      <FieldLabel id={id} label={label} required={required} />
      <input
        id={id}
        name={name}
        aria-label={label}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={values?.[name] ?? ""}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, error && "border-red-300 focus:ring-red-200")}
      />
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

type SelectFieldOption =
  | string
  | { readonly value: string; readonly label: string };

function SelectField({
  name,
  errorKey,
  label,
  required,
  options,
  errors,
  values,
}: FieldProps & { options: readonly SelectFieldOption[] }) {
  const error = errors?.[errorKey]?.[0];
  const id = `lead-${name}`;
  return (
    <div className="space-y-2">
      <FieldLabel id={id} label={label} required={required} />
      <select
        id={id}
        name={name}
        aria-label={label}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, error && "border-red-300 focus:ring-red-200")}
        defaultValue={values?.[name] ?? ""}
      >
        <option value="" disabled>
          Select
        </option>
        {options.map((option) => {
          const optionValue =
            typeof option === "string" ? option : option.value;
          const optionLabel =
            typeof option === "string" ? option : option.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

function CheckboxField({
  name,
  errorKey,
  label,
  required,
  errors,
  values,
}: FieldProps) {
  const error = errors?.[errorKey]?.[0];
  const id = `lead-${name}`;
  return (
    <div className="space-y-2 sm:col-span-2">
      <label htmlFor={id} className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          value="true"
          required={required}
          defaultChecked={values?.[name] === "true"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "mt-0.5 size-5 shrink-0 rounded-[4px] border-2 border-[#111111] text-[#0b63f6] focus:ring-2 focus:ring-[#55b8e8]",
            error && "border-red-300",
          )}
        />
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required ? (
            <>
              <span className="ml-0.5 text-[#c2410c]" aria-hidden>
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </span>
      </label>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

function TextareaField({
  name,
  errorKey,
  label,
  required,
  errors,
  values,
}: FieldProps) {
  const error = errors?.[errorKey]?.[0];
  const id = `lead-${name}`;
  return (
    <div className="space-y-2">
      <FieldLabel id={id} label={label} required={required} />
      <textarea
        id={id}
        name={name}
        aria-label={label}
        required={required}
        rows={5}
        defaultValue={values?.[name] ?? ""}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, "resize-y")}
      />
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="text-sm text-red-600">
      {error}
    </p>
  );
}

function ActionMessage({
  state,
  muted,
}: {
  state: PublicLeadActionState;
  // When the error summary is on screen it owns the assertive announcement, so
  // this region drops role="alert"/assertive to avoid double SR spam. Success
  // and server-error (no field errors) announcements are unaffected.
  muted?: boolean;
}) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  const announceAssertively = isError && !muted;
  return (
    <p
      role={announceAssertively ? "alert" : undefined}
      aria-live={announceAssertively ? "assertive" : "polite"}
      className={cn(
        "text-sm font-medium",
        isError ? "text-red-600" : "text-emerald-700",
      )}
    >
      {state.message}
    </p>
  );
}
