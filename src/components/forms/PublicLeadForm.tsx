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
import type { LeadAttribution } from "@/lib/lead-attribution";
import { buildCalendlyBookingUrl } from "@/lib/content/lead-embed";
import { US_STATES } from "@/lib/content/us-states";
import {
  VP_CONSENT_CONTACT_LABEL,
  VP_CONSENT_UPDATES_LABEL,
  VP_INVEST_FIELD_OPTIONS,
  VP_INVEST_LABEL,
  VP_QUESTION_IDS,
  VP_TIMELINE_FIELD_OPTIONS,
  VP_TIMELINE_LABEL,
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
  // Override the initial action state. Production always uses the idle default;
  // this exists so SSR-rendered tests can exercise the field-error layer.
  initialState?: PublicLeadActionState;
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
  inlineQualification = false,
  initialState = initialLeadActionState,
}: PublicLeadFormProps) {
  const router = useRouter();
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedValues, setSubmittedValues] = useState<
    Record<string, string>
  >({});

  const [state, dispatch, pending] = useActionState(action, initialState);

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
    const values: Record<string, string> = {};
    for (const [name, value] of formData.entries()) {
      if (typeof value === "string") values[name] = value;
    }
    setSubmittedValues(values);
    setSubmittedEmail(values.email ?? "");
    return dispatch(formData);
  };

  // When a Calendly handoff is configured, a successful submit sends the lead
  // straight to the scheduler (name/email pre-filled) instead of the internal
  // thank-you page or success panel. Calendly is a different origin, so this is
  // a full-page navigation, not a client-router push. This takes precedence
  // over the internal transition below.
  const bookingHref =
    state.status === "success" && bookingRedirectUrl
      ? buildCalendlyBookingUrl(bookingRedirectUrl, {
          name: submittedValues.full_name,
          email: submittedValues.email,
          attribution,
        })
      : undefined;

  const transition = bookingHref
    ? null
    : resolveLeadSuccessTransition(state, intent, submittedEmail);
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

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const summaryItems = deriveLeadErrorSummary(state);
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
  const isQualification = intent === "qualification";
  const isCompact = layout === "compact";
  const showQualificationFields = isApply || (!isCompact && !isQualification);
  const showPhoneField = isQualification || showQualificationFields;
  const showInlineQualificationFields = isQualification && inlineQualification;

  if (bookingHref) {
    return <BookingRedirectPanel />;
  }

  if (transition?.kind === "panel") {
    return <ContactSuccessPanel email={transition.email} />;
  }

  if (transition?.kind === "qualification-result") {
    return <FitResultPanel state={transition.state} score={transition.score} />;
  }

  return (
    <form
      action={formAction}
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
            label="Phone"
            type="tel"
            autoComplete="tel"
            required={isQualification}
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
            {/* Light divider separating the opt-in checks from the two
                qualifying questions below (per Kody), with generous spacing so
                the sections read as distinct groups. */}
            <div
              data-testid="qualification-divider"
              aria-hidden
              className="mt-3 border-t border-slate-200 sm:col-span-2"
            />
            <div className="grid gap-7 sm:col-span-2">
              <SelectField
                name={VP_QUESTION_IDS.timeline}
                errorKey="timeline"
                label={VP_TIMELINE_LABEL}
                required
                errors={errors}
                values={submittedValues}
                options={VP_TIMELINE_FIELD_OPTIONS}
              />
              <SelectField
                name={VP_QUESTION_IDS.invest}
                errorKey="invest"
                label={VP_INVEST_LABEL}
                required
                errors={errors}
                values={submittedValues}
                options={VP_INVEST_FIELD_OPTIONS}
              />
            </div>
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-7 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Submitting..." : submitLabel}
        </button>

        <ActionMessage state={state} muted={hasSummary} />
      </div>

      <PrivacyAssurance intent={intent} />
    </form>
  );
}

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
}: {
  state: ThankYouStateKey;
  score: number;
}) {
  const content = THANK_YOU_STATES[state];
  const links = THANK_YOU_STATE_LINKS[state];
  const primaryHref = THANK_YOU_LINKS[links.primary];
  const secondaryHref =
    content.secondaryCta && links.secondary
      ? THANK_YOU_LINKS[links.secondary]
      : undefined;
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
        className="inline-flex min-h-12 w-fit items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-7 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {content.cta}
      </a>
      {secondaryHref && content.secondaryCta && (
        <p className="text-sm font-semibold text-slate-600">
          {content.secondaryNote ? `${content.secondaryNote} ` : null}
          <a
            href={secondaryHref}
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
