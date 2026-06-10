"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  initialLeadActionState,
  resolveLeadSuccessTransition,
  type PublicLeadActionState,
} from "@/app/lead-action-state";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { cn } from "@/lib/utils";

type PublicLeadFormProps = {
  action: PublicLeadFormAction;
  attribution: LeadAttribution;
  idempotencyKey: string;
  submitLabel: string;
  intent: "apply" | "contact";
  layout?: "standard" | "compact";
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
};

const inputClass =
  "min-h-12 w-full rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2d9fd6] focus:ring-2 focus:ring-[#55b8e8]";

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

export function PublicLeadForm({
  action,
  attribution,
  idempotencyKey,
  submitLabel,
  intent,
  layout = "standard",
}: PublicLeadFormProps) {
  const router = useRouter();
  const [submittedEmail, setSubmittedEmail] = useState("");

  const [state, dispatch, pending] = useActionState(
    action,
    initialLeadActionState,
  );

  // Capture the submitted email before delegating to the server action so a
  // successful contact submission can echo it back in the success panel. This
  // runs in the submit event, not during render, and the wrapper returns the
  // action's value unchanged, so the {success/error} contract is untouched.
  const formAction = (formData: FormData) => {
    const email = formData.get("email");
    setSubmittedEmail(typeof email === "string" ? email : "");
    return dispatch(formData);
  };

  const transition = resolveLeadSuccessTransition(
    state,
    intent,
    submittedEmail,
  );
  const redirectHref =
    transition?.kind === "redirect" ? transition.href : undefined;

  // Apply submissions navigate to a dedicated thank-you page. Navigation is a
  // true external side-effect, so it belongs in an effect rather than render.
  useEffect(() => {
    if (redirectHref) {
      router.push(redirectHref);
    }
  }, [redirectHref, router]);

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const isApply = intent === "apply";
  const isCompact = layout === "compact";
  const showQualificationFields = isApply || !isCompact;

  if (transition?.kind === "panel") {
    return <ContactSuccessPanel email={transition.email} />;
  }

  return (
    <form
      action={formAction}
      className={cn(
        "grid gap-5 rounded-[12px] border-2 border-[#111111] bg-white p-5 shadow-[8px_8px_0_#55b8e8]",
        !isCompact && "sm:p-7",
      )}
    >
      <HiddenAttribution
        attribution={attribution}
        idempotencyKey={idempotencyKey}
      />

      <div className={cn("grid gap-5", !isCompact && "sm:grid-cols-2")}>
        <TextField
          name="full_name"
          errorKey="fullName"
          label="Name"
          autoComplete="name"
          required
          errors={errors}
        />
        <TextField
          name="email"
          errorKey="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          errors={errors}
        />
        {showQualificationFields && (
          <>
            <TextField
              name="phone"
              errorKey="phone"
              label="Phone"
              type="tel"
              autoComplete="tel"
              errors={errors}
            />
            <TextField
              name="city"
              errorKey="city"
              label="City"
              autoComplete="address-level2"
              errors={errors}
            />
            {/* State renders as the same dropdown on both forms; only
                /apply requires it (matching server-side validation). */}
            <SelectField
              name="state_region"
              errorKey="stateRegion"
              label="State"
              required={isApply}
              errors={errors}
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
                  options={[
                    "Researching vending",
                    "Buying first machine",
                    "Already operating",
                    "Scaling locations",
                  ]}
                />
                <SelectField
                  name="budget"
                  errorKey="budget"
                  label="Available startup budget"
                  required
                  errors={errors}
                  options={["Under $5k", "$5k-$10k", "$10k-$25k", "$25k+"]}
                />
                <SelectField
                  name="timeline"
                  errorKey="timeline"
                  label="Launch timeline"
                  required
                  errors={errors}
                  options={[
                    "Immediately",
                    "Next 30 days",
                    "Next 90 days",
                    "Still deciding",
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

        <ActionMessage state={state} />
      </div>
    </form>
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

function HiddenAttribution({
  attribution,
  idempotencyKey,
}: {
  attribution: LeadAttribution;
  idempotencyKey: string;
}) {
  return (
    <>
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      {Object.entries(attribution).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
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
}: FieldProps) {
  const error = errors?.[errorKey]?.[0];
  const id = `lead-${name}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-[#c2410c]" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      <input
        id={id}
        name={name}
        aria-label={label}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, error && "border-red-300 focus:ring-red-200")}
      />
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

function SelectField({
  name,
  errorKey,
  label,
  required,
  options,
  errors,
}: FieldProps & { options: readonly string[] }) {
  const error = errors?.[errorKey]?.[0];
  const id = `lead-${name}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-[#c2410c]" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      <select
        id={id}
        name={name}
        aria-label={label}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, error && "border-red-300 focus:ring-red-200")}
        defaultValue=""
      >
        <option value="" disabled>
          Select
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
}: FieldProps) {
  const error = errors?.[errorKey]?.[0];
  const id = `lead-${name}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-[#c2410c]" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      <textarea
        id={id}
        name={name}
        aria-label={label}
        required={required}
        rows={5}
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

function ActionMessage({ state }: { state: PublicLeadActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      aria-live="polite"
      className={cn(
        "text-sm font-medium",
        state.status === "success" ? "text-emerald-700" : "text-red-600",
      )}
    >
      {state.message}
    </p>
  );
}
