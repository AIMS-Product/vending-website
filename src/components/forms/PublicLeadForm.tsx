"use client";

import { useActionState } from "react";
import {
  initialLeadActionState,
  type PublicLeadActionState,
} from "@/app/lead-action-state";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { cn } from "@/lib/utils";

type PublicLeadFormProps = {
  action: (
    prev: PublicLeadActionState,
    formData: FormData,
  ) => Promise<PublicLeadActionState>;
  attribution: LeadAttribution;
  idempotencyKey: string;
  submitLabel: string;
  intent: "apply" | "contact";
};

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
  "border-brand-100 focus:border-brand-400 focus:ring-brand-300 min-h-12 w-full rounded-lg border bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2";

export function PublicLeadForm({
  action,
  attribution,
  idempotencyKey,
  submitLabel,
  intent,
}: PublicLeadFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialLeadActionState,
  );
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const isApply = intent === "apply";

  return (
    <form
      action={formAction}
      className="grid gap-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7"
    >
      <HiddenAttribution
        attribution={attribution}
        idempotencyKey={idempotencyKey}
      />

      <div className="grid gap-5 sm:grid-cols-2">
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
        {isApply ? (
          <>
            <SelectField
              name="state_region"
              errorKey="stateRegion"
              label="State"
              required
              errors={errors}
              options={[
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
              ]}
            />
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
        ) : (
          <TextField
            name="state_region"
            errorKey="stateRegion"
            label="State"
            autoComplete="address-level1"
            errors={errors}
          />
        )}
      </div>

      <TextareaField
        name="message"
        errorKey="message"
        label={isApply ? "What are you trying to build?" : "Message"}
        required={!isApply}
        errors={errors}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 focus-visible:ring-brand-300 inline-flex min-h-12 items-center justify-center rounded-full px-7 py-3 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Submitting..." : submitLabel}
        </button>

        <ActionMessage state={state} />
      </div>
    </form>
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
      </label>
      <input
        id={id}
        name={name}
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
}: FieldProps & { options: string[] }) {
  const error = errors?.[errorKey]?.[0];
  const id = `lead-${name}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        name={name}
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
      </label>
      <textarea
        id={id}
        name={name}
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
